import { useState } from "react";
import { checkDrugInteractionsData } from "../services/api";
import BackButton from "../components/common/BackButton";
import DrugCheckerForm from "../components/Forms/DrugCheckerForm";

export default function DrugChecker({ showToast }) {
  const [drugInput, setDrugInput] = useState("");
  const [drugs, setDrugs] = useState([]);
  const [drugImage, setDrugImage] = useState(null);
  const [allergies, setAllergies] = useState("");
  const [reportFile, setReportFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const check = async () => {
    if (drugs.length === 0 && !drugImage) { showToast("Please add at least one medicine.", "error"); return; }
    setLoading(true);
    try {
      const data = await checkDrugInteractionsData(drugs, allergies, drugImage, reportFile);
      if (data.status === "reupload_image") {
        showToast("Image blurry or medicine name not clear. Please reupload once again.", "error");
        setResult(null);
      } else {
        setResult(data);
        if (drugImage && data.extracted_drugs && data.extracted_drugs.length > 0) {
          showToast(`Extracted: ${data.extracted_drugs.join(", ")}`, "success");
        } else {
          showToast("Check complete!", "success");
        }
      }
    } catch { 
      showToast("Check failed.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const severityColor = { moderate: "#f97316", serious: "#ef4444", low: "#22c55e" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <BackButton />
      <div className="fade-up" style={{ marginBottom: 36 }}>
        <div className="section-label">Pharmacology AI</div>
        <h2 style={{ fontSize: 36, color: "#0d1f2d" }}>Drug Interaction Checker</h2>
        <p style={{ color: "#4a6274", marginTop: 8 }}>Identify interactions and side effects before combining medications.</p>
      </div>

      <DrugCheckerForm 
        drugInput={drugInput} setDrugInput={setDrugInput}
        drugs={drugs} setDrugs={setDrugs}
        drugImage={drugImage} setDrugImage={setDrugImage}
        allergies={allergies} setAllergies={setAllergies}
        reportFile={reportFile} setReportFile={setReportFile}
      />

      <button className="btn-primary" style={{ marginTop: 28, width: "100%", fontSize: 16, padding: "15px" }} onClick={check} disabled={loading}>
        {loading ? <><span className="spinner" style={{ marginRight: 10 }} />Checking Interactions…</> : "💊 Check Interactions"}
      </button>

      {result && (
        <div className="slide-in" style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Level Flags */}
          {result.safety_level === "Fatal" && (
            <div style={{ background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 16, padding: 20 }}>
              <div style={{ fontWeight: 800, color: "#b91c1c", marginBottom: 6, fontSize: 18 }}>🚨 FATAL DANGER</div>
              {result.fatal_warning && <p style={{ fontSize: 16, color: "#ef4444", lineHeight: 1.7, fontWeight: 700, marginBottom: 12 }}>{result.fatal_warning}</p>}
            </div>
          )}

          {result.safety_level === "Serious" && (
            <div style={{ background: "#fff7ed", border: "2px solid #fdba74", borderRadius: 16, padding: 20 }}>
              <div style={{ fontWeight: 800, color: "#c2410c", marginBottom: 6, fontSize: 18 }}>⚠️ SERIOUS WARNING</div>
              <p style={{ fontSize: 16, color: "#c2410c", lineHeight: 1.7, fontWeight: 600 }}>These medications have serious interactions.</p>
            </div>
          )}

          {result.safety_level === "Safe" && (
            <div style={{ background: "#ecfdf5", border: "2px solid #10b981", borderRadius: 16, padding: 20 }}>
              <div style={{ fontWeight: 800, color: "#047857", marginBottom: 6, fontSize: 18 }}>✅ Safe to take</div>
              <p style={{ fontSize: 16, color: "#047857", lineHeight: 1.7, fontWeight: 600 }}>No severe or fatal interactions found.</p>
            </div>
          )}

          {/* Block 1: Detailed Reason */}
          {result.detailed_reason && result.safety_level !== "Safe" && (
            <div style={{ background: "#fff", border: `1.5px solid ${result.safety_level === "Fatal" ? "#fca5a5" : "#fdba74"}`, borderRadius: 16, padding: 20 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Interaction Reasoning</div>
              <div style={{ fontSize: 15, color: "#1e293b", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: result.detailed_reason }} />
            </div>
          )}

          {/* Block 2 & 3: Medicine Purpose and Side Effects */}
          {result.medicine_explanations && result.medicine_explanations.length > 0 && (
            <>
              {/* Block 2: What each medicine is used for */}
              <div style={{ background: "#f0f7f7", border: "1.5px solid #c8e6e6", borderRadius: 16, padding: 20 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Medicine Usage</div>
                {result.medicine_explanations.map((med, idx) => (
                  <div key={`purpose-${idx}`} style={{ padding: "10px 0", borderBottom: idx !== result.medicine_explanations.length - 1 ? "1px solid #e2ecec" : "none" }}>
                    <div style={{ fontWeight: 700, color: "#0d1f2d", fontSize: 15, marginBottom: 8 }}>{med.medicine}</div>
                    <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: med.purpose }} />
                  </div>
                ))}
              </div>

              {/* Block 3: Common Side Effects */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Expected Side Effects</div>
                {result.medicine_explanations.map((med, idx) => (
                  <div key={`side-${idx}`} style={{ padding: "10px 0", borderBottom: idx !== result.medicine_explanations.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                    <div style={{ fontWeight: 700, color: "#0d1f2d", fontSize: 15, marginBottom: 8 }}>{med.medicine}</div>
                    <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: med.side_effects }} />
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}