import React from "react";

export default function DetailedFeatures() {
  const steps = [
    {
      step: "01",
      title: "Real-time AI Diagnosis",
      desc: "Our vision models process X-rays and imaging documents in seconds, extracting critical impressions and warning flags precisely when you need them.",
      color: "#0a6e6e"
    },
    {
      step: "02",
      title: "Holistic Health Tracking",
      desc: "From checking drug interactions to validating if your next meal is safe for your current medical conditions, MedAI is your 24/7 personal health guardian.",
      color: "#f59e0b"
    },
    {
      step: "03",
      title: "Bank-Grade Security",
      desc: "Your data is encrypted end-to-end. We operate on a strict zero-retention policy for your highly sensitive medical files.",
      color: "#f97316"
    }
  ];

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "60px" }}>
        
        <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "40px" }}>
          <div style={{ flex: "1 1 400px" }}>
            <div className="section-label" style={{ marginBottom: "16px" }}>Why Choose MedAI?</div>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", color: "#0d1f2d", lineHeight: 1.1, marginBottom: "24px" }}>
              Intelligence that <span style={{ color: "#0a6e6e", fontStyle: "italic" }}>cares</span> for you.
            </h2>
            <p style={{ fontSize: "17px", color: "#4a6274", lineHeight: 1.7, maxWidth: "500px" }}>
              Unlike generic search engines, MedAI utilizes advanced multi-modal vision-language 
              models specifically fine-tuned for healthcare. Whether you are seeking triage advice 
              or interpreting complex medical reports, we deliver safe, highly-contextualized results.
            </p>
          </div>

          <div style={{ flex: "1 1 500px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {steps.map((s, i) => (
              <div key={i} className="card-hover" style={{ display: "flex", gap: "20px", background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid rgba(10,110,110,.05)" }}>
                <div style={{ fontSize: "24px", fontWeight: "bold", fontFamily: "'DM Serif Display',serif", color: s.color, opacity: 0.5 }}>
                  {s.step}
                </div>
                <div>
                  <h3 style={{ fontSize: "20px", color: "#0d1f2d", marginBottom: "8px" }}>{s.title}</h3>
                  <p style={{ fontSize: "15px", color: "#4a6274", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
