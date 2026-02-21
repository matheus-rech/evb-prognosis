import React from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAssessment } from "@/lib/assessment-context";
import { useColors } from "@/hooks/use-colors";

export default function SettingsScreen() {
  const { clearHistory, state } = useAssessment();
  const colors = useColors();

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      `Are you sure you want to delete all ${state.assessments.length} saved assessments? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: clearHistory,
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Data Section */}
        <Text className="text-sm font-semibold text-muted uppercase tracking-wider mt-4 mb-2">
          Data
        </Text>
        <View className="bg-surface rounded-2xl border border-border overflow-hidden">
          <View
            className="flex-row justify-between items-center px-4 py-3"
            style={{
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <Text className="text-base text-foreground">Saved Assessments</Text>
            <Text className="text-base text-muted">
              {state.assessments.length}
            </Text>
          </View>
          <Pressable
            onPress={handleClearHistory}
            disabled={state.assessments.length === 0}
            style={({ pressed }) => [
              { paddingHorizontal: 16, paddingVertical: 14 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text
              style={{
                color:
                  state.assessments.length > 0
                    ? colors.error
                    : colors.muted,
                fontSize: 16,
              }}
            >
              Clear All History
            </Text>
          </Pressable>
        </View>

        {/* About Section */}
        <Text className="text-sm font-semibold text-muted uppercase tracking-wider mt-6 mb-2">
          About
        </Text>
        <View className="bg-surface rounded-2xl border border-border overflow-hidden">
          <InfoRow label="App Name" value="EVB Prognosis" colors={colors} />
          <InfoRow label="Version" value="2.0" colors={colors} />
          <InfoRow label="Model" value="Random Forest + Isotonic Calibration" colors={colors} />
          <InfoRow label="Features" value="57 input features" colors={colors} />
          <InfoRow label="Inference" value="On-device (offline)" colors={colors} last />
        </View>

        {/* Links Section */}
        <Text className="text-sm font-semibold text-muted uppercase tracking-wider mt-6 mb-2">
          Links
        </Text>
        <View className="bg-surface rounded-2xl border border-border overflow-hidden">
          <Pressable
            onPress={() =>
              Linking.openURL(
                "https://huggingface.co/spaces/mmrech/evb-br"
              )
            }
            style={({ pressed }) => [
              styles.linkRow,
              { borderBottomColor: colors.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text className="text-base text-foreground">HuggingFace Space</Text>
            <Text style={{ color: colors.primary }}>→</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL("mailto:mmrech@ucs.br")}
            style={({ pressed }) => [
              styles.linkRow,
              { borderBottomWidth: 0 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text className="text-base text-foreground">Contact Author</Text>
            <Text style={{ color: colors.primary }}>→</Text>
          </Pressable>
        </View>

        {/* Disclaimer */}
        <View className="bg-surface rounded-2xl p-4 mt-6 border border-border">
          <Text className="text-xs text-muted leading-4">
            This application is a clinical decision support tool intended for
            research use only. It is not FDA approved and should not replace
            clinical judgment. All computations are performed locally on your
            device — no patient data is transmitted to external servers.
          </Text>
        </View>

        {/* Citation */}
        <View className="mt-4 mb-8">
          <Text className="text-xs text-muted leading-4 text-center">
            Rech MM, Soldera J, Corso LL et al. (2025)
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: any;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row justify-between items-center px-4 py-3"
      style={
        !last
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }
          : undefined
      }
    >
      <Text className="text-base text-foreground">{label}</Text>
      <Text className="text-base text-muted">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
