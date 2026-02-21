// ===== Patient input types matching the original calibrated model (34 columns) =====

export type Sex = "male" | "female";
export type Race = "white" | "black" | "other";
export type EtiologyCirrosis = "alcohol" | "hcv" | "alcohol+hcv" | "crypto" | "nash" | "hb";
export type YesNo = "yes" | "no";
export type Therapy = "Banding" | "no therapy";

/** All 34 inputs matching the calibrated_random_forest_model_updated_v1.1.joblib */
export interface PatientInput {
  // Tab 1: General Info (Demographics)
  age: number;
  sex: Sex;
  race: Race;
  etiology_cirrosis: EtiologyCirrosis;
  hepatorenal_syndrome: YesNo;
  omeprazole: YesNo;
  spironolactone: YesNo;
  furosemide: YesNo;
  propanolol: YesNo;
  dialisis: YesNo;

  // Tab 2: Clinical Status (Bleeding Episode Details)
  portal_vein_thrombosis: YesNo;
  ascitis: YesNo;
  hepatocellular_carcinoma: YesNo;
  varices: YesNo;
  red_wale_marks: YesNo;
  rupture_point: YesNo;
  active_bleeding: YesNo;
  rebleeding: YesNo;
  therapy: Therapy;
  terlipressin_dose: number;
  time_to_endoscophy_hours: number;

  // Tab 3: Laboratory Values
  albumin: number;
  total_bilirrubin: number;
  direct_bilirrubina: number;
  inr: number;
  creatinine: number;
  platelets: number;
  ast: number;
  alt: number;
  hemoglobin: number;
  hematocrit: number;
  leucocytes: number;
  sodium: number;
  potassium: number;
}

export const DEFAULT_PATIENT: PatientInput = {
  age: 50,
  sex: "male",
  race: "white",
  etiology_cirrosis: "alcohol",
  hepatorenal_syndrome: "no",
  omeprazole: "no",
  spironolactone: "yes",
  furosemide: "yes",
  propanolol: "no",
  dialisis: "no",
  portal_vein_thrombosis: "no",
  ascitis: "yes",
  hepatocellular_carcinoma: "no",
  varices: "yes",
  red_wale_marks: "no",
  rupture_point: "no",
  active_bleeding: "no",
  rebleeding: "no",
  therapy: "Banding",
  terlipressin_dose: 2,
  time_to_endoscophy_hours: 6,
  albumin: 3.5,
  total_bilirrubin: 2.0,
  direct_bilirrubina: 0.5,
  inr: 1.2,
  creatinine: 1.0,
  platelets: 150,
  ast: 35,
  alt: 25,
  hemoglobin: 13,
  hematocrit: 40,
  leucocytes: 6,
  sodium: 140,
  potassium: 4,
};

// ===== Results types =====

export type RiskCategory = "Low Risk" | "Moderate Risk" | "High Risk";

export interface PredictionResult {
  // ML Model
  prediction: 0 | 1;
  probability: number;
  ciLower: number;
  ciUpper: number;
  riskCategory: RiskCategory;

  // Traditional Scores
  meld: number;
  meldMortality: string;
  meldNa: number;
  childPughScore: number;
  childPughClass: "A" | "B" | "C";
}

// ===== Clinical References =====

export const CLINICAL_REFERENCES = [
  "Rech MM, Soldera J, Corso LL et al. Development, Internal and Prospective validation of a machine learning model for the prediction of mortality in cirrhotic patients with acute esophageal variceal bleeding. Accepted for publication. 2025.",
  "Kamath PS, et al. A model to predict survival in patients with end-stage liver disease. Hepatology. 2001;33(2):464-470.",
  "Kim WR, et al. Hyponatremia and mortality among patients on the liver-transplant waiting list. N Engl J Med. 2008;359(10):1018-1026.",
  "Pugh RN, et al. Transection of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646-649.",
  "Johnson PJ, et al. Assessment of liver function in patients with hepatocellular carcinoma: a new evidence-based approach—the ALBI grade. J Clin Oncol. 2015;33(6):550-558.",
];


// ===== Assessment / History types =====

/** Nested patient data as stored in the assessment history */
export interface AssessmentPatientData {
  generalInfo: {
    age: number;
    sex: string;
    race: string;
    etiology_cirrosis: string;
  };
  clinicalStatus: {
    ascitis: string;
    therapy: string;
    portal_vein_thrombosis: string;
    hepatocellular_carcinoma: string;
    varices: string;
    red_wale_marks: string;
    rupture_point: string;
    active_bleeding: string;
    rebleeding: string;
    hepatorenal_syndrome: string;
    terlipressin_dose: number;
    time_to_endoscophy_hours: number;
  };
  labValues: {
    albumin: number;
    total_bilirubin: number;
    direct_bilirubin: number;
    inr: number;
    creatinine: number;
    sodium: number;
    potassium: number;
    platelets: number;
    ast: number;
    alt: number;
    hemoglobin: number;
    hematocrit: number;
    leucocytes: number;
  };
}

export interface AssessmentResult {
  mlResult: {
    probability: number;
    ciLower: number;
    ciUpper: number;
    prediction: 0 | 1;
    riskCategory: RiskCategory;
  };
  traditionalScores: {
    meld: number;
    meldNa: number;
    childPugh: number;
    childPughClass: "A" | "B" | "C";
  };
}

export interface Assessment {
  id: string;
  date: string; // ISO string
  patientData: AssessmentPatientData;
  result: AssessmentResult;
}

// ===== Preset Scenarios =====

export interface PresetScenario {
  name: string;
  label: string;
  data: PatientInput;
}

export const PRESETS: PresetScenario[] = [
  {
    name: "compensated",
    label: "Compensated (Child A)",
    data: {
      ...DEFAULT_PATIENT,
      ascitis: "no",
      albumin: 3.8,
      total_bilirrubin: 1.5,
      direct_bilirrubina: 0.3,
      inr: 1.1,
      creatinine: 0.9,
      sodium: 140,
      platelets: 180,
      hemoglobin: 13,
      hematocrit: 40,
    },
  },
  {
    name: "decompensated",
    label: "Decompensated (Child C)",
    data: {
      ...DEFAULT_PATIENT,
      age: 62,
      ascitis: "yes",
      hepatorenal_syndrome: "yes",
      albumin: 2.2,
      total_bilirrubin: 8.0,
      direct_bilirrubina: 4.5,
      inr: 2.5,
      creatinine: 2.0,
      sodium: 128,
      platelets: 60,
      hemoglobin: 8,
      hematocrit: 25,
      leucocytes: 12,
      active_bleeding: "yes",
    },
  },
  {
    name: "moderate",
    label: "Moderate Risk (Child B)",
    data: {
      ...DEFAULT_PATIENT,
      age: 55,
      albumin: 2.9,
      total_bilirrubin: 3.5,
      direct_bilirrubina: 1.5,
      inr: 1.6,
      creatinine: 1.3,
      sodium: 134,
      platelets: 90,
      hemoglobin: 10,
      hematocrit: 32,
    },
  },
];
