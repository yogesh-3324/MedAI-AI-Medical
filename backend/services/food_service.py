import logging
import json
import base64
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MedAI, an elite clinical nutritionist and food safety specialist. 
Your goal is to evaluate if a user's food or meal is safe for them to consume based on their medical background. 

If given an image, visually analyze it alongside their text description to deduce the ingredients. Include hidden ingredients typically found in such meals (e.g. sugar in sauces, butter in pastries).

CRITICAL CLINICAL REASONING RULES (MUST FOLLOW):
1. NET GLYCEMIC LOAD MATTERS: Do NOT blindly penalize foods just for having "carbohydrates". You MUST evaluate Fiber and Protein. For example, Dal/Lentils contain carbs but have a low glycemic index, high fiber, and high protein, making them highly recommended and SAFE for Diabetes. 
2. Combined effect of foods MUST be evaluated. If multiple harmful components exist → escalate risk level.
3. If meal can cause SUDDEN spikes (e.g., refined sugar, white bread, honey) → mark as "Not Safe".
4. Allergy presence → ALWAYS "Not Safe". Rating MUST be 0.
5. VARY YOUR RATINGS. Do not just output 4.2. Output precise decimals based on exact calculations (e.g. 3.8, 6.7, 8.1).
6. INPUT VALIDATION: If the Meal Description, Image Description, Disease, or Allergy is clearly nonsensical, abstract, an inanimate object (e.g. "Shoes", "Car", "Chair"), or unrelated to food/health, you MUST return VERDICT "Invalid" with rating 0.

CLASSIFICATION LOGIC:
- "Safe" → No significant risk. Net glycemic impact is minimal or healthy.
- "Slightly Unsafe" → Moderate risk, portion dependent (e.g. white rice mixed with veggies).
- "Not Safe" → High or immediate risk (allergens, pure sugar in diabetes, etc).
- "Invalid" → The input is abstract, inedible, or nonsensical.

IMPORTANT: Use clinical precision. Recognize healthy complex carbs vs refined carbs.

Output format: You MUST return your answer as a valid, strictly formatted JSON object exactly as specified below, and NOTHING else.

JSON Structure:
{
  "verdict": "Safe" | "Slightly Unsafe" | "Not Safe" | "Invalid",
  "rating": float,   // A diverse safety rating out of 10.
  "reason": "MUST BE FORMATTED IN MARKDOWN. First two lines MUST be bullet points: 1) '🍲 **Food/meal**: [Name]' 2) '🦠 **Disease**: [Name]'. Then use bullet points, emojis, and **bold** text to explain the medical reasoning (glycemic load, fiber, etc).",
  "risks": "MUST BE FORMATTED IN MARKDOWN. Use bullet points, emojis, and **bold** text to list physiological negative effects.",
  "alternatives": "MUST BE FORMATTED IN MARKDOWN. Use bullet points, emojis, and **bold** text to provide actionable alternatives or changes to make it safe.",
  "nutrition": {
    "carbs": int,      // Percentage of carbs in this meal
    "protein": int,    // Percentage of protein in this meal
    "fats": int        // Percentage of fats in this meal
  }
}

The sum of carbs, protein, and fats MUST equal 100.
"""

def _guess_mime_type(file_bytes: bytes) -> str:
    # A simple magic number check for common image types
    if file_bytes.startswith(b'\xff\xd8'): return 'image/jpeg'
    if file_bytes.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if file_bytes.startswith(b'GIF87a') or file_bytes.startswith(b'GIF89a'): return 'image/gif'
    if file_bytes.startswith(b'RIFF') and file_bytes[8:12] == b'WEBP': return 'image/webp'
    return 'image/jpeg'  # fallback

def check_food_safety(food_text: str, disease: str, symptoms: str, allergies: str, report_text: str = "", file_bytes: bytes = None) -> dict:
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)

    # Build context string
    context_builder = []
    if food_text: context_builder.append(f"- Meal Description: {food_text}")
    if disease: context_builder.append(f"- Existing Disease(s): {disease}")
    if symptoms: context_builder.append(f"- Symptoms: {symptoms}")
    if allergies: context_builder.append(f"- Allergies: {allergies}")
    if report_text: context_builder.append(f"- Medical Report Details: {report_text}")
    
    text_prompt = "Evaluate the safety of this meal based on the following details:\n" + "\n".join(context_builder)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    _blip_pipeline = None

    def load_blip_captioner():
        nonlocal _blip_pipeline
        if _blip_pipeline is None:
            logger.info("Initializing HuggingFace BLIP pipeline for food image captioning...")
            from transformers import pipeline
            _blip_pipeline = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")
            logger.info("BLIP pipeline correctly initialized.")
        return _blip_pipeline

    # Process image if provided using Local HuggingFace Transformers
    if file_bytes:
        logger.info("Image detected. Processing via HuggingFace locally.")
        import io
        from PIL import Image
        try:
            pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            captioner = load_blip_captioner()
            caption_result = captioner(pil_img)
            image_description = caption_result[0]["generated_text"]
            logger.info(f"Local Image Description: {image_description}")
            context_builder.append(f"- Extracted Image Action/Description: {image_description}")
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            context_builder.append("- Image uploaded but it could not be read properly.")
            
    text_prompt = "Evaluate the safety of this meal based on the following details:\n" + "\n".join(context_builder)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text_prompt}
    ]
    
    logger.info("Text + Image data combined. Using premium 70B payload.")
    # Upgrade to 70B for clinical reasoning
    model = "llama-3.3-70b-versatile"

    try:
        completion = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.4,
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
        logger.exception("Error calling Groq for food safety analysis")
        raise e
