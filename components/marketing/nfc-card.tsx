import { BrandMark } from "./brand-mark";

/**
 * A Hornbill Smart Card, drawn rather than photographed.
 *
 * CSS and one small mark instead of a product shot: it stays sharp at any size,
 * costs no image request on a mid-range Android, and can be lit and rotated by
 * the hero's scroll sequence — none of which a JPEG of a card can do.
 *
 * Decorative. The hero's heading and copy carry the meaning, so this is hidden
 * from assistive tech rather than described twice.
 */
export function NfcCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1c1917_0%,#2c2523_45%,#191513_100%)] shadow-[0_28px_60px_-18px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        {/* Warm brand bloom, top-right, as if lit from off-frame. */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.55)_0%,rgba(249,115,22,0)_70%)]" />
        {/* Sheen across the face. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.09)_48%,transparent_60%)]" />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <BrandMark size={38} />
            <NfcWaves />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-primary-300">
              Smart Card
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-white">
              Hornbill TapTap
            </p>
            <p className="mt-0.5 text-[11px] text-white/45">
              taptap.hornbilltech.co.ke
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The contactless glyph, drawn at the card's corner. */
function NfcWaves() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-300" fill="none" aria-hidden="true">
      {[5, 9.5, 14].map((r, i) => (
        <path
          key={r}
          d={`M${6 + i * 4.5} 5.5a${r} ${r} 0 0 1 0 13`}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={1 - i * 0.28}
        />
      ))}
    </svg>
  );
}
