/**
 * Notification preferences — what is stored in `accounts.notify` (migration 0014)
 * and how it is read and updated.
 *
 * Pure on purpose, and separated from `notify-lead.ts` so the rules about who
 * gets notified are testable without a database, and so the Settings action can
 * reuse them without importing a module that talks to Supabase.
 */

export type NotifyPrefs = {
  lead?: { enabled?: boolean; to?: string | null };
  /**
   * Renewal reminders have no preferences by design (D-018): a notice saying a
   * device you paid for is about to stop working is transactional, not
   * something to opt out of. The key is reserved so a future billing-address
   * override has an obvious home — and so `mergeNotifyPrefs` has something
   * concrete to protect.
   */
  renewal?: { to?: string | null };
};

/**
 * Notifications are opt-OUT.
 *
 * A business that has never opened Settings is exactly the one that most needs
 * telling a lead arrived, so an absent preference means on. Only an explicit
 * `enabled: false` turns it off.
 */
export function leadEmailEnabled(notify: NotifyPrefs | null | undefined): boolean {
  return notify?.lead?.enabled !== false;
}

/**
 * Who gets it: the address they chose, else the owner's verified sign-up
 * address. A custom address is the account's own decision about where their
 * customers' details are routed — they are the data controller.
 */
export function leadEmailRecipient(target: {
  notify: NotifyPrefs | null | undefined;
  ownerEmail?: string | null;
}): string | null {
  const custom = target.notify?.lead?.to?.trim();
  return custom || target.ownerEmail?.trim() || null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge a change into the stored preferences, preserving every key the caller
 * did not mention.
 *
 * Migration 0014 gave `notify` its own column precisely because
 * `saveBusinessProfileAction` replaces `accounts.profile` wholesale, and
 * preferences kept inside it would be wiped by an unrelated save. Then the
 * Settings action did the same thing one level down — `update({ notify })` with
 * a freshly built object — so `notify` reproduced the exact hazard the column
 * was created to escape.
 *
 * It has never lost data because `lead` is currently the only key and the form
 * owns all of it. That is a fact about today's schema, not a property of the
 * code: the first sibling key added anywhere would vanish on the next Settings
 * save, silently, with notifications simply ceasing. This makes the safety
 * structural instead of coincidental.
 *
 * The patch replaces whole top-level sections rather than deep-merging them,
 * which is what a form that owns an entire section wants: unchecking a box has
 * to be able to remove a value, and a deep merge would make absence
 * unexpressible.
 */
export function mergeNotifyPrefs(existing: unknown, patch: NotifyPrefs): NotifyPrefs {
  const base = isPlainObject(existing) ? existing : {};
  return { ...base, ...patch } as NotifyPrefs;
}
