/**
 * Partial Dependence Plot (PDP) computation.
 *
 * Shows how varying a single feature (while keeping all others fixed at the
 * patient's current values) changes the predicted mortality probability.
 *
 * This helps clinicians understand dose-response relationships — e.g.,
 * "how does albumin from 1.0 to 5.0 affect this patient's risk?"
 */

import type { PatientInput } from "../types";
import { predictMortality } from "./ml-inference";

export interface PDPPoint {
  /** The feature value at this point */
  x: number;
  /** The predicted mortality probability at this value */
  y: number;
}

export interface PDPResult {
  /** Feature key */
  feature: string;
  /** Human-readable label */
  label: string;
  /** Unit of measurement */
  unit: string;
  /** Array of (x, y) points for the PDP curve */
  points: PDPPoint[];
  /** The patient's current value for this feature (marked on the plot) */
  currentValue: number;
  /** The predicted probability at the current value */
  currentPrediction: number;
  /** Min predicted probability across the range */
  minPrediction: number;
  /** Max predicted probability across the range */
  maxPrediction: number;
}

/** Configuration for each plottable numerical feature */
interface FeatureConfig {
  key: keyof PatientInput;
  label: string;
  unit: string;
  min: number;
  max: number;
  steps: number;
}

/**
 * All numerical features that can be plotted.
 * Ranges match the slider ranges in the Calculator screen.
 */
export const PDP_FEATURES: FeatureConfig[] = [
  { key: "albumin", label: "Albumin", unit: "g/dL", min: 1.0, max: 5.0, steps: 40 },
  { key: "total_bilirrubin", label: "Total Bilirubin", unit: "mg/dL", min: 0.1, max: 30.0, steps: 30 },
  { key: "direct_bilirrubina", label: "Direct Bilirubin", unit: "mg/dL", min: 0.0, max: 15.0, steps: 30 },
  { key: "inr", label: "INR", unit: "", min: 0.5, max: 5.0, steps: 30 },
  { key: "creatinine", label: "Creatinine", unit: "mg/dL", min: 0.1, max: 6.0, steps: 30 },
  { key: "platelets", label: "Platelets", unit: "×10³/μL", min: 10, max: 400, steps: 30 },
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", min: 3.0, max: 18.0, steps: 30 },
  { key: "hematocrit", label: "Hematocrit", unit: "%", min: 10, max: 55, steps: 30 },
  { key: "leucocytes", label: "Leukocytes", unit: "×10³/μL", min: 1.0, max: 30.0, steps: 30 },
  { key: "ast", label: "AST", unit: "U/L", min: 5, max: 300, steps: 30 },
  { key: "alt", label: "ALT", unit: "U/L", min: 5, max: 300, steps: 30 },
  { key: "sodium", label: "Sodium", unit: "mEq/L", min: 115, max: 155, steps: 40 },
  { key: "potassium", label: "Potassium", unit: "mEq/L", min: 2.5, max: 6.5, steps: 40 },
  { key: "age", label: "Age", unit: "years", min: 18, max: 90, steps: 36 },
  { key: "terlipressin_dose", label: "Terlipressin Dose", unit: "mg", min: 0, max: 20, steps: 20 },
  { key: "time_to_endoscophy_hours", label: "Time to Endoscopy", unit: "hours", min: 0, max: 48, steps: 24 },
];

/**
 * Compute partial dependence for a single feature.
 * Varies the feature across its range while keeping all other inputs fixed.
 */
export function computePDP(
  input: PatientInput,
  featureKey: keyof PatientInput
): PDPResult | null {
  const config = PDP_FEATURES.find((f) => f.key === featureKey);
  if (!config) return null;

  const currentValue = Number(input[featureKey]);
  const stepSize = (config.max - config.min) / config.steps;
  const points: PDPPoint[] = [];

  let minPred = Infinity;
  let maxPred = -Infinity;

  for (let i = 0; i <= config.steps; i++) {
    const x = config.min + i * stepSize;
    const modifiedInput = { ...input, [featureKey]: x };
    const y = predictMortality(modifiedInput);

    points.push({ x: Math.round(x * 1000) / 1000, y });
    if (y < minPred) minPred = y;
    if (y > maxPred) maxPred = y;
  }

  const currentPrediction = predictMortality(input);

  return {
    feature: featureKey as string,
    label: config.label,
    unit: config.unit,
    points,
    currentValue,
    currentPrediction,
    minPrediction: minPred,
    maxPrediction: maxPred,
  };
}

/**
 * Get the list of available features for PDP plotting.
 */
export function getAvailablePDPFeatures(): { key: string; label: string; unit: string }[] {
  return PDP_FEATURES.map((f) => ({
    key: f.key as string,
    label: f.label,
    unit: f.unit,
  }));
}
