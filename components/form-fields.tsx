import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
  Platform,
} from "react-native";

// ===== Glass-style Slider Field (matching HTML slider-wrap) =====

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  tooltip?: string;
  warning?: string;
  warningColor?: string;
  onValueChange: (value: number) => void;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  tooltip,
  warning,
  warningColor,
  onValueChange,
}: SliderFieldProps) {
  const [textValue, setTextValue] = useState(String(value));
  const [showTip, setShowTip] = useState(false);

  const handleTextChange = (text: string) => {
    setTextValue(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= min && num <= max) {
      onValueChange(Math.round(num / step) * step);
    }
  };

  const handleBlur = () => {
    const num = parseFloat(textValue);
    if (isNaN(num) || num < min) {
      onValueChange(min);
      setTextValue(String(min));
    } else if (num > max) {
      onValueChange(max);
      setTextValue(String(max));
    } else {
      const rounded = Math.round(num / step) * step;
      const fixed = step < 1 ? Number(rounded.toFixed(1)) : rounded;
      onValueChange(fixed);
      setTextValue(String(fixed));
    }
  };

  const increment = () => {
    const newVal = Math.min(max, value + step);
    const fixed = step < 1 ? Number(newVal.toFixed(1)) : newVal;
    onValueChange(fixed);
    setTextValue(String(fixed));
  };

  const decrement = () => {
    const newVal = Math.max(min, value - step);
    const fixed = step < 1 ? Number(newVal.toFixed(1)) : newVal;
    onValueChange(fixed);
    setTextValue(String(fixed));
  };

  React.useEffect(() => {
    setTextValue(step < 1 ? value.toFixed(1) : String(value));
  }, [value, step]);

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.labelText}>
            {label}
            {unit ? ` (${unit})` : ""}
          </Text>
          {tooltip && (
            <Pressable
              onPress={() => setShowTip(!showTip)}
              style={styles.infoIcon}
            >
              <Text style={styles.infoIconText}>i</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.valDisplay}>{textValue}</Text>
      </View>

      {showTip && tooltip && (
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}

      {warning && (
        <View style={[styles.warningBox, { borderColor: warningColor || '#ffa726' }]}>
          <Text style={[styles.warningIcon, { color: warningColor || '#ffa726' }]}>
            {warningColor === '#ff4b2b' ? '⚠' : '⚡'}
          </Text>
          <Text style={[styles.warningText, { color: warningColor || '#ffa726' }]}>
            {warning}
          </Text>
        </View>
      )}

      <View style={styles.sliderRow}>
        <Pressable
          onPress={decrement}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>

        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              { width: `${((value - min) / (max - min)) * 100}%` },
            ]}
          />
          <View
            style={[
              styles.sliderThumb,
              { left: `${((value - min) / (max - min)) * 100}%` },
            ]}
          />
        </View>

        <Pressable
          onPress={increment}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      {/* Direct text input for precise values */}
      <TextInput
        value={textValue}
        onChangeText={handleTextChange}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        returnKeyType="done"
        style={styles.hiddenInput}
        accessibilityLabel={`${label} value`}
      />
    </View>
  );
}

// ===== Glass-style Select Field (matching HTML select) =====

interface SelectFieldProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  tooltip?: string;
  onValueChange: (value: string) => void;
}

export function SelectField({
  label,
  value,
  options,
  tooltip,
  onValueChange,
}: SelectFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.labelText}>{label}</Text>
          {tooltip && (
            <Pressable
              onPress={() => setShowTip(!showTip)}
              style={styles.infoIcon}
            >
              <Text style={styles.infoIconText}>i</Text>
            </Pressable>
          )}
        </View>
      </View>

      {showTip && tooltip && (
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}

      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.selectButton,
          pressed && { borderColor: "#00d2ff", backgroundColor: "rgba(255,255,255,0.1)" },
        ]}
      >
        <Text style={styles.selectText}>{selectedLabel}</Text>
        <Text style={styles.selectArrow}>▾</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.optionItem,
                    item.value === value && styles.optionItemActive,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Text style={{ color: "#00d2ff", fontSize: 16 }}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ===== Glass-style Number Input =====

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  tooltip?: string;
  onValueChange: (value: number) => void;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  tooltip,
  onValueChange,
}: NumberFieldProps) {
  const [textValue, setTextValue] = useState(String(value));
  const [showTip, setShowTip] = useState(false);

  const handleBlur = () => {
    const num = parseFloat(textValue);
    if (isNaN(num) || num < min) {
      onValueChange(min);
      setTextValue(String(min));
    } else if (num > max) {
      onValueChange(max);
      setTextValue(String(max));
    } else {
      const rounded = Math.round(num / step) * step;
      const fixed = step < 1 ? Number(rounded.toFixed(1)) : rounded;
      onValueChange(fixed);
      setTextValue(String(fixed));
    }
  };

  React.useEffect(() => {
    setTextValue(step < 1 ? value.toFixed(1) : String(value));
  }, [value, step]);

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.labelText}>
            {label}
            {unit ? ` (${unit})` : ""}
          </Text>
          {tooltip && (
            <Pressable
              onPress={() => setShowTip(!showTip)}
              style={styles.infoIcon}
            >
              <Text style={styles.infoIconText}>i</Text>
            </Pressable>
          )}
        </View>
      </View>

      {showTip && tooltip && (
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}

      <TextInput
        value={textValue}
        onChangeText={setTextValue}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        returnKeyType="done"
        style={styles.numberInput}
        placeholderTextColor="#666"
      />
    </View>
  );
}

// ===== Reexport ToggleField for backward compat =====

interface ToggleFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}

export function ToggleField({ label, value, onValueChange }: ToggleFieldProps) {
  const isYes = value === "yes";

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.labelText}>{label}</Text>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => onValueChange("no")}
          style={({ pressed }) => [
            styles.toggleOption,
            !isYes ? styles.toggleActive : styles.toggleInactive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.toggleText, !isYes && styles.toggleTextActive]}>
            No
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onValueChange("yes")}
          style={({ pressed }) => [
            styles.toggleOption,
            isYes ? styles.toggleActive : styles.toggleInactive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.toggleText, isYes && styles.toggleTextActive]}>
            Yes
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Also export PickerField as alias for SelectField
export const PickerField = SelectField;

// ===== Section Title (matching HTML section-title) =====

export function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      <View style={styles.sectionTitleLine} />
    </View>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  labelText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    textTransform: "uppercase" as any,
    letterSpacing: 0.5,
  },
  valDisplay: {
    fontFamily: Platform.OS === "web" ? "'JetBrains Mono', monospace" : undefined,
    fontSize: 14,
    color: "#00d2ff",
    minWidth: 52,
    textAlign: "right",
  },
  infoIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoIconText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#999",
  },
  tooltipBox: {
    backgroundColor: "rgba(0,0,0,0.95)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  tooltipText: {
    fontSize: 11,
    color: "#fff",
    lineHeight: 16,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    position: "relative",
    justifyContent: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#00d2ff",
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00d2ff",
    marginLeft: -8,
    top: -6,
    ...Platform.select({
      web: {
        boxShadow: "0 0 10px #00d2ff",
      } as any,
      default: {
        shadowColor: "#00d2ff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 5,
      },
    }),
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: "#00d2ff",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  hiddenInput: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
  selectButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectText: {
    color: "#fff",
    fontSize: 14,
  },
  selectArrow: {
    color: "#999",
    fontSize: 12,
  },
  numberInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    maxHeight: 400,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0a0f12",
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e0e0e0",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    textAlign: "center",
    textTransform: "uppercase" as any,
    letterSpacing: 1,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  optionItemActive: {
    backgroundColor: "rgba(0,210,255,0.1)",
  },
  optionText: {
    fontSize: 15,
    color: "#e0e0e0",
  },
  optionTextActive: {
    color: "#00d2ff",
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginTop: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#00d2ff",
  },
  toggleInactive: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  toggleText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#000",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    marginTop: 8,
  },
  sectionTitleText: {
    fontSize: 11,
    textTransform: "uppercase" as any,
    letterSpacing: 2,
    color: "#00d2ff",
    fontWeight: "600",
  },
  sectionTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  warningBox: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 6,
    backgroundColor: "rgba(255,167,38,0.06)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  warningIcon: {
    fontSize: 12,
    lineHeight: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
