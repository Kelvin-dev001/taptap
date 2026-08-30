import type { Metadata } from "next";
import { MotionProvider } from "@/components/marketing/motion-provider";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { Marquee } from "@/components/marketing/marquee";
import { WhatIsTapTap } from "@/components/marketing/what-is-taptap";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { UseCases } from "@/components/marketing/use-cases";
import { AnalyticsPreview } from "@/components/marketing/analytics-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Vision } from "@/components/marketing/vision";
import { Faq } from "@/components/marketing/faq";
import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingFooter } from "@/components/marketing/footer";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";

const TITLE = "Hornbill TapTap — Smart NFC Business Cards & Review Stands in Kenya";
const DESCRIPTION =
  "One tap shares your contact, WhatsApp, Google review link and location. Smart NFC cards and stands for Kenyan businesses, from KES 1,500 with the first year included.";

/**
 * The title is set absolutely rather than through the root template: the layout
 * appends "· Hornbill TapTap" to every page, and on the home page that would
 * read as the brand name twice.
 */
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Hornbill TapTap",
    locale: "en_KE",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

/**
 * The public landing page.
 *
 * A Server Component that composes mostly-server sections. `MotionProvider` is
 * a client boundary but its children are passed through as already-rendered
 * server output, so the animation runtime loads once for the page rather than
 * dragging every section onto the client.
 *
 * The only genuinely client sections are the ones that need input or scroll
 * position: the nav, the hero sequence, the use-case tabs, and the reveal
 * wrappers. The FAQ, features, pricing and footer ship no JavaScript.
 */
export default function Home() {
  return (
    <MotionProvider>
      {/* Skip link is the first focusable element (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-body-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main">
        <Hero />
        <Marquee />
        <WhatIsTapTap />
        <HowItWorks />
        <Features />

        <Section id="use-cases" label="Use cases" tone="sunken">
          <Reveal>
            <SectionHeading
              eyebrow="Use cases"
              title="Built for the way Kenyan businesses actually work."
              sub="Wherever a customer meets your business, TapTap turns that moment into an action."
              align="center"
            />
          </Reveal>
          <UseCases />
        </Section>

        <AnalyticsPreview />
        <PricingTeaser />
        <Vision />
        <Faq />
        <CtaBand />
      </main>

      <MarketingFooter />
    </MotionProvider>
  );
}
