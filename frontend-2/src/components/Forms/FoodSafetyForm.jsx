import FileUpload from "../Upload/FileUpload";
import ImageUpload from "../Upload/ImageUpload";
import AutocompleteInput from "./AutocompleteInput";

export default function FoodSafetyForm({ 
  foodText, setFoodText, foodImage, setFoodImage, 
  form, setForm, file, setFile 
}) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="fade-up-1" style={{ position: "relative", zIndex: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>
          Food <span style={{ color: "#ef4444" }}>*</span> <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(text or image — at least one required)</span>
        </label>
        <AutocompleteInput className="input-field" placeholder="e.g. Biryani, Pizza, Dal Makhani…" value={foodText} onChange={e => setFoodText(e.target.value)} style={{ marginBottom: 10 }} fieldType="meal description" />
        <ImageUpload file={foodImage} setFile={setFoodImage} label="📸 Or upload food image" style={{ padding: "16px 24px" }} />
      </div>

      {[
        ["disease", "Existing Disease", "e.g. Diabetes, GERD…"], 
        ["symptoms", "Symptoms (if unknown)", "e.g. acidity, bloating"], 
        ["allergies", "Allergies", "e.g. nuts, gluten"]
      ].map(([k, label, ph], index) => (
        <div key={k} className="fade-up-2" style={{ position: "relative", zIndex: 10 - index }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>{label}</label>
          <AutocompleteInput className="input-field" placeholder={ph} value={form[k]} onChange={e => set(k, e.target.value)} fieldType={label.toLowerCase()} />
        </div>
      ))}

      <div className="fade-up-2">
        <label style={{ fontSize: 14, fontWeight: 600, color: "#0d1f2d", display: "block", marginBottom: 8 }}>
          Upload Reports <span style={{ color: "#9bb3b3", fontWeight: 400 }}>(optional)</span>
        </label>
        <FileUpload file={file} setFile={setFile} label="📎 Attach medical report" style={{ padding: "16px 24px" }} />
      </div>
    </div>
  );
}