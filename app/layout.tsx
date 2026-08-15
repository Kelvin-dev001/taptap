import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker";

// Self-hosted by next/font: no external request, no FOUT, no layout shift (D-014).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // A per-page title falls back to this; a smart page overrides it entirely so
  // a shared link previews as the business, not as us.
  title: { default: "Hornbill TapTap", template: "%s · Hornbill TapTap" },
  description: "Smart Digital Identity & Customer Engagement Platform",
  applicationName: "Hornbill TapTap",
  appleWebApp: { capable: true, title: "TapTap", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f97316",
  // Lets the layout paint under the notch and home indicator; the shell then
  // uses env(safe-area-inset-*) to keep controls clear of them.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-body text-foreground">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
