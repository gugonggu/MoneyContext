import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackupRestore } from "@/components/settings/BackupRestore";

const refresh = vi.fn();
const reload = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  vi.stubGlobal("location", { reload });
});

afterEach(() => {
  cleanup();
  refresh.mockReset();
  reload.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

function renderBackupRestore() {
  render(<BackupRestore />);
}

describe("backup and restore controls", () => {
  it("does not require browser storage while server rendering", () => {
    vi.stubGlobal("window", undefined);

    expect(() => renderToString(<BackupRestore />)).not.toThrow();

    vi.unstubAllGlobals();
  });

  it("announces a completed restore from a non-sensitive URL fragment and removes the fragment", async () => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/settings#backup-restored");

    renderBackupRestore();

    expect(screen.getByRole("status").textContent).toContain("백업을 복원했습니다");
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("provides a backup download without retaining backup content in the page", () => {
    renderBackupRestore();

    const download = screen.getByRole("link", { name: "전체 백업 내려받기" });
    expect(download.getAttribute("href")).toBe("/api/backup");
    expect(download.hasAttribute("download")).toBe(true);
  });

  it("shows a replacement warning after selecting a JSON backup", () => {
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    const input = screen.getByLabelText("JSON 백업 파일 선택");
    fireEvent.change(input, { target: { files: [file] } });

    expect(input.getAttribute("accept")).toBe(".json,application/json");
    expect(screen.getByText("backup.json")).toBeTruthy();
    expect(screen.getByRole("status", { name: "복원 시 데이터가 교체된다는 경고" }).textContent).toContain("현재 금융 데이터가 교체됩니다");
  });

  it("requires explicit replacement confirmation before restore is enabled", () => {
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });

    const restore = screen.getByRole("button", { name: "백업 복원" });
    expect((restore as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    expect((restore as HTMLButtonElement).disabled).toBe(false);
  });

  it("posts the selected JSON only after confirmation and immediately reloads data after a successful restore", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "백업 복원" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/backup/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"schema_version":1}',
    });
    expect((await screen.findByRole("status")).textContent).toContain("백업을 복원했습니다");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reloads with a non-sensitive completion fragment when session storage is unavailable", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is unavailable");
    });
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "백업 복원" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#backup-restored");
    expect(screen.queryByRole("alert", { name: "복원 오류" })).toBeNull();
  });

  it("clears the selected backup and confirmation after restore so it cannot submit again", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "백업 복원" }));

    await screen.findByRole("status");
    expect(screen.queryByText("backup.json")).toBeNull();
    expect(screen.queryByRole("button", { name: "백업 복원" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports invalid selected JSON through an accessible alert without losing the selected file", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(["not JSON"], "broken-backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "백업 복원" }));

    expect((await screen.findByRole("alert", { name: "복원 오류" })).textContent).toContain("올바른 JSON 형식이 아닙니다");
    expect(screen.getByText("broken-backup.json")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains the selected backup and reports an accessible error when restore fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "잘못된 백업 JSON" }), { status: 400 })));
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "백업 복원" }));

    expect((await screen.findByText("잘못된 백업 JSON")).textContent).toContain("잘못된 백업 JSON");
    expect(screen.getByText("backup.json")).toBeTruthy();
    expect((screen.getByLabelText("복원 시 현재 금융 데이터가 교체된다는 것을 이해했습니다") as HTMLInputElement).checked).toBe(true);
  });
});
