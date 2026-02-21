/**
 * Clinical validation ranges for lab values and numerical inputs.
 * Flags values outside typical clinical ranges to catch data entry errors.
 *
 * Ranges are based on standard clinical reference ranges for adult patients.
 * "warning" = outside normal but clinically plausible
 * "critical" = extreme value, likely data entry error or life-threatening
 */

export type ValidationSeverity = "normal" | "warning" | "critical";

export interface ValidationRange {
  /** Field key in PatientInput */
  key: string;
  /** Display label */
  label: string;
  /** Unit of measurement */
  unit: string;
  /** Normal range lower bound (inclusive) */
  normalLow: number;
  /** Normal range upper bound (inclusive) */
  normalHigh: number;
  /** Critical low (below this = critical) */
  criticalLow: number;
  /** Critical high (above this = critical) */
  criticalHigh: number;
  /** Warning message when out of normal range */
  warningMessage: string;
  /** Critical message when extremely out of range */
  criticalMessage: string;
}

export interface ValidationResult {
  key: string;
  severity: ValidationSeverity;
  message: string;
  value: number;
  normalRange: string;
}

/**
 * Clinical reference ranges for all numerical lab values and key clinical inputs.
 * Sources: Standard clinical laboratory references, Harrison's Principles of Internal Medicine.
 */
export const CLINICAL_RANGES: ValidationRange[] = [
  // Liver Function Tests
  {
    key: "albumin",
    label: "Albumin",
    unit: "g/dL",
    normalLow: 3.5,
    normalHigh: 5.0,
    criticalLow: 1.5,
    criticalHigh: 5.5,
    warningMessage: "Albumin outside normal range (3.5–5.0 g/dL). Low albumin suggests hepatic dysfunction.",
    criticalMessage: "Critically abnormal albumin. Verify value — may indicate severe hepatic failure or lab error.",
  },
  {
    key: "total_bilirrubin",
    label: "Total Bilirubin",
    unit: "mg/dL",
    normalLow: 0.1,
    normalHigh: 1.2,
    criticalLow: 0.0,
    criticalHigh: 20.0,
    warningMessage: "Elevated bilirubin (normal: 0.1–1.2 mg/dL). Common in cirrhotic patients.",
    criticalMessage: "Extremely elevated bilirubin (>20 mg/dL). Verify value — suggests severe cholestasis.",
  },
  {
    key: "direct_bilirrubina",
    label: "Direct Bilirubin",
    unit: "mg/dL",
    normalLow: 0.0,
    normalHigh: 0.3,
    criticalLow: 0.0,
    criticalHigh: 8.0,
    warningMessage: "Elevated direct bilirubin (normal: 0–0.3 mg/dL). Suggests conjugated hyperbilirubinemia.",
    criticalMessage: "Extremely elevated direct bilirubin. Verify value.",
  },
  {
    key: "inr",
    label: "INR",
    unit: "",
    normalLow: 0.8,
    normalHigh: 1.2,
    criticalLow: 0.5,
    criticalHigh: 4.0,
    warningMessage: "INR outside normal range (0.8–1.2). Elevated INR indicates coagulopathy.",
    criticalMessage: "Critically elevated INR (>4.0). Verify value — high bleeding risk.",
  },
  {
    key: "creatinine",
    label: "Creatinine",
    unit: "mg/dL",
    normalLow: 0.6,
    normalHigh: 1.2,
    criticalLow: 0.1,
    criticalHigh: 6.0,
    warningMessage: "Creatinine outside normal range (0.6–1.2 mg/dL). Elevated values suggest renal impairment.",
    criticalMessage: "Critically elevated creatinine. Verify value — may indicate acute kidney injury.",
  },
  // Complete Blood Count
  {
    key: "platelets",
    label: "Platelets",
    unit: "×10³/μL",
    normalLow: 150,
    normalHigh: 400,
    criticalLow: 20,
    criticalHigh: 600,
    warningMessage: "Platelet count outside normal range (150–400 ×10³/μL). Thrombocytopenia is common in cirrhosis.",
    criticalMessage: "Critically abnormal platelet count. Verify value — high bleeding or thrombotic risk.",
  },
  {
    key: "hemoglobin",
    label: "Hemoglobin",
    unit: "g/dL",
    normalLow: 12.0,
    normalHigh: 17.5,
    criticalLow: 5.0,
    criticalHigh: 20.0,
    warningMessage: "Hemoglobin outside normal range (12–17.5 g/dL). Low values suggest anemia or active bleeding.",
    criticalMessage: "Critically abnormal hemoglobin. Verify value — may require urgent transfusion.",
  },
  {
    key: "hematocrit",
    label: "Hematocrit",
    unit: "%",
    normalLow: 36,
    normalHigh: 54,
    criticalLow: 15,
    criticalHigh: 60,
    warningMessage: "Hematocrit outside normal range (36–54%). Low values correlate with anemia.",
    criticalMessage: "Critically abnormal hematocrit. Verify value.",
  },
  {
    key: "leucocytes",
    label: "Leukocytes",
    unit: "×10³/μL",
    normalLow: 4.0,
    normalHigh: 11.0,
    criticalLow: 1.0,
    criticalHigh: 30.0,
    warningMessage: "WBC outside normal range (4–11 ×10³/μL). Leukocytosis may suggest infection.",
    criticalMessage: "Critically abnormal WBC count. Verify value.",
  },
  // Liver Enzymes
  {
    key: "ast",
    label: "AST",
    unit: "U/L",
    normalLow: 10,
    normalHigh: 40,
    criticalLow: 5,
    criticalHigh: 300,
    warningMessage: "AST outside normal range (10–40 U/L). Elevated AST indicates hepatocellular injury.",
    criticalMessage: "Markedly elevated AST (>300 U/L). Verify value — may indicate acute hepatic injury.",
  },
  {
    key: "alt",
    label: "ALT",
    unit: "U/L",
    normalLow: 7,
    normalHigh: 56,
    criticalLow: 5,
    criticalHigh: 300,
    warningMessage: "ALT outside normal range (7–56 U/L). Elevated ALT suggests hepatocellular damage.",
    criticalMessage: "Markedly elevated ALT (>300 U/L). Verify value.",
  },
  // Electrolytes
  {
    key: "sodium",
    label: "Sodium",
    unit: "mEq/L",
    normalLow: 136,
    normalHigh: 145,
    criticalLow: 120,
    criticalHigh: 155,
    warningMessage: "Sodium outside normal range (136–145 mEq/L). Hyponatremia is a poor prognostic sign in cirrhosis.",
    criticalMessage: "Critically abnormal sodium. Verify value — risk of neurological complications.",
  },
  {
    key: "potassium",
    label: "Potassium",
    unit: "mEq/L",
    normalLow: 3.5,
    normalHigh: 5.0,
    criticalLow: 2.5,
    criticalHigh: 6.0,
    warningMessage: "Potassium outside normal range (3.5–5.0 mEq/L). Dyskalemia may cause arrhythmias.",
    criticalMessage: "Critically abnormal potassium. Verify value — cardiac arrhythmia risk.",
  },
  // Clinical inputs
  {
    key: "age",
    label: "Age",
    unit: "years",
    normalLow: 18,
    normalHigh: 90,
    criticalLow: 18,
    criticalHigh: 100,
    warningMessage: "Patient age is above 90 years. Verify the entered age.",
    criticalMessage: "Age at the extreme of the model's training range.",
  },
  {
    key: "terlipressin_dose",
    label: "Terlipressin Dose",
    unit: "mg",
    normalLow: 0,
    normalHigh: 8,
    criticalLow: 0,
    criticalHigh: 16,
    warningMessage: "Terlipressin dose above typical range (0–8 mg). Verify dosing.",
    criticalMessage: "Very high terlipressin dose. Verify — risk of ischemic complications.",
  },
];

/**
 * Validate a single numerical field against clinical reference ranges.
 */
export function validateField(key: string, value: number): ValidationResult | null {
  const range = CLINICAL_RANGES.find((r) => r.key === key);
  if (!range) return null;

  if (value < range.criticalLow || value > range.criticalHigh) {
    return {
      key,
      severity: "critical",
      message: range.criticalMessage,
      value,
      normalRange: `${range.normalLow}–${range.normalHigh} ${range.unit}`,
    };
  }

  if (value < range.normalLow || value > range.normalHigh) {
    return {
      key,
      severity: "warning",
      message: range.warningMessage,
      value,
      normalRange: `${range.normalLow}–${range.normalHigh} ${range.unit}`,
    };
  }

  return null;
}

/**
 * Validate all numerical fields in a PatientInput and return all warnings/criticals.
 */
export function validateAllFields(
  input: Record<string, number | string>
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const range of CLINICAL_RANGES) {
    const val = input[range.key];
    if (typeof val === "number") {
      const result = validateField(range.key, val);
      if (result) results.push(result);
    }
  }
  return results;
}

/**
 * Get the count of warnings and criticals for a specific tab.
 */
export function getTabValidationCounts(
  input: Record<string, number | string>,
  tabKeys: string[]
): { warnings: number; criticals: number } {
  let warnings = 0;
  let criticals = 0;
  for (const key of tabKeys) {
    const val = input[key];
    if (typeof val === "number") {
      const result = validateField(key, val);
      if (result?.severity === "warning") warnings++;
      if (result?.severity === "critical") criticals++;
    }
  }
  return { warnings, criticals };
}
