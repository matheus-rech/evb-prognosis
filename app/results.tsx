import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  Share,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import { shareAsync } from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { VaporBackground } from "@/components/vapor-background";
import { ScoreRing } from "@/components/score-ring";
import type { PatientInput, PredictionResult } from "@/lib/types";
import { CLINICAL_REFERENCES } from "@/lib/types";
import { buildAssessment, useAssessment } from "@/lib/assessment-context";
import { generateReportHTML } from "@/lib/services/pdf-report";
import { validateAllFields } from "@/lib/services/validation";
import { computeFeatureImportance } from "@/lib/services/feature-importance";
import { FeatureImportanceChart } from "@/components/feature-importance-chart";
import { PDPChart } from "@/components/pdp-chart";
import { LiveModelVerification } from "@/components/live-verification";

interface ResultData {
  input: PatientInput;
  result: PredictionResult;
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string }>();
  const [exporting, setExporting] = useState(false);
  const { addAssessment } = useAssessment();
  const savedRef = useRef(false);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(params.data || "{}") as ResultData;
    } catch {
      return null;
    }
  }, [params.data]);

  // Auto-save to history on first render (guard prevents double-save in Strict Mode)
  useEffect(() => {
    if (!savedRef.current && parsed?.input && parsed?.result) {
      savedRef.current = true;
      addAssessment(buildAssessment(parsed.input, parsed.result));
    }
  }, [parsed, addAssessment]);

  if (!parsed || !parsed.result) {
    return (
      <ScreenContainer containerClassName="bg-transparent">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#030708" }]} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#999", fontSize: 16 }}>No results available</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const { input, result } = parsed;
  const pct = result.probability * 100;

  const riskColor =
    result.riskCategory === "Low Risk"
      ? "#00e676"
      : result.riskCategory === "Moderate Risk"
        ? "#ffa726"
        : "#ff4b2b";

  const riskBg =
    result.riskCategory === "Low Risk"
      ? "rgba(0,230,118,0.12)"
      : result.riskCategory === "Moderate Risk"
        ? "rgba(255,167,38,0.12)"
        : "rgba(255,75,43,0.12)";

  // Validation warnings for the results summary
  const validationWarnings = useMemo(
    () => validateAllFields(input as unknown as Record<string, number | string>),
    [input]
  );

  // Feature importance (SHAP-like tree path decomposition)
  const featureImportance = useMemo(
    () => computeFeatureImportance(input),
    [input]
  );

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html = generateReportHTML(input, result);
      if (Platform.OS === "web") {
        // On web, open print dialog
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        // On native, generate PDF and share
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "EVB Prognosis Report",
        });
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert("Export Error", "Failed to generate PDF report.");
    } finally {
      setExporting(false);
    }
  };

  const handleShareJSON = async () => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        disclaimer: "FOR RESEARCH/EDUCATIONAL USE ONLY - NOT MEDICAL ADVICE",
        calculatorVersion: "2.0",
        prediction: {
          probability: `${pct.toFixed(1)}%`,
          riskCategory: result.riskCategory,
          prediction: result.prediction === 1 ? "Death" : "Survival",
          ci95: `${(result.ciLower * 100).toFixed(1)}% – ${(result.ciUpper * 100).toFixed(1)}%`,
        },
        traditionalScores: {
          MELD: result.meld,
          MELDNa: result.meldNa,
          ChildPughScore: result.childPughScore,
          ChildPughClass: result.childPughClass,
        },
      };
      await Share.share({
        message: JSON.stringify(data, null, 2),
        title: "EVB Risk Assessment",
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // ignore
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-transparent">
      <View style={StyleSheet.absoluteFill}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#030708" }} />
        <VaporBackground />
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Results</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== ML Model Results ===== */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>🤖 ML Model Results</Text>
          <Text style={styles.sectionSub}>Calibrated Random Forest Prediction</Text>

          {/* Score Ring */}
          <View style={styles.ringSection}>
            <ScoreRing probability={result.probability} size={180} />
          </View>

          {/* Risk Badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.riskBadge, { backgroundColor: riskBg, borderColor: riskColor }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                {result.riskCategory.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Metrics */}
          <View style={styles.metricsBlock}>
            <MetricRow
              label="Prediction"
              value={result.prediction === 1 ? "Death" : "Survival"}
              valueColor={result.prediction === 1 ? "#ff4b2b" : "#00e676"}
            />
            <MetricRow
              label="Probability"
              value={`${pct.toFixed(1)}%`}
              valueColor={riskColor}
            />
            <MetricRow
              label="95% CI"
              value={`${(result.ciLower * 100).toFixed(1)}% – ${(result.ciUpper * 100).toFixed(1)}%`}
              valueColor="#aaa"
            />
            <MetricRow
              label="Risk Category"
              value={result.riskCategory}
              valueColor={riskColor}
              isLast
            />
          </View>
        </View>

        {/* ===== Traditional Scores ===== */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>📊 Traditional Clinical Scores</Text>
          <Text style={styles.sectionSub}>Established Hepatology Scoring Systems</Text>

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>MELD SCORE</Text>
            <Text style={styles.scoreValue}>{result.meld}</Text>
            <Text style={styles.scoreSub}>3-month mortality: {result.meldMortality}</Text>
          </View>

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>MELD-Na SCORE</Text>
            <Text style={styles.scoreValue}>{result.meldNa}</Text>
            <Text style={styles.scoreSub}>Sodium-adjusted MELD</Text>
          </View>

          <View style={[styles.scoreBlock, { borderBottomWidth: 0 }]}>
            <Text style={styles.scoreLabel}>CHILD-PUGH CLASSIFICATION</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
              <Text style={styles.scoreValue}>{result.childPughScore}</Text>
              <View
                style={[
                  styles.cpBadge,
                  {
                    backgroundColor:
                      result.childPughClass === "A"
                        ? "rgba(0,230,118,0.15)"
                        : result.childPughClass === "B"
                          ? "rgba(255,167,38,0.15)"
                          : "rgba(255,75,43,0.15)",
                    borderColor:
                      result.childPughClass === "A"
                        ? "#00e676"
                        : result.childPughClass === "B"
                          ? "#ffa726"
                          : "#ff4b2b",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cpBadgeText,
                    {
                      color:
                        result.childPughClass === "A"
                          ? "#00e676"
                          : result.childPughClass === "B"
                            ? "#ffa726"
                            : "#ff4b2b",
                    },
                  ]}
                >
                  Class {result.childPughClass}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== Feature Importance ===== */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>🔍 Feature Importance</Text>
          <Text style={styles.sectionSub}>
            Per-feature contributions to this prediction (Tree Path Decomposition)
          </Text>
          <FeatureImportanceChart result={featureImportance} topN={12} />
        </View>

        {/* ===== Partial Dependence Plot ===== */}
        <View style={styles.glassCard}>
          <PDPChart input={input} />
        </View>

        {/* ===== Live Model Verification ===== */}
        <View style={styles.glassCard}>
          <LiveModelVerification input={input} localResult={result} />
        </View>

        {/* ===== Model Comparison ===== */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>📈 Model Comparison</Text>
          <Text style={styles.sectionSub}>AUC-ROC Performance Metrics</Text>

          {[
            { name: "Random Forest (ML)", auc: 0.85, color: "#00d2ff" },
            { name: "MELD", auc: 0.71, color: "#ffa726" },
            { name: "MELD-Na", auc: 0.73, color: "#ffa726" },
            { name: "Child-Pugh", auc: 0.65, color: "#ffa726" },
          ].map((m) => (
            <View key={m.name} style={styles.compRow}>
              <View style={styles.compLabelRow}>
                <Text style={styles.compLabel}>{m.name}</Text>
                <Text style={styles.compValue}>{m.auc.toFixed(2)}</Text>
              </View>
              <View style={styles.compTrack}>
                <View
                  style={[
                    styles.compFill,
                    { width: `${m.auc * 100}%`, backgroundColor: m.color },
                  ]}
                />
              </View>
            </View>
          ))}

          <Text style={styles.compNote}>
            The ML model demonstrates superior discrimination compared to
            traditional scoring systems for 1-year mortality prediction.
          </Text>
        </View>

        {/* Validation Warnings Summary */}
        {validationWarnings.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>⚠️ Validation Alerts</Text>
            <Text style={styles.sectionSub}>
              {validationWarnings.length} value{validationWarnings.length > 1 ? "s" : ""} outside normal clinical ranges
            </Text>
            {validationWarnings.map((w, i) => (
              <View key={i} style={styles.warningRow}>
                <Text style={[
                  styles.warningBadge,
                  { color: w.severity === "critical" ? "#ff4b2b" : "#ffa726" },
                ]}>
                  {w.severity === "critical" ? "⚠" : "⚡"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningLabel}>
                    {w.key.replace(/_/g, " ").toUpperCase()}: {w.value}
                  </Text>
                  <Text style={styles.warningMsg}>{w.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Export Buttons */}
        <View style={styles.exportRow}>
          <Pressable
            onPress={handleExportPDF}
            disabled={exporting}
            style={({ pressed }) => [
              styles.exportBtn,
              { flex: 1 },
              pressed && { borderColor: "#00d2ff", opacity: 0.8 },
            ]}
          >
            <Text style={styles.exportBtnText}>
              {exporting ? "GENERATING..." : "📄 PDF REPORT"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShareJSON}
            style={({ pressed }) => [
              styles.exportBtn,
              { flex: 1 },
              pressed && { borderColor: "#00d2ff", opacity: 0.8 },
            ]}
          >
            <Text style={styles.exportBtnText}>📤 SHARE DATA</Text>
          </Pressable>
        </View>

        {/* References */}
        <View style={styles.glassCard}>
          <Text style={styles.refTitle}>📚 REFERENCES</Text>
          {CLINICAL_REFERENCES.map((ref, i) => (
            <Text key={i} style={styles.refText}>
              [{i + 1}] {ref}
            </Text>
          ))}
        </View>

        {/* New Assessment */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [
            styles.newBtn,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Text style={styles.newBtnText}>🔄 NEW ASSESSMENT</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
  isLast,
}: {
  label: string;
  value: string;
  valueColor: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.metricRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
      ]}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backLink: {
    color: "#00d2ff",
    fontSize: 15,
    fontWeight: "500",
  },
  headerTitle: {
    color: "#e0e0e0",
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  backBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  backBtnText: {
    color: "#00d2ff",
    fontSize: 14,
    fontWeight: "600",
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e0e0e0",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 11,
    color: "#888",
    marginBottom: 16,
  },
  ringSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  badgeRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  riskBadge: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  metricsBlock: {
    gap: 0,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metricLabel: {
    fontSize: 13,
    color: "#aaa",
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  scoreBlock: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#888",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#e0e0e0",
  },
  scoreSub: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  cpBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cpBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  compRow: {
    marginBottom: 12,
  },
  compLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  compLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "500",
  },
  compValue: {
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: "700",
  },
  compTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  compFill: {
    height: "100%",
    borderRadius: 3,
  },
  compNote: {
    fontSize: 11,
    color: "#666",
    marginTop: 8,
    lineHeight: 16,
  },
  exportRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginBottom: 16,
  },
  exportBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center" as const,
  },
  warningRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  warningBadge: {
    fontSize: 14,
    lineHeight: 18,
  },
  warningLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#e0e0e0",
  },
  warningMsg: {
    fontSize: 10,
    color: "#888",
    lineHeight: 14,
    marginTop: 2,
  },
  exportBtnText: {
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  refTitle: {
    color: "#00d2ff",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    marginBottom: 12,
  },
  refText: {
    color: "#999",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 6,
  },
  newBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  newBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
