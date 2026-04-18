import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "./Dashboard.css";

const SCAN_TYPES = [
  { id: "chest", label: "Chest X-Ray", subtitle: "Pneumonia Detection", icon: "🫁", color: "#63C9D6", path: "/chest" },
  { id: "bone",  label: "Bone X-Ray",  subtitle: "Fracture Detection",  icon: "🦴", color: "#A78BFA", path: "/bone"  },
  { id: "brain", label: "Brain MRI",   subtitle: "Tumor Detection",     icon: "🧠", color: "#F472B6", path: "/brain" },
];

const SCAN_META = {
  chest_xray: { label: "Chest X-Ray", icon: "🫁", color: "#63C9D6" },
  bone_xray:  { label: "Bone X-Ray",  icon: "🦴", color: "#A78BFA" },
  brain_mri:  { label: "Brain MRI",   icon: "🧠", color: "#F472B6" },
};

// ── Donut Chart ───────────────────────────────────────────────
function DonutChart({ chest, bone, brain, total }) {
  const R  = 54;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * R;

  const segments = [
    { value: chest, color: "#63C9D6", label: "Chest" },
    { value: bone,  color: "#A78BFA", label: "Bone"  },
    { value: brain, color: "#F472B6", label: "Brain" },
  ];

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct  = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const gap  = circ - dash;
    const arc  = { ...seg, dash, gap, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut-wrapper">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--bd-md)" strokeWidth="14" />
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--bd-md)" strokeWidth="14" />
        ) : arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset + circ * 0.25}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        ))}
        {/* Center text */}
        <text x={cx} y={cy - 8}  textAnchor="middle" fill="var(--tx-hi)"  fontSize="22" fontWeight="700" fontFamily="monospace">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--tx-low)" fontSize="9"  fontFamily="monospace" letterSpacing="1">TOTAL</text>
      </svg>
      <div className="donut-legend">
        {arcs.map((arc, i) => (
          <div key={i} className="donut-legend-row">
            <span className="donut-legend-dot" style={{ background: arc.color }} />
            <span className="donut-legend-label">{arc.label}</span>
            <span className="donut-legend-val">{arc.value}</span>
            <span className="donut-legend-pct">({total > 0 ? Math.round(arc.pct * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Confidence Bar Chart ──────────────────────────────────────
function ConfidenceChart({ data }) {
  if (!data.length) return (
    <div className="dash-empty" style={{ padding: '20px' }}>
      <span className="dash-empty-icon" style={{ fontSize: 28 }}>📊</span>
      <p>No data yet</p>
    </div>
  );

  const max = 100;
  return (
    <div className="conf-chart">
      {data.map((item, i) => {
        const meta = SCAN_META[item.scan_type] || { color: "#63C9D6", icon: "🔬" };
        return (
          <div key={i} className="conf-bar-row">
            <div className="conf-bar-label">
              <span>{meta.icon}</span>
              <span className="conf-bar-name">{item.prediction}</span>
            </div>
            <div className="conf-bar-track">
              <div
                className="conf-bar-fill"
                style={{
                  width: `${(item.confidence / max) * 100}%`,
                  background: meta.color,
                  animationDelay: `${i * 0.06}s`,
                }}
              />
            </div>
            <span className="conf-bar-val" style={{ color: meta.color }}>{item.confidence}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Top Findings ──────────────────────────────────────────────
function getTopFindings(history) {
  const counts = {};
  for (const item of history) {
    const key = `${item.scan_type}__${item.prediction}`;
    counts[key] = (counts[key] || { scan_type: item.scan_type, prediction: item.prediction, count: 0 });
    counts[key].count++;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ── Scan Activity Heatmap (last 4 weeks) ─────────────────────
function ActivityHeatmap({ history }) {
  // Build day buckets: last 28 days
  const days = 28;
  const today = new Date();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const item of history) {
    if (!item.created_at) continue;
    // parse "Apr 03, 2026 14:22" → date key
    const parsed = new Date(item.created_at);
    if (isNaN(parsed)) continue;
    const key = parsed.toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }

  const entries = Object.entries(buckets);
  const maxVal  = Math.max(...Object.values(buckets), 1);

  return (
    <div className="heatmap-grid">
      {entries.map(([date, count]) => {
        const intensity = count / maxVal;
        return (
          <div
            key={date}
            className="heatmap-cell"
            title={`${date}: ${count} scan${count !== 1 ? 's' : ''}`}
            style={{
              background: count === 0
                ? 'var(--bg-secondary)'
                : `rgba(6,182,212,${0.15 + intensity * 0.75})`,
              border: count > 0 ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border)',
            }}
          />
        );
      })}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
function Dashboard() {
  const [stats,   setStats]   = useState({ total: 0, chest: 0, bone: 0, brain: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const name    = localStorage.getItem("name") || "Doctor";
  const today   = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    Promise.all([
      axios.get("/api/stats",   { headers }),
      axios.get("/api/history?page=1&page_size=50", { headers }),
    ])
      .then(([statsRes, historyRes]) => {
        setStats(statsRes.data);
        setHistory(historyRes.data.history ?? []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const recent      = history.slice(0, 5);
  const chartData   = history.slice(0, 10).reverse();
  const topFindings = getTopFindings(history);

  const avgConf = history.length
    ? Math.round(history.reduce((s, h) => s + (h.confidence || 0), 0) / history.length)
    : 0;

  return (
    <>
      <Navbar />
      <div className="page-content">

        {/* ── Welcome ──────────────────────────────────────── */}
        <div className="dash-welcome">
          <div>
            <h1 className="dash-welcome-title">Good {getGreeting()}, Dr. {name}</h1>
            <p className="dash-welcome-sub">{today}</p>
          </div>
          <div className="dash-welcome-badge">
            <span className="dash-online-dot" />
            AI Systems Online
          </div>
        </div>

        {/* ── Stat Cards ───────────────────────────────────── */}
        <div className="dash-stats">
          {[
            { label: "Total Analyses", value: stats.total, icon: "📊", color: "#63C9D6" },
            { label: "Chest Scans",    value: stats.chest, icon: "🫁", color: "#63C9D6" },
            { label: "Bone Scans",     value: stats.bone,  icon: "🦴", color: "#A78BFA" },
            { label: "Brain MRIs",     value: stats.brain, icon: "🧠", color: "#F472B6" },
          ].map((stat, i) => (
            <div key={i} className="dash-stat-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="dash-stat-top">
                <div className="dash-stat-icon" style={{ background: `${stat.color}18`, border: `1px solid ${stat.color}28` }}>
                  {stat.icon}
                </div>
                <span className="dash-stat-value" style={{ color: stat.color }}>
                  {loading ? "—" : stat.value}
                </span>
              </div>
              <div className="dash-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ───────────────────────────────────── */}
        <div className="dash-charts-row">

          {/* Donut — Scan Distribution */}
          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-title">Scan Distribution</span>
              <span className="dash-card-badge">All time</span>
            </div>
            {loading ? (
              <div className="dash-loading-placeholder" />
            ) : (
              <DonutChart chest={stats.chest} bone={stats.bone} brain={stats.brain} total={stats.total} />
            )}
          </div>

          {/* Confidence chart */}
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header">
              <span className="dash-card-title">Recent Confidence Scores</span>
              <span className="dash-card-badge">Last 10 scans</span>
            </div>
            {loading ? (
              <div className="dash-loading-placeholder" />
            ) : (
              <ConfidenceChart data={chartData} />
            )}
          </div>

          {/* Summary metrics */}
          <div className="dash-card dash-card--narrow">
            <div className="dash-card-header">
              <span className="dash-card-title">Metrics</span>
            </div>
            <div className="dash-metrics">
              <div className="dash-metric-item">
                <div className="dash-metric-val" style={{ color: '#63C9D6' }}>{loading ? '—' : `${avgConf}%`}</div>
                <div className="dash-metric-label">Avg Confidence</div>
              </div>
              <div className="dash-metric-divider" />
              <div className="dash-metric-item">
                <div className="dash-metric-val" style={{ color: '#A78BFA' }}>{loading ? '—' : history.length}</div>
                <div className="dash-metric-label">Total Records</div>
              </div>
              <div className="dash-metric-divider" />
              <div className="dash-metric-item">
                <div className="dash-metric-val" style={{ color: '#F472B6' }}>
                  {loading ? '—' : history.filter(h => h.patient_name).length}
                </div>
                <div className="dash-metric-label">With Patient</div>
              </div>
              <div className="dash-metric-divider" />
              <div className="dash-metric-item">
                <div className="dash-metric-val" style={{ color: '#34D399' }}>
                  {loading ? '—' : history.filter(h => h.heatmap).length}
                </div>
                <div className="dash-metric-label">With Heatmap</div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Activity Heatmap ─────────────────────────────── */}
        <div className="dash-card" style={{ marginBottom: 20 }}>
          <div className="dash-card-header">
            <span className="dash-card-title">Scan Activity</span>
            <span className="dash-card-badge">Last 28 days</span>
          </div>
          {loading ? (
            <div className="dash-loading-placeholder" />
          ) : (
            <>
              <ActivityHeatmap history={history} />
              <div className="heatmap-scale">
                <span className="dash-metric-label">Less</span>
                {[0.1, 0.3, 0.55, 0.75, 1].map((o, i) => (
                  <div key={i} className="heatmap-scale-cell" style={{ background: `rgba(6,182,212,${o})` }} />
                ))}
                <span className="dash-metric-label">More</span>
              </div>
            </>
          )}
        </div>

        {/* ── Bottom Grid ──────────────────────────────────── */}
        <div className="dash-main-grid">

          {/* Recent Activity */}
          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-title">Recent Activity</span>
              <Link to="/history" className="dash-card-link">View All →</Link>
            </div>
            {loading ? (
              <div className="dash-loading-placeholder" />
            ) : recent.length === 0 ? (
              <div className="dash-empty">
                <span className="dash-empty-icon">🩺</span>
                <p>No analyses yet</p>
                <span>Upload a scan to get started</span>
              </div>
            ) : (
              <div className="dash-activity-list">
                {recent.map((item, i) => {
                  const meta = SCAN_META[item.scan_type] || { icon: '🔬', color: '#63C9D6', label: item.scan_type };
                  return (
                    <div key={i} className="dash-activity-row">
                      <div className="dash-activity-icon" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}28` }}>
                        {meta.icon}
                      </div>
                      <div className="dash-activity-info">
                        <span className="dash-activity-type">{meta.label}</span>
                        <span className="dash-activity-result">{item.prediction}</span>
                        {item.patient_name && (
                          <span className="dash-activity-patient">👤 {item.patient_name}</span>
                        )}
                      </div>
                      <div className="dash-activity-right">
                        <span className="dash-activity-conf" style={{ color: meta.color }}>{item.confidence}%</span>
                        <span className="dash-activity-date">{item.created_at}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="dash-right-col">

            {/* Top Findings */}
            <div className="dash-card" style={{ marginBottom: 20 }}>
              <div className="dash-card-header">
                <span className="dash-card-title">Top Findings</span>
                <Link to="/history" className="dash-card-link">History →</Link>
              </div>
              {loading ? (
                <div className="dash-loading-placeholder" />
              ) : topFindings.length === 0 ? (
                <div className="dash-empty" style={{ padding: '16px' }}>
                  <span className="dash-empty-icon" style={{ fontSize: 24 }}>🔬</span>
                  <p>No findings yet</p>
                </div>
              ) : (
                <div className="dash-findings-list">
                  {topFindings.map((f, i) => {
                    const meta = SCAN_META[f.scan_type] || { color: '#63C9D6', icon: '🔬' };
                    const pct  = history.length ? Math.round((f.count / history.length) * 100) : 0;
                    return (
                      <div key={i} className="dash-finding-row">
                        <span className="dash-finding-rank" style={{ color: meta.color }}>#{i + 1}</span>
                        <span className="dash-finding-icon">{meta.icon}</span>
                        <div className="dash-finding-info">
                          <span className="dash-finding-name">{f.prediction}</span>
                          <div className="dash-finding-bar-track">
                            <div
                              className="dash-finding-bar-fill"
                              style={{ width: `${pct}%`, background: meta.color }}
                            />
                          </div>
                        </div>
                        <span className="dash-finding-count" style={{ color: meta.color }}>{f.count}×</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Analysis */}
            <div className="dash-card">
              <div className="dash-card-header">
                <span className="dash-card-title">Quick Analysis</span>
              </div>
              <div className="dash-quick-actions">
                {SCAN_TYPES.map((scan, i) => (
                  <Link key={scan.id} to={scan.path} className="dash-quick-btn" style={{ "--qcolor": scan.color, animationDelay: `${i * 0.06}s` }}>
                    <span className="dash-quick-icon">{scan.icon}</span>
                    <div className="dash-quick-info">
                      <span className="dash-quick-label">{scan.label}</span>
                      <span className="dash-quick-sub">{scan.subtitle}</span>
                    </div>
                    <span className="dash-quick-arrow">→</span>
                  </Link>
                ))}
                <Link to="/chat" className="dash-quick-btn dash-quick-btn--chat" style={{ "--qcolor": "#06B6D4", animationDelay: "0.18s" }}>
                  <span className="dash-quick-icon">💬</span>
                  <div className="dash-quick-info">
                    <span className="dash-quick-label">AI Assistant</span>
                    <span className="dash-quick-sub">Ask the medical chatbot</span>
                  </div>
                  <span className="dash-quick-arrow">→</span>
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export default Dashboard;
