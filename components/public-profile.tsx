"use client";

import { useEffect } from "react";
import type { PublicPage, Block } from "@/lib/profile";
import { resolveTheme } from "@/lib/profile";
import { buildHref, defaultLabel } from "@/lib/blocks";
import { buildVCard } from "@/lib/vcard";

function track(pageId: string, type: string, linkId?: string) {
  try {
    const body = JSON.stringify({ pageId, type, linkId });
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

export default function PublicProfile({
  page,
  src,
}: {
  page: PublicPage;
  src?: string;
}) {
  const theme = resolveTheme(page.theme);
  const config = page.config ?? {};
  const blocks = [...(page.links ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  useEffect(() => {
    track(page.id, src === "qr" ? "scan" : "view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadContact() {
    const contact = config.contact ?? {};
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
    track(page.id, "download");
  }

  function handleBlock(block: Block) {
    if (block.type === "contact") {
      downloadContact();
      return;
    }
    const href = buildHref(block.type, block.value);
    if (!href) return;
    track(page.id, "click", block.id);
    window.location.href = href;
  }

  return (
    <main
      style={{ backgroundColor: theme.bg, color: theme.text }}
      className="min-h-screen"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-12">
        {config.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.avatarUrl}
            alt={page.title ?? ""}
            className="h-24 w-24 rounded-full object-cover"
          />
        )}
        {page.title && <h1 className="text-2xl font-bold">{page.title}</h1>}
        {config.bio && <p className="text-center opacity-80">{config.bio}</p>}

        <div className="mt-2 flex w-full flex-col gap-3">
          {blocks.map((b, i) => (
            <button
              key={b.id ?? i}
              onClick={() => handleBlock(b)}
              style={{ backgroundColor: theme.accent }}
              className="w-full rounded-xl px-5 py-3 font-medium text-white transition active:scale-[0.99]"
            >
              {b.label || defaultLabel(b.type)}
            </button>
          ))}
          {blocks.length === 0 && (
            <p className="text-center opacity-60">No actions yet.</p>
          )}
        </div>

        <footer className="mt-8 text-xs opacity-50">
          Powered by Hornbill TapTap
        </footer>
      </div>
    </main>
  );
}
