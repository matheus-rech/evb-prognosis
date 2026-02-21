import { describe, it, expect } from "vitest";
import {
  calculateMELD,
  calculateMELDNa,
  calculateChildPugh,
  getMELDMortality,
  getRiskCategory,
  buildPredictionResult,
} from "../clinical-scores";
import { DEFAULT_PATIENT } from "../../types";

describe("MELD Score", () => {
  it("calculates MELD for normal values", () => {
    const meld = calculateMELD(2.0, 1.2, 1.0);
    expect(meld).toBeGreaterThanOrEqual(6);
    expect(meld).toBeLessThanOrEqual(40);
  });

  it("clamps minimum values to 1.0", () => {
    const meld = calculateMELD(0.5, 0.8, 0.3);
    expect(meld).toBe(6);
  });

  it("returns higher score for worse values", () => {
    const low = calculateMELD(1.0, 1.0, 1.0);
    const high = calculateMELD(5.0, 2.5, 3.0);
    expect(high).toBeGreaterThan(low);
  });
});

describe("MELD-Na Score", () => {
  it("equals MELD when sodium is 137+", () => {
    const meld = calculateMELD(2.0, 1.2, 1.0);
    const meldNa = calculateMELDNa(2.0, 1.2, 1.0, 140);
    expect(meldNa).toBe(meld);
  });

  it("increases when sodium is low", () => {
    const normal = calculateMELDNa(2.0, 1.2, 1.0, 140);
    const low = calculateMELDNa(2.0, 1.2, 1.0, 125);
    expect(low).toBeGreaterThan(normal);
  });
});

describe("Child-Pugh Score", () => {
  it("returns Class A for good values", () => {
    const { score, cpClass } = calculateChildPugh(1.5, 3.8, 1.2, "no");
    expect(cpClass).toBe("A");
    expect(score).toBeLessThanOrEqual(6);
  });

  it("returns Class C for bad values", () => {
    const { score, cpClass } = calculateChildPugh(5.0, 2.0, 2.5, "yes");
    expect(cpClass).toBe("C");
    expect(score).toBeGreaterThan(9);
  });
});

describe("MELD Mortality", () => {
  it("returns correct ranges", () => {
    expect(getMELDMortality(8)).toBe("<10%");
    expect(getMELDMortality(15)).toBe("10-19%");
    expect(getMELDMortality(25)).toBe("20-50%");
    expect(getMELDMortality(35)).toBe(">50%");
  });
});

describe("Risk Category", () => {
  it("categorizes correctly", () => {
    expect(getRiskCategory(0.1)).toBe("Low Risk");
    expect(getRiskCategory(0.45)).toBe("Moderate Risk");
    expect(getRiskCategory(0.8)).toBe("High Risk");
  });
});

describe("buildPredictionResult", () => {
  it("builds a complete result from probability and input", () => {
    const result = buildPredictionResult(0.167, DEFAULT_PATIENT);
    expect(result.prediction).toBe(0);
    expect(result.probability).toBe(0.167);
    expect(result.riskCategory).toBe("Low Risk");
    expect(result.meld).toBeGreaterThanOrEqual(6);
    expect(result.meldNa).toBeGreaterThanOrEqual(6);
    expect(result.childPughScore).toBeGreaterThanOrEqual(5);
    expect(["A", "B", "C"]).toContain(result.childPughClass);
  });
});
