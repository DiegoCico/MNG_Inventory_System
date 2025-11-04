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
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders

TEMPLATE_PATH = os.environ.get("TEMPLATE_PATH", "").strip()
SES_FROM = os.environ.get("SES_FROM", "").strip()

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

_ses = None

def ses_client():
    global _ses
    if _ses is None:
        _ses = boto3.client("ses")
    return _ses

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
    "max_rows": 14,
    "max_width": 468,
    "font": "Helvetica",
    "size": 8,
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

def _clip_to_width(text: str, max_width: float, font: str, size: float) -> str:
    if max_width is None or not text:
        return text
    if pdfmetrics.stringWidth(text, font, size) <= max_width:
        return text
    ell = "…"
    for n in range(len(text) - 1, 0, -1):
        cand = text[:n].rstrip() + ell
        if pdfmetrics.stringWidth(cand, font, size) <= max_width:
            return cand
    return ell

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
        rows = [PLACEHOLDERS["REMARKS"]]
    x = REMARKS_TABLE["x"]
    y0 = REMARKS_TABLE["y_start"]
    gap = REMARKS_TABLE["row_gap"]
    max_rows = REMARKS_TABLE["max_rows"]
    max_width = REMARKS_TABLE["max_width"]
    font = REMARKS_TABLE["font"]
    size = REMARKS_TABLE["size"]
    c.setFont(font, size)
    y = y0 
    for raw in rows[:max_rows]:
        line = str(raw).replace("\n", " ").strip()
        line = _clip_to_width(line, max_width, font, size)
        c.drawString(x, int(round(y)), line)
        y -= gap 

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
    if not TEMPLATE_PATH:
        raise RuntimeError("TEMPLATE_PATH is not set")
    root = os.environ.get("LAMBDA_TASK_ROOT", ".")
    p = TEMPLATE_PATH if os.path.isabs(TEMPLATE_PATH) else os.path.join(root, TEMPLATE_PATH)
    with open(p, "rb") as f:
        return f.read()

def to_pdf_values(payload):
    if payload.get("_labels"):
        keys = list(FIELD_COORDS.keys()) + ["REMARKS"]
        out = {k: LABELS.get(k, k) for k in keys}
        out["REMARKS_LIST"] = ["REMARKS", "REMARKS (row 2)"]
        return out
    def pick(name, key):
        v = payload.get(name)
        if isinstance(v, str):
            v = v.strip()
        return v if v else PLACEHOLDERS[key]
    remarks_list = payload.get("remarksList")
    if remarks_list is None:
        r_legacy = payload.get("remarks")
        if isinstance(r_legacy, list):
            remarks_list = r_legacy
        elif isinstance(r_legacy, str):
            remarks_list = [s for s in r_legacy.splitlines() if s.strip()]
        else:
            remarks_list = [PLACEHOLDERS["REMARKS"]]
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
        "REMARKS_LIST":       [
            "Checked oil, coolant, and transmission fluid levels – all within spec.",
            "Lubricated door hinges and inspected weather seals for cracks.",
            "Tested brake lights, turn signals, and headlights for functionality.",
            "Verified fire extinguisher pressure gauge reads full.",
            "Inspected windshield for chips or cracks; none found.",
            "Tightened loose battery terminals and applied anti-corrosion gel.",
            "Checked wiper blades for wear and ensured washer fluid is full.",
            "Confirmed horn operation and instrument panel indicator lights.",
            "Reviewed maintenance log for overdue services – none pending.",
            "Visually inspected undercarriage for leaks or damage.",
            "Checked tire tread depth and adjusted air pressure to spec.",
            "Confirmed first aid kit contents complete and sealed.",
            "Performed 10-minute idle test; engine stable, no warning lights.",
            "Recorded inspection results in logbook and signed off by inspector.",
        ],
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
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _resp(200, "")
    try:
        payload = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Invalid JSON body"})
    action = (payload.get("action") or "download").lower()
    form_id = (payload.get("formId") or str(uuid.uuid4())).strip()
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
