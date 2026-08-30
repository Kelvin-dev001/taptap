import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "./pagination";

const hrefFor = (p: number) => `/admin/orders?page=${p}`;

describe("Pagination", () => {
  it("states where you are and how much there is", () => {
    render(<Pagination page={2} pageSize={25} total={137} hrefFor={hrefFor} />);
    expect(screen.getByText("26–50 of 137")).toBeTruthy();
  });

  it("does not overrun the total on the last page", () => {
    render(<Pagination page={6} pageSize={25} total={137} hrefFor={hrefFor} />);
    expect(screen.getByText("126–137 of 137")).toBeTruthy();
  });

  it("says so plainly when there is nothing", () => {
    render(<Pagination page={1} pageSize={25} total={0} hrefFor={hrefFor} />);
    expect(screen.getByText("Nothing to show")).toBeTruthy();
  });

  /**
   * A disabled control must not be a link at all. An anchor with aria-disabled
   * is still reachable by keyboard and still listed by a screen reader's link
   * rotor, which is worse than useless — it offers a route that goes nowhere.
   */
  it("removes rather than disables the unavailable direction", () => {
    render(<Pagination page={1} pageSize={25} total={137} hrefFor={hrefFor} />);
    expect(screen.queryByRole("link", { name: /previous/i })).toBeNull();
    expect(screen.getByRole("link", { name: /next/i })).toBeTruthy();
  });

  it("offers both directions in the middle", () => {
    render(<Pagination page={3} pageSize={25} total={137} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: /previous/i }).getAttribute("href")).toBe(
      "/admin/orders?page=2",
    );
    expect(screen.getByRole("link", { name: /next/i }).getAttribute("href")).toBe(
      "/admin/orders?page=4",
    );
  });

  it("offers neither when everything fits on one page", () => {
    render(<Pagination page={1} pageSize={25} total={10} hrefFor={hrefFor} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  /** A page number past the end must not produce a negative range. */
  it("clamps a page beyond the last one", () => {
    render(<Pagination page={99} pageSize={25} total={30} hrefFor={hrefFor} />);
    expect(screen.getByText("26–30 of 30")).toBeTruthy();
  });

  it("is a labelled landmark", () => {
    render(<Pagination page={1} pageSize={25} total={30} hrefFor={hrefFor} />);
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeTruthy();
  });
});
