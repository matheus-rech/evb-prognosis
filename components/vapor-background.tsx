import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface CloudProps {
  size: number;
  color: string;
  initialX: number;
  initialY: number;
  duration: number;
  delay: number;
}

function VaporCloud({ size, color, initialX, initialY, duration, delay }: CloudProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const startDelay = delay;
    setTimeout(() => {
      translateX.value = withRepeat(
        withTiming(100, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      translateY.value = withRepeat(
        withTiming(50, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      scale.value = withRepeat(
        withTiming(1.2, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, startDelay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.15,
          left: initialX,
          top: initialY,
        },
        // On web, use CSS filter for blur; on native, just use opacity
        Platform.OS === "web"
          ? ({ filter: "blur(40px)" } as any)
          : {},
        animatedStyle,
      ]}
    />
  );
}

export function VaporBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <VaporCloud
        size={SCREEN_W * 0.8}
        color="#00d2ff"
        initialX={-SCREEN_W * 0.15}
        initialY={-SCREEN_H * 0.1}
        duration={20000}
        delay={0}
      />
      <VaporCloud
        size={SCREEN_W * 0.7}
        color="#92fe9d"
        initialX={SCREEN_W * 0.4}
        initialY={SCREEN_H * 0.6}
        duration={20000}
        delay={5000}
      />
      <VaporCloud
        size={SCREEN_W * 0.55}
        color="#8a2be2"
        initialX={SCREEN_W * 0.2}
        initialY={SCREEN_H * 0.3}
        duration={20000}
        delay={10000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: -1,
  },
});
