import { describe, it, expect } from "vitest";
import { computePDP, getAvailablePDPFeatures } from "../partial-dependence";
import { DEFAULT_PATIENT } from "../../types";

describe("computePDP", () => {
  it("returns a valid PDP result for albumin", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    expect(result!.feature).toBe("albumin");
    expect(result!.label).toBe("Albumin");
    expect(result!.unit).toBe("g/dL");
    expect(result!.points.length).toBeGreaterThan(10);
  });

  it("returns null for non-numerical features", () => {
    const result = computePDP(DEFAULT_PATIENT, "sex");
    expect(result).toBeNull();
  });

  it("points have increasing x values", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    for (let i = 1; i < result!.points.length; i++) {
      expect(result!.points[i].x).toBeGreaterThanOrEqual(result!.points[i - 1].x);
    }
  });

  it("all y values are between 0 and 1", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    for (const p of result!.points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("current value is within the x range", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    const xs = result!.points.map((p) => p.x);
    expect(result!.currentValue).toBeGreaterThanOrEqual(Math.min(...xs));
    expect(result!.currentValue).toBeLessThanOrEqual(Math.max(...xs));
  });

  it("min/max predictions are correct", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    const ys = result!.points.map((p) => p.y);
    expect(result!.minPrediction).toBeCloseTo(Math.min(...ys), 5);
    expect(result!.maxPrediction).toBeCloseTo(Math.max(...ys), 5);
  });

  it("albumin PDP shows inverse relationship (higher albumin → lower risk)", () => {
    const result = computePDP(DEFAULT_PATIENT, "albumin");
    expect(result).not.toBeNull();
    // First quarter average should be higher than last quarter average
    const n = result!.points.length;
    const q1 = result!.points.slice(0, Math.floor(n / 4));
    const q4 = result!.points.slice(Math.floor((3 * n) / 4));
    const avgQ1 = q1.reduce((s, p) => s + p.y, 0) / q1.length;
    const avgQ4 = q4.reduce((s, p) => s + p.y, 0) / q4.length;
    expect(avgQ1).toBeGreaterThan(avgQ4);
  });

  it("works for all available features", () => {
    const features = getAvailablePDPFeatures();
    for (const f of features) {
      const result = computePDP(DEFAULT_PATIENT, f.key as keyof typeof DEFAULT_PATIENT);
      expect(result).not.toBeNull();
      expect(result!.points.length).toBeGreaterThan(0);
    }
  });
});

describe("getAvailablePDPFeatures", () => {
  it("returns a list of features", () => {
    const features = getAvailablePDPFeatures();
    expect(features.length).toBeGreaterThan(10);
  });

  it("each feature has key, label, and unit", () => {
    const features = getAvailablePDPFeatures();
    for (const f of features) {
      expect(f.key).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(typeof f.unit).toBe("string");
    }
  });
});
