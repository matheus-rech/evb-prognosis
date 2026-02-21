/**
 * Feature Importance via Tree Path Decomposition
 *
 * Computes per-feature contributions to each individual prediction by
 * decomposing the decision path through each tree in the Random Forest.
 *
 * For each tree, we track the "expected value" at each node and attribute
 * the change in expected value at each split to the feature used for that split.
 *
 * Supports the 5-fold CalibratedClassifierCV structure: contributions are
 * averaged across all 5 classifiers (each with 100 trees).
 */

import type { PatientInput } from "../types";
import { preprocess, getModelData } from "./ml-inference";
import type { TreeData } from "./ml-inference";

export interface FeatureContribution {
  /** Original input feature name (e.g., "albumin", "age") */
  feature: string;
  /** Human-readable label */
  label: string;
  /** SHAP value: positive = increases mortality risk, negative = decreases */
  value: number;
  /** The patient's actual input value for this feature */
  inputValue: string;
  /** Category: "general", "clinical", "laboratory" */
  category: "general" | "clinical" | "laboratory";
}

export interface FeatureImportanceResult {
  /** Per-feature contributions sorted by absolute value */
  contributions: FeatureContribution[];
  /** Baseline (expected) mortality probability */
  baselineProb: number;
  /** Final predicted mortality probability */
  predictedProb: number;
}

// ===== Feature name → human label mapping =====

const FEATURE_LABELS: Record<string, { label: string; category: "general" | "clinical" | "laboratory" }> = {
  age: { label: "Age", category: "general" },
  sex: { label: "Sex", category: "general" },
  race: { label: "Race", category: "general" },
  etiology_cirrosis: { label: "Etiology", category: "general" },
  hepatorenal_syndrome: { label: "Hepatorenal Syndrome", category: "general" },
  omeprazole: { label: "Omeprazole", category: "general" },
  spironolactone: { label: "Spironolactone", category: "general" },
  furosemide: { label: "Furosemide", category: "general" },
  propanolol: { label: "Propranolol", category: "general" },
  dialisis: { label: "Dialysis", category: "general" },
  portal_vein_thrombosis: { label: "Portal Vein Thrombosis", category: "clinical" },
  ascitis: { label: "Ascites", category: "clinical" },
  hepatocellular_carcinoma: { label: "Hepatocellular Carcinoma", category: "clinical" },
  varices: { label: "Varices", category: "clinical" },
  red_wale_marks: { label: "Red Wale Marks", category: "clinical" },
  rupture_point: { label: "Rupture Point", category: "clinical" },
  active_bleeding: { label: "Active Bleeding", category: "clinical" },
  rebleeding: { label: "Rebleeding", category: "clinical" },
  therapy: { label: "Therapy", category: "clinical" },
  terlipressin_dose: { label: "Terlipressin Dose", category: "clinical" },
  "time-to-endoscophy_hours": { label: "Time to Endoscopy", category: "clinical" },
  albumin: { label: "Albumin", category: "laboratory" },
  total_bilirrubin: { label: "Total Bilirubin", category: "laboratory" },
  direct_bilirrubina: { label: "Direct Bilirubin", category: "laboratory" },
  inr: { label: "INR", category: "laboratory" },
  creatinine: { label: "Creatinine", category: "laboratory" },
  platelets: { label: "Platelets", category: "laboratory" },
  ast: { label: "AST", category: "laboratory" },
  alt: { label: "ALT", category: "laboratory" },
  hemoglobin: { label: "Hemoglobin", category: "laboratory" },
  hematocrit: { label: "Hematocrit", category: "laboratory" },
  leucocytes: { label: "Leukocytes", category: "laboratory" },
  sodium: { label: "Sodium", category: "laboratory" },
  potassium: { label: "Potassium", category: "laboratory" },
};

// ===== Build mapping from preprocessed feature index → original input feature name =====

function buildFeatureIndexMap(): string[] {
  const model = getModelData();
  const pp = model.preprocessor;
  const map: string[] = [];

  // Numerical columns map 1:1
  for (const col of pp.numerical_columns) {
    map.push(col);
  }

  // Categorical columns: each category becomes one-hot feature, all map to same original column
  for (let i = 0; i < pp.categorical_columns.length; i++) {
    const col = pp.categorical_columns[i];
    const cats = pp.encoder_categories[i];
    for (let _j = 0; _j < cats.length; _j++) {
      map.push(col);
    }
  }

  return map;
}

// ===== Tree Path Decomposition =====

function computeNodeProbs(tree: TreeData): number[] {
  const probs = new Array(tree.children_left.length);
  for (let i = 0; i < tree.children_left.length; i++) {
    const counts = tree.value[i][0];
    const total = counts[0] + counts[1];
    probs[i] = total > 0 ? counts[1] / total : 0;
  }
  return probs;
}

function treePathContributions(tree: TreeData, features: number[]): number[] {
  const nodeProbs = computeNodeProbs(tree);
  const nFeatures = features.length;
  const contributions = new Array(nFeatures).fill(0);

  let nodeId = 0;
  while (tree.children_left[nodeId] !== -1) {
    const featureIdx = tree.feature[nodeId];
    const threshold = tree.threshold[nodeId];
    const currentProb = nodeProbs[nodeId];

    let childId: number;
    if (features[featureIdx] <= threshold) {
      childId = tree.children_left[nodeId];
    } else {
      childId = tree.children_right[nodeId];
    }

    const childProb = nodeProbs[childId];
    contributions[featureIdx] += childProb - currentProb;
    nodeId = childId;
  }

  return contributions;
}

function treeBaseline(tree: TreeData): number {
  const counts = tree.value[0][0];
  const total = counts[0] + counts[1];
  return total > 0 ? counts[1] / total : 0;
}

// ===== Main computation =====

export function computeFeatureImportance(input: PatientInput): FeatureImportanceResult {
  const model = getModelData();
  const features = preprocess(input);
  const nPreprocessedFeatures = features.length;
  const featureIndexMap = buildFeatureIndexMap();

  // Aggregate contributions across all classifiers and their trees
  const totalContributions = new Array(nPreprocessedFeatures).fill(0);
  let totalBaseline = 0;
  let totalTreeCount = 0;

  for (const classifier of model.classifiers) {
    for (const tree of classifier.trees) {
      const contributions = treePathContributions(tree, features);
      const baseline = treeBaseline(tree);

      for (let i = 0; i < nPreprocessedFeatures; i++) {
        totalContributions[i] += contributions[i];
      }
      totalBaseline += baseline;
      totalTreeCount++;
    }
  }

  // Average across all trees from all classifiers
  for (let i = 0; i < nPreprocessedFeatures; i++) {
    totalContributions[i] /= totalTreeCount;
  }
  totalBaseline /= totalTreeCount;

  // Compute predicted probability (before calibration)
  let totalPredicted = totalBaseline;
  for (let i = 0; i < nPreprocessedFeatures; i++) {
    totalPredicted += totalContributions[i];
  }

  // Aggregate one-hot encoded features back to original feature names
  const originalContributions: Record<string, number> = {};
  for (let i = 0; i < nPreprocessedFeatures; i++) {
    const originalFeature = featureIndexMap[i];
    if (!originalContributions[originalFeature]) {
      originalContributions[originalFeature] = 0;
    }
    originalContributions[originalFeature] += totalContributions[i];
  }

  // Build input value display strings
  const inputValues: Record<string, string> = {};
  for (const key of Object.keys(input)) {
    inputValues[key] = String((input as unknown as Record<string, unknown>)[key]);
  }
  // Map the hyphenated column name to the underscore version
  inputValues["time-to-endoscophy_hours"] = String(input.time_to_endoscophy_hours);

  // Build contribution array sorted by absolute value
  const contributions: FeatureContribution[] = Object.entries(originalContributions)
    .map(([feature, value]) => {
      const meta = FEATURE_LABELS[feature] || { label: feature, category: "general" as const };
      return {
        feature,
        label: meta.label,
        value,
        inputValue: inputValues[feature] || "—",
        category: meta.category,
      };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    contributions,
    baselineProb: totalBaseline,
    predictedProb: totalPredicted,
  };
}

export function getTopFeatures(
  result: FeatureImportanceResult,
  topN: number = 15
): FeatureContribution[] {
  return result.contributions.slice(0, topN);
}
