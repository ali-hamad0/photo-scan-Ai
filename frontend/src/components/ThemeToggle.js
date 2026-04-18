import { useEffect, useState } from 'react';
import './ThemeToggle.css';

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isDark]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setIsDark(p => !p)}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className={`toggle-track ${isDark ? 'dark' : 'light'}`}>
        <span className="toggle-icon sun">☀️</span>
        <span className="toggle-icon moon">🌙</span>
        <div className="toggle-thumb" />
      </div>
    </button>
  );
}

export default ThemeToggle;