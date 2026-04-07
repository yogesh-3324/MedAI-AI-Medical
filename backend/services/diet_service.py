import logging
import json
from config import settings

logger = logging.getLogger(__name__)

DISEASE_RULES = {
    "diabetes": {
        "avoid": ["sugar", "refined carbs", "high GI fruits", "sweetened beverages", "white bread"],
        "prefer": ["low GI foods", "high fiber", "protein", "leafy greens", "whole grains"],
        "carb_limit": True
    },
    "joint_pain": {
        "avoid": ["processed food", "sugar", "red meat", "fried foods"],
        "prefer": ["anti-inflammatory foods", "omega-3", "turmeric", "berries", "fatty fish"]
    },
    "arthritis": {
        "avoid": ["processed food", "sugar", "red meat", "fried foods", "nightshades"],
        "prefer": ["anti-inflammatory foods", "omega-3", "turmeric", "berries", "fatty fish"]
    },
    "hypertension": {
        "avoid": ["salt", "sodium", "processed meat", "canned soups", "pickles"],
        "prefer": ["potassium-rich foods", "bananas", "leafy greens", "DASH diet guidelines", "lean protein"]
    },
    "blood pressure": {
        "avoid": ["salt", "sodium", "processed meat", "canned soups", "pickles"],
        "prefer": ["potassium-rich foods", "bananas", "leafy greens", "DASH diet guidelines", "lean protein"]
    },
    "fatigue": {
        "avoid": ["sugar crashes", "caffeine late", "processed carbs"],
        "prefer": ["iron-rich foods", "complex carbs", "B-vitamins", "hydration"]
    },
    "heart disease": {
         "avoid": ["saturated fats", "trans fats", "excess sodium", "red meat"],
         "prefer": ["omega-3s", "whole grains", "fiber", "nuts", "olive oil"]
    }
}

SYSTEM_PROMPT = """You are MedAI, an expert clinical nutritionist and dietary consultant.
Your role is to create personalized, highly accurate, and scientifically backed diet plans based on the user's health condition, symptoms, allergies, and occasionally medical reports.

Output format: You MUST return your answer as a valid, strictly formatted JSON object, exactly as specified below, and NOTHING else. Do not output any markdown code blocks, do not explain. ONLY valid JSON.

JSON Structure:
{
  "summary": {
    "disease": "Short summary of the user's primary condition or symptoms",
    "goal": "The primary objective of this diet",
    "calories": "Suggested daily caloric intake range",
    "tags": ["Array of 3-4 descriptive tags (e.g., 'Low Spice', 'Low GI', 'High Protein')"]
  },
  "meal_plan": {
    "breakfast": ["List of 2-3 specific foods/meals for breakfast"],
    "lunch": ["List of 2-3 specific foods/meals for lunch"],
    "dinner": ["List of 2-3 specific foods/meals for dinner"],
    "snacks": ["List of 1-2 specific snacks"]
  },
  "foods_to_avoid": ["List of foods the user MUST rigidly avoid. CAREFULLY factor in the provided allergies and diseases."],
  "recommended_foods": ["List of highly beneficial foods suited for their condition."],
  "nutrition": {
    "carbs": "integer representing percentage of daily calories from carbohydrates (e.g., 40)",
    "protein": "integer representing percentage of daily calories from protein (e.g., 30)",
    "fats": "integer representing percentage of daily calories from fats (e.g., 30)"
  }
}

The sum of carbs, protein, and fats MUST equal 100.
Do NOT hallucinate. You MUST STRICTLY obey the critical constraints given in the user prompt.
"""

def filter_allergens(food_list: list, allergies_list: list) -> list:
    """Removes any food string that mentions an allergen keyword."""
    filtered_list = []
    for food_item in food_list:
        food_item_lower = food_item.lower()
        if not any(allergen in food_item_lower for allergen in allergies_list):
            filtered_list.append(food_item)
    return filtered_list

def generate_diet_plan(disease: str, symptoms: str, allergies: str, report_text: str = "") -> dict:
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)

    user_message = "Please create a personalized diet plan based on the following details:\n"
    if disease: user_message += f"- Existing Disease(s): {disease}\n"
    if symptoms: user_message += f"- Symptoms: {symptoms}\n"
    if allergies: user_message += f"- Allergies: {allergies}\n"
    if report_text: user_message += f"- Medical Report Details: {report_text}\n"

    disease_lower = disease.lower() if disease else ""
    symptoms_lower = symptoms.lower() if symptoms else ""
    
    strict_avoids = []
    strict_prefers = []
    carb_limit = False

    for key, rules in DISEASE_RULES.items():
        if key in disease_lower or key in symptoms_lower:
            strict_avoids.extend(rules.get("avoid", []))
            strict_prefers.extend(rules.get("prefer", []))
            if rules.get("carb_limit"):
                carb_limit = True

    if strict_avoids or strict_prefers or (allergies and allergies.lower() != "none"):
        user_message += "\nCRITICAL STRICT CONSTRAINTS (MUST OVERRIDE EVERYTHING ELSE):\n"
        if allergies and allergies.lower() != "none" and allergies.strip() != "":
            user_message += f"- ALLERGIES (FATAL): You MUST NOT include ANY foods containing: {allergies}.\n"
        
        if strict_avoids:
            avoids_str = ", ".join(list(set(strict_avoids)))
            user_message += f"- rigidly AVOID these foods due to their condition: {avoids_str}.\n"
            
        if strict_prefers:
            prefers_str = ", ".join(list(set(strict_prefers)))
            user_message += f"- highly PREFER incorporating these foods: {prefers_str}.\n"
            
        if carb_limit:
            user_message += "- STRICT CARB LIMIT REQUIRED. Macronutrient carbs MUST be appropriately low (e.g. <= 30%).\n"

    logger.info("Sending strict diet generation request to Groq (%s).", settings.GROQ_MODEL)

    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=2048,
            top_p=0.9,
        )

        response_text = completion.choices[0].message.content
        
        try:
            diet_data = json.loads(response_text)
            
            # Post-processing Allergy Filter (CRITICAL override)
            if allergies and allergies.lower() != "none" and allergies.strip() != "":
                allergy_keywords = [a.strip().lower() for a in allergies.split(",") if a.strip()]
                
                if "meal_plan" in diet_data:
                    for meal_type in ["breakfast", "lunch", "dinner", "snacks"]:
                        if meal_type in diet_data["meal_plan"]:
                            diet_data["meal_plan"][meal_type] = filter_allergens(
                                diet_data["meal_plan"][meal_type], allergy_keywords
                            )
                
                if "recommended_foods" in diet_data:
                    diet_data["recommended_foods"] = filter_allergens(
                        diet_data["recommended_foods"], allergy_keywords
                    )

            return diet_data
            
        except json.JSONDecodeError as decode_err:
            logger.error(f"Failed to parse Groq JSON output: {decode_err}\nRaw text: {response_text}")
            raise Exception("Invalid JSON structure returned by the AI.")
            
    except Exception as e:
        logger.exception("Error calling Groq for diet generation")
        raise e
