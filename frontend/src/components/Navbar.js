import "./Navbar.css";

function Navbar({ title, subtitle }) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h2>{title || "Dashboard"}</h2>
        <p>{subtitle || "PathoScan AI Medical System"}</p>
      </div>
      <div className="navbar-right">
        <div className="navbar-status">
          <div className="navbar-status-dot" />
          AI Online
        </div>
        <div className="navbar-date">{today}</div>
      </div>
    </header>
  );
}

export default Navbar;
