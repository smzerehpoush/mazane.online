/**
 * صفحه‌ی اصلی — سروررندر، با داده‌ی واقعی ردیس/پستگرس.
 *
 * ⚠️ هیچ fetch کلاینتی برای رندر اول نیست: همه‌ی اعداد از لودر (تابع سروری
 * `loadHomeData`) می‌آیند و در همان HTML اولیه‌اند. اولویت شماره‌ی یک کسب‌وکار
 * سئوست و خزنده باید قیمت‌ها را در source صفحه ببیند، نه بعد از جاوااسکریپت.
 *
 * این فایل عمداً فقط **سیم‌کشی** است: نما و داده‌ی ساخت‌یافته در
 * `components/tablo/HomePage.tsx` اند تا بدون بستر روتر (و بدون کشاندن
 * `ioredis`/`pg` به گراف تست) در مرز «استور seed شده ⟸ HTML» تست شوند.
 */
import { createFileRoute } from "@tanstack/react-router";

import { HomePage, homeHead } from "@/components/tablo/HomePage";
import { loadHomeData } from "@/lib/home-data";

export const Route = createFileRoute("/")({
  /**
   * تنها راه ورود داده به صفحه‌ی اصلی. `loadHomeData` تابع سروری است، پس در
   * ناوبری سمت کلاینت هم روی سرور اجرا می‌شود و ردیس/پستگرس به مرورگر
   * نمی‌روند. خروجی با ‎Route.useLoaderData()‎ در دسترس است.
   */
  loader: async () => loadHomeData(),
  // سرصفحه به داده‌ی قیمت وابسته نیست: صفحه‌ی اصلی فقط `Organization`/`WebSite`
  // دارد و `Product` مالِ صفحه‌ی دارایی است (بند ۶.۵).
  head: () => homeHead(),
  component: Index,
});

function Index() {
  return <HomePage data={Route.useLoaderData()} />;
}
