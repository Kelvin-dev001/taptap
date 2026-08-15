"use client";

import type { PublicPage, Block } from "@/lib/profile";
import { buildVCard } from "@/lib/vcard";
import { ProfileView } from "./profile/profile-view";

/** Maps the ?src= marker to a stored event source. */
function sourceOf(src?: string): "nfc" | "qr" | "direct" {
  return src === "nfc" ? "nfc" : src === "qr" ? "qr" : "direct";
}

function track(pageId: string, type: string, linkId?: string, source?: string) {
  try {
    const body = JSON.stringify({ pageId, type, linkId, source });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/track", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    // analytics must never break the page
  }
}

/**
 * Public tap target. All rendering lives in ProfileView, which the builder's
 * preview also uses; this wrapper only adds the behaviour that belongs on a
 * real page — analytics and the vCard download.
 */
export default function PublicProfile({
  page,
  src,
}: {
  page: PublicPage;
  src?: string;
}) {
  function downloadContact() {
    const contact = page.config?.contact ?? {};
    const vcard = buildVCard(contact, page.title ?? undefined);
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(page.title ?? "contact")
      .replace(/\s+/g, "-")
      .toLowerCase()}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    track(page.id, "download", undefined, sourceOf(src));
  }

  function onBlockClick(block: Block) {
    // Fires alongside the anchor's own navigation — sendBeacon is built to
    // survive the page unloading, so the click is not lost.
    track(page.id, "click", block.id, sourceOf(src));
  }

  return (
    <main className="flex min-h-screen flex-col">
      <ProfileView
        page={page}
        mode="live"
        onBlockClick={onBlockClick}
        onContactSave={downloadContact}
        trackView={() =>
          track(page.id, src === "qr" ? "scan" : "view", undefined, sourceOf(src))
        }
      />
    </main>
  );
}
