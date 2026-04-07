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
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/xray/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `X-Ray analysis failed (${res.status})`);
  }

  return res.json();
};
export const chatWithXray = async (file, message, history) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("message", message);
  formData.append("history", JSON.stringify(history || []));

  const res = await fetch(`${BASE_URL}/api/xray/chat`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat failed (${res.status})`);
  }

  return res.json();
};

export const analyzeXrayRisk = async (data) => {
  const res = await fetch(`${BASE_URL}/api/xray/risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Risk analysis failed");
  return res.json();
};

export const assessMedicalUrgency = async (form, file) => {
  const formData = new FormData();
  formData.append("symptoms", form.symptoms);
  const dur = `${form.years || 0} years ${form.months || 0} months ${form.days || 0} days ${form.hours || 0} hours ${form.minutes || 0} mins`;
  formData.append("duration", dur);
  formData.append("age", form.age);
  formData.append("gender", form.gender);
  formData.append("diseases", form.diseases || "");
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(`${BASE_URL}/api/triage/assess`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Urgency check failed (${res.status})`);
  }

  return res.json();
};

export const fetchNearbyHospitals = async (lat, lng) => {
  try {
    const res = await fetch(`${BASE_URL}/api/triage/hospitals?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      return data.hospitals || [];
    }
  } catch (err) {
    console.error("Failed to fetch hospitals:", err);
  }
  return [];
};

export const generateDietPlan = async (form, file) => {
  const formData = new FormData();
  formData.append("disease", form.disease || "");
  formData.append("symptoms", form.symptoms || "");
  formData.append("allergies", form.allergies || "None");
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(`${BASE_URL}/api/diet/generate`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Diet generation failed (${res.status})`);
  }

  return res.json();
};

export const checkFoodSafetyData = async (foodText, foodImage, form, file) => {
  const formData = new FormData();
  formData.append("food_text", foodText || "");
  formData.append("disease", form.disease || "");
  formData.append("symptoms", form.symptoms || "");
  formData.append("allergies", form.allergies || "None");
  
  if (foodImage) {
    formData.append("food_image", foodImage);
  }
  if (file) {
    formData.append("med_report", file);
  }

  const res = await fetch(`${BASE_URL}/api/food/safety`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Food safety check failed (${res.status})`);
  }

  return res.json();
};

export const checkDrugInteractionsData = async (drugs, allergies, drugImage, reportFile) => {
  const formData = new FormData();
  formData.append("drugs", JSON.stringify(drugs || []));
  formData.append("allergies", allergies || "None");
  
  if (drugImage) {
    formData.append("drug_image", drugImage);
  }
  if (reportFile) {
    formData.append("med_report", reportFile);
  }

  const res = await fetch(`${BASE_URL}/api/drug/interactions`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Drug interactions check failed (${res.status})`);
  }

  return res.json();
};
