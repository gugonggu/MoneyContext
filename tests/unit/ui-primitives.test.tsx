import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { Surface } from "@/components/ui/Surface";

afterEach(cleanup);

describe("Card", () => {
  it("renders a plain raised surface by default", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).toContain("bg-surface-raised");
    expect(card.className).not.toContain("glass-surface");
  });

  it("renders a glass surface when asked", () => {
    const { container } = render(<Card variant="glass">Content</Card>);

    expect((container.firstElementChild as HTMLElement).className).toContain("glass-surface");
  });

  it("renders the brand gradient when asked", () => {
    const { container } = render(<Card variant="gradient">Content</Card>);

    expect((container.firstElementChild as HTMLElement).className).toContain("from-brand-600");
  });

  it("keeps caller class names alongside the variant classes", () => {
    const { container } = render(<Card className="test-outline">Content</Card>);

    expect((container.firstElementChild as HTMLElement).className).toContain("test-outline");
  });
});

describe("Button", () => {
  it("defaults to the primary variant at medium size", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button.className).toContain("text-white");
    expect(button.className).toContain("px-4");
  });

  it("applies the requested small size", () => {
    render(<Button size="sm">Save</Button>);

    expect(screen.getByRole("button", { name: "Save" }).className).toContain("px-3");
  });

  it("forwards the disabled attribute", () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("StatTile", () => {
  it("renders the label, value, and optional hint", () => {
    render(<StatTile label="Investments" value="₩1,240,000" hint="Up 3.2% from last month" />);

    expect(screen.getByText("Investments")).toBeTruthy();
    expect(screen.getByText("₩1,240,000")).toBeTruthy();
    expect(screen.getByText("Up 3.2% from last month")).toBeTruthy();
  });

  it("omits the hint element when no hint is given", () => {
    render(<StatTile label="Spending" value="₩800,000" />);

    expect(screen.queryByText("Up 3.2% from last month")).toBeNull();
  });

  it("uses the positive value tone when requested", () => {
    const { container } = render(<StatTile label="Income" value="₩1,000" tone="positive" />);

    expect(container.querySelector(".text-positive-600")).toBeTruthy();
  });
});

describe("Surface", () => {
  it("applies the glass treatment and medium blur by default", () => {
    const { container } = render(<Surface>Content</Surface>);
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.className).toContain("glass-surface");
    expect(surface.className).toContain("backdrop-blur-xl");
  });

  it("applies the small blur when requested", () => {
    const { container } = render(<Surface blur="sm">Content</Surface>);

    expect((container.firstElementChild as HTMLElement).className).toContain("backdrop-blur-md");
  });
});

describe("Skeleton", () => {
  it("renders a hidden animated placeholder", () => {
    const { container } = render(<Skeleton className="h-8" />);
    const skeleton = container.firstElementChild as HTMLElement;

    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.className).toContain("animate-pulse");
    expect(skeleton.className).toContain("h-8");
  });
});
