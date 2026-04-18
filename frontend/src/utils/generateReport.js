import { jsPDF } from 'jspdf';

const SCAN_LABELS = {
  chest_xray: 'Chest X-Ray',
  bone_xray:  'Bone X-Ray',
  brain_mri:  'Brain MRI',
};

const COLOR = {
  teal:     [6,  182, 212],
  dark:     [15,  23,  42],
  mid:      [71,  85, 105],
  light:    [148, 163, 184],
  white:    [255, 255, 255],
  red:      [239,  68,  68],
  border:   [30,  41,  59],
};

function hex(r, g, b) { return [r, g, b]; }

export function generateReport(item) {
  const doc   = new jsPDF({ unit: 'pt', format: 'a4' });
  const W     = doc.internal.pageSize.getWidth();
  const H     = doc.internal.pageSize.getHeight();
  const PX    = 48;   // horizontal padding
  const inner = W - PX * 2;
  let   y     = 0;

  // ── Background ───────────────────────────────────────────
  doc.setFillColor(...COLOR.dark);
  doc.rect(0, 0, W, H, 'F');

  // ── Header bar ───────────────────────────────────────────
  doc.setFillColor(...COLOR.teal);
  doc.rect(0, 0, W, 72, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR.white);
  doc.text('PathoScan AI', PX, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 240, 245);
  doc.text('Medical Diagnostic Report', PX, 52);

  const dateStr = item.created_at || new Date().toLocaleDateString();
  doc.setTextColor(...COLOR.white);
  doc.text(dateStr, W - PX, 36, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(200, 240, 245);
  doc.text(SCAN_LABELS[item.scan_type] || item.scan_type, W - PX, 52, { align: 'right' });

  y = 104;

  // ── Section helper ───────────────────────────────────────
  function sectionTitle(label) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.teal);
    doc.text(label.toUpperCase(), PX, y);
    y += 4;
    doc.setDrawColor(...COLOR.teal);
    doc.setLineWidth(0.5);
    doc.line(PX, y, W - PX, y);
    y += 14;
  }

  function field(label, value, x, colW) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.light);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLOR.white);
    doc.text(value || '—', x, y + 14);
  }

  // ── Patient Information ───────────────────────────────────
  sectionTitle('Patient Information');

  const colW = inner / 3;
  field('FULL NAME',  item.patient_name   || '—',        PX,           colW);
  field('AGE',        item.patient_age    ? String(item.patient_age) : '—', PX + colW,    colW);
  field('GENDER',     item.patient_gender || '—',        PX + colW * 2, colW);
  y += 36;

  // Clinical notes
  if (item.patient_notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.light);
    doc.text('CLINICAL NOTES', PX, y);
    y += 10;
    doc.setFillColor(22, 35, 56);
    const noteLines = doc.splitTextToSize(item.patient_notes, inner - 16);
    const noteH     = noteLines.length * 13 + 14;
    doc.roundedRect(PX, y, inner, noteH, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR.white);
    doc.text(noteLines, PX + 10, y + 14);
    y += noteH + 20;
  } else {
    y += 8;
  }

  // ── AI Diagnosis ─────────────────────────────────────────
  sectionTitle('AI Diagnosis');

  // Prediction box
  doc.setFillColor(6, 50, 60);
  doc.roundedRect(PX, y, inner, 52, 6, 6, 'F');
  doc.setDrawColor(...COLOR.teal);
  doc.setLineWidth(1);
  doc.roundedRect(PX, y, inner, 52, 6, 6, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLOR.teal);
  doc.text(item.prediction || '—', PX + 16, y + 26);

  // Confidence badge
  const conf     = item.confidence ?? 0;
  const badgeW   = 80;
  const badgeX   = W - PX - badgeW - 8;
  doc.setFillColor(...COLOR.teal);
  doc.roundedRect(badgeX, y + 12, badgeW, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR.dark);
  doc.text(`${conf}%`, badgeX + badgeW / 2, y + 31, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.light);
  doc.text('CONFIDENCE', badgeX + badgeW / 2, y + 44, { align: 'center' });
  y += 68;

  // Confidence bar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.light);
  doc.text('Confidence Level', PX, y);
  y += 10;
  doc.setFillColor(...COLOR.border);
  doc.roundedRect(PX, y, inner, 8, 4, 4, 'F');
  doc.setFillColor(...COLOR.teal);
  doc.roundedRect(PX, y, inner * (conf / 100), 8, 4, 4, 'F');
  y += 24;

  // ── Explanation ──────────────────────────────────────────
  if (item.explanation) {
    sectionTitle('Analysis & Explanation');
    const lines  = doc.splitTextToSize(item.explanation, inner - 16);
    const boxH   = lines.length * 13 + 18;
    doc.setFillColor(20, 30, 48);
    doc.roundedRect(PX, y, inner, boxH, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 215, 230);
    doc.text(lines, PX + 10, y + 14);
    y += boxH + 20;
  }

  // ── Disclaimer ───────────────────────────────────────────
  const disclaimerY = H - 56;
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.5);
  doc.line(PX, disclaimerY - 10, W - PX, disclaimerY - 10);

  doc.setFillColor(50, 30, 20);
  doc.roundedRect(PX, disclaimerY - 4, inner, 36, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(251, 146, 60);
  doc.text('⚠  DISCLAIMER', PX + 10, disclaimerY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 180, 160);
  doc.text(
    'For clinical reference only. This AI-generated report must be reviewed and validated by a licensed medical professional.',
    PX + 10, disclaimerY + 20
  );

  // ── Page 2: Grad-CAM Heatmap ─────────────────────────────
  if (item.heatmap) {
    doc.addPage();

    // Background
    doc.setFillColor(...COLOR.dark);
    doc.rect(0, 0, W, H, 'F');

    // Header bar
    doc.setFillColor(...COLOR.teal);
    doc.rect(0, 0, W, 72, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...COLOR.white);
    doc.text('PathoScan AI', PX, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 240, 245);
    doc.text('Grad-CAM Heatmap Analysis', PX, 52);

    doc.setTextColor(...COLOR.white);
    doc.text(item.created_at || '', W - PX, 36, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(200, 240, 245);
    doc.text(SCAN_LABELS[item.scan_type] || item.scan_type, W - PX, 52, { align: 'right' });

    let py = 100;

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.teal);
    doc.text('AI ATTENTION MAP (GRAD-CAM)', PX, py);
    py += 4;
    doc.setDrawColor(...COLOR.teal);
    doc.setLineWidth(0.5);
    doc.line(PX, py, W - PX, py);
    py += 14;

    // Explanatory text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR.light);
    const desc = 'The heatmap below shows which regions of the scan the AI model focused on when making its diagnosis. Red/warm areas indicate high attention; blue/cool areas indicate low attention.';
    const descLines = doc.splitTextToSize(desc, inner);
    doc.text(descLines, PX, py);
    py += descLines.length * 13 + 14;

    // Heatmap image — centered, max 380pt wide to keep aspect ratio
    const imgSize = Math.min(inner, 380);
    const imgX    = PX + (inner - imgSize) / 2;
    doc.addImage(
      `data:image/jpeg;base64,${item.heatmap}`,
      'JPEG',
      imgX, py,
      imgSize, imgSize
    );
    py += imgSize + 16;

    // Color legend bar
    const legendW  = 200;
    const legendX  = PX + (inner - legendW) / 2;
    const legendH  = 10;

    // Draw gradient manually using thin rects (blue→cyan→green→yellow→red)
    const stops = [
      [0,   0,   255],
      [0,   255, 255],
      [0,   255, 0  ],
      [255, 255, 0  ],
      [255, 0,   0  ],
    ];
    const segW = legendW / (stops.length - 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const [r1, g1, b1] = stops[i];
      const [r2, g2, b2] = stops[i + 1];
      const steps = 20;
      for (let s = 0; s < steps; s++) {
        const t  = s / steps;
        const r  = Math.round(r1 + (r2 - r1) * t);
        const g  = Math.round(g1 + (g2 - g1) * t);
        const b  = Math.round(b1 + (b2 - b1) * t);
        const sx = legendX + i * segW + s * (segW / steps);
        doc.setFillColor(r, g, b);
        doc.rect(sx, py, segW / steps + 0.5, legendH, 'F');
      }
    }

    // Legend labels
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.light);
    doc.text('Low Attention', legendX, py + legendH + 11, { align: 'left' });
    doc.text('High Attention', legendX + legendW, py + legendH + 11, { align: 'right' });
    py += legendH + 28;

    // Diagnosis reminder
    doc.setFillColor(6, 50, 60);
    doc.roundedRect(PX, py, inner, 44, 6, 6, 'F');
    doc.setDrawColor(...COLOR.teal);
    doc.setLineWidth(1);
    doc.roundedRect(PX, py, inner, 44, 6, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.light);
    doc.text('DIAGNOSIS', PX + 16, py + 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLOR.teal);
    doc.text(item.prediction || '—', PX + 16, py + 32);

    const conf2   = item.confidence ?? 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLOR.white);
    doc.text(`${conf2}%`, W - PX - 16, py + 32, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.light);
    doc.text('CONFIDENCE', W - PX - 16, py + 14, { align: 'right' });
    py += 60;

    // Disclaimer
    const d2Y = H - 56;
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.5);
    doc.line(PX, d2Y - 10, W - PX, d2Y - 10);
    doc.setFillColor(50, 30, 20);
    doc.roundedRect(PX, d2Y - 4, inner, 36, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(251, 146, 60);
    doc.text('⚠  DISCLAIMER', PX + 10, d2Y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 180, 160);
    doc.text(
      'For clinical reference only. This AI-generated report must be reviewed and validated by a licensed medical professional.',
      PX + 10, d2Y + 20
    );
  }

  // ── Save ─────────────────────────────────────────────────
  const filename = `PathoScan_${item.patient_name ? item.patient_name.replace(/\s+/g, '_') : 'Report'}_${Date.now()}.pdf`;
  doc.save(filename);
}
