import React from "react";

export default function Testimonials() {
  const reviews = [
    {
      name: "Dr. Sarah Jenkins",
      title: "General Practitioner",
      review: "MedAI has been an incredible supplementary tool. Its ability to instantly analyze X-rays and provide structured impressions is a game-changer for my workflow.",
      avatar: "SJ"
    },
    {
      name: "Michael Chen",
      title: "Patience / User",
      review: "I have complex dietary restrictions due to my medication. The 'Is It Safe to Eat?' feature gives me immense peace of mind before every meal.",
      avatar: "MC"
    },
    {
      name: "Emily Rodriguez",
      title: "Medical Student",
      review: "The drug interaction checker is beautifully designed and provides the 'why' behind interactions, not just a generic warning. A robust learning tool.",
      avatar: "ER"
    }
  ];

  return (
    <section style={{ background: "#e6f7f7", borderRadius: "32px", padding: "80px 24px", margin: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "52px" }}>
          <div className="section-label">User Reviews</div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", color: "#0d1f2d" }}>Trusted by thousands.</h2>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          {reviews.map((r, i) => (
            <div key={i} className="card-hover fade-up" style={{ background: "#fff", padding: "32px", borderRadius: "24px", position: "relative" }}>
              <div style={{ position: "absolute", top: "24px", right: "24px", fontSize: "40px", color: "#0a6e6e", opacity: 0.1, fontFamily: "serif" }}>
                "
              </div>
              <p style={{ fontSize: "16px", color: "#4a6274", lineHeight: 1.7, marginBottom: "24px", position: "relative", zIndex: 2 }}>
                "{r.review}"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "linear-gradient(135deg, #0a6e6e, #0d8a8a)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px" }}>
                  {r.avatar}
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "#0d1f2d" }}>{r.name}</div>
                  <div style={{ fontSize: "13px", color: "#4a6274" }}>{r.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
