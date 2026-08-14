import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accentTealDim,
    borderColor: colors.accentTeal,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.accentTeal,
  },
});
