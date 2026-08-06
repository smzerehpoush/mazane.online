import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "مظنه آنلاین — مقایسه‌ی قیمت مؤثر طلای آنلاین",
  description:
    "قیمت مؤثر خرید و فروش طلای آب‌شده در سکوهای آنلاین ایران — با احتساب کارمزد.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
