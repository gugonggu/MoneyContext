import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the product name", () => {
    render(createElement(HomePage));

    expect(screen.getByRole("heading", { level: 1, name: "Money Context" })).toBeTruthy();
  });
});
