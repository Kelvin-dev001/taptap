# Marketing landing page — Claude Code prompt

Decisions locked with Kelvin (2026-08): Framer Motion scroll-linked animation; brand =
logo + colors only (craft the card in SVG/CSS, let the product UI be the hero visual);
truthful early-stage social proof (no fake counts/testimonials); one long landing page +
link to the existing `/pricing`. Reuse the existing design system; do not touch the app.

**Copy:** finished, human-written copy for every section lives in
`docs/landing-page-copy.md`. Hand Claude Code both files — it should USE that copy rather
than inventing its own.

## Ready-to-paste Claude Code prompt

```
You are the senior front-end/brand engineer for Hornbill TapTap (read CLAUDE.md,
PROJECT.md, and docs/decision-log.md first). Build a premium, animated MARKETING LANDING
PAGE for the public site. Operate under the repo's sprint governance: AUDIT -> PLAN ->
STOP for my approval, then implement.

HARD BOUNDARIES (do not break anything that works):
- Only touch PUBLIC MARKETING code: the home route (app/page.tsx) and new presentational
  components under components/marketing/. You MAY add a small marketing section wrapper
  and nav/footer for the public site.
- DO NOT modify: the dashboard, /admin ops, billing, auth logic, API routes, Supabase
  schema/migrations, RLS, or any server actions. No DB changes.
- Keep the existing /pricing, /privacy, /terms, /login pages; LINK to them (do not restate
  prices in a way that can drift from lib/pricing.ts).
- Reuse the existing design system (components/ui, components/shell, the design tokens,
  the brand orange, the Wordmark/logo) and the current stack (Next 16 App Router, React
  19, Tailwind). Match the look of the real public profile UI for any product mockups.

GOAL: a professional, informative, genuinely delightful single long landing page that
markets Hornbill TapTap, explains the offering, and drives two clear CTAs that already
exist: "Get started" (the signup/login entry) and "Log in". Sales-led "Talk to Sales" for
Commercial. It must NOT look AI-generated or templated: specific, confident, benefit-led
copy (write it ORIGINAL — take only structural inspiration from references, copy no text),
crafted SVG/CSS visuals over generic stock, real product UI as the hero.

ANIMATION (approved approach = Framer Motion, scroll-linked):
- Add framer-motion (npm "motion", import from "motion/react") — justify this one dependency
  in the plan; it is required for the scroll work and is the light, React-native choice.
- HERO: a scroll-linked sequence built with useScroll + useTransform. A Hornbill-branded
  NFC card (crafted in SVG/CSS, orange brand) rotates/parallaxes and "taps" toward a phone
  that reveals a live TapTap profile (reuse the real profile UI's look) as the user scrolls
  the hero. Smooth, buttery, transform/opacity only (GPU-friendly).
- Section reveals: staggered fade/slide-in on scroll (whileInView).
- Micro-interactions: buttons get a subtle press micro-scale + hover elevation; nav
  solidifies/condenses on scroll; a magnetic/again-tactile feel on the primary CTA.
- A "trusted by" style MARQUEE (CSS keyframes, seamless loop, pause on hover) — but TRUTHFUL:
  fill it with the industries/use-cases we serve and "Built in Kenya", NOT fake customer
  counts or logos.
- RESPECT prefers-reduced-motion everywhere: provide static, non-animated fallbacks; never
  block content on animation. Keep it fast on mid-range Kenyan Android (lazy-load, no heavy
  assets, Lighthouse mobile >= 90).

SECTIONS (single long page, in order):
1. Sticky nav: Wordmark; anchor links (How it works, Features, Use cases, Pricing, FAQ);
   CTAs "Log in" and "Get started". Animated scroll state. Mobile menu.
2. Hero: sharp headline + subhead (one smart identity for your business; tap or scan to
   share everything and capture every lead), dual CTA, and the scroll-linked card->phone
   reveal. Kenya-first cues (M-Pesa, WhatsApp, Google Reviews).
3. Truthful marquee: scrolling industries/use-cases + "Built in Kenya for African
   businesses".
4. What is TapTap: the core idea — one digital identity behind NFC, QR and a smart link;
   update anytime, the card is never reprogrammed.
5. How it works: 3 animated steps — (1) Get your Smart Card or Stand, (2) Build your
   profile in minutes, (3) Tap or scan to share + capture leads and reviews.
6. Features grid (animated cards, hover states): digital identity; NFC + QR; save-contact
   vCard; WhatsApp / call / email / website / socials; Google Reviews; Google Maps
   directions; M-Pesa; lead capture; analytics; multiple identities; custom branding;
   team/organization management.
7. USE CASES (make this rich and interactive — tabs or filter chips), with a concrete
   scenario for each. Cover, at minimum:
   - Professionals & individuals: CEOs, consultants, salespeople, lawyers, real estate
     agents, photographers, artists, freelancers, trainers, executives.
   - SMEs: restaurants, cafes, salons, spas, clinics, pharmacies, small hotels, retail
     shops, car dealers, agencies, workshops, offices.
   - Organizations: hotels & hotel groups, hospitals, universities/schools, corporates,
     banks, real estate companies, restaurant chains, property management, tourism, large
     agencies, corporate sales teams.
   - Scenario examples to write out: a restaurant puts a Stand on each table -> guests tap
     to leave a Google review or view the menu; a salesperson taps their card to instantly
     share contact + WhatsApp and capture the lead; a clinic reception Stand collects
     reviews and directions; a realtor's card opens the listing + booking.
8. Analytics: "know what's working" — an illustrative (clearly-labelled) mock of the
   analytics (taps, scans, top buttons, devices). Do not present fake numbers as real.
9. Pricing teaser (must match D-018 / lib/pricing.ts — do not invent numbers): three
   segments — Professional (individuals), Business (SMEs), Commercial (organizations).
   Smart Card KES 1,500 and Smart Stand KES 2,000 (each includes the first 12 months);
   renewal KES 1,000 per active identity/year; Commercial is "From KES 1,000/identity/year
   — Talk to Sales". Link to the full /pricing page.
10. Social proof: TRUTHFUL. No fabricated testimonials or counts. Use a short founder's/
    vision note and clearly-structured placeholder slots to fill with real quotes later.
11. FAQ (accordion, accessible): Do I need an app? (No — works in the browser; QR fallback.)
    Does it work on iPhone? What if I change my links? (Yes, anytime — the card is never
    reprogrammed.) How does pricing/renewal work? Is my data safe? (Kenya DPA / ODPC.)
12. Final CTA band: "Get your smart identity today" -> Get started; secondary Talk to Sales.
13. Footer: Pricing, Privacy, Terms, Contact; socials; Hornbill company line; copyright.

CTAS: wire "Get started" and "Log in" to the EXISTING auth entry routes (do not rebuild
auth). "Talk to Sales" opens a mailto or a simple contact path (confirm in the plan).

QUALITY BAR:
- SEO: proper <title>/description, Open Graph/Twitter cards, semantic landmarks, one h1,
  descriptive alt text, sitemap-friendly.
- Accessibility: WCAG 2.2 AA — visible focus, full keyboard nav, reduced-motion, adequate
  contrast, aria for the accordion/marquee/mobile menu, non-color-only status.
- Performance: transform/opacity animations only; lazy-load below-the-fold; no giant
  images; keep the public JS lean; Lighthouse mobile >= 90.
- Copy: USE THE APPROVED COPY in docs/landing-page-copy.md for every section (headline,
  marquee, how-it-works, features, use-case scenarios, analytics, pricing teaser, vision
  note, FAQ, CTAs, footer, SEO). It is written and signed off — do not replace it with
  generated filler. You may tighten for layout, but keep the voice rules in that file
  (no "seamless/revolutionary/elevate", no fake proof, no lorem ipsum) and flag any copy
  gap instead of inventing claims.

DELIVERABLES: the animated landing page (app/page.tsx + components/marketing/*), the
framer-motion dependency, and light tests/checks where sensible (build, typecheck, a
reduced-motion check). Follow AUDIT -> PLAN -> STOP: first inspect the design system,
brand tokens, the current app/page.tsx, lib/pricing.ts, and the real profile UI, then
present a section-by-section plan (with the exact copy direction and the hero animation
storyboard) and WAIT for my approval before building. Do not touch anything outside the
public marketing surface.
```
