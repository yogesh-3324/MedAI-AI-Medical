/**
 * src/services/api.jsx
 *
 * All calls to the FastAPI backend.
 * Base URL reads from Vite env — set VITE_API_URL in .env, defaults to localhost:8000.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── MedAI Chat (RAG) ─────────────────────────────────────────────────────────

/**
 * Upload a document to the backend RAG pipeline.
 * Returns { session_id, filename, file_type, num_chunks, message }
 *
 * @param {File} file
 * @returns {Promise<{session_id: string, message: string}>}
 */
export const uploadChatDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/chat/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }

  return res.json();
};

/**
 * Send a chat message and receive a RAG-powered answer.
 *
 * @param {string}      message    - User's query text
 * @param {string|null} sessionId  - From uploadChatDocument(); null = general Q&A
 * @returns {Promise<{answer: string, used_rag: boolean}>}
 */
export const analyzeChatMsg = async (message, sessionId = null) => {
  const body = { message };
  if (sessionId) body.session_id = sessionId;

  const res = await fetch(`${BASE_URL}/api/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }

  const data = await res.json();
  return data.answer; // keep same return shape as the mock so Chat.jsx works unchanged
};

// ─── Other feature stubs (kept as-is — replace with real endpoints as needed) ─

export const analyzeXrayImage = async (file) => {
  await new Promise(r => setTimeout(r, 2200));
  return {
    findings: [
      "No significant pneumonia or pleural effusion detected.",
      "Mild cardiomegaly noted — cardiac silhouette slightly enlarged.",
      "No evidence of active pulmonary tuberculosis.",
      "Both lung fields appear clear with normal vascular markings.",
    ],
    impression: "Mild cardiomegaly. No acute cardiopulmonary disease. Recommend clinical correlation.",
    confidence: 87,
  };
};

export const assessMedicalUrgency = async () => {
  await new Promise(r => setTimeout(r, 2000));
  const levels = ["emergency", "urgent", "safe"];
  return levels[Math.floor(Math.random() * 3)];
};

export const generateDietPlan = async () => {
  await new Promise(r => setTimeout(r, 2000));
  return {
    eat: ["Leafy greens (spinach, kale, methi)", "Whole grains (oats, brown rice, quinoa)", "Lean protein (chicken, lentils, tofu)", "Low-glycemic fruits (berries, apple, pear)", "Nuts and seeds in moderation", "Greek yogurt and low-fat dairy"],
    avoid: ["Refined sugars and sweets", "White bread and processed carbs", "Fried and fatty foods", "Sugary beverages and alcohol", "High-sodium packaged snacks"],
    tips: "Aim for 3 balanced meals with 2 small snacks. Drink at least 8 glasses of water daily. Consult a registered dietitian for a fully personalized plan.",
  };
};

export const checkFoodSafetyData = async () => {
  await new Promise(r => setTimeout(r, 1800));
  const safe = Math.random() > 0.4;
  return {
    safe,
    reason: safe
      ? "This food is generally safe for your condition. It has low glycemic index and does not interfere with your medication or allergies."
      : "This food may not be safe for your condition. It contains high sugar content and may worsen your condition. Consult your doctor before consuming.",
  };
};

export const checkDrugInteractionsData = async () => {
  await new Promise(r => setTimeout(r, 2000));
  return {
    interactions: [
      { pair: "Aspirin + Ibuprofen", severity: "moderate", desc: "Both are NSAIDs — taking together increases risk of gastrointestinal bleeding and reduces effectiveness." },
      { pair: "Metformin + Alcohol", severity: "serious", desc: "Combining can increase the risk of lactic acidosis. Avoid alcohol while on Metformin." },
    ],
    sideEffects: ["Nausea and upset stomach (common)", "Dizziness or lightheadedness", "Headache", "Increased bleeding time (serious — monitor)"],
    warning: "Seek immediate medical attention if you experience severe stomach pain, black stools, or difficulty breathing.",
  };
};
