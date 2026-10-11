import type { AppBlock, Profile } from "@/api/pages";
import type { DraftBlock, DraftInput } from "@taptap/core/draft";
import {
  canPublishPage,
  publicPageState,
  type PageEntitlementRow,
} from "@taptap/core/entitlement";
import { activeIdentityCount, type IdentityRow } from "@taptap/core/identity";
import { differsFromLive, type ComparableContent } from "@taptap/core/page-diff";
import { entitlementsFor } from "@taptap/core/pricing";
import type { Block, BlockType, PageConfig, PublicPage, Theme } from "@taptap/core/profile";
import { env } from "@/config/env";

/**
 * A profile as the editor changes it: everything the draft save sends
 * (lib/draft.ts) and nothing the app may not edit (slug, type, SEO).
 */
export type EditorDraft = {
  title: string;
  redirectUrl: string;
  config: PageConfig;
  theme: Theme;
  blocks: AppBlock[];
};

export function draftFromProfile(profile: Profile): EditorDraft {
  return {
    title: profile.title ?? "",
    redirectUrl: profile.redirectUrl ?? "",
    config: profile.config,
    theme: profile.theme,
    blocks: profile.blocks,
  };
}

/** The body of PUT /api/app/v1/pages/{id}/draft. */
export function draftInput(draft: EditorDraft, expectedUpdatedAt: string): DraftInput {
  return {
    expectedUpdatedAt,
    title: draft.title,
    redirectUrl: draft.redirectUrl,
    config: draft.config,
    theme: draft.theme,
    // Unknown types (added on the web after this build) go back untouched; the
    // server, which does know them, checks them.
    blocks: draft.blocks.map((b): DraftBlock => ({ ...b, type: b.type as BlockType })),
  };
}

/**
 * The cached profile after a save the server accepted. Text is kept exactly as
 * typed, although the server trims it: the editor reads this copy, and trimming
 * here would delete the space someone paused after — "Mama " becoming "Mama"
 * under their thumb, then "MamaNjeri". Whitespace never counts as a change
 * (lib/page-diff.ts), and the next fetch brings the trimmed text quietly.
 */
export function withSavedDraft(profile: Profile, draft: EditorDraft, updatedAt: string): Profile {
  return {
    ...profile,
    title: draft.title.trim() ? draft.title : null,
    redirectUrl: profile.mode === "redirect" ? draft.redirectUrl : profile.redirectUrl,
    config: draft.config,
    theme: draft.theme,
    blocks: draft.blocks,
    updatedAt,
  };
}

function comparableDraft(profile: Profile, draft: EditorDraft): ComparableContent {
  return {
    title: draft.title,
    mode: profile.mode,
    redirect_url: draft.redirectUrl,
    config: draft.config,
    theme: draft.theme,
    links: draft.blocks.map((b) => ({
      type: b.type,
      label: b.label,
      value: b.value,
      is_active: b.isActive,
    })),
  };
}

/** What a page looks like to lib/profile's renderer and the web's snapshot. */
export function previewPage(profile: Profile, draft: EditorDraft): PublicPage {
  return {
    id: profile.id,
    title: draft.title,
    mode: profile.mode,
    redirect_url: draft.redirectUrl,
    config: draft.config,
    theme: draft.theme,
    links: draft.blocks.map(
      (b, i): Block => ({
        id: b.id,
        type: b.type as BlockType,
        label: b.label,
        value: b.value,
        sort_order: i,
        is_active: b.isActive,
      }),
    ),
  };
}

const asText = (v: unknown) => (typeof v === "string" ? v : null);
const asObject = (v: unknown) =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * The published snapshot as a page, or null when the profile has never been
 * published. Read defensively: it was written by whatever web version
 * published it.
 */
export function livePage(profile: Profile): PublicPage | null {
  const s = profile.publishedContent;
  if (!s) return null;
  const links = Array.isArray(s.links) ? s.links : [];
  return {
    id: profile.id,
    title: asText(s.title),
    mode: s.mode === "redirect" ? "redirect" : "page",
    redirect_url: asText(s.redirect_url),
    config: asObject(s.config) as PageConfig,
    theme: asObject(s.theme) as Theme,
    links: links.map((raw, i): Block => {
      const l = asObject(raw);
      return {
        id: asText(l.id) ?? undefined,
        type: (asText(l.type) ?? "custom") as BlockType,
        label: asText(l.label) ?? "",
        value: asText(l.value) ?? "",
        sort_order: typeof l.sort_order === "number" ? l.sort_order : i,
      };
    }),
  };
}

function entitlementRow(profile: Profile): PageEntitlementRow {
  return {
    id: profile.id,
    status: profile.status,
    entitlement_grandfathered: profile.grandfathered,
    published_at: profile.publishedAt,
    created_at: profile.createdAt,
  };
}

/**
 * What an owner needs to know about a profile, in one word:
 *
 *   live         customers see exactly the draft
 *   unpublished  live, but the draft has changes customers do not see yet
 *   draft        never published, or unpublished; the link shows nothing
 *   inactive     published, but no live card covers it (D-018) — customers see
 *                the "not active right now" screen
 *   off          switched off on the website
 */
export type ProfileStatus = "live" | "unpublished" | "draft" | "inactive" | "off";

export function profileStatus(
  profile: Profile,
  all: Profile[],
  identities: IdentityRow[],
  draft: EditorDraft = draftFromProfile(profile),
  now: Date = new Date(),
): ProfileStatus {
  if (!profile.isActive) return "off";
  const state = publicPageState(entitlementRow(profile), all.map(entitlementRow), identities, now);
  if (state === "draft") return "draft";
  if (state === "inactive") return "inactive";
  const snapshot = profile.publishedContent as ComparableContent | null;
  return differsFromLive(snapshot, comparableDraft(profile, draft)) ? "unpublished" : "live";
}

/** Whether Publish can work; the database checks again regardless (D-021). */
export function canPublish(
  profile: Profile,
  all: Profile[],
  identities: IdentityRow[],
  now: Date = new Date(),
): boolean {
  return canPublishPage(entitlementRow(profile), all.map(entitlementRow), identities, now);
}

/** Lead capture follows the account's live cards (D-018); the server enforces it. */
export function leadCaptureAllowed(identities: IdentityRow[], now: Date = new Date()): boolean {
  return entitlementsFor(activeIdentityCount(identities, now)).leadCapture;
}

/** The address customers open. */
export function profileUrl(slug: string): string {
  return `${env.siteUrl}/${encodeURIComponent(slug)}`;
}

/** What the QR code encodes — the same as the web's QR endpoint, so scans count as scans. */
export function qrTarget(slug: string): string {
  return `${profileUrl(slug)}?src=qr`;
}

/** The profile Home shows: the remembered one, else the first live, else the first. */
export function pickProfile(pages: Profile[], rememberedId: string | null): Profile | null {
  return (
    pages.find((p) => p.id === rememberedId) ??
    pages.find((p) => p.status === "published" && p.isActive) ??
    pages[0] ??
    null
  );
}
