import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export function ChatBubble({ role, text }) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.accentTealDim,
    borderTopRightRadius: 4,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 14.5,
    lineHeight: 20,
  },
});
