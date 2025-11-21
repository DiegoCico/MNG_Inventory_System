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

# ====== Config ======
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
        _s3 = boto3.client("s3")
    return _s3

# ====== PDF Layout ======
FIELD_COORDS = {
    "ORGANIZATION":       (90, 720),
    "NOMENCLATURE":       (390, 720),
    "MODEL":              (500, 720),
    "SERIAL_NUMBER":      (90, 690),
    "TYPE_OF_INSPECTION": (490, 690),
    "TM_NUMBER":          (90, 660),
    "TM_DATE":            (220, 660),
    "MILES":              (190, 690),
    "HOURS":              (250, 690),
    "ROUNDS":             (290, 690),
    "HOTSTARTS":          (340, 690),
    "DATE":               (400, 690),
    "TM2_NUMBER":         (330, 660),
    "TM2_DATE":           (500, 660),
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
    "MODEL":              "<model>",
    "SERIAL_NUMBER":      "<serial>",
    "MILES":              "<miles>",
    "HOURS":              "<hours>",
    "ROUNDS":             "<rounds>",
    "HOTSTARTS":          "<hotstarts>",
    "DATE":               "<yyyy-mm-dd>",
    "TYPE_OF_INSPECTION": "<inspectionType>",
    "TM_NUMBER":          "<tmNumber>",
    "TM_DATE":            "<tmDate>",
    "TM2_NUMBER":         "<tm2Number>",
    "TM2_DATE":           "<tm2Date>",
    "REMARKS":            "<remarks row>",
}

LABELS = {
    "ORGANIZATION":       "ORGANIZATION",
    "NOMENCLATURE":       "NOMENCLATURE",
    "MODEL":              "MODEL",
    "SERIAL NUMBER":      "SERIAL NUMBER",
    "SERIAL_NUMBER":      "SERIAL NUMBER",
    "MILES":              "MILES",
    "HOURS":              "HOURS",
    "ROUNDS":             "ROUNDS",
    "HOTSTARTS":          "HOTSTARTS",
    "DATE":               "DATE",
    "TYPE_OF_INSPECTION": "TYPE OF INSPECTION",
    "TM_NUMBER":          "TM NUMBER",
    "TM_DATE":            "TM DATE",
    "TM2_NUMBER":         "TM2 NUMBER",
    "TM2_DATE":           "TM2 DATE",
    "REMARKS":            "REMARKS",
}

# ====== helpers ======
def _wrap_to_width(text: str, max_width: float, font: str, size: float):
    words = (text or "").split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(test, font, size) <= max_width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
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
    """
    Reads DA-2404 template PDF from S3.
    """
    bucket = "mng-dev-uploads-245120345540"
    key    = "templates/DA2404_template.pdf"

    if not bucket:
        raise RuntimeError("TEMPLATE_BUCKET or UPLOADS_BUCKET env var must be set")

    try:
        obj = s3_client().get_object(Bucket=bucket, Key=key)
        return obj["Body"].read()
    except Exception as e:
        raise RuntimeError(f"Failed to load template from S3 s3://{bucket}/{key}: {e}")

# ====== Dynamo & S3 ======
def ddb_get(pk: str, sk: str = "LATEST") -> dict:
    cli = ddb_client()
    resp = cli.get_item(
        TableName=TABLE_NAME,
        Key={"PK": {"S": pk}, "SK": {"S": sk}},
        ConsistentRead=True
    )
    item = resp.get("Item")
    if not item:
        raise RuntimeError("DDB item not found")
    from boto3.dynamodb.types import TypeDeserializer
    return {k: TypeDeserializer().deserialize(v) for k, v in item.items()}

def s3_put_pdf(bucket: str, key: str, body: bytes):
    s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/pdf",
        ACL="private"
    )


def to_pdf_values(payload):
    """
    Accepts either direct request fields OR a DDB-shaped dict.
    Produces the overlay field map expected by the stamper.
    """
    if payload.get("_labels"):
        keys = list(FIELD_COORDS.keys()) + ["REMARKS"]
        out = {k: LABELS.get(k, k) for k in keys}
        out["REMARKS_LIST"] = ["REMARKS", "REMARKS (row 2)"]
        return out

    def pick(name, key):
        v = payload.get(name)
        if isinstance(v, str):
            v = v.strip()
        if v:
            return v
        return "N/A"

    remarks_list = payload.get("remarksList")
    if remarks_list is None:
        r_legacy = payload.get("remarks")
        if isinstance(r_legacy, list):
            remarks_list = r_legacy
        elif isinstance(r_legacy, str):
            remarks_list = [s for s in r_legacy.splitlines() if s.strip()]
        else:
            remarks_list = ["N/A"] 

    return {
        "ORGANIZATION":       pick("organization", "ORGANIZATION"),
        "NOMENCLATURE":       pick("nomenclature", "NOMENCLATURE"),
        "MODEL":              pick("model", "MODEL"),
        "SERIAL_NUMBER":      (payload.get("serial") or payload.get("serialNumber") or "N/A"),
        "MILES":              pick("miles", "MILES"),
        "HOURS":              pick("hours", "HOURS"),
        "ROUNDS":             pick("rounds", "ROUNDS"),
        "HOTSTARTS":          pick("hotstarts", "HOTSTARTS"),
        "DATE":               (payload.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "TYPE_OF_INSPECTION": pick("inspectionType", "TYPE_OF_INSPECTION"),
        "TM_NUMBER":          pick("tmNumber", "TM_NUMBER"),
        "TM_DATE":            pick("tmDate", "TM_DATE"),
        "TM2_NUMBER":         pick("tm2Number", "TM2_NUMBER"),
        "TM2_DATE":           pick("tm2Date", "TM2_DATE"),
        "REMARKS_LIST":       remarks_list,
    }

# ====== HTTP helpers ======
def _get_http_method(event) -> str:
    try:
        m = event.get("requestContext", {}).get("http", {}).get("method")
        if m: return m.upper()
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
    if headers: h.update(headers)
    out = {"statusCode": status, "headers": h}
    if body is not None:
        out["body"] = body if isinstance(body, str) else json.dumps(body)
    if is_b64:
        out["isBase64Encoded"] = True
    return out

# ====== Lambda Handler ======
def lambda_handler(event, context):
    method = _get_http_method(event)

    if method == "OPTIONS":
        return _resp(200, "")

    if method == "GET":
        return _resp(200, {"ok": True, "service": "da2404-stamper", "ddbConfigured": bool(TABLE_NAME)})

    if method != "POST":
        return _resp(405, {"error": "Method not allowed. Use POST."})

    payload = _get_body_json(event)
    if not isinstance(payload, dict):
        return _resp(400, {"error": "Invalid JSON body"})

    pk = payload.get("pk")
    sk = payload.get("sk", "LATEST")
    save_to_s3 = bool(payload.get("saveToS3", True))

    # derive unit/asset from PK if possible
    unit = asset = None
    if pk:
        parts = pk.split("#")
        unit  = parts[2] if len(parts) > 2 else None
        asset = parts[3] if len(parts) > 3 else None

    # load template
    try:
        tmpl = read_template_bytes()
    except Exception as e:
        return _resp(500, {"error": f"Template read failed: {e}"})


    try:
        if pk:
            ddb_item = ddb_get(pk, sk)
            # allow request to provide overrides on top of DDB
            merged = {**ddb_item, **payload.get("override", {})}
            values = to_pdf_values(merged)
        else:
            values = to_pdf_values(payload)
        pdf_bytes = stamp(tmpl, values)
    except Exception as e:
        return _resp(500, {"error": f"Stamping failed: {e}"})

    # file naming + path in uploads bucket
    form_id = (payload.get("formId") or asset or str(uuid.uuid4())).strip()
    filename = f"DA2404_{form_id}.pdf"

    if save_to_s3:
        # choose team/asset fallbacks
        team_id = payload.get("teamId") or unit or "UnknownTeam"
        asset_id = asset or payload.get("asset") or form_id
        key = f"Documents/{team_id}/2404/{filename}"  
        try:
            s3_put_pdf(UPLOADS_BUCKET, key, pdf_bytes)
        except Exception as e:
            return _resp(500, {"error": f"S3 put failed: {e}"})
        return _resp(200, {"ok": True, "s3Key": key, "contentType": "application/pdf"})

    # inline download
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return _resp(
        200,
        b64,
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'inline; filename="{filename}"',
        },
        is_b64=True,
    )

main = lambda_handler
