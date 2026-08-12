import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Ring } from "@/components/ui/Ring";
import { Sparkline } from "@/components/ui/Sparkline";

afterEach(cleanup);

describe("Sparkline", () => {
  it("exposes a text summary so the chart is not colour-only", () => {
    render(<Sparkline values={[1, 5, 3]} label="Recent 3-day spending trend" />);

    expect(screen.getByRole("img", { name: "Recent 3-day spending trend" })).toBeTruthy();
  });

  it("draws a polyline point per value", () => {
    const { container } = render(<Sparkline values={[10, 20, 30, 20]} label="Trend" />);
    const points = container.querySelector("polyline")?.getAttribute("points") ?? "";

    expect(points.trim().split(/\s+/).length).toBe(4);
  });

  it("renders a flat line when every value is identical", () => {
    const { container } = render(<Sparkline values={[7, 7, 7]} label="Trend" />);
    const points = (container.querySelector("polyline")?.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[1]));

    expect(new Set(points).size).toBe(1);
  });

  it("renders nothing but the label when there are no values", () => {
    const { container } = render(<Sparkline values={[]} label="Trend" />);

    expect(container.querySelector("polyline")).toBeNull();
  });
});

describe("Ring", () => {
  it("shows the percentage as text next to the arc", () => {
    render(<Ring ratio={0.68} label="Budget usage" />);

    expect(screen.getByText("68%")).toBeTruthy();
  });

  it("clamps a ratio above one", () => {
    render(<Ring ratio={1.4} label="Budget usage" />);

    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("clamps a negative ratio", () => {
    render(<Ring ratio={-0.2} label="Budget usage" />);

    expect(screen.getByText("0%")).toBeTruthy();
  });
});
