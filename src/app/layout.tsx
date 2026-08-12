import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { themeBootstrapScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "Money Context",
  description: "개인 재정 기록과 분석을 위한 가계부",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">{children}</body>
    </html>
  );
}
