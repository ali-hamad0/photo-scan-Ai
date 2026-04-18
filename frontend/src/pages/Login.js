import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';
import '../styles/global.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', {
        email, password
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('name', res.data.name);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="login-container">
      <div className="login-card">

        <button className="auth-back-btn" onClick={() => navigate('/')} title="Go back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="var(--teal)" strokeWidth="1.5" opacity="0.4"/>
              <path d="M14 7v14M7 14h14" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="3" fill="var(--teal)" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="login-logo">PathoScan AI</h1>
          <p className="login-title">Medical Diagnostic System</p>
        </div>

        {error && (
          <div className="login-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label">Email address</label>
          <div className={`auth-input-wrap ${fieldErrors.email ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1.5 5.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              className="login-input"
              type="email"
              placeholder="you@hospital.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({...p, email: ''})); }}
              onKeyDown={handleKey}
              autoComplete="email"
            />
          </div>
          {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <div className={`auth-input-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
            </svg>
            <input
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({...p, password: ''})); }}
              onKeyDown={handleKey}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
                  <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
        </div>

        <button className="login-button" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              Logging in…
            </>
          ) : 'Login'}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <p className="login-link">
          No account? <Link to="/signup">Create one here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
