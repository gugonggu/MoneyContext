import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";

afterEach(cleanup);

const OPTIONS = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
] as const;

describe("Segmented", () => {
  it("marks the selected option with aria-checked", () => {
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={() => {}} />);

    expect(screen.getByRole("radio", { name: "월" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "주" }).getAttribute("aria-checked")).toBe("false");
  });

  it("reports the newly chosen value", () => {
    const onChange = vi.fn();
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(onChange).toHaveBeenCalledWith("week");
  });

  it("names the group for assistive technology", () => {
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={() => {}} />);

    expect(screen.getByRole("radiogroup", { name: "보기 방식" })).toBeTruthy();
  });

  it("moves selection to the next option with ArrowRight, wrapping past the last", () => {
    const onChange = vi.fn();
    render(<Segmented label="보기 방식" options={OPTIONS} value="week" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("radio", { name: "주" }), { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("moves selection to the previous option with ArrowLeft, wrapping past the first", () => {
    const onChange = vi.fn();
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("radio", { name: "월" }), { key: "ArrowLeft" });

    expect(onChange).toHaveBeenCalledWith("week");
  });

  it("keeps only the selected option in the tab order", () => {
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={() => {}} />);

    expect(screen.getByRole("radio", { name: "월" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: "주" }).getAttribute("tabindex")).toBe("-1");
  });
});

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    expect(screen.queryByText("상세 내용")).toBeNull();
  });

  it("renders a titled modal dialog while open", () => {
    render(
      <Sheet open onClose={() => {}} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "8월 5일" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("상세 내용")).toBeTruthy();
  });

  it("closes on the Escape key", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the close button is pressed", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop is pressed", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "배경 닫기" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("traps forward and backward focus inside the dialog", () => {
    render(
      <Sheet open onClose={() => {}} title="8월 5일">
        <button type="button">첫 거래</button>
        <button type="button">마지막 거래</button>
      </Sheet>,
    );

    const closeButton = screen.getByRole("button", { name: "닫기" });
    const lastButton = screen.getByRole("button", { name: "마지막 거래" });

    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("restores focus to the trigger after closing", () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            상세 열기
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="8월 5일">
            <p>상세 내용</p>
          </Sheet>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "상세 열기" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(document.activeElement).toBe(trigger);
  });
});
