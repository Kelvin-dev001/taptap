import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "./metric-card";

/**
 * The no-fabrication rule (CLAUDE.md §15, §30.7) lives or dies at this
 * component: it must never invent a trend it was not given.
 */
describe("MetricCard", () => {
  it("renders the value without a delta when none is supplied", () => {
    render(<MetricCard label="Taps" value={1284} />);
    expect(screen.getByText("1284")).toBeInTheDocument();
    // No prior period means no trend claim at all — not "0%".
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows a signed delta when one is supplied", () => {
    render(<MetricCard label="Taps" value="1,284" delta={18.2} />);
    expect(screen.getByText("+18.2%")).toBeInTheDocument();
  });

  it("renders negative movement without a plus sign", () => {
    render(<MetricCard label="Taps" value="900" delta={-4.5} />);
    expect(screen.getByText("-4.5%")).toBeInTheDocument();
  });

  it("distinguishes a real zero delta from a missing one", () => {
    render(<MetricCard label="Taps" value="10" delta={0} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("describes direction in text, not colour alone (WCAG 1.4.1)", () => {
    render(<MetricCard label="Taps" value="1,284" delta={18.2} deltaLabel="vs previous 30 days" />);
    expect(screen.getByText(/increase vs previous 30 days/)).toBeInTheDocument();
  });
});
