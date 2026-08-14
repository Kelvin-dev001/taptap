import * as React from "react";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui";
import type { Plan } from "@/lib/plans";
import { NavLinks } from "./nav-links";
import { Wordmark, Logo } from "./logo";
import { PlanCard } from "./plan-card";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";
import { CommandPalette, type PaletteProfile } from "./command-palette";

/**
 * The authenticated application frame: persistent sidebar from `lg` up, drawer
 * navigation below it, and a sticky header on both.
 *
 * Accessibility notes:
 * - A skip link is the first focusable element (WCAG 2.4.1).
 * - Sidebar and drawer are distinct <nav> landmarks with distinct labels.
 * - The sticky header is only 3.5rem and the main region carries
 *   `scroll-mt-16`, so a focused element scrolled into view is never hidden
 *   underneath it (WCAG 2.2 — 2.4.11 Focus Not Obscured).
 */
export function AppShell({
  businessName,
  email,
  plan,
  renewsOn,
  profiles,
  signOutAction,
  children,
}: {
  businessName: string;
  email: string;
  plan: Plan;
  renewsOn?: string | null;
  profiles: PaletteProfile[];
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-border bg-surface px-3 py-4 lg:flex">
          <div className="flex flex-col gap-6">
            <Link href="/dashboard" className="rounded-lg px-1.5">
              <Wordmark subtitle="Business suite" />
            </Link>
            <nav aria-label="Main">
              <NavLinks />
            </nav>
          </div>
          <PlanCard plan={plan} renewsOn={renewsOn} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-sm sm:px-6">
            <MobileNav>
              <PlanCard plan={plan} renewsOn={renewsOn} />
            </MobileNav>

            <Link href="/dashboard" className="rounded-lg lg:hidden" aria-label="Hornbill TapTap">
              <Logo />
            </Link>

            <div className="min-w-0 flex-1 lg:max-w-xs">
              <CommandPalette profiles={profiles} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <AccountMenu
                businessName={businessName}
                email={email}
                signOutAction={signOutAction}
              />
            </div>
          </header>

          <main id="main" className="min-w-0 flex-1 scroll-mt-16 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
