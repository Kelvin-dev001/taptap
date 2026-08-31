import { Section } from "./section";
import { Reveal } from "./reveal";

/**
 * Stands where testimonials normally go.
 *
 * There are no customer quotes yet, so there are none here. Inventing them, or
 * padding the page with "trusted by 500+ businesses", would be the fastest way
 * to lose a reader who checks, and §15 rules it out anyway. A first-person note
 * about why the product exists is honest, and from a founder it is often more
 * persuasive than a stock quote.
 *
 * When the first customers are live, replace this with their words.
 *
 * The dark band is lit by two slow orange blooms drifting in opposite
 * directions. They are pure transform and opacity on GPU layers, so the motion
 * costs nothing on a mid-range phone, and `motion-reduce` parks them: the
 * colour stays, only the drift stops.
 */
export function Vision() {
  return (
    <Section label="Why we built TapTap" tone="inverse" className="relative overflow-hidden">
      {/* Decorative lighting. Sits behind the words and out of the a11y tree. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute -left-24 top-[-20%] h-[32rem] w-[32rem] animate-drift-slow rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.32)_0%,rgba(249,115,22,0)_65%)] blur-2xl motion-reduce:animate-none" />
        <span className="absolute -right-32 bottom-[-25%] h-[36rem] w-[36rem] animate-drift-slower rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.26)_0%,rgba(194,86,10,0)_68%)] blur-2xl motion-reduce:animate-none" />
        {/* A fine grain over the top stops the blooms banding on cheap panels. */}
        <span className="absolute inset-0 opacity-[0.15] [background-image:radial-gradient(rgba(255,255,255,0.35)_0.5px,transparent_0.5px)] [background-size:3px_3px]" />
      </div>

      <Reveal>
        <div className="relative mx-auto flex max-w-3xl flex-col gap-6 text-center">
          <p className="text-label uppercase tracking-[0.08em] text-primary-300">
            Why we built TapTap
          </p>

          <blockquote className="flex flex-col gap-5 text-balance text-xl leading-relaxed text-on-inverse sm:text-2xl">
            <p>
              Every day, businesses here lose customers in small ways. A paper card goes in
              the bin. A happy customer means to leave a review and never does. Someone
              writes down a WhatsApp number with one digit wrong.
            </p>
            <p>
              We built Hornbill TapTap so that one tap does all of it for you. It saves your
              number, opens the chat, takes them to your review page and shows them your
              door. Made here, priced for here, and simple enough for anyone who runs a
              business to pick up in an afternoon.
            </p>
          </blockquote>

          <footer className="text-body-sm text-on-inverse-muted">The Hornbill team</footer>
        </div>
      </Reveal>
    </Section>
  );
}
