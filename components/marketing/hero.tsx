import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HeroVisual } from "./hero-visual";
import { TypingHeadline } from "./typing-headline";

/**
 * The hero: a card travels across to a phone, taps it, and the screen wakes.
 *
 * The card closing the distance IS the animation. One moving object, one idea.
 *
 * This is a Server Component and ships no JavaScript. It used to be a pinned,
 * scroll-scrubbed sequence, which cost 220vh of viewport on desktop, ran
 * transform work on every scroll frame, and — the part that actually mattered —
 * put the whole composition in the server HTML at `opacity: 0`, visible only
 * once the animation runtime had hydrated. When that chain slipped, the hero
 * was blank.
 *
 * Now the movement is CSS keyframes that run once, and the resting state of
 * every element is the finished state. The worst thing that can happen is a
 * still picture of the right composition.
 */
export function Hero() {
  return (
    <div className="relative isolate">
      {/* ---- Background. Decorative, behind everything, never interactive. ----
          Three layers: a warm vertical wash, two wide colour fields that bleed
          off the edges, and a faint grid that gives the whole thing a surface to
          sit on. All fixed opacity and no animation, because the hero already
          has motion in it and a moving background under moving objects reads as
          noise. Contrast was kept well clear of the text: the strongest field
          tops out around 8% alpha.

          No `blur` on the colour fields. A radial gradient already falls off
          smoothly, so a 64px filter pass over a 736px element bought nothing
          visible and cost a full-size blur on every paint — which on a
          mid-range phone is one of the more expensive things a page can ask
          for, for decoration nobody would notice missing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[linear-gradient(180deg,#fffdfb_0%,#fff8f1_45%,#ffffff_100%)]"
      >
        <div className="absolute -left-[20%] -top-[30%] h-[46rem] w-[46rem] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.15)_0%,rgba(249,115,22,0)_65%)]" />
        <div className="absolute -right-[25%] top-[10%] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.17)_0%,rgba(251,191,36,0)_68%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[24rem] bg-[radial-gradient(60%_100%_at_50%_100%,rgba(194,86,10,0.07)_0%,rgba(194,86,10,0)_70%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(23,23,23,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,23,23,0.045)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(80%_60%_at_50%_35%,black,transparent)]" />
      </div>

      {/* pt-24 clears the 4rem sticky nav. Without it the headline sits under
          the wordmark on shorter screens. */}
      <div className="flex items-center px-5 pb-16 pt-24 sm:px-6 sm:pb-20 lg:pb-28 lg:pt-32">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-12">
          {/* ---- Words. Never animated, never moved. ---- */}
          <div className="flex flex-col gap-5 sm:gap-6">
            <h1 className="text-balance text-[2.25rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              <TypingHeadline text="One tap. Endless connections." />
            </h1>

            <p className="max-w-xl text-body text-foreground-secondary">
              Your customers tap your card or scan your code. In a second they have saved
              your number, opened WhatsApp, left you a review or found their way to your
              door. And you get to see every bit of it.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "transition-transform duration-fast active:scale-[0.97]",
                )}
              >
                Get started
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "transition-transform duration-fast active:scale-[0.97]",
                )}
              >
                Log in
              </Link>
            </div>

            <p className="text-body-sm text-muted">
              Free to set up. Nobody has to download an app, not you and not them.
            </p>
          </div>

          <HeroVisual />
        </div>
      </div>
    </div>
  );
}
