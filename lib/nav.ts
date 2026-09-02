import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  IdCard,
  Nfc,
  ChartNoAxesColumn,
  Users,
  Package,
  CreditCard,
  Settings,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Marks the section active for any nested route under it. */
  match: (pathname: string) => boolean;
};

/**
 * Primary navigation — the single source of truth for the sidebar, the mobile
 * drawer and the command palette.
 *
 * Deliberately absent (CLAUDE.md §13 — do not add nav for features that do not
 * exist):
 *   Team           — deferred by D-017, not blocked by schema. `profiles.account_id`
 *                    has no unique constraint and every RLS policy is a set-membership
 *                    test, so an account already supports multiple members; what is
 *                    missing is roles, invites and UI. A business is one account with
 *                    many members — never a sub-account hierarchy.
 *   Notifications  — not built; a bell that does nothing is worse than none
 *   QR Codes       — not a destination; QR lives on a profile and on a device
 *   Smart Business Cards — a template facet of Tap Profiles, not a second
 *                    product (§17). Promote only if UI-5 proves it needs its
 *                    own workflow.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  {
    label: "Tap Profiles",
    href: "/dashboard/profiles",
    icon: IdCard,
    match: (p) => p.startsWith("/dashboard/profiles"),
  },
  {
    label: "NFC Devices",
    href: "/dashboard/devices",
    icon: Nfc,
    match: (p) => p.startsWith("/dashboard/devices"),
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: ChartNoAxesColumn,
    match: (p) => p.startsWith("/dashboard/analytics"),
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    match: (p) => p.startsWith("/dashboard/customers"),
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: Package,
    // Checkout belongs to this section: an order is what it produces, and a
    // customer part-way through paying should see where they are.
    match: (p) =>
      p.startsWith("/dashboard/orders") || p.startsWith("/dashboard/checkout"),
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    match: (p) => p.startsWith("/dashboard/billing"),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    match: (p) => p.startsWith("/dashboard/settings"),
  },
];
