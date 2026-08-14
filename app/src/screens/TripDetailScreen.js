import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { api } from "../api/client";

export function TripDetailScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getTrip(tripId)
      .then((res) => setTrip(res.trip))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  const markConfirmed = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.updateTrip(tripId, { status: "upcoming", tripStatusLabel: "Onaylandı" });
      setTrip(res.trip);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [tripId]);

  const deleteTrip = useCallback(() => {
    Alert.alert("Seyahati sil", "Bu seyahati silmek istediğine emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.deleteTrip(tripId);
            navigation.goBack();
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        },
      },
    ]);
  }, [tripId, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator color={colors.accentTeal} />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.errorText}>{error || "Seyahat bulunamadı"}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View>
          {trip.image ? (
            <Image source={{ uri: trip.image }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder]}>
              <Ionicons name="airplane" size={32} color={colors.textMuted} />
            </View>
          )}
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.date}>{trip.dateLabel}</Text>

          <View style={styles.statusRow}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.statusText}>{trip.tripStatusLabel}</Text>
          </View>

          <Text style={styles.priceLabel}>Toplam fiyat</Text>
          <Text style={styles.price}>{trip.priceLabel}</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {trip.status !== "upcoming" || trip.tripStatusLabel !== "Onaylandı" ? (
            <Pressable style={[styles.cta, busy && styles.ctaDisabled]} onPress={markConfirmed} disabled={busy}>
              {busy ? <ActivityIndicator color={"#1A1200"} /> : <Text style={styles.ctaText}>Onayla</Text>}
            </Pressable>
          ) : null}

          <Pressable style={styles.deleteButton} onPress={deleteTrip} disabled={busy}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.deleteText}>Seyahati sil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 200 },
  heroPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
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
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" },
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  statusText: { color: colors.textSecondary, fontSize: 13 },
  priceLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xl },
  price: { color: colors.accentTeal, fontSize: 22, fontWeight: "800", marginTop: 2 },
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
  deleteButton: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
});
