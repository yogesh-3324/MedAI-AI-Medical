import { useNavigate } from "react-router-dom";

export default function FeatureCard({ card, index }) {
  const navigate = useNavigate();

  return (
    <button className={`card-hover fade-up-${index + 1}`}
      onClick={() => navigate(`/${card.id}`)}
      style={{ background: "#fff", border: "1px solid rgba(10,110,110,.08)", borderRadius: 24, padding: "32px 24px", textAlign: "left", cursor: "pointer", transition: "all .3s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
      <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, var(--sky), #fff)", border: "1px solid rgba(10,110,110,.05)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
        {card.icon}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0d1f2d", marginBottom: 14, lineHeight: 1.3 }}>{card.title}</h3>
      {card.bullets ? (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {card.bullets.map(b => (
            <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#4a6274", lineHeight: 1.6 }}>
              <span style={{ color: "#0a6e6e", marginTop: 2, flexShrink: 0 }}>✓</span>{b}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 15, color: "#4a6274", lineHeight: 1.7 }}>{card.desc}</p>
      )}
      <div style={{ marginTop: 24, color: "#0a6e6e", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        Open Tool <span style={{ transition: "transform .2s", fontSize: "18px" }}>→</span>
      </div>
    </button>
  );
}