"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/components/theme/theme-script";

type Theme = "light" | "dark";

function subscribeToThemeAttribute(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function serverTheme(): Theme {
  return "light";
}

export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const theme = useSyncExternalStore(subscribeToThemeAttribute, currentTheme, serverTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Best-effort persistence; the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className={className ?? "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}
    >
      <span aria-hidden="true" className="text-base">
        {theme === "dark" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
