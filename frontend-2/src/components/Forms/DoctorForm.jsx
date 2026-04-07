import FileUpload from "../Upload/FileUpload";

export default function DoctorForm({ form, setForm, file, setFile }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="fade-up-1">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Symptoms <span style={{ color: "#ef4444" }}>*</span></label>
        <textarea className="input-field" rows={3} placeholder="Describe your symptoms…" value={form.symptoms} onChange={e => set("symptoms", e.target.value)} style={{ resize: "vertical" }} />
      </div>
      <div className="fade-up-1">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Duration</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {[["years", "Years"], ["months", "Months"], ["days", "Days"], ["hours", "Hours"], ["minutes", "Mins"]].map(([k, label]) => (
            <div key={k}>
              <input className="input-field" type="number" min="0" placeholder="0" value={form[k]} onChange={e => set(k, e.target.value)} style={{ textAlign: "center" }} />
              <div style={{ fontSize: 12, color: "#9bb3b3", textAlign: "center", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="fade-up-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Age <span style={{ color: "#ef4444" }}>*</span></label>
          <input className="input-field" type="number" min="0" max="120" placeholder="Age in years" value={form.age} onChange={e => set("age", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Gender <span style={{ color: "#ef4444" }}>*</span></label>
          <select className="select-field" value={form.gender} onChange={e => set("gender", e.target.value)}>
            <option value="">Select gender</option>
            <option>Male</option><option>Female</option><option>Others</option>
          </select>
        </div>
      </div>
      <div className="fade-up-2">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Existing Diseases</label>
        <input className="input-field" placeholder="e.g. Diabetes, Hypertension, or None" value={form.diseases} onChange={e => set("diseases", e.target.value)} />
      </div>
      <div className="fade-up-3">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>Upload Medical Reports <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(optional)</span></label>
        <FileUpload file={file} setFile={setFile} label="📎 Click to attach report (PDF/Image)" style={{ padding: "20px 24px" }} />
      </div>
    </div>
  );
}