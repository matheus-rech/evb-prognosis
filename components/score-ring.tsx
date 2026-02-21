import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";

export interface ScoreRingProps {
  /** Probability 0-1 (will be converted to percentage) */
  probability?: number;
  /** Percentage 0-100 (used directly) */
  percentage?: number;
  label?: string;
  size?: number;
  accentColor?: string;
}

function getRiskColor(pct: number): string {
  if (pct < 30) return "#00e676";
  if (pct < 60) return "#ffa726";
  return "#ff4b2b";
}

export function ScoreRing({
  probability,
  percentage: pctProp,
  label = "1-Year Mortality",
  size = 190,
  accentColor,
}: ScoreRingProps) {
  const pct = pctProp ?? (probability != null ? probability * 100 : 0);
  const color = accentColor ?? getRiskColor(pct);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const innerSize = size * 0.79;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.ringBg, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>

        {/* Inner core */}
        <View
          style={[
            styles.innerCore,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            },
          ]}
        >
          <Text style={[styles.pctText, { color: "#fff" }]}>
            {pct.toFixed(1)}%
          </Text>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  ringBg: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...Platform.select({
      web: {
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.35,
        shadowRadius: 40,
        elevation: 20,
      },
    }),
  },
  innerCore: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pctText: {
    fontFamily: Platform.OS === "web" ? "'JetBrains Mono', monospace" : undefined,
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 40,
  },
  labelText: {
    marginTop: 6,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 10,
  },
});
