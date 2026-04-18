import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { generateReport } from '../utils/generateReport';
import './History.css';

const SCAN_LABELS = {
  chest_xray: { label: 'Chest X-Ray', icon: '🫁', color: '#63C9D6' },
  bone_xray:  { label: 'Bone X-Ray',  icon: '🦴', color: '#A78BFA' },
  brain_mri:  { label: 'Brain MRI',   icon: '🧠', color: '#F472B6' },
};

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function History() {
  const [history,  setHistory]  = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);   // detail modal
  const [editItem, setEditItem] = useState(null);   // edit modal
  const [editForm, setEditForm] = useState({});
  const [deleteId, setDeleteId] = useState(null);   // confirm modal

  useEffect(() => {
    axios.get('/api/history?page=1&page_size=100', { headers: authHeaders() })
      .then(res => {
        setHistory(res.data.history ?? []);
        setFiltered(res.data.history ?? []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let data = history;
    if (filter !== 'all') data = data.filter(h => h.scan_type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(h =>
        h.prediction.toLowerCase().includes(q) ||
        h.scan_type.toLowerCase().includes(q)
      );
    }
    setFiltered(data);
  }, [search, filter, history]);

  // ── Delete ─────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`/api/history/${deleteId}`, { headers: authHeaders() });
      setHistory(prev => prev.filter(h => h.result_id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete record. Please try again.');
    }
  };

  // ── Edit ───────────────────────────────────────────
  const openEdit = (item, e) => {
    e.stopPropagation();
    setEditItem(item);
    setEditForm({
      patient_name:   item.patient_name   ?? '',
      patient_age:    item.patient_age    ?? '',
      patient_gender: item.patient_gender ?? '',
      patient_notes:  item.patient_notes  ?? '',
    });
  };

  const handleEditSave = async () => {
    const payload = {
      patient_name:   editForm.patient_name   || null,
      patient_age:    editForm.patient_age !== '' ? parseInt(editForm.patient_age, 10) : null,
      patient_gender: editForm.patient_gender || null,
      patient_notes:  editForm.patient_notes  || null,
    };
    await axios.patch(
      `/api/history/${editItem.result_id}`,
      payload,
      { headers: authHeaders() }
    );
    setHistory(prev => prev.map(h =>
      h.result_id === editItem.result_id ? { ...h, ...payload } : h
    ));
    setEditItem(null);
  };

  return (
    <>
      <Navbar title="History" subtitle="All past diagnoses and results" />

      <div className="page-content">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'rgba(6,182,212,0.12)',
            border: '1px solid rgba(6,182,212,0.26)',
          }}>
            📋
          </div>
          <div>
            <h1 className="page-title">Analysis History</h1>
            <p className="page-subtitle">All past diagnoses and results</p>
          </div>
        </div>

        {/* Filters */}
        <div className="history-filters">
          <input
            className="history-search"
            type="text"
            placeholder="Search by result or scan type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="history-filter-btns">
            {['all', 'chest_xray', 'bone_xray', 'brain_mri'].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all'
                  ? 'All'
                  : `${SCAN_LABELS[f]?.icon} ${SCAN_LABELS[f]?.label}`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="history-table-wrapper">
          {loading ? (
            <div className="history-empty">
              <div className="history-empty-icon">⏳</div>
              <p>Loading history...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">📋</div>
              <p>No analyses found</p>
              <span>Upload a scan to see results here</span>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Scan Type</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const meta = SCAN_LABELS[item.scan_type] || {
                    label: item.scan_type, icon: '🔬', color: '#63C9D6',
                  };
                  return (
                    <tr
                      key={item.result_id ?? i}
                      className="history-row-clickable"
                      onClick={() => setSelected(item)}
                    >
                      <td>
                        <div className="history-scan-chip" style={{
                          background: `${meta.color}14`,
                          border: `1px solid ${meta.color}28`,
                          color: meta.color,
                        }}>
                          {meta.icon} {meta.label}
                        </div>
                      </td>
                      <td className="history-result">{item.prediction}</td>
                      <td>
                        <div className="history-conf-row">
                          <div className="history-conf-bar-bg">
                            <div
                              className="history-conf-bar-fill"
                              style={{ width: `${item.confidence}%`, background: meta.color }}
                            />
                          </div>
                          <span className="history-conf-val" style={{ color: meta.color }}>
                            {item.confidence}%
                          </span>
                        </div>
                      </td>
                      <td className="history-date">
                        {item.patient_name
                          ? <span className="history-patient-badge">{item.patient_name}</span>
                          : <span className="history-no-patient">—</span>}
                      </td>
                      <td className="history-date">{item.created_at}</td>
                      <td className="history-actions-cell" onClick={e => e.stopPropagation()}>
                        <button
                          className="row-btn row-btn--edit"
                          title="Edit patient info"
                          onClick={e => openEdit(item, e)}
                        >
                          ✏️
                        </button>
                        <button
                          className="row-btn row-btn--delete"
                          title="Delete record"
                          onClick={e => { e.stopPropagation(); setDeleteId(item.result_id); }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ── Detail Modal ─────────────────────────────── */}
      {selected && (() => {
        const meta = SCAN_LABELS[selected.scan_type] || { label: selected.scan_type, icon: '🔬', color: '#63C9D6' };
        return (
          <div className="modal-backdrop" onClick={() => setSelected(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>

              <div className="modal-header">
                <div className="modal-scan-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                  {meta.icon} {meta.label}
                </div>
                <span className="modal-date">{selected.created_at}</span>
              </div>

              <div className="modal-section-title">Patient</div>
              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <span className="modal-info-label">Name</span>
                  <span className="modal-info-value">{selected.patient_name || '—'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Age</span>
                  <span className="modal-info-value">{selected.patient_age ?? '—'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Gender</span>
                  <span className="modal-info-value">{selected.patient_gender || '—'}</span>
                </div>
              </div>

              {selected.patient_notes && (
                <>
                  <div className="modal-section-title">Clinical Notes</div>
                  <div className="modal-notes">{selected.patient_notes}</div>
                </>
              )}

              <div className="modal-section-title">AI Diagnosis</div>
              <div className="modal-prediction" style={{ color: meta.color }}>{selected.prediction}</div>
              <div className="modal-conf-row">
                <span>Confidence</span>
                <span style={{ color: meta.color }}>{selected.confidence}%</span>
              </div>
              <div className="modal-conf-bar-bg">
                <div className="modal-conf-bar-fill" style={{ width: `${selected.confidence}%`, background: meta.color }} />
              </div>

              {selected.explanation && (
                <div className="modal-explanation">{selected.explanation}</div>
              )}

              <button
                className="report-download-btn"
                onClick={() => generateReport(selected)}
              >
                ⬇ Download PDF Report
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Modal ───────────────────────────────── */}
      {editItem && (
        <div className="modal-backdrop" onClick={() => setEditItem(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditItem(null)}>✕</button>
            <div className="modal-title">Edit Patient Info</div>

            <div className="edit-form">
              <div className="edit-row">
                <div className="edit-field">
                  <label className="edit-label">Full Name</label>
                  <input
                    type="text"
                    className="edit-input"
                    placeholder="e.g. John Doe"
                    value={editForm.patient_name}
                    onChange={e => setEditForm(f => ({ ...f, patient_name: e.target.value }))}
                  />
                </div>
                <div className="edit-field edit-field--sm">
                  <label className="edit-label">Age</label>
                  <input
                    type="number"
                    className="edit-input"
                    placeholder="45"
                    min="0"
                    max="120"
                    value={editForm.patient_age}
                    onChange={e => setEditForm(f => ({ ...f, patient_age: e.target.value }))}
                  />
                </div>
                <div className="edit-field edit-field--sm">
                  <label className="edit-label">Gender</label>
                  <select
                    className="edit-input"
                    value={editForm.patient_gender}
                    onChange={e => setEditForm(f => ({ ...f, patient_gender: e.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="edit-field">
                <label className="edit-label">Clinical Notes</label>
                <textarea
                  className="edit-input edit-textarea"
                  rows={3}
                  placeholder="Symptoms, history..."
                  value={editForm.patient_notes}
                  onChange={e => setEditForm(f => ({ ...f, patient_notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="edit-actions">
              <button className="edit-btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="edit-btn-save" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────── */}
      {deleteId !== null && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal-card modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="delete-icon">🗑️</div>
            <div className="delete-title">Delete Record?</div>
            <div className="delete-subtitle">This action cannot be undone.</div>
            <div className="edit-actions">
              <button className="edit-btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="edit-btn-delete" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

export default History;
