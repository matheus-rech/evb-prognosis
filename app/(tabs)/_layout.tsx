import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#00d2ff",
        tabBarInactiveTintColor: "#666",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0a0f12",
          borderTopColor: "rgba(255,255,255,0.08)",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Calculator",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="function" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: "About",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="info.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
