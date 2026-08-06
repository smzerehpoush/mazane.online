import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Vazirmatn } from "next/font/google";

import { SITE_URL } from "../lib/site";
import "./globals.css";

/**
 * وزیرمتن از مسیر next/font: در زمان «بیلد» (بیرون از سرور، با اینترنت)
 * دانلود و سلف-هاست می‌شود — در اجرا هیچ درخواستی به گوگل نمی‌رود؛ برای
 * کاربر ایرانی و LCP هر دو حیاتی است (بند ۶.۳).
 */
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

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
    <html lang="fa" dir="rtl" className={vazirmatn.className}>
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <a href="/" className="brand">
              <span className="brand__coin" aria-hidden="true" />
              مظنه آنلاین
            </a>
            <nav className="site-nav" aria-label="ناوبری اصلی">
              <a href="/">جدول قیمت</a>
              <a href="/blog">بلاگ</a>
              <a href="/mazane-chist">مظنه چیست؟</a>
              <a href="/darbare-pishnahad">معیار پیشنهاد سردبیر</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <span>مظنه آنلاین — مقایسه‌ی قیمت مؤثر طلای آب‌شده، با احتساب کارمزد.</span>
            <span>
              داده‌ها از سکوهای نام‌برده گردآوری می‌شود و هر عدد به منبع خودش
              منتسب است.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
