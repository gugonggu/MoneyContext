export type NavItem = Readonly<{ href: string; label: string }>;

export const sidebarNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "거래내역" },
  { href: "/assets", label: "자산" },
  { href: "/plans", label: "계획" },
  { href: "/statistics", label: "통계" },
  { href: "/export", label: "AI Export" },
  { href: "/settings", label: "설정" },
];

export const bottomNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "내역" },
  { href: "/transactions/new", label: "입력" },
  { href: "/plans", label: "계획" },
  { href: "/more", label: "더보기" },
];

export const QUICK_ENTRY_HREF = "/transactions/new";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
