import React, { useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { VaporBackground } from "@/components/vapor-background";
import {
  SliderField,
  SelectField,
  SectionTitle,
} from "@/components/form-fields";
import { DEFAULT_PATIENT, PRESETS } from "@/lib/types";
import type { PatientInput, Sex, Race, EtiologyCirrosis, YesNo, Therapy } from "@/lib/types";
import { predictMortality } from "@/lib/services/ml-inference";
import { buildPredictionResult } from "@/lib/services/clinical-scores";
import { validateField, getTabValidationCounts } from "@/lib/services/validation";
import type { ValidationResult } from "@/lib/services/validation";

type Tab = "general" | "clinical" | "lab";

const TAB_KEYS: Record<Tab, string[]> = {
  general: ["age"],
  clinical: ["terlipressin_dose", "time_to_endoscophy_hours"],
  lab: [
    "albumin", "total_bilirrubin", "direct_bilirrubina", "inr", "creatinine",
    "platelets", "hemoglobin", "hematocrit", "leucocytes", "ast", "alt",
    "sodium", "potassium",
  ],
};

function useValidation(input: PatientInput, key: string): { warning?: string; warningColor?: string } {
  const val = (input as unknown as Record<string, unknown>)[key];
  if (typeof val !== "number") return {};
  const result = validateField(key, val);
  if (!result) return {};
  return {
    warning: result.message,
    warningColor: result.severity === "critical" ? "#ff4b2b" : "#ffa726",
  };
}

export default function CalculatorScreen() {
  const [input, setInput] = useState<PatientInput>({ ...DEFAULT_PATIENT });
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const router = useRouter();

  // Compute validation counts per tab for badge display
  const tabBadges = useMemo(() => {
    const result: Record<Tab, { warnings: number; criticals: number }> = {
      general: getTabValidationCounts(input as unknown as Record<string, number | string>, TAB_KEYS.general),
      clinical: getTabValidationCounts(input as unknown as Record<string, number | string>, TAB_KEYS.clinical),
      lab: getTabValidationCounts(input as unknown as Record<string, number | string>, TAB_KEYS.lab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    };
    return result;
  }, [input]);

  const update = useCallback(
    <K extends keyof PatientInput>(key: K, val: PatientInput[K]) => {
      setInput((prev: PatientInput) => ({ ...prev, [key]: val }));
    },
    []
  );

  const loadPreset = useCallback((name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) {
      setInput({ ...preset.data });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, []);

  const handleCalculate = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const probability = predictMortality(input);
    const result = buildPredictionResult(probability, input);
    router.push({
      pathname: "/results",
      params: { data: JSON.stringify({ input, result }) },
    });
  }, [input, router]);

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: "general", label: "General Info", emoji: "1️⃣" },
    { key: "clinical", label: "Clinical Status", emoji: "2️⃣" },
    { key: "lab", label: "Laboratory", emoji: "3️⃣" },
  ];

  return (
    <ScreenContainer containerClassName="bg-transparent">
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.bgBase} />
        <VaporBackground />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Disclaimer Banner */}
        <View style={styles.disclaimerBanner}>
          <Text style={styles.disclaimerText}>
            CLINICAL DECISION SUPPORT TOOL — FOR RESEARCH USE ONLY
          </Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.titleText}>EVB PROGNOSIS</Text>
          <Text style={styles.titleGradient}>1-Year Mortality Risk Calculator</Text>
          <Text style={styles.subtitleText}>
            Advanced Machine Learning Model for Predicting Post-Bleeding
            Survival in Cirrhotic Patients
          </Text>
        </View>

        {/* Quick Start Presets */}
        <View style={styles.glassCard}>
          <Text style={styles.presetLabel}>QUICK START — CLINICAL SCENARIOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.name}
                onPress={() => loadPreset(p.name)}
                style={({ pressed }) => [
                  styles.presetChip,
                  pressed && { opacity: 0.7, borderColor: "#00d2ff" },
                ]}
              >
                <Text style={styles.presetChipText}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={({ pressed }) => [
                styles.tabBtn,
                activeTab === t.key && styles.tabBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                {t.emoji} {t.label}
              </Text>
              {(tabBadges[t.key].criticals > 0 || tabBadges[t.key].warnings > 0) && (
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: tabBadges[t.key].criticals > 0 ? '#ff4b2b' : '#ffa726' },
                ]}>
                  <Text style={styles.tabBadgeText}>
                    {tabBadges[t.key].criticals + tabBadges[t.key].warnings}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Tab 1: General Info */}
        {activeTab === "general" && (
          <View style={styles.glassCard}>
            <SectionTitle>General Info</SectionTitle>

            <SliderField
              label="Age"
              value={input.age}
              min={18}
              max={100}
              step={1}
              unit="years"
              {...useValidation(input, "age")}
              onValueChange={(v) => update("age", v)}
            />

            <SelectField
              label="Sex"
              value={input.sex}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
              ]}
              onValueChange={(v) => update("sex", v as Sex)}
            />

            <SelectField
              label="Race"
              value={input.race}
              tooltip="Race is included as it was identified as a relevant predictor in the model."
              options={[
                { label: "White", value: "white" },
                { label: "Black", value: "black" },
                { label: "Other", value: "other" },
              ]}
              onValueChange={(v) => update("race", v as Race)}
            />
            <SelectField
              label="Etiology of Cirrhosis"
              value={input.etiology_cirrosis}
              options={[
                { label: "Alcohol", value: "alcohol" },
                { label: "HCV", value: "hcv" },
                { label: "Alcohol + HCV", value: "alcohol+hcv" },
                { label: "Cryptogenic", value: "crypto" },
                { label: "NASH", value: "nash" },
                { label: "HBV", value: "hb" },
              ]}
              onValueChange={(v) => update("etiology_cirrosis", v as EtiologyCirrosis)}
            />

            <SelectField
              label="Hepatorenal Syndrome"
              value={input.hepatorenal_syndrome}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("hepatorenal_syndrome", v as YesNo)}
            />

            <SelectField
              label="Omeprazole"
              value={input.omeprazole}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("omeprazole", v as YesNo)}
            />

            <SelectField
              label="Spironolactone"
              value={input.spironolactone}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("spironolactone", v as YesNo)}
            />

            <SelectField
              label="Furosemide"
              value={input.furosemide}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("furosemide", v as YesNo)}
            />

            <SelectField
              label="Propanolol"
              value={input.propanolol}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("propanolol", v as YesNo)}
            />

            <SelectField
              label="Dialysis"
              value={input.dialisis}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("dialisis", v as YesNo)}
            />
          </View>
        )}

        {/* Tab 2: Clinical Status */}
        {activeTab === "clinical" && (
          <View style={styles.glassCard}>
            <SectionTitle>Clinical Status</SectionTitle>

            <SelectField
              label="Portal Vein Thrombosis"
              value={input.portal_vein_thrombosis}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("portal_vein_thrombosis", v as YesNo)}
            />

            <SelectField
              label="Ascites"
              value={input.ascitis}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("ascitis", v as YesNo)}
            />

            <SelectField
              label="Hepatocellular Carcinoma"
              value={input.hepatocellular_carcinoma}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("hepatocellular_carcinoma", v as YesNo)}
            />

            <SelectField
              label="Varices"
              value={input.varices}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("varices", v as YesNo)}
            />

            <SelectField
              label="Red Wale Marks"
              value={input.red_wale_marks}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("red_wale_marks", v as YesNo)}
            />

            <SelectField
              label="Rupture Point"
              value={input.rupture_point}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("rupture_point", v as YesNo)}
            />

            <SelectField
              label="Active Bleeding"
              value={input.active_bleeding}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("active_bleeding", v as YesNo)}
            />

            <SelectField
              label="Rebleeding"
              value={input.rebleeding}
              options={[
                { label: "No", value: "no" },
                { label: "Yes", value: "yes" },
              ]}
              onValueChange={(v) => update("rebleeding", v as YesNo)}
            />

            <SelectField
              label="Therapy"
              value={input.therapy}
              options={[
                { label: "Banding", value: "Banding" },
                { label: "No Therapy", value: "no therapy" },
              ]}
              onValueChange={(v) => update("therapy", v as Therapy)}
            />

            <SliderField
              label="Terlipressin Dose"
              value={input.terlipressin_dose}
              min={0}
              max={20}
              step={1}
              unit="mg"
              {...useValidation(input, "terlipressin_dose")}
              onValueChange={(v) => update("terlipressin_dose", v)}
            />

            <SliderField
              label="Time to Endoscopy"
              value={input.time_to_endoscophy_hours}
              min={0}
              max={48}
              step={1}
              unit="hours"
              onValueChange={(v) => update("time_to_endoscophy_hours", v)}
            />
          </View>
        )}

        {/* Tab 3: Laboratory Values */}
        {activeTab === "lab" && (
          <View style={styles.glassCard}>
            <SectionTitle>Liver Function Tests</SectionTitle>

            <SliderField
              label="Albumin"
              value={input.albumin}
              min={1}
              max={5}
              step={0.1}
              unit="g/dL"
              {...useValidation(input, "albumin")}
              onValueChange={(v) => update("albumin", v)}
            />

            <SliderField
              label="Total Bilirubin"
              value={input.total_bilirrubin}
              min={0.1}
              max={30}
              step={0.1}
              unit="mg/dL"
              {...useValidation(input, "total_bilirrubin")}
              onValueChange={(v) => update("total_bilirrubin", v)}
            />

            <SliderField
              label="Direct Bilirubin"
              value={input.direct_bilirrubina}
              min={0.1}
              max={10}
              step={0.1}
              unit="mg/dL"
              {...useValidation(input, "direct_bilirrubina")}
              onValueChange={(v) => update("direct_bilirrubina", v)}
            />

            <SliderField
              label="INR"
              value={input.inr}
              min={0.5}
              max={5}
              step={0.1}
              {...useValidation(input, "inr")}
              onValueChange={(v) => update("inr", v)}
            />

            <SliderField
              label="Creatinine"
              value={input.creatinine}
              min={0.1}
              max={10}
              step={0.1}
              unit="mg/dL"
              {...useValidation(input, "creatinine")}
              onValueChange={(v) => update("creatinine", v)}
            />

            <SectionTitle>Complete Blood Count</SectionTitle>

            <SliderField
              label="Platelets"
              value={input.platelets}
              min={10}
              max={500}
              step={1}
              unit="×10³/μL"
              {...useValidation(input, "platelets")}
              onValueChange={(v) => update("platelets", v)}
            />

            <SliderField
              label="Hemoglobin"
              value={input.hemoglobin}
              min={5}
              max={20}
              step={0.1}
              unit="g/dL"
              {...useValidation(input, "hemoglobin")}
              onValueChange={(v) => update("hemoglobin", v)}
            />

            <SliderField
              label="Hematocrit"
              value={input.hematocrit}
              min={15}
              max={60}
              step={0.1}
              unit="%"
              {...useValidation(input, "hematocrit")}
              onValueChange={(v) => update("hematocrit", v)}
            />

            <SliderField
              label="Leukocytes"
              value={input.leucocytes}
              min={1}
              max={50}
              step={0.1}
              unit="×10³/μL"
              {...useValidation(input, "leucocytes")}
              onValueChange={(v) => update("leucocytes", v)}
            />

            <SectionTitle>Liver Enzymes & Electrolytes</SectionTitle>

            <SliderField
              label="AST"
              value={input.ast}
              min={10}
              max={500}
              step={1}
              unit="U/L"
              {...useValidation(input, "ast")}
              onValueChange={(v) => update("ast", v)}
            />

            <SliderField
              label="ALT"
              value={input.alt}
              min={10}
              max={500}
              step={1}
              unit="U/L"
              {...useValidation(input, "alt")}
              onValueChange={(v) => update("alt", v)}
            />

            <SliderField
              label="Sodium"
              value={input.sodium}
              min={120}
              max={160}
              step={1}
              unit="mEq/L"
              {...useValidation(input, "sodium")}
              onValueChange={(v) => update("sodium", v)}
            />

            <SliderField
              label="Potassium"
              value={input.potassium}
              min={2}
              max={6}
              step={0.1}
              unit="mEq/L"
              {...useValidation(input, "potassium")}
              onValueChange={(v) => update("potassium", v)}
            />
          </View>
        )}

        {/* Calculate Button */}
        <Pressable
          onPress={handleCalculate}
          style={({ pressed }) => [
            styles.calcButton,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Text style={styles.calcButtonText}>🔮 CALCULATE RISK ASSESSMENT</Text>
        </Pressable>

        {/* Citation */}
        <View style={styles.citationBox}>
          <Text style={styles.citationText}>
            Rech MM, Soldera J, Corso LL et al. Development, Internal and
            Prospective validation of a machine learning model for the prediction
            of mortality in cirrhotic patients with acute esophageal variceal
            bleeding. Accepted for publication. 2025.
          </Text>
          <Text style={[styles.citationText, { marginTop: 4 }]}>
            Contact: mmrech@ucs.br | Version: 2.0
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030708",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  disclaimerBanner: {
    borderWidth: 1,
    borderColor: "rgba(255,165,0,0.4)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "rgba(255,165,0,0.08)",
  },
  disclaimerText: {
    color: "#ffa500",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e0e0e0",
    letterSpacing: 1,
  },
  titleGradient: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00d2ff",
    marginTop: 4,
  },
  subtitleText: {
    marginTop: 8,
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      web: { backdropFilter: "blur(20px)" } as any,
      default: {},
    }),
  },
  presetLabel: {
    fontSize: 10,
    color: "#999",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  presetChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  presetChipText: {
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: "500",
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "rgba(0,210,255,0.1)",
    borderColor: "#00d2ff",
  },
  tabBtnText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#00d2ff",
  },
  tabBadge: {
    position: "absolute" as const,
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700" as const,
  },
  calcButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  calcButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  citationBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  citationText: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    lineHeight: 14,
  },
});
