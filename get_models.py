import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='c:\\Users\\Dell\\Desktop\\medAI4\\backend\\.env')
api_key = os.getenv('GROQ_API_KEY')
response = requests.get(
    'https://api.groq.com/openai/v1/models',
    headers={'Authorization': f'Bearer {api_key}'}
)
print([m['id'] for m in response.json()['data']])
