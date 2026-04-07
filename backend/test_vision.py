import os
import io
import base64
import requests
from dotenv import load_dotenv
from PIL import Image

load_dotenv(dotenv_path='c:\\Users\\Dell\\Desktop\\medAI4\\backend\\.env')
api_key = os.getenv('GROQ_API_KEY')

def get_image_base64():
    # Make a dummy image
    img = Image.new('RGB', (100, 30), color = (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')

img_b64 = get_image_base64()

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
payload = {
    "model": "llama-3.2-11b-vision-preview",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract all the text from this image exactly as written. If there is no text, reply strictly with 'NO_TEXT' and nothing else."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
            ]
        }
    ],
    "temperature": 0.1,
    "max_tokens": 512
}

print("Testing Groq Vision API...")
response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
print(response.status_code)
if response.status_code == 200:
    print(response.json()['choices'][0]['message']['content'])
else:
    print(response.text)
