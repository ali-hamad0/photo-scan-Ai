import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Chat.css';
import ThemeToggle from '../components/ThemeToggle';

const API_BASE       = '';
const FREE_MSG_LIMIT = 5;

const SCAN_META = {
  chest_xray: { label: 'Chest X-Ray', icon: '🫁', color: '#63C9D6' },
  bone_xray:  { label: 'Bone X-Ray',  icon: '🦴', color: '#A78BFA' },
  brain_mri:  { label: 'Brain MRI',   icon: '🧠', color: '#F472B6' },
};

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('medbot_session');
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('medbot_session', id);
  }
  return id;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function renderInline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="md-code">{part.slice(1, -1)}</code>;
        return part;
      })}
    </span>
  );
}

function renderMarkdown(text) {
  const lines  = text.split('\n');
  const output = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      output.push(<ul key={`ul-${output.length}`} className="md-list">{listItems}</ul>);
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    if (/^###\s/.test(line)) {
      flushList();
      output.push(<h3 key={i} className="md-h3">{renderInline(line.slice(4), i)}</h3>);
    } else if (/^##\s/.test(line)) {
      flushList();
      output.push(<h2 key={i} className="md-h2">{renderInline(line.slice(3), i)}</h2>);
    } else if (/^#\s/.test(line)) {
      flushList();
      output.push(<h1 key={i} className="md-h1">{renderInline(line.slice(2), i)}</h1>);
    } else if (/^[-*]\s/.test(line)) {
      listItems.push(<li key={i}>{renderInline(line.slice(2), i)}</li>);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      output.push(<p key={i}>{renderInline(line, i)}</p>);
    }
  });

  flushList();
  return output;
}

function BotMessage({ text, streaming }) {
  const nodes = renderMarkdown(text);
  return (
    <div className="msg-md">
      {nodes}
      {streaming && text.length > 0 && <span className="msg-cursor" />}
    </div>
  );
}

// ── Scan Context Picker ───────────────────────────────────────
function ScanContextPicker({ scans, pinnedScanId, onPin, token }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!token || scans.length === 0) return null;

  const pinned = scans.find(s => s.result_id === pinnedScanId);
  const meta   = pinned ? (SCAN_META[pinned.scan_type] ?? { label: pinned.scan_type, icon: '🔬', color: '#63C9D6' }) : null;

  return (
    <div className="scan-ctx-wrapper" ref={ref}>
      <button
        className={`scan-ctx-btn ${pinnedScanId ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Select scan context"
      >
        <span>{meta ? meta.icon : '💬'}</span>
        <span>{meta ? `${meta.label} · ${pinned.prediction}` : 'General question'}</span>
        {pinnedScanId && (
          <span
            className="scan-ctx-clear"
            onClick={e => { e.stopPropagation(); onPin(null); setOpen(false); }}
            title="Remove context"
          >✕</span>
        )}
      </button>

      {open && (
        <div className="scan-ctx-dropdown">
          <div className="scan-ctx-header">Select a scan to discuss</div>
          <div
            className={`scan-ctx-item ${!pinnedScanId ? 'selected' : ''}`}
            onClick={() => { onPin(null); setOpen(false); }}
          >
            <span>💬</span>
            <div>
              <div className="scan-ctx-item-label">No scan — general question</div>
              <div className="scan-ctx-item-sub">MedBot answers without your scan data</div>
            </div>
          </div>
          {scans.map(s => {
            const m = SCAN_META[s.scan_type] ?? { label: s.scan_type, icon: '🔬', color: '#63C9D6' };
            return (
              <div
                key={s.result_id}
                className={`scan-ctx-item ${pinnedScanId === s.result_id ? 'selected' : ''}`}
                onClick={() => { onPin(s.result_id); setOpen(false); }}
              >
                <span style={{ color: m.color }}>{m.icon}</span>
                <div>
                  <div className="scan-ctx-item-label" style={{ color: m.color }}>
                    {m.label} — {s.prediction}
                  </div>
                  <div className="scan-ctx-item-sub">
                    {s.patient_name ? `${s.patient_name} · ` : ''}{s.created_at}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Session Sidebar ───────────────────────────────────────────
function SessionSidebar({ sessions, activeId, onSelect, onNew, onDelete, open, onToggle }) {
  return (
    <div className={`chat-sidebar ${open ? 'open' : 'closed'}`}>
      <div className="chat-sidebar-header">
        <span className="chat-sidebar-title">{open ? 'Conversations' : ''}</span>
        <button className="chat-sidebar-toggle" onClick={onToggle} title={open ? 'Collapse' : 'Expand'}>
          {open ? '‹' : '›'}
        </button>
        
      </div>

      <button className="sidebar-new-btn" onClick={onNew}>
        <span className="sidebar-new-icon">＋</span>
        {open && <span>New Chat</span>}
      </button>

      <div className="chat-sidebar-list">
        {sessions.length === 0 && open && (
          <div className="sidebar-empty">No conversations yet</div>
        )}
        {sessions.map(s => (
          <div
            key={s.session_id}
            className={`sidebar-session-item ${s.session_id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s)}
            title={s.title}
          >
            <div className="sidebar-session-icon">💬</div>
            {open && (
              <div className="sidebar-session-info">
                <div className="sidebar-session-title">{s.title}</div>
                <div className="sidebar-session-date">{s.updated_at}</div>
              </div>
            )}
            {open && (
              <button
                className="sidebar-session-delete"
                title="Delete"
                onClick={e => { e.stopPropagation(); onDelete(s.session_id); }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Chat Component ───────────────────────────────────────
function Chat() {
  const token     = localStorage.getItem('token');
  const sessionId = useRef(getOrCreateSessionId());

  const WELCOME_MSG = {
    id: 'welcome', role: 'bot',
    text: "Hi! I'm **MedBot** — your AI medical assistant.\n\nI can help you understand blood test results, CBC values, symptoms, and recommend which doctor to see.\n\nWhat would you like to know?",
    time: getTime(), sources: [], streaming: false,
  };

  const [messages,     setMessages]     = useState([WELCOME_MSG]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPrompt,   setShowPrompt]   = useState(false);
  const [sessions,     setSessions]     = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [loadingHist,  setLoadingHist]  = useState(false);
  const [scans,        setScans]        = useState([]);
  const [pinnedScanId, setPinnedScanId] = useState(null);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const readerRef = useRef(null);

  const userCount = messages.filter(m => m.role === 'user').length;
  const remaining = Math.max(0, FREE_MSG_LIMIT - userCount);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load session list for logged-in users
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/chat/sessions`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => setSessions(data.sessions ?? []))
      .catch(() => {});
  }, [token]);

  // Load scan list for scan context picker
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/chat/scans`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => setScans(data.scans ?? []))
      .catch(() => {});
  }, [token]);

  // ── Load a past session ───────────────────────────────────
  const handleSelectSession = useCallback(async (session) => {
    if (readerRef.current) { try { await readerRef.current.cancel(); } catch {} }
    setLoadingHist(true);
    setActiveSession(session.session_id);
    sessionId.current = session.session_id;
    sessionStorage.setItem('medbot_session', session.session_id);

    try {
      const res  = await fetch(`${API_BASE}/api/chat/sessions/${session.session_id}/messages`, {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setSessions(prev => prev.filter(s => s.session_id !== session.session_id));
          const newId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          sessionStorage.setItem('medbot_session', newId);
          sessionId.current = newId;
          setActiveSession(null);
          setMessages([WELCOME_MSG]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const msgs = (data.messages ?? []).map((m, i) => ({
        id:        `hist_${i}`,
        role:      m.role,
        text:      m.content,
        time:      m.created_at,
        sources:   [],
        streaming: false,
      }));
      setMessages(msgs.length ? msgs : [WELCOME_MSG]);
    } catch {
      setMessages([WELCOME_MSG]);
    } finally {
      setLoadingHist(false);
      inputRef.current?.focus();
    }
  }, [token]);

  // ── New Chat ──────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    if (readerRef.current) { try { await readerRef.current.cancel(); } catch {} }
    const newId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('medbot_session', newId);
    sessionId.current = newId;
    setActiveSession(null);
    setPinnedScanId(null);
    setMessages([{ ...WELCOME_MSG, id: `welcome_${Date.now()}`, text: 'New conversation started. How can I help you?' }]);
    setInput('');
    setLoading(false);
    inputRef.current?.focus();
  }, [token]);

  // ── Delete session ────────────────────────────────────────
  const handleDeleteSession = useCallback(async (sid) => {
    await fetch(`${API_BASE}/api/chat/session/${sid}`, {
      method: 'DELETE', headers: authHeaders(token),
    }).catch(() => {});
    setSessions(prev => prev.filter(s => s.session_id !== sid));
    if (sid === activeSession) {
      handleNewChat();
    }
  }, [token, activeSession, handleNewChat]);

  // ── Send ──────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!token && userCount >= FREE_MSG_LIMIT) { setShowPrompt(true); return; }

    const userMsgId = `user_${Date.now()}`;
    const botMsgId  = `bot_${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text,   time: getTime(), sources: [], streaming: false },
      { id: botMsgId,  role: 'bot',  text: '', time: getTime(), sources: [], streaming: true  },
    ]);
    setInput('');
    setLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json', ...authHeaders(token) };
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: text, session_id: sessionId.current, scan_id: pinnedScanId }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let   buffer  = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'scan_context_active') {
            setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, scanContextActive: true } : m
            ));
          } else if (event.type === 'token') {
            setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, text: m.text + event.content } : m
            ));
          } else if (event.type === 'sources') {
            setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, sources: event.content } : m
            ));
          } else if (event.type === 'error') {
            setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, text: `**Error:** ${event.content}`, streaming: false } : m
            ));
          } else if (event.type === 'done') {
            break outer;
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, streaming: false } : m));

      // Refresh session list so new session appears
      if (token) {
        fetch(`${API_BASE}/api/chat/sessions`, { headers: authHeaders(token) })
          .then(r => r.json())
          .then(data => {
            setSessions(data.sessions ?? []);
            // Mark the current session as active
            setActiveSession(sessionId.current);
          })
          .catch(() => {});
      }

    } catch {
      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, text: "I'm having trouble connecting. Please make sure the server is running.", streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
      readerRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, loading, token, userCount]);

  const lastMsg    = messages[messages.length - 1];
  const isThinking = loading && lastMsg?.role === 'bot' && lastMsg?.text === '';

  return (
    <div className="chat-page">

      {/* ── Session Sidebar (logged-in only) ──────────────── */}
      {token && (
        <SessionSidebar
          sessions={sessions}
          activeId={activeSession}
          onSelect={handleSelectSession}
          onNew={handleNewChat}
          onDelete={handleDeleteSession}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />
      )}

      {/* ── Main Area ─────────────────────────────────────── */}
      <div className="chat-main">

        {/* Topbar */}
        <div className="chat-topbar">
          <div className="chat-logo">
            <div className="chat-logo-icon">🔬</div>
            PathoScan AI
          </div>
          <div className="topbar-actions">
            {!token && (
              <button className="btn-ghost btn-new-chat" onClick={handleNewChat}>
                ＋ New Chat
              </button>
            )}
            {token ? (
              <Link to="/dashboard" className="btn-solid">Dashboard</Link>
            ) : (
              <>
                <ThemeToggle />
                <Link to="/login"  className="btn-ghost">Login</Link>
                <Link to="/signup" className="btn-solid">Sign Up Free</Link>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {loadingHist ? (
            <div className="chat-hist-loading">
              <div className="typing-dots"><span /><span /><span /></div>
              <span>Loading conversation…</span>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`msg-row ${msg.role}`}>
                <div className={`msg-avatar ${msg.role === 'bot' && msg.streaming ? 'avatar-pulse' : ''}`}>
                  {msg.role === 'bot' ? '🤖' : '👤'}
                </div>
                <div className="msg-bubble">
                  {msg.role === 'bot' ? (
                    <>
                      {msg.streaming && msg.text === '' ? (
                        <div className="thinking-indicator">
                          <div className="typing-dots"><span /><span /><span /></div>
                          <span className="thinking-label">MedBot is thinking…</span>
                        </div>
                      ) : (
                        <BotMessage text={msg.text} streaming={msg.streaming} />
                      )}
                      {!msg.streaming && msg.scanContextActive && (
                        <div className="scan-ctx-badge">🔬 Response includes your scan data</div>
                      )}
                    </>
                  ) : (
                    <p className="user-text">{msg.text}</p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Login Prompt */}
        {showPrompt && (
          <div className="login-prompt">
            <div className="login-prompt-box">
              <div className="login-prompt-text">
                <h4>You've used your 5 free messages</h4>
                <p>Sign up free to keep chatting and unlock scan uploads</p>
              </div>
              <div className="login-prompt-actions">
                <Link to="/signup" className="btn-solid">Sign Up Free</Link>
                <Link to="/login"  className="btn-ghost">Login</Link>
                <button className="btn-dismiss" onClick={() => setShowPrompt(false)}>Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area">
          <ScanContextPicker
            scans={scans}
            pinnedScanId={pinnedScanId}
            onPin={setPinnedScanId}
            token={token}
          />
          <div className={`input-box ${isThinking ? 'input-box--thinking' : ''}`}>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder={
                pinnedScanId
                  ? `Ask about your ${scans.find(s => s.result_id === pinnedScanId)?.scan_type?.replace('_', ' ') ?? 'scan'}…`
                  : 'Ask a medical question…'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={loading || loadingHist}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || loadingHist || !input.trim()}
            >
              {loading ? <span className="send-spinner" /> : '➤'}
            </button>
          </div>
          <div className="input-footer">
            {!token && (
              <span className={`msg-counter ${remaining <= 2 ? 'low' : ''}`}>
                {remaining} free message{remaining !== 1 ? 's' : ''} left
              </span>
            )}
            {token && <span className="msg-counter">Unlimited messages · History saved</span>}
            <span className="disclaimer">Not a substitute for medical advice</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Chat;
