/**
 * PDF Report Generation Service
 *
 * Generates a formatted clinical report as HTML, which can be printed
 * or saved as PDF using expo-print. Matches the dark glassmorphism theme.
 */

import type { PatientInput, PredictionResult } from "@/lib/types";
import { CLINICAL_REFERENCES } from "@/lib/types";
import { validateAllFields } from "./validation";

/**
 * Generate an HTML string for the clinical report PDF.
 * Uses a clean, professional layout suitable for printing.
 */
export function generateReportHTML(
  input: PatientInput,
  result: PredictionResult
): string {
  const pct = (result.probability * 100).toFixed(1);
  const ciLow = (result.ciLower * 100).toFixed(1);
  const ciHigh = (result.ciUpper * 100).toFixed(1);
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const riskColor =
    result.riskCategory === "Low Risk"
      ? "#22C55E"
      : result.riskCategory === "Moderate Risk"
        ? "#F59E0B"
        : "#EF4444";

  const cpColor =
    result.childPughClass === "A"
      ? "#22C55E"
      : result.childPughClass === "B"
        ? "#F59E0B"
        : "#EF4444";

  // Get validation warnings
  const warnings = validateAllFields(input as unknown as Record<string, number | string>);
  const warningRows = warnings
    .map(
      (w) =>
        `<tr>
          <td style="color:${w.severity === "critical" ? "#EF4444" : "#F59E0B"};font-weight:600;">
            ${w.severity === "critical" ? "⚠ CRITICAL" : "⚡ WARNING"}
          </td>
          <td>${w.key.replace(/_/g, " ").toUpperCase()}</td>
          <td>${w.value}</td>
          <td style="font-size:11px;">${w.message}</td>
        </tr>`
    )
    .join("\n");

  const refsHTML = CLINICAL_REFERENCES.map(
    (ref, i) => `<p style="font-size:10px;color:#666;margin:2px 0;">[${i + 1}] ${ref}</p>`
  ).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { margin: 20mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      font-size: 12px;
      line-height: 1.5;
      padding: 0;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0a7ea4;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 20px;
      color: #0a7ea4;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
    .header .subtitle {
      font-size: 11px;
      color: #666;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 10px;
      color: #92400E;
      text-align: center;
      font-weight: 600;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0a7ea4;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th, td {
      padding: 5px 8px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
      font-size: 11px;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #374151;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .result-box {
      background: #f0f9ff;
      border: 2px solid #0a7ea4;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin-bottom: 16px;
    }
    .result-box .probability {
      font-size: 36px;
      font-weight: 700;
      color: ${riskColor};
    }
    .result-box .risk-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      color: white;
      background: ${riskColor};
      margin-top: 6px;
    }
    .scores-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .score-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .score-card .label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .score-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 4px 0;
    }
    .score-card .sub {
      font-size: 10px;
      color: #888;
    }
    .cp-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      background: ${cpColor};
    }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #999;
      text-align: center;
    }
    .two-col { display: flex; gap: 12px; }
    .two-col > div { flex: 1; }
    .warning-table tr td:first-child { width: 80px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVB PROGNOSIS REPORT</h1>
    <div class="subtitle">
      Esophageal Variceal Bleeding — 1-Year Mortality Risk Assessment<br>
      Generated: ${timestamp} | Calculator v2.0
    </div>
  </div>

  <div class="disclaimer">
    ⚠ FOR RESEARCH AND EDUCATIONAL PURPOSES ONLY — NOT INTENDED AS MEDICAL ADVICE ⚠
  </div>

  <!-- ML Model Results -->
  <div class="result-box">
    <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">
      ML Model — 1-Year Mortality Probability
    </div>
    <div class="probability">${pct}%</div>
    <div style="font-size:11px;color:#666;">95% CI: ${ciLow}% – ${ciHigh}%</div>
    <div>
      <span class="risk-badge">${result.riskCategory.toUpperCase()}</span>
    </div>
    <div style="font-size:11px;color:#666;margin-top:6px;">
      Prediction: ${result.prediction === 1 ? "Death" : "Survival"}
    </div>
  </div>

  <!-- Traditional Scores -->
  <div class="scores-grid">
    <div class="score-card">
      <div class="label">MELD Score</div>
      <div class="value">${result.meld}</div>
      <div class="sub">${result.meldMortality}</div>
    </div>
    <div class="score-card">
      <div class="label">MELD-Na Score</div>
      <div class="value">${result.meldNa}</div>
      <div class="sub">Sodium-adjusted</div>
    </div>
    <div class="score-card">
      <div class="label">Child-Pugh</div>
      <div class="value">${result.childPughScore}</div>
      <div class="sub"><span class="cp-badge">Class ${result.childPughClass}</span></div>
    </div>
  </div>

  <!-- Patient Data -->
  <div class="section">
    <div class="section-title">Patient Data</div>
    <div class="two-col">
      <div>
        <table>
          <tr><th colspan="2">Demographics & Clinical Status</th></tr>
          <tr><td>Age</td><td>${input.age} years</td></tr>
          <tr><td>Sex</td><td>${input.sex}</td></tr>
          <tr><td>Race</td><td>${input.race}</td></tr>
          <tr><td>Etiology</td><td>${input.etiology_cirrosis}</td></tr>
          <tr><td>Ascites</td><td>${input.ascitis}</td></tr>
          <tr><td>Hepatorenal Syndrome</td><td>${input.hepatorenal_syndrome}</td></tr>
          <tr><td>Hepatocellular Carcinoma</td><td>${input.hepatocellular_carcinoma}</td></tr>
          <tr><td>Portal Vein Thrombosis</td><td>${input.portal_vein_thrombosis}</td></tr>
          <tr><td>Active Bleeding</td><td>${input.active_bleeding}</td></tr>
          <tr><td>Varices</td><td>${input.varices}</td></tr>
          <tr><td>Red Wale Marks</td><td>${input.red_wale_marks}</td></tr>
          <tr><td>Rupture Point</td><td>${input.rupture_point}</td></tr>
          <tr><td>Therapy</td><td>${input.therapy}</td></tr>
          <tr><td>Rebleeding</td><td>${input.rebleeding}</td></tr>
          <tr><td>Time to Endoscopy</td><td>${input.time_to_endoscophy_hours} hours</td></tr>
          <tr><td>Terlipressin Dose</td><td>${input.terlipressin_dose} mg</td></tr>
          <tr><td>Omeprazole</td><td>${input.omeprazole}</td></tr>
          <tr><td>Spironolactone</td><td>${input.spironolactone}</td></tr>
          <tr><td>Furosemide</td><td>${input.furosemide}</td></tr>
          <tr><td>Propranolol</td><td>${input.propanolol}</td></tr>
          <tr><td>Dialysis</td><td>${input.dialisis}</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><th colspan="2">Laboratory Values</th></tr>
          <tr><td>Albumin</td><td>${input.albumin} g/dL</td></tr>
          <tr><td>Total Bilirubin</td><td>${input.total_bilirrubin} mg/dL</td></tr>
          <tr><td>Direct Bilirubin</td><td>${input.direct_bilirrubina} mg/dL</td></tr>
          <tr><td>INR</td><td>${input.inr}</td></tr>
          <tr><td>Creatinine</td><td>${input.creatinine} mg/dL</td></tr>
          <tr><td>Platelets</td><td>${input.platelets} ×10³/μL</td></tr>
          <tr><td>Hemoglobin</td><td>${input.hemoglobin} g/dL</td></tr>
          <tr><td>Hematocrit</td><td>${input.hematocrit}%</td></tr>
          <tr><td>Leukocytes</td><td>${input.leucocytes} ×10³/μL</td></tr>
          <tr><td>AST</td><td>${input.ast} U/L</td></tr>
          <tr><td>ALT</td><td>${input.alt} U/L</td></tr>
          <tr><td>Sodium</td><td>${input.sodium} mEq/L</td></tr>
          <tr><td>Potassium</td><td>${input.potassium} mEq/L</td></tr>
        </table>
      </div>
    </div>
  </div>

  ${
    warnings.length > 0
      ? `
  <!-- Validation Warnings -->
  <div class="section">
    <div class="section-title">⚠ Validation Alerts</div>
    <table class="warning-table">
      <tr><th>Severity</th><th>Parameter</th><th>Value</th><th>Note</th></tr>
      ${warningRows}
    </table>
  </div>`
      : ""
  }

  <!-- Model Comparison -->
  <div class="section">
    <div class="section-title">Model Performance Comparison (AUC-ROC)</div>
    <table>
      <tr><th>Model</th><th>AUC-ROC</th><th>Notes</th></tr>
      <tr><td>Random Forest (ML)</td><td style="font-weight:700;color:#0a7ea4;">0.85</td><td>Calibrated ensemble model</td></tr>
      <tr><td>MELD</td><td>0.71</td><td>Model for End-Stage Liver Disease</td></tr>
      <tr><td>MELD-Na</td><td>0.73</td><td>Sodium-adjusted MELD</td></tr>
      <tr><td>Child-Pugh</td><td>0.65</td><td>Child-Pugh Classification</td></tr>
    </table>
  </div>

  <!-- References -->
  <div class="section">
    <div class="section-title">References</div>
    ${refsHTML}
  </div>

  <div class="footer">
    EVB Prognosis Calculator v2.0 — Calibrated Random Forest Model<br>
    This report is auto-generated for research/educational purposes only.
  </div>
</body>
</html>`;
}
