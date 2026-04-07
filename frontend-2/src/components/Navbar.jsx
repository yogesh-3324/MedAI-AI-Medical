import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  
  return (
    <nav>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span style={{ fontSize: 20, fontFamily: "'DM Serif Display',serif", color: "#0a6e6e" }}>MedAI</span>
        </button>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn-primary" style={{ padding: "10px 22px", fontSize: 14 }}>Login / Sign Up</button>
        </div>
      </div>
    </nav>
  );
}