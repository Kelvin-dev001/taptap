import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
  SortableHeader,
} from "./table";

const hrefFor = (column: string, direction: string) => `/admin/orders?sort=${column}&dir=${direction}`;

describe("Table", () => {
  /**
   * Real table semantics, not a grid of divs. The two look identical and only
   * one tells a screen reader what a row, a column or a header is (§24).
   */
  it("exposes rows, columns and headers to assistive tech", () => {
    render(
      <Table caption="Orders">
        <TableHead>
          <TableRow>
            <TableHeader>Order</TableHeader>
            <TableHeader>Business</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>TT001</TableCell>
            <TableCell>Magangi</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table", { name: "Orders" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "TT001" })).toBeTruthy();
  });

  it("scopes column headers", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Order</TableHeader>
          </TableRow>
        </TableHead>
      </Table>,
    );
    expect(screen.getByRole("columnheader").getAttribute("scope")).toBe("col");
  });

  it("spans the empty message across the whole table", () => {
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={4}>No orders match those filters.</TableEmpty>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole("cell");
    expect(cell.getAttribute("colspan")).toBe("4");
    expect(cell.textContent).toContain("No orders match");
  });
});

describe("SortableHeader", () => {
  const renderHeader = (props: Partial<Parameters<typeof SortableHeader>[0]> = {}) =>
    render(
      <Table>
        <TableHead>
          <TableRow>
            <SortableHeader
              label="Amount"
              column="amount"
              activeColumn="amount"
              direction="asc"
              hrefFor={hrefFor}
              {...props}
            />
          </TableRow>
        </TableHead>
      </Table>,
    );

  /** aria-sort is what communicates the state; the arrow is decoration. */
  it("announces the current sort state", () => {
    renderHeader();
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("ascending");
  });

  it("announces descending, and none when another column is sorted", () => {
    const { unmount } = renderHeader({ direction: "desc" });
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("descending");
    unmount();

    renderHeader({ activeColumn: "created" });
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("none");
  });

  it("toggles direction on the active column", () => {
    renderHeader({ direction: "asc" });
    expect(screen.getByRole("link").getAttribute("href")).toContain("dir=desc");
  });

  /** An unsorted column should sort ascending first, not flip to descending. */
  it("starts an inactive column ascending", () => {
    renderHeader({ activeColumn: "created", direction: "desc" });
    expect(screen.getByRole("link").getAttribute("href")).toContain("dir=asc");
  });

  it("sorts by navigation, so a sorted view is shareable", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /amount/i }).getAttribute("href")).toContain(
      "sort=amount",
    );
  });
});
