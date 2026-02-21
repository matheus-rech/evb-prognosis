import React, { useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useAssessment } from "@/lib/assessment-context";
import { useColors } from "@/hooks/use-colors";
import type { Assessment } from "@/lib/types";

export default function HistoryScreen() {
  const { state, removeAssessment, refreshHistory } = useAssessment();
  const colors = useColors();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      refreshHistory();
    }, [refreshHistory])
  );

  const handlePress = useCallback(
    (assessment: Assessment) => {
      router.push({
        pathname: "/history-detail",
        params: { id: assessment.id },
      });
    },
    [router]
  );

  const handleLongPress = useCallback(
    (assessment: Assessment) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Alert.alert(
        "Delete Assessment",
        "Are you sure you want to delete this assessment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => removeAssessment(assessment.id),
          },
        ]
      );
    },
    [removeAssessment]
  );

  const renderItem = useCallback(
    ({ item }: { item: Assessment }) => {
      const date = new Date(item.date);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const riskColor =
        item.result.mlResult.riskCategory === "Low Risk"
          ? colors.success
          : item.result.mlResult.riskCategory === "Moderate Risk"
            ? colors.warning
            : colors.error;

      return (
        <Pressable
          onPress={() => handlePress(item)}
          onLongPress={() => handleLongPress(item)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <View
                  style={[
                    styles.riskDot,
                    { backgroundColor: riskColor },
                  ]}
                />
                <Text
                  style={[styles.riskLabel, { color: riskColor }]}
                >
                  {item.result.mlResult.riskCategory}
                </Text>
              </View>
              <Text className="text-sm text-foreground font-medium">
                Probability: {(item.result.mlResult.probability * 100).toFixed(1)}%
              </Text>
              <Text className="text-xs text-muted mt-1">
                MELD: {item.result.traditionalScores.meld} | Child-Pugh:{" "}
                {item.result.traditionalScores.childPughClass}
              </Text>
              <Text className="text-xs text-muted mt-0.5">
                {dateStr} at {timeStr}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
          </View>
        </Pressable>
      );
    },
    [colors, handlePress, handleLongPress]
  );

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">History</Text>
        <Text className="text-sm text-muted mt-1">
          Past risk assessments
        </Text>
      </View>

      {state.assessments.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">📋</Text>
          <Text className="text-lg font-semibold text-foreground text-center">
            No Assessments Yet
          </Text>
          <Text className="text-sm text-muted text-center mt-2">
            Complete a risk calculation to save it here for future reference.
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.assessments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
