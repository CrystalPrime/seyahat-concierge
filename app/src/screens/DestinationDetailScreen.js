import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { api } from "../api/client";

export function DestinationDetailScreen({ route, navigation }) {
  const { destinationId, prefill } = route.params || {};
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDestination(destinationId)
      .then((res) => {
        if (!cancelled) setDestination(res.destination);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [destinationId]);

  const planTrip = useCallback(async () => {
    if (!destination) return;
    setSaving(true);
    setError(null);
    try {
      const nights = prefill?.nights || 2;
      const priceLabel = prefill?.priceLabel || `Uçuş ${destination.flightFromLabel}'den`;
      await api.createTrip({
        destinationId: destination.id,
        title: `${destination.name} Kaçamağı`,
        dateLabel: `${nights} gece · tarih seçilmedi`,
        status: "draft",
        price: prefill?.price || null,
        priceLabel,
        image: destination.image,
      });
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [destination, prefill]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator color={colors.accentTeal} />
      </SafeAreaView>
    );
  }

  if (error && !destination) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View>
          <Image source={{ uri: destination.image }} style={styles.hero} />
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.country}>{destination.country}</Text>
          <Text style={styles.name}>{destination.name}</Text>
          <Text style={styles.tagline}>{destination.tagline}</Text>

          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Ionicons name="airplane" size={13} color={colors.accentTeal} />
              <Text style={styles.tagText}>{destination.directFlight ? "Aktarmasız uçuş" : "Aktarmalı uçuş"}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="star" size={13} color={colors.accentAmber} />
              <Text style={styles.tagText}>{destination.hotelStars} yıldızlı otel</Text>
            </View>
          </View>

          <Text style={styles.priceLabel}>
            Gidiş-dönüş uçuş
            {destination.flightPriceSource === "live" ? " (canlı fiyat)" : " (tahmini)"}
          </Text>
          <Text style={styles.price}>{destination.flightFromLabel}'den</Text>

          <Text style={styles.priceLabel}>Gecelik otel (tahmini)</Text>
          <Text style={styles.priceSecondary}>
            ₺{destination.hotelPricePerNight.toLocaleString("tr-TR")}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.cta, (saving || saved) && styles.ctaDisabled]}
            onPress={planTrip}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.ctaText}>{saved ? "Seyahatlerime eklendi ✓" : "Bu rotayı planla"}</Text>
            )}
          </Pressable>
          {saved ? (
            <Pressable onPress={() => navigation.navigate("Seyahatlerim")}>
              <Text style={styles.linkText}>Seyahatlerim'de görüntüle →</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 240 },
  backButton: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg },
  country: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  name: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginTop: 2 },
  tagline: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  tagRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.lg },
  tag: { flexDirection: "row", alignItems: "center", gap: 6 },
  tagText: { color: colors.textSecondary, fontSize: 12.5 },
  priceLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xl },
  price: { color: colors.accentTeal, fontSize: 24, fontWeight: "800", marginTop: 2 },
  priceSecondary: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginTop: 2 },
  errorText: { color: colors.danger, fontSize: 12.5, marginTop: spacing.md },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.accentAmber,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.8 },
  ctaText: { color: "#1A1200", fontWeight: "800", fontSize: 15 },
  linkText: { color: colors.accentTeal, textAlign: "center", marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
});
