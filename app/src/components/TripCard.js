import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

const STATUS_STYLES = {
  Onaylandı: { color: colors.success, icon: "checkmark-circle" },
  "Planlama aşamasında": { color: colors.accentAmber, icon: "time" },
  Taslak: { color: colors.textMuted, icon: "document-text" },
};

export function TripCard({ trip, onPress }) {
  const statusStyle = STATUS_STYLES[trip.tripStatusLabel] || STATUS_STYLES.Taslak;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {trip.image ? (
        <Image source={{ uri: trip.image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="airplane" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{trip.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name={statusStyle.icon} size={12} color={statusStyle.color} />
          <Text style={[styles.status, { color: statusStyle.color }]}>{trip.tripStatusLabel}</Text>
        </View>
        <Text style={styles.date}>{trip.dateLabel}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, trip.priceIsEstimate && styles.priceEstimate]}>{trip.priceLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  thumbPlaceholder: {
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  status: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  date: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  price: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  priceEstimate: {
    color: colors.textSecondary,
    fontWeight: "500",
    fontSize: 11.5,
  },
});
