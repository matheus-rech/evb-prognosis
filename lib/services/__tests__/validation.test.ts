import { describe, it, expect } from "vitest";
import { validateField, validateAllFields, getTabValidationCounts } from "../validation";

describe("validateField", () => {
  it("returns null for normal sodium value", () => {
    expect(validateField("sodium", 140)).toBeNull();
  });

  it("returns warning for low sodium (hyponatremia)", () => {
    const result = validateField("sodium", 130);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
    expect(result!.message).toContain("Hyponatremia");
  });

  it("returns critical for extremely low sodium", () => {
    const result = validateField("sodium", 115);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
  });

  it("returns warning for elevated INR", () => {
    const result = validateField("inr", 2.5);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
  });

  it("returns critical for very high INR", () => {
    const result = validateField("inr", 5.0);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
  });

  it("returns null for normal albumin", () => {
    expect(validateField("albumin", 4.0)).toBeNull();
  });

  it("returns warning for low albumin", () => {
    const result = validateField("albumin", 2.5);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
  });

  it("returns null for unknown field", () => {
    expect(validateField("unknown_field", 42)).toBeNull();
  });

  it("returns warning for low hemoglobin", () => {
    const result = validateField("hemoglobin", 8.0);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
    expect(result!.message).toContain("anemia");
  });

  it("returns critical for very low platelets", () => {
    const result = validateField("platelets", 15);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
  });
});

describe("validateAllFields", () => {
  it("returns empty array for normal values", () => {
    const input = {
      albumin: 4.0,
      sodium: 140,
      inr: 1.0,
      creatinine: 0.9,
      platelets: 200,
      hemoglobin: 14,
      hematocrit: 42,
      leucocytes: 7,
      ast: 30,
      alt: 25,
      potassium: 4.2,
      total_bilirrubin: 0.8,
      direct_bilirrubina: 0.2,
    };
    const results = validateAllFields(input);
    expect(results.length).toBe(0);
  });

  it("returns multiple warnings for decompensated patient", () => {
    const input = {
      albumin: 2.0,
      sodium: 125,
      inr: 2.8,
      creatinine: 2.5,
      platelets: 50,
      hemoglobin: 7,
      hematocrit: 22,
      leucocytes: 15,
      total_bilirrubin: 12,
      direct_bilirrubina: 6,
      ast: 120,
      alt: 80,
      potassium: 5.5,
    };
    const results = validateAllFields(input);
    expect(results.length).toBeGreaterThan(5);
  });
});

describe("getTabValidationCounts", () => {
  it("counts warnings and criticals per tab", () => {
    const input = {
      sodium: 115, // critical
      potassium: 5.8, // warning
      albumin: 4.0, // normal
    };
    const counts = getTabValidationCounts(input, ["sodium", "potassium", "albumin"]);
    expect(counts.criticals).toBe(1);
    expect(counts.warnings).toBe(1);
  });
});
