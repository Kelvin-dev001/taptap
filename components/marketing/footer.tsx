import Link from "next/link";
import { BrandLockup } from "./brand-mark";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Use cases", href: "#use-cases" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact us", href: "mailto:info@hornbilltech.co.ke" },
      { label: "0759 293 030", href: "tel:+254759293030" },
      {
        label: "Talk to Sales",
        href: "mailto:sales@hornbilltech.co.ke?subject=Hornbill%20TapTap%20-%20Talk%20to%20Sales",
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function MarketingFooter() {
  // Rendered on the server, so this is the build/request year rather than a
  // hydration-mismatched client clock.
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface px-6 py-14">
      <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-3">
          <BrandLockup />
          <p className="max-w-xs text-body-sm text-muted">
            Smart digital identity for African businesses.
          </p>
          <p className="max-w-xs text-caption text-muted">
            Call us on{" "}
            <a href="tel:+254759293030" className="text-primary-strong hover:underline">
              0759 293 030
            </a>{" "}
            or email{" "}
            <a
              href="mailto:info@hornbilltech.co.ke"
              className="text-primary-strong hover:underline"
            >
              info@hornbilltech.co.ke
            </a>
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
            <h2 className="text-label uppercase tracking-[0.06em] text-muted">
              {column.heading}
            </h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="rounded text-body-sm text-foreground-secondary transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-caption text-muted">
        <p>A product of Hornbill Technologies Limited. Mombasa, Kenya.</p>
        <p>© {year} Hornbill Technologies Limited. All rights reserved.</p>
      </div>
    </footer>
  );
}
