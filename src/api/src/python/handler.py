
import os
import json
import io
import uuid
from datetime import datetime, timezone

import boto3
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics

import base64
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders

S3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]
TEMPLATE_KEY = os.environ["TEMPLATE_KEY"]

# Coordinates (points); origin is bottom-left on an 8.5x11" page (612x792 pt)
FIELD_COORDS = {
    "ORG_NAME":           (72, 708),
    "UIC":                (430, 708),
    "NOMENCLATURE":       (72, 684),
    "MODEL":              (300, 684),
    "SERIAL_NUMBER":      (450, 684),
    "TYPE_OF_INSPECTION": (72, 660),
    "TM_NUMBER":          (300, 660),
    "TM_DATE":            (450, 660),
    "MILES_HOURS":        (72, 636),
    "LOCATION":           (300, 636),
    "DATE":               (450, 636),
    "INSPECTOR_NAME":     (72, 612),
    "INSPECTOR_RANK":     (300, 612),
}


# Boxes for multi-line fields: (x, y_top, max_width, line_gap, max_lines)
WRAP_AREAS = {
    "REMARKS": (72, 560, 468, 11, 14),
}

def draw_wrapped_text(c, x, y_top, text, max_width, line_gap, max_lines=None, font="Helvetica", size=9):
    """
    Draw text that wraps to new lines if it would exceed max_width.
    Starts drawing at (x, y_top) and goes downward by line_gap per line.
    """
    text = (text or "").strip()
    if not text:
        return

    words = text.split()
    lines = []
    current = ""

    for w in words:
        candidate = (current + " " + w).strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = w
            if max_lines and len(lines) >= max_lines:
                break

    if current and (not max_lines or len(lines) < max_lines):
        lines.append(current)

    for i, line in enumerate(lines):
        c.drawString(x, y_top - i * line_gap, line)

def make_overlay(page_width, page_height, values, font="Helvetica", size=9):
    """
    Build a 1-page in-memory PDF with ytext drawn in the right spots.
    values is a dict like {"ORG_NAME": "...", "REMARKS": "...", ...}
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_width, page_height))
    c.setFont(font, size)

    # draw multi-line fields first
    for field, (x, y_top, max_w, line_gap, max_lines) in WRAP_AREAS.items():
        val = (values.get(field) or "").strip()
        if val:
            draw_wrapped_text(c, x, y_top, val, max_w, line_gap, max_lines, font, size)

    # draw single-line fields
    for field, (x, y) in FIELD_COORDS.items():
        val = (values.get(field) or "").strip()
        if val:
            c.drawString(x, y, val)

    c.save()
    buf.seek(0)
    return PdfReader(buf)

def stamp(template_bytes, values, font="Helvetica", size=9):
    """
    Merge the overlay onto the template PDF and return the finished PDF bytes.
    """
    template = PdfReader(io.BytesIO(template_bytes))
    writer = PdfWriter()

    # build overlay based on the first page size
    mb = template.pages[0].mediabox
    page_w, page_h = float(mb.width), float(mb.height)
    overlay = make_overlay(page_w, page_h, values, font, size)

    for page in template.pages:
        page.merge_page(overlay.pages[0])
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.getvalue()

def presign(s3_client, bucket, key, expires=900):
    """
    Return a pre-signed S3 URL to download the object (default 15 minutes).
    """
    return s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )

PLACEHOLDER = {
    "ORG_NAME":           "<from DDB: orgName>",
    "UIC":                "<from DDB: unitId/uic>",
    "NOMENCLATURE":       "<from DDB: equipment.nomenclature or freeTextItem>",
    "MODEL":              "<from DDB: equipment.model>",
    "SERIAL_NUMBER":      "<from DDB: equipment.serial>",
    "TYPE_OF_INSPECTION": "<from request: inspectionType>",
    "TM_NUMBER":          "<from DDB: equipment.tmNumber>",
    "TM_DATE":            "<from DDB: equipment.tmDate>",
    "MILES_HOURS":        "<from DDB: equipment.milesHours>",
    "LOCATION":           "<from DDB: unit.location>",
    "DATE":               "<auto UTC yyyy-mm-dd>",
    "INSPECTOR_NAME":     "<from request: reporterName>",
    "INSPECTOR_RANK":     "<from request: reporterRank>",
    "REMARKS":            "<from request: faultText>",
}

def to_pdf_values(payload):
    def pick(name, placeholder_key):
        v = (payload.get(name) or "").strip()
        return v if v else PLACEHOLDERS[placeholder_key]

    return {
        "ORG_NAME":           pick("orgName", "ORG_NAME"),
        "UIC":                pick("unitId", "UIC"),
        "NOMENCLATURE":       (payload.get("nomenclature") or payload.get("freeTextItem") or PLACEHOLDERS["NOMENCLATURE"]),
        "MODEL":              pick("model", "MODEL"),
        "SERIAL_NUMBER":      pick("serial", "SERIAL_NUMBER"),
        "TYPE_OF_INSPECTION": pick("inspectionType", "TYPE_OF_INSPECTION"),
        "TM_NUMBER":          pick("tmNumber", "TM_NUMBER"),
        "TM_DATE":            pick("tmDate", "TM_DATE"),
        "MILES_HOURS":        pick("milesHours", "MILES_HOURS"),
        "LOCATION":           pick("location", "LOCATION"),
        "DATE":               datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "INSPECTOR_NAME":     pick("reporterName", "INSPECTOR_NAME"),
        "INSPECTOR_RANK":     pick("reporterRank", "INSPECTOR_RANK"),
        "REMARKS":            pick("faultText", "REMARKS"),
    }

SES = boto3.client("ses")  # same region as your Lambda

def send_pdf_email(to_addr, from_addr, subject, body_text, pdf_bytes, filename):
    # Build a MIME email with a PDF attachment 
    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr

    # Plain text body
    msg.attach(MIMEText(body_text, "plain"))

    # PDF attachment
    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
    msg.attach(part)

    # Send
    SES.send_raw_email(
        Source=from_addr,
        Destinations=[to_addr],
        RawMessage={"Data": msg.as_string()},
    )

def main(event, context):
    # Parse request
    try:
        body_raw = event.get("body") or "{}"
        payload = json.loads(body_raw)
    except Exception:
        return {"statusCode": 400, "body": "Invalid JSON body"}

    action = (payload.get("action") or "download").lower()  # "download" | "email"
    form_id = (payload.get("formId") or str(uuid.uuid4())).strip()

    # Build PDF values (placeholders for now)
    values = to_pdf_values(payload)

    # Read template (only the template lives in S3)
    try:
        template_bytes = S3.get_object(Bucket=BUCKET, Key=TEMPLATE_KEY)["Body"].read()
    except Exception as e:
        return {"statusCode": 500, "body": f"Template read failed: {e}"}

    # Stamp PDF in memory
    try:
        pdf_bytes = stamp(template_bytes, values)
    except Exception as e:
        return {"statusCode": 500, "body": f"Stamping failed: {e}"}

    filename = f"DA2404_{form_id}.pdf"

    if action == "email":
        to_email = (payload.get("toEmail") or "").strip()
        if not to_email:
            return {"statusCode": 400, "body": "toEmail is required for action=email"}

        from_email = (payload.get("fromEmail") or os.environ.get("SES_FROM") or "").strip()
        if not from_email:
            return {"statusCode": 400, "body": "Set fromEmail or SES_FROM env var"}

        subject = payload.get("subject") or "DA Form 2404"
        body_text = payload.get("body") or "Attached: DA Form 2404."

        try:
            send_pdf_email(
                to_addr=to_email,
                from_addr=from_email,
                subject=subject,
                body_text=body_text,
                pdf_bytes=pdf_bytes,
                filename=filename,
            )
        except Exception as e:
            # unverified addresses in sandbox, region mismatch
            return {"statusCode": 500, "body": f"Email send failed: {e}"}

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"ok": True})
        }

    # default: download 
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return {
        "statusCode": 200,
        "isBase64Encoded": True,
        "headers": {
            "Content-Type": "application/pdf",
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
        "body": b64,
    }