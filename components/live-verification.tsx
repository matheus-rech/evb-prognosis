import React, { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import type { PatientInput, PredictionResult } from "@/lib/types";
import { verifyWithLiveModel, type VerificationResult } from "@/lib/services/hf-api";

interface LiveVerificationProps {
  input: PatientInput;
  localResult: PredictionResult;
}

export function LiveModelVerification({ input, localResult }: LiveVerificationProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  const handleVerify = useCallback(async () => {
    setState("loading");
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const result = await verifyWithLiveModel(
        input,
        localResult.probability,
        localResult.meld,
        localResult.meldNa,
        localResult.childPughScore
      );

      setVerification(result);
      setState(result.error ? "error" : "done");

      if (Platform.OS !== "web") {
        if (result.error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {
      setState("error");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [input, localResult]);

  if (state === "idle") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🌐 Verify with Live Model</Text>
        <Text style={styles.subtitle}>
          Compare on-device prediction with the live HuggingFace Space server
        </Text>
        <Pressable
          onPress={handleVerify}
          style={({ pressed }) => [
            styles.verifyBtn,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
          ]}
        >
          <Text style={styles.verifyBtnText}>VERIFY PREDICTION</Text>
        </Pressable>
        <Text style={styles.note}>
          Calls mmrech/evb-br HuggingFace Space (requires internet)
        </Text>
      </View>
    );
  }

  if (state === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🌐 Verifying with Live Model...</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#00d2ff" size="small" />
          <Text style={styles.loadingText}>Calling HuggingFace Space API...</Text>
        </View>
      </View>
    );
  }

  if (state === "error" || !verification) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🌐 Live Model Verification</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {verification?.error || "Failed to reach the live model. Check your internet connection."}
          </Text>
        </View>
        <Pressable
          onPress={handleVerify}
          style={({ pressed }) => [
            styles.retryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.retryBtnText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  // Done state — show comparison
  const { live, concordance, latencyMs } = verification;
  const localPct = (localResult.probability * 100).toFixed(1);
  const livePct = live.probability != null ? (live.probability * 100).toFixed(1) : "N/A";
  const diffPct = concordance.probabilityDiff >= 0
    ? (concordance.probabilityDiff * 100).toFixed(1)
    : "N/A";

  const allMatch =
    concordance.isClose &&
    concordance.meldMatch &&
    concordance.meldNaMatch &&
    concordance.childPughMatch;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌐 Live Model Verification</Text>

      {/* Concordance Badge */}
      <View style={[styles.concordanceBadge, {
        backgroundColor: allMatch ? "rgba(0,230,118,0.12)" : "rgba(255,167,38,0.12)",
        borderColor: allMatch ? "#00e676" : "#ffa726",
      }]}>
        <Text style={[styles.concordanceText, {
          color: allMatch ? "#00e676" : "#ffa726",
        }]}>
          {allMatch ? "✓ CONCORDANT" : "⚡ MINOR DIFFERENCES"}
        </Text>
      </View>

      {/* Side-by-side comparison table */}
      <View style={styles.compTable}>
        {/* Header */}
        <View style={styles.compHeaderRow}>
          <View style={styles.compColLabel} />
          <View style={styles.compCol}>
            <Text style={styles.compColHeader}>On-Device</Text>
          </View>
          <View style={styles.compCol}>
            <Text style={[styles.compColHeader, { color: "#00d2ff" }]}>Live Server</Text>
          </View>
          <View style={styles.compColSmall}>
            <Text style={styles.compColHeader}>Match</Text>
          </View>
        </View>

        {/* Mortality Probability */}
        <CompRow
          label="Mortality"
          local={`${localPct}%`}
          server={`${livePct}%`}
          match={concordance.isClose}
        />

        {/* Risk Category */}
        <CompRow
          label="Risk"
          local={localResult.riskCategory}
          server={live.riskCategory || "N/A"}
          match={localResult.riskCategory === live.riskCategory}
        />

        {/* MELD */}
        <CompRow
          label="MELD"
          local={String(localResult.meld)}
          server={live.meld != null ? String(live.meld) : "N/A"}
          match={concordance.meldMatch}
        />

        {/* MELD-Na */}
        <CompRow
          label="MELD-Na"
          local={String(localResult.meldNa)}
          server={live.meldNa != null ? String(live.meldNa) : "N/A"}
          match={concordance.meldNaMatch}
        />

        {/* Child-Pugh */}
        <CompRow
          label="Child-Pugh"
          local={`${localResult.childPughScore} (${localResult.childPughClass})`}
          server={
            live.childPughScore != null
              ? `${live.childPughScore} (${live.childPughClass})`
              : "N/A"
          }
          match={concordance.childPughMatch}
          isLast
        />
      </View>

      {/* Difference detail */}
      <View style={styles.diffRow}>
        <Text style={styles.diffLabel}>Probability Difference:</Text>
        <Text style={[styles.diffValue, {
          color: concordance.isClose ? "#00e676" : "#ffa726",
        }]}>
          {diffPct}%
        </Text>
      </View>

      {/* Latency */}
      <Text style={styles.latency}>
        Response time: {latencyMs}ms | Server: mmrech/evb-br
      </Text>

      {/* Retry */}
      <Pressable
        onPress={handleVerify}
        style={({ pressed }) => [
          styles.retryBtn,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.retryBtnText}>RE-VERIFY</Text>
      </Pressable>
    </View>
  );
}

function CompRow({
  label,
  local,
  server,
  match,
  isLast,
}: {
  label: string;
  local: string;
  server: string;
  match: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.compRow, !isLast && styles.compRowBorder]}>
      <View style={styles.compColLabel}>
        <Text style={styles.compLabel}>{label}</Text>
      </View>
      <View style={styles.compCol}>
        <Text style={styles.compValue}>{local}</Text>
      </View>
      <View style={styles.compCol}>
        <Text style={[styles.compValue, { color: "#00d2ff" }]}>{server}</Text>
      </View>
      <View style={styles.compColSmall}>
        <Text style={{ fontSize: 14 }}>{match ? "✅" : "⚠️"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e0e0e0",
  },
  subtitle: {
    fontSize: 11,
    color: "#888",
    lineHeight: 16,
  },
  verifyBtn: {
    backgroundColor: "rgba(0,210,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,210,255,0.4)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#00d2ff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  note: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    justifyContent: "center",
  },
  loadingText: {
    color: "#aaa",
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "rgba(255,75,43,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,75,43,0.3)",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: "#ff8a8a",
    fontSize: 12,
    lineHeight: 18,
  },
  concordanceBadge: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  concordanceText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  compTable: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
  },
  compHeaderRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  compRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  compRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  compColLabel: {
    width: 75,
  },
  compCol: {
    flex: 1,
    alignItems: "center",
  },
  compColSmall: {
    width: 40,
    alignItems: "center",
  },
  compColHeader: {
    fontSize: 10,
    fontWeight: "600",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  compLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
  },
  compValue: {
    fontSize: 12,
    color: "#e0e0e0",
    fontWeight: "600",
  },
  diffRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  diffLabel: {
    fontSize: 11,
    color: "#888",
  },
  diffValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  latency: {
    fontSize: 10,
    color: "#555",
    textAlign: "center",
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  retryBtnText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
