/**
 * پولینگ ۳۰ ثانیه‌ای داشبورد (بند ۱۰ و ۱۴ سند طراحی).
 *
 * چهار قاعده‌ای که این هوک اجرا می‌کند و هرکدام یک اشتباه رایج را می‌بندند:
 *
 *   ۱. **مقدار اولیه از سرور می‌آید و موقع mount هیچ فچی زده نمی‌شود.**
 *      این صریح‌ترین خواسته‌ی بند ۱۴ است. الگوی معمول `useEffect(() => fetch())`
 *      یعنی هر بازدید یک درخواست اضافه به مبدأ می‌زند برای گرفتن داده‌ای که
 *      همین الان در HTML هست. اولین فچ **بعد از** اولین بازه‌ی ۳۰ ثانیه است.
 *   ۲. **تب مخفی ⟸ پولینگ متوقف.** تبِ باز در پس‌زمینه نباید ساعت‌ها به مبدأ
 *      درخواست بزند. موقع برگشت یک فچ فوری، چون داده‌ی روی صفحه حتماً کهنه است.
 *   ۳. **شکست فچ ⟸ داده‌ی قبلی می‌ماند** و فقط پرچم خطا بالا می‌رود
 *      (قاعده‌ی سخت ۵: کهنگی، نه خطا). صفحه هرگز خالی نمی‌شود.
 *   ۴. **هیچ محاسبه‌ای اینجا نیست.** payload از قبل هندسه و رشته‌های فارسی را
 *      دارد؛ این هوک فقط نگهش می‌دارد.
 *
 * ⚠️ خودِ این هوک هیچ DOM ای دست نمی‌زند و هیچ چیزی رندر نمی‌کند — فقط
 * وضعیت. نشاندن مقادیر روی گره‌ها کار `DashboardLive` است.
 */
import { useEffect, useRef, useState } from "react";

import type { LiveDashboard, LivePricesPayload } from "./live-update";

/** بازه‌ی پولینگ — همان چرخه‌ی ۳۰ ثانیه‌ای گردآورنده و فتیله. */
export const POLL_INTERVAL_MS = 30_000;

export interface LiveDashboardState {
  /** تازه‌ترین نمای دریافتی؛ `null` یعنی هنوز چیزی فراتر از رندر سرور نیامده. */
  data: LiveDashboard | null;
  /**
   * آخرین تلاش شکست خورد؟ نوار «اتصال برقرار نیست» را همین بالا می‌آورد.
   * با اولین دریافت موفق پاک می‌شود.
   */
  failed: boolean;
  /** شمارنده‌ی دریافت‌های موفق — کلید ری‌ست فتیله (هر دریافت، یک سوختن تازه). */
  tick: number;
  /** فچ فوری دستی — دکمه‌ی «همین حالا بگیر ↻» (بند ۵). */
  refreshNow: () => void;
}

/**
 * ⚠️ `initialUpdatedAt` عمداً ورودی است و از داخل خوانده نمی‌شود: فتیله باید
 * با زمان **داده‌ی سرور** همگام شود نه با لحظه‌ی hydration (بند ۱۴)، و تا
 * اولین دریافت موفق، تنها زمانی که داریم همان است.
 */
export function useLiveDashboard(): LiveDashboardState {
  const [data, setData] = useState<LiveDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  // در ref نگه داشته می‌شود تا تغییرش افکت را دوباره راه نیندازد — وگرنه هر
  // دریافت موفق، تایمر را ری‌ست می‌کرد و بازه از ۳۰ ثانیه می‌لغزید.
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll(): Promise<void> {
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok) throw new Error(`وضعیت ${response.status}`);
        const payload = (await response.json()) as LivePricesPayload;
        if (cancelled) return;
        // payload بدون بخش داشبورد یعنی سرور قدیمی‌تر است؛ داده‌ی قبلی
        // می‌ماند و این یک شکست حساب نمی‌شود.
        if (payload.dashboard !== undefined) {
          setData(payload.dashboard);
          setTick((value) => value + 1);
        }
        setFailed(false);
      } catch {
        // قاعده‌ی سخت ۵: عدد قبلی روی صفحه می‌ماند، فقط نوار خطا می‌آید.
        if (!cancelled) setFailed(true);
      }
    }

    function schedule(): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, POLL_INTERVAL_MS);
    }

    async function run(): Promise<void> {
      // تب مخفی: نه فچ، نه زمان‌بندی دوباره. برگشت، خودش راه می‌اندازد.
      if (document.visibilityState === "hidden") return;
      await poll();
      if (!cancelled) schedule();
    }

    fetchRef.current = () => {
      void (async () => {
        await poll();
        if (!cancelled) schedule();
      })();
    };

    function onVisibilityChange(): void {
      if (document.visibilityState !== "visible") {
        window.clearTimeout(timer);
        return;
      }
      // برگشت به تب: داده‌ی روی صفحه حتماً کهنه است ⟸ فچ فوری.
      void run();
    }

    // ⚠️ اولین فچ **بعد از** یک بازه‌ی کامل است، نه همین حالا: داده‌ی رندر
    // سرور تازه است و فچ فوری فقط یک درخواست اضافه به مبدأ می‌زند (بند ۱۴).
    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { data, failed, tick, refreshNow: () => fetchRef.current() };
}
