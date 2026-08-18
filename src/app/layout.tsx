import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { themeBootstrapScript } from "@/components/theme/theme-script";

const notoSansKr = Noto_Sans_KR({
  display: "swap",
  variable: "--font-noto-sans-kr",
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Money Context",
  description: "개인 재정 기록과 분석을 위한 가계부",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={notoSansKr.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="bg-surface-base font-sans text-content-primary">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
