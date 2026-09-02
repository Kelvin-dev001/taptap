"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Orders", href: "/admin/orders", exact: false },
  { label: "Board", href: "/admin/board", exact: false },
  { label: "Quotes", href: "/admin/quotes", exact: false },
  { label: "Mint cards", href: "/admin/mint", exact: false },
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Operations">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-body-sm transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-primary-strong font-medium text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
