import { MessageCircle, Phone, Star, MapPin, UserPlus } from "lucide-react";

/**
 * A Tap Profile as a customer sees it, rebuilt for the marketing page.
 *
 * Deliberately NOT the real `ProfileView`. That component logs a `view` event
 * on mount, so putting it here would post fabricated analytics against a page
 * id that does not exist — inventing traffic for a business that never had it,
 * which is exactly what §15 forbids. This mirrors its visual language instead:
 * same stacked actions, same single filled button, same restraint.
 *
 * Kept in step with the real thing by eye rather than by import, so if the
 * profile UI changes materially this should be revisited.
 */

const ACTIONS = [
  { icon: UserPlus, label: "Save my contact", filled: true },
  { icon: MessageCircle, label: "WhatsApp us" },
  { icon: Phone, label: "Call the shop" },
  { icon: Star, label: "Leave a Google review" },
  { icon: MapPin, label: "Get directions" },
];

export function MiniProfile() {
  return (
    <div className="flex h-full flex-col items-center bg-white px-5 pb-5 pt-8 text-neutral-900">
      {/* Avatar stands in for an uploaded logo. */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316,#c2560a)] text-lg font-bold text-white shadow-sm">
        MK
      </div>

      <p className="mt-3 text-center text-[15px] font-bold leading-tight">
        Mama Kioko&rsquo;s Kitchen
      </p>
      <p className="mt-1 text-center text-[11px] leading-snug text-neutral-500">
        Home-style Kenyan food · Nyali, Mombasa
      </p>

      <div className="mt-5 flex w-full flex-col gap-2">
        {ACTIONS.map(({ icon: Icon, label, filled }) => (
          <div
            key={label}
            className={
              filled
                ? "flex items-center gap-2 rounded-xl bg-[#C2560A] px-3 py-2.5 text-[12px] font-medium text-white"
                : "flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[12px] font-medium text-neutral-800"
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>

      <p className="mt-auto pt-4 text-[9px] text-neutral-400">
        Powered by Hornbill TapTap
      </p>
    </div>
  );
}
