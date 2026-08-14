import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart, RankedBars, formatBarLabel, type Series } from "./bar-chart";

const series: Series[] = [
  { key: "tap", label: "Taps", color: "#f97316" },
  { key: "scan", label: "QR scans", color: "#d4d4d4" },
];

const data = [
  { label: "2026-08-13", values: { tap: 4, scan: 1 } },
  { label: "2026-08-14", values: { tap: 9, scan: 3 } },
  { label: "2026-08-15", values: { tap: 0, scan: 0 } },
];

describe("formatBarLabel", () => {
  /**
   * Regression: BarChart is a Client Component, so the previous
   * `formatLabel={fn}` prop threw "Functions cannot be passed directly to
   * Client Components" the first time a signed-in user opened the dashboard.
   * Formatting is now selected by a string and done inside the client.
   */
  it("formats an ISO date without a locale or timezone dependency", () => {
    expect(formatBarLabel("2026-08-15", "date")).toBe("15 Aug");
    expect(formatBarLabel("2026-01-01", "date")).toBe("1 Jan");
    expect(formatBarLabel("2026-12-31", "date")).toBe("31 Dec");
  });

  it("does not shift a date across a timezone boundary", () => {
    // Parsed from the string parts, so midnight UTC never becomes the 14th.
    expect(formatBarLabel("2026-08-15T00:00:00Z", "date")).toBe("15 Aug");
  });

  it("passes through unrecognised labels and raw format", () => {
    expect(formatBarLabel("Mobile", "raw")).toBe("Mobile");
    expect(formatBarLabel("not-a-date", "date")).toBe("not-a-date");
  });
});

describe("BarChart", () => {
  it("renders one focusable bar per datum", () => {
    render(<BarChart data={data} series={series} labelFormat="date" />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("gives every bar an accessible description with its real numbers", () => {
    render(<BarChart data={data} series={series} labelFormat="date" />);
    // Keyboard and screen-reader users get what hover gives a mouse user.
    expect(
      screen.getByRole("button", { name: "14 Aug: 9 Taps, 3 QR scans" }),
    ).toBeInTheDocument();
  });

  it("labels a zero day honestly rather than hiding it", () => {
    render(<BarChart data={data} series={series} labelFormat="date" />);
    expect(
      screen.getByRole("button", { name: "15 Aug: 0 Taps, 0 QR scans" }),
    ).toBeInTheDocument();
  });

  it("shows an empty message rather than an empty frame", () => {
    render(<BarChart data={[]} series={series} />);
    expect(screen.getByText(/No activity in this period/)).toBeInTheDocument();
  });
});

describe("RankedBars", () => {
  it("prints values so the bar is reinforcement, not the only signal", () => {
    render(
      <RankedBars
        data={[
          { label: "Chat on WhatsApp", value: 329 },
          { label: "Leave a review", value: 47 },
        ]}
      />,
    );
    expect(screen.getByText("329")).toBeInTheDocument();
    expect(screen.getByText("Chat on WhatsApp")).toBeInTheDocument();
  });

  it("handles an empty set", () => {
    render(<RankedBars data={[]} />);
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
  });
});
