import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch, SwitchField } from "./switch";
import { CheckboxField } from "./checkbox";

describe("Switch", () => {
  it("exposes switch semantics rather than a plain button", () => {
    render(<Switch aria-label="Show lead form" />);
    expect(screen.getByRole("switch", { name: "Show lead form" })).toBeInTheDocument();
  });

  it("toggles with a click and reports checked state", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Active" onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch");

    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is operable from the keyboard", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Active" onCheckedChange={onCheckedChange} />);

    await userEvent.tab();
    expect(screen.getByRole("switch")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Active" disabled onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole("switch"), { pointerEventsCheck: 0 });
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("SwitchField", () => {
  it("associates its visible label and description", () => {
    render(<SwitchField label="Lead capture" description="Show a form on this page" />);
    const toggle = screen.getByRole("switch", { name: "Lead capture" });
    expect(toggle).toHaveAccessibleDescription("Show a form on this page");
  });

  it("toggles when the label text is clicked", async () => {
    const onCheckedChange = vi.fn();
    render(<SwitchField label="Lead capture" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByText("Lead capture"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("CheckboxField", () => {
  it("is labelled and toggleable via its text", async () => {
    const onCheckedChange = vi.fn();
    render(<CheckboxField label="I agree" onCheckedChange={onCheckedChange} />);
    expect(screen.getByRole("checkbox", { name: "I agree" })).toBeInTheDocument();
    await userEvent.click(screen.getByText("I agree"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
