import os
import io
import json
import base64
import uuid
from datetime import datetime, timezone

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
import boto3
import sys
# make sure it goes through all items and check damaged should produces every pdf
# going to be called reports instead of damageReports

TEMPLATE_PATH  = os.environ.get("TEMPLATE_PATH", "").strip()  
TABLE_NAME     = os.environ.get("TABLE_NAME", "").strip()
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "").strip()
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
}

_ddb_cli = None
_s3      = None

def ddb_client():
    global _ddb_cli
    if _ddb_cli is None:
        _ddb_cli = boto3.client("dynamodb")
    return _ddb_cli

def s3_client():
    global _s3
    if _s3 is None:
        from botocore.config import Config
        _s3 = boto3.client("s3", config=Config(signature_version='s3v4'))
    return _s3

FIELD_COORDS = {
    "ORGANIZATION":       (90, 720),
    "NOMENCLATURE":       (390, 720),
    "SERIAL_NUMBER":      (90, 690),
    "DATE":               (400, 690),
}

REMARKS_TABLE = {
    "x": 110,
    "y_start": 364,
    "row_gap": 24,
    "max_rows": 28,
    "max_width": 194,
    "font": "Helvetica",
    "size": 8,
    "wrap_gap": 10,
}

PLACEHOLDERS = {
    "ORGANIZATION":       "<organization>",
    "NOMENCLATURE":       "<nomenclature>",
    "SERIAL_NUMBER":      "<serial>",
    "DATE":               "<yyyy-mm-dd>",
    "REMARKS":            "<remarks row>",
}

LABELS = {
    "ORGANIZATION":       "ORGANIZATION",
    "NOMENCLATURE":       "NOMENCLATURE",
    "SERIAL NUMBER":      "SERIAL NUMBER",
    "SERIAL_NUMBER":      "SERIAL NUMBER",
    "DATE":               "DATE",
    "REMARKS":            "REMARKS",
}

def _wrap_to_width(text: str, max_width: float, font: str, size: float):
    words = (text or "").split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(test, font, size) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def _draw_remarks_list(c: canvas.Canvas, values: dict):
    rows = values.get("REMARKS_LIST")
    if rows is None:
        legacy = values.get("REMARKS", "")
        if isinstance(legacy, list):
            rows = legacy
        else:
            s = (legacy or "").strip()
            rows = [r for r in s.splitlines() if r] if s else []
    if not rows:
        rows = ["N/A"]

    x = REMARKS_TABLE["x"]
    y = REMARKS_TABLE["y_start"]
    row_gap = REMARKS_TABLE["row_gap"]
    wrap_gap = REMARKS_TABLE.get("wrap_gap", 10)
    max_rows = REMARKS_TABLE["max_rows"]
    max_width = REMARKS_TABLE["max_width"]
    font = REMARKS_TABLE["font"]
    size = REMARKS_TABLE["size"]

    c.setFont(font, size)

    for raw in rows[:max_rows]:
        group_start_y = y
        line = str(raw).replace("\n", " ").strip()
        wrapped = _wrap_to_width(line, max_width, font, size)

        size_pad = 2
        avail = max(row_gap - size_pad, 0)
        max_lines_in_row = max(1, 1 + (avail // max(wrap_gap, 1)))

        if len(wrapped) > max_lines_in_row:
            visible = wrapped[:max_lines_in_row]
            last = visible[-1]
            ell = " …"
            while last and pdfmetrics.stringWidth(last + ell, font, size) > max_width:
                last = last[:-1].rstrip()
            visible[-1] = (last + ell) if last else "…"
            wrapped = visible

        for i, wl in enumerate(wrapped):
            c.drawString(x, int(round(group_start_y - i * wrap_gap)), wl)

        y = group_start_y - row_gap

def make_overlay(page_w, page_h, values, font="Helvetica", size=9):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setFont(font, size)

    _draw_remarks_list(c, values)

    for field, (x, y) in FIELD_COORDS.items():
        val = (values.get(field) or "").strip()
        if val:
            c.drawString(x, y, val)

    c.save()
    buf.seek(0)
    return PdfReader(buf)

def stamp(template_bytes, values, font="Helvetica", size=9):
    tmpl = PdfReader(io.BytesIO(template_bytes))
    writer = PdfWriter()
    mb = tmpl.pages[0].mediabox
    page_w, page_h = float(mb.width), float(mb.height)

    overlay = make_overlay(page_w, page_h, values, font, size)

    for i, page in enumerate(tmpl.pages):
        if i == 0:
            page.merge_page(overlay.pages[0])
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.getvalue()

def read_template_bytes():
    if not UPLOADS_BUCKET:
        raise RuntimeError("UPLOADS_BUCKET env var must be set for template")
    key = TEMPLATE_PATH or "templates/2404-template.pdf"
    try:
        obj = s3_client().get_object(Bucket=UPLOADS_BUCKET, Key=key)
        return obj["Body"].read()
    except Exception as e:
        raise RuntimeError(f"Failed to load template from S3 s3://{UPLOADS_BUCKET}/{key}: {e}")

def ddb_query_team_items(team_id: str):
    if not TABLE_NAME:
        raise RuntimeError("TABLE_NAME env var is not set")
    cli = ddb_client()
    from boto3.dynamodb.types import TypeDeserializer
    deser = TypeDeserializer()
    resp = cli.query(
        TableName=TABLE_NAME,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": {"S": f"TEAM#{team_id}"},
            ":sk": {"S": "ITEM#"},
        },
    )
    items = []
    for raw in resp.get("Items", []):
        items.append({k: deser.deserialize(v) for k, v in raw.items()})
    return items

def ddb_get_team(team_id: str):
    if not TABLE_NAME:
        raise RuntimeError("TABLE_NAME env var is not set")

    cli = ddb_client()
    from boto3.dynamodb.types import TypeDeserializer
    deser = TypeDeserializer()

    resp = cli.get_item(
        TableName=TABLE_NAME,
        Key={
            "PK": {"S": f"TEAM#{team_id}"},
            "SK": {"S": "TEAM"}
        },
        ConsistentRead=True
    )

    item = resp.get("Item")
    if not item:
        return {}

    return {k: deser.deserialize(v) for k, v in item.items()}

def s3_put_pdf(bucket: str, key: str, body: bytes):
    # Get KMS key ARN from environment (set by CDK)
    kms_key_arn = os.environ.get('KMS_KEY_ARN', '').strip()
    
    put_params = {
        'Bucket': bucket,
        'Key': key,
        'Body': body,
        'ContentType': 'application/pdf',
    }
    
    # Add KMS encryption if key is provided
    if kms_key_arn:
        put_params['ServerSideEncryption'] = 'aws:kms'
        put_params['SSEKMSKeyId'] = kms_key_arn
    
    s3_client().put_object(**put_params)

def to_pdf_values(payload):
    if payload.get("_labels"):
        keys = list(FIELD_COORDS.keys()) + ["REMARKS"]
        out = {k: LABELS.get(k, k) for k in keys}
        out["REMARKS_LIST"] = ["REMARKS", "REMARKS (row 2)"]
        return out

    remarks_list = payload.get("remarksList")
    if remarks_list is None:
        r_legacy = payload.get("remarks")
        if r_legacy is None:
            # Try both old and new field names
            r_legacy = payload.get("reports") or payload.get("damageReports")
        if isinstance(r_legacy, list):
            remarks_list = r_legacy
        elif isinstance(r_legacy, str):
            remarks_list = [s for s in r_legacy.splitlines() if s.strip()]
        else:
            remarks_list = ["N/A"]

    org = payload.get("organization") or payload.get("description")
    if isinstance(org, str):
        org = org.strip()
    if not org:
        org = "N/A"

    nom = payload.get("nomenclature") or payload.get("actualName")
    if isinstance(nom, str):
        nom = nom.strip()
    if not nom:
        nom = "N/A"

    return {
        "ORGANIZATION":       org,
        "NOMENCLATURE":       nom,
        "SERIAL_NUMBER":      (payload.get("serial") or payload.get("serialNumber") or "N/A"),
        "DATE":               (payload.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "REMARKS_LIST":       remarks_list,
    }

def _get_http_method(event) -> str:
    try:
        m = event.get("requestContext", {}).get("http", {}).get("method")
        if m:
            return m.upper()
    except Exception:
        pass
    m = event.get("httpMethod")
    return m.upper() if isinstance(m, str) else ""

def _get_body_json(event) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except Exception:
            pass
    try:
        return json.loads(body) if body else {}
    except Exception:
        return {}

def _resp(status, body=None, headers=None, is_b64=False):
    h = {"Cache-Control": "no-store"}
    h.update(CORS)
    if headers:
        h.update(headers)
    out = {"statusCode": status, "headers": h}
    if body is not None:
        out["body"] = body if isinstance(body, str) else json.dumps(body)
    if is_b64:
        out["isBase64Encoded"] = True
    return out

def generate_team_2404(team_id: str, save_to_s3: bool = True):
    if not UPLOADS_BUCKET:
        return {"ok": False, "error": "UPLOADS_BUCKET env var is not set"}

    try:
        tmpl_bytes = read_template_bytes()
    except Exception as e:
        return {"ok": False, "error": f"Template read failed: {e}"}

    try:
        items = ddb_query_team_items(team_id)
    except Exception as e:
        return {"ok": False, "error": f"DDB query failed: {e}"}

    try:
        team_data = ddb_get_team(team_id)
    except Exception:
        team_data = {}

    org_description = team_data.get("description")

    # Filter items that have status = "Damaged" (case-insensitive)
    damaged_items = []
    for itm in items:
        status = (itm.get("status") or "").lower()
        if status == "damaged":
            damaged_items.append(itm)

    if not damaged_items:
        return {"ok": True, "message": "No items with reports found for team", "teamId": team_id}

    writer = PdfWriter()

    for itm in damaged_items:
        values_input = {
            "description": org_description,
            "actualName": itm.get("actualName") or itm.get("name"),
            "serialNumber": itm.get("serialNumber") or itm.get("serial"),
            "reports": itm.get("damageReports"),
        }

        values = to_pdf_values(values_input)
        stamped_bytes = stamp(tmpl_bytes, values)
        stamped_reader = PdfReader(io.BytesIO(stamped_bytes))

        for page in stamped_reader.pages:
            writer.add_page(page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    out_buf.seek(0)
    pdf_bytes = out_buf.getvalue()

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    form_id = f"team_{team_id}"
    filename = f"DA2404_{form_id}_{timestamp}.pdf"
    key = f"Documents/{team_id}/2404/{filename}"


    if save_to_s3:
        try:
            s3_put_pdf(UPLOADS_BUCKET, key, pdf_bytes)
            
            # Generate presigned URL for download (valid for 1 hour)
            url = s3_client().generate_presigned_url(
                'get_object',
                Params={'Bucket': UPLOADS_BUCKET, 'Key': key},
                ExpiresIn=3600
            )
            
            return {
                "ok": True,
                "s3Key": key,
                "bucket": UPLOADS_BUCKET,
                "url": url,
                "teamId": team_id
            }
        except Exception as e:
            return {"ok": False, "error": f"S3 put failed: {e}"}

    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return {
        "ok": True,
        "downloadBase64": b64,
        "filename": filename,
        "contentType": "application/pdf",
        "teamId": team_id,
    }

def lambda_handler(event, context):
    method = _get_http_method(event)

    # Allow direct Lambda invocation (no httpMethod field)
    if not method:
        # Direct invocation from another Lambda - treat as POST
        pass
    elif method == "OPTIONS":
        return _resp(200, "")
    elif method == "GET":
        return _resp(200, {"ok": True, "service": "da2404-stamper", "ddbConfigured": bool(TABLE_NAME)})
    elif method != "POST":
        return _resp(405, {"error": "Method not allowed. Use POST."})

    payload = _get_body_json(event)
    if not isinstance(payload, dict):
        return _resp(400, {"error": "Invalid JSON body"})

    team_id = (payload.get("teamId") or "").strip()
    if not team_id:
        return _resp(400, {"error": "teamId is required"})

    save_to_s3 = bool(payload.get("saveToS3", True))

    result = generate_team_2404(team_id, save_to_s3=save_to_s3)
    status = 200 if result.get("ok") else 500
    return _resp(status, result)

main = lambda_handler

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "teamId argument is required"}))
        sys.exit(1)
    team_id = sys.argv[1].strip()
    fake_event = {
        "httpMethod": "POST",
        "body": json.dumps({"teamId": team_id, "saveToS3": True}),
        "isBase64Encoded": False,
    }
    resp = lambda_handler(fake_event, None)
    body = resp.get("body")
    if isinstance(body, dict):
        print(json.dumps(body))
    else:
        print(body or "")