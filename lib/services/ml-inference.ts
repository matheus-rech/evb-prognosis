import type { PatientInput } from "../types";
import modelData from "../../assets/model/full_model.json";

// ===== Types for the exported model JSON =====

interface TreeData {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[][][];
}

interface CalibrationData {
  X_thresholds: number[];
  y_thresholds: number[];
  X_min: number;
  X_max: number;
  increasing: boolean;
}

interface ClassifierData {
  n_trees: number;
  trees: TreeData[];
  classes: number[];
  calibration: CalibrationData;
}

interface PreprocessorData {
  numerical_columns: string[];
  categorical_columns: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  encoder_categories: string[][];
}

interface FullModelData {
  preprocessor: PreprocessorData;
  n_classifiers: number;
  classifiers: ClassifierData[];
}

const model = modelData as unknown as FullModelData;

// ===== Preprocessing =====

/**
 * Convert PatientInput to the dict format expected by the preprocessor.
 * Column names must match exactly what the ColumnTransformer expects.
 * Note: the preprocessor uses 'time-to-endoscophy_hours' (with hyphen).
 */
function patientToDict(input: PatientInput): Record<string, number | string> {
  return {
    age: input.age,
    sex: input.sex,
    race: input.race,
    etiology_cirrosis: input.etiology_cirrosis,
    hepatorenal_syndrome: input.hepatorenal_syndrome,
    omeprazole: input.omeprazole,
    spironolactone: input.spironolactone,
    furosemide: input.furosemide,
    propanolol: input.propanolol,
    dialisis: input.dialisis,
    portal_vein_thrombosis: input.portal_vein_thrombosis,
    ascitis: input.ascitis,
    hepatocellular_carcinoma: input.hepatocellular_carcinoma,
    varices: input.varices,
    red_wale_marks: input.red_wale_marks,
    rupture_point: input.rupture_point,
    active_bleeding: input.active_bleeding,
    rebleeding: input.rebleeding,
    therapy: input.therapy,
    terlipressin_dose: input.terlipressin_dose,
    "time-to-endoscophy_hours": input.time_to_endoscophy_hours,
    albumin: input.albumin,
    total_bilirrubin: input.total_bilirrubin,
    direct_bilirrubina: input.direct_bilirrubina,
    inr: input.inr,
    creatinine: input.creatinine,
    platelets: input.platelets,
    ast: input.ast,
    alt: input.alt,
    hemoglobin: input.hemoglobin,
    hematocrit: input.hematocrit,
    leucocytes: input.leucocytes,
    sodium: input.sodium,
    potassium: input.potassium,
  };
}

/**
 * Preprocess: StandardScaler for numerical + OneHotEncoder for categorical.
 * Matches the sklearn ColumnTransformer behavior exactly.
 * OneHotEncoder uses handle_unknown='ignore' — unknown categories get all-zero encoding.
 */
export function preprocess(input: PatientInput): number[] {
  const dict = patientToDict(input);
  const pp = model.preprocessor;
  const features: number[] = [];

  // Numerical: StandardScaler
  for (let i = 0; i < pp.numerical_columns.length; i++) {
    const col = pp.numerical_columns[i];
    const val = Number(dict[col]);
    features.push((val - pp.scaler_mean[i]) / pp.scaler_scale[i]);
  }

  // Categorical: OneHotEncoder with handle_unknown='ignore'
  for (let i = 0; i < pp.categorical_columns.length; i++) {
    const col = pp.categorical_columns[i];
    const val = String(dict[col]);
    const cats = pp.encoder_categories[i];
    for (const cat of cats) {
      features.push(val === cat ? 1 : 0);
    }
  }

  return features;
}

// ===== Decision Tree Traversal =====

function predictTree(tree: TreeData, features: number[]): number[] {
  let nodeId = 0;
  while (tree.children_left[nodeId] !== -1) {
    const featureIdx = tree.feature[nodeId];
    const threshold = tree.threshold[nodeId];
    if (features[featureIdx] <= threshold) {
      nodeId = tree.children_left[nodeId];
    } else {
      nodeId = tree.children_right[nodeId];
    }
  }
  // value[nodeId][0] = [count_class_0, count_class_1]
  const counts = tree.value[nodeId][0];
  const total = counts[0] + counts[1];
  return [counts[0] / total, counts[1] / total];
}

// ===== Isotonic Calibration =====

/**
 * Apply isotonic calibration using linear interpolation.
 * Matches sklearn's _SigmoidCalibration / IsotonicRegression behavior.
 */
function isotonicCalibrate(rawProb: number, cal: CalibrationData): number {
  // Clip to training range
  const clipped = Math.max(cal.X_min, Math.min(cal.X_max, rawProb));

  const xs = cal.X_thresholds;
  const ys = cal.y_thresholds;

  // Binary search for the right interval
  if (clipped <= xs[0]) return ys[0];
  if (clipped >= xs[xs.length - 1]) return ys[ys.length - 1];

  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (xs[mid] <= clipped) lo = mid;
    else hi = mid;
  }

  // Linear interpolation
  const t = (clipped - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

// ===== Public API =====

/**
 * Run the full ML inference pipeline:
 * 1. Preprocess input (StandardScaler + OneHotEncoder)
 * 2. For each of 5 calibrated classifiers:
 *    a. Run all 100 trees in the Random Forest
 *    b. Average probabilities across trees
 *    c. Apply isotonic calibration
 * 3. Average calibrated probabilities across all 5 classifiers
 *
 * Returns the mortality probability (0-1)
 */
export function predictMortality(input: PatientInput): number {
  const features = preprocess(input);

  let totalCalibrated = 0;

  for (const classifier of model.classifiers) {
    // Average raw forest probability across all trees
    let sumP1 = 0;
    for (const tree of classifier.trees) {
      const [, p1] = predictTree(tree, features);
      sumP1 += p1;
    }
    const rawProb = sumP1 / classifier.n_trees;

    // Apply isotonic calibration
    const calibrated = isotonicCalibrate(rawProb, classifier.calibration);
    totalCalibrated += calibrated;
  }

  // Average across all calibrated classifiers (5-fold CV)
  return totalCalibrated / model.n_classifiers;
}

/**
 * Get the model data for use by other services (feature importance, PDP).
 */
export function getModelData(): FullModelData {
  return model;
}

export type { FullModelData, TreeData, PreprocessorData, ClassifierData, CalibrationData };
