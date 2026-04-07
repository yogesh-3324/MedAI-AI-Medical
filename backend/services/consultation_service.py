import logging
from groq import Groq
from config import settings

logger = logging.getLogger(__name__)

REPORT_PROMPT_TEMPLATE = """You are an advanced clinical AI assistant designed to convert doctor–patient conversation transcripts into structured, professional medical reports.

Your task is to analyze the provided transcript deeply and generate a clear, medically accurate, and well-structured consultation report.

IMPORTANT RULES:
- Do NOT hallucinate or invent information.
- Only extract what is explicitly stated or strongly implied.
- If something is unclear or missing, mark it as "Not specified".
- Maintain clinical tone and professionalism.
- Avoid unnecessary repetition.
- Use concise but informative language.

INPUT:
You will receive a raw conversation transcript between a doctor and a patient. The transcript may contain noise (uh, um, pauses), partial sentences, and informal language. Clean and interpret it properly.

OUTPUT FORMAT — Generate the report in EXACTLY this structured format with these section headers:

Patient Information:
Name: (if mentioned, else "Not specified")
Age: (if mentioned, else "Not specified")
Gender: (if mentioned, else "Not specified")
Date of Consultation: (if not given, use "Not specified")

Chief Complaint:
Main reason for visit (in 1–2 lines)

History of Present Illness (HPI):
Detailed summary of symptoms, onset, duration, severity, progression, any triggers or relieving factors.

Past Medical History:
Previous diseases, surgeries, conditions (if mentioned, else "Not specified")

Symptoms Extracted:
- List all symptoms clearly as bullet points

Clinical Observations (Doctor Notes):
Any observations made by the doctor during the consultation.

Diagnosis (if mentioned):
Only include if explicitly stated in the transcript. Otherwise write "Not specified — further evaluation required."

Treatment / Prescription:
Medicines prescribed (with dosage if mentioned), therapies or interventions. If none mentioned: "Not specified."

Doctor's Advice & Recommendations:
- Lifestyle changes
- Precautions
- Follow-up instructions

Important Highlights:
- Key takeaway 1
- Key takeaway 2
- Key takeaway 3
(3–5 bullet points maximum)

Follow-up Plan:
Next visit timing or conditions for return visit.

SPECIAL INSTRUCTIONS:
- Convert informal speech into formal medical language.
- Resolve pronouns properly (e.g., "it hurts" → specify body part if context exists).
- Group scattered information logically.
- If multiple symptoms are mentioned at different times, combine them.
- No emojis. No extra explanations outside the report structure.

TRANSCRIPT:
{transcript}
"""


def generate_consultation_report(transcript: str) -> str:
    """
    Takes a raw doctor-patient conversation transcript and returns
    a structured clinical consultation report as a plain-text string.
    """
    if not transcript or not transcript.strip():
        raise ValueError("Transcript cannot be empty.")

    client = Groq(api_key=settings.GROQ_API_KEY)
    prompt = REPORT_PROMPT_TEMPLATE.format(transcript=transcript.strip())

    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional medical report writer. "
                        "Generate clean, structured, hospital-grade consultation reports. "
                        "Never add information not found in the transcript. "
                        "Never use emojis or casual language."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.15,
            max_tokens=2500
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Consultation report generation failed: {e}")
        raise
