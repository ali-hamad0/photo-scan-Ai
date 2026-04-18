import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { generateReport } from '../utils/generateReport';
import './Patients.css';

const SCAN_LABELS = {
  chest_xray: { label: 'Chest X-Ray', icon: '🫁', color: '#63C9D6' },
  bone_xray:  { label: 'Bone X-Ray',  icon: '🦴', color: '#A78BFA' },
  brain_mri:  { label: 'Brain MRI',   icon: '🧠', color: '#F472B6' },
};

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function PatientCard({ patient, onSelect }) {
  const initials = patient.patient_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="patient-card" onClick={() => onSelect(patient)}>
      <div className="patient-card-avatar">{initials}</div>
      <div className="patient-card-info">
        <div className="patient-card-name">{patient.patient_name}</div>
        <div className="patient-card-meta">
          {patient.patient_age ? `${patient.patient_age} yrs` : '—'}
          {patient.patient_gender ? ` · ${patient.patient_gender}` : ''}
        </div>
        <div className="patient-card-types">
          {patient.scan_types.map(t => {
            const m = SCAN_LABELS[t] || { icon: '🔬', color: '#63C9D6' };
            return (
              <span key={t} className="patient-type-badge" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}12` }}>
                {m.icon}
              </span>
            );
          })}
        </div>
      </div>
      <div className="patient-card-stats">
        <div className="patient-stat-num">{patient.scan_count}</div>
        <div className="patient-stat-label">scans</div>
        <div className="patient-stat-date">{patient.last_scan}</div>
      </div>
    </div>
  );
}

function PatientModal({ patient, onClose }) {
  if (!patient) return null;
  const initials = patient.patient_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pt-modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Patient header */}
        <div className="pt-modal-header">
          <div className="pt-modal-avatar">{initials}</div>
          <div>
            <div className="pt-modal-name">{patient.patient_name}</div>
            <div className="pt-modal-meta">
              {patient.patient_age ? `${patient.patient_age} years old` : ''}
              {patient.patient_gender ? ` · ${patient.patient_gender}` : ''}
            </div>
          </div>
          <div className="pt-modal-badge">{patient.scan_count} scans</div>
        </div>

        <div className="pt-modal-section-title">Scan History</div>

        <div className="pt-scans-list">
          {patient.scans.map((scan, i) => {
            const meta = SCAN_LABELS[scan.scan_type] || { label: scan.scan_type, icon: '🔬', color: '#63C9D6' };
            const fullItem = { ...scan, patient_name: patient.patient_name, patient_age: patient.patient_age, patient_gender: patient.patient_gender };
            return (
              <div key={scan.result_id ?? i} className="pt-scan-row">
                <div className="pt-scan-chip" style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}28`, color: meta.color }}>
                  {meta.icon} {meta.label}
                </div>
                <div className="pt-scan-middle">
                  <div className="pt-scan-prediction">{scan.prediction}</div>
                  <div className="pt-scan-date">{scan.created_at}</div>
                </div>
                <div className="pt-scan-right">
                  <div className="pt-scan-conf-row">
                    <div className="pt-scan-conf-bar-bg">
                      <div className="pt-scan-conf-bar-fill" style={{ width: `${scan.confidence}%`, background: meta.color }} />
                    </div>
                    <span className="pt-scan-conf-val" style={{ color: meta.color }}>{scan.confidence}%</span>
                  </div>
                  <button
                    className="pt-scan-pdf-btn"
                    title="Download PDF"
                    onClick={() => generateReport(fullItem)}
                  >
                    ⬇ PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Patients() {
  const [patients,  setPatients]  = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    axios.get('/api/patients', { headers: authHeaders() })
      .then(res => {
        setPatients(res.data.patients ?? []);
        setFiltered(res.data.patients ?? []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(patients); return; }
    setFiltered(patients.filter(p =>
      p.patient_name.toLowerCase().includes(q) ||
      (p.patient_gender || '').toLowerCase().includes(q)
    ));
  }, [search, patients]);

  return (
    <>
      <Navbar title="Patients" subtitle="All registered patients and their scans" />

      <div className="page-content">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-icon" style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.26)' }}>
            👥
          </div>
          <div>
            <h1 className="page-title">Patient Management</h1>
            <p className="page-subtitle">{patients.length} registered patients</p>
          </div>
        </div>

        {/* Search */}
        <div className="patients-search-row">
          <input
            className="history-search"
            type="text"
            placeholder="Search by name or gender..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="history-empty">
            <div className="history-empty-icon">⏳</div>
            <p>Loading patients...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">👥</div>
            <p>{search ? 'No patients match your search' : 'No patients yet'}</p>
            <span>Patient info is recorded when you upload a scan</span>
          </div>
        ) : (
          <div className="patients-list">
            {filtered.map((p, i) => (
              <PatientCard key={p.patient_name + i} patient={p} onSelect={setSelected} />
            ))}
          </div>
        )}

      </div>

      <PatientModal patient={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default Patients;
