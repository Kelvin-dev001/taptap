"use client";

import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui";
import { NavLinks } from "./nav-links";
import { Wordmark } from "./logo";
import { BottomTabs } from "./bottom-tabs";

/**
 * Mobile navigation as a whole: a persistent tab bar plus a "More" sheet
 * holding the destinations a phone user reaches for rarely.
 *
 * UI-2 shipped drawer-only navigation and deferred the tab bar for want of
 * usage data. §23 already names the mobile priorities, so UI-11 stops waiting.
 * The drawer is kept — demoted from the primary mechanism to the overflow.
 */
export function MobileNavigation({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <BottomTabs onOpenMore={() => setOpen(true)} />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="bottom" title="Menu" description="Everything in your workspace">
          <nav aria-label="All sections">
            {/* Closing is driven by the links themselves rather than by watching
                the pathname, which would render the new page with the sheet
                still open. */}
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-4 border-t border-border pt-4">
            <Wordmark subtitle="Business suite" />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
