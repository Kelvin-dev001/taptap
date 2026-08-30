import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdvanceOrder } from "./advance-order";

const advanceOrderAction = vi.fn();
vi.mock("@/app/admin/order-actions", () => ({
  advanceOrderAction: (...args: unknown[]) => advanceOrderAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  advanceOrderAction.mockResolvedValue({});
});

/**
 * The board's central accessibility claim: an illegal move is unreachable
 * rather than rejected. If this drifts from `allowedTransitions`, staff get
 * offered moves the server will refuse — which is the failure a drag-and-drop
 * board would have had by design.
 */
describe("AdvanceOrder", () => {
  it("offers only the legal next moves", () => {
    render(<AdvanceOrder orderId="o1" status="new" />);
    expect(screen.getByRole("button", { name: "Content received" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeTruthy();
    // Not legal from `new` — must not be offered at all.
    expect(screen.queryByRole("button", { name: "In production" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delivered" })).toBeNull();
  });

  it("offers the revision loop where the pipeline allows it", () => {
    render(<AdvanceOrder orderId="o1" status="awaiting_approval" />);
    expect(screen.getByRole("button", { name: "Approved" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revision requested" })).toBeTruthy();
  });

  it("offers the QC bounce back to production", () => {
    render(<AdvanceOrder orderId="o1" status="qc" />);
    expect(screen.getByRole("button", { name: "Ready for dispatch" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "In production" })).toBeTruthy();
  });

  /** Cancelling a card already in someone's hand is a refund, not a click. */
  it("does not offer cancellation once dispatched", () => {
    render(<AdvanceOrder orderId="o1" status="dispatched" />);
    expect(screen.getByRole("button", { name: "Delivered" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("offers nothing at all on a terminal order", () => {
    render(<AdvanceOrder orderId="o1" status="delivered" />);
    expect(screen.queryByRole("button")).toBeNull();

    render(<AdvanceOrder orderId="o2" status="cancelled" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing at all for a terminal order on a board card", () => {
    const { container } = render(<AdvanceOrder orderId="o1" status="delivered" compact />);
    expect(container.textContent).toBe("");
  });

  /** A board card shows the forward move only — cancelling belongs on detail. */
  it("shows only the forward move in compact mode", () => {
    render(<AdvanceOrder orderId="o1" status="awaiting_approval" compact />);
    expect(screen.getByRole("button", { name: /approved/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /revision/i })).toBeNull();
  });

  it("posts the order and the target stage", () => {
    const { container } = render(<AdvanceOrder orderId="order-42" status="new" />);
    const inputs = Array.from(container.querySelectorAll("input[type=hidden]")).map((i) => [
      (i as HTMLInputElement).name,
      (i as HTMLInputElement).value,
    ]);
    expect(inputs).toContainEqual(["orderId", "order-42"]);
    expect(inputs).toContainEqual(["to", "content_received"]);
    expect(inputs).toContainEqual(["to", "cancelled"]);
  });
});
