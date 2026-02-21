/**
 * Feature Importance Chart Component
 *
 * Displays a horizontal waterfall/bar chart showing per-feature SHAP contributions.
 * Red bars = increases mortality risk, green bars = decreases risk.
 * Matches the dark glassmorphism theme of the app.
 */

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import type { FeatureContribution, FeatureImportanceResult } from "@/lib/services/feature-importance";

interface Props {
  result: FeatureImportanceResult;
  topN?: number;
}

export function FeatureImportanceChart({ result, topN = 12 }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const displayCount = showAll ? result.contributions.length : topN;
  const features = result.contributions.slice(0, displayCount);

  // Find max absolute value for scaling
  const maxAbsValue = Math.max(
    ...features.map((f) => Math.abs(f.value)),
    0.001 // avoid division by zero
  );

  return (
    <View style={styles.container}>
      {/* Header with baseline info */}
      <View style={styles.headerRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ff4b2b" }]} />
          <Text style={styles.legendText}>Increases risk</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#00e676" }]} />
          <Text style={styles.legendText}>Decreases risk</Text>
        </View>
      </View>

      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Baseline probability</Text>
        <Text style={styles.baselineValue}>
          {(result.baselineProb * 100).toFixed(1)}%
        </Text>
      </View>

      {/* Feature bars */}
      {features.map((feature) => (
        <FeatureBar
          key={feature.feature}
          feature={feature}
          maxAbsValue={maxAbsValue}
          isSelected={selectedFeature === feature.feature}
          onPress={() =>
            setSelectedFeature(
              selectedFeature === feature.feature ? null : feature.feature
            )
          }
        />
      ))}

      {/* Show more/less toggle */}
      {result.contributions.length > topN && (
        <Pressable
          onPress={() => setShowAll(!showAll)}
          style={({ pressed }) => [
            styles.toggleBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.toggleText}>
            {showAll
              ? "Show Top Features"
              : `Show All ${result.contributions.length} Features`}
          </Text>
        </Pressable>
      )}

      {/* Sum verification */}
      <View style={styles.sumRow}>
        <Text style={styles.sumLabel}>
          Baseline + Contributions = Predicted
        </Text>
        <Text style={styles.sumValue}>
          {(result.baselineProb * 100).toFixed(1)}% →{" "}
          {(result.predictedProb * 100).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

// ===== Individual Feature Bar =====

function FeatureBar({
  feature,
  maxAbsValue,
  isSelected,
  onPress,
}: {
  feature: FeatureContribution;
  maxAbsValue: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const isPositive = feature.value >= 0;
  const barColor = isPositive ? "#ff4b2b" : "#00e676";
  const barBgColor = isPositive ? "rgba(255,75,43,0.08)" : "rgba(0,230,118,0.08)";
  const barWidth = Math.max((Math.abs(feature.value) / maxAbsValue) * 100, 2);
  const shapPct = (feature.value * 100).toFixed(2);

  const categoryIcon =
    feature.category === "laboratory"
      ? "🧪"
      : feature.category === "clinical"
        ? "🏥"
        : "👤";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.featureRow,
        isSelected && styles.featureRowSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* Label column */}
      <View style={styles.labelCol}>
        <Text style={styles.featureLabel} numberOfLines={1}>
          {categoryIcon} {feature.label}
        </Text>
        <Text style={styles.featureInputValue} numberOfLines={1}>
          = {feature.inputValue}
        </Text>
      </View>

      {/* Bar column */}
      <View style={styles.barCol}>
        {/* Center-aligned bar: positive goes right, negative goes left */}
        <View style={styles.barContainer}>
          {/* Negative side */}
          <View style={styles.barHalf}>
            {!isPositive && (
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                    alignSelf: "flex-end",
                    borderTopLeftRadius: 3,
                    borderBottomLeftRadius: 3,
                  },
                ]}
              />
            )}
          </View>

          {/* Center line */}
          <View style={styles.centerLine} />

          {/* Positive side */}
          <View style={styles.barHalf}>
            {isPositive && (
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                    alignSelf: "flex-start",
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  },
                ]}
              />
            )}
          </View>
        </View>
      </View>

      {/* Value column */}
      <View style={styles.valueCol}>
        <Text style={[styles.shapValue, { color: barColor }]}>
          {isPositive ? "+" : ""}
          {shapPct}%
        </Text>
      </View>

      {/* Expanded detail */}
      {isSelected && (
        <View style={[styles.detailRow, { backgroundColor: barBgColor }]}>
          <Text style={styles.detailText}>
            <Text style={{ fontWeight: "700", color: "#e0e0e0" }}>
              {feature.label}
            </Text>
            {" = "}
            <Text style={{ color: "#00d2ff" }}>{feature.inputValue}</Text>
            {"\n"}
            This feature {isPositive ? "increases" : "decreases"} the
            predicted mortality risk by{" "}
            <Text style={{ fontWeight: "700", color: barColor }}>
              {Math.abs(feature.value * 100).toFixed(2)} percentage points
            </Text>{" "}
            compared to the baseline.
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: "#888",
  },
  baselineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 4,
  },
  baselineLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
  },
  baselineValue: {
    fontSize: 12,
    color: "#aaa",
    fontWeight: "700",
  },
  featureRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  featureRowSelected: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  labelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  featureLabel: {
    fontSize: 11,
    color: "#ccc",
    fontWeight: "600",
    maxWidth: 160,
  },
  featureInputValue: {
    fontSize: 10,
    color: "#666",
    flex: 1,
  },
  barCol: {
    height: 14,
    marginVertical: 2,
  },
  barContainer: {
    flexDirection: "row",
    height: 14,
    alignItems: "center",
  },
  barHalf: {
    flex: 1,
    height: 10,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  centerLine: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  barFill: {
    height: 10,
  },
  valueCol: {
    position: "absolute",
    right: 4,
    top: 6,
  },
  shapValue: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" }),
  },
  detailRow: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 11,
    color: "#aaa",
    lineHeight: 16,
  },
  toggleBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 11,
    color: "#00d2ff",
    fontWeight: "600",
    letterSpacing: 1,
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  sumLabel: {
    fontSize: 10,
    color: "#666",
  },
  sumValue: {
    fontSize: 11,
    color: "#aaa",
    fontWeight: "600",
  },
});
