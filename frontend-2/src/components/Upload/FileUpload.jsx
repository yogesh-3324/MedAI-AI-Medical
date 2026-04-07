import { useRef } from "react";

export default function FileUpload({ file, setFile, label = "📎 Attach report (optional)", style }) {
  const fileRef = useRef(null);
  
  return (
    <>
      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
      <div className="upload-zone" style={{ padding: "18px 24px", ...style }} onClick={() => fileRef.current.click()}>
        {file ? <span style={{ color: "#0a6e6e", fontWeight: 500 }}>✓ {file.name}</span> : <span style={{ color: "#9bb3b3" }}>{label}</span>}
      </div>
    </>
  );
}