import io
import requests
from PIL import Image

# Create a test image with simple text or just upload a basic payload
img = Image.new('RGB', (200, 50), color = (255, 255, 255))
# For a pure blank image, OCR space might return blanks.
buf = io.BytesIO()
img.save(buf, format='JPEG')
file_bytes = buf.getvalue()

payload = {'isOverlayRequired': False, 'apikey': 'helloworld', 'language': 'eng'}
response = requests.post(
    'https://api.ocr.space/parse/image',
    files={'filename': ('image.jpg', file_bytes, 'image/jpeg')},
    data=payload
)
print("OCR Space Response:", response.status_code)
print(response.json())
