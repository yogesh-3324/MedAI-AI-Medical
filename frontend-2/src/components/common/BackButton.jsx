import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();
  
  const navigateToFeatures = () => {
    navigate("/");
    setTimeout(() => { document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" }); }, 80);
  };

  return (
    <button
      onClick={navigateToFeatures}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "none", border: "none", cursor: "pointer",
        color: "var(--teal)", fontFamily: "'DM Sans',sans-serif",
        fontSize: 15, fontWeight: 600, padding: "4px 0",
        marginBottom: 20, transition: "opacity .2s",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = ".7"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
    >
      <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>←</span> Back
    </button>
  );
}