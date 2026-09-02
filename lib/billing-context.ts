import type { createServerSupabase } from "./supabase/server";
import { isMissingSchemaError } from "./schema-guard";
import { entitlementsFor, type Entitlements } from "./pricing";
import { billingSummary, type BillingSummary, type IdentityRow } from "./identity";
import { publishSlots, usedSlots, type PageEntitlementRow } from "./entitlement";

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

/** Columns every identity-aware screen needs. Kept in one place so the shape
 *  the app reads and the shape `IdentityRow` describes cannot drift apart. */
export const IDENTITY_COLUMNS =
  "id, token, kind, label, status, account_id, smart_page_id, term_start, term_end, claimed_at";

/** The same, for the publish gate. `entitlement_grandfathered` arrives with 0019. */
export const PAGE_ENTITLEMENT_COLUMNS =
  "id, status, entitlement_grandfathered, published_at, created_at";

export type BillingContext = {
  businessName: string;
  identities: IdentityRow[];
  /** Every page on the account, for the publish-slot arithmetic. */
  pages: PageEntitlementRow[];
  summary: BillingSummary;
  entitlements: Entitlements;
  /** Publish slots: one per live identity, minus those already spent. */
  slots: { total: number; used: number; free: number };
  /**
   * True when migration 0015 has not been applied yet. Screens can surface a
   * MigrationNotice; entitlement checks fall open rather than stripping
   * capability from customers because a deploy ran ahead of the schema.
   */
  migrationPending: boolean;
  /**
   * True when 0019 has not been applied yet, so `entitlement_grandfathered`
   * could not be read.
   *
   * This one fails CLOSED, unlike `migrationPending` above, and the asymmetry is
   * deliberate — the same call D-020 made for `requireStaff`. Briefly
   * over-granting a paying customer a feature is a shrug; briefly handing out
   * free published pages is revenue. In practice the blast radius is nil:
   * before 0019 every existing page is already published, and `canPublishPage`
   * exempts anything already live, so only a genuine draft is refused during the
   * window.
   */
  publishGatePending: boolean;
};

const EMPTY_SUMMARY: BillingSummary = {
  active: 0,
  billable: 0,
  due: [],
  dueAmountKes: 0,
  renewsOn: null,
  hasLapsed: false,
};

const EMPTY_SLOTS = { total: 0, used: 0, free: 0 };

/**
 * Everything the app needs to answer "what does this account own, what does that
 * entitle it to, and may it publish another page".
 *
 * All three reads are RLS-scoped (accounts 0001, nfc_tags 0005, smart_pages
 * 0001), so this cannot see another business's devices or pages even though it
 * names an account id.
 *
 * Migrations are applied by hand (see `lib/schema-guard.ts`), so a deploy can
 * legitimately run ahead of the schema. Every read here is guarded. The
 * capability fallback is permissive — an account mid-migration keeps every
 * capability it had this morning — and the publish fallback is not; see
 * `publishGatePending`.
 */
export async function loadBillingContext(
  supabase: ServerClient,
  accountId: string | null | undefined,
): Promise<BillingContext> {
  if (!accountId) {
    return {
      businessName: "My business",
      identities: [],
      pages: [],
      summary: EMPTY_SUMMARY,
      entitlements: entitlementsFor(0),
      slots: EMPTY_SLOTS,
      migrationPending: false,
      publishGatePending: false,
    };
  }

  const [accountRes, identityRes, pageRes] = await Promise.all([
    supabase.from("accounts").select("name").eq("id", accountId).single(),
    supabase.from("nfc_tags").select(IDENTITY_COLUMNS),
    supabase.from("smart_pages").select(PAGE_ENTITLEMENT_COLUMNS),
  ]);

  const pending =
    isMissingSchemaError(accountRes.error) || isMissingSchemaError(identityRes.error);

  if (pending) {
    // Re-read only what is certain to exist, so the shell still shows a name.
    const { data: fallback } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .single();

    return {
      businessName: fallback?.name ?? "My business",
      identities: [],
      pages: [],
      summary: EMPTY_SUMMARY,
      entitlements: entitlementsFor(0),
      slots: EMPTY_SLOTS,
      migrationPending: true,
      publishGatePending: true,
    };
  }

  const account = accountRes.data as { name?: string } | null;
  const identities = (identityRes.data ?? []) as IdentityRow[];

  // 0019 adds `entitlement_grandfathered`. Before it lands the select fails, and
  // re-reading without it leaves every page ungrandfathered — which is the
  // fail-closed half described on `publishGatePending`.
  let pages: PageEntitlementRow[] = [];
  let publishGatePending = false;
  if (isMissingSchemaError(pageRes.error)) {
    publishGatePending = true;
    const { data: legacy } = await supabase
      .from("smart_pages")
      .select("id, status, created_at");
    pages = (legacy ?? []) as PageEntitlementRow[];
  } else {
    pages = (pageRes.data ?? []) as PageEntitlementRow[];
  }

  const summary = billingSummary(identities);
  const total = publishSlots(identities);
  const used = usedSlots(pages);

  return {
    businessName: account?.name ?? "My business",
    identities,
    pages,
    summary,
    entitlements: entitlementsFor(summary.active),
    slots: { total, used, free: Math.max(0, total - used) },
    migrationPending: false,
    publishGatePending,
  };
}
