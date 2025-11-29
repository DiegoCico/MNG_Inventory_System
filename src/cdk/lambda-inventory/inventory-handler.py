import os, io, json, base64, csv, sys
import boto3
from boto3.dynamodb.types import TypeDeserializer
from collections import defaultdict, deque

UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "").strip()
TABLE_NAME = os.environ.get("TABLE_NAME", "").strip()

_s3 = None
_ddb = None

def s3():
    global _s3
    if _s3 is None:
        from botocore.config import Config
        _s3 = boto3.client("s3", config=Config(signature_version='s3v4'))
    return _s3

def ddb():
    global _ddb
    if _ddb is None:
        _ddb = boto3.client("dynamodb")
    return _ddb

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET"
}

def _get_http_method(event):
    try:
        m = event.get("requestContext", {}).get("http", {}).get("method")
        return m.upper() if m else ""
    except:
        pass
    m = event.get("httpMethod")
    return m.upper() if isinstance(m, str) else ""

def _get_body_json(event):
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except:
            pass
    try:
        return json.loads(body)
    except:
        return {}

def _resp(status, body=None, headers=None, is_b64=False):
    h = {"Cache-Control": "no-store", **CORS}
    if headers:
        h.update(headers)
    out = {"statusCode": status, "headers": h}
    if body is not None:
        out["body"] = body if isinstance(body, str) else json.dumps(body)
    if is_b64:
        out["isBase64Encoded"] = True
    return out

ITEM_ID_KEY = "itemId"
PARENT_KEY = "parent"
END_NIIN_KEY = "endItemNiin"
END_LIN_KEY = "liin"
END_DESC_KEY = "endItemDesc"

def fetch_inventory_from_dynamo(team_id, overrides):
    if not TABLE_NAME:
        raise RuntimeError("TABLE_NAME env var is not set")

    deserializer = TypeDeserializer()

    resp = ddb().query(
        TableName=TABLE_NAME,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": {"S": f"TEAM#{team_id}"},
            ":sk": {"S": "ITEM#"}
        }
    )

    items = []
    for item in resp.get("Items", []):
        items.append({k: deserializer.deserialize(v) for k, v in item.items()})
    
    filtered_items = []
    for itm in items:
        status = (itm.get("status") or "").lower()
        if status in ["completed", "complete", "missing", "shortages"]:
            filtered_items.append(itm)

    meta_resp = ddb().get_item(
        TableName=TABLE_NAME,
        Key={
            "PK": {"S": f"TEAM#{team_id}"},
            "SK": {"S": "METADATA"},
        },
        ConsistentRead=True,
    )

    meta = {}
    if meta_resp.get("Item"):
        meta = {k: deserializer.deserialize(v) for k, v in meta_resp["Item"].items()}

    merged_overrides = {
        "fe": meta.get("fe"),
        "uic": meta.get("uic"),
        "teamName": meta.get("description") or meta.get("name"),
    }

    if isinstance(overrides, dict):
        merged_overrides.update(overrides)

    return {"items": filtered_items, "overrides": merged_overrides}




def _compute_lv_for_group(items_for_kit):
    id_to_item = {}
    children = defaultdict(list)

    for itm in items_for_kit:
        iid = itm.get(ITEM_ID_KEY)
        if iid:
            id_to_item[iid] = itm

    roots = []
    for itm in items_for_kit:
        iid = itm.get(ITEM_ID_KEY)
        parent = itm.get(PARENT_KEY)
        if not iid:
            continue
        if parent and parent in id_to_item:
            children[parent].append(itm)
        else:
            roots.append(itm)

    lv_by_id = {}
    for root in roots:
        rid = root.get(ITEM_ID_KEY)
        if not rid:
            continue
        q = deque()
        q.append((root, 0))
        while q:
            node, depth = q.popleft()
            nid = node.get(ITEM_ID_KEY)
            if not nid:
                continue
            lv_by_id[nid] = chr(ord("A") + depth) if depth < 26 else "Z+"
            for c in children.get(nid, []):
                q.append((c, depth + 1))

    return lv_by_id, roots, children

def render_inventory_csv(data):
    items = data.get("items", [])
    overrides = data.get("overrides", {})

    groups = defaultdict(list)
    for itm in items:
        key = (itm.get(END_NIIN_KEY), itm.get(END_LIN_KEY))
        groups[key].append(itm)

    buf = io.StringIO()
    writer = csv.writer(buf)

    first = True
    for (end_niin, end_lin), kit_items in groups.items():
        if not first:
            writer.writerow([])
        first = False

        end_desc = None
        for itm in kit_items:
            d = itm.get(END_DESC_KEY)
            if d:
                end_desc = d
                break
        if not end_desc:
            end_desc = overrides.get("endItemDesc") or ""

        writer.writerow(["FE", "UIC", "Desc", "End Item NIIN", "LIN", "Desc"])
        writer.writerow([
            overrides.get("fe") or "",
            overrides.get("uic") or "",
            overrides.get("teamName") or "",
            end_niin or "",
            end_lin or "",
            end_desc or ""
        ])

        writer.writerow([])

        writer.writerow(["Name", "LV", "Description", "Auth Qty", "OH Qty"])

        lv_by_id, roots, children = _compute_lv_for_group(kit_items)

        def walk(node, depth):
            nid = node.get(ITEM_ID_KEY)
            lv = lv_by_id.get(nid) or chr(ord("A") + depth)

            name = node.get("name") or ""
            desc = node.get("description") or ""
            auth_qty = node.get("authQuantity") or 0
            oh_qty = node.get("ohQuantity") if node.get("ohQuantity") is not None else auth_qty

            writer.writerow([name, lv, desc, auth_qty, oh_qty])

            kids = sorted(children.get(nid, []), key=lambda x: (x.get("name") or ""))
            for c in kids:
                walk(c, depth + 1)

        roots_sorted = sorted(roots, key=lambda x: (x.get("name") or ""))
        for r in roots_sorted:
            walk(r, 0)

    out = buf.getvalue()
    buf.close()
    return out.encode("utf-8")

def lambda_handler(event, context):
    method = _get_http_method(event)

    # Allow direct Lambda invocation (no httpMethod field)
    if not method:
        # Direct invocation from another Lambda - treat as POST
        pass
    elif method == "OPTIONS":
        return _resp(200, "")
    elif method == "GET":
        return _resp(200, {
            "ok": True,
            "service": "inventory-csv",
            "ddbConfigured": bool(TABLE_NAME),
            "uploadsBucket": bool(UPLOADS_BUCKET)
        })
    elif method != "POST":
        return _resp(405, {"error": "Method not allowed"})

    payload = _get_body_json(event)
    if not isinstance(payload, dict):
        return _resp(400, {"error": "Invalid JSON"})

    team_id = payload.get("teamId") or ""
    if not team_id:
        return _resp(400, {"error": "teamId is required"})

    save_to_s3 = bool(payload.get("saveToS3", True))

    try:
        data = fetch_inventory_from_dynamo(team_id, payload)
    except Exception as e:
        return _resp(500, {"error": f"DDB fetch failed: {e}"})

    try:
        csv_bytes = render_inventory_csv(data)
    except Exception as e:
        return _resp(500, {"error": f"CSV build failed: {e}"})

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"inventory_{timestamp}.csv"
    key = f"Documents/{team_id}/inventory/{filename}"

    if save_to_s3:
        if not UPLOADS_BUCKET:
            return _resp(500, {"error": "UPLOADS_BUCKET env var is not set"})
        try:
            # Get KMS key ARN from environment (set by CDK)
            kms_key_arn = os.environ.get('KMS_KEY_ARN', '').strip()
            
            put_params = {
                'Bucket': UPLOADS_BUCKET,
                'Key': key,
                'Body': csv_bytes,
                'ContentType': 'text/csv',
            }
            
            # Add KMS encryption if key is provided
            if kms_key_arn:
                put_params['ServerSideEncryption'] = 'aws:kms'
                put_params['SSEKMSKeyId'] = kms_key_arn
            
            s3().put_object(**put_params)
            
            # Generate presigned URL for download (valid for 1 hour)
            url = s3().generate_presigned_url(
                'get_object',
                Params={'Bucket': UPLOADS_BUCKET, 'Key': key},
                ExpiresIn=3600
            )
            
            return _resp(200, {
                "ok": True,
                "s3Key": key,
                "bucket": UPLOADS_BUCKET,
                "url": url,
                "contentType": "text/csv"
            })
        except Exception as e:
            return _resp(500, {"error": f"S3 put failed: {e}"})

    b64 = base64.b64encode(csv_bytes).decode("utf-8")
    return _resp(
        200,
        b64,
        headers={
            "Content-Type": "text/csv",
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
        is_b64=True
    )

    main = lambda_handler

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
      
        sys.stderr.write("teamId argument is required\n")
        sys.exit(1)

    team_id = sys.argv[1].strip()
    if not team_id:
        sys.stderr.write("teamId argument is empty\n")
        sys.exit(1)

    try:
       
        data = fetch_inventory_from_dynamo(team_id, {})
        csv_bytes = render_inventory_csv(data)
        
        sys.stdout.write(csv_bytes.decode("utf-8"))
    except Exception as e:
       
        sys.stderr.write(f"inventory export failed: {e}\n")
        sys.exit(1)