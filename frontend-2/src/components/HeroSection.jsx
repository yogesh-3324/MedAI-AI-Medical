export default function HeroSection({ scrollToFeatures }) {
  return (
    <section className="hero-mesh" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 24px", position: "relative", overflow: "hidden" }}>
      {/* Decorative Orbs */}
      <div style={{ position: "absolute", top: "5%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(10,110,110,0.08) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "40px" }}>
        
        {/* Left: Text Content */}
        <div style={{ flex: "1 1 500px", textAlign: "left", position: "relative", zIndex: 2, marginTop: "-20px" }}>
          <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(10,110,110,.05)", border: "1px solid rgba(10,110,110,.12)", borderRadius: 100, padding: "8px 20px", marginBottom: 20, backdropFilter: "blur(4px)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0a6e6e", display: "inline-block", boxShadow: "0 0 10px rgba(10,110,110,0.5)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0a6e6e", letterSpacing: "0.5px" }}>V2.0 Medical Intelligence</span>
          </div>

          <h1 className="fade-up-1" style={{ fontSize: "clamp(36px,4.5vw,64px)", lineHeight: 1.05, color: "#0d1f2d", marginBottom: 20 }}>
            Advanced <em style={{ color: "#0a6e6e", fontStyle: "italic" }}>Care</em> meets <br /> artificial intelligence
          </h1>

          <p className="fade-up-2" style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(18px,2.2vw,22px)", color: "#4a6274", lineHeight: 1.6, marginBottom: 32, maxWidth: 520 }}>
            Process Clinical Documents, Check Drug Safety, And Interpret Imaging Instantly. Built Specifically To Elevate Healthcare Accuracy, Empowering Both Patients And Professionals.
          </p>

          <div className="fade-up-3" style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <button className="btn-primary" style={{ fontSize: 17, padding: "16px 40px", borderRadius: 100, boxShadow: "0 8px 32px rgba(10,110,110,0.25)" }} onClick={scrollToFeatures}>
              Explore Tools &rarr;
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fff", padding: "6px 16px", borderRadius: "100px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", marginLeft: "10px" }}>
                {["A","B","C"].map((av, idx) => (
                  <div key={av} style={{ width: "28px", height: "28px", borderRadius: "50%", background: `hsl(${200 + idx*40}, 60%, 50%)`, marginLeft: "-10px", border: "2px solid #fff", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>
                    {av}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#4a6274" }}>10k+ users</span>
            </div>
          </div>

          <div className="fade-up-4" style={{ display: "flex", gap: "32px", marginTop: "40px", borderTop: "1px solid rgba(10,110,110,0.1)", paddingTop: "24px" }}>
            {[
              { val: "6+", label: "Features" },
              { val: "< 2s", label: "Speed" },
              { val: "100%", label: "Secure" }
            ].map(({val, label}) => (
              <div key={label} style={{ textAlign: "left" }}>
                <div style={{ fontSize: 32, fontFamily: "'DM Serif Display',serif", color: "#0a6e6e" }}>{val}</div>
                <div style={{ fontSize: 13, color: "#4a6274", marginTop: 4, fontWeight: "500" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Modern Doctor Image */}
        <div className="slide-in" style={{ flex: "1 1 400px", display: "flex", justifyContent: "center", position: "relative", zIndex: 2, marginTop: "-20px" }}>
          <div style={{ position: "absolute", top: "40%", right: "10%", width: 140, height: 140, borderRadius: "50%", border: "1px dashed rgba(10,110,110,.2)", animation: "spin 20s linear infinite", pointerEvents: "none", zIndex: -1 }} />
          <img 
            src="/hero-doctor.png" 
            alt="Modern AI Healthcare Doctor interface" 
            style={{ width: "100%", maxWidth: "480px", height: "auto", objectFit: "cover", borderRadius: "32px", boxShadow: "0 24px 64px rgba(10,110,110,0.15)", border: "2px solid #fff", transform: "rotate(2deg)", transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
            onMouseOver={(e) => e.currentTarget.style.transform = "rotate(0deg) translateY(-8px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "rotate(2deg) translateY(0px)"}
          />
        </div>

      </div>
    </section>
  );
}