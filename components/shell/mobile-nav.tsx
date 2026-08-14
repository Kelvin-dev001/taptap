"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Drawer, DrawerTrigger, DrawerContent, IconButton } from "@/components/ui";
import { NavLinks } from "./nav-links";
import { Wordmark } from "./logo";

/**
 * Navigation for narrow viewports. A drawer rather than a bottom tab bar for
 * now: the product has seven destinations and a tab bar only fits about five,
 * so tabs would hide sections behind a "More" that is no cheaper than this.
 * The reference's bottom bar can return in UI-11 alongside PWA work, once
 * mobile usage shows which five destinations actually matter.
 */
export function MobileNav({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  // Closing is driven by the links themselves (onNavigate below) rather than by
  // watching the pathname in an effect, which would render the new page with the
  // drawer still open before closing it.
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <IconButton label="Open navigation" variant="secondary" className="lg:hidden">
          <Menu className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </DrawerTrigger>
      <DrawerContent side="bottom" title="Navigation" description="Jump to a section">
        <nav aria-label="Main">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-4 border-t border-border pt-4">
          <Wordmark subtitle="Business suite" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
