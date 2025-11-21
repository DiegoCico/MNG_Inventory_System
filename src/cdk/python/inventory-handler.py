# inventory-handler.py — Cardo / white header box / black text
# Writes inventory_preview.pdf (local) or saves via Lambda

import os, io, json, base64, uuid
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
import boto3
from boto3.dynamodb.types import TypeDeserializer

# ---------- Env / Clients ----------
UPLOADS_BUCKET = "mng-dev-uploads-245120345540"
PHOTO_BUCKET   = os.environ.get("PHOTO_BUCKET", "").strip()    
TABLE_NAME     = os.environ.get("TABLE_NAME", "").strip()      

_s3  = None
_ddb = None

def s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3

def ddb():
    global _ddb
    if _ddb is None:
        _ddb = boto3.client("dynamodb")
    return _ddb

# ---------- Fonts ----------
try:
    pdfmetrics.registerFont(TTFont("Cardo", "Cardo-Regular.ttf"))
    pdfmetrics.registerFont(TTFont("Cardo-Bold", "Cardo-Bold.ttf"))
    pdfmetrics.registerFont(TTFont("Cardo-Italic", "Cardo-Italic.ttf"))
    BODY_FONT = "Cardo"
    TITLE_FONT = "Cardo-Bold"
    ITALIC_FONT = "Cardo-Italic"
except Exception:
    BODY_FONT = "Helvetica"
    TITLE_FONT = "Helvetica-Bold"
    ITALIC_FONT = "Helvetica-Oblique"

# ---------- Layout constants ----------
COLS = [
    ("Image",       76),
    ("Material",    90),
    ("LV",          20),
    ("Description", 240),
    ("ARC",         25),
    ("CIIC",        25),
    ("UI",          25),
    ("SCMC",        25),
    ("Auth Qty",    25),
    ("OH Qty",      25),
]

LEFT_MARGIN, RIGHT_MARGIN = 18, 18
PAGE_W, PAGE_H = letter
MULTI_HEADER_DOWN_BIAS = 0.50

TOP_Y             = 780
HEADER_PAD_V      = 8
HEADER_PAD_H      = 10
TITLE_LEADING     = 16
HEADER_LINE_H     = 14
HEADER_EXTRA_H    = 6
GAP_BELOW_HEADER  = 8

TABLE_HDR_H       = 22
ROW_MIN_H         = 46
CELL_PAD_X        = 4
CELL_PAD_Y        = 4
DESC_LINE_SPACING = 10
BOTTOM_MARGIN     = 36

GRAY_BORDER   = colors.Color(0.7, 0.7, 0.7)
TEXT_BLACK    = colors.black

TITLE_SIZE       = 8
HEADER_TEXT_SIZE = 8
TABLE_HDR_SIZE   = 8
BODY_TEXT_SIZE   = 8

# ---------- Utils ----------
def na(v):
    if v is None: return "N/A"
    if isinstance(v, str):
        s = v.strip()
        return s if s else "N/A"
    return v

def wrap_text(txt, width, font=BODY_FONT, size=BODY_TEXT_SIZE):
    text = (txt or "").strip()
    if not text: return []
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if stringWidth(test, font, size) <= width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def draw_centered_text(c, x, top_y, w, h, text, font=BODY_FONT, size=BODY_TEXT_SIZE):
    c.setFillColor(TEXT_BLACK)
    c.setFont(font, size)
    text = "" if text is None else str(text)
    tw = stringWidth(text, font, size)
    cx = x + (w - tw) / 2.0
    cy = top_y - (h / 2.0) + (size * 0.33)
    c.drawString(cx, cy, text)

# ---------- Header ----------
def draw_top_header_box(c, d, page_num, page_count):
    left, right = LEFT_MARGIN, PAGE_W - RIGHT_MARGIN
    date_val = d.get('date') or datetime.now().strftime('%Y-%m-%d')
    ei = d.get("endItem", {}) or {}
    pub = d.get("pub", {}) or {}

    title_h = TITLE_LEADING * 2
    info_h  = HEADER_LINE_H * 4
    box_h   = HEADER_PAD_V*2 + title_h + info_h + HEADER_EXTRA_H

    box_top    = TOP_Y
    box_bottom = box_top - box_h
    box_width  = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

    c.setFillColor(colors.white)
    c.setStrokeColor(GRAY_BORDER)
    c.setLineWidth(0.75)
    c.rect(left, box_bottom, box_width, box_h, stroke=1, fill=0)

    c.setFillColor(TEXT_BLACK)
    c.setFont(TITLE_FONT, TITLE_SIZE)
    c.drawCentredString(PAGE_W/2, box_top - HEADER_PAD_V - (TITLE_LEADING * 0.1),
                        "COMPONENT LISTING / HAND RECEIPT")
    c.setFont(BODY_FONT, HEADER_TEXT_SIZE)
    c.drawCentredString(PAGE_W/2, box_top - HEADER_PAD_V - (TITLE_LEADING * 0.7),
                        "(line-out whichever is not applicable)")

    top_text_y = box_top - HEADER_PAD_V - 2

    c.setFont(TITLE_FONT, HEADER_TEXT_SIZE)
    c.drawString(left + HEADER_PAD_H, top_text_y, "Date:")
    lw = stringWidth("Date:", TITLE_FONT, HEADER_TEXT_SIZE)
    c.setFont(BODY_FONT, HEADER_TEXT_SIZE)
    c.drawString(left + HEADER_PAD_H + lw + 3, top_text_y, date_val)

    page_label = "Page:"
    page_value = f"{page_num} of {page_count}"
    lw_r = stringWidth(page_label, TITLE_FONT, HEADER_TEXT_SIZE)
    vw_r = stringWidth(page_value, BODY_FONT, HEADER_TEXT_SIZE)
    total_r = lw_r + 3 + vw_r
    rx = right - HEADER_PAD_H - total_r
    c.setFont(TITLE_FONT, HEADER_TEXT_SIZE)
    c.drawString(rx, top_text_y, page_label)
    c.setFont(BODY_FONT, HEADER_TEXT_SIZE)
    c.drawString(rx + lw_r + 3, top_text_y, page_value)

    sloc_label = "SLOC:"
    sloc_val = d.get('sloc') or ""
    sloc_lw = stringWidth(sloc_label, TITLE_FONT, HEADER_TEXT_SIZE)
    sloc_vw = stringWidth(sloc_val, BODY_FONT, HEADER_TEXT_SIZE)
    sloc_total = sloc_lw + 3 + sloc_vw
    sloc_rx = right - HEADER_PAD_H - sloc_total
    sloc_y = top_text_y - HEADER_LINE_H
    c.setFont(TITLE_FONT, HEADER_TEXT_SIZE)
    c.drawString(sloc_rx, sloc_y, sloc_label)
    c.setFont(BODY_FONT, HEADER_TEXT_SIZE)
    c.drawString(sloc_rx + sloc_lw + 3, sloc_y, sloc_val)

    info_top    = box_bottom + HEADER_PAD_V + info_h
    info_bottom = box_bottom + HEADER_PAD_V + HEADER_LINE_H
    step = (info_top - info_bottom) / 3.0
    y1, y2, y3, y4 = info_top, info_top - step, info_top - 2*step, info_bottom

    def draw_bold_pair_line(y, pairs):
        FIELD_SPACING_X = 40
        x = left + HEADER_PAD_H
        for label, value in pairs:
            label_txt = f"{label}:"
            c.setFont(TITLE_FONT, HEADER_TEXT_SIZE)
            c.drawString(x, y, label_txt)
            lwp = stringWidth(label_txt, TITLE_FONT, HEADER_TEXT_SIZE)
            c.setFont(BODY_FONT, HEADER_TEXT_SIZE)
            val_txt = str(na(value))
            c.drawString(x + lwp + 3, y, val_txt)
            x += lwp + 3 + stringWidth(val_txt, BODY_FONT, HEADER_TEXT_SIZE) + FIELD_SPACING_X

    draw_bold_pair_line(y1, [("FE", d.get('fe')), ("UIC", d.get('uic')), ("DESC", d.get('unitDesc'))])
    draw_bold_pair_line(y2, [("END ITEM NIIN", ei.get('niin')), ("LIN", ei.get('lin')), ("DESC", ei.get('desc'))])
    draw_bold_pair_line(y3, [("SER/EQUIP NO", d.get('serEquipNo'))])
    draw_bold_pair_line(y4, [("PUB NUM", pub.get('num')), ("PUB DATE", pub.get('date')), ("BOM LAST UPDATED", pub.get('bomUpdated'))])

    def draw_label_line_bottom(label, y):
        c.setFont(TITLE_FONT, HEADER_TEXT_SIZE)
        lw = stringWidth(label, TITLE_FONT, HEADER_TEXT_SIZE)
        line_len = 70
        x_label = right - HEADER_PAD_H - (lw + 6 + line_len)
        c.drawString(x_label, y, label)
        x1 = x_label + lw + 6
        x2 = x1 + line_len
        c.line(x1, y + 1, x2, y + 1)

    to_y = box_bottom + HEADER_PAD_V + 6
    from_y = to_y + HEADER_LINE_H
    draw_label_line_bottom("TO:", from_y)
    draw_label_line_bottom("FROM:", to_y)

    return box_bottom - GAP_BELOW_HEADER

# ---------- Table ----------
def draw_header_multiline(c, x, y, w, h, lines, font=BODY_FONT, size=TABLE_HDR_SIZE, line_gap=2):
    c.setFillColor(TEXT_BLACK)
    c.setFont(TITLE_FONT, size)
    n = len(lines)
    if n == 1:
        first_baseline = y - (h / 2.0) + (size * 2.5)
    else:
        block_h = n * size + (n - 1) * line_gap
        first_baseline = (y + h/2.0) + (block_h/2.0) - size * 0.33
        first_baseline -= MULTI_HEADER_DOWN_BIAS * (size + line_gap)
    cx = x + w / 2.0
    for i, line in enumerate(lines):
        c.drawCentredString(cx, first_baseline - i * (size + line_gap), line)

def draw_table_header(c, y):
    c.setStrokeColor(GRAY_BORDER)
    c.setLineWidth(0.5)
    x = LEFT_MARGIN
    for name, w in COLS:
        c.setFillColor(colors.white)
        c.rect(x, y - TABLE_HDR_H, w, TABLE_HDR_H, stroke=1, fill=0)
        lines = ["Auth", "Qty"] if name == "Auth Qty" else ["OH", "Qty"] if name == "OH Qty" else [name]
        draw_header_multiline(c, x, y - TABLE_HDR_H, w, TABLE_HDR_H, lines, font=BODY_FONT, size=TABLE_HDR_SIZE, line_gap=2)
        x += w
    return y - TABLE_HDR_H

def measure_row_height(row):
    desc_w = next(w for (name, w) in COLS if name == "Description")
    txt = na(row.get("description"))
    wrapped = wrap_text("" if txt == "N/A" else txt, desc_w - 2*CELL_PAD_X, BODY_FONT, BODY_TEXT_SIZE)
    needed = CELL_PAD_Y*2 + max(1, len(wrapped)) * DESC_LINE_SPACING
    return max(ROW_MIN_H, needed), wrapped

def _read_image_bytes(imageKey):
    # LOCAL:/abs/path  => local dev
    if isinstance(imageKey, str) and imageKey.startswith("LOCAL:"):
        path = imageKey.split("LOCAL:", 1)[1]
        if os.path.exists(path):
            with open(path, "rb") as f:
                return f.read()
        return None
    # otherwise assume S3 key in PHOTO_BUCKET
    if PHOTO_BUCKET and imageKey:
        try:
            o = s3().get_object(Bucket=PHOTO_BUCKET, Key=imageKey)
            return o["Body"].read()
        except Exception:
            return None
    return None

def draw_row(c, y, row, row_h, desc_lines=None):
    c.setStrokeColor(GRAY_BORDER)
    c.setLineWidth(0.5)
    x = LEFT_MARGIN

    cells = [
        ("imageKey", None),
        ("material", str),
        ("lv", str),
        ("description", str),
        ("arc", str),
        ("ciic", str),
        ("ui", str),
        ("scmc", str),
        ("authQty", lambda v: f"{v}"),
        ("ohQty",   lambda v: f"{v}"),
    ]

    for (field, cast), (_, w) in zip(cells, COLS):
        c.rect(x, y - row_h, w, row_h, stroke=1, fill=0)
        val = row.get(field)
        c.setFillColor(TEXT_BLACK)

        if field == "imageKey":
            b = _read_image_bytes(val)
            if b:
                try:
                    img = ImageReader(io.BytesIO(b))
                    c.drawImage(img, x + CELL_PAD_X, y - row_h + CELL_PAD_Y,
                                width=w - 2*CELL_PAD_X, height=row_h - 2*CELL_PAD_Y,
                                preserveAspectRatio=True, anchor='sw')
                except Exception:
                    draw_centered_text(c, x, y, w, row_h, "N/A", ITALIC_FONT, 7)
            else:
                draw_centered_text(c, x, y, w, row_h, "N/A", ITALIC_FONT, 7)

        elif field == "description":
            c.setFont(BODY_FONT, BODY_TEXT_SIZE)
            lines = desc_lines if desc_lines else wrap_text(na(val), w - 2*CELL_PAD_X, BODY_FONT, BODY_TEXT_SIZE)
            top_y = y - CELL_PAD_Y - BODY_TEXT_SIZE
            for i, line in enumerate(lines):
                c.drawString(x + CELL_PAD_X, top_y - i * DESC_LINE_SPACING, line)
        else:
            raw = na(val)
            txt = raw if cast is None or raw == "N/A" else cast(raw)
            draw_centered_text(c, x, y, w, row_h, str(txt), BODY_FONT, BODY_TEXT_SIZE)

        x += w
    return y - row_h

def draw_signature_block(c):
    left = LEFT_MARGIN
    right = PAGE_W - RIGHT_MARGIN
    box_width = right - left
    sig_box_height = 80
    sig_box_bottom = BOTTOM_MARGIN
    sig_box_top = sig_box_bottom + sig_box_height

    c.setFillColor(colors.white)
    c.setStrokeColor(GRAY_BORDER)
    c.setLineWidth(0.5)
    c.rect(left, sig_box_bottom, box_width, sig_box_height, stroke=1, fill=0)
    c.setFillColor(TEXT_BLACK)
    c.setFont(BODY_FONT, BODY_TEXT_SIZE)

    half_width = box_width / 2.0
    heading_y = sig_box_top - 18
    signature_y = heading_y - 16
    bottom_row_y = signature_y - 18

    def draw_person_block(x0, heading_label):
        heading_x = x0 + 8
        c.drawString(heading_x, heading_y, heading_label)
        heading_w = stringWidth(heading_label, BODY_FONT, BODY_TEXT_SIZE)
        c.line(heading_x + heading_w + 6, heading_y + 1, x0 + half_width - 12, heading_y + 1)

        sig_label = "SIGNATURE:"
        sig_label_w = stringWidth(sig_label, BODY_FONT, BODY_TEXT_SIZE)
        sig_label_x = x0 + 8
        c.drawString(sig_label_x, signature_y, sig_label)
        c.line(sig_label_x + sig_label_w + 6, signature_y + 1, x0 + half_width - 12, signature_y + 1)

        date_label = "DATE:"
        grade_label = "GRADE:"
        date_label_x = x0 + 8
        date_label_w = stringWidth(date_label, BODY_FONT, BODY_TEXT_SIZE)
        c.drawString(date_label_x, bottom_row_y, date_label)
        c.line(date_label_x + date_label_w + 6, bottom_row_y + 1, date_label_x + date_label_w + 6 + 70, bottom_row_y + 1)

        grade_label_x = date_label_x + date_label_w + 6 + 70 + 20
        grade_label_w = stringWidth(grade_label, BODY_FONT, BODY_TEXT_SIZE)
        c.drawString(grade_label_x, bottom_row_y, grade_label)
        c.line(grade_label_x + grade_label_w + 6, bottom_row_y + 1, x0 + half_width - 12, bottom_row_y + 1)

    draw_person_block(left, "ISSUED BY:")
    draw_person_block(left + half_width, "RECEIVED BY:")

# ---------- Dynamo / S3 helpers + HTTP helpers ----------



def fetch_inventory_from_dynamo(team_id: str, overrides: dict | None = None) -> dict:
    """
    Build the data dict for render_inventory_pdf from DynamoDB rows.

    query all items for the team:
      PK = TEAM#<teamId>
      SK begins_with ITEM#


    """
    overrides = overrides or {}

    if not TABLE_NAME:
        raise RuntimeError("TABLE_NAME env var is not set")

    deserializer = TypeDeserializer()

    resp = ddb().query(
        TableName=TABLE_NAME,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": {"S": f"TEAM#{team_id}"},
            ":sk": {"S": "ITEM#"},
        },
    )

    raw_items = []
    for item in resp.get("Items", []):
        raw_items.append({k: deserializer.deserialize(v) for k, v in item.items()})

    # Optional: derive teamName if you want it in header (like getItems does)
    # Here we'll just leave it to overrides or N/A.

    rows = []
    for itm in raw_items:
        rows.append({
            "imageKey": None,  # or itm.get("imageLink") if you want to hook photos later

            # Use itemId or nsn as "material"
            "material": itm.get("material") or itm.get("nsn") or itm.get("itemId") or "",
            "lv":       itm.get("lv") or "",

            "description": (
                itm.get("description")
                or itm.get("actualName")
                or itm.get("name")
                or ""
            ),

            "arc":  itm.get("arc") or "",
            "ciic": itm.get("ciic") or "",
            "ui":   itm.get("ui") or "",
            "scmc": itm.get("scmc") or "",

            "authQty": itm.get("authQty")
                       or itm.get("authorizedQty")
                       or itm.get("auth_quantity")
                       or itm.get("quantity")
                       or 0,

            "ohQty": itm.get("ohQty")
                     or itm.get("onHandQty")
                     or itm.get("quantity")
                     or 0,
        })

    data = {
        "fe":        overrides.get("fe"),
        "uic":       overrides.get("uic"),
        "unitDesc":  overrides.get("unitDesc"),
        "serEquipNo": overrides.get("serEquipNo"),
        "to":        overrides.get("to"),
        "from":      overrides.get("from"),
        "sloc":      overrides.get("sloc"),
        "date":      overrides.get("date"),

        "endItem": {
            "niin": overrides.get("endItemNiin"),
            "lin":  overrides.get("endItemLin"),
            "desc": overrides.get("endItemDesc"),
        },

        "pub": {
            "num":        overrides.get("pubNum"),
            "date":       overrides.get("pubDate"),
            "bomUpdated": overrides.get("bomUpdated"),
        },

        "items": rows,
    }

    return data


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
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

# ---------- Render ----------
def render_inventory_pdf(d):
    buf = io.BytesIO()
    rows = d.get("items", []) or []

    probe = canvas.Canvas(io.BytesIO(), pagesize=letter)
    table_start_y = draw_top_header_box(probe, d, 1, 1)
    usable = table_start_y - BOTTOM_MARGIN - TABLE_HDR_H

    pages, i = [], 0
    while i < len(rows):
        h_used, page = 0, []
        while i < len(rows):
            h, _ = measure_row_height(rows[i])
            if h_used + h > usable and page:
                break
            page.append(i)
            h_used += h
            i += 1
        pages.append(page)
    if not pages:
        pages = [[]]

    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle("Component Listing / Hand Receipt")
    page_count = len(pages)

    for pnum, idxs in enumerate(pages, start=1):
        table_y_start = draw_top_header_box(c, d, pnum, page_count)
        y = draw_table_header(c, table_y_start)
        for idx in idxs:
            row = rows[idx] or {}
            row_h, desc = measure_row_height(row)
            y = draw_row(c, y, row, row_h, desc)
        if pnum == page_count:
            draw_signature_block(c)
        c.showPage()

    c.save()
    buf.seek(0)
    return buf.getvalue()

# ---------- Data I/O ----------
def ddb_get(pk, sk="LATEST"):
    resp = ddb().get_item(
        TableName=TABLE_NAME,
        Key={"PK": {"S": pk}, "SK": {"S": sk}},
        ConsistentRead=True
    )
    item = resp.get("Item")
    if not item:
        raise RuntimeError("DDB item not found")
    from boto3.dynamodb.types import TypeDeserializer
    return {k: TypeDeserializer().deserialize(v) for k, v in item.items()}

def s3_put_pdf(bucket, key, b):
    s3().put_object(Bucket=bucket, Key=key, Body=b, ContentType="application/pdf", ACL="private")

# ---------- Lambda HTTP ----------
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
}

def _get_http_method(event):
    try:
        m = event.get("requestContext", {}).get("http", {}).get("method")
        return m.upper() if m else ""
    except Exception:
        pass
    m = event.get("httpMethod")
    return m.upper() if isinstance(m, str) else ""

def _get_body_json(event):
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
    h = {"Cache-Control": "no-store", **CORS}
    if headers: h.update(headers)
    out = {"statusCode": status, "headers": h}
    if body is not None:
        out["body"] = body if isinstance(body, str) else json.dumps(body)
    if is_b64: out["isBase64Encoded"] = True
    return out

def lambda_handler(event, context):
    """
    POST body example (JSON):

    {
      "teamId": "g5xhg4tCemHQKcwC",
      "saveToS3": true,

      // optional header overrides:
      "fe": "FE-01",
      "uic": "W123AA",
      "unitDesc": "Alpha Company",
      "serEquipNo": "AEQ-99",
      "to": "Alpha Co",
      "from": "Bravo Co",
      "sloc": "BAY-7",
      "date": "2025-11-12",
      "endItemNiin": "013456789",
      "endItemLin": "L-5544",
      "endItemDesc": "Suspension Assembly",
      "pubNum": "TM 9-2320-280-20",
      "pubDate": "2024-05-01",
      "bomUpdated": "2025-10-20"
    }
    """
    method = _get_http_method(event)

    if method == "OPTIONS":
        return _resp(200, "")

    if method == "GET":
        return _resp(200, {
            "ok": True,
            "service": "inventory-pdf",
            "ddbConfigured": bool(TABLE_NAME),
            "uploadsBucket": bool(UPLOADS_BUCKET),
        })

    if method != "POST":
        return _resp(405, {"error": "Method not allowed. Use POST."})

    payload = _get_body_json(event)
    if not isinstance(payload, dict):
        return _resp(400, {"error": "Invalid JSON body"})

    team_id    = (payload.get("teamId") or "").strip()
    save_to_s3 = bool(payload.get("saveToS3", True))

    if not team_id:
        return _resp(400, {"error": "teamId is required"})

    # Fetch data from Dynamo based only on teamId
    try:
        data = fetch_inventory_from_dynamo(team_id, overrides=payload)
    except Exception as e:
        return _resp(500, {"error": f"DDB fetch failed: {e}"})

    # Build PDF
    try:
        pdf_bytes = render_inventory_pdf(data)
    except Exception as e:
        return _resp(500, {"error": f"PDF build failed: {e}"})

    # File name: one inventory PDF per team
    filename = "inventory.pdf"
    key = f"Documents/{team_id}/inventory/{filename}"

    if save_to_s3:
        if not UPLOADS_BUCKET:
            return _resp(500, {"error": "UPLOADS_BUCKET env var is not set"})
        try:
            s3().put_object(
                Bucket=UPLOADS_BUCKET,
                Key=key,
                Body=pdf_bytes,
                ContentType="application/pdf",
                ACL="private",
            )
        except Exception as e:
            return _resp(500, {"error": f"S3 put failed: {e}"})

        return _resp(200, {
            "ok": True,
            "s3Key": key,
            "bucket": UPLOADS_BUCKET,
            "contentType": "application/pdf",
        })

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



