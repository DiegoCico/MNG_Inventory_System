

import os
import io
import json
import base64
import uuid
from datetime import datetime, timezone

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics

# email deps (only used if action=email)
import boto3
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders


TEMPLATE_PATH = os.environ.get("TEMPLATE_PATH", "").strip()  

# required only for action=email
SES_FROM = os.environ.get("SES_FROM", "").strip()            

# CORS
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

# SES client
_ses = None
def ses_client():
    global _ses
    if _ses is None:
        _ses = boto3.client("ses")
    return _ses

# field positions (points). origin bottom-left on 8.5x11 (612x792)
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
    "DATE":               (440, 690),
    "TM2_NUMBER":         (330, 660),
    "TM2_DATE":           (500, 660),
}

# multi-line area for remarks: (x, y_top, max_width, line_gap, max_lines)
WRAP_AREAS = {
    "REMARKS": (110, 355, 468, 11, 14),
}

# placeholders so test PDFs aren’t empty
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
    "REMARKS":            "<remarks>",
}

LABELS = {
    "ORGANIZATION":       "ORGANIZATION",
    "NOMENCLATURE":       "NOMENCLATURE",
    "MODEL":              "MODEL",
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

def draw_wrapped_text(c, x, y_top, text, max_width, line_gap, max_lines=None, font="Helvetica", size=9):
    text = (text or "").strip()
    if not text:
        return
    words, lines, current = text.split(), [], ""
    for w in words:
        cand = (current + " " + w).strip()
        if pdfmetrics.stringWidth(cand, font, size) <= max_width:
            current = cand
        else:
            if current:
                lines.append(current)
            current = w
            if max_lines and len(lines) >= max_lines:
                break
    if current and (not max_lines or len(lines) < max_lines):
        lines.append(current)
    for i, line in enumerate(lines):
        c.drawString(x, y_top - i * line_gap, line)

def make_overlay(page_w, page_h, values, font="Helvetica", size=9):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setFont(font, size)

    # multi-line first
    for field, (x, y_top, max_w, line_gap, max_lines) in WRAP_AREAS.items():
        val = (values.get(field) or "").strip()
        if val:
            draw_wrapped_text(c, x, y_top, val, max_w, line_gap, max_lines, font, size)

    # single-line
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

    # build overlay sized to page 1
    mb = tmpl.pages[0].mediabox
    page_w, page_h = float(mb.width), float(mb.height)
    overlay = make_overlay(page_w, page_h, values, font, size)

    # merge on the first page; copy the rest untouched
    for i, page in enumerate(tmpl.pages):
        if i == 0:
            page.merge_page(overlay.pages[0])
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.getvalue()


def read_template_bytes():
    if not TEMPLATE_PATH:
        raise RuntimeError("TEMPLATE_PATH is not set")
    root = os.environ.get("LAMBDA_TASK_ROOT", ".")
    p = TEMPLATE_PATH if os.path.isabs(TEMPLATE_PATH) else os.path.join(root, TEMPLATE_PATH)
    with open(p, "rb") as f:
        return f.read()

def to_pdf_values(payload):
    # labels mode: show field names instead of real values
    if payload.get("_labels"):
        keys = list(FIELD_COORDS.keys()) + list(WRAP_AREAS.keys())
        return { k: LABELS.get(k, k) for k in keys }

    def pick(name, key):
        v = (payload.get(name) or "").strip()
        return v if v else PLACEHOLDERS[key]

    return {
        "ORGANIZATION":       pick("organization", "ORGANIZATION"),
        "NOMENCLATURE":       pick("nomenclature", "NOMENCLATURE"),
        "MODEL":              pick("model", "MODEL"),
        "SERIAL_NUMBER":      pick("serial", "SERIAL_NUMBER"),

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

        "REMARKS":            pick("remarks", "REMARKS"),  # your “table” for now
    }


def send_pdf_email(to_addr, from_addr, subject, body_text, pdf_bytes, filename):
    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(body_text or "", "plain"))

    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
    msg.attach(part)

    ses_client().send_raw_email(
        Source=from_addr,
        Destinations=[to_addr],
        RawMessage={"Data": msg.as_string()},
    )

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

def main(event, context):
    # CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _resp(200, "")

    # parse
    try:
        payload = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Invalid JSON body"})

    action = (payload.get("action") or "download").lower()
    form_id = (payload.get("formId") or str(uuid.uuid4())).strip()

    # template + stamp
    try:
        tmpl = read_template_bytes()
    except Exception as e:
        return _resp(500, {"error": f"Template read failed: {e}"})

    try:
        values = to_pdf_values(payload)
        pdf_bytes = stamp(tmpl, values)
    except Exception as e:
        return _resp(500, {"error": f"Stamping failed: {e}"})

    filename = f"DA2404_{form_id}.pdf"

    # email branch
    if action == "email":
        to_email = (payload.get("toEmail") or "").strip()
        if not to_email:
            return _resp(400, {"error": "toEmail is required for action=email"})
        from_email = (payload.get("fromEmail") or SES_FROM or "").strip()
        if not from_email:
            return _resp(400, {"error": "Set fromEmail in request or SES_FROM env var"})
        subject = payload.get("subject") or "DA Form 2404"
        body_text = payload.get("body") or "Attached: DA Form 2404."

        try:
            send_pdf_email(to_email, from_email, subject, body_text, pdf_bytes, filename)
        except Exception as e:
            return _resp(500, {"error": f"Email send failed: {e}"})

        return _resp(200, {"ok": True})

    # default: download
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
