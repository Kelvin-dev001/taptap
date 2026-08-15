import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * Uses Next's file-based metadata route rather than a static `public/`
 * directory, so the icons below are the same generated routes the browser tab
 * uses — one definition, no chance of the installed icon drifting from the
 * favicon.
 *
 * `display: standalone` matters more here than on most products: an owner who
 * installs TapTap on their phone gets a launcher icon beside WhatsApp and
 * M-Pesa, which is the company those apps keep in a Kenyan SME's daily use.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hornbill TapTap",
    short_name: "TapTap",
    description:
      "Smart Digital Identity & Customer Engagement Platform — manage your Tap Profiles, NFC cards and customers.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfa",
    theme_color: "#f97316",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        // Android crops icons to its own shape; a maskable variant with padding
        // stops the hornbill losing its beak to a circle mask.
        purpose: "maskable",
      },
    ],
  };
}
