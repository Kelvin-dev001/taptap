import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Section } from "./section";
import { Reveal } from "./reveal";

export function CtaBand() {
  return (
    <Section label="Get started" tone="sunken">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-surface-inverse px-5 py-12 text-center sm:px-12 sm:py-14">
          {/* Brand bloom, kept behind the text and out of the accessibility tree. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.4)_0%,rgba(249,115,22,0)_70%)]"
          />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
            <h2 className="text-balance text-display text-on-inverse">
              Ready to stop handing out paper?
            </h2>
            {/* This used to read "add a card or a stand whenever you are ready",
                which implied the page worked without one. It does not: building
                is free, going live needs a card (D-021), and the landing page is
                the last place to be vague about that. */}
            <p className="text-body text-on-inverse-muted">
              Build your page for nothing and see it first. A card or a stand makes it live.
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "transition-transform duration-fast hover:-translate-y-px active:scale-[0.97]",
                )}
              >
                Get started
              </Link>
              {/* A real form rather than a mailto: half of these visitors are
                  on a phone with no mail client configured, and a mailto that
                  opens nothing loses the enquiry silently. */}
              <Link
                href="/quote"
                className={cn(
                  buttonVariants({ variant: "inverse", size: "lg" }),
                  "ring-1 ring-white/15 transition-transform duration-fast active:scale-[0.97]",
                )}
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
