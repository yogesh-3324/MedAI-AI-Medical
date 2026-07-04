import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { analyzeChatMsg, uploadChatDocument } from "../services/api";
import BackButton from "../components/common/BackButton";
import ChatWindow from "../components/Chat/ChatWindow";
import ChatInput from "../components/Chat/ChatInput";
import ChatHistorySidebar from "../components/Chat/ChatHistorySidebar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 15;

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? clean.slice(0, 40) + "…" : clean;
}

function buildInitialMessages() {
  return [
    {
      role: "ai",
      text: "Hello! I'm MedAI. You can chat with me about your health concerns, upload medical documents or reports, and I'll help analyze them. How can I assist you today?",
    },
  ];
}

function newConversation() {
  const now = Date.now();
  return {
    id: makeId(),
    title: "",
    messages: buildInitialMessages(),
    sessionId: null,
    uploadedFileName: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadConversations(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`medai_chats_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(userId, conversations) {
  if (!userId) return;
  try {
    localStorage.setItem(`medai_chats_${userId}`, JSON.stringify(conversations));
  } catch {
    // storage quota exceeded or private browsing — fail silently
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat({ showToast }) {
  if (!showToast) showToast = () => {};

  const { user, isLoaded } = useUser();
  const userId = isLoaded && user ? user.id : null;

  // ── Conversation state ───────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // ── Per-message state ────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // ── Web Search toggle ────────────────────────────────────────────────────
  // When true, every message is answered using live DuckDuckGo web search
  const [webSearch, setWebSearch] = useState(false);

  // ── File upload preview state ────────────────────────────────────────────────────
  // stagedFile: filename string shown in the preview card
  // uploadStatus: null | 'uploading' | 'done' | 'error'
  const [stagedFile, setStagedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const messagesEnd = useRef(null);

  // ── On auth ready: load or initialise conversations ──────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const loaded = loadConversations(userId);
    if (loaded.length === 0) {
      const fresh = newConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      saveConversations(userId, [fresh]);
    } else {
      setConversations(loaded);
      setActiveId(loaded[0].id); // most recent first
    }
    setHydrated(true);
  }, [isLoaded, userId]);

  // ── Derived: active conversation ─────────────────────────────────────────
  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const activeMessages = activeConv?.messages ?? buildInitialMessages();

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessages]);

  // ── Persist whenever conversations array changes ─────────────────────────
  const persistConversations = useCallback(
    (convs) => {
      saveConversations(userId, convs);
    },
    [userId]
  );

  // ── Update a single conversation in the list ─────────────────────────────
  const updateConversation = useCallback(
    (id, patch) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], ...patch, updatedAt: Date.now() };
        // Bubble updated conversation to top
        const next = [updated, ...prev.filter((c) => c.id !== id)];
        persistConversations(next);
        return next;
      });
    },
    [persistConversations]
  );

  // ── New Chat ─────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    const fresh = newConversation();
    setConversations((prev) => {
      const next = [fresh, ...prev].slice(0, MAX_HISTORY);
      persistConversations(next);
      return next;
    });
    setActiveId(fresh.id);
    setInput("");
    setShowUpload(false);
    setStagedFile(null);
    setUploadStatus(null);
  }, [persistConversations]);

  // ── Select existing conversation ─────────────────────────────────────────
  const handleSelectConversation = useCallback(
    (id) => {
      if (id === activeId) return;
      setActiveId(id);
      setInput("");
      setShowUpload(false);
      setStagedFile(null);
      setUploadStatus(null);
    },
    [activeId]
  );


  // ── Delete conversation ──────────────────────────────────────────────────
  const handleDeleteConversation = useCallback(
    (id) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistConversations(next);

        // If we deleted the active one, pick another or create fresh
        if (id === activeId) {
          if (next.length > 0) {
            setActiveId(next[0].id);
          } else {
            const fresh = newConversation();
            const withFresh = [fresh];
            persistConversations(withFresh);
            setConversations(withFresh);
            setActiveId(fresh.id);
            return withFresh;
          }
        }
        return next;
      });
    },
    [activeId, persistConversations]
  );

  // ── Document upload ──────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeId) return;
    setShowUpload(false);

    // Show preview card immediately with spinner
    setStagedFile(file.name);
    setUploadStatus("uploading");
    setLoading(true);

    try {
      const result = await uploadChatDocument(file);

      // Update current conversation state with session info
      const currentActiveId = activeId;
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === currentActiveId);
        if (!conv) return prev;
        const updated = {
          ...conv,
          sessionId: result.session_id,
          uploadedFileName: result.filename,
          updatedAt: Date.now(),
        };
        const next = [updated, ...prev.filter((c) => c.id !== currentActiveId)];
        persistConversations(next);
        return next;
      });

      // Update preview card to "done" state
      setUploadStatus("done");
      showToast("Document indexed successfully!", "success");
    } catch (err) {
      // Show error state in card
      setUploadStatus("error");
      showToast(`Upload failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };



  // ── Send message ─────────────────────────────────────────────────────────
  const send = async () => {
    let text = input.trim();

    // If text is empty but we just uploaded a file, provide a default query
    if (!text && uploadStatus === "done") {
      text = "Analyze this medical document.";
    }

    if (!text || !activeId) return;
    setInput("");

    const currentConv = conversations.find((c) => c.id === activeId);
    if (!currentConv) return;

    const userMsg = { role: "user", text };
    const newMessages = [...currentConv.messages, userMsg];

    // Set title from first user message
    const isFirstUserMsg = !currentConv.title;
    const newTitle = isFirstUserMsg ? makeTitle(text) : currentConv.title;


    // ── Build history for the backend (last 15 real turns) ─────────────────────────
    // Map our internal format {role:"user"|"ai", text} → Groq format {role:"user"|"assistant", content}
    const historyForBackend = currentConv.messages
      .filter((m) => m.role === "user" || m.role === "ai")
      // Skip the initial greeting if present
      .filter((m) => !(m.role === "ai" && m.text.startsWith("Hello! I'm MedAI")))
      .slice(-15)
      .map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      }));

    // Clear staged file & status now that message is being sent
    setStagedFile(null);
    setUploadStatus(null);

    // Optimistic update (show user message immediately)
    setConversations((prev) => {
      const updated = {
        ...currentConv,
        title: newTitle,
        messages: newMessages,
        updatedAt: Date.now(),
      };
      const next = [updated, ...prev.filter((c) => c.id !== activeId)];
      persistConversations(next);
      return next;
    });

    setLoading(true);

    try {
      const { answer, sources, usedWebSearch } = await analyzeChatMsg(
        text,
        currentConv.sessionId,
        historyForBackend,
        webSearch,
      );
      const aiMsg = {
        role: "ai",
        text: answer,
        sources: sources || [],
        usedWebSearch: usedWebSearch || false,
      };

      setConversations((prev) => {
        const conv = prev.find((c) => c.id === activeId);
        if (!conv) return prev;
        const updated = {
          ...conv,
          messages: [...conv.messages, aiMsg],
          updatedAt: Date.now(),
        };
        const next = [updated, ...prev.filter((c) => c.id !== activeId)];
        persistConversations(next);
        return next;
      });
    } catch (err) {
      showToast(`Failed to get response: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };


  // ── Clear document session ───────────────────────────────────────────────
  const handleClearDocument = () => {
    updateConversation(activeId, { sessionId: null, uploadedFileName: null });
    showToast("Document context cleared.", "success");
  };


  // ── Render ───────────────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)" }}>
        <div className="spinner" style={{ borderTopColor: "#0a6e6e", borderColor: "rgba(10,110,110,0.2)", width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="chat-layout">

      {/* ── Left: History Sidebar ─────────────────────────────────────── */}
      <ChatHistorySidebar
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* ── Right: Main Chat Panel ────────────────────────────────────── */}
      <div className="chat-main-panel">
        {/* Header */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <BackButton />
          <div style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: 26, color: "#0d1f2d", lineHeight: 1.2 }}>
              Chat with <span style={{ color: "#0a6e6e" }}>MedAI</span>
            </h2>
            <p style={{ color: "#4a6274", fontSize: 13.5, marginTop: 3 }}>
              Ask health questions, upload reports and get AI-powered insights.
            </p>
          </div>

          {/* Active document badge (live RAG session) */}
          {activeConv?.uploadedFileName && activeConv?.sessionId && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                background: "#e8f5f5",
                border: "1px solid #b2d8d8",
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: 12.5,
                color: "#0a6e6e",
                fontWeight: 500,
              }}
            >
              📄 {activeConv.uploadedFileName}
              <button
                onClick={handleClearDocument}
                title="Clear document"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#0a6e6e",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Re-upload notice: doc was part of this chat but session expired */}
          {activeConv?.uploadedFileName && !activeConv?.sessionId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12.5,
                color: "#92400e",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>
                This chat used{" "}
                <strong style={{ color: "#78350f" }}>📄 {activeConv.uploadedFileName}</strong>
                {" "}for document analysis. Document sessions don't persist across reloads —{" "}
                <strong>please re-upload the file</strong> to resume RAG-based Q&A.
                Chat history context is still remembered.
              </span>
            </div>
          )}
        </div>


        {/* Chat messages */}
        <ChatWindow
          messages={activeMessages}
          loading={loading}
          messagesEndRef={messagesEnd}
        />

        {/* Input bar */}
        <ChatInput
          input={input}
          setInput={setInput}
          send={send}
          loading={loading}
          showUpload={showUpload}
          setShowUpload={setShowUpload}
          handleUpload={handleUpload}
          stagedFile={stagedFile}
          uploadStatus={uploadStatus}
          onDismissStagedFile={() => { setStagedFile(null); setUploadStatus(null); }}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
        />
      </div>
    </div>
  );
}
