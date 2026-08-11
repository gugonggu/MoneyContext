"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "@/components/nav/AppShell.module.css";
import { QUICK_ENTRY_HREF, bottomNavItems, isNavItemActive, sidebarNavItems } from "@/components/nav/nav-items";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        메인 콘텐츠로 건너뛰기
      </a>

      <nav className={styles.sidebar} aria-label="주 메뉴">
        <ul>
          {sidebarNavItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main-content" className={styles.content} tabIndex={-1}>
        {children}
      </main>

      <nav className={styles.bottomNav} aria-label="하단 메뉴">
        <ul>
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                className={item.href === QUICK_ENTRY_HREF ? styles.primaryAction : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
