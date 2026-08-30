import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal, RevealGroup, RevealItem } from "./reveal";
import { PricingTeaser } from "./pricing-teaser";
import { Faq } from "./faq";
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
 * readable — not merely that durations get shorter. These assert the text is in
 * the document either way, which is the thing a reader actually needs.
 */
describe("reveal — reduced motion", () => {
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
describe("pricing teaser — no drift from lib/pricing.ts", () => {
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
   * D-018/D-020 say so explicitly — selling them here would be the exact
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
    expect(screen.getByText(/tapping opens their normal phone browser/i)).toBeTruthy();
    expect(screen.getByText(/modern iphones read nfc/i)).toBeTruthy();
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
