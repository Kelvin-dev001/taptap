"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BrandLockup } from "./brand-mark";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/**
 * Sticky marketing nav.
 *
 * Condenses on scroll — transparent over the hero, then a solid surface with a
 * border once content is passing underneath, so anchor text never sits on top
 * of a section heading and becomes unreadable.
 *
 * The scroll listener is passive and only ever flips one boolean, so it cannot
 * become a per-frame render. Class transitions carry the change, which means
 * reduced-motion users get the same states instantly rather than a nav that
 * fades — the global rule in globals.css already shortens the duration.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A menu that stays open behind a navigation is a trap on mobile.
  const close = () => setOpen(false);

  // Escape closes it, and while it is open the page behind must not scroll —
  // otherwise a thumb swipe moves the content underneath rather than the menu.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-base",
        scrolled || open
          ? "border-b border-border bg-surface/90 shadow-xs backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Hornbill TapTap, home">
          <BrandLockup />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-body-sm text-foreground-secondary transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Log in
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "transition-transform duration-fast hover:-translate-y-px active:scale-[0.97]",
            )}
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="marketing-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div
          id="marketing-menu"
          className="max-h-[calc(100svh-4rem)] overflow-y-auto border-t border-border bg-surface px-5 py-4 lg:hidden"
        >
          <nav aria-label="Main" className="flex flex-col">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                className="rounded-md px-1 py-3 text-body text-foreground-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
            <Link
              href="/login"
              onClick={close}
              className={cn(buttonVariants({ size: "md", full: true }))}
            >
              Get started
            </Link>
            <Link
              href="/login"
              onClick={close}
              className={cn(buttonVariants({ variant: "secondary", size: "md", full: true }))}
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
