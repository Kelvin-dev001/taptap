import Link from "next/link";
import { Card, buttonVariants } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

/**
 * The body of /app (PLAN.md §9 W12): a button per store the app is in, and on a
 * computer a QR code that opens this same page on a phone. Plain buttons rather
 * than the stores' badge artwork, which comes with its own usage rules.
 */
export function AppDownload({
  playUrl,
  appStoreUrl,
  qrDataUrl,
}: {
  playUrl: string | null;
  appStoreUrl: string | null;
  qrDataUrl: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />
      <div>
        <h1 className="mb-1 text-page-title text-foreground">Get the TapTap app</h1>
        <p className="text-body-sm text-muted">
          Your leads, cards and profiles in your pocket — and a notification the moment a customer
          gets in touch.
        </p>
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        {playUrl && (
          <a href={playUrl} className={buttonVariants({ variant: "primary", full: true })}>
            Download for Android
          </a>
        )}
        {appStoreUrl && (
          <a
            href={appStoreUrl}
            className={buttonVariants({ variant: playUrl ? "secondary" : "primary", full: true })}
          >
            Download for iPhone
          </a>
        )}
        <p className="text-caption text-muted">
          Free for TapTap customers. Sign in with the email you use on the website.
        </p>
      </Card>

      <div className="hidden items-center gap-4 md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise */}
        <img src={qrDataUrl} alt="QR code that opens this page on your phone" width={120} height={120} />
        <p className="text-body-sm text-muted">
          On a computer? Scan this with your phone&apos;s camera to open this page there.
        </p>
      </div>

      <p className="text-caption text-muted">
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </p>
    </main>
  );
}
