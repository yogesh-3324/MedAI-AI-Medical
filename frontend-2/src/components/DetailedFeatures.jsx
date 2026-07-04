import React from "react";

export default function DetailedFeatures() {
  const steps = [
    {
      step: "01",
      title: "Real-time AI diagnosis",
      desc: "MedAI analyzes reports and imaging at clinical speed, highlighting key findings and potential red flags for rapid triage.",
      accent: "#0f4f7c"
    },
    {
      step: "02",
      title: "Evidence-driven care guidance",
      desc: "From drug interactions to meal safety, our workflow surfaces clinically relevant recommendations based on current medical context.",
      accent: "#0284c7"
    },
    {
      step: "03",
      title: "Secure healthcare compliance",
      desc: "Data is handled with enterprise-grade encryption and privacy controls, designed for sensitive medical use cases.",
      accent: "#16a34a"
    }
  ];

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="section-label">What sets us apart</span>
        <h2>Professional-grade AI workflows for care teams and patients.</h2>
        <p>
          MedAI is built for clinical use: precise document analysis, safer medication checks, and structured reporting that feels like a polished healthcare platform.
        </p>
      </div>

      <div className="step-grid">
        {steps.map((step) => (
          <div key={step.step} className="step-card card-hover">
            <div className="step-badge" style={{ color: step.accent, background: `${step.accent}1a` }}>
              {step.step}
            </div>
            <div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
