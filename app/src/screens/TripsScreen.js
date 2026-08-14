import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { TripCard } from "../components/TripCard";
import { api } from "../api/client";

const TABS = [
  { key: "upcoming", label: "Yaklaşan" },
  { key: "past", label: "Geçmiş" },
  { key: "draft", label: "Taslaklar" },
];

export function TripsScreen({ navigation }) {
  const [tab, setTab] = useState("upcoming");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getTrips()
      .then((res) => setTrips(res.trips))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = trips.filter((t) => t.status === tab);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>KİŞİSEL ALANIN</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Seyahatlerim</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.getParent()?.navigate("Concierge")}
          >
            <Ionicons name="add" size={20} color={colors.background} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Kaydettiğin kaçamaklar, tek bir yerde sakin ve hazır.</Text>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.countLabel}>{filtered.length} SEYAHAT</Text>

        {loading ? (
          <ActivityIndicator color={colors.accentTeal} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>Bu kategoride henüz bir seyahatin yok.</Text>
        ) : (
          filtered.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onPress={() => navigation.navigate("TripDetail", { tripId: trip.id })}
            />
          ))
        )}

        <View style={styles.ctaCard}>
          <Ionicons name="sparkles" size={18} color={colors.accentAmber} />
          <Text style={styles.ctaTitle}>Bir sonraki kaçamağın?</Text>
          <Text style={styles.ctaSubtitle}>Tarihleri ve hayalini anlat, gerisini biz çözelim.</Text>
          <Pressable style={styles.ctaButton} onPress={() => navigation.getParent()?.navigate("Concierge")}>
            <Ionicons name="add-circle-outline" size={16} color={"#1A1200"} />
            <Text style={styles.ctaButtonText}>Yeni bir seyahat planla</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800" },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.lg },
  tabRow: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.accentAmber },
  tabText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: "600" },
  tabTextActive: { color: "#1A1200" },
  countLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 12.5 },
  emptyText: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  ctaCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  ctaSubtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 4, marginBottom: spacing.md },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accentAmber,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  ctaButtonText: { color: "#1A1200", fontWeight: "800", fontSize: 13.5 },
});
