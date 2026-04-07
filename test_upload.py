import requests

response = requests.get('http://localhost:8000/health')
print(f"Health: {response.status_code}")

files = {'file': ('test.txt', b'This is a test medical document with some cholesterol information.')}
upload_response = requests.post('http://localhost:8000/api/chat/upload', files=files)
print(f"Upload Status Code: {upload_response.status_code}")
print(f"Upload Response: {upload_response.text}")
