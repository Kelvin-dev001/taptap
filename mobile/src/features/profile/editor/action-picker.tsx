import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import type { BlockType } from "@taptap/core/profile";
import { space } from "@/theme/tokens";
import { ListRow } from "@/ui/list-row";
import { Sheet } from "@/ui/sheet";
import { Text } from "@/ui/text";
import { blockIcon } from "../block-icon";
import { actionDescription, actionGroups, actionLabel } from "../blocks";

/** "Add an action": what the button does first, the details after (CLAUDE.md §12). */
export function ActionPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (type: BlockType) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} title={t("editor.action.chooseTitle")} onClose={onClose}>
      {actionGroups(t).map((group) => (
        <View key={group.title} style={styles.group}>
          <Text variant="label" tone="muted" accessibilityRole="header">
            {group.title.toUpperCase()}
          </Text>
          {group.types.map((type) => (
            <ListRow
              key={type}
              title={actionLabel(t, type)}
              subtitle={actionDescription(t, type)}
              icon={blockIcon(type)}
              onPress={() => onPick(type)}
            />
          ))}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: space.md },
});
