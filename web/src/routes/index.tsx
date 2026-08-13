/**
 * ⚠️ هیچ fetch کلاینتی برای رندر اول نیست: همه‌ی اعداد از لودر (تابع سروری
 * `loadHomeData`) می‌آیند و در همان HTML اولیه‌اند. اولویت شماره‌ی یک کسب‌وکار
 * سئوست و خزنده باید قیمت‌ها را در source صفحه ببیند، نه بعد از جاوااسکریپت.
 */
import { createFileRoute } from "@tanstack/react-router";

import { HomePage, homeHead } from "@/components/tablo/HomePage";
import { loadHomeData } from "@/lib/home-data";

export const Route = createFileRoute("/")({
  loader: async () => loadHomeData(),
  head: () => homeHead(),
  component: Index,
});

function Index() {
  return <HomePage data={Route.useLoaderData()} />;
}
