import { useTranslation } from "react-i18next";
import { Pressable, Switch, StyleSheet, View } from "react-native";
import type { AppBlock } from "@/api/pages";
import { isBlockType } from "@taptap/core/draft";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { ArrowDown, ArrowUp, ChevronRight } from "@/ui/icons";
import { IconButton } from "@/ui/icon-button";
import { Text } from "@/ui/text";
import { BlockIcon } from "../block-icon";
import { actionDescription, actionLabel } from "../blocks";

/**
 * One action in the editor. Tap to edit; the switch shows or hides it; the
 * arrows move it. Arrows rather than dragging (PLAN.md §0 #8): WCAG 2.5.7 wants
 * a way to reorder without dragging anyway, and arrows work with a screen reader.
 */
export function ActionRow({
  block,
  first,
  last,
  onEdit,
  onToggle,
  onMove,
}: {
  block: AppBlock;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onMove: (by: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const known = isBlockType(block.type);
  const label = block.label || actionLabel(t, block.type);
  const detail = isBlockType(block.type)
    ? block.value || actionDescription(t, block.type)
    : t("editor.unknownAction");

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]}>
      <Pressable
        onPress={onEdit}
        disabled={!known}
        accessibilityRole={known ? "button" : undefined}
        accessibilityLabel={known ? t("editor.editAction", { label }) : label}
        accessibilityHint={detail}
        style={({ pressed }) => [styles.main, pressed ? { backgroundColor: colors.surfaceSunken } : null]}
      >
        <BlockIcon type={block.type} size={20} color={block.isActive ? colors.foregroundSecondary : colors.muted} />
        <View style={styles.text}>
          <Text variant="body" tone={block.isActive ? "foreground" : "muted"} numberOfLines={1}>
            {label}
          </Text>
          <Text variant="bodySm" tone="muted" numberOfLines={1}>
            {block.isActive ? detail : t("editor.hiddenAction")}
          </Text>
        </View>
        {known ? <ChevronRight size={20} color={colors.muted} /> : null}
      </Pressable>
      <View style={styles.controls}>
        <Switch
          value={block.isActive}
          onValueChange={onToggle}
          accessibilityLabel={t("editor.showAction", { label })}
          trackColor={{ false: colors.borderStrong, true: colors.accentFill }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.borderStrong}
        />
        <View style={styles.spacer} />
        <IconButton icon={ArrowUp} label={t("editor.moveUp", { label })} onPress={() => onMove(-1)} disabled={first} />
        <IconButton icon={ArrowDown} label={t("editor.moveDown", { label })} onPress={() => onMove(1)} disabled={last} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  main: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingVertical: space.xs },
  text: { flex: 1, gap: space.xxs },
  controls: { flexDirection: "row", alignItems: "center" },
  spacer: { flex: 1 },
});
