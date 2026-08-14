import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export function RouteCard({ route, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: route.image }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.name}>{route.name}</Text>
        <Text style={styles.meta}>{route.nights} gece · kişi başı</Text>
        <View style={styles.tagRow}>
          {route.directFlight ? (
            <View style={styles.tag}>
              <Ionicons name="airplane" size={11} color={colors.accentTeal} />
              <Text style={styles.tagText}>Aktarmasız</Text>
            </View>
          ) : null}
          <View style={styles.tag}>
            <Ionicons name="star" size={11} color={colors.accentAmber} />
            <Text style={styles.tagText}>{route.hotelStars} yıldız</Text>
          </View>
        </View>
        <Text style={styles.price}>{route.priceLabel}</Text>
        <Text style={styles.priceBreakdown}>
          Uçuş {route.flightPriceLabel}
          {route.flightPriceSource === "live" ? " (canlı)" : " (tahmini)"} + otel {route.hotelPriceLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 152,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: "100%",
    height: 90,
  },
  body: {
    padding: spacing.md,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tagText: {
    color: colors.textSecondary,
    fontSize: 10.5,
  },
  price: {
    color: colors.accentTeal,
    fontWeight: "700",
    fontSize: 13,
    marginTop: spacing.sm,
  },
  priceBreakdown: {
    color: colors.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 2,
  },
});
