import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";
import { useOnline } from "@/features/network/use-online";
import { Sentry } from "@/lib/sentry";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { ImagePlus } from "@/ui/icons";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";
import { compressPhoto, pickPhoto, PhotoTooLargeError, uploadPhoto } from "../photo";

/**
 * The profile photo or logo. Uploading needs the network, so it is never
 * queued (PLAN.md §4.5); everything else in the editor works offline.
 */
export function PhotoField({
  label,
  url,
  accountId,
  pageId,
  onChange,
}: {
  label: string;
  url: string | undefined;
  /** Null until the account has loaded; the button waits for it. */
  accountId: string | null;
  pageId: string;
  onChange: (url: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [busy, setBusy] = useState(false);

  async function choose() {
    if (!online) {
      toast.show(t("editor.photoOffline"));
      return;
    }
    if (!accountId) return;
    const picked = await pickPhoto();
    if (!picked) return;
    setBusy(true);
    try {
      const base64 = await compressPhoto(picked);
      onChange(await uploadPhoto(accountId, pageId, base64));
    } catch (error) {
      if (error instanceof PhotoTooLargeError) {
        toast.show(t("editor.photoTooLarge"));
      } else {
        Sentry.captureException(error);
        toast.show(t("editor.photoFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text variant="bodySm" weight="medium">
        {label}
      </Text>
      <View style={styles.row}>
        {url ? (
          <Image source={{ uri: url }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.image, styles.empty, { borderColor: colors.borderStrong }]}>
            <ImagePlus size={24} color={colors.muted} />
          </View>
        )}
        <View style={styles.buttons}>
          <Button
            label={url ? t("editor.changePhoto") : t("editor.addPhoto")}
            variant="secondary"
            onPress={choose}
            loading={busy}
            loadingLabel={t("editor.uploading")}
            disabled={!accountId}
          />
          {url && !busy ? (
            <Button label={t("editor.removePhoto")} variant="ghost" onPress={() => onChange(undefined)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  image: { width: 72, height: 72, borderRadius: radius.full },
  empty: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  buttons: { flex: 1, gap: space.xs },
});
