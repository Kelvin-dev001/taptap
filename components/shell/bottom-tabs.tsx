"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, IdCard, ChartNoAxesColumn, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Mobile navigation.
 *
 * Replaces the drawer-only navigation from UI-2. A drawer costs an extra tap on
 * every single navigation; a tab bar sits in the thumb zone and is always
 * visible. The reference mockup shows one, and CLAUDE.md §23 names the mobile
 * priorities — quick edits, Tap Profiles, analytics, NFC, QR, sharing — so
 * there was no need to wait for usage data to choose the four.
 *
 * Four destinations plus More. Devices, Customers, Billing and Settings live in
 * the drawer behind More, which is where a phone user goes rarely.
 *
 * The centre control is a real action, not decoration: creating a link is the
 * one thing an owner does standing in their shop.
 */
const TABS = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  {
    label: "Profiles",
    href: "/dashboard/profiles",
    icon: IdCard,
    match: (p: string) => p.startsWith("/dashboard/profiles"),
  },
  {
    label: "Insights",
    href: "/dashboard/analytics",
    icon: ChartNoAxesColumn,
    match: (p: string) => p.startsWith("/dashboard/analytics"),
  },
] as const;

export function BottomTabs({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm lg:hidden",
        // Keeps the bar clear of the iPhone home indicator.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
        ))}

        <li className="flex items-center">
          {/* Raised primary action, matching the reference. */}
          <Link
            href="/dashboard/profiles"
            aria-label="Create a new link"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#111111] shadow-lg transition-transform duration-fast active:scale-95"
            data-motion-press
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
        </li>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
        ))}

        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-caption text-muted transition-colors duration-fast hover:text-foreground"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function TabLink({
  tab,
  active,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-0.5 px-1 py-2 text-caption transition-colors duration-fast",
          active ? "font-medium text-primary-strong" : "text-muted hover:text-foreground",
        )}
      >
        <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
        {tab.label}
      </Link>
    </li>
  );
}
