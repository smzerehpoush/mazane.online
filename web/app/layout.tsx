import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_URL } from "../lib/site";

/**
 * فراداده‌ی ریشه (بلیت ۱۰؛ بند ۶.۶): عنوان/توضیح فارسی،
 * ‎og:locale=fa_IR‎ و ‎metadataBase‎ برای حل نشانی‌های نسبی. canonical هر
 * صفحه مال خودش است.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "مظنه آنلاین — مقایسه‌ی قیمت مؤثر طلای آنلاین",
  description:
    "قیمت مؤثر خرید و فروش طلای آب‌شده در سکوهای آنلاین ایران — با احتساب کارمزد.",
  openGraph: {
    locale: "fa_IR",
    siteName: "مظنه آنلاین",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
