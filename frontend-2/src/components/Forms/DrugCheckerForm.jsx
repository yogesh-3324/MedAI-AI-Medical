import { useState } from "react";
import FileUpload from "../Upload/FileUpload";
import ImageUpload from "../Upload/ImageUpload";
import AutocompleteInput from "./AutocompleteInput";

export default function DrugCheckerForm({ 
  drugInput, setDrugInput, drugs, setDrugs, 
  drugImage, setDrugImage, allergies, setAllergies, 
  reportFile, setReportFile 
}) {
  const [doseInput, setDoseInput] = useState("");
  
  const addDrug = () => {
    const d = drugInput.trim();
    const dose = doseInput.trim();
    if (!d) return;
    if (!dose) {
      alert("Please provide the dose (e.g., 500mg) for the medicine.");
      return;
    }
    const combined = `${d} ${dose}`;
    if (!drugs.includes(combined)) setDrugs(p => [...p, combined]);
    setDrugInput("");
    setDoseInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="fade-up-1" style={{ position: "relative", zIndex: 30 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Medicines & Dose <span style={{ color: "#ef4444" }}>*</span></label>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}>
            <AutocompleteInput 
              className="input-field" 
              placeholder="Medicine name" 
              value={drugInput} 
              onChange={e => setDrugInput(e.target.value)} 
              fieldType="medicine or drug name"
            />
          </div>
          <input className="input-field" placeholder="Dose (Mg)" value={doseInput} onChange={e => setDoseInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addDrug()} style={{ flex: 1 }} />
          <button className="btn-outline" onClick={addDrug} style={{ flexShrink: 0, padding: "12px 20px" }}>Add</button>
        </div>
        {drugs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {drugs.map(d => (
              <span key={d} className="tag" style={{ cursor: "pointer" }} onClick={() => setDrugs(p => p.filter(x => x !== d))}>
                💊 {d} <span style={{ color: "#ef4444" }}>×</span>
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <ImageUpload file={drugImage} setFile={setDrugImage} label="📸 Or upload medicine image" style={{ padding: "16px 24px" }} />
        </div>
      </div>

      <div className="fade-up-2" style={{ position: "relative", zIndex: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Allergies <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(optional)</span></label>
        <AutocompleteInput 
          className="input-field" 
          placeholder="e.g. Penicillin, Sulfa drugs…" 
          value={allergies} 
          onChange={e => setAllergies(e.target.value)} 
          fieldType="allergies"
        />
      </div>

      <div className="fade-up-2" style={{ position: "relative", zIndex: 10 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Upload Reports <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(optional)</span></label>
        <FileUpload file={reportFile} setFile={setReportFile} label="📎 Attach prescription/report" style={{ padding: "16px 24px" }} />
      </div>
    </div>
  );
}