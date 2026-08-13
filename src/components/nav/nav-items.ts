export type NavItem = Readonly<{ href: string; label: string }>;

export const sidebarNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "거래내역" },
  { href: "/calendar", label: "달력" },
  { href: "/assets", label: "자산" },
  { href: "/plans", label: "계획" },
  { href: "/statistics", label: "통계" },
  { href: "/export", label: "AI Export" },
  { href: "/settings", label: "설정" },
];

// 모바일에서는 회고(달력)가 계획보다 사용 빈도가 높다.
// 계획은 `더보기`에서 계속 접근할 수 있다.
export const bottomNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "내역" },
  { href: "/transactions/new", label: "입력" },
  { href: "/calendar", label: "달력" },
  { href: "/more", label: "더보기" },
];

export const QUICK_ENTRY_HREF = "/transactions/new";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const EXTRA_TITLES: readonly NavItem[] = [
  { href: "/notifications", label: "알림" },
  { href: "/more", label: "더보기" },
  { href: "/onboarding", label: "시작 설정" },
];

// 상단바 제목. 가장 긴 일치 항목을 고른다 (/transactions/new 가 /transactions 보다 우선).
export function navLabelForPath(pathname: string): string {
  const candidates = [...sidebarNavItems, ...EXTRA_TITLES, { href: "/transactions/new", label: "거래 입력" }];
  let best: NavItem | undefined;
  for (const item of candidates) {
    if (!isNavItemActive(pathname, item.href)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best?.label ?? "Money Context";
}
