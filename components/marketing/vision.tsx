import { Section } from "./section";
import { Reveal } from "./reveal";

/**
 * Stands where testimonials normally go.
 *
 * There are no customer quotes yet, so there are no customer quotes here.
 * Inventing them — or padding the page with "trusted by 500+ businesses" —
 * would be the single fastest way to lose a reader who checks, and §15 rules it
 * out anyway. A first-person note about why the product exists is honest, and
 * from a founder it is often more persuasive than a stock quote.
 *
 * When the first cohort is live, replace this with their words.
 */
export function Vision() {
  return (
    <Section label="Why we built TapTap" tone="inverse">
      <Reveal>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 text-center">
          <p className="text-label uppercase tracking-[0.08em] text-primary-300">
            Why we built TapTap
          </p>

          <blockquote className="flex flex-col gap-5 text-balance text-xl leading-relaxed text-on-inverse sm:text-2xl">
            <p>
              Every day, Kenyan businesses lose customers to a paper card in a bin, a review
              that was never left, and a WhatsApp number typed wrong.
            </p>
            <p>
              We built Hornbill TapTap so a single tap does the work: saves your contact,
              opens the chat, leaves the review, finds your door. Built here, priced for
              here, and made to be understood by anyone who runs a business — not just the
              tech-savvy.
            </p>
          </blockquote>

          <footer className="text-body-sm text-on-inverse-muted">— The Hornbill team</footer>
        </div>
      </Reveal>
    </Section>
  );
}
