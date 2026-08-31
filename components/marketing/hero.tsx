"use client";

import { useRef } from "react";
import Link from "next/link";
import { m, useScroll, useTransform, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";
import { NfcCard } from "./nfc-card";
import { PhoneFrame } from "./phone-frame";
import { HeroVisualMobile } from "./hero-visual-mobile";

/**
 * The hero: a card taps a phone, and the phone fills with a live profile.
 *
 * Scroll-linked rather than autoplaying, because the reader controls the pace —
 * the animation explains the product at whatever speed they scroll, and stops
 * when they stop. Everything animated is transform or opacity, so it stays on
 * the compositor and does not force layout on a mid-range Android.
 *
 * The headline and CTAs are plain DOM and never move. If the animation fails,
 * is switched off, or has not hydrated yet, the hero still says what the
 * product is and still converts.
 */
export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Progress across the sticky viewport, from "top of section reaches top of
  // screen" to "bottom does". Measured on the outer element so the sticky child
  // can be pinned without the two fighting.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Card: tilted and central, then straightens and drifts toward the phone.
  const cardX = useTransform(scrollYProgress, [0, 0.55], ["0%", "18%"]);
  const cardY = useTransform(scrollYProgress, [0, 0.55], ["0%", "-12%"]);
  const cardRotate = useTransform(scrollYProgress, [0, 0.55], [-16, -2]);
  const cardScale = useTransform(scrollYProgress, [0, 0.55], [1, 0.72]);
  const cardOpacity = useTransform(scrollYProgress, [0.5, 0.72], [1, 0]);

  // Phone: rises and settles as the card arrives.
  const phoneY = useTransform(scrollYProgress, [0, 0.55], ["14%", "0%"]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.55], [0.92, 1]);
  const phoneOpacity = useTransform(scrollYProgress, [0.05, 0.4], [0, 1]);

  // The tap: a single ripple at the moment of contact.
  const rippleScale = useTransform(scrollYProgress, [0.45, 0.72], [0.4, 2.6]);
  const rippleOpacity = useTransform(scrollYProgress, [0.45, 0.58, 0.72], [0, 0.5, 0]);

  // The screen wakes just after contact.
  const screenOpacity = useTransform(scrollYProgress, [0.5, 0.66], [0, 1]);

  return (
    /**
     * The scroll sequence is DESKTOP ONLY, and that is a mobile decision rather
     * than a shortcut.
     *
     * Pinned on a phone it cost 220vh of thumb before the reader reached a word
     * of content, and the hero simply did not fit: text plus a 26rem visual is
     * about 900px inside an `h-screen` box on a 360×640 handset, so it
     * overflowed. Most of our customers are on mid-range Android. They get the
     * static composition in normal document flow, which is shorter, lighter and
     * cannot clip.
     *
     * `svh` rather than `vh` on the pinned version: `100vh` on mobile browsers
     * measures the viewport WITHOUT the collapsing address bar, so a pinned
     * section is taller than the screen and its bottom edge hides behind chrome.
     */
    <div ref={ref} className={reduced ? undefined : "relative lg:h-[220vh]"}>
      {/* pt-20 clears the 4rem sticky nav. Without it the headline centres in
          the full viewport and its first line slides under the wordmark on
          shorter screens. */}
      <div
        className={cn(
          "flex items-center px-5 pb-16 pt-24 sm:px-6 sm:pb-20",
          reduced ? undefined : "lg:sticky lg:top-0 lg:h-[100svh] lg:py-0",
        )}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-12">
          {/* ---- Words. Never animated, never moved. ---- */}
          <div className="flex flex-col gap-5 sm:gap-6">
            <h1 className="text-balance text-[2.25rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              One tap. Endless connections.
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

          {/* ---- The sequence. Decorative throughout. ---- */}
          <div className="relative mx-auto h-[20rem] w-full max-w-md sm:h-[26rem] lg:h-[32rem]">
            {/* Mobile and tablet: the same story, played once on view rather
                than scrubbed against a pinned viewport. Under reduced motion it
                renders as a still composition. */}
            <div className={cn("h-full", reduced ? undefined : "lg:hidden")}>
              <HeroVisualMobile />
            </div>

            {!reduced && (
              <div className="hidden lg:block">
                <m.div
                  className="absolute left-1/2 top-1/2 z-10 w-[62%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    x: cardX,
                    y: cardY,
                    rotate: cardRotate,
                    scale: cardScale,
                    opacity: cardOpacity,
                  }}
                >
                  <NfcCard />
                </m.div>

                <m.div
                  className="absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2"
                  style={{ y: phoneY, scale: phoneScale, opacity: phoneOpacity }}
                >
                  <div className="relative h-full">
                    {/* Ripple, centred on the phone's contact point. */}
                    <m.span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/3 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.45)_0%,rgba(249,115,22,0)_70%)]"
                      style={{ scale: rippleScale, opacity: rippleOpacity }}
                    />
                    <m.div className="h-full" style={{ opacity: screenOpacity }}>
                      <PhoneFrame className="h-full w-auto" />
                    </m.div>
                  </div>
                </m.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
