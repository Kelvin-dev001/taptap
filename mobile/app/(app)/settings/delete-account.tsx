import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { callAppApi, NetworkError } from "@/api/app-api";
import { supabase } from "@/api/supabase";
import { sendSignInCode } from "@/auth/email-codes";
import { authErrorKey } from "@/auth/errors";
import { useSession, useSignedInUser } from "@/auth/session";
import { CODE_LENGTH } from "@/auth/validation";
import { BusinessName } from "@/features/account/business-name";
import { useOnline } from "@/features/network/use-online";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { CodeField } from "@/ui/code-field";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";
import { useToast } from "@/ui/toast";

type Proof = "password" | "code";

/**
 * Delete account (PLAN.md §6, Apple 5.1.1(v), Google Play). Says plainly what
 * goes and what stays (decided with Kelvin, 11 Oct 2026), asks the person to
 * prove it is them — a password, or a code by email — and confirms once more.
 * The server needs that sign-in to be minutes old (0033, W7).
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const user = useSignedInUser();
  const { signOut } = useSession();
  const [proof, setProof] = useState<Proof>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? "";

  async function sendCode() {
    setProblem(null);
    setBusy(true);
    const { error } = await sendSignInCode(email);
    setBusy(false);
    if (error) setProblem(t(authErrorKey(error)));
    else setCodeSent(true);
  }

  /** A fresh sign-in, so the server sees one from the last few minutes. */
  async function proveItIsYou(): Promise<boolean> {
    const { error } =
      proof === "password"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setProblem(t(authErrorKey(error)));
      return false;
    }
    return true;
  }

  async function remove() {
    setProblem(null);
    setBusy(true);
    try {
      if (!(await proveItIsYou())) return;
      const { status, body } = await callAppApi("POST", "/api/app/v1/account/delete", {});
      if (status === 202) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const member = body.scope === "member";
        await signOut();
        toast.show(t(member ? "deleteAccount.doneMember" : "deleteAccount.done"));
        return;
      }
      setProblem(
        t(
          body.code === "staff"
            ? "deleteAccount.staff"
            : body.code === "reauthenticate"
              ? "deleteAccount.reauthenticate"
              : "deleteAccount.failed",
        ),
      );
    } catch (error) {
      setProblem(t(error instanceof NetworkError ? "auth.errors.offline" : "deleteAccount.failed"));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const ready = online && (proof === "password" ? password.length > 0 : codeSent && code.length === CODE_LENGTH);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("deleteAccount.title") }} />
      <View style={styles.intro}>
        <BusinessName variant="sectionTitle" />
        <Text tone="foregroundSecondary">{t("deleteAccount.intro")}</Text>
      </View>

      <Card>
        <Text variant="cardTitle">{t("deleteAccount.goesTitle")}</Text>
        <Text variant="bodySm" tone="foregroundSecondary">
          {t("deleteAccount.goes")}
        </Text>
        <Text variant="cardTitle">{t("deleteAccount.staysTitle")}</Text>
        <Text variant="bodySm" tone="foregroundSecondary">
          {t("deleteAccount.stays")}
        </Text>
        <Text variant="cardTitle">{t("deleteAccount.sharedTitle")}</Text>
        <Text variant="bodySm" tone="foregroundSecondary">
          {t("deleteAccount.shared")}
        </Text>
      </Card>

      <Card>
        <Text variant="cardTitle">{t("deleteAccount.proveTitle")}</Text>
        {proof === "password" ? (
          <>
            <TextField
              label={t("signIn.password")}
              value={password}
              onChangeText={setPassword}
              secure
              autoComplete="current-password"
              textContentType="password"
            />
            <Button label={t("deleteAccount.useCode")} variant="ghost" onPress={() => setProof("code")} />
          </>
        ) : (
          <>
            {codeSent ? (
              <>
                <Text variant="bodySm" tone="foregroundSecondary">
                  {t("code.sentTo", { length: CODE_LENGTH, email })}
                </Text>
                <CodeField label={t("code.label", { length: CODE_LENGTH })} value={code} onChange={setCode} />
              </>
            ) : (
              <Button label={t("signIn.emailCode")} variant="secondary" onPress={() => void sendCode()} loading={busy} />
            )}
            <Button label={t("deleteAccount.usePassword")} variant="ghost" onPress={() => setProof("password")} />
          </>
        )}
      </Card>

      {problem ? <Notice tone="danger" message={problem} /> : null}
      {!online ? <Notice tone="offline" message={t("deleteAccount.offline")} /> : null}

      <Button label={t("deleteAccount.submit")} variant="danger" disabled={!ready} onPress={() => setConfirming(true)} />

      <ConfirmSheet
        visible={confirming}
        title={t("deleteAccount.confirmTitle")}
        body={t("deleteAccount.confirmBody")}
        confirmLabel={t("deleteAccount.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs },
});
