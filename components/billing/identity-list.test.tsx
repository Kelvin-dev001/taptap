import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityList } from "./identity-list";
import type { IdentityRow } from "@/lib/identity";

const startRenewalAction = vi.fn();
vi.mock("@/app/dashboard/billing/actions", () => ({
  startRenewalAction: (...args: unknown[]) => startRenewalAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  startRenewalAction.mockResolvedValue({});
});

const far = new Date(Date.now() + 300 * 86_400_000).toISOString();
const soon = new Date(Date.now() + 10 * 86_400_000).toISOString();
const lapsed = new Date(Date.now() - 100 * 86_400_000).toISOString();

const tags: IdentityRow[] = [
  { id: "a", account_id: "acct", status: "assigned", kind: "card", label: "Reception", term_end: far },
  { id: "b", account_id: "acct", status: "assigned", kind: "stand", label: "Till", term_end: soon },
  { id: "c", account_id: "acct", status: "assigned", kind: "card", label: "Dead", term_end: lapsed },
  { id: "d", account_id: "acct", status: "disabled", kind: "card", label: "Off", term_end: far },
];

/**
 * The checkbox values are the contract with `startRenewalAction`, which reads
 * `formData.getAll("tag")`. Radix renders the submittable input itself, so a
 * version bump that changed that behaviour would silently produce an M-Pesa
 * prompt for the wrong amount — worth pinning down rather than assuming.
 */
describe("IdentityList", () => {
  it("submits one checkbox value per selectable device", () => {
    const { container } = render(<IdentityList identities={tags} dueIds={["b", "c"]} />);
    const inputs = container.querySelectorAll('input[name="tag"]');
    expect(Array.from(inputs).map((i) => (i as HTMLInputElement).value)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("offers no checkbox for a switched-off device", () => {
    render(<IdentityList identities={tags} dueIds={[]} />);
    expect(screen.queryByLabelText(/renew off/i)).toBeNull();
  });

  it("pre-selects what is due and prices it", () => {
    render(<IdentityList identities={tags} dueIds={["b", "c"]} />);
    expect(screen.getByRole("button", { name: /renew 2 · KES 2,000/i })).toBeTruthy();
  });

  it("reprices as devices are selected and deselected", async () => {
    const user = userEvent.setup();
    render(<IdentityList identities={tags} dueIds={["b"]} />);

    expect(screen.getByRole("button", { name: /renew 1 · KES 1,000/i })).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: /renew reception/i }));
    expect(screen.getByRole("button", { name: /renew 2 · KES 2,000/i })).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: /renew till/i }));
    expect(screen.getByRole("button", { name: /renew 1 · KES 1,000/i })).toBeTruthy();
  });

  /** Charging KES 0 would still send a real STK prompt. */
  it("cannot submit with nothing selected", async () => {
    const user = userEvent.setup();
    render(<IdentityList identities={tags} dueIds={["b"]} />);

    await user.click(screen.getByRole("checkbox", { name: /renew till/i }));
    const button = screen.getByRole("button", { name: /select a device/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("separates a device still in grace from one that has stopped", () => {
    render(<IdentityList identities={tags} dueIds={[]} />);
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText("Renewing soon")).toBeTruthy();
  });

  it("tells an account with no devices what to do", () => {
    render(<IdentityList identities={[]} dueIds={[]} />);
    expect(screen.getByText(/no cards or stands yet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /renew/i })).toBeNull();
  });
});
