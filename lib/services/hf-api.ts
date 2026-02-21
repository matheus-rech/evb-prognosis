/**
 * HF Space Gradio API Client
 * Calls the live mmrech/evb-br HuggingFace Space to verify predictions
 */

import type { PatientInput } from "@/lib/types";

const HF_SPACE_URL = "https://mmrech-evb-br.hf.space";

export interface LivePredictionResult {
  probability: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  riskCategory: string | null;
  prediction: string | null;
  meld: number | null;
  meldNa: number | null;
  childPughScore: number | null;
  childPughClass: string | null;
}

export interface VerificationResult {
  live: LivePredictionResult;
  concordance: {
    probabilityDiff: number;
    isClose: boolean; // within 5%
    meldMatch: boolean;
    meldNaMatch: boolean;
    childPughMatch: boolean;
  };
  latencyMs: number;
  error: string | null;
}

/**
 * Map PatientInput to the Gradio API's expected 34-element array
 */
function buildGradioData(input: PatientInput): (string | number)[] {
  return [
    input.age,
    input.sex,
    input.race,
    input.etiology_cirrosis,
    input.hepatorenal_syndrome,
    input.omeprazole,
    input.spironolactone,
    input.furosemide,
    input.propanolol,
    input.dialisis,
    input.portal_vein_thrombosis,
    input.ascitis,
    input.hepatocellular_carcinoma,
    input.albumin,
    input.total_bilirrubin,
    input.direct_bilirrubina,
    input.inr,
    input.creatinine,
    input.platelets,
    input.ast,
    input.alt,
    input.hemoglobin,
    input.hematocrit,
    input.leucocytes,
    input.sodium,
    input.potassium,
    input.varices,
    input.red_wale_marks,
    input.rupture_point,
    input.active_bleeding,
    input.therapy,
    input.terlipressin_dose,
    input.time_to_endoscophy_hours,
    input.rebleeding,
  ];
}

/**
 * Parse ML output HTML from the Gradio API
 */
function parseMLOutput(html: string): Partial<LivePredictionResult> {
  const result: Partial<LivePredictionResult> = {};

  // Parse probability from HTML format: >XX.X%</div>...<div...>1-Year Mortality
  const htmlPct = html.match(/>([\d.]+)%<\/div>\s*<div[^>]*>1-Year Mortality/);
  if (htmlPct) {
    result.probability = parseFloat(htmlPct[1]) / 100;
  }
  // Fallback to markdown format
  if (result.probability == null) {
    const mdPct = html.match(
      /Mortality Probability:\*\*\s*([\d.]+)%\s*\(95% CI:\s*([\d.]+)%\s*-\s*([\d.]+)%\)/
    );
    if (mdPct) {
      result.probability = parseFloat(mdPct[1]) / 100;
      result.ciLower = parseFloat(mdPct[2]) / 100;
      result.ciUpper = parseFloat(mdPct[3]) / 100;
    }
  }

  // Parse CI
  const ciMatch = html.match(/95% CI:\s*([\d.]+)%\s*-\s*([\d.]+)%/);
  if (ciMatch) {
    result.ciLower = parseFloat(ciMatch[1]) / 100;
    result.ciUpper = parseFloat(ciMatch[2]) / 100;
  }

  // Parse prediction
  result.prediction = html.includes("Death within 1 year")
    ? "Death within 1 year"
    : "Survival beyond 1 year";

  // Parse risk category
  const rm = html.match(
    /(LOW RISK|MODERATE RISK|HIGH RISK|Low Risk|Moderate Risk|High Risk)/i
  );
  if (rm) {
    const cat = rm[1].toLowerCase();
    if (cat.includes("low")) result.riskCategory = "Low Risk";
    else if (cat.includes("moderate")) result.riskCategory = "Moderate Risk";
    else result.riskCategory = "High Risk";
  }

  return result;
}

/**
 * Parse traditional scores HTML from the Gradio API
 */
function parseTraditionalScores(
  html: string
): Pick<
  LivePredictionResult,
  "meld" | "meldNa" | "childPughScore" | "childPughClass"
> {
  const result: Pick<
    LivePredictionResult,
    "meld" | "meldNa" | "childPughScore" | "childPughClass"
  > = {
    meld: null,
    meldNa: null,
    childPughScore: null,
    childPughClass: null,
  };

  // Try markdown format
  const m1 = html.match(/MELD Score:\*\*\s*(\d+)/);
  if (m1) result.meld = parseInt(m1[1]);
  const m2 = html.match(/MELD-Na Score:\*\*\s*(\d+)/);
  if (m2) result.meldNa = parseInt(m2[1]);
  const m3 = html.match(/Child-Pugh Score:\*\*\s*(\d+)\s*\(Class\s*([ABC])\)/);
  if (m3) {
    result.childPughScore = parseInt(m3[1]);
    result.childPughClass = m3[2];
  }

  // Try HTML format
  if (result.meld === null) {
    const hm1 = html.match(/>\s*(\d+)\s*<\/div>[^<]*<div[^>]*>MELD Score/);
    if (hm1) result.meld = parseInt(hm1[1]);
  }
  if (result.meldNa === null) {
    const hm2 = html.match(/>\s*(\d+)\s*<\/div>[^<]*<div[^>]*>MELD-Na Score/);
    if (hm2) result.meldNa = parseInt(hm2[1]);
  }
  if (result.childPughScore === null) {
    const hm3 = html.match(
      />\s*(\d+)\s*<\/div>[^<]*<div[^>]*>Child-Pugh \(Class ([ABC])\)/
    );
    if (hm3) {
      result.childPughScore = parseInt(hm3[1]);
      result.childPughClass = hm3[2];
    }
  }

  return result;
}

/**
 * Call the live HF Space Gradio API and return parsed results
 */
export async function callLiveModel(
  input: PatientInput
): Promise<LivePredictionResult> {
  const data = buildGradioData(input);

  // Step 1: Submit the prediction request
  const callResp = await fetch(
    `${HF_SPACE_URL}/call/predict_patient_outcome`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    }
  );

  if (!callResp.ok) {
    throw new Error(`API returned ${callResp.status}`);
  }

  const callResult = await callResp.json();
  const eventId = callResult.event_id;

  // Step 2: Fetch the result using SSE endpoint
  const resultResp = await fetch(
    `${HF_SPACE_URL}/call/predict_patient_outcome/${eventId}`
  );
  const text = await resultResp.text();

  let outputs: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      outputs = JSON.parse(line.substring(6));
      break;
    }
  }

  if (outputs.length < 2) {
    throw new Error("Unexpected API response format");
  }

  // Parse the 5 outputs: [ml_html, traditional_html, comparison_html, global_shap, patient_shap]
  const mlParsed = parseMLOutput(outputs[0]);
  const tradParsed = parseTraditionalScores(outputs[1]);

  return {
    probability: mlParsed.probability ?? null,
    ciLower: mlParsed.ciLower ?? null,
    ciUpper: mlParsed.ciUpper ?? null,
    riskCategory: mlParsed.riskCategory ?? null,
    prediction: mlParsed.prediction ?? null,
    meld: tradParsed.meld,
    meldNa: tradParsed.meldNa,
    childPughScore: tradParsed.childPughScore,
    childPughClass: tradParsed.childPughClass,
  };
}

/**
 * Verify local prediction against the live model
 */
export async function verifyWithLiveModel(
  input: PatientInput,
  localProbability: number,
  localMeld: number,
  localMeldNa: number,
  localChildPugh: number
): Promise<VerificationResult> {
  const start = Date.now();

  try {
    const live = await callLiveModel(input);
    const latencyMs = Date.now() - start;

    const probDiff =
      live.probability != null
        ? Math.abs(live.probability - localProbability)
        : 1;

    return {
      live,
      concordance: {
        probabilityDiff: probDiff,
        isClose: probDiff <= 0.05,
        meldMatch: live.meld === localMeld,
        meldNaMatch: live.meldNa === localMeldNa,
        childPughMatch: live.childPughScore === localChildPugh,
      },
      latencyMs,
      error: null,
    };
  } catch (err: any) {
    return {
      live: {
        probability: null,
        ciLower: null,
        ciUpper: null,
        riskCategory: null,
        prediction: null,
        meld: null,
        meldNa: null,
        childPughScore: null,
        childPughClass: null,
      },
      concordance: {
        probabilityDiff: -1,
        isClose: false,
        meldMatch: false,
        meldNaMatch: false,
        childPughMatch: false,
      },
      latencyMs: Date.now() - start,
      error: err.message || "Unknown error",
    };
  }
}
