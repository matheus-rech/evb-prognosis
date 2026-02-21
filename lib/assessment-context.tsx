/**
 * Assessment Context
 *
 * Provides global state for saved assessments (history) with persistence
 * via AsyncStorage on native and localStorage on web.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import type {
  Assessment,
  AssessmentPatientData,
  AssessmentResult,
  PatientInput,
  PredictionResult,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Transform helpers (PatientInput + PredictionResult → nested Assessment types)
// ---------------------------------------------------------------------------

/** Convert flat PatientInput → nested AssessmentPatientData (also fixes spelling typos). */
export function toAssessmentPatientData(input: PatientInput): AssessmentPatientData {
  return {
    generalInfo: {
      age: input.age,
      sex: input.sex,
      race: input.race,
      etiology_cirrosis: input.etiology_cirrosis,
    },
    clinicalStatus: {
      ascitis: input.ascitis,
      therapy: input.therapy,
      portal_vein_thrombosis: input.portal_vein_thrombosis,
      hepatocellular_carcinoma: input.hepatocellular_carcinoma,
      varices: input.varices,
      red_wale_marks: input.red_wale_marks,
      rupture_point: input.rupture_point,
      active_bleeding: input.active_bleeding,
      rebleeding: input.rebleeding,
      hepatorenal_syndrome: input.hepatorenal_syndrome,
      terlipressin_dose: input.terlipressin_dose,
      time_to_endoscophy_hours: input.time_to_endoscophy_hours,
    },
    labValues: {
      albumin: input.albumin,
      // Correct double-r typos from original dataset column names
      total_bilirubin: input.total_bilirrubin,
      direct_bilirubin: input.direct_bilirrubina,
      inr: input.inr,
      creatinine: input.creatinine,
      sodium: input.sodium,
      potassium: input.potassium,
      platelets: input.platelets,
      ast: input.ast,
      alt: input.alt,
      hemoglobin: input.hemoglobin,
      hematocrit: input.hematocrit,
      leucocytes: input.leucocytes,
    },
  };
}

/** Convert flat PredictionResult → nested AssessmentResult. */
export function toAssessmentResult(result: PredictionResult): AssessmentResult {
  return {
    mlResult: {
      probability: result.probability,
      ciLower: result.ciLower,
      ciUpper: result.ciUpper,
      prediction: result.prediction,
      riskCategory: result.riskCategory,
    },
    traditionalScores: {
      meld: result.meld,
      meldNa: result.meldNa,
      childPugh: result.childPughScore,
      childPughClass: result.childPughClass,
    },
  };
}

/** Build a complete Assessment from raw input + prediction result. */
export function buildAssessment(input: PatientInput, result: PredictionResult): Assessment {
  return {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    patientData: toAssessmentPatientData(input),
    result: toAssessmentResult(result),
  };
}

// ---------------------------------------------------------------------------
// Storage helpers (AsyncStorage on native, localStorage on web)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "evb_prognosis_assessments";

async function loadFromStorage(): Promise<Assessment[]> {
  try {
    if (Platform.OS === "web") {
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
      return raw ? (JSON.parse(raw) as Assessment[]) : [];
    }
    const AsyncStorage =
      (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Assessment[]) : [];
  } catch {
    return [];
  }
}

async function saveToStorage(assessments: Assessment[]): Promise<void> {
  try {
    const json = JSON.stringify(assessments);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, json);
      }
      return;
    }
    const AsyncStorage =
      (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Silently fail — storage is best-effort
  }
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

interface AssessmentState {
  assessments: Assessment[];
  isLoading: boolean;
}

interface AssessmentContextValue {
  state: AssessmentState;
  addAssessment: (assessment: Assessment) => Promise<void>;
  removeAssessment: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

export function AssessmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AssessmentState>({
    assessments: [],
    isLoading: true,
  });

  // Load persisted assessments on mount
  useEffect(() => {
    loadFromStorage().then((assessments) => {
      setState({ assessments, isLoading: false });
    });
  }, []);

  const refreshHistory = useCallback(async () => {
    const assessments = await loadFromStorage();
    setState((prev) => ({ ...prev, assessments }));
  }, []);

  const addAssessment = useCallback(async (assessment: Assessment) => {
    setState((prev) => {
      const next = [assessment, ...prev.assessments];
      saveToStorage(next);
      return { ...prev, assessments: next };
    });
  }, []);

  const removeAssessment = useCallback(async (id: string) => {
    setState((prev) => {
      const next = prev.assessments.filter((a) => a.id !== id);
      saveToStorage(next);
      return { ...prev, assessments: next };
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setState((prev) => {
      saveToStorage([]);
      return { ...prev, assessments: [] };
    });
  }, []);

  return (
    <AssessmentContext.Provider
      value={{ state, addAssessment, removeAssessment, clearHistory, refreshHistory }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment(): AssessmentContextValue {
  const ctx = useContext(AssessmentContext);
  if (!ctx) {
    throw new Error("useAssessment must be used within an AssessmentProvider");
  }
  return ctx;
}
