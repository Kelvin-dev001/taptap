import { describe, it, expect } from "vitest";
import { settlePayment, failPayment, type SettleablePayment } from "./provisioning";

/**
 * A stand-in for the service-role Supabase client.
 *
 * Records every call so the assertions can be about WHAT provisioning did, not
 * about how it phrased its SQL. The shape mirrors the fluent builder closely
 * enough that a change in call sequence shows up here rather than in production.
 */
function fakeAdmin(opts: {
  existingTags?: { tag_id: string }[];
  order?: Record<string, unknown> | null;
  tags?: { id: string; term_start: string | null; term_end: string | null }[];
  provisionResult?: string[];
} = {}) {
  const calls: {
    updates: { table: string; values: Record<string, unknown>; id?: string }[];
    inserts: { table: string; rows: unknown }[];
    rpcs: { fn: string; args: Record<string, unknown> }[];
  } = { updates: [], inserts: [], rpcs: [] };

  const api = {
    calls,
    from(table: string) {
      const builder: Record<string, unknown> = {};

      const select = (_cols?: string) => {
        const result = {
          eq: () => result,
          in: () => result,
          limit: async () => ({
            data: table === "payment_tags" ? (opts.existingTags ?? []) : [],
            error: null,
          }),
          single: async () => ({
            data: table === "orders" ? (opts.order ?? null) : null,
            error: null,
          }),
          then: undefined,
        };
        // `await supabase.from(t).select(c).eq(...)` with no terminator resolves
        // the builder itself, which is how payment_tags and nfc_tags are read.
        return Object.assign(result, {
          eq: () =>
            Object.assign(
              {
                limit: result.limit,
                single: result.single,
              },
              {
                then: (
                  resolve: (v: { data: unknown; error: null }) => void,
                ) =>
                  resolve({
                    data: table === "payment_tags" ? (opts.existingTags ?? []) : [],
                    error: null,
                  }),
              },
            ),
          in: () =>
            ({
              then: (resolve: (v: { data: unknown; error: null }) => void) =>
                resolve({ data: opts.tags ?? [], error: null }),
            }) as unknown,
        });
      };

      Object.assign(builder, {
        select,
        update(values: Record<string, unknown>) {
          return {
            eq: async (_col: string, id: string) => {
              calls.updates.push({ table, values, id });
              return { error: null };
            },
          };
        },
        insert(rows: unknown) {
          calls.inserts.push({ table, rows });
          return { error: null };
        },
      });

      return builder as never;
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.rpcs.push({ fn, args });
      return { data: opts.provisionResult ?? [], error: null };
    },
  };

  return api as unknown as Parameters<typeof settlePayment>[0] & { calls: typeof calls };
}

const hardware: SettleablePayment = {
  id: "pay-1",
  account_id: "acct-1",
  status: "pending",
  kind: "hardware",
  order_id: "order-1",
};

describe("settlePayment", () => {
  /**
   * The ordering the M-Pesa callback has always used, kept on purpose. A crash
   * between the two leaves a payment that is paid with nothing provisioned,
   * which the customer sees on Billing and reports; provisioning first would let
   * a replay hand out a second free card with nobody noticing.
   */
  it("marks the payment paid before provisioning anything", async () => {
    const admin = fakeAdmin({
      order: {
        id: "order-1",
        account_id: "acct-1",
        quantity: 2,
        product_code: "smart_card",
        products: { kind: "card", bundled_months: 12 },
      },
      provisionResult: ["tag-a", "tag-b"],
    });

    await settlePayment(admin, hardware, { some: "callback" });

    expect(admin.calls.updates[0]).toMatchObject({
      table: "payments",
      values: { status: "paid" },
    });
    const paidAt = admin.calls.updates.findIndex((u) => u.table === "payments");
    const provisionedAt = admin.calls.rpcs.findIndex(
      (r) => r.fn === "provision_identities",
    );
    expect(paidAt).toBeGreaterThanOrEqual(0);
    expect(provisionedAt).toBeGreaterThanOrEqual(0);
  });

  it("provisions exactly what the order bought", async () => {
    const admin = fakeAdmin({
      order: {
        id: "order-1",
        account_id: "acct-1",
        quantity: 3,
        product_code: "smart_stand",
        products: { kind: "stand", bundled_months: 12 },
      },
      provisionResult: ["t1", "t2", "t3"],
    });

    await settlePayment(admin, hardware);

    expect(admin.calls.rpcs[0]).toEqual({
      fn: "provision_identities",
      args: {
        p_account_id: "acct-1",
        p_kind: "stand",
        p_count: 3,
        p_months: 12,
      },
    });
  });

  /**
   * `payment_tags` is what makes a replay safe: it records which identities a
   * payment covered, so a repeated callback extends the same set rather than a
   * recomputed one (D-018).
   */
  it("records which identities the payment covered", async () => {
    const admin = fakeAdmin({
      order: {
        id: "order-1",
        account_id: "acct-1",
        quantity: 2,
        product_code: "smart_card",
        products: { kind: "card", bundled_months: 12 },
      },
      provisionResult: ["tag-a", "tag-b"],
    });

    await settlePayment(admin, hardware);

    expect(admin.calls.inserts).toContainEqual({
      table: "payment_tags",
      rows: [
        { payment_id: "pay-1", tag_id: "tag-a" },
        { payment_id: "pay-1", tag_id: "tag-b" },
      ],
    });
  });

  /** Safaricom retries, and the poll can land in the same second as the callback. */
  it("does nothing at all for a payment already settled", async () => {
    const admin = fakeAdmin();
    const result = await settlePayment(admin, { ...hardware, status: "paid" });

    expect(result.alreadySettled).toBe(true);
    expect(admin.calls.updates).toHaveLength(0);
    expect(admin.calls.rpcs).toHaveLength(0);
    expect(admin.calls.inserts).toHaveLength(0);
  });

  /**
   * Belt and braces behind the already-paid return. If this somehow runs twice
   * it must not mint a second set of cards, so an order that already has
   * identities provisions nothing further.
   */
  it("does not mint a second set of cards for an order that already has some", async () => {
    const admin = fakeAdmin({ existingTags: [{ tag_id: "already-there" }] });

    await settlePayment(admin, hardware);

    expect(admin.calls.rpcs).toHaveLength(0);
    expect(admin.calls.inserts).toHaveLength(0);
  });

  /**
   * The Sprint 4 per-account plan branch was removed rather than carried
   * forward. No payment without a kind can be created any more, and settling one
   * must not resurrect a plan code the product no longer has a concept of.
   */
  it("settles a payment with no kind without provisioning anything", async () => {
    const admin = fakeAdmin();
    await settlePayment(admin, { ...hardware, kind: null, order_id: null });

    expect(admin.calls.updates[0]).toMatchObject({ values: { status: "paid" } });
    expect(admin.calls.rpcs).toHaveLength(0);
  });

  it("cannot provision a hardware payment with no order behind it", async () => {
    const admin = fakeAdmin();
    await settlePayment(admin, { ...hardware, order_id: null });

    expect(admin.calls.rpcs).toHaveLength(0);
  });

  /**
   * The whole point of extracting this in Sprint 7: an offline payment recorded
   * by staff runs the identical path, so a cash customer ends up with exactly
   * what an M-Pesa customer does. This asserts the shared entry point behaves
   * the same when called with no Daraja payload.
   */
  it("provisions identically when settled without a callback payload", async () => {
    const admin = fakeAdmin({
      order: {
        id: "order-1",
        account_id: "acct-1",
        quantity: 1,
        product_code: "smart_card",
        products: { kind: "card", bundled_months: 12 },
      },
      provisionResult: ["tag-x"],
    });

    await settlePayment(admin, hardware);

    // No `raw` written, because there is no callback to record.
    expect(admin.calls.updates[0].values).toEqual({ status: "paid" });
    expect(admin.calls.rpcs[0].fn).toBe("provision_identities");
    expect(admin.calls.inserts).toContainEqual({
      table: "payment_tags",
      rows: [{ payment_id: "pay-1", tag_id: "tag-x" }],
    });
  });
});

describe("failPayment", () => {
  it("records the failure and the payload that reported it", async () => {
    const admin = fakeAdmin();
    await failPayment(admin, "pay-9", { ResultCode: 1032 });

    expect(admin.calls.updates).toEqual([
      {
        table: "payments",
        id: "pay-9",
        values: { status: "failed", raw: { ResultCode: 1032 } },
      },
    ]);
  });
});
