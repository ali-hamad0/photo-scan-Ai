import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

import "./Sidebar.css";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar");
    if (saved === null) return true; // First visit = open
    return saved === "open";
  });

  const navigate = useNavigate();
  const name = localStorage.getItem("name") || "Doctor";
  const initial = name.charAt(0).toUpperCase();

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem("sidebar", next ? "open" : "closed");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    navigate("/login");
  };

  return (
    <>
      {/* Mobile hamburger button — only visible when sidebar is closed on mobile */}
      {!isOpen && (
        <button
          className="sidebar-hamburger"
          onClick={toggle}
          title="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
      )}

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? "active" : ""}`}
        onClick={toggle}
      />

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🔬</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">
              Patho<span className="sidebar-logo-ai">Scan</span>
            </span>
            <span className="sidebar-logo-badge">BETA v1.0</span>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={toggle}
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? "‹" : "›"}
          </button>
        </div>

        {/* Menu */}
        <div className="sidebar-menu">
          {/* Main */}
          <div className="sidebar-group">
            <span className="sidebar-section-label">MAIN</span>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">🏠</span>
              <span className="sidebar-item-label">Dashboard</span>
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">📋</span>
              <span className="sidebar-item-label">History</span>
            </NavLink>
            <NavLink
              to="/patients"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">👥</span>
              <span className="sidebar-item-label">Patients</span>
            </NavLink>
          </div>
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "active" : ""}`
            }
          >
            <span className="sidebar-item-icon">💬</span>
            <span className="sidebar-item-label">AI Chat</span>
          </NavLink>
          {/* Analysis */}
          <div className="sidebar-group">
            <span className="sidebar-section-label">ANALYSIS</span>
            <NavLink
              to="/chest"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">🫁</span>
              <span className="sidebar-item-label">Chest X-Ray</span>
              <span className="sidebar-item-dot" />
            </NavLink>
            <NavLink
              to="/bone"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">🦴</span>
              <span className="sidebar-item-label">Bone X-Ray</span>
              <span className="sidebar-item-dot" />
            </NavLink>
            <NavLink
              to="/brain"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">🧠</span>
              <span className="sidebar-item-label">Brain MRI</span>
              <span className="sidebar-item-dot" />
            </NavLink>
          </div>
        </div>

        {/* Profile Footer */}
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{initial}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">Dr. {name}</div>
            <div className="sidebar-profile-role">Medical Doctor</div>
          </div>
          <div className="sidebar-profile-actions">
            <ThemeToggle />
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              ⏻
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
