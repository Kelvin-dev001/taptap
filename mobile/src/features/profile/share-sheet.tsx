import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Linking, Share, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";
import { whatsAppShareUrl } from "./share";

/**
 * Share a profile: WhatsApp first, because that is where Kenyan customers are
 * (CLAUDE.md §22); then the phone's own share sheet; then the bare link.
 */
export function ShareSheet({
  visible,
  onClose,
  name,
  url,
}: {
  visible: boolean;
  onClose: () => void;
  name: string | null;
  url: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const message = name ? t("share.message", { name, url }) : url;

  async function whatsApp() {
    try {
      await Linking.openURL(whatsAppShareUrl(message));
      onClose();
    } catch {
      toast.show(t("share.whatsappFailed"));
    }
  }

  async function more() {
    try {
      // `url` too, for iOS, which shows it as a link preview.
      await Share.share({ message, url });
      onClose();
    } catch {
      // Dismissing the share sheet is not an error worth a message.
    }
  }

  async function copy() {
    await Clipboard.setStringAsync(url);
    onClose();
    toast.show(t("share.copied"));
  }

  return (
    <Sheet visible={visible} title={t("share.title")} onClose={onClose}>
      <Text variant="bodySm" tone="muted" selectable>
        {url}
      </Text>
      <View style={styles.buttons}>
        <Button label={t("share.whatsapp")} onPress={whatsApp} />
        <Button label={t("share.more")} variant="secondary" onPress={more} />
        <Button label={t("share.copy")} variant="secondary" onPress={copy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.sm, marginTop: space.md },
});
