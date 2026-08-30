import type { createServerSupabase } from "./supabase/server";
import { isMissingSchemaError } from "./schema-guard";
import {
  entitlementsFor,
  segmentFor,
  type Entitlements,
  type Segment,
  type SegmentDefinition,
} from "./pricing";
import { billingSummary, type BillingSummary, type IdentityRow } from "./identity";

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

/** Columns every identity-aware screen needs. Kept in one place so the shape
 *  the app reads and the shape `IdentityRow` describes cannot drift apart. */
export const IDENTITY_COLUMNS =
  "id, token, kind, label, status, account_id, smart_page_id, term_start, term_end, claimed_at";

export type BillingContext = {
  businessName: string;
  segment: SegmentDefinition;
  identities: IdentityRow[];
  summary: BillingSummary;
  entitlements: Entitlements;
  /**
   * True when migration 0015 has not been applied yet. Screens can surface a
   * MigrationNotice; entitlement checks fall open rather than stripping
   * capability from customers because a deploy ran ahead of the schema.
   */
  migrationPending: boolean;
};

const EMPTY_SUMMARY: BillingSummary = {
  active: 0,
  billable: 0,
  due: [],
  dueAmountKes: 0,
  renewsOn: null,
  hasLapsed: false,
};

/**
 * Everything the app needs to answer "what does this account own, and what does
 * that entitle it to".
 *
 * Both reads are RLS-scoped (accounts 0001, nfc_tags 0005), so this cannot see
 * another business's devices even though it names an account id.
 *
 * Migrations are applied by hand (see `lib/schema-guard.ts`), so a deploy can
 * legitimately run ahead of the schema. Every read here is guarded, and the
 * fallback is permissive: an account mid-migration keeps every capability it
 * had this morning. Locking a paying customer out of lead capture because a
 * column is missing would be a far worse failure than briefly over-granting.
 */
export async function loadBillingContext(
  supabase: ServerClient,
  accountId: string | null | undefined,
): Promise<BillingContext> {
  if (!accountId) {
    return {
      businessName: "My business",
      segment: segmentFor(null),
      identities: [],
      summary: EMPTY_SUMMARY,
      entitlements: segmentFor(null).entitlements,
      migrationPending: false,
    };
  }

  const [accountRes, identityRes] = await Promise.all([
    supabase.from("accounts").select("name, segment").eq("id", accountId).single(),
    supabase.from("nfc_tags").select(IDENTITY_COLUMNS),
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

    const segment = segmentFor(null);
    return {
      businessName: fallback?.name ?? "My business",
      segment,
      identities: [],
      summary: EMPTY_SUMMARY,
      entitlements: segment.entitlements,
      migrationPending: true,
    };
  }

  const account = accountRes.data as { name?: string; segment?: string } | null;
  const identities = (identityRes.data ?? []) as IdentityRow[];
  const summary = billingSummary(identities);

  return {
    businessName: account?.name ?? "My business",
    segment: segmentFor(account?.segment),
    identities,
    summary,
    entitlements: entitlementsFor(account?.segment as Segment | null, summary.active),
    migrationPending: false,
  };
}
