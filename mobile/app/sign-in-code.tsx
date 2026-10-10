import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { supabase } from "@/api/supabase";
import { authErrorKey } from "@/auth/errors";
import { sendSignInCode } from "@/auth/email-codes";
import { RESEND_SECONDS, useCooldown } from "@/auth/use-cooldown";
import { CODE_LENGTH } from "@/auth/validation";
import { useOnline } from "@/features/network/use-online";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { CodeField } from "@/ui/code-field";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";

/**
 * The emailed code (PLAN.md §4.4). It signs in as soon as the last digit is in
 * — typed, pasted or offered by iOS from Mail — and the button does the same
 * for anyone who prefers to press it.
 */
export default function SignInCode() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  // The code was sent just before this screen opened.
  const cooldown = useCooldown(RESEND_SECONDS);

  async function verify(value: string = code) {
    if (value.length !== CODE_LENGTH) {
      setError(t("code.incomplete", { length: CODE_LENGTH }));
      return;
    }
    setError(null);
    setBusy("verify");
    const { error: failure } = await supabase.auth.verifyOtp({
      email,
      token: value,
      type: "email",
    });
    setBusy(null);
    if (failure) {
      setError(t(authErrorKey(failure)));
      return;
    }
    // Signed in: the guard opens the app.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function resend() {
    setError(null);
    setBusy("resend");
    const { error: failure } = await sendSignInCode(email);
    setBusy(null);
    if (failure) {
      setError(t(authErrorKey(failure)));
      return;
    }
    setCode("");
    cooldown.start();
    toast.show(t("code.resent"));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="pageTitle" accessibilityRole="header">
          {t("code.heading")}
        </Text>
        <Text tone="foregroundSecondary">{t("code.sentTo", { length: CODE_LENGTH, email })}</Text>
      </View>

      {!online ? <Notice tone="offline" message={t("offline.signIn")} /> : null}

      <CodeField
        label={t("code.label", { length: CODE_LENGTH })}
        value={code}
        onChange={(value) => {
          setCode(value);
          setError(null);
        }}
        onComplete={(value) => void verify(value)}
        error={error}
        editable={busy !== "verify"}
        autoFocus
        testID="code-input"
      />

      <Button
        label={t("code.submit")}
        loading={busy === "verify"}
        loadingLabel={t("code.submitting")}
        disabled={busy !== null || !online}
        onPress={() => void verify()}
      />

      <Text variant="bodySm" tone="muted">
        {t("code.spam")}
      </Text>

      <View style={styles.links}>
        <Button
          label={
            cooldown.remaining > 0
              ? t("code.resendIn", { seconds: cooldown.remaining })
              : t("code.resend")
          }
          variant="ghost"
          loading={busy === "resend"}
          disabled={cooldown.remaining > 0 || busy !== null || !online}
          onPress={() => void resend()}
        />
        <Button label={t("code.differentEmail")} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  links: { gap: space.xs },
});
