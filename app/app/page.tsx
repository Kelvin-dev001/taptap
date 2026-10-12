import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { APP_LINK_HOST } from "@/lib/app-links";
import { APP_STORE_ID, PLAY_STORE_URL, appStoreUrl } from "@/lib/app-store";
import { AppDownload } from "./app-download";

export const metadata = {
  title: "Get the TapTap app",
  description: "Hornbill TapTap for Android and iPhone: your leads, cards and profiles in your pocket.",
};

/**
 * /app (PLAN.md §9 W12). `app` is a reserved slug (lib/reserved-slugs.ts), and
 * on 12 Oct 2026 no profile owned it, so this route shadows nobody's page.
 * A 404 until the app is in a store (lib/app-store.ts).
 */
export default async function AppPage() {
  const ios = appStoreUrl(APP_STORE_ID);
  if (!PLAY_STORE_URL && !ios) notFound();

  const svg = await QRCode.toString(`https://${APP_LINK_HOST}/app`, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
  const qrDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return <AppDownload playUrl={PLAY_STORE_URL} appStoreUrl={ios} qrDataUrl={qrDataUrl} />;
}
