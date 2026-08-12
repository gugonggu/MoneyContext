import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const MORE_LINKS = [
  { href: "/assets", label: "자산" },
  { href: "/transactions/recurring", label: "반복 거래" },
  { href: "/transactions/planned", label: "예정 거래" },
  { href: "/statistics", label: "통계" },
  { href: "/notifications", label: "알림" },
  { href: "/export", label: "AI Export" },
  { href: "/settings", label: "설정" },
] as const;

export default function MorePage() {
  return (
    <div>
      <PageHeader title="더보기" />
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {MORE_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {item.label}
                <span aria-hidden="true" className="text-slate-400">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
