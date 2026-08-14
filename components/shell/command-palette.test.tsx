import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const profiles = [
  { id: "p1", slug: "java-house", title: "Java House Westlands" },
  { id: "p2", slug: "kilimani-salon", title: null },
];

async function open() {
  await userEvent.click(screen.getByRole("button", { name: /search/i }));
}

describe("CommandPalette", () => {
  it("searches the account's real profiles", async () => {
    render(<CommandPalette profiles={profiles} />);
    await open();

    await userEvent.keyboard("java");
    expect(screen.getByRole("option", { name: /Java House Westlands/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /kilimani/i })).not.toBeInTheDocument();
  });

  it("falls back to the slug when a profile has no title", async () => {
    render(<CommandPalette profiles={profiles} />);
    await open();
    await userEvent.keyboard("kilimani");
    expect(screen.getByRole("option", { name: /\/kilimani-salon/ })).toBeInTheDocument();
  });

  it("finds navigation destinations too", async () => {
    render(<CommandPalette profiles={[]} />);
    await open();
    await userEvent.keyboard("bill");
    expect(screen.getByRole("option", { name: /Billing/ })).toBeInTheDocument();
  });

  it("suggests nothing invented when the workspace is empty", async () => {
    render(<CommandPalette profiles={[]} />);
    await open();
    await userEvent.keyboard("java house");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("navigates to the highlighted entry on Enter", async () => {
    push.mockClear();
    render(<CommandPalette profiles={profiles} />);
    await open();
    await userEvent.keyboard("java");
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/dashboard/profiles/p1/edit");
  });

  it("moves the highlight with the arrow keys", async () => {
    push.mockClear();
    render(<CommandPalette profiles={profiles} />);
    await open();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    // Second entry overall: the other profile.
    expect(push).toHaveBeenCalledWith("/dashboard/profiles/p2/edit");
  });

  it("exposes combobox semantics with an active descendant", async () => {
    render(<CommandPalette profiles={profiles} />);
    await open();
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-controls");
    expect(input).toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
