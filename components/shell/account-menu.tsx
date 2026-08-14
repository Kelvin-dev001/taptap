"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, CreditCard } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountMenu({
  businessName,
  email,
  signOutAction,
}: {
  businessName: string;
  email: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg p-1 transition-colors duration-fast hover:bg-surface-sunken"
          aria-label={`Account menu for ${businessName}`}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-caption font-semibold text-primary-strong"
          >
            {initials(businessName)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        </button>
      </DropdownTrigger>

      <DropdownContent>
        <DropdownLabel>
          <span className="block truncate font-medium text-foreground">{businessName}</span>
          <span className="block truncate">{email}</span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/dashboard/billing">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Billing
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        {/* A server action in a form, so sign-out is a real POST rather than a
            client-side fetch that could leave a stale session cookie. */}
        <form action={signOutAction}>
          <DropdownItem asChild destructive>
            <button type="submit" className="w-full">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </DropdownItem>
        </form>
      </DropdownContent>
    </Dropdown>
  );
}
