import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "./button";
import { CircleAlert } from "./icons";
import { Text } from "./text";

/** What a screen shows when its data could not load and there is nothing cached. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <CircleAlert size={28} color={colors.danger} />
      <Text tone="foregroundSecondary" style={styles.center}>
        {message}
      </Text>
      <Button label={t("common.tryAgain")} variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl },
  center: { textAlign: "center" },
});
