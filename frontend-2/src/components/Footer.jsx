import React from "react";

export default function Footer() {
  return (
    <footer style={{ background: "#0d1f2d", color: "#e2ecec", padding: "60px 24px 40px", borderTopLeftRadius: "32px", borderTopRightRadius: "32px", marginTop: "80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "40px", marginBottom: "60px" }}>
          
          {/* Brand Info */}
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "20px" }}>
              <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span style={{ fontSize: 24, fontFamily: "'DM Serif Display',serif", color: "#fff" }}>MedAI</span>
            </div>
            <p style={{ fontSize: "15px", lineHeight: 1.7, opacity: 0.8, maxWidth: "300px" }}>
              Empowering individuals and professionals with intelligent, accurate, and rapid multi-modal medical analysis. 
              Your health, simplified.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: "60px", flexWrap: "wrap" }}>
            <div>
              <h4 style={{ fontSize: "16px", marginBottom: "20px", color: "#fff", fontWeight: "600" }}>Features</h4>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", opacity: 0.8 }}>
                <li>X-ray Analyzer</li>
                <li>Drug Checker</li>
                <li>Diet Planner</li>
                <li>AI Triage</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: "16px", marginBottom: "20px", color: "#fff", fontWeight: "600" }}>Legal</h4>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", opacity: 0.8 }}>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Medical Disclaimer</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px" }}>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>
            &copy; {new Date().getFullYear()} MedAI. All rights reserved. Let's build healthier futures.
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>
            Designed with <span style={{ color: "#ef4444" }}>&hearts;</span> for Healthcare.
          </div>
        </div>

      </div>
    </footer>
  );
}
