"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Surface } from "@/components/ui/Surface";

export function TopBar({ title }: Readonly<{ title: string }>) {
  return (
    <Surface className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle px-4 py-3 sm:px-6 lg:px-8">
      <h1 className="truncate text-lg font-bold tracking-tight text-content-primary">{title}</h1>
      <div className="flex items-center gap-1">
        <Link
          href="/notifications"
          aria-label="알림"
          className="rounded-full p-2 text-content-secondary hover:bg-surface-base"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M10 2a5 5 0 0 0-5 5v3.6L3.6 13a.8.8 0 0 0 .7 1.2h11.4a.8.8 0 0 0 .7-1.2L15 10.6V7a5 5 0 0 0-5-5Zm0 15a2.2 2.2 0 0 0 2.1-1.6H7.9A2.2 2.2 0 0 0 10 17Z" />
          </svg>
        </Link>
        <ThemeToggle />
      </div>
    </Surface>
  );
}
