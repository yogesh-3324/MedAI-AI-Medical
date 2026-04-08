import { useRef } from "react";

// ── File type helpers ─────────────────────────────────────────────────────────
function getFileTypeLabel(filename) {
  if (!filename) return "FILE";
  const ext = filename.split(".").pop().toUpperCase();
  return ext || "FILE";
}

function getFileIconColor(filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  const colors = {
    pdf:  { bg: "#ef4444", icon: "#fff" },
    png:  { bg: "#8b5cf6", icon: "#fff" },
    jpg:  { bg: "#8b5cf6", icon: "#fff" },
    jpeg: { bg: "#8b5cf6", icon: "#fff" },
    webp: { bg: "#8b5cf6", icon: "#fff" },
    bmp:  { bg: "#8b5cf6", icon: "#fff" },
    tiff: { bg: "#8b5cf6", icon: "#fff" },
    txt:  { bg: "#3b82f6", icon: "#fff" },
  };
  return colors[ext] || { bg: "#6b7280", icon: "#fff" };
}

// ── PDF Icon SVG ──────────────────────────────────────────────────────────────
function FileIconSvg({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ── Image Icon SVG ─────────────────────────────────────────────────────────────
function ImageIconSvg({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ── Spinning Loader ───────────────────────────────────────────────────────────
function UploadSpinner() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" />
    </svg>
  );
}

// ── Check Icon ────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── File Preview Card ─────────────────────────────────────────────────────────
function FilePreviewCard({ fileName, uploadStatus, onDismiss }) {
  const typeLabel = getFileTypeLabel(fileName);
  const { bg, icon } = getFileIconColor(fileName);
  const isImage = /\.(png|jpg|jpeg|webp|bmp|tiff)$/i.test(fileName || "");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: "#1e2936",
        border: "1.5px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: "10px 14px",
        marginBottom: 8,
        minWidth: 0,
        maxWidth: 300,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        animation: "fadeUp 0.25s ease both",
        position: "relative",
      }}
    >
      {/* Colored file type icon with spinner overlay */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {uploadStatus === "uploading" ? (
          <UploadSpinner />
        ) : uploadStatus === "done" ? (
          <>
            {isImage ? <ImageIconSvg color={icon} /> : <FileIconSvg color={icon} />}
            {/* Done badge */}
            <div style={{
              position: "absolute", bottom: -4, right: -4,
              width: 16, height: 16, borderRadius: "50%",
              background: "#22c55e",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #1e2936",
            }}>
              <CheckIcon />
            </div>
          </>
        ) : uploadStatus === "error" ? (
          <div style={{ color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        ) : (
          isImage ? <ImageIconSvg color={icon} /> : <FileIconSvg color={icon} />
        )}
      </div>

      {/* File name + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: uploadStatus === "error" ? "#fca5a5" : "#f1f5f9",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {fileName}
        </div>
        <div style={{
          fontSize: 11.5,
          color: uploadStatus === "error" ? "#f87171" : "#94a3b8",
          marginTop: 2,
          fontWeight: 500,
        }}>
          {uploadStatus === "uploading" ? "Uploading…" : uploadStatus === "done" ? "Uploaded ✓" : uploadStatus === "error" ? "Upload failed" : typeLabel}
        </div>
      </div>


      {/* Dismiss X (only when not actively uploading) */}
      {uploadStatus !== "uploading" && (
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#94a3b8"; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main ChatInput Component ──────────────────────────────────────────────────
export default function ChatInput({
  input, setInput, send, loading,
  showUpload, setShowUpload, handleUpload,
  stagedFile, uploadStatus, onDismissStagedFile,
}) {
  const fileRef = useRef(null);

  return (
    <>
      {/* File preview card — shown while uploading or just after done */}
      {stagedFile && (
        <FilePreviewCard
          fileName={stagedFile}
          uploadStatus={uploadStatus}
          onDismiss={onDismissStagedFile}
        />
      )}

      {/* Upload type picker dropdown */}
      {showUpload && (
        <div style={{
          background: "#fff",
          border: "1.5px solid #e2ecec",
          borderRadius: 14,
          padding: 8,
          marginBottom: 8,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          boxShadow: "0 8px 24px rgba(0,0,0,.1)",
        }}>
          {[
            { label: "📄 Upload PDF", accept: ".pdf,.txt" },
            { label: "🖼️ Upload Image", accept: "image/*" },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => { fileRef.current.accept = opt.accept; fileRef.current.click(); setShowUpload(false); }}
              style={{
                padding: "10px 16px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", fontSize: 14,
                borderRadius: 10, fontFamily: "'DM Sans',sans-serif",
                color: "#0d1f2d", fontWeight: 500,
              }}
              onMouseEnter={e => e.target.style.background = "#f0f7f7"}
              onMouseLeave={e => e.target.style.background = "none"}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center",
        background: "#f0f7f7", borderRadius: 16,
        padding: "10px 12px", border: "1.5px solid #e2ecec",
      }}>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} />

        {/* + button */}
        <button
          onClick={() => setShowUpload(s => !s)}
          disabled={uploadStatus === "uploading"}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: showUpload ? "#0a6e6e" : "#fff",
            border: "1.5px solid #e2ecec", cursor: "pointer",
            fontSize: 20, display: "flex", alignItems: "center",
            justifyContent: "center", transition: "all .2s",
            color: showUpload ? "#fff" : "#4a6274", flexShrink: 0,
            opacity: uploadStatus === "uploading" ? 0.5 : 1,
          }}
        >
          +
        </button>

        <input
          className="input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type your health question…"
          style={{ flex: 1, border: "none", background: "transparent", padding: "8px 4px" }}
        />

        <button
          onClick={send}
          disabled={loading || (!input.trim() && uploadStatus !== "done")}
          className="btn-primary"
          style={{
            padding: "10px 18px", borderRadius: 12, fontSize: 14,
            opacity: (loading || (!input.trim() && uploadStatus !== "done")) ? 0.5 : 1
          }}
        >
          {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "Send"}
        </button>

      </div>
    </>
  );
}