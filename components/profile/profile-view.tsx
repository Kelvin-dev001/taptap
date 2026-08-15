"use client";

import * as React from "react";
import Link from "next/link";
import type { PublicPage, Block } from "@/lib/profile";
import { resolveTheme, onAccentColor } from "@/lib/profile";
import { roleLine } from "@/lib/templates";
import { buildHref, defaultLabel, isNavigational } from "@/lib/blocks";
import { BlockIcon } from "./block-icon";
import LeadForm from "@/components/lead-form";

/**
 * The one renderer for a smart page.
 *
 * Both the live public page and the builder's preview use it, so what an owner
 * sees while editing is literally the same component the customer gets — the
 * preview cannot drift from reality because there is nothing to drift from.
 *
 * `mode`:
 *   "live"    — real anchors, analytics, working vCard download
 *   "preview" — inert. Nothing navigates, nothing is tracked, no lead is sent.
 */
export type ProfileViewMode = "live" | "preview";

export function ProfileView({
  page,
  mode = "live",
  onBlockClick,
  onContactSave,
  trackView,
}: {
  page: PublicPage;
  mode?: ProfileViewMode;
  onBlockClick?: (block: Block) => void;
  onContactSave?: () => void;
  trackView?: () => void;
}) {
  const theme = resolveTheme(page.theme);
  const config = page.config ?? {};
  const onAccent = onAccentColor(theme.accent);
  const live = mode === "live";
  const role = roleLine(config);

  const blocks = React.useMemo(
    () =>
      [...(page.links ?? [])]
        .filter((b) => b.is_active !== false)
        .sort((a, b) => a.sort_order - b.sort_order),
    [page.links],
  );

  React.useEffect(() => {
    if (live) trackView?.();
    // Fires once per mount, deliberately: a view is a page load, not a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{ backgroundColor: theme.bg, color: theme.text }}
      className="min-h-full w-full"
    >
      {config.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.coverUrl}
          alt=""
          className="h-28 w-full object-cover"
        />
      )}

      <div
        className={`mx-auto flex max-w-md flex-col items-center gap-4 px-6 pb-12 ${
          config.coverUrl ? "-mt-10 pt-0" : "pt-12"
        }`}
      >
        {config.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.avatarUrl}
            alt={page.title ?? ""}
            className="h-20 w-20 rounded-full border-4 object-cover"
            style={{ borderColor: theme.bg }}
          />
        )}

        {page.title && (
          <h1 className="text-center text-xl font-bold leading-tight">{page.title}</h1>
        )}
        {/* On a personal card this is built from the vCard title/company, so
            the line under the name can never disagree with the contact the
            visitor downloads. */}
        {role && <p className="-mt-2 text-center text-sm opacity-70">{role}</p>}
        {config.bio && <p className="text-center text-sm opacity-80">{config.bio}</p>}

        <div className="mt-1 flex w-full flex-col gap-2.5">
          {blocks.map((block, i) => (
            <BlockAction
              key={block.id ?? `${block.type}-${i}`}
              block={block}
              accent={theme.accent}
              onAccent={onAccent}
              // The first action is the primary call to action; the rest are
              // quieter. One filled button per page, as the reference sets out.
              primary={i === 0}
              live={live}
              onActivate={() => {
                if (!live) return;
                if (block.type === "contact") onContactSave?.();
                else onBlockClick?.(block);
              }}
            />
          ))}
          {blocks.length === 0 && (
            <p className="text-center text-sm opacity-60">No actions yet.</p>
          )}
        </div>

        {config.leadForm?.enabled && (
          <div className="mt-3 w-full">
            {live ? (
              <LeadForm pageId={page.id} config={config.leadForm} accent={theme.accent} />
            ) : (
              <LeadFormPlaceholder
                headline={config.leadForm.headline}
                buttonLabel={config.leadForm.buttonLabel}
                accent={theme.accent}
                onAccent={onAccent}
              />
            )}
          </div>
        )}

        <footer className="mt-6 flex flex-col items-center gap-1 text-[11px] opacity-50">
          <span>Powered by Hornbill TapTap</span>
          {live && (
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * One action row.
 *
 * Navigational blocks render as real anchors — closing UI-0 finding A5, where
 * links were `<button>` elements driven by `window.location`, so they announced
 * as "button" and lost middle-click and open-in-new-tab. vCard and M-Pesa stay
 * buttons because they act in-page rather than navigating.
 */
function BlockAction({
  block,
  accent,
  onAccent,
  primary,
  live,
  onActivate,
}: {
  block: Block;
  accent: string;
  onAccent: string;
  primary: boolean;
  live: boolean;
  onActivate: () => void;
}) {
  const label = block.label || defaultLabel(block.type);
  const href = buildHref(block.type, block.value);

  const style = primary
    ? { backgroundColor: accent, color: onAccent, borderColor: accent }
    : { backgroundColor: "transparent", borderColor: "currentColor" };

  const className = [
    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
    "transition-transform duration-fast active:scale-[0.99]",
    primary ? "" : "border-current/15",
    live ? "" : "cursor-default",
  ].join(" ");

  const content = (
    <>
      <BlockIcon type={block.type} className="h-4 w-4 shrink-0 opacity-90" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </>
  );

  // In preview nothing navigates, so render a plain element with no href — an
  // inert anchor would still be focusable and announce as a link.
  if (!live || !isNavigational(block.type) || !href) {
    return (
      <button
        type="button"
        onClick={onActivate}
        disabled={!live}
        style={style}
        className={className}
        aria-disabled={!live || undefined}
      >
        {content}
        {block.type === "mpesa" && block.value && (
          <span className="shrink-0 text-xs opacity-70">{block.value}</span>
        )}
      </button>
    );
  }

  return (
    <a
      href={href}
      onClick={onActivate}
      style={style}
      className={className}
      {...(block.type === "website" || block.type === "menu" || block.type === "booking"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {content}
    </a>
  );
}

function LeadFormPlaceholder({
  headline,
  buttonLabel,
  accent,
  onAccent,
}: {
  headline?: string;
  buttonLabel?: string;
  accent: string;
  onAccent: string;
}) {
  return (
    <div className="flex w-full flex-col gap-2" aria-hidden="true">
      {headline && <p className="text-center text-sm font-medium">{headline}</p>}
      {["Name", "Phone", "Email"].map((f) => (
        <div
          key={f}
          className="rounded-lg border border-current/15 px-3 py-2 text-sm opacity-50"
        >
          {f}
        </div>
      ))}
      <div
        className="rounded-xl px-5 py-2.5 text-center text-sm font-medium"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        {buttonLabel || "Send"}
      </div>
    </div>
  );
}
