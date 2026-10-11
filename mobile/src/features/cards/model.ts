import type { TFunction } from "i18next";
import type { Card } from "@/api/cards";
import type { Profile } from "@/api/pages";
import { daysUntil, identityState } from "@taptap/core/identity";
import { GRACE_DAYS } from "@taptap/core/pricing";
import { formatDate } from "@/i18n/format";
import type { BadgeTone } from "@/ui/badge";

/**
 * What a card's state means to its owner, in the app's neutral words
 * (PLAN.md §3, Adjustment 1): when it is active until, when it stopped — never
 * "renew", never a price, never a link to pay. The web's IDENTITY_STATE_META
 * carries payment prompts, so the app has its own wording; the state itself
 * comes from the same lib/identity.ts.
 */
export type CardBadge = "active" | "ending" | "grace" | "inactive" | "off" | "preparing";

export const CARD_TONE: Record<CardBadge, BadgeTone> = {
  active: "success",
  ending: "warning",
  grace: "warning",
  inactive: "danger",
  off: "neutral",
  preparing: "neutral",
};

/** Whether tapping the card opens anything right now. */
export function cardWorks(card: Card, now: Date = new Date()): boolean {
  if (card.isPlaceholder || card.status === "disabled" || !card.smart_page_id) return false;
  const state = identityState(card, now);
  return state === "active" || state === "expiring" || state === "grace";
}

export function cardBadge(card: Card, now: Date = new Date()): CardBadge {
  if (card.isPlaceholder) return "preparing";
  switch (identityState(card, now)) {
    case "disabled":
      return "off";
    case "expiring":
      return "ending";
    case "grace":
      return "grace";
    case "expired":
      return "inactive";
    default:
      return "active";
  }
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** One line under the badge: the term, in the words PLAN.md §3 allows. */
export function cardTermLine(t: TFunction, card: Card, now: Date = new Date()): string {
  if (card.isPlaceholder) return t("cards.term.preparing");
  if (card.status === "disabled") return t("cards.term.off");
  const end = card.term_end;
  if (!end) return t("cards.term.active");
  switch (identityState(card, now)) {
    case "expiring":
      return t("cards.term.ending", { date: formatDate(end), count: daysUntil(end, now) ?? 0 });
    case "grace":
      return t("cards.term.grace", { ended: formatDate(end), until: formatDate(addDays(end, GRACE_DAYS)) });
    case "expired":
      return t("cards.term.inactive", { date: formatDate(addDays(end, GRACE_DAYS)) });
    default:
      return t("cards.term.activeUntil", { date: formatDate(end) });
  }
}

/** A card's name: what the owner called it, else its printed serial, else the end of its token. */
export function cardName(t: TFunction, card: Pick<Card, "label" | "serial" | "token" | "kind">): string {
  if (card.label?.trim()) return card.label.trim();
  const noun = card.kind === "stand" ? t("cards.stand") : t("cards.card");
  if (card.serial) return `${noun} ${card.serial}`;
  return card.token ? `${noun} ···${card.token.slice(-6)}` : noun;
}

/** Serials as printed are matched loosely: case, spaces and dashes do not matter. */
export function normaliseSerial(serial: string): string {
  return serial.replace(/[\s-]/g, "").toUpperCase();
}

export function findBySerial(cards: Card[], serial: string): Card | undefined {
  const wanted = normaliseSerial(serial);
  if (!wanted) return undefined;
  return cards.find((c) => c.serial && normaliseSerial(c.serial) === wanted);
}

/** Profiles a card may open: live ones only (D-021) — a draft's link opens nothing. */
export function linkableProfiles(pages: Profile[]): Profile[] {
  return pages.filter((p) => p.status === "published" && p.isActive);
}
