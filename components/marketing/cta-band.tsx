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
            <p className="text-body text-on-inverse-muted">
              Setting up your page is free. Add a card or a stand whenever you are ready.
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
              <a
                href="mailto:sales@hornbilltech.co.ke?subject=Hornbill%20TapTap%20-%20Talk%20to%20Sales"
                className={cn(
                  buttonVariants({ variant: "inverse", size: "lg" }),
                  "ring-1 ring-white/15 transition-transform duration-fast active:scale-[0.97]",
                )}
              >
                Talk to Sales
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
