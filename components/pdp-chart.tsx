/**
 * Partial Dependence Plot (PDP) Chart Component
 *
 * Renders an interactive line chart showing how varying a single feature
 * affects the predicted mortality probability. Includes:
 * - Line chart with gradient fill
 * - Current patient value marker
 * - Risk zone shading
 * - Feature selector dropdown
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import type { PatientInput } from "@/lib/types";
import { computePDP, getAvailablePDPFeatures } from "@/lib/services/partial-dependence";
import type { PDPResult } from "@/lib/services/partial-dependence";

interface PDPChartProps {
  input: PatientInput;
}

const CHART_WIDTH = Dimensions.get("window").width - 64;
const CHART_HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

export function PDPChart({ input }: PDPChartProps) {
  const features = useMemo(() => getAvailablePDPFeatures(), []);
  const [selectedFeature, setSelectedFeature] = useState(features[0]?.key || "albumin");
  const [showSelector, setShowSelector] = useState(false);
  const [computing, setComputing] = useState(false);

  const pdpResult = useMemo(() => {
    setComputing(true);
    const result = computePDP(input, selectedFeature as keyof PatientInput);
    setComputing(false);
    return result;
  }, [input, selectedFeature]);

  const selectedLabel = features.find((f) => f.key === selectedFeature)?.label || selectedFeature;

  const toggleSelector = useCallback(() => {
    setShowSelector((prev) => !prev);
  }, []);

  if (!pdpResult) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Unable to compute PDP for this feature.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partial Dependence Plot</Text>
      <Text style={styles.subtitle}>
        How varying <Text style={styles.highlight}>{selectedLabel}</Text> affects predicted mortality
      </Text>

      {/* Feature Selector */}
      <Pressable
        style={({ pressed }) => [styles.selectorButton, pressed && { opacity: 0.7 }]}
        onPress={toggleSelector}
      >
        <Text style={styles.selectorText}>{selectedLabel}</Text>
        <Text style={styles.selectorArrow}>{showSelector ? "▲" : "▼"}</Text>
      </Pressable>

      {showSelector && (
        <ScrollView style={styles.selectorDropdown} nestedScrollEnabled>
          {features.map((f) => (
            <Pressable
              key={f.key}
              style={({ pressed }) => [
                styles.selectorOption,
                f.key === selectedFeature && styles.selectorOptionActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                setSelectedFeature(f.key);
                setShowSelector(false);
              }}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  f.key === selectedFeature && styles.selectorOptionTextActive,
                ]}
              >
                {f.label} ({f.unit})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Chart */}
      {computing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#00e5ff" />
          <Text style={styles.loadingText}>Computing...</Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <PDPSvgChart result={pdpResult} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#00e5ff" }]} />
              <Text style={styles.legendText}>Predicted Probability</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ff6b6b" }]} />
              <Text style={styles.legendText}>Current Value</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Min Risk</Text>
              <Text style={styles.statValue}>{(pdpResult.minPrediction * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Max Risk</Text>
              <Text style={styles.statValue}>{(pdpResult.maxPrediction * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Range</Text>
              <Text style={styles.statValue}>
                {((pdpResult.maxPrediction - pdpResult.minPrediction) * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ===== SVG Chart =====

function PDPSvgChart({ result }: { result: PDPResult }) {
  const { points, currentValue, currentPrediction } = result;

  // Compute scales
  const xMin = points[0].x;
  const xMax = points[points.length - 1].x;
  const yMin = Math.max(0, result.minPrediction - 0.02);
  const yMax = Math.min(1, result.maxPrediction + 0.02);
  const yRange = yMax - yMin || 0.01;

  const scaleX = (x: number) => PADDING.left + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const scaleY = (y: number) => PADDING.top + (1 - (y - yMin) / yRange) * PLOT_H;

  // Build line path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
    .join(" ");

  // Build area path (fill under curve)
  const areaPath =
    linePath +
    ` L ${scaleX(xMax).toFixed(1)} ${scaleY(yMin).toFixed(1)}` +
    ` L ${scaleX(xMin).toFixed(1)} ${scaleY(yMin).toFixed(1)} Z`;

  // Current value marker position
  const markerX = scaleX(currentValue);
  const markerY = scaleY(currentPrediction);

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i * yRange) / yTicks);

  // X-axis ticks
  const xTicks = 5;
  const xTickValues = Array.from(
    { length: xTicks + 1 },
    (_, i) => xMin + (i * (xMax - xMin)) / xTicks
  );

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Defs>
        <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#00e5ff" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#00e5ff" stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      {/* Grid lines */}
      {yTickValues.map((v, i) => (
        <Line
          key={`grid-y-${i}`}
          x1={PADDING.left}
          y1={scaleY(v)}
          x2={PADDING.left + PLOT_W}
          y2={scaleY(v)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGradient)" />

      {/* Line */}
      <Path d={linePath} stroke="#00e5ff" strokeWidth={2.5} fill="none" strokeLinejoin="round" />

      {/* Current value vertical line */}
      <Line
        x1={markerX}
        y1={PADDING.top}
        x2={markerX}
        y2={PADDING.top + PLOT_H}
        stroke="#ff6b6b"
        strokeWidth={1.5}
        strokeDasharray="4,4"
      />

      {/* Current value marker */}
      <Circle cx={markerX} cy={markerY} r={6} fill="#ff6b6b" stroke="#fff" strokeWidth={2} />

      {/* Y-axis labels */}
      {yTickValues.map((v, i) => (
        <SvgText
          key={`y-${i}`}
          x={PADDING.left - 6}
          y={scaleY(v) + 4}
          textAnchor="end"
          fontSize={10}
          fill="rgba(255,255,255,0.5)"
        >
          {(v * 100).toFixed(0)}%
        </SvgText>
      ))}

      {/* X-axis labels */}
      {xTickValues.map((v, i) => (
        <SvgText
          key={`x-${i}`}
          x={scaleX(v)}
          y={PADDING.top + PLOT_H + 16}
          textAnchor="middle"
          fontSize={10}
          fill="rgba(255,255,255,0.5)"
        >
          {Number.isInteger(v) ? v.toString() : v.toFixed(1)}
        </SvgText>
      ))}

      {/* X-axis label */}
      <SvgText
        x={PADDING.left + PLOT_W / 2}
        y={CHART_HEIGHT - 2}
        textAnchor="middle"
        fontSize={11}
        fill="rgba(255,255,255,0.6)"
      >
        {result.label} {result.unit ? `(${result.unit})` : ""}
      </SvgText>

      {/* Axes */}
      <Line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={PADDING.top + PLOT_H}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
      <Line
        x1={PADDING.left}
        y1={PADDING.top + PLOT_H}
        x2={PADDING.left + PLOT_W}
        y2={PADDING.top + PLOT_H}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginBottom: 12,
  },
  highlight: {
    color: "#00e5ff",
    fontWeight: "600",
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.2)",
    marginBottom: 8,
  },
  selectorText: {
    color: "#00e5ff",
    fontSize: 14,
    fontWeight: "600",
  },
  selectorArrow: {
    color: "#00e5ff",
    fontSize: 12,
  },
  selectorDropdown: {
    maxHeight: 200,
    backgroundColor: "rgba(20,25,35,0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.2)",
    marginBottom: 12,
  },
  selectorOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  selectorOptionActive: {
    backgroundColor: "rgba(0,229,255,0.1)",
  },
  selectorOptionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  selectorOptionTextActive: {
    color: "#00e5ff",
    fontWeight: "600",
  },
  chartContainer: {
    alignItems: "center",
  },
  loadingContainer: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 8,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  statBox: {
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center",
    padding: 20,
  },
});
