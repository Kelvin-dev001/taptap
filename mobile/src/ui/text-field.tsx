import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { minTapTarget, radius, space } from "@/theme/tokens";
import { textStyle } from "@/theme/typography";
import { useTheme } from "@/theme/use-theme";
import { Eye, EyeOff } from "./icons";
import { Text } from "./text";

export type TextFieldProps = Omit<TextInputProps, "style" | "secureTextEntry"> & {
  label: string;
  /** Shown under the field in red, and read out with the label. */
  error?: string | null;
  /** Quiet help under the field, e.g. "At least 8 characters." */
  hint?: string;
  /** A password: hidden, with a show/hide button. */
  secure?: boolean;
};

/**
 * A labelled text input, at least 48 dp tall, that grows with the phone's font
 * size. The label is real text above the field — never only a placeholder,
 * which disappears as soon as someone starts typing.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, secure = false, editable = true, onFocus, onBlur, ...input },
  ref,
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.accentFill : colors.borderStrong;

  return (
    <View style={styles.wrap}>
      <Text variant="bodySm" weight="medium">
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor,
            // The focus ring thickens rather than changing size, so nothing shifts.
            borderWidth: focused || error ? 2 : 1,
            paddingHorizontal: focused || error ? space.md - 1 : space.md,
            backgroundColor: editable ? colors.surface : colors.surfaceSunken,
          },
        ]}
      >
        <TextInput
          ref={ref}
          {...input}
          editable={editable}
          secureTextEntry={secure && !revealed}
          accessibilityLabel={error ? t("field.labelWithError", { label, error }) : label}
          accessibilityHint={hint}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accentText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, textStyle("body"), { color: colors.foreground }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t("field.hidePassword") : t("field.showPassword")}
            hitSlop={4}
            style={styles.reveal}
          >
            {revealed ? (
              <EyeOff size={20} color={colors.foregroundSecondary} />
            ) : (
              <Eye size={20} color={colors.foregroundSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  box: {
    minHeight: minTapTarget,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { flex: 1, paddingVertical: space.sm },
  reveal: {
    width: minTapTarget,
    height: minTapTarget,
    marginRight: -space.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
