/**
 * Push notifications through Expo's push service (docs/mobile/PLAN.md §4.7,
 * §9 W9).
 *
 * What a notification may say was decided with Kelvin on 12 Oct 2026: never a
 * customer's name or number (it passes through Google and Apple and sits on a
 * lock screen — the app shows the details once opened), and card terms in the
 * neutral words of PLAN.md §3 — no price, no "renew", no link to pay.
 *
 * The composers are pure and tested. `sendPush` talks to Expo; with
 * EXPO_ACCESS_TOKEN set (and "enhanced security" on in the Expo dashboard),
 * nobody but this server can push to TapTap's users.
 */

import { GRACE_DAYS } from "../pricing";
import type { RenewalMilestone } from "./renewal-email";

/** Android notification channels the app creates; the owner can mute each one. */
export type PushChannel = "leads" | "cards" | "account";

export type PushMessage = {
  title: string;
  body: string;
  /** What the app opens when the notification is tapped. Ids only, never content. */
  data: { kind: "lead" | "first_tap" | "term"; id?: string };
  channelId: PushChannel;
};

const date = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
const formatDate = (iso: string) => date.format(new Date(iso));

/** "New lead · Someone left their details on Mama Njeri's Kitchen." */
export function composeLeadPush(input: { leadId: string; profileTitle: string | null }): PushMessage {
  return {
    title: "New lead",
    body: input.profileTitle
      ? `Someone left their details on ${input.profileTitle}.`
      : "Someone left their details on your profile.",
    data: { kind: "lead", id: input.leadId },
    channelId: "leads",
  };
}

/** A card's name as its owner knows it. */
export function pushCardName(card: { label?: string | null; kind?: string | null }): string {
  return card.label?.trim() || (card.kind === "stand" ? "Your stand" : "Your card");
}

/** "Your card is live · 'Reception' was tapped for the first time." */
export function composeFirstTapPush(input: { cardId: string; cardName: string }): PushMessage {
  return {
    title: "Your card is live",
    body: `${quoted(input.cardName)} was tapped for the first time.`,
    data: { kind: "first_tap", id: input.cardId },
    channelId: "cards",
  };
}

/**
 * A card's term, in PLAN.md §3's words exactly:
 *   T30 / T7   "'Reception' is active until 31 Dec 2026."
 *   T0         "'Reception': term ended 31 Dec 2026. Still working until 14 Jan 2027."
 *   stopped    "'Reception' is no longer active."
 */
export function composeTermPush(input: {
  cardId: string;
  cardName: string;
  termEnd: string;
  milestone: RenewalMilestone;
}): PushMessage {
  const name = quoted(input.cardName);
  let body: string;
  switch (input.milestone) {
    case "T30":
    case "T7":
      body = `${name} is active until ${formatDate(input.termEnd)}.`;
      break;
    case "T0": {
      const graceEnd = new Date(new Date(input.termEnd).getTime() + GRACE_DAYS * 86_400_000).toISOString();
      body = `${name}: term ended ${formatDate(input.termEnd)}. Still working until ${formatDate(graceEnd)}.`;
      break;
    }
    case "stopped":
      body = `${name} is no longer active.`;
      break;
  }
  return { title: "TapTap card", body, data: { kind: "term", id: input.cardId }, channelId: "account" };
}

/** Generic names read better unquoted: "Your card was tapped…", not "'Your card' was…". */
function quoted(name: string): string {
  return name === "Your card" || name === "Your stand" ? name : `‘${name}’`;
}

export type PushResult = {
  /** Tickets Expo accepted — handed to Google or Apple, not proof anyone saw it. */
  sent: number;
  failed: number;
  /** Phones the app has been removed from: stop sending to them. */
  goneTokens: string[];
  errors: string[];
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo takes at most 100 messages per request. */
const BATCH = 100;

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

export async function sendPush(
  tokens: string[],
  message: PushMessage,
  fetcher: typeof fetch = fetch,
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, goneTokens: [], errors: [] };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const body = batch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data,
      channelId: message.channelId,
      sound: "default",
      // Leads are time-sensitive: high priority wakes a phone in Doze, which
      // matters on Tecno, Infinix and itel phones (PLAN.md §4.7).
      priority: message.channelId === "leads" ? "high" : "default",
    }));
    try {
      const res = await fetcher(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Ticket[]; errors?: { message?: string }[] };
      if (!res.ok || !Array.isArray(json.data)) {
        result.failed += batch.length;
        result.errors.push(json.errors?.[0]?.message ?? `Expo answered ${res.status}`);
        continue;
      }
      json.data.forEach((ticket, j) => {
        if (ticket.status === "ok") {
          result.sent += 1;
          return;
        }
        result.failed += 1;
        if (ticket.details?.error === "DeviceNotRegistered") result.goneTokens.push(batch[j]);
        else result.errors.push(ticket.message ?? ticket.details?.error ?? "push refused");
      });
    } catch (error) {
      result.failed += batch.length;
      result.errors.push(error instanceof Error ? error.message : "push failed");
    }
  }
  return result;
}
