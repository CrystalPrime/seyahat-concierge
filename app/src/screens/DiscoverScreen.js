import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { DestinationCard } from "../components/DestinationCard";
import { api } from "../api/client";

export function DiscoverScreen({ navigation }) {
  const [destinations, setDestinations] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [destRes, sugRes] = await Promise.all([
        api.getDestinations("mayis"),
        api.getConciergeSuggestions(),
      ]);
      setDestinations(destRes.destinations);
      setLive(Boolean(destRes.live));
      setSuggestion(sugRes.fromHistory);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const featured = destinations.find((d) => d.editorsPick) || destinations[0];
  const rest = destinations.filter((d) => d.id !== featured?.id);

  const openDestination = (destination) =>
    navigation.navigate("DestinationDetail", { destinationId: destination.id });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentTeal} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accentTeal}
            />
          }
        >
          <Text style={styles.eyebrow}>KEŞFET</Text>
          <Text style={styles.title}>
            {live ? "İstanbul'dan Nereye Gidilir?" : "Mayıs'ta Nereye Gidilir?"}
          </Text>
          <View style={styles.subtitleRow}>
            <View style={styles.dash} />
            <Text style={styles.subtitle}>
              {live
                ? "Şu an gerçekten uçulan rotalar, canlı fiyatlarla"
                : "Mevsimin en iyi rotaları, seçilmiş rotalar"}
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {featured ? (
            <DestinationCard destination={featured} featured onPress={() => openDestination(featured)} />
          ) : null}

          <View style={styles.grid}>
            {rest.map((d) => (
              <View key={d.id} style={styles.gridItem}>
                <DestinationCard destination={d} onPress={() => openDestination(d)} />
              </View>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>SANA ÖZEL</Text>
            <Text style={styles.sectionTitle}>Concierge Önerileri</Text>
          </View>
          {suggestion ? (
            <View style={styles.suggestionCard}>
              <View style={styles.suggestionIcon}>
                <Ionicons name="time-outline" size={16} color={colors.accentTeal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionLabel}>ARAMA GEÇMİŞİNDEN</Text>
                <Text style={styles.suggestionText}>{suggestion.message}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", marginTop: 4 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  dash: { width: 18, height: 2, backgroundColor: colors.accentAmber, borderRadius: 1 },
  subtitle: { color: colors.textSecondary, fontSize: 12.5 },
  errorText: { color: colors.danger, fontSize: 12.5, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  gridItem: { width: "47%" },
  sectionHeaderRow: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 2 },
  suggestionCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentTealDim,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  suggestionText: { color: colors.textPrimary, fontSize: 13, marginTop: 2 },
});
