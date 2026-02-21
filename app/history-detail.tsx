import React, { useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAssessment } from "@/lib/assessment-context";
import { useColors } from "@/hooks/use-colors";
import { getMELDMortality } from "@/lib/services/clinical-scores";

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAssessment();
  const colors = useColors();
  const router = useRouter();

  const assessment = useMemo(
    () => state.assessments.find((a) => a.id === id),
    [state.assessments, id]
  );

  if (!assessment) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center">
        <Text className="text-muted">Assessment not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={{ color: colors.primary, marginTop: 12 }}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const { mlResult, traditionalScores } = assessment.result;
  const date = new Date(assessment.date);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const riskColor =
    mlResult.riskCategory === "Low Risk"
      ? colors.success
      : mlResult.riskCategory === "Moderate Risk"
        ? colors.warning
        : colors.error;

  const pd = assessment.patientData;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-3">
          Assessment Detail
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date */}
        <Text className="text-sm text-muted mt-2">
          {dateStr} at {timeStr}
        </Text>

        {/* Risk Summary */}
        <View className="bg-surface rounded-2xl p-5 mt-3 border border-border">
          <View className="items-center mb-3">
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: riskColor + "20", borderColor: riskColor },
              ]}
            >
              <Text style={[styles.riskText, { color: riskColor }]}>
                {mlResult.riskCategory}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-background rounded-xl p-3 items-center">
              <Text className="text-xs text-muted">Probability</Text>
              <Text style={[styles.statValue, { color: riskColor }]}>
                {(mlResult.probability * 100).toFixed(1)}%
              </Text>
            </View>
            <View className="flex-1 bg-background rounded-xl p-3 items-center">
              <Text className="text-xs text-muted">MELD</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {traditionalScores.meld}
              </Text>
            </View>
            <View className="flex-1 bg-background rounded-xl p-3 items-center">
              <Text className="text-xs text-muted">Child-Pugh</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {traditionalScores.childPughClass}
              </Text>
            </View>
          </View>
        </View>

        {/* Patient Data Summary */}
        <View className="bg-surface rounded-2xl p-5 mt-4 border border-border">
          <Text className="text-base font-semibold text-foreground mb-3">
            Patient Data
          </Text>

          <SectionRow label="Age" value={`${pd.generalInfo.age} years`} colors={colors} />
          <SectionRow label="Sex" value={pd.generalInfo.sex} colors={colors} />
          <SectionRow label="Race" value={pd.generalInfo.race} colors={colors} />
          <SectionRow label="Etiology" value={pd.generalInfo.etiology_cirrosis} colors={colors} />
          <SectionRow label="Ascites" value={pd.clinicalStatus.ascitis} colors={colors} />
          <SectionRow label="Therapy" value={pd.clinicalStatus.therapy} colors={colors} />

          <Text className="text-sm font-semibold text-foreground mt-3 mb-2">
            Key Lab Values
          </Text>
          <SectionRow label="Albumin" value={`${pd.labValues.albumin} g/dL`} colors={colors} />
          <SectionRow label="Total Bilirubin" value={`${pd.labValues.total_bilirubin} mg/dL`} colors={colors} />
          <SectionRow label="INR" value={`${pd.labValues.inr}`} colors={colors} />
          <SectionRow label="Creatinine" value={`${pd.labValues.creatinine} mg/dL`} colors={colors} />
          <SectionRow label="Sodium" value={`${pd.labValues.sodium} mEq/L`} colors={colors} />
          <SectionRow label="Platelets" value={`${pd.labValues.platelets} x10³/μL`} colors={colors} />
        </View>

        {/* Full Scores */}
        <View className="bg-surface rounded-2xl p-5 mt-4 border border-border">
          <Text className="text-base font-semibold text-foreground mb-3">
            Traditional Scores
          </Text>
          <SectionRow label="MELD" value={`${traditionalScores.meld} (3-mo mortality: ${getMELDMortality(traditionalScores.meld)})`} colors={colors} />
          <SectionRow label="MELD-Na" value={`${traditionalScores.meldNa}`} colors={colors} />
          <SectionRow label="Child-Pugh" value={`${traditionalScores.childPugh} (Class ${traditionalScores.childPughClass})`} colors={colors} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      className="flex-row justify-between py-2"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
    >
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  riskBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
  },
  riskText: {
    fontSize: 16,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
});
