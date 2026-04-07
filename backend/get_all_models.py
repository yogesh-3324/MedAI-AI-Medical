import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='c:\\Users\\Dell\\Desktop\\medAI4\\backend\\.env')
api_key = os.getenv('GROQ_API_KEY')
response = requests.get(
    'https://api.groq.com/openai/v1/models',
    headers={'Authorization': f'Bearer {api_key}'}
)
with open('c:\\Users\\Dell\\Desktop\\medAI4\\backend\\all_models.txt', 'w', encoding='utf-8') as f:
    for m in response.json().get('data', []):
        f.write(m['id'] + '\n')
