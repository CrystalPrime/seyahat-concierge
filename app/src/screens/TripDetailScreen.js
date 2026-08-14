import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  const [confirmVisible, setConfirmVisible] = useState(false);

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

  // Alert.alert is a no-op on react-native-web, so the confirmation is a Modal
  // to keep the flow identical on web, iOS and Android.
  const confirmDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteTrip(tripId);
      setConfirmVisible(false);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirmVisible(false);
    }
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

          <Pressable
            style={styles.deleteButton}
            onPress={() => setConfirmVisible(true)}
            disabled={busy}
          >
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.deleteText}>Seyahati sil</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seyahati sil</Text>
            <Text style={styles.modalBody}>
              "{trip.title}" seyahatini silmek istediğine emin misin? Bu işlem geri alınamaz.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setConfirmVisible(false)}
                disabled={busy}
              >
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalDelete]}
                onPress={confirmDelete}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.modalDeleteText}>Sil</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
  modalBody: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: spacing.sm },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: { backgroundColor: colors.surfaceRaised },
  modalCancelText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13.5 },
  modalDelete: { backgroundColor: colors.danger },
  modalDeleteText: { color: colors.textPrimary, fontWeight: "800", fontSize: 13.5 },
});
