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
      <div className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-ai"}`}>
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
    </div>
  );
}