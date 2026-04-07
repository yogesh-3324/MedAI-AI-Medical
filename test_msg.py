import requests

body = {"message": "summarize me the document in simple words"}
# Not passing session_id to test general query, or we can see if it fails regardless
response = requests.post('http://localhost:8000/api/chat/message', json=body)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
