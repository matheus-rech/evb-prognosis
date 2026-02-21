import { describe, it, expect } from "vitest";
import {
  computeFeatureImportance,
  getTopFeatures,
} from "../feature-importance";
import type { PatientInput } from "../../types";
import { DEFAULT_PATIENT, PRESETS } from "../../types";

describe("computeFeatureImportance", () => {
  it("returns contributions for all original input features", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    // Should have contributions for all 34 original features
    // (some categorical features are merged from one-hot)
    expect(result.contributions.length).toBeGreaterThan(20);
    expect(result.contributions.length).toBeLessThanOrEqual(34);
  });

  it("contributions sum to (predicted - baseline)", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    const sumContributions = result.contributions.reduce(
      (sum, c) => sum + c.value,
      0
    );
    const expectedDiff = result.predictedProb - result.baselineProb;
    // Allow small floating point tolerance
    expect(Math.abs(sumContributions - expectedDiff)).toBeLessThan(0.001);
  });

  it("baseline probability is between 0 and 1", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    expect(result.baselineProb).toBeGreaterThan(0);
    expect(result.baselineProb).toBeLessThan(1);
  });

  it("predicted probability is between 0 and 1", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    expect(result.predictedProb).toBeGreaterThan(0);
    expect(result.predictedProb).toBeLessThan(1);
  });

  it("contributions are sorted by absolute value (descending)", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    for (let i = 1; i < result.contributions.length; i++) {
      expect(Math.abs(result.contributions[i - 1].value)).toBeGreaterThanOrEqual(
        Math.abs(result.contributions[i].value)
      );
    }
  });

  it("each contribution has valid metadata", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    for (const c of result.contributions) {
      expect(c.feature).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.inputValue).toBeTruthy();
      expect(["general", "clinical", "laboratory"]).toContain(c.category);
      expect(typeof c.value).toBe("number");
      expect(isNaN(c.value)).toBe(false);
    }
  });

  it("decompensated patient has different top features than compensated", () => {
    const compensated = computeFeatureImportance(PRESETS[0].data);
    const decompensated = computeFeatureImportance(PRESETS[1].data);

    // Decompensated should have higher predicted probability
    expect(decompensated.predictedProb).toBeGreaterThan(
      compensated.predictedProb
    );

    // Top features should differ
    const compTop3 = compensated.contributions
      .slice(0, 3)
      .map((c) => c.feature);
    const decompTop3 = decompensated.contributions
      .slice(0, 3)
      .map((c) => c.feature);

    // At least one of the top 3 should be different
    const overlap = compTop3.filter((f) => decompTop3.includes(f));
    expect(overlap.length).toBeLessThan(3);
  });

  it("decompensated patient has more positive (risk-increasing) contributions", () => {
    const decompensated = computeFeatureImportance(PRESETS[1].data);
    const positiveSum = decompensated.contributions
      .filter((c) => c.value > 0)
      .reduce((sum, c) => sum + c.value, 0);
    const negativeSum = decompensated.contributions
      .filter((c) => c.value < 0)
      .reduce((sum, c) => sum + c.value, 0);

    // For a high-risk patient, positive contributions should outweigh negative
    expect(positiveSum + negativeSum).toBeGreaterThan(0);
  });

  it("compensated patient has more negative (risk-decreasing) contributions", () => {
    const compensated = computeFeatureImportance(PRESETS[0].data);
    const totalContrib = compensated.contributions.reduce(
      (sum, c) => sum + c.value,
      0
    );
    // For a low-risk patient, net contributions should be negative (below baseline)
    expect(totalContrib).toBeLessThan(0);
  });
});

describe("getTopFeatures", () => {
  it("returns the requested number of features", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    const top5 = getTopFeatures(result, 5);
    expect(top5.length).toBe(5);
  });

  it("returns all features when topN exceeds total", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    const topAll = getTopFeatures(result, 100);
    expect(topAll.length).toBe(result.contributions.length);
  });

  it("default topN is 15", () => {
    const result = computeFeatureImportance(DEFAULT_PATIENT);
    const topDefault = getTopFeatures(result);
    expect(topDefault.length).toBe(Math.min(15, result.contributions.length));
  });
});
