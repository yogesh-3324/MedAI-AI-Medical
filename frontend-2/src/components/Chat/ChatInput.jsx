import { useRef } from "react";

export default function ChatInput({ input, setInput, send, loading, showUpload, setShowUpload, handleUpload }) {
  const fileRef = useRef(null);

  return (
    <>
      {showUpload && (
        <div style={{ background: "#fff", border: "1.5px solid #e2ecec", borderRadius: 14, padding: 8, marginBottom: 8, display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 8px 24px rgba(0,0,0,.1)" }}>
          {[{ label: "📄 Upload PDF", accept: ".pdf" }, { label: "🖼️ Upload Image", accept: "image/*" }].map(opt => (
            <button key={opt.label} onClick={() => { fileRef.current.accept = opt.accept; fileRef.current.click(); }}
              style={{ padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, borderRadius: 10, fontFamily: "'DM Sans',sans-serif", color: "#0d1f2d", fontWeight: 500 }}
              onMouseEnter={e => e.target.style.background = "#f0f7f7"}
              onMouseLeave={e => e.target.style.background = "none"}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f0f7f7", borderRadius: 16, padding: "10px 12px", border: "1.5px solid #e2ecec" }}>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
        <button onClick={() => setShowUpload(s => !s)}
          style={{ width: 38, height: 38, borderRadius: 10, background: showUpload ? "#0a6e6e" : "#fff", border: "1.5px solid #e2ecec", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", color: showUpload ? "#fff" : "#4a6274", flexShrink: 0 }}>
          +
        </button>
        <input className="input-field" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type your health question…"
          style={{ flex: 1, border: "none", background: "transparent", padding: "8px 4px" }} />
        <button onClick={send} disabled={loading || !input.trim()} className="btn-primary"
          style={{ padding: "10px 18px", borderRadius: 12, fontSize: 14, opacity: (loading || !input.trim()) ? .5 : 1 }}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "Send"}
        </button>
      </div>
    </>
  );
}