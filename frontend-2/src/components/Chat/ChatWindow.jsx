import MessageBubble from "./MessageBubble";

export default function ChatWindow({ messages, loading, messagesEndRef }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "4px 0 12px" }}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} />
      ))}
      {loading && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div className="msg-bubble msg-ai" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[0, 150, 300].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#0a6e6e", animation: `pulse 1.2s ${d}ms infinite` }} />)}
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}