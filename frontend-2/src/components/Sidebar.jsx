import { useNavigate, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";

export default function Sidebar({ isOpen, setIsOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/chat", label: "Chat with MedAI", icon: "💬" },
    { path: "/doctor", label: "Do I Need A Doctor?", icon: "🏥" },
    { path: "/diet", label: "Make My Diet", icon: "🥗" },
    { path: "/food", label: "Is It Safe to Eat?", icon: "🍽️" },
    { path: "/drug", label: "Drug Checker", icon: "💊" },
    { path: "/consultation", label: "Consultation Report", icon: "🎙️" },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    // Always close sidebar drawer on mobile/tablet view when a link is tapped
    if (window.innerWidth <= 900) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Semi-transparent mobile backdrop overlay */}
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={`sidebar ${!isOpen ? "closed" : ""}`}>
        <div className="sidebar-inner">
          {/* Brand / Logo + Close button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, paddingLeft: 6, paddingRight: 4 }}>
            <div 
              onClick={() => handleNavClick("/")} 
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#0a6e6e,#0d8a8a)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(10,110,110,.3)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span style={{ fontSize: 22, fontFamily: "'DM Serif Display',serif", color: "#0a6e6e" }}>MedAI</span>
            </div>

            {/* Mobile Close Button */}
            <button 
              className="sidebar-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close Sidebar"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
            {navItems.map(item => {
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <div 
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Bottom Profile / Settings */}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn-outline" style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.5)", border: "1.5px solid #c8e6e6", cursor: "pointer", fontWeight: "bold" }}>
                  Login / Sign Up
                </button>
              </SignInButton>
            </SignedOut>
            
            <SignedIn>
              <div style={{ 
                padding: "12px", 
                background: "rgba(255,255,255,0.8)", 
                border: "1.5px solid #c8e6e6", 
                borderRadius: "12px", 
                display: "flex", 
                alignItems: "center", 
                gap: "12px",
                justifyContent: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}>
                <UserButton appearance={{ baseTheme: dark, elements: { userButtonAvatarBox: { width: 34, height: 34 } } }} />
                <span style={{ fontWeight: 600, color: "#0d1f2d", fontSize: "15px" }}>My Profile</span>
              </div>
            </SignedIn>
          </div>
        </div>
      </aside>
    </>
  );
}
