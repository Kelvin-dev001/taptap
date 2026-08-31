import { NfcCard } from "./nfc-card";
import { PhoneFrame } from "./phone-frame";

/**
 * The card taps the phone, and the screen wakes.
 *
 * One composition for every screen, server-rendered, with no client JavaScript
 * at all. The movement is CSS (see `.hero-card` and friends in globals.css) and
 * runs once on load rather than being scrubbed against scroll — the earlier
 * scroll-linked version pinned 220vh of viewport on desktop, ran transform work
 * on every frame, and, worse, shipped the whole picture at `opacity: 0` so that
 * a hiccup in hydration left the hero empty.
 *
 * Everything here is visible and correctly placed with no animation whatsoever.
 * The keyframes only add a beginning.
 *
 * LAYOUT NOTE, learned twice. The phone is sized by WIDTH and sits in normal
 * flow, so it sets this container's height. Sizing it by height instead is a
 * circular constraint — `PhoneFrame` derives its box from width via
 * aspect-ratio, so a `w-full` inside an `h-full w-auto` parent has nothing to
 * resolve against, and the browser settles it by picking either the full
 * containing block (the handset overhangs the section below) or nothing at all
 * (the phone vanishes). Both have happened. Nothing here has a fixed height:
 * the phone decides, and the card hangs off it.
 */
export function HeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex w-full max-w-[21rem] justify-end sm:max-w-sm lg:max-w-[30rem]"
    >
      {/* Card. Absolutely placed so it can never add height to the row, and it
          passes BEHIND the handset — which is where a card goes when you tap
          one, and it leaves the screen unobstructed once it lands.

          Two elements on purpose: the outer one holds the placement (including
          the -translate-y-1/2 that centres it), the inner one owns `transform`
          for the animation. One element cannot do both, because the keyframes
          would overwrite the centring. */}
      <div className="absolute left-0 top-1/2 w-[64%] -translate-y-1/2">
        <div className="hero-card">
          <NfcCard />
        </div>
      </div>

      {/* Phone: in flow and sized by width, so IT sets the container height. */}
      <div className="hero-phone relative z-10 w-[46%]">
        {/* Warm light at the point of contact, behind the handset. The centring
            lives in the keyframes because they own `transform`. */}
        <span className="hero-flash absolute left-1/2 top-1/3 -z-10 block h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.45)_0%,rgba(249,115,22,0)_70%)] lg:h-40 lg:w-40" />

        <PhoneFrame />

        {/* The sleeping screen, lifting off the glass as the card lands. Inset
            and radius track PhoneFrame's own padding and corner at each
            breakpoint, so the panel covers the screen and not the bezel. */}
        <span className="hero-screen pointer-events-none absolute inset-[5px] block rounded-[1.5rem] bg-neutral-950 sm:inset-[6px] sm:rounded-[1.65rem]" />
      </div>
    </div>
  );
}
