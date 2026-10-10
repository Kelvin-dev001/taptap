import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type TextInput } from "react-native";
import { supabase } from "@/api/supabase";
import { authErrorKey } from "@/auth/errors";
import { sendSignInCode } from "@/auth/email-codes";
import { useSession } from "@/auth/session";
import { isPlausibleEmail, normaliseEmail } from "@/auth/validation";
import { envReady } from "@/config/env";
import { useOnline } from "@/features/network/use-online";
import { devToolsEnabled } from "@/lib/build";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";

type Busy = "password" | "code" | null;

/**
 * Sign in (PLAN.md §4.4): email and password as the one primary action, a
 * code by email as the alternative, and a way to reset a forgotten password.
 * The app never creates accounts; nothing here links anywhere to buy.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { state } = useSession();
  const online = useOnline();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const expired = state.status === "signedOut" && state.reason === "expired";
  const disabled = busy !== null || !online || !envReady;

  function checkEmail(): string | null {
    if (isPlausibleEmail(email)) return normaliseEmail(email);
    setEmailError(t("signIn.emailInvalid"));
    return null;
  }

  async function signInWithPassword() {
    setFormError(null);
    setPasswordError(null);
    const address = checkEmail();
    if (!address) return;
    if (!password) {
      setPasswordError(t("signIn.passwordMissing"));
      return;
    }
    setBusy("password");
    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(null);
    if (error) {
      setFormError(t(authErrorKey(error)));
      return;
    }
    // Success: the session provider sees SIGNED_IN and the guard opens the app.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function emailMeACode() {
    setFormError(null);
    const address = checkEmail();
    if (!address) return;
    setBusy("code");
    const { error } = await sendSignInCode(address);
    setBusy(null);
    if (error) {
      setFormError(t(authErrorKey(error)));
      return;
    }
    router.push({ pathname: "/sign-in-code", params: { email: address } });
  }

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <Text variant="cardTitle" tone="accentText">
          {t("app.name")}
        </Text>
        <Text variant="pageTitle" accessibilityRole="header">
          {t("signIn.title")}
        </Text>
        <Text tone="foregroundSecondary">{t("signIn.subtitle")}</Text>
      </View>

      {!envReady ? <Notice tone="danger" message={t("signIn.notConfigured")} /> : null}
      {!online ? <Notice tone="offline" message={t("offline.signIn")} /> : null}
      {expired && !formError ? <Notice tone="info" message={t("signIn.expired")} /> : null}
      {formError ? <Notice tone="danger" message={formError} /> : null}

      <View style={styles.form}>
        <TextField
          label={t("signIn.email")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          error={emailError}
          placeholder={t("signIn.emailPlaceholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          testID="sign-in-email"
        />
        <TextField
          ref={passwordRef}
          label={t("signIn.password")}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          error={passwordError}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void signInWithPassword()}
          testID="sign-in-password"
        />
        <View style={styles.forgot}>
          <Button
            label={t("signIn.forgot")}
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/forgot-password",
                params: { email: normaliseEmail(email) },
              })
            }
          />
        </View>
        <Button
          label={t("signIn.submit")}
          loading={busy === "password"}
          loadingLabel={t("signIn.submitting")}
          disabled={disabled}
          onPress={() => void signInWithPassword()}
          testID="sign-in-submit"
        />
      </View>

      <View
        style={styles.divider}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text variant="caption" tone="muted">
          {t("common.or")}
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>

      <Button
        label={t("signIn.emailCode")}
        variant="secondary"
        loading={busy === "code"}
        loadingLabel={t("signIn.sendingCode")}
        disabled={disabled}
        onPress={() => void emailMeACode()}
        testID="sign-in-code"
      />

      {devToolsEnabled ? (
        <Button
          label={t("signIn.devTools")}
          variant="ghost"
          onPress={() => router.push("/dev/foundation")}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, paddingTop: space.xxl },
  form: { gap: space.lg },
  forgot: { alignItems: "flex-end", marginTop: -space.sm },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
