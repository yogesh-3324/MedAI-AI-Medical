import React, { forwardRef } from "react";
import FeatureCard from "./FeatureCard";

const cards = [
  { id: "chat", icon: "💬", title: "Chat with MedAI", bullets: ["Analyze medical documents", "Analyze medical reports & test reports", "Analyze images for disease identification"] },
  { id: "doctor", icon: "🏥", title: "Do I Need A Doctor?", desc: "AI analyzes your inputs to estimate the level of medical risk, helping you take the right action at the right time." },
  { id: "diet", icon: "🥗", title: "Make My Diet", desc: "Personalized diet plan based on your current medical condition with recommendations on what to eat and avoid." },
  { id: "food", icon: "🍽️", title: "Is It Safe to Eat?", desc: "Tells whether a meal is safe for your current medical condition before you consume it." },
  { id: "drug", icon: "💊", title: "Drug Interaction Checker", desc: "Identify potential interactions between multiple drugs and get clear insights on side effects and warnings." },
];

const FeatureGrid = forwardRef((props, ref) => {
  return (
    <section ref={ref} id="features-section" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 100px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="section-label">Features</div>
        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", color: "#0d1f2d", marginTop: 8 }}>Choose any one field from following —</h2>
      </div>
      <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {cards.map((card, i) => (
          <FeatureCard key={card.id} card={card} index={i} />
        ))}
      </div>
    </section>
  );
});

export default FeatureGrid;