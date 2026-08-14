import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./dialog";

/**
 * Covers UI-0 finding A12: destructive actions had no confirmation step
 * (WCAG 3.3.4). Also checks the modal semantics Radix provides for us.
 */
describe("ConfirmDialog", () => {
  const props = {
    title: "Delete this link?",
    description: "Anyone tapping a card pointed at it will see a not-found page.",
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
  };

  it("is not rendered while closed", () => {
    render(<ConfirmDialog {...props} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes an accessible name and description when open", () => {
    render(<ConfirmDialog {...props} open />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Delete this link?");
    expect(dialog).toHaveAccessibleDescription(props.description);
  });

  it("runs the action only when confirmed", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...props} open onConfirm={onConfirm} confirmLabel="Delete" destructive />);

    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...props} open onOpenChange={onOpenChange} />);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers a cancel path that does not run the action", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...props} open onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
