import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type TextInput } from "react-native";
import { supabase } from "@/api/supabase";
import { authErrorKey } from "@/auth/errors";
import { sendResetCode } from "@/auth/email-codes";
import { useSession } from "@/auth/session";
import { RESEND_SECONDS, useCooldown } from "@/auth/use-cooldown";
import {
  CODE_LENGTH,
  isPlausibleEmail,
  MIN_PASSWORD_LENGTH,
  newPasswordProblem,
  normaliseEmail,
} from "@/auth/validation";
import { useOnline } from "@/features/network/use-online";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { CodeField } from "@/ui/code-field";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";
import { useToast } from "@/ui/toast";

/**
 * Reset a forgotten password without leaving the app (PLAN.md §4.4):
 * email → code → new password twice → signed in.
 *
 * The code signs the person in (supabase-js: PASSWORD_RECOVERY), but the
 * session state keeps them here until the new password is saved. If saving
 * fails — too weak, the same as before — they fix it and try again without a
 * new code: the code is spent, the session it gave is not.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const { finishRecovery } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const newPasswordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<"send" | "save" | null>(null);
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
    confirmation?: string;
    form?: string;
  }>({});
  const cooldown = useCooldown();

  // Leaving after the code was accepted but before a new password was saved:
  // the person proved they own the inbox, so they stay signed in.
  const verifiedRef = useRef(false);
  useEffect(() => {
    verifiedRef.current = verified;
  }, [verified]);
  useEffect(
    () => () => {
      if (verifiedRef.current) finishRecovery();
    },
    [finishRecovery],
  );

  async function send() {
    setErrors({});
    if (!isPlausibleEmail(email)) {
      setErrors({ email: t("signIn.emailInvalid") });
      return;
    }
    const address = normaliseEmail(email);
    setEmail(address);
    setBusy("send");
    const { error } = await sendResetCode(address);
    setBusy(null);
    if (error) {
      setErrors({ form: t(authErrorKey(error)) });
      return;
    }
    cooldown.start(RESEND_SECONDS);
    if (step === "reset") toast.show(t("code.resent"));
    setStep("reset");
  }

  async function save() {
    const problem = newPasswordProblem(password, confirmation);
    const next: typeof errors = {};
    if (!verified && code.length !== CODE_LENGTH) {
      next.code = t("code.incomplete", { length: CODE_LENGTH });
    }
    if (problem === "tooShort") next.password = t("forgot.tooShort", { min: MIN_PASSWORD_LENGTH });
    if (problem === "mismatch") next.confirmation = t("forgot.mismatch");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy("save");
    if (!verified) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (error) {
        setBusy(null);
        setErrors({ code: t(authErrorKey(error)) });
        return;
      }
      setVerified(true);
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) {
      setErrors({ password: t(authErrorKey(error)) });
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show(t("forgot.done"));
    setVerified(false);
    // Opens the app.
    finishRecovery();
  }

  if (step === "email") {
    return (
      <Screen>
        <View style={styles.header}>
          <Text variant="pageTitle" accessibilityRole="header">
            {t("forgot.heading")}
          </Text>
          <Text tone="foregroundSecondary">{t("forgot.intro")}</Text>
        </View>
        {!online ? <Notice tone="offline" message={t("offline.signIn")} /> : null}
        {errors.form ? <Notice tone="danger" message={errors.form} /> : null}
        <TextField
          label={t("signIn.email")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErrors({});
          }}
          error={errors.email}
          placeholder={t("signIn.emailPlaceholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
        />
        <Button
          label={t("forgot.send")}
          loading={busy === "send"}
          loadingLabel={t("forgot.sending")}
          disabled={busy !== null || !online}
          onPress={() => void send()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="pageTitle" accessibilityRole="header">
          {t("forgot.heading")}
        </Text>
        <Text tone="foregroundSecondary">{t("forgot.sentTo", { email, length: CODE_LENGTH })}</Text>
      </View>
      {!online ? <Notice tone="offline" message={t("offline.signIn")} /> : null}
      {errors.form ? <Notice tone="danger" message={errors.form} /> : null}

      {verified ? (
        <Notice tone="success" message={t("forgot.codeAccepted")} />
      ) : (
        <CodeField
          label={t("code.label", { length: CODE_LENGTH })}
          value={code}
          onChange={(value) => {
            setCode(value);
            setErrors((e) => ({ ...e, code: undefined }));
          }}
          onComplete={() => newPasswordRef.current?.focus()}
          error={errors.code}
          editable={busy === null}
          autoFocus
        />
      )}

      <TextField
        ref={newPasswordRef}
        label={t("forgot.newPassword")}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setErrors((e) => ({ ...e, password: undefined }));
        }}
        error={errors.password}
        hint={t("forgot.passwordHint", { min: MIN_PASSWORD_LENGTH })}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label={t("forgot.confirmPassword")}
        value={confirmation}
        onChangeText={(v) => {
          setConfirmation(v);
          setErrors((e) => ({ ...e, confirmation: undefined }));
        }}
        error={errors.confirmation}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />

      <Button
        label={t("forgot.save")}
        loading={busy === "save"}
        loadingLabel={t("forgot.saving")}
        disabled={busy !== null || !online}
        onPress={() => void save()}
      />

      {!verified ? (
        <Button
          label={
            cooldown.remaining > 0
              ? t("code.resendIn", { seconds: cooldown.remaining })
              : t("code.resend")
          }
          variant="ghost"
          disabled={cooldown.remaining > 0 || busy !== null || !online}
          onPress={() => void send()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
});
