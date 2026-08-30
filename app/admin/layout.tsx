import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { Wordmark } from "@/components/shell/logo";
import { Badge } from "@/components/ui";
import { StaffNav } from "./staff-nav";

export const dynamic = "force-dynamic";

/**
 * The staff area.
 *
 * Deliberately NOT the customer AppShell. That shell renders workspace identity —
 * business name, plan card, the account's own profiles — none of which means
 * anything here, and showing a staff member a customer-shaped chrome is how
 * someone ends up unsure whose data they are looking at.
 *
 * Every route beneath this is gated by `requireStaff`, in the layout rather than
 * per-page, so a new page cannot be added unprotected by omission.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-lg">
              <Wordmark subtitle="Operations" />
            </Link>
            <Badge variant="outline">{staff.role === "admin" ? "Admin" : "Ops"}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-caption text-muted sm:inline">{staff.email}</span>
            <Link
              href="/dashboard"
              className="text-caption text-primary-strong hover:underline"
            >
              Leave ops
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <StaffNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
