import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileView } from "./profile-view";
import type { PublicPage } from "@/lib/profile";

const page: PublicPage = {
  id: "p1",
  title: "Java Junction Coffee",
  mode: "page",
  redirect_url: null,
  config: { tagline: "Coffee · Westlands" },
  theme: { accent: "#f97316" },
  links: [
    { id: "l1", type: "google_review", label: "Leave a Google review", value: "https://g.page/r/x", sort_order: 0 },
    { id: "l2", type: "whatsapp", label: "Chat on WhatsApp", value: "+254712345678", sort_order: 1 },
    { id: "l3", type: "contact", label: "Save contact", value: "", sort_order: 2 },
  ],
};

describe("ProfileView — live mode", () => {
  /**
   * UI-0 finding A5: navigational blocks were <button> elements driven by
   * window.location, so they announced as "button" and lost middle-click and
   * open-in-new-tab. They are anchors now.
   */
  it("renders navigational actions as real links with correct hrefs", () => {
    render(<ProfileView page={page} mode="live" />);
    expect(screen.getByRole("link", { name: /Leave a Google review/ })).toHaveAttribute(
      "href",
      "https://g.page/r/x",
    );
    expect(screen.getByRole("link", { name: /Chat on WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/254712345678",
    );
  });

  it("keeps the vCard action a button, because it acts in-page", () => {
    render(<ProfileView page={page} mode="live" />);
    expect(screen.getByRole("button", { name: /Save contact/ })).toBeInTheDocument();
  });

  it("reports clicks and contact saves to its caller", async () => {
    const onBlockClick = vi.fn();
    const onContactSave = vi.fn();
    render(
      <ProfileView page={page} mode="live" onBlockClick={onBlockClick} onContactSave={onContactSave} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Save contact/ }));
    expect(onContactSave).toHaveBeenCalled();
    expect(onBlockClick).not.toHaveBeenCalled();
  });

  it("records a view once on mount", () => {
    const trackView = vi.fn();
    render(<ProfileView page={page} mode="live" trackView={trackView} />);
    expect(trackView).toHaveBeenCalledTimes(1);
  });

  it("hides disabled actions from the public page", () => {
    const withDisabled: PublicPage = {
      ...page,
      links: [{ ...page.links[0], is_active: false }, page.links[1]],
    };
    render(<ProfileView page={withDisabled} mode="live" />);
    expect(screen.queryByText("Leave a Google review")).not.toBeInTheDocument();
    expect(screen.getByText("Chat on WhatsApp")).toBeInTheDocument();
  });

  it("orders actions by sort_order, not array order", () => {
    const shuffled: PublicPage = {
      ...page,
      links: [
        { ...page.links[1], sort_order: 0 },
        { ...page.links[0], sort_order: 1 },
      ],
    };
    render(<ProfileView page={shuffled} mode="live" />);
    const labels = screen.getAllByRole("link").map((el) => el.textContent);
    expect(labels[0]).toContain("Chat on WhatsApp");
  });
});

describe("ProfileView — preview mode", () => {
  /**
   * The builder preview uses this same component, so fidelity is structural
   * rather than maintained by hand. But it must not act.
   */
  it("renders no navigable links", () => {
    render(<ProfileView page={page} mode="preview" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the same action labels as the live page", () => {
    // Compare the actions themselves, not page furniture: the live footer also
    // carries a Privacy link, which the inert preview deliberately omits.
    const actionLabels = page.links.map((l) => l.label);

    const { unmount } = render(<ProfileView page={page} mode="live" />);
    for (const label of actionLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    unmount();

    render(<ProfileView page={page} mode="preview" />);
    for (const label of actionLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("omits the privacy link, which belongs only to the real page", () => {
    render(<ProfileView page={page} mode="preview" />);
    expect(screen.queryByText("Privacy")).not.toBeInTheDocument();
  });

  it("never tracks a view", () => {
    const trackView = vi.fn();
    render(<ProfileView page={page} mode="preview" trackView={trackView} />);
    expect(trackView).not.toHaveBeenCalled();
  });

  it("does not fire callbacks when an inert action is activated", async () => {
    const onBlockClick = vi.fn();
    render(<ProfileView page={page} mode="preview" onBlockClick={onBlockClick} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0], { pointerEventsCheck: 0 });
    expect(onBlockClick).not.toHaveBeenCalled();
  });
});
