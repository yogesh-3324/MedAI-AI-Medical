import { useRef } from "react";

export default function ImageUpload({ file, setFile, label = "📸 Or upload image", style, preview, accept="image/*" }) {
  const fileRef = useRef(null);

  const handleDrag = (e) => { e.preventDefault(); };
  const handleDrop = (e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]); };

  // Reset input value BEFORE opening so onChange always fires,
  // even when the user picks the same file again.
  const handleClick = () => {
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }}
      />
      <div
        className="upload-zone"
        style={style}
        onClick={handleClick}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="Preview" style={{ maxHeight: 280, maxWidth: "100%", borderRadius: 12, objectFit: "contain" }} />
        ) : file ? (
          <span style={{ color: "#0a6e6e", fontWeight: 500 }}>🖼️ {file.name}</span>
        ) : (
          <span style={{ color: "#9bb3b3" }}>{label}</span>
        )}
      </div>
    </>
  );
}