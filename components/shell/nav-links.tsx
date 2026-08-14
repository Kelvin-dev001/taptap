"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

/**
 * Shared by the desktop sidebar and the mobile drawer so the two can never
 * drift. `aria-current="page"` carries the active state for screen readers —
 * the orange tint alone would be colour-only signalling (WCAG 1.4.1).
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-body-sm transition-colors duration-fast ease-standard",
                active
                  ? "bg-primary-soft font-medium text-primary-strong"
                  : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted")}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
