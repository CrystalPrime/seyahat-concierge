import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export function DestinationCard({ destination, featured, onPress }) {
  return (
    <Pressable
      style={[styles.card, featured && styles.cardFeatured]}
      onPress={onPress}
    >
      <Image source={{ uri: destination.image }} style={[styles.image, featured && styles.imageFeatured]} />
      {featured && destination.editorsPick ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>EDİTÖRÜN SEÇİMİ</Text>
        </View>
      ) : null}
      <View style={styles.overlay}>
        <Text style={[styles.name, featured && styles.nameFeatured]}>{destination.name}</Text>
        <Text style={styles.tagline} numberOfLines={1}>{destination.tagline}</Text>
        <Text style={styles.price}>
          Uçuş {destination.flightFromLabel}'den
          {destination.flightPriceSource === "live" ? "" : " (tahmini)"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 140,
  },
  cardFeatured: {
    minHeight: 200,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  imageFeatured: {},
  badge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.accentAmber,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: "#1A1200",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  overlay: {
    marginTop: "auto",
    padding: spacing.md,
    backgroundColor: colors.overlay,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  nameFeatured: {
    fontSize: 20,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  price: {
    color: colors.accentTeal,
    fontWeight: "700",
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
