import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import { IconButton } from "./icon-button";

describe("Button", () => {
  it("defaults to type=button so it cannot accidentally submit a form", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit type", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it("blocks interaction and marks itself busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("swaps in loadingText when provided", () => {
    render(
      <Button loading loadingText="Saving…">
        Save
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Saving…");
  });

  it("uses the AA-safe primary-strong fill, not the vivid brand orange (D-012)", () => {
    render(<Button>Go</Button>);
    // White label on #F97316 is 2.80:1 and fails AA; primary-strong is 4.53:1.
    expect(screen.getByRole("button").className).toContain("bg-primary-strong");
  });

  it("lets callers override base classes without conflict", () => {
    render(<Button className="rounded-full">Go</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("rounded-full");
    expect(cls).not.toContain("rounded-lg");
  });
});

describe("IconButton", () => {
  it("always exposes an accessible name", () => {
    render(
      <IconButton label="Delete link">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Delete link" })).toBeInTheDocument();
  });
});
