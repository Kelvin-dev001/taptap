import Link from "next/link";
import { Nfc, QrCode, ChartNoAxesColumn } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "One smart link for your business",
  description:
    "Hornbill TapTap turns any NFC card or QR code into a permanent link you control. Change where it points without reprinting anything.",
};

/**
 * Public landing page. Migrated to the design system in UI-12 — it had been on
 * pre-design-system styling since Sprint 1 and is the first thing anyone sees.
 *
 * Says what the product does in the terms the charter uses (D-001): the
 * hardware is an interaction method, the software is the product.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <Wordmark subtitle="Business suite" />

      <div className="flex flex-col gap-4">
        <h1 className="text-display text-foreground">
          One smart link for your business
        </h1>
        <p className="text-body text-foreground-secondary">
          Tap or scan to connect. Point any NFC card or QR code at a page you control — a
          Google review, WhatsApp, your menu, or a full digital business card. Change where it
          goes at any time; the card never needs reprinting.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        <Feature icon={Nfc} title="Cards you never re-encode">
          Repoint a card from your dashboard and every future tap follows.
        </Feature>
        <Feature icon={QrCode} title="QR that prints properly">
          Vector codes sized for stickers, stands and menus.
        </Feature>
        <Feature icon={ChartNoAxesColumn} title="Numbers you can act on">
          See which card, which action and which time of day actually works.
        </Feature>
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
          Get started
        </Link>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
        >
          Sign in
        </Link>
      </div>

      <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-caption text-muted">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <span>Nairobi, Kenya</span>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
        <Icon className="h-4 w-4 text-primary-strong" />
      </span>
      <span className="flex flex-col">
        <span className="text-card-title text-foreground">{title}</span>
        <span className="text-body-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
