import type { PatientInput, PredictionResult, RiskCategory } from "../types";

/**
 * Calculate MELD score — matches app.py calculate_meld exactly
 */
export function calculateMELD(
  bilirubin: number,
  inr: number,
  creatinine: number
): number {
  const b = Math.max(bilirubin, 1.0);
  const i = Math.max(inr, 1.0);
  const c = Math.max(creatinine, 1.0);

  const meld = 3.78 * Math.log(b) + 11.2 * Math.log(i) + 9.57 * Math.log(c) + 6.43;
  return Math.round(Math.max(6, Math.min(40, meld)));
}

/**
 * Calculate MELD-Na score — matches app.py calculate_meld_na exactly
 */
export function calculateMELDNa(
  bilirubin: number,
  inr: number,
  creatinine: number,
  sodium: number
): number {
  const meld = calculateMELD(bilirubin, inr, creatinine);
  const na = Math.max(125, Math.min(137, sodium));
  const meldNa = meld + 1.32 * (137 - na) - 0.033 * meld * (137 - na);
  return Math.round(Math.max(6, Math.min(40, meldNa)));
}

/**
 * Calculate Child-Pugh score — matches app.py calculate_child_pugh exactly
 * Note: Gradio version only uses ascitis (yes/no) and assumes no encephalopathy
 */
export function calculateChildPugh(
  bilirubin: number,
  albumin: number,
  inr: number,
  ascitis: string
): { score: number; cpClass: "A" | "B" | "C" } {
  let score = 0;

  // Bilirubin
  if (bilirubin < 2) score += 1;
  else if (bilirubin <= 3) score += 2;
  else score += 3;

  // Albumin
  if (albumin > 3.5) score += 1;
  else if (albumin >= 2.8) score += 2;
  else score += 3;

  // INR
  if (inr < 1.7) score += 1;
  else if (inr <= 2.3) score += 2;
  else score += 3;

  // Ascites
  if (ascitis === "no") score += 1;
  else score += 2; // Assuming mild-moderate (matches app.py)

  // Encephalopathy (not available, assume none — matches app.py)
  score += 1;

  const cpClass: "A" | "B" | "C" =
    score <= 6 ? "A" : score <= 9 ? "B" : "C";

  return { score, cpClass };
}

/**
 * Get MELD 3-month mortality estimate
 */
export function getMELDMortality(meld: number): string {
  if (meld < 10) return "<10%";
  if (meld < 20) return "10-19%";
  if (meld < 30) return "20-50%";
  return ">50%";
}

/**
 * Determine risk category from ML probability — matches app.py
 */
export function getRiskCategory(probability: number): RiskCategory {
  if (probability < 0.3) return "Low Risk";
  if (probability < 0.6) return "Moderate Risk";
  return "High Risk";
}

/**
 * Build the full PredictionResult from ML probability + patient input
 */
export function buildPredictionResult(
  probability: number,
  input: PatientInput
): PredictionResult {
  const confidenceMargin = 0.15;
  const ciLower = Math.max(0, probability - confidenceMargin);
  const ciUpper = Math.min(1, probability + confidenceMargin);

  const meld = calculateMELD(input.total_bilirrubin, input.inr, input.creatinine);
  const meldNa = calculateMELDNa(
    input.total_bilirrubin,
    input.inr,
    input.creatinine,
    input.sodium
  );
  const { score: childPughScore, cpClass: childPughClass } = calculateChildPugh(
    input.total_bilirrubin,
    input.albumin,
    input.inr,
    input.ascitis
  );

  return {
    prediction: probability >= 0.5 ? 1 : 0,
    probability,
    ciLower,
    ciUpper,
    riskCategory: getRiskCategory(probability),
    meld,
    meldMortality: getMELDMortality(meld),
    meldNa,
    childPughScore,
    childPughClass,
  };
}
