import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='c:\\Users\\Dell\\Desktop\\medAI4\\backend\\.env')
api_key = os.getenv('GROQ_API_KEY')
response = requests.get(
    'https://api.groq.com/openai/v1/models',
    headers={'Authorization': f'Bearer {api_key}'}
)
models = [m['id'] for m in response.json().get('data', []) if 'llama' in m['id'].lower() or 'mixtral' in m['id'].lower()]
for m in models:
    print(m)
