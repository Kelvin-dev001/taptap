import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavLinks } from "./nav-links";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

describe("NavLinks", () => {
  it("renders every destination as a link", () => {
    pathname.value = "/dashboard";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Tap Profiles" })).toHaveAttribute(
      "href",
      "/dashboard/profiles",
    );
  });

  it("marks the active section with aria-current, not colour alone (WCAG 1.4.1)", () => {
    pathname.value = "/dashboard/profiles/abc/edit";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Tap Profiles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("marks exactly one link current at a time", () => {
    pathname.value = "/dashboard/devices";
    render(<NavLinks />);
    const current = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("NFC Devices");
  });

  it("notifies the drawer when a link is used", async () => {
    pathname.value = "/dashboard";
    const onNavigate = vi.fn();
    render(<NavLinks onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("link", { name: "Billing" }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
