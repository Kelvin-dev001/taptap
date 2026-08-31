import { MessageCircle, Phone, Star, UserPlus } from "lucide-react";

/**
 * A Tap Profile as a customer sees it, rebuilt for the marketing page.
 *
 * Deliberately NOT the real `ProfileView`. That component logs a `view` event
 * on mount, so putting it here would post fabricated analytics against a page
 * id that does not exist, inventing traffic for a business that never had it.
 * This mirrors its visual language instead: same stacked actions, same single
 * filled button, same restraint.
 *
 * Sized in percentages and `em` rather than fixed pixels, because the frame it
 * sits in is a percentage of the hero. At 133px wide on a phone the old fixed
 * 15px heading wrapped the business name onto three lines and pushed the first
 * button out through the bottom of the handset.
 */
const ACTIONS = [
  { icon: UserPlus, label: "Save my contact", filled: true },
  { icon: MessageCircle, label: "WhatsApp us" },
  { icon: Phone, label: "Call the shop" },
  { icon: Star, label: "Leave a review" },
];

export function MiniProfile() {
  return (
    <div
      className="flex h-full w-full flex-col items-center bg-white text-neutral-900"
      /* One knob drives the whole card. Everything below is in em, so the
         profile keeps its proportions at any frame size instead of needing a
         breakpoint per element. */
      style={{ fontSize: "clamp(5px, 5.2cqw, 11px)", padding: "1.6em 1.1em 1.1em" }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316,#c2560a)] font-bold text-white"
        style={{ width: "3.2em", height: "3.2em", fontSize: "1.15em" }}
      >
        MK
      </div>

      <p
        className="text-center font-bold leading-tight"
        style={{ marginTop: "0.7em", fontSize: "1.05em" }}
      >
        Mama Kioko&rsquo;s
      </p>
      <p className="text-center leading-snug text-neutral-500" style={{ fontSize: "0.8em" }}>
        Nyali, Mombasa
      </p>

      <div
        className="flex w-full flex-col"
        style={{ marginTop: "0.9em", gap: "0.45em" }}
      >
        {ACTIONS.map(({ icon: Icon, label, filled }) => (
          <div
            key={label}
            className={
              filled
                ? "flex items-center rounded-lg bg-[#C2560A] font-medium text-white"
                : "flex items-center rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800"
            }
            style={{ gap: "0.4em", padding: "0.5em 0.6em", fontSize: "0.72em" }}
          >
            <Icon className="shrink-0" style={{ width: "1em", height: "1em" }} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
