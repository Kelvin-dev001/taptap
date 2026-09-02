import { describe, it, expect } from "vitest";
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
import { TypingHeadline } from "./typing-headline";
import {
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  formatKes,
} from "@/lib/pricing";

/**
 * The requirement behind §24 is that content never waits on animation to become
 * readable, not merely that durations get shorter.
 *
 * These wrappers used to be `motion` components, which meant every section they
 * wrapped sat in the server HTML at `opacity: 0` until the animation runtime
 * hydrated and an observer fired. They are plain CSS now, so the tests assert
 * the guarantee that matters: readable markup with nothing hiding it.
 */
describe("reveal", () => {
  it("renders its content as ordinary, visible markup", () => {
    const { container } = render(<Reveal>Something worth reading</Reveal>);
    expect(screen.getByText("Something worth reading")).toBeTruthy();
    expect(container.innerHTML).not.toContain("opacity:0");
    expect(container.innerHTML).not.toContain("opacity: 0");
  });

  it("holds a delayed reveal back without hiding it", () => {
    const { container } = render(<Reveal delay={0.1}>Held back a beat</Reveal>);
    expect(screen.getByText("Held back a beat")).toBeTruthy();
    // The delay is a later slice of the same scroll range, not an inline style
    // that something has to come along and clear.
    expect(container.innerHTML).toContain("reveal-late");
    expect(container.innerHTML).not.toContain("opacity:0");
  });

  it("renders every item of a stagger group", () => {
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
    render(<PricingTeaser />);

    expect(screen.getAllByText(formatKes(HARDWARE_PRICE_KES.card)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatKes(HARDWARE_PRICE_KES.stand)).length).toBeGreaterThan(0);
  });

  it("shows the real renewal price", () => {
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
    render(<PricingTeaser />);
    expect(screen.queryByText(/advanced/i)).toBeNull();
  });

  /**
   * Team management is still unbuilt (D-017), so no column may claim it. This
   * used to allow exactly one; under D-024 the answer is none, because there
   * are no tiers left to differentiate and the feature still does not exist.
   */
  it("does not offer team management on any segment", () => {
    render(<PricingTeaser />);
    expect(screen.queryByText(/team management/i)).toBeNull();
  });

  /**
   * Segments are packaging, not tiers (D-024). Every paying account gets the
   * same capabilities, so the table must not imply a restricted report on the
   * cheaper column — which it did until Sprint 7.
   */
  it("does not gate the report behind a segment", () => {
    render(<PricingTeaser />);
    expect(screen.queryByText(/basic report/i)).toBeNull();
    expect(screen.getAllByText("Included").length).toBeGreaterThan(0);
  });

  it("sends Corporate to the quote form rather than to signup", () => {
    render(<PricingTeaser />);
    const link = screen.getByRole("link", { name: /talk to sales/i });
    // A mailto loses the enquiry on any phone with no mail client configured,
    // and leaves staff nothing to work from (D-021).
    expect(link.getAttribute("href")).toBe("/quote");
  });

  /**
   * The load-bearing copy change of Sprint 7. The landing page must not imply
   * that a page is live without a card, because it is not.
   */
  it("does not promise a live page for nothing", () => {
    const { container } = render(<PricingTeaser />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/free plan/i);
    expect(text).toMatch(/activate it with a card/i);
  });
});

describe("faq", () => {
  /**
   * Native <details> is keyboard-operable and announced without any JavaScript,
   * which is why it was chosen over a hand-rolled accordion.
   */
  it("renders every answer in the DOM, collapsed but present", () => {
    render(<Faq />);
    expect(screen.getByText(/opens their normal browser/i)).toBeTruthy();
    expect(screen.getByText(/newer iphones read the card/i)).toBeTruthy();
  });

  it("quotes the renewal price from the pricing module", () => {
    render(<Faq />);
    expect(
      screen.getByText(new RegExp(`renews at ${formatKes(RENEWAL_PER_IDENTITY_KES)}`, "i")),
    ).toBeTruthy();
  });

  /** Deletion is by request (see /privacy), not a self-serve button. */
  it("does not promise self-serve deletion", () => {
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
    const { container } = render(render_());
    expect(container.textContent ?? "").not.toContain("—");
  });

  it("names the company in full in the footer", () => {
    const { container } = render(<MarketingFooter />);
    const text = container.textContent ?? "";
    expect(text).toContain("Hornbill Technologies Limited");
    expect(text).toContain("Mombasa");
    expect(text).toContain("All rights reserved");
  });
});

/**
 * The hero must be a picture of the right thing before anything runs.
 *
 * This is the regression these guard. The hero used to be a scroll-scrubbed
 * `motion` sequence, which put the entire composition into the SERVER html as
 * `style="opacity:0"` and revealed it only once the animation runtime had
 * hydrated and its observer had fired. When any link in that chain slipped, the
 * card and the phone were absent from the page — on desktop and on mobile,
 * where most of our customers are.
 *
 * The rule now is that the unanimated state IS the finished state: CSS
 * keyframes only add a beginning. So the assertions below are about what the
 * markup guarantees on its own, with no runtime of any kind.
 *
 * jsdom has no layout engine, so this asserts what is in the DOM rather than
 * how it lands. Widths and overflow still need a real browser.
 */
describe("hero", () => {
  it("renders the words without waiting for any animation", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "One tap. Endless connections.",
    );
    expect(screen.getAllByRole("link", { name: /get started/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /log in/i }).length).toBeGreaterThan(0);
  });

  it("ships the card and the phone visible, with nothing hiding them", () => {
    const { container } = render(<Hero />);
    // The two objects themselves, by the aspect ratios only they have.
    expect(container.innerHTML).toContain("aspect-[1.586/1]"); // card
    expect(container.innerHTML).toContain("aspect-[9/19]"); // phone
    // And nothing anywhere in the hero starts transparent. This is the exact
    // shape of the bug: present in the DOM, invisible on the screen.
    expect(container.innerHTML).not.toContain("opacity:0");
    expect(container.innerHTML).not.toContain("opacity: 0");
  });

  it("shows one composition on every screen rather than hiding it on phones", () => {
    const { container } = render(<Hero />);
    // There is no longer a desktop-only branch to fall out of, and no
    // breakpoint at which the visual is display:none.
    expect(container.innerHTML).not.toContain("lg:hidden");
    expect(container.innerHTML).not.toContain("hidden lg:block");
  });

  it("never pins the viewport", () => {
    const { container } = render(<Hero />);
    // 220vh of thumb before a word of content, and a scroll handler running
    // transforms the whole way down.
    expect(container.innerHTML).not.toContain("220vh");
    expect(container.innerHTML).not.toContain("sticky");
  });

  it("moves the card with CSS, so no bundle has to arrive first", () => {
    const { container } = render(<Hero />);
    expect(container.querySelector(".hero-card")).not.toBeNull();
    expect(container.querySelector(".hero-phone")).not.toBeNull();
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

/**
 * The typing effect must not cost the headline — and must not delay it.
 *
 * Two failure modes are guarded here. The usual implementation appends
 * characters to state, which ships an empty h1 to a crawler and to anyone whose
 * bundle fails. The version before this one avoided that but drove the stagger
 * from `motion`, which stamps `style="opacity:0"` on every character in the
 * SERVER output — so the line was present but invisible until the animation
 * runtime had downloaded, parsed and hydrated. Both are the same bug wearing
 * different clothes: the headline waiting on JavaScript.
 *
 * The fix is that there is no JavaScript here at all. These hold that line.
 */
describe("typing headline", () => {
  const TEXT = "One tap. Endless connections.";

  it("has the whole line in the DOM, spaces and all", () => {
    const { container } = render(<TypingHeadline text={TEXT} />);
    expect(container.textContent).toContain(TEXT);
  });

  /**
   * The regression that matters. Nothing may set the characters transparent in
   * markup: the stagger lives entirely in a render-blocking stylesheet, so the
   * effect completes whether or not a bundle ever lands.
   */
  it("ships no inline opacity, so the words never wait on hydration", () => {
    const { container } = render(<TypingHeadline text={TEXT} />);
    expect(container.innerHTML).not.toContain("opacity:0");
    expect(container.innerHTML).not.toContain("opacity: 0");
  });

  it("staggers through CSS rather than an animation runtime", () => {
    const { container } = render(<TypingHeadline text={TEXT} />);
    expect(container.querySelectorAll(".type-char").length).toBe(TEXT.length);
    // globals.css turns the index into a delay, so the pace is tuned in one
    // place instead of being baked into every span.
    expect(container.querySelector(".type-char")?.getAttribute("style")).toContain(
      "--type-i",
    );
  });

  it("keeps the caret out of the accessibility tree", () => {
    const { container } = render(<TypingHeadline text={TEXT} />);
    const caret = container.querySelector(".type-caret");
    expect(caret).not.toBeNull();
    expect(caret?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lets the line wrap rather than gluing it together", () => {
    const { container } = render(<TypingHeadline text={TEXT} />);
    // pre-wrap keeps the spaces without the non-wrapping behaviour of nbsp,
    // which would force this onto one line on a 360px screen.
    expect(container.innerHTML).toContain("whitespace-pre-wrap");
    expect(container.innerHTML).not.toContain("&nbsp;");
  });
});
