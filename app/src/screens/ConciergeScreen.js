import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { ChatBubble } from "../components/ChatBubble";
import { RouteCard } from "../components/RouteCard";
import { FilterChip } from "../components/FilterChip";
import { api } from "../api/client";

const FILTERS = [
  { key: "butce-dostu", label: "Bütçe dostu" },
  { key: "aktarmasiz-ucuslar", label: "Aktarmasız uçuşlar" },
  { key: "5-yildizli-otel", label: "5 yıldızlı otel" },
];

export function ConciergeScreen({ navigation, route }) {
  const [messages, setMessages] = useState([
    { id: "m0", role: "assistant", text: "Nereye gitmek istersin?" },
  ]);
  const [routes, setRoutes] = useState([]);
  const [inputText, setInputText] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastQuery = useRef("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const runSearch = useCallback(async (text, filters, history) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.searchConcierge(text, filters, history);
      setRoutes(result.routes);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: result.reply },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
    }
  }, []);

  const onSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    lastQuery.current = text;
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
    setInputText("");
    // Keep the keyboard/caret in the field so the user can type the next
    // message without tapping the input again.
    inputRef.current?.focus();
    runSearch(text, activeFilters, history);
  }, [inputText, activeFilters, runSearch, messages]);

  const toggleFilter = useCallback(
    (key) => {
      setActiveFilters((prev) => {
        const next = prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key];
        if (lastQuery.current) {
          const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text }));
          runSearch(lastQuery.current, next, history);
        }
        return next;
      });
    },
    [runSearch, messages]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.eyebrow}>KİŞİSEL CONCIERGE</Text>
            <Text style={styles.title}>Merhaba, Ayşe</Text>
          </View>
        </View>
        <View style={styles.locationChip}>
          <Ionicons name="location" size={13} color={colors.accentTeal} />
          <Text style={styles.locationText}>İstanbul (IST)</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={listRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        >
          <Text style={styles.sectionLabel}>BUGÜN</Text>
          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} text={m.text} />
          ))}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accentTeal} />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {routes.length > 0 ? (
            <>
              <Text style={styles.routeSubLabel}>Uçuş ve konaklama birlikte değerlendirildi</Text>
              <FlatList
                data={routes}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.destinationId}
                contentContainerStyle={{ paddingVertical: spacing.sm }}
                renderItem={({ item }) => (
                  <RouteCard
                    route={item}
                    onPress={() =>
                      navigation.navigate("DestinationDetail", {
                        destinationId: item.destinationId,
                        prefill: item,
                      })
                    }
                  />
                )}
              />

              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>ARAMAYI İNCELT</Text>
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    active={activeFilters.includes(f.key)}
                    onPress={() => toggleFilter(f.key)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.inputBar}>
          <Pressable style={styles.micButton} accessibilityLabel="Sesli arama">
            <Ionicons name="mic-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Seyahatini anlat..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={onSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable style={styles.sendButton} onPress={onSend} accessibilityLabel="Gönder">
            <Ionicons name="arrow-up" size={18} color={colors.background} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTop: { flex: 1 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  locationText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  chatArea: { flex: 1, paddingHorizontal: spacing.lg },
  chatContent: { paddingBottom: spacing.lg },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  routeSubLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
  },
  loadingRow: { paddingVertical: spacing.md, alignItems: "flex-start" },
  errorText: { color: colors.danger, fontSize: 12.5, marginBottom: spacing.md },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accentAmber,
    alignItems: "center",
    justifyContent: "center",
  },
});
