import { useState } from "react";
import { assessMedicalUrgency, fetchNearbyHospitals } from "../services/api";
import BackButton from "../components/common/BackButton";
import DoctorForm from "../components/Forms/DoctorForm";

export default function DoctorCheck({ showToast }) {
  const [form, setForm] = useState({ symptoms: "", years: "", months: "", days: "", hours: "", minutes: "", age: "", gender: "", diseases: "" });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  const check = async () => {
    if (!form.symptoms || !form.age || !form.gender) { showToast("Please fill in required fields.", "error"); return; }
    setLoading(true);
    setHospitals([]);
    try {
      const data = await assessMedicalUrgency(form, file);
      setResult(data);
      showToast("Analysis complete!", "success");
      
      if (data.risk_level && data.risk_level.toLowerCase() === "emergency") {
        if ("geolocation" in navigator) {
            setHospitalsLoading(true);
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                 const lat = pos.coords.latitude;
                 const lng = pos.coords.longitude;
                 const hData = await fetchNearbyHospitals(lat, lng);
                 setHospitals(hData);
                 setHospitalsLoading(false);
              },
              (err) => {
                 console.warn("Geolocation denied or failed", err);
                 setHospitalsLoading(false);
              }
            );
        }
      }
    } catch (e) {
      showToast(e.message || "Analysis failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resultConfig = {
    emergency: { color: "result-emergency", icon: "🔴", label: "Emergency", msg: "Immediately consult a doctor", sub: "Your symptoms suggest a potentially serious condition requiring urgent medical attention." },
    urgent: { color: "result-urgent", icon: "🟠", label: "Urgent", msg: "Consult a doctor soon", sub: "Your symptoms require prompt medical evaluation. Please schedule an appointment as soon as possible." },
    safe: { color: "result-safe", icon: "🟢", label: "Safe", msg: "Home remedies / precautions recommended", sub: "Your symptoms appear manageable at home. Rest, stay hydrated, and monitor your condition." },
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <BackButton />
      <div className="fade-up" style={{ marginBottom: 36 }}>
        <div className="section-label">Risk Assessment</div>
        <h2 style={{ fontSize: 36, color: "#0d1f2d" }}>Do I Need A Doctor?</h2>
        <p style={{ color: "#4a6274", marginTop: 8 }}>Describe your symptoms and we'll assess your medical urgency.</p>
      </div>

      <DoctorForm form={form} setForm={setForm} file={file} setFile={setFile} />

      <button className="btn-primary fade-up-3" style={{ marginTop: 28, width: "100%", fontSize: 16, padding: "15px" }} onClick={check} disabled={loading}>
        {loading ? <><span className="spinner" style={{ marginRight: 10 }} />Analyzing Urgency…</> : "🔍 Check Urgency"}
      </button>

      {result && result.risk_level && (
        <div className={`slide-in result-card ${resultConfig[result.risk_level.toLowerCase()]?.color}`} style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 32 }}>{resultConfig[result.risk_level.toLowerCase()]?.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontFamily: "'DM Serif Display',serif", fontWeight: 700 }}>{resultConfig[result.risk_level.toLowerCase()]?.label}</div>
            </div>
          </div>
          
          <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.6)", borderRadius: 12, marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#0d1f2d", fontSize: 16 }}>Summary</h4>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#4a6274" }}>{result.summary}</p>
          </div>

          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#2d3748" }}>{result.explanation}</p>
          
          {result.possible_conditions && result.possible_conditions.length > 0 && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(255,255,255,0.4)", borderRadius: 8, borderLeft: "4px solid #f59e0b" }}>
              <strong style={{ display: "block", marginBottom: 6, color: "#d97706", fontSize: 14 }}>Possible Conditions Investigated:</strong>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#92400e", lineHeight: 1.5 }}>
                {result.possible_conditions.map((cond, i) => <li key={i}>{cond}</li>)}
              </ul>
            </div>
          )}
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
             <div style={{ background: "rgba(255,255,255,0.5)", padding: 16, borderRadius: 12 }}>
                <strong style={{ display: "block", marginBottom: 8, color: "#0d1f2d" }}>Recommended Actions</strong>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#4a6274", lineHeight: 1.6 }}>
                  {result.actions?.map((act, i) => <li key={i} style={{ marginBottom: 4 }}>{act}</li>)}
                </ul>
             </div>
             <div style={{ background: "rgba(255,255,255,0.5)", padding: 16, borderRadius: 12 }}>
                <strong style={{ display: "block", marginBottom: 8, color: "#0d1f2d" }}>Extra Guidance</strong>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#4a6274", lineHeight: 1.6 }}>
                  {result.extra_guidance?.map((guid, i) => <li key={i} style={{ marginBottom: 4 }}>{guid}</li>)}
                </ul>
             </div>
          </div>

          {result.risk_level.toLowerCase() === "emergency" && (
            <div style={{ marginTop: 24, padding: 18, background: "rgba(255,255,255,.8)", borderRadius: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 16, color: "#e11d48", display: "flex", alignItems: "center", gap: 8 }}><span>🏥</span> Emergency Resources</div>
              
              <div style={{ marginBottom: 16 }}>
                {[["Ambulance", "102"], ["Police", "100"]].map(([name, num]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 8, fontSize: 15 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{name} ({num})</span>
                    <a href={`tel:${num}`} style={{ textDecoration: "none", background: "#ef4444", color: "#fff", padding: "4px 12px", borderRadius: 6, fontWeight: "bold", fontSize: 13 }}>📞 Call</a>
                  </div>
                ))}
              </div>

              {hospitalsLoading ? (
                <div style={{ padding: "12px 0", fontSize: 14, color: "#64748b", fontStyle: "italic" }}>⏳ Requesting location to find nearby hospitals...</div>
              ) : hospitals.length > 0 ? (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#0d1f2d" }}>Nearest Hospitals:</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {hospitals.map((h, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", maxWidth: "65%" }}>{h.name}</div>
                        {h.phone ? (
                          <a href={`tel:${h.phone}`} style={{ padding: "6px 16px", background: "#2563eb", color: "#fff", textDecoration: "none", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>📞 Call</a>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", paddingRight: 8 }}>No Phone</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <a 
                     href="https://www.google.com/maps/search/hospitals+near+me" 
                     target="_blank" 
                     rel="noreferrer"
                     className="btn-primary"
                     style={{ display: "block", padding: "12px 16px", borderRadius: 8, fontSize: 15, textDecoration: "none", width: "100%", textAlign: "center", background: "#ef4444", border: "none" }}
                  >
                     📍 Find Nearest Hospitals on Maps
                  </a>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: 12, color: "#6b7280", fontStyle: "italic", textAlign: "center", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 16 }}>
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}