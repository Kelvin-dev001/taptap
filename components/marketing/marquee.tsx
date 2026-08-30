import { cn } from "@/lib/cn";

const ITEMS = [
  "Restaurants",
  "Cafés",
  "Salons & Spas",
  "Clinics & Pharmacies",
  "Hotels",
  "Retail Shops",
  "Real Estate",
  "Sales Teams",
  "Consultants",
  "Car Dealers",
  "Gyms",
  "Events",
  "Churches",
  "Schools",
  "Agencies",
  "Tour Operators",
];

/**
 * The industries TapTap is built for, scrolling.
 *
 * Deliberately NOT a logo wall or a customer count. Both would be fabricated at
 * this stage, and a marketing page that opens with an invented number is the
 * fastest way to lose the reader who checks (§15). What this claims is true:
 * these are the businesses the product is designed around.
 *
 * The track is duplicated and translated by exactly half its width, which is
 * what makes the loop seamless. `aria-hidden` on the copy stops a screen reader
 * announcing all sixteen twice; the first list is a real, readable list.
 */
export function Marquee() {
  return (
    <section aria-label="Who TapTap is for" className="border-y border-border bg-surface-sunken py-8">
      <p className="mb-5 text-center text-label uppercase tracking-[0.08em] text-muted">
        Built in Kenya for African businesses
      </p>

      <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        {/* Reduced motion gets the same information as a wrapped, static list
            rather than a stalled marquee frozen mid-word. */}
        <div className="flex w-max animate-marquee gap-3 group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          <Track />
          {/* The seam-filling copy is redundant once the track stops moving. */}
          <Track aria-hidden className="motion-reduce:hidden" />
        </div>
      </div>
    </section>
  );
}

function Track({
  "aria-hidden": ariaHidden,
  className,
}: {
  "aria-hidden"?: boolean;
  className?: string;
}) {
  return (
    <ul aria-hidden={ariaHidden} className={cn("flex shrink-0 flex-wrap gap-3", className)}>
      {ITEMS.map((item) => (
        <li
          key={item}
          className="whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-body-sm text-foreground-secondary"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
