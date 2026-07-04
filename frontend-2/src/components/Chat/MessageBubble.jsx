import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ msg }) {
  // Helper to prevent indented Markdown from rendering as <pre> code blocks
  const cleanMd = (str) => {
    if (!str) return "";
    return str.split('\n').map(line => line.trimStart()).join('\n');
  };

  return (
    <div className="slide-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
      {msg.role === "ai" && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", maxWidth: msg.role === "user" ? "75%" : "80%" }}>
        <div className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-ai"}`} style={{ maxWidth: "100%" }}>
          {msg.role === "ai" ? (
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p style={{margin: "0 0 8px 0", lineHeight: "1.5"}} {...props} />,
                ul: ({node, ...props}) => <ul style={{margin: "0 0 8px 0", paddingLeft: "24px"}} {...props} />,
                ol: ({node, ...props}) => <ol style={{margin: "0 0 8px 0", paddingLeft: "24px"}} {...props} />,
                li: ({node, ...props}) => <li style={{marginBottom: "4px", lineHeight: "1.5"}} {...props} />,
                h1: ({node, ...props}) => <h1 style={{margin: "12px 0 8px 0", fontSize: "1.25em", color: "#0a6e6e"}} {...props} />,
                h2: ({node, ...props}) => <h2 style={{margin: "12px 0 8px 0", fontSize: "1.15em", color: "#0a6e6e"}} {...props} />,
                h3: ({node, ...props}) => <h3 style={{margin: "10px 0 6px 0", fontSize: "1.05em", color: "#0d1f2d"}} {...props} />,
                strong: ({node, ...props}) => <strong style={{color: "#0a6e6e", fontWeight: 600}} {...props} />
              }}
            >
              {cleanMd(msg.text)}
            </ReactMarkdown>
          ) : (
            msg.text
          )}
        </div>

        {/* ── Enhanced Web Search Sources Section ────────────────────────────── */}
        {msg.role === "ai" && msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 12, paddingLeft: 2, animation: "fadeIn 0.4s ease" }}>
            {/* Sources Header with Counter */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              background: "linear-gradient(135deg, rgba(10,110,110,0.06) 0%, rgba(13,138,138,0.03) 100%)",
              border: "1px solid rgba(10,110,110,0.15)",
              borderRadius: 16,
              padding: "4px 12px",
              backdropFilter: "blur(4px)",
            }}>
              {/* Globe Icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a6e6e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span style={{ fontSize: 11, color: "#0a6e6e", fontWeight: 700, letterSpacing: 0.4 }}>
                📚 SOURCES ({msg.sources.length})
              </span>
            </div>

            {/* Source Cards Grid */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 6,
              "@media (max-width: 600px)": {
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              }
            }}>
              {msg.sources.map((src, i) => {
                // Extract domain from URL for display
                let domain = "Source";
                try {
                  const url = new URL(src.url);
                  domain = url.hostname.replace('www.', '').split('.')[0];
                  domain = domain.charAt(0).toUpperCase() + domain.slice(1);
                } catch {}

                return (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${src.title}\n\n${src.url}`}
                    className="source-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "8px 10px",
                      background: "#f0f9ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 10,
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      overflow: "hidden",
                      position: "relative",
                      groupHover: { transform: "translateY(-2px)" },
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "#dbeafe";
                      e.currentTarget.style.borderColor = "#7dd3fc";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.15)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "#f0f9ff";
                      e.currentTarget.style.borderColor = "#bfdbfe";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Source Number Badge */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#0369a1",
                        background: "rgba(59,130,246,0.1)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        minWidth: "22px",
                        textAlign: "center",
                      }}>
                        [{i+1}]
                      </span>
                      {/* External Link Icon */}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#0f172a",
                      lineHeight: "1.3",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {src.title || "Untitled"}
                    </div>

                    {/* Domain */}
                    <div style={{
                      fontSize: 9,
                      color: "#0369a1",
                      fontWeight: 500,
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      🌐 {domain}
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Sources Info Text */}
            <div style={{
              marginTop: 6,
              fontSize: 9,
              color: "#64748b",
              fontStyle: "italic",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Click any source to visit website for detailed reference
            </div>
          </div>
        )}
      </div>
    </div>
  );
}