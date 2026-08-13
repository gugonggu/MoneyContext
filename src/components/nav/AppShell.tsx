"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/motion/PageTransition";
import { springSnappy } from "@/components/motion/presets";
import { TopBar } from "@/components/nav/TopBar";
import {
  QUICK_ENTRY_HREF,
  bottomNavItems,
  isNavItemActive,
  navLabelForPath,
  sidebarNavItems,
} from "@/components/nav/nav-items";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Surface } from "@/components/ui/Surface";
import { cx } from "@/components/ui/cx";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface-base">
      <a
        className="fixed -left-[999px] -top-[999px] z-100 rounded-tile bg-surface-raised px-4 py-2 font-medium text-brand-700 shadow-lifted focus:left-4 focus:top-4 dark:text-brand-300"
        href="#main-content"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      <nav
        className="hidden w-60 shrink-0 border-r border-border-subtle bg-surface-raised p-3 md:flex md:flex-col dark:bg-surface-base"
        aria-label="주 메뉴"
      >
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-tile" />
          <span className="text-base font-bold tracking-tight text-content-primary">Money Context</span>
        </div>
        <ul className="flex flex-1 list-none flex-col gap-0.5 p-0">
          {sidebarNavItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative block rounded-tile px-3 py-2 text-sm font-semibold no-underline transition-colors",
                    active ? "text-brand-700 dark:text-brand-300" : "text-content-secondary hover:text-content-primary",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-tile bg-brand-500/12"
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-border-subtle px-2 pt-3">
          <span className="text-xs text-content-muted">화면 모드</span>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden md:block">
          <TopBar title={navLabelForPath(pathname)} />
        </div>

        <main
          id="main-content"
          className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8"
          tabIndex={-1}
        >
          <PageTransition routeKey={pathname} className="mx-auto w-full max-w-5xl">
            {children}
          </PageTransition>
        </main>
      </div>

      <Surface className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle md:hidden">
        <nav aria-label="하단 메뉴">
          <ul className="flex list-none items-end justify-around p-0 pb-1">
            {bottomNavItems.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const isPrimary = item.href === QUICK_ENTRY_HREF;

              if (isPrimary) {
                return (
                  <li key={item.href} className="flex-1">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="mx-auto -mt-5 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-500 text-xs font-bold text-white no-underline shadow-lifted"
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex flex-col items-center gap-1 py-2.5 text-xs no-underline transition-colors",
                      active ? "font-bold text-brand-600 dark:text-brand-400" : "text-content-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Surface>
    </div>
  );
}
