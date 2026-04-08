/**
 * ChatHistorySidebar.jsx
 *
 * Left panel of the Chat page — shows up to 15 saved conversations
 * for the currently signed-in user, with a "New Chat" button at the top.
 */

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(diff / 3_600_000);
  const days    = Math.floor(diff / 86_400_000);

  if (minutes < 1)  return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours   < 24) return `${hours}h ago`;
  if (days    < 7)  return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}) {
  return (
    <aside className="chat-history-panel">
      {/* Header */}
      <div className="chat-history-panel-header">
        <p className="chat-history-title">Conversations</p>
        <button className="new-chat-btn" onClick={onNewChat} id="new-chat-btn">
          {/* Plus icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="chat-history-list">
        {conversations.length === 0 ? (
          <div className="history-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="#9bb3b3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No conversations yet.<br />Start chatting to build your history.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`history-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectConversation(conv.id)}
                id={`history-item-${conv.id}`}
              >
                {/* Icon */}
                <div className="history-item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>

                {/* Text */}
                <div className="history-item-content">
                  <div className="history-item-title">
                    {conv.title || "New conversation"}
                  </div>
                  <div className="history-item-meta">
                    {formatRelativeTime(conv.updatedAt)}
                    {conv.uploadedFileName && (
                      <span style={{ marginLeft: 4 }}>· 📎</span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  className="history-item-delete"
                  title="Delete conversation"
                  id={`delete-conv-${conv.id}`}
                  onClick={(e) => {
                    e.stopPropagation(); // don't trigger item click
                    onDeleteConversation(conv.id);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
