import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TextInput, View } from "react-native";
import { CODE_LENGTH, sanitiseCode } from "@/auth/validation";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

type CodeFieldProps = {
  label: string;
  value: string;
  onChange: (code: string) => void;
  /** Called once all the digits are in — typed, pasted or autofilled. */
  onComplete?: (code: string) => void;
  error?: string | null;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * The emailed sign-in code as a row of boxes (PLAN.md §4.4).
 *
 * The boxes are only a picture. One real, invisible text field lies on top of
 * them, so typing, pasting, the iOS "From Mail" suggestion (oneTimeCode) and
 * screen readers all work on a normal input. The boxes are hidden from screen
 * readers, which read the field and its value instead.
 */
export const CodeField = forwardRef<TextInput, CodeFieldProps>(function CodeField(
  { label, value, onChange, onComplete, error, editable = true, autoFocus, testID },
  ref,
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <View style={styles.wrap}>
      <Text variant="bodySm" weight="medium">
        {label}
      </Text>
      <View>
        <View
          style={styles.row}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const isActive = focused && i === active;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    backgroundColor: editable ? colors.surface : colors.surfaceSunken,
                    borderColor: error
                      ? colors.danger
                      : isActive
                        ? colors.accentFill
                        : colors.borderStrong,
                    borderWidth: isActive || error ? 2 : 1,
                  },
                ]}
              >
                <Text variant="metric" maxFontSizeMultiplier={1.3}>
                  {value[i] ?? ""}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={(raw) => {
            const code = sanitiseCode(raw);
            onChange(code);
            if (code.length === CODE_LENGTH && code !== value) onComplete?.(code);
          }}
          editable={editable}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          caretHidden
          contextMenuHidden={false}
          accessibilityLabel={error ? t("field.labelWithError", { label, error }) : label}
          style={[StyleSheet.absoluteFill, styles.input]}
        />
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: "row", gap: space.sm },
  box: {
    flex: 1,
    maxWidth: 56,
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  // Present and tappable, but nothing of it shows: the boxes are the picture.
  input: { color: "transparent", backgroundColor: "transparent", fontSize: 1 },
});
