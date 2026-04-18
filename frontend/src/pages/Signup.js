import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Signup.css';

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'At least 8 characters required';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/auth/register', {
        name, email, password
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleSignup(); };

  if (success) {
    return (
      <div className="signup-container">
        <div className="signup-card signup-success-card">
          <div className="signup-success-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" stroke="var(--green)" strokeWidth="1.5" opacity="0.4"/>
              <path d="M12 20l5.5 5.5L28 14" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="signup-success-title">Account created!</h2>
          <p className="signup-success-msg">Redirecting you to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">

        <button className="auth-back-btn" onClick={() => navigate('/')} title="Go back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="var(--purple)" strokeWidth="1.5" opacity="0.4"/>
              <path d="M14 7v14M7 14h14" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="3" fill="var(--purple)" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="signup-logo">PathoScan AI</h1>
          <p className="signup-title">Create your doctor account</p>
        </div>

        {error && (
          <div className="signup-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label">Full name</label>
          <div className={`auth-input-wrap ${fieldErrors.name ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2.5 13.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              className="signup-input"
              type="text"
              placeholder="Dr. Jane Smith"
              value={name}
              onChange={e => { setName(e.target.value); setFieldErrors(p => ({...p, name: ''})); }}
              onKeyDown={handleKey}
              autoComplete="name"
            />
          </div>
          {fieldErrors.name && <span className="auth-field-error">{fieldErrors.name}</span>}
        </div>

        <div className="auth-field">
          <label className="auth-label">Email address</label>
          <div className={`auth-input-wrap ${fieldErrors.email ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1.5 5.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              className="signup-input"
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
          <label className="auth-label">Password <span className="auth-label-hint">(min. 8 characters)</span></label>
          <div className={`auth-input-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
            </svg>
            <input
              className="signup-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({...p, password: ''})); }}
              onKeyDown={handleKey}
              autoComplete="new-password"
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

        <div className="auth-field">
          <label className="auth-label">Confirm password</label>
          <div className={`auth-input-wrap ${fieldErrors.confirmPassword ? 'has-error' : ''}`}>
            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M6.5 10.5l1.2 1.2L10 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              className="signup-input"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({...p, confirmPassword: ''})); }}
              onKeyDown={handleKey}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowConfirm(v => !v)}
              tabIndex={-1}
              title={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? (
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
          {fieldErrors.confirmPassword && <span className="auth-field-error">{fieldErrors.confirmPassword}</span>}
        </div>

        <button className="signup-button" onClick={handleSignup} disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              Creating account…
            </>
          ) : 'Create Account'}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <p className="signup-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
