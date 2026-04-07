import logging
import json
import base64
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MedAI, an elite clinical pharmacologist and drug safety specialist.
Your goal is to evaluate potential drug-drug interactions, side effects, and life-threatening contraindications based on the user's provided medications, medical reports, and allergies.

If given an image, visually analyze it to read the names and dosages of the medicines shown. If the image is too blurry, unrecognizable, or does not clearly show medicine names, you must trigger a reupload.

CRITICAL PHARMACOLOGY RULES (MUST FOLLOW):
1. ACCURACY IS PARAMOUNT: This is a medical assistant. Do not hallucinate side effects or interactions. Rely strictly on established pharmacological facts.
2. CHECK ALLERGY: If an allergy is matched with any of the drugs consumed, this is a FATAL warning.
3. FATAL CONTRAINDICATIONS: If the interaction between drugs can cause death, severe toxicity, or life-threatening conditions (e.g., severe serotonin syndrome, fatal bleeding), you MUST output a highly visible fatal warning. The phrasing must dynamically match the number of interacting drugs. For example, if two drugs are involved, write exactly "Don't Consume These Two: Aspirin, Warfarin". If three drugs are involved, write exactly "Don't Consume These Three: Aspirin, Warfarin, Ibuprofen". Do not use "two or more" as a blanket statement.
4. BLURRY IMAGES: If an image is provided but medicine names cannot be clearly seen, set `status` to "reupload_image" and do NOT hallucinate drug names.

Output format: You MUST return your answer as a valid, strictly formatted JSON object exactly as specified below, and NOTHING else.

JSON Structure:
{
  "status": "success" | "reupload_image",
  "message": "If status is reupload_image, write 'reupload once again' here. Otherwise, empty.",
  "safety_level": "Fatal" | "Serious" | "Safe", // "Fatal" if lethal interaction. "Serious" if severe interactions. "Safe" if perfectly fine.
  "extracted_drugs": ["Medicine A 500mg"], // If read from image or provided in text
  "fatal_warning": "Don't Consume These Two: Medicine A, Medicine B", // ONLY if safety_level is Fatal. Phrased exactly like this matching the count. Otherwise null.
  "detailed_reason": "A highly detailed combined medical reason why the interaction is Fatal or Serious. USE HTML <b> TAGS to make important keywords and lines bold! If it is Safe, leave this empty string.",
  "medicine_explanations": [
    {
      "medicine": "Medicine A",
      "purpose": "A brief explanation of what this medicine does and its mechanism. USE HTML <b> tags for important keywords.",
      "side_effects": "List of common side effects specifically for this medicine after consumption. USE HTML <b> tags for important keywords."
    }
  ]
}
"""

def _guess_mime_type(file_bytes: bytes) -> str:
    if file_bytes.startswith(b'\xff\xd8'): return 'image/jpeg'
    if file_bytes.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if file_bytes.startswith(b'GIF87a') or file_bytes.startswith(b'GIF89a'): return 'image/gif'
    if file_bytes.startswith(b'RIFF') and file_bytes[8:12] == b'WEBP': return 'image/webp'
    return 'image/jpeg'

def check_drug_safety(drugs: list, allergies: str, report_text: str = "", file_bytes: bytes = None) -> dict:
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)

    # Build context string
    context_builder = []
    if drugs: context_builder.append(f"- User Provided Medicines: {', '.join(drugs)}")
    if allergies and allergies.lower() != "none" and allergies.strip(): context_builder.append(f"- Allergies: {allergies}")
    if report_text: context_builder.append(f"- Medical Report Context: {report_text}")
    
    text_prompt = "Evaluate the drug interactions based on the following details:\n" + "\n".join(context_builder)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    if file_bytes:
        logger.info("Image detected for drug check. Using multi-modal high-tier payload.")
        base64_image = base64.b64encode(file_bytes).decode('utf-8')
        mime_type = _guess_mime_type(file_bytes)
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": text_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_image}"
                    }
                }
            ]
        })
        model = "llama-3.2-90b-vision-preview" 
    else:
        logger.info("Text-only data for drug check. Using premium 70B payload.")
        messages.append({
            "role": "user",
            "content": text_prompt
        })
        model = "llama-3.3-70b-versatile"

    try:
        completion = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.1,  # Strict temperature for high accuracy and no hallucinations
            max_tokens=2048,
            top_p=0.9,
        )

        response_text = completion.choices[0].message.content
        
        try:
            safety_data = json.loads(response_text)
            return safety_data
        except json.JSONDecodeError as decode_err:
            logger.error(f"Failed to parse Groq JSON output: {decode_err}\nRaw text: {response_text}")
            raise Exception("Invalid JSON structure returned by the AI.")
            
    except Exception as e:
        logger.exception("Error calling Groq for drug safety analysis")
        raise e
