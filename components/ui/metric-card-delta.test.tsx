import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "./metric-card";
import { percentChange, isNewActivity } from "@/lib/metrics";

/**
 * End-to-end check of the honesty rule: what the RPC returns, through
 * percentChange, to what the card actually renders.
 */
describe("MetricCard + percentChange", () => {
  function renderFor(current: number, previous: number) {
    return render(
      <MetricCard
        label="Taps"
        value={current.toLocaleString()}
        delta={percentChange(current, previous)}
        isNew={isNewActivity(current, previous)}
        deltaLabel="vs previous 30 days"
      />,
    );
  }

  it("shows a real delta when there is a baseline", () => {
    renderFor(1284, 1086);
    expect(screen.getByText("+18.2%")).toBeInTheDocument();
  });

  it("shows 'new' — never a percentage — when the baseline is zero", () => {
    renderFor(40, 0);
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it("shows neither delta nor 'new' when nothing happened in either period", () => {
    renderFor(0, 0);
    expect(screen.queryByText("new")).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("reports a total loss as -100%, which is a real figure", () => {
    renderFor(0, 50);
    expect(screen.getByText("-100.0%")).toBeInTheDocument();
  });

  it("explains the missing baseline to screen readers", () => {
    renderFor(40, 0);
    expect(
      screen.getByText(/no activity in the previous period to compare against/),
    ).toBeInTheDocument();
  });
});
