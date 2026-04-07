import FileUpload from "../Upload/FileUpload";

export default function DietForm({ form, setForm, file, setFile }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {[
        ["disease", "Existing Disease", "e.g. Type 2 Diabetes, Hypertension"], 
        ["symptoms", "Symptoms (if disease unknown)", "e.g. fatigue, bloating, joint pain"], 
        ["allergies", "Allergies", "e.g. peanuts, gluten, dairy"]
      ].map(([k, label, placeholder]) => (
        <div key={k} className="fade-up-1">
          <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>{label}</label>
          <input className="input-field" placeholder={placeholder} value={form[k]} onChange={e => set(k, e.target.value)} />
        </div>
      ))}
      <div className="fade-up-2">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Upload Reports <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(optional)</span></label>
        <FileUpload file={file} setFile={setFile} label="📎 Attach report (optional)" style={{ padding: "18px 24px" }} />
      </div>
    </div>
  );
}