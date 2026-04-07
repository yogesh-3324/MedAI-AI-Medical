import { useState, useRef, useEffect } from "react";
import { analyzeChatMsg, uploadChatDocument } from "../services/api";
import BackButton from "../components/common/BackButton";
import ChatWindow from "../components/Chat/ChatWindow";
import ChatInput from "../components/Chat/ChatInput";

export default function Chat({ showToast }) {
  if (!showToast) showToast = () => {};
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! I'm MedAI. You can chat with me about your health concerns, upload medical documents or reports, and I'll help analyze them. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // RAG session — set after a successful document upload
  const [sessionId, setSessionId] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setShowUpload(false);

    // Optimistic UI — show "processing" message immediately
    setMessages((m) => [
      ...m,
      {
        role: "ai",
        text: `📎 Received **"${file.name}"**. Processing document — extracting text, chunking and indexing…`,
      },
    ]);
    setLoading(true);

    try {
      const result = await uploadChatDocument(file);

      // Store the session ID so every subsequent message uses RAG
      setSessionId(result.session_id);
      setUploadedFileName(result.filename);

      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `✅ **"${result.filename}"** indexed successfully (${result.num_chunks} chunks). You can now ask me anything about this document!`,
        },
      ]);
      showToast("Document indexed successfully!", "success");
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `❌ Failed to process the document: ${err.message}. Please try again.`,
        },
      ]);
      showToast("Document upload failed.", "error");
    } finally {
      setLoading(false);
      // Reset the file input so the same file can be re-uploaded if needed
      e.target.value = "";
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);

    try {
      // Pass sessionId so the backend uses RAG when a doc is loaded
      const aiReply = await analyzeChatMsg(text, sessionId);
      setMessages((m) => [...m, { role: "ai", text: aiReply }]);
    } catch (err) {
      showToast(`Failed to get response: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "32px 24px",
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BackButton />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, color: "#0d1f2d" }}>
          Chat with <span style={{ color: "#0a6e6e" }}>MedAI</span>
        </h2>
        <p style={{ color: "#4a6274", fontSize: 14, marginTop: 4 }}>
          Ask health questions, upload reports and get AI-powered insights.
        </p>

        {/* Show which document is currently loaded */}
        {uploadedFileName && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              background: "#e8f5f5",
              border: "1px solid #b2d8d8",
              borderRadius: 8,
              padding: "4px 12px",
              fontSize: 13,
              color: "#0a6e6e",
              fontWeight: 500,
            }}
          >
            📄 {uploadedFileName}
            <button
              onClick={() => {
                setSessionId(null);
                setUploadedFileName(null);
                showToast("Document context cleared.", "success");
              }}
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
      </div>

      <ChatWindow messages={messages} loading={loading} messagesEndRef={messagesEnd} />
      <ChatInput
        input={input}
        setInput={setInput}
        send={send}
        loading={loading}
        showUpload={showUpload}
        setShowUpload={setShowUpload}
        handleUpload={handleUpload}
      />
    </div>
  );
}
