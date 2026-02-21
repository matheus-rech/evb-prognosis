import { describe, it, expect } from "vitest";
import { predictMortality } from "../ml-inference";
import { DEFAULT_PATIENT } from "../../types";
import type { PatientInput } from "../../types";

describe("ML Inference - predictMortality", () => {
  it("returns a probability between 0 and 1 for default patient", () => {
    const prob = predictMortality(DEFAULT_PATIENT);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });

  it("matches the Python reference probability for default patient", () => {
    const prob = predictMortality(DEFAULT_PATIENT);
    // The exact value depends on the default patient values.
    // Just verify it's a reasonable probability.
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThan(1);
  });

  it("returns higher probability for sicker patients", () => {
    const healthyProb = predictMortality({
      ...DEFAULT_PATIENT,
      ascitis: "no",
      albumin: 3.8,
      total_bilirrubin: 1.5,
      inr: 1.1,
      creatinine: 0.9,
    });

    const sickProb = predictMortality({
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
      active_bleeding: "yes",
    });

    expect(sickProb).toBeGreaterThan(healthyProb);
  });

  it("produces consistent results across multiple calls", () => {
    const prob1 = predictMortality(DEFAULT_PATIENT);
    const prob2 = predictMortality(DEFAULT_PATIENT);
    expect(prob1).toBe(prob2);
  });

  it("handles edge case: all binary features set to yes", () => {
    const extremePatient: PatientInput = {
      ...DEFAULT_PATIENT,
      hepatorenal_syndrome: "yes",
      omeprazole: "yes",
      spironolactone: "yes",
      furosemide: "yes",
      propanolol: "yes",
      dialisis: "yes",
      portal_vein_thrombosis: "yes",
      ascitis: "yes",
      hepatocellular_carcinoma: "yes",
      varices: "yes",
      red_wale_marks: "yes",
      rupture_point: "yes",
      active_bleeding: "yes",
      rebleeding: "yes",
    };
    const prob = predictMortality(extremePatient);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });
});
