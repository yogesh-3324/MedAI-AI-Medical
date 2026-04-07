import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Diet from './pages/Diet'
import DoctorCheck from './pages/DoctorCheck'
import DrugChecker from './pages/DrugChecker'
import FoodSafety from './pages/FoodSafety'
import XrayAnalyzer from './pages/XrayAnalyzer'
import ConsultationReport from './pages/ConsultationReport'
import { SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react'

const ProtectedRoute = ({ children }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          <div style={{ filter: "blur(8px)", transform: "scale(1.02)", opacity: 0.6, pointerEvents: "none" }}>
            <Home />
          </div>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", justifyContent: "center", alignItems: "center",
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, rgba(240,248,255,0.5) 100%)",
            backdropFilter: "blur(4px)", zIndex: 50, borderRadius: "24px"
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, transform: "scale(1.15)", transformOrigin: "center" }}>
              <SignIn routing="virtual" />
            </div>
          </div>
        </div>
      </SignedOut>
    </>
  );
};

/* ── Consultation Report nav button (rendered inside Router so useNavigate works) ── */
function ConsultationNavButton() {
  const navigate = useNavigate();
  return (
    <button
      id="consultation-recorder-btn"
      onClick={() => navigate('/consultation')}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px',
        background: 'linear-gradient(135deg,#0a6e6e,#0d8a8a)',
        color: '#fff', border: 'none', borderRadius: 12,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(10,110,110,.35)',
        transition: 'all .2s ease',
        fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(10,110,110,.45)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 4px 14px rgba(10,110,110,.35)'; }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8"  y1="23" x2="16" y2="23"/>
      </svg>
      Generate Consultation Report
    </button>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isSignedIn, isLoaded } = useAuth();
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const prevState = useRef(false);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && !prevState.current && !sessionStorage.getItem('auth_toast_shown')) {
        setShowLoginSuccess(true);
        sessionStorage.setItem('auth_toast_shown', 'true');
        setTimeout(() => setShowLoginSuccess(false), 3000);
      }
      if (!isSignedIn) sessionStorage.removeItem('auth_toast_shown');
      prevState.current = isSignedIn;
    }
  }, [isSignedIn, isLoaded]);

  return (
    <Router>
      <div className="app-layout">
        {showLoginSuccess && (
          <div className="slide-in" style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, background: "#dcfce7", color: "#15803d",
            padding: "12px 24px", borderRadius: 8, fontWeight: 600,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            display: "flex", alignItems: "center", gap: 8, border: "1px solid #bbf7d0"
          }}>
            <span>✔️</span> Logged Successfully
          </div>
        )}

        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        <main className="main-content">
          {/* Top Bar */}
          <div style={{
            height: "64px", display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 24px",
            position: "sticky", top: 0, zIndex: 10,
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(10,110,110,0.05)"
          }}>
            {/* Left: hamburger + logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: "5px", padding: "8px" }}
              >
                <span style={{ width: "22px", height: "2px", background: "#0a6e6e", borderRadius: "2px", transition: "all 0.3s" }}></span>
                <span style={{ width: "22px", height: "2px", background: "#0a6e6e", borderRadius: "2px", transition: "all 0.3s" }}></span>
                <span style={{ width: "16px", height: "2px", background: "#0a6e6e", borderRadius: "2px", transition: "all 0.3s" }}></span>
              </button>
              {!isSidebarOpen && (
                <div style={{ marginLeft: "16px", fontSize: "20px", fontFamily: "'DM Serif Display',serif", color: "#0a6e6e", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </div>
                  MedAI
                </div>
              )}
            </div>

            {/* Right: navigate to consultation page */}
            <ConsultationNavButton />
          </div>

          <div style={{ padding: "0 24px 24px", height: "calc(100% - 64px)", overflowY: "auto" }}>
            <Routes>
              <Route path="/"            element={<Home />} />
              <Route path="/chat"        element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/diet"        element={<ProtectedRoute><Diet /></ProtectedRoute>} />
              <Route path="/doctor"      element={<ProtectedRoute><DoctorCheck /></ProtectedRoute>} />
              <Route path="/drug"        element={<ProtectedRoute><DrugChecker /></ProtectedRoute>} />
              <Route path="/food"        element={<ProtectedRoute><FoodSafety /></ProtectedRoute>} />
              <Route path="/xray"        element={<ProtectedRoute><XrayAnalyzer /></ProtectedRoute>} />
              <Route path="/consultation" element={<ProtectedRoute><ConsultationReport /></ProtectedRoute>} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App