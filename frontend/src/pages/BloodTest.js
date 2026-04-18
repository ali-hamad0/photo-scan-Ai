import { useState } from 'react';
import axios from 'axios';
import './BloodTest.css';

const CBC_FIELDS = [
  { key: 'rbc', label: 'RBC',         unit: 'M/μL', normal: [4.5, 5.9],   placeholder: '4.5 – 5.9'   },
  { key: 'wbc', label: 'WBC',         unit: 'K/μL', normal: [4.5, 11.0],  placeholder: '4.5 – 11.0'  },
  { key: 'hgb', label: 'Hemoglobin',  unit: 'g/dL', normal: [13.5, 17.5], placeholder: '13.5 – 17.5' },
  { key: 'hct', label: 'Hematocrit',  unit: '%',    normal: [41, 53],      placeholder: '41 – 53'     },
  { key: 'mcv', label: 'MCV',         unit: 'fL',   normal: [80, 100],     placeholder: '80 – 100'    },
  { key: 'mch', label: 'MCH',         unit: 'pg',   normal: [27, 33],      placeholder: '27 – 33'     },
  { key: 'plt', label: 'Platelets',   unit: 'K/μL', normal: [150, 400],    placeholder: '150 – 400'   },
  { key: 'neu', label: 'Neutrophils', unit: '%',     normal: [50, 70],      placeholder: '50 – 70'     },
];

function getStatus(key, value, normal) {
  if (!value) return null;
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  if (v < normal[0]) return 'low';
  if (v > normal[1]) return 'high';
  return 'normal';
}

function BloodTest() {
  const [values, setValues]   = useState({});
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (key, val) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const filledCount = Object.values(values).filter(v => v !== '').length;
  const canAnalyze  = filledCount >= 4;

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post('/api/analyze/blood', values);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">

      {/* Header */}
      <div className="page-header">
        <div
          className="page-header-icon"
          style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.26)' }}
        >
          🩸
        </div>
        <div>
          <h1 className="page-title">Blood Test Analysis</h1>
          <p className="page-subtitle">CBC Abnormality Detection</p>
        </div>
      </div>

      <div className="blood-grid">

        {/* Left — Form */}
        <div className="blood-form-box">
          <div className="blood-form-title">Enter CBC Values</div>

          <div className="cbc-grid">
            {CBC_FIELDS.map(field => {
              const status = getStatus(field.key, values[field.key], field.normal);
              return (
                <div key={field.key} className="cbc-field">
                  <div className="cbc-label-row">
                    <span className="cbc-label">{field.label}</span>
                    <span className="cbc-unit">{field.unit}</span>
                  </div>
                  <div className="cbc-input-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className={`cbc-input ${status || ''}`}
                    />
                    {status && (
                      <span className={`cbc-status ${status}`}>
                        {status === 'low' ? '↓' : status === 'high' ? '↑' : '✓'}
                      </span>
                    )}
                  </div>
                  <span className="cbc-normal-range">
                    Normal: {field.normal[0]} – {field.normal[1]}
                  </span>
                </div>
              );
            })}
          </div>

          {error && <div className="blood-error">{error}</div>}

          <button
            className={`blood-analyze-btn ${canAnalyze && !loading ? 'active' : ''}`}
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading}
          >
            {loading ? '🔍 Analyzing...' : '🔍 Analyze Blood Test'}
          </button>
        </div>

        {/* Right — Results */}
        <div>
          {!result && !loading && (
            <div className="blood-empty-result">
              <div className="blood-empty-icon">🩸</div>
              <p>No analysis yet</p>
              <span>Fill at least 4 CBC values to begin</span>
            </div>
          )}

          {loading && (
            <div className="blood-empty-result">
              <div className="blood-empty-icon">⚙️</div>
              <p>Analyzing blood values...</p>
              <span>AI model is processing your data</span>
            </div>
          )}

          {result && (
            <div className="blood-result-box">
              <div className="blood-result-label">AI Diagnosis</div>
              <div className="blood-result-prediction">{result.prediction}</div>

              <div className="blood-confidence-row">
                <span>Confidence</span>
                <span style={{ color: '#FB923C' }}>{result.confidence}%</span>
              </div>
              <div className="blood-confidence-bg">
                <div
                  className="blood-confidence-fill"
                  style={{ width: `${result.confidence}%` }}
                />
              </div>

              <div className="blood-flags-title">CBC Flags</div>
              <div className="blood-flags">
                {CBC_FIELDS.map(field => {
                  const status = getStatus(field.key, values[field.key], field.normal);
                  if (!values[field.key]) return null;
                  return (
                    <div key={field.key} className="blood-flag-row">
                      <span className="blood-flag-name">{field.label}</span>
                      <span className={`blood-flag-value ${status}`}>
                        {values[field.key]} {field.unit}
                        {status === 'low' ? ' ↓' : status === 'high' ? ' ↑' : ' ✓'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="blood-explanation">{result.explanation}</div>

              <div className="blood-disclaimer">
                ⚠️ For clinical reference only. Must be reviewed
                by a licensed medical professional.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default BloodTest;