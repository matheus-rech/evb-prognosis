import React from "react";
import { ScrollView, Text, View, StyleSheet, Platform, Linking, Pressable } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { VaporBackground } from "@/components/vapor-background";
import { CLINICAL_REFERENCES } from "@/lib/types";

export default function InfoScreen() {
  return (
    <ScreenContainer containerClassName="bg-transparent">
      <View style={StyleSheet.absoluteFill}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#030708" }} />
        <VaporBackground />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.titleText}>EVB Prognosis</Text>
          <Text style={styles.titleAccent}>Calculator</Text>
          <Text style={styles.version}>v2.0-Clinical</Text>
        </View>

        {/* About */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.bodyText}>
            This calculator estimates 1-year mortality risk in cirrhotic patients
            presenting with esophageal variceal bleeding (EVB). It combines
            traditional clinical scoring systems (MELD, MELD-Na, Child-Pugh, ALBI)
            with a heuristic risk model weighted by published mortality predictors.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            The underlying Random Forest machine learning model was trained on a
            cohort of cirrhotic patients and achieved an AUC of 0.915 in validation,
            outperforming traditional scores.
          </Text>
        </View>

        {/* Scoring Systems */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>SCORING SYSTEMS</Text>

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreName}>MELD Score</Text>
            <Text style={styles.scoreFormula}>
              3.78 × ln(Bilirubin) + 11.2 × ln(INR) + 9.57 × ln(Creatinine) + 6.43
            </Text>
            <Text style={styles.scoreDesc}>
              Model for End-Stage Liver Disease. Predicts 3-month mortality in
              patients with cirrhosis. Range: 6–40. Used for liver transplant
              prioritization.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreName}>MELD-Na</Text>
            <Text style={styles.scoreFormula}>
              MELD + 1.32 × (137 − Na) − 0.033 × MELD × (137 − Na)
            </Text>
            <Text style={styles.scoreDesc}>
              Sodium-adjusted MELD. Hyponatremia is an independent predictor of
              mortality in cirrhosis. Na clamped to 125–137 mEq/L.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreName}>Child-Pugh Classification</Text>
            <Text style={styles.scoreDesc}>
              Assesses prognosis of chronic liver disease using 5 clinical measures:
              bilirubin, albumin, INR, ascites, and encephalopathy. Class A (5–6):
              well-compensated. Class B (7–9): significant compromise. Class C
              (10–15): decompensated.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreName}>ALBI Grade</Text>
            <Text style={styles.scoreFormula}>
              (log₁₀ Bilirubin × 0.66) + (Albumin × −0.085)
            </Text>
            <Text style={styles.scoreDesc}>
              Albumin-Bilirubin grade. Evidence-based, objective assessment of liver
              function. Grade 1 (≤−2.60): best prognosis. Grade 2 (−2.60 to −1.39):
              intermediate. Grade 3 ({">"}−1.39): worst prognosis.
            </Text>
          </View>
        </View>

        {/* Model Performance */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>MODEL PERFORMANCE</Text>
          <Text style={styles.bodyText}>
            Comparison of predictive models based on validation study AUC values:
          </Text>

          <View style={styles.perfTable}>
            {[
              { name: "Random Forest (ML)", auc: "0.915", sens: "80%", spec: "86%" },
              { name: "MELD-Na", auc: "0.742", sens: "69%", spec: "72%" },
              { name: "MELD", auc: "0.726", sens: "67%", spec: "70%" },
              { name: "Child-Pugh", auc: "0.685", sens: "63%", spec: "67%" },
            ].map((row, i) => (
              <View key={row.name} style={[styles.perfRow, i === 0 && styles.perfRowHighlight]}>
                <Text style={[styles.perfName, i === 0 && { color: "#00d2ff" }]}>
                  {row.name}
                </Text>
                <Text style={styles.perfVal}>{row.auc}</Text>
                <Text style={styles.perfVal}>{row.sens}</Text>
                <Text style={styles.perfVal}>{row.spec}</Text>
              </View>
            ))}
          </View>

          <View style={styles.perfHeaderRow}>
            <Text style={styles.perfHeaderCell}>Model</Text>
            <Text style={styles.perfHeaderCell}>AUC</Text>
            <Text style={styles.perfHeaderCell}>Sens</Text>
            <Text style={styles.perfHeaderCell}>Spec</Text>
          </View>
        </View>

        {/* References */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>REFERENCES</Text>
          {CLINICAL_REFERENCES.map((ref, i) => (
            <Text key={i} style={styles.refText}>
              [{i + 1}] {ref}
            </Text>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>DISCLAIMER</Text>
          <Text style={styles.disclaimerText}>
            This tool is for research and educational purposes only. It is NOT
            intended for clinical decision-making and has NOT been validated for
            clinical use. Results should be interpreted by qualified healthcare
            professionals in conjunction with clinical judgment. Not FDA approved.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  titleText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e0e0e0",
    letterSpacing: -0.5,
  },
  titleAccent: {
    fontSize: 28,
    fontWeight: "700",
    color: "#00d2ff",
    letterSpacing: -0.5,
  },
  version: {
    marginTop: 6,
    fontSize: 11,
    color: "#666",
    fontFamily: Platform.OS === "web" ? "'JetBrains Mono', monospace" : undefined,
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
    fontSize: 11,
    color: "#00d2ff",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  bodyText: {
    color: "#999",
    fontSize: 13,
    lineHeight: 20,
  },
  scoreBlock: {
    paddingVertical: 8,
  },
  scoreName: {
    color: "#e0e0e0",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  scoreFormula: {
    fontFamily: Platform.OS === "web" ? "'JetBrains Mono', monospace" : undefined,
    color: "#00d2ff",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
    backgroundColor: "rgba(0,210,255,0.06)",
    padding: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  scoreDesc: {
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 8,
  },
  perfTable: {
    marginTop: 12,
  },
  perfHeaderRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginTop: -4,
    display: "none", // Header is implicit from the data
  },
  perfHeaderCell: {
    flex: 1,
    color: "#666",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  perfRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  perfRowHighlight: {
    backgroundColor: "rgba(0,210,255,0.05)",
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  perfName: {
    flex: 2,
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: "500",
  },
  perfVal: {
    flex: 1,
    color: "#999",
    fontSize: 12,
    fontFamily: Platform.OS === "web" ? "'JetBrains Mono', monospace" : undefined,
    textAlign: "center",
  },
  refText: {
    color: "#999",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 8,
  },
  disclaimerCard: {
    backgroundColor: "rgba(255,75,43,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,75,43,0.3)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 11,
    color: "#ff4b2b",
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  disclaimerText: {
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
  },
});
