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

  it("announces a completed restore after reload and consumes the success flag", () => {
    window.sessionStorage.setItem("money-context.backup-restored", "1");

    renderBackupRestore();

    expect(screen.getByRole("status").textContent).toContain("Backup restored");
    expect(window.sessionStorage.getItem("money-context.backup-restored")).toBeNull();
  });

  it("provides a backup download without retaining backup content in the page", () => {
    renderBackupRestore();

    const download = screen.getByRole("link", { name: "Download full backup" });
    expect(download.getAttribute("href")).toBe("/api/backup");
    expect(download.hasAttribute("download")).toBe(true);
  });

  it("shows a replacement warning after selecting a JSON backup", () => {
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    const input = screen.getByLabelText("Choose a JSON backup file");
    fireEvent.change(input, { target: { files: [file] } });

    expect(input.getAttribute("accept")).toBe(".json,application/json");
    expect(screen.getByText("backup.json")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Restore replacement warning" }).textContent).toContain("replace your current financial data");
  });

  it("requires explicit replacement confirmation before restore is enabled", () => {
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });

    const restore = screen.getByRole("button", { name: "Restore backup" });
    expect((restore as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    expect((restore as HTMLButtonElement).disabled).toBe(false);
  });

  it("posts the selected JSON only after confirmation and immediately reloads data after a successful restore", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/backup/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"schema_version":1}',
    });
    expect((await screen.findByRole("status")).textContent).toContain("Backup restored");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("still reloads after a successful restore when saving the success marker fails", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is unavailable");
    });
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert", { name: "Restore error" })).toBeNull();
  });

  it("clears the selected backup and confirmation after restore so it cannot submit again", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    await screen.findByRole("status");
    expect(screen.queryByText("backup.json")).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore backup" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports invalid selected JSON through an accessible alert without losing the selected file", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderBackupRestore();

    const file = new File(["not JSON"], "broken-backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    expect((await screen.findByRole("alert", { name: "Restore error" })).textContent).toContain("not valid JSON");
    expect(screen.getByText("broken-backup.json")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains the selected backup and reports an accessible error when restore fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Invalid backup JSON" }), { status: 400 })));
    renderBackupRestore();

    const file = new File(['{"schema_version":1}'], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a JSON backup file"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("I understand that restoring replaces my current financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    expect((await screen.findByText("Invalid backup JSON")).textContent).toContain("Invalid backup JSON");
    expect(screen.getByText("backup.json")).toBeTruthy();
    expect((screen.getByLabelText("I understand that restoring replaces my current financial data") as HTMLInputElement).checked).toBe(true);
  });
});
