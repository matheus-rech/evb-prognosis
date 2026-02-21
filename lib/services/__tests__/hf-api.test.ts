import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
import { callLiveModel, verifyWithLiveModel } from "../hf-api";
import type { PatientInput } from "../../types";
import { DEFAULT_PATIENT } from "../../types";

describe("HF API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("callLiveModel", () => {
    it("should call the Gradio API with correct format", async () => {
      // Mock the two-step Gradio API (POST call + GET result)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ event_id: "test-event-123" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            'data: ["<div>42.5%</div><div>1-Year Mortality</div><div>95% CI: 35.2% - 49.8%</div><div>HIGH RISK</div><div>Death within 1 year</div>", "<div>18</div><div>MELD Score</div><div>22</div><div>MELD-Na Score</div><div>9</div><div>Child-Pugh (Class B)</div>", "comparison", "global_shap", "patient_shap"]',
        });

      const result = await callLiveModel(DEFAULT_PATIENT);

      // Verify first call was POST to /call/predict_patient_outcome
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[0]).toContain("/call/predict_patient_outcome");
      expect(firstCall[1]?.method).toBe("POST");

      // Verify second call fetches the event result
      const secondCall = mockFetch.mock.calls[1];
      expect(secondCall[0]).toContain("test-event-123");

      // Verify parsed results
      expect(result.probability).toBeCloseTo(0.425, 2);
      expect(result.ciLower).toBeCloseTo(0.352, 2);
      expect(result.ciUpper).toBeCloseTo(0.498, 2);
      expect(result.riskCategory).toBe("High Risk");
      expect(result.prediction).toBe("Death within 1 year");
      expect(result.meld).toBe(18);
      expect(result.meldNa).toBe(22);
      expect(result.childPughScore).toBe(9);
      expect(result.childPughClass).toBe("B");
    });

    it("should throw on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(callLiveModel(DEFAULT_PATIENT)).rejects.toThrow("API returned 503");
    });

    it("should send correct number of parameters (34)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ event_id: "ev-1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'data: ["<div>10.0%</div><div>1-Year Mortality</div>", "scores", "", "", ""]',
        });

      await callLiveModel(DEFAULT_PATIENT);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.data).toHaveLength(34);
    });
  });

  describe("verifyWithLiveModel", () => {
    it("should return concordance data when API succeeds", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ event_id: "ev-2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            'data: ["<div>30.5%</div><div>1-Year Mortality</div><div>95% CI: 25.0% - 36.0%</div><div>MODERATE RISK</div><div>Survival beyond 1 year</div>", "<div>15</div><div>MELD Score</div><div>18</div><div>MELD-Na Score</div><div>7</div><div>Child-Pugh (Class B)</div>", "", "", ""]',
        });

      const result = await verifyWithLiveModel(
        DEFAULT_PATIENT,
        0.30, // local probability
        15,   // local MELD
        18,   // local MELD-Na
        7     // local Child-Pugh
      );

      expect(result.error).toBeNull();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.live.probability).toBeCloseTo(0.305, 2);
      expect(result.concordance.isClose).toBe(true); // 0.5% diff < 5%
      expect(result.concordance.meldMatch).toBe(true);
      expect(result.concordance.meldNaMatch).toBe(true);
      expect(result.concordance.childPughMatch).toBe(true);
    });

    it("should detect non-concordant predictions", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ event_id: "ev-3" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            'data: ["<div>60.0%</div><div>1-Year Mortality</div><div>95% CI: 50.0% - 70.0%</div><div>HIGH RISK</div>", "<div>25</div><div>MELD Score</div><div>28</div><div>MELD-Na Score</div><div>11</div><div>Child-Pugh (Class C)</div>", "", "", ""]',
        });

      const result = await verifyWithLiveModel(
        DEFAULT_PATIENT,
        0.30, // local probability (very different from 60%)
        15,   // local MELD (different from 25)
        18,   // local MELD-Na (different from 28)
        7     // local Child-Pugh (different from 11)
      );

      expect(result.error).toBeNull();
      expect(result.concordance.isClose).toBe(false); // 30% diff > 5%
      expect(result.concordance.probabilityDiff).toBeCloseTo(0.30, 1);
      expect(result.concordance.meldMatch).toBe(false);
      expect(result.concordance.meldNaMatch).toBe(false);
      expect(result.concordance.childPughMatch).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyWithLiveModel(
        DEFAULT_PATIENT,
        0.30,
        15,
        18,
        7
      );

      expect(result.error).toBe("Network error");
      expect(result.live.probability).toBeNull();
      expect(result.concordance.probabilityDiff).toBe(-1);
    });
  });
});
