import Link from "next/link";
import { Alert } from "@/components/ui";

/**
 * Small inline warning shown where a missing entitlement switches something off.
 *
 * Under the per-identity model (D-018) this means one of two things — the
 * account has never owned a device, or every device it owns has lapsed. Both
 * lead to the same place, so the copy names the fix rather than the cause.
 */
export function EntitlementNotice({ feature }: { feature: string }) {
  return (
    <Alert tone="warning" title={`${feature} needs an active device`}>
      <span className="flex flex-wrap items-center gap-1">
        This is switched off because no card or stand on this account is active.
        <Link href="/dashboard/billing" className="underline">
          Manage billing
        </Link>
      </span>
    </Alert>
  );
}
