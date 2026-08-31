import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal, RevealGroup, RevealItem } from "./reveal";
import { PricingTeaser } from "./pricing-teaser";
import { Faq } from "./faq";
import { Features } from "./features";
import { HowItWorks } from "./how-it-works";
import { WhatIsTapTap } from "./what-is-taptap";
import { AnalyticsPreview } from "./analytics-preview";
import { Vision } from "./vision";
import { CtaBand } from "./cta-band";
import { MarketingFooter } from "./footer";
import { Hero } from "./hero";
import { WhatsAppButton } from "./whatsapp-button";
import {
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  formatKes,
} from "@/lib/pricing";

const reducedMotion = vi.hoisted(() => ({ value: false }));

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => reducedMotion.value };
});

/**
 * The requirement behind §24 is that content never waits on animation to become
 * readable, not merely that durations get shorter. These assert the text is in
 * the document either way, which is the thing a reader actually needs.
 */
describe("reveal, reduced motion", () => {
  it("renders its content with motion on", () => {
    reducedMotion.value = false;
    render(<Reveal>Something worth reading</Reveal>);
    expect(screen.getByText("Something worth reading")).toBeTruthy();
  });

  it("renders its content with motion off", () => {
    reducedMotion.value = true;
    render(<Reveal>Something worth reading</Reveal>);
    expect(screen.getByText("Something worth reading")).toBeTruthy();
  });

  it("renders every item of a stagger group when motion is off", () => {
    reducedMotion.value = true;
    render(
      <RevealGroup>
        <RevealItem>First</RevealItem>
        <RevealItem>Second</RevealItem>
        <RevealItem>Third</RevealItem>
      </RevealGroup>,
    );
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByText("Third")).toBeTruthy();
  });
});

/**
 * The landing page must never quote a price the checkout does not charge.
 * These read the same constants the M-Pesa flow does, so a price change that
 * misses this page fails here rather than in front of a customer (D-018).
 */
describe("pricing teaser, no drift from lib/pricing.ts", () => {
  it("shows the real hardware prices", () => {
    reducedMotion.value = true;
    render(<PricingTeaser />);

    expect(screen.getAllByText(formatKes(HARDWARE_PRICE_KES.card)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatKes(HARDWARE_PRICE_KES.stand)).length).toBeGreaterThan(0);
  });

  it("shows the real renewal price", () => {
    reducedMotion.value = true;
    render(<PricingTeaser />);
    expect(
      screen.getAllByText(new RegExp(formatKes(RENEWAL_PER_IDENTITY_KES))).length,
    ).toBeGreaterThan(0);
  });

  /**
   * The supplied copy deck listed "Advanced" analytics for Commercial and
   * "Optional" team management for Business. The product ships neither, and
   * D-018/D-020 say so explicitly, and selling them here would be the exact
   * fabrication §15 forbids.
   */
  it("does not advertise an analytics tier that does not exist", () => {
    reducedMotion.value = true;
    render(<PricingTeaser />);
    expect(screen.queryByText(/advanced/i)).toBeNull();
  });

  it("does not offer team management on the Business plan", () => {
    reducedMotion.value = true;
    render(<PricingTeaser />);
    // Exactly one plan (Commercial) may claim it.
    expect(screen.getAllByText("Yes")).toHaveLength(1);
  });

  it("sends Commercial to sales rather than to signup", () => {
    reducedMotion.value = true;
    render(<PricingTeaser />);
    const link = screen.getByRole("link", { name: /talk to sales/i });
    expect(link.getAttribute("href")).toContain("mailto:sales@hornbilltech.co.ke");
  });
});

describe("faq", () => {
  /**
   * Native <details> is keyboard-operable and announced without any JavaScript,
   * which is why it was chosen over a hand-rolled accordion.
   */
  it("renders every answer in the DOM, collapsed but present", () => {
    reducedMotion.value = true;
    render(<Faq />);
    expect(screen.getByText(/opens their normal browser/i)).toBeTruthy();
    expect(screen.getByText(/newer iphones read the card/i)).toBeTruthy();
  });

  it("quotes the renewal price from the pricing module", () => {
    reducedMotion.value = true;
    render(<Faq />);
    expect(
      screen.getByText(new RegExp(`renews at ${formatKes(RENEWAL_PER_IDENTITY_KES)}`, "i")),
    ).toBeTruthy();
  });

  /** Deletion is by request (see /privacy), not a self-serve button. */
  it("does not promise self-serve deletion", () => {
    reducedMotion.value = true;
    render(<Faq />);
    expect(screen.getByText(/ask us to delete it/i)).toBeTruthy();
  });
});

/**
 * House style: no em dashes in anything a customer reads.
 *
 * Kelvin flagged them as the thing that makes copy read as machine-written, and
 * he is right that they are a tell. Enforcing it in a test rather than in a
 * style note means the next person to add a section finds out immediately
 * instead of shipping it.
 *
 * Scoped to rendered text only. Code comments are for engineers and are not
 * part of the voice.
 */
describe("copy style", () => {
  const SECTIONS: [string, () => React.ReactElement][] = [
    ["pricing teaser", () => <PricingTeaser />],
    ["faq", () => <Faq />],
    ["features", () => <Features />],
    ["how it works", () => <HowItWorks />],
    ["what TapTap is", () => <WhatIsTapTap />],
    ["analytics", () => <AnalyticsPreview />],
    ["vision", () => <Vision />],
    ["call to action", () => <CtaBand />],
    ["footer", () => <MarketingFooter />],
  ];

  it.each(SECTIONS)("uses no em dash in %s", (_name, render_) => {
    reducedMotion.value = true;
    const { container } = render(render_());
    expect(container.textContent ?? "").not.toContain("—");
  });

  it("names the company in full in the footer", () => {
    reducedMotion.value = true;
    const { container } = render(<MarketingFooter />);
    const text = container.textContent ?? "";
    expect(text).toContain("Hornbill Technologies Limited");
    expect(text).toContain("Mombasa");
    expect(text).toContain("All rights reserved");
  });
});

/**
 * Mobile is the default, not the fallback. Most customers reach this page on a
 * mid-range Android.
 *
 * The hero's scroll sequence is desktop-only: pinned on a phone it cost 220vh of
 * thumb before a word of content, and the composition did not fit inside an
 * `h-screen` box at 360×640. So the static version has to be in the server
 * output unconditionally, and the headline and CTAs must never depend on
 * animation or hydration to exist.
 *
 * jsdom has no layout engine, so this asserts what is in the DOM rather than
 * how it lands. Widths and overflow need a real browser.
 */
describe("hero on mobile", () => {
  it("renders the words without waiting for any animation", () => {
    reducedMotion.value = false;
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "One tap. Endless connections.",
    );
    expect(screen.getAllByRole("link", { name: /get started/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /log in/i }).length).toBeGreaterThan(0);
  });

  it("always ships the static composition, motion or not", () => {
    reducedMotion.value = false;
    const { container } = render(<Hero />);
    // The mobile composition is the one hidden from lg upward. If this stops
    // being rendered, phones lose the visual entirely. Matching the emitted
    // class avoids escaping a Tailwind colon into a CSS selector.
    expect(container.innerHTML).toContain("lg:hidden");
  });

  it("does not pin the viewport when motion is off", () => {
    reducedMotion.value = true;
    const { container } = render(<Hero />);
    expect(container.innerHTML).not.toContain("lg:h-[220vh]");
  });
});

/**
 * WhatsApp is how business actually gets done here, so this is the highest-value
 * control on the page for a visitor with one question.
 *
 * The number is pinned because a wrong digit is invisible: the button still
 * looks and behaves correctly, it just opens a chat with a stranger.
 */
describe("floating WhatsApp button", () => {
  it("opens a chat with the real number in international format", () => {
    const { container } = render(<WhatsAppButton />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toContain("wa.me/254759293030");
  });

  it("has a name a screen reader can use", () => {
    render(<WhatsAppButton />);
    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeTruthy();
  });

  /** Opening a new tab without this leaks window.opener to the target. */
  it("opens safely in a new tab", () => {
    const { container } = render(<WhatsAppButton />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});
