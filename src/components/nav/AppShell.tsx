"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cx } from "@/components/ui/cx";
import { QUICK_ENTRY_HREF, bottomNavItems, isNavItemActive, sidebarNavItems } from "@/components/nav/nav-items";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        className="fixed -left-[999px] -top-[999px] z-[100] rounded-lg bg-white px-4 py-2 font-medium text-brand-700 shadow-lg focus:left-4 focus:top-4"
        href="#main-content"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      <nav className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:block" aria-label="주 메뉴">
        <div className="mb-6 px-2 text-lg font-bold tracking-tight text-slate-900">Money Context</div>
        <ul className="flex flex-col gap-1">
          {sidebarNavItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="main-content" className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8" tabIndex={-1}>
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" aria-label="하단 메뉴">
        <ul className="flex list-none items-stretch justify-around">
          {bottomNavItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const isPrimary = item.href === QUICK_ENTRY_HREF;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center gap-0.5 py-2 text-xs no-underline transition-colors",
                    isPrimary ? "font-bold text-brand-600" : active ? "font-semibold text-brand-600" : "text-slate-500",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
