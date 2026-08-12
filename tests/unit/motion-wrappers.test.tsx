import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FadeIn } from "@/components/motion/FadeIn";
import { PageTransition } from "@/components/motion/PageTransition";
import { Pressable } from "@/components/motion/Pressable";
import { Stagger } from "@/components/motion/Stagger";

afterEach(cleanup);

describe("motion wrappers", () => {
  it("FadeIn renders its children", () => {
    render(<FadeIn>Unique content-fade</FadeIn>);

    expect(screen.getByText("Unique content-fade")).toBeTruthy();
  });

  it("Stagger renders every child", () => {
    render(
      <Stagger>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </Stagger>,
    );

    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByText("Third")).toBeTruthy();
  });

  it("Pressable keeps the wrapped control reachable by role", () => {
    render(
      <Pressable>
        <button type="button">Press</button>
      </Pressable>,
    );

    expect(screen.getByRole("button", { name: "Press" })).toBeTruthy();
  });

  it("PageTransition renders its children", () => {
    render(<PageTransition routeKey="/home">Unique content-page</PageTransition>);

    expect(screen.getByText("Unique content-page")).toBeTruthy();
  });
});
