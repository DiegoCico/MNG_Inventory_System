import json, os, base64
from index import main  # your handler

# ensure env var is set if not coming from shell
os.environ.setdefault("TEMPLATE_PATH", "src/api/src/templates/2404-template.pdf")

with open("event.json", "r", encoding="utf-8") as f:
    event = json.load(f)

resp = main(event, None)
print("status:", resp["statusCode"])

# write out the PDF like API Gateway would deliver it
body = resp["body"]
if resp.get("isBase64Encoded"):
    pdf_bytes = base64.b64decode(body)
else:
    # some setups might return raw bytes; handle both
    pdf_bytes = body.encode("utf-8")
with open("DA2404_test.pdf", "wb") as f:
    f.write(pdf_bytes)

print("wrote DA2404_test.pdf")
