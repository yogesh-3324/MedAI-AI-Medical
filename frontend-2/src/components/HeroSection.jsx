export default function HeroSection({ scrollToFeatures }) {
  return (
    <section className="home-hero">
      <div className="home-hero-inner">
        
        {/* Left: Text Content */}
        <div className="hero-column">
          <div className="fade-up hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            <span>V2.0 Medical Intelligence</span>
          </div>

          <h1 className="fade-up-1 hero-title">
            Advanced <em style={{ color: "#0a6e6e", fontStyle: "italic" }}>Care</em> meets <br /> artificial intelligence
          </h1>

          <p className="fade-up-2 hero-copy">
            Process clinical documents, check drug safety, and interpret imaging instantly. Built to elevate healthcare accuracy and empower both patients and professionals.
          </p>

          <div className="fade-up-3 hero-actions">
            <button className="btn-primary hero-button" onClick={scrollToFeatures}>
              Explore Tools &rarr;
            </button>
            <div className="hero-pill-group">
              <div className="hero-pill-stack">
                {["A","B","C"].map((av, idx) => (
                  <div key={av} className="hero-pill-avatar" style={{ background: `hsl(${200 + idx * 40}, 60%, 50%)` }}>
                    {av}
                  </div>
                ))}
              </div>
              <span className="hero-pill-text">10k+ clinicians and patients</span>
            </div>
          </div>

          <div className="fade-up-4 hero-stat-row">
            {[
              { val: "6+", label: "Tools" },
              { val: "< 2s", label: "Instant insight" },
              { val: "HIPAA", label: "Ready security" }
            ].map(({ val, label }) => (
              <div key={label} className="hero-stat">
                <strong>{val}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Modern Doctor Image */}
        <div className="hero-visual-column">
          <div className="hero-visual-spot" />
          <img 
            src="/hero-doctor.png" 
            alt="Modern AI Healthcare Doctor interface" 
            className="hero-image"
            onMouseOver={(e) => e.currentTarget.style.transform = "rotate(0deg) translateY(-8px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "rotate(2deg) translateY(0px)"}
          />
        </div>
      </div>
    </section>
  );
}