import { useState } from "react";
import axios from "axios";
import "./ScanPage.css";

function ScanPage({ scanType, title, subtitle, icon, color }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [patientName,   setPatientName]   = useState("");
  const [patientAge,    setPatientAge]    = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientNotes,  setPatientNotes]  = useState("");
  const [showHeatmap,   setShowHeatmap]   = useState(false);

  const handleFileChange = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setShowHeatmap(false);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("scan_type", scanType);
    formData.append("file", file);
    if (patientName)   formData.append("patient_name",   patientName);
    if (patientAge)    formData.append("patient_age",    patientAge);
    if (patientGender) formData.append("patient_gender", patientGender);
    if (patientNotes)  formData.append("patient_notes",  patientNotes);

    try {
      const res = await axios.post(
        "/api/analyze",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      setResult(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Analysis failed. Make sure the model is loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout">
      <div className="page-content">
        {/* Header */}
        <div className="page-header">
          <div
            className="page-header-icon"
            style={{ background: `${color}22`, border: `1px solid ${color}44` }}
          >
            {icon}
          </div>
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="scan-layout">
          {/* Left — Upload */}
          <div className="scan-left">

            {/* Patient Info */}
            <div className="scan-box" style={{ marginBottom: '1rem' }}>
              <h3 className="scan-box-title">Patient Information</h3>
              <div className="patient-form">
                <div className="patient-row">
                  <div className="patient-field">
                    <label className="patient-label">Full Name</label>
                    <input
                      type="text"
                      className="patient-input"
                      placeholder="e.g. John Doe"
                      value={patientName}
                      onChange={e => setPatientName(e.target.value)}
                    />
                  </div>
                  <div className="patient-field patient-field--sm">
                    <label className="patient-label">Age</label>
                    <input
                      type="number"
                      className="patient-input"
                      placeholder="e.g. 45"
                      min="0"
                      max="120"
                      value={patientAge}
                      onChange={e => setPatientAge(e.target.value)}
                    />
                  </div>
                  <div className="patient-field patient-field--sm">
                    <label className="patient-label">Gender</label>
                    <select
                      className="patient-input"
                      value={patientGender}
                      onChange={e => setPatientGender(e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="patient-field">
                  <label className="patient-label">Clinical Notes (optional)</label>
                  <textarea
                    className="patient-input patient-textarea"
                    placeholder="Symptoms, history, referral reason..."
                    rows={3}
                    value={patientNotes}
                    onChange={e => setPatientNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="scan-box">
              <div className="scan-box-title-row">
                <h3 className="scan-box-title">Upload Image</h3>
                {result?.heatmap && (
                  <div className="heatmap-toggle">
                    <button
                      className={`heatmap-tab ${!showHeatmap ? 'active' : ''}`}
                      onClick={() => setShowHeatmap(false)}
                    >
                      Original
                    </button>
                    <button
                      className={`heatmap-tab ${showHeatmap ? 'active' : ''}`}
                      onClick={() => setShowHeatmap(true)}
                    >
                      🔥 AI Heatmap
                    </button>
                  </div>
                )}
              </div>

              {/* Drop Zone */}
              <div
                className="drop-zone"
                style={{ borderColor: file ? color : undefined }}
                onClick={() => !result?.heatmap && document.getElementById("scanFile").click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileChange(e.dataTransfer.files[0]);
                }}
              >
                <input
                  id="scanFile"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
                {showHeatmap && result?.heatmap ? (
                  <div className="heatmap-wrapper">
                    <img
                      src={`data:image/jpeg;base64,${result.heatmap}`}
                      alt="Grad-CAM heatmap"
                      className="image-preview"
                    />
                    <div className="heatmap-legend">
                      <span className="legend-label">Low</span>
                      <div className="legend-bar" />
                      <span className="legend-label">High</span>
                    </div>
                  </div>
                ) : preview ? (
                  <img src={preview} alt="preview" className="image-preview" />
                ) : (
                  <div className="drop-zone-empty">
                    <div className="drop-icon">📤</div>
                    <p>Drop image here or click to browse</p>
                    <span>JPEG · PNG · up to 50MB</span>
                  </div>
                )}
              </div>

              {file && (
                <div className="file-info">
                  ✅ {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}

              {error && <div className="scan-error">{error}</div>}

              <button
                className="analyze-btn"
                style={{ background: file && !loading ? color : undefined }}
                onClick={handleAnalyze}
                disabled={!file || loading}
              >
                {loading ? "🔍 Analyzing..." : "🔍 Run AI Analysis"}
              </button>
            </div>
          </div>

          {/* Right — Results */}
          <div className="scan-right">
            {!result && !loading && (
              <div className="empty-result">
                <div className="empty-icon">🩺</div>
                <p>No analysis yet</p>
                <span>Upload an image and run analysis to see results</span>
              </div>
            )}

            {loading && (
              <div className="empty-result">
                <div className="empty-icon spin">⚙️</div>
                <p>Analyzing image...</p>
                <span>AI model is processing your scan</span>
              </div>
            )}

            {result && (
              <div className="result-box">
                <div className="result-label">AI Diagnosis</div>
                <div className="result-prediction" style={{ color }}>
                  {result.prediction}
                </div>

                <div className="result-confidence-row">
                  <span>Confidence</span>
                  <span style={{ color }}>{result.confidence}%</span>
                </div>
                <div className="confidence-bar-bg">
                  <div
                    className="confidence-bar-fill"
                    style={{
                      width: `${result.confidence}%`,
                      background: color,
                    }}
                  />
                </div>

                <div className="result-explanation">{result.explanation}</div>

                {result.heatmap && (
                  <div className="heatmap-hint">
                    🔥 Grad-CAM heatmap available — toggle <strong>AI Heatmap</strong> on the image to see which regions influenced this diagnosis.
                  </div>
                )}

                <div className="result-disclaimer">
                  ⚠️ For clinical reference only. Must be reviewed by a licensed
                  medical professional.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanPage;
