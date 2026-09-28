import { Platform } from "react-native";
import NfcManager, { NfcError, NfcTech } from "react-native-nfc-manager";
import { readCardRecords, type CardRead } from "./card-url";

/**
 * The only file that talks to the NFC library (PLAN.md §4.6). If v4 of
 * react-native-nfc-manager fails the M0 hardware check, a local Expo module
 * replaces what is behind these three functions and nothing else changes.
 *
 * Reading never logs an analytics event: the person tapping is the owner, not
 * a customer (§15), and nothing here touches the network.
 */

export type NfcAvailability = "ready" | "disabled" | "unsupported";

export type ScanResult = CardRead | { kind: "cancelled" } | { kind: "error"; message: string };

let started: Promise<void> | null = null;

function ensureStarted(): Promise<void> {
  started ??= NfcManager.start();
  return started;
}

export async function nfcAvailability(): Promise<NfcAvailability> {
  try {
    if (!(await NfcManager.isSupported())) return "unsupported";
    await ensureStarted();
    // iPhones have no NFC switch: if the hardware is there, it is on.
    if (Platform.OS === "ios") return "ready";
    return (await NfcManager.isEnabled()) ? "ready" : "disabled";
  } catch {
    return "unsupported";
  }
}

function isCancel(error: unknown): boolean {
  if (error instanceof NfcError.UserCancel) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/**
 * Waits for one tag and reads it. On Android the app holds the NFC reader
 * while this runs, so the tap cannot open the browser; on iPhone Apple's
 * "Ready to Scan" sheet shows `iosAlert`.
 */
export async function scanCard(iosAlert: string, iosSuccess: string): Promise<ScanResult> {
  try {
    await ensureStarted();
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: iosAlert });
    const tag = await NfcManager.getTag();
    const result = readCardRecords(tag?.ndefMessage);
    if (Platform.OS === "ios" && result.kind === "card") {
      await NfcManager.setAlertMessageIOS(iosSuccess).catch(() => undefined);
    }
    return result;
  } catch (error) {
    if (isCancel(error)) return { kind: "cancelled" };
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export function cancelScan(): Promise<void> {
  return NfcManager.cancelTechnologyRequest().catch(() => undefined);
}

/** Android only: opens the system NFC settings so the owner can switch it on. */
export function openNfcSettings(): Promise<boolean> {
  return NfcManager.goToNfcSetting();
}
