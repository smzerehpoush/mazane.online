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
 * کف فاصله‌ی اولین فچ. اگر نوبت بعدی گردآورنده تقریباً رسیده باشد، بدون این
 * کف عملاً «موقع mount» فچ می‌زدیم که بند ۱۴ منعش کرده.
 */
const MIN_FIRST_DELAY_MS = 1_000;

/**
 * فاصله تا نوبت بعدی گردآورنده — نه یک بازه‌ی کامل از لحظه‌ی mount.
 *
 * ⚠️ چرا مهم است: فاز فتیله به `updatedAt` **سرور** قفل است، ولی اگر اولین
 * فچ ۳۰ ثانیه بعد از mount باشد این دو هرگز روی هم نمی‌افتند. صفحه‌ای که ۵
 * ثانیه بعد از `updatedAt` هیدریت شود، فتیله‌اش هر دور ۵ ثانیه **زودتر** از
 * رسیدن داده تمام می‌شود و چون `infinite` است دوباره پر می‌شود — خطا هرگز
 * جبران نمی‌شود و بند ۱۳ («فتیله دقیقاً هم‌زمان با دریافت داده تمام می‌شود»)
 * برای همیشه نقض می‌ماند. با تنظیم اولین فچ روی باقی‌مانده‌ی همان چرخه، هر دو
 * ساعت روی یک فاز می‌نشینند و بعد از آن هم‌قدم می‌مانند.
 */
export function firstDelayMs(updatedAt: string | null, nowMs: number = Date.now()): number {
  if (updatedAt === null) return POLL_INTERVAL_MS;
  const elapsed = nowMs - new Date(updatedAt).getTime();
  // زمان نامعتبر یا ساعتِ عقب‌مانده‌ی کاربر ⟸ رفتار قبلی، نه فچ زودهنگام.
  if (!Number.isFinite(elapsed) || elapsed < 0) return POLL_INTERVAL_MS;
  return Math.max(MIN_FIRST_DELAY_MS, POLL_INTERVAL_MS - (elapsed % POLL_INTERVAL_MS));
}

/**
 * ⚠️ `initialUpdatedAt` زمان داده‌ی رندر سرور است و **فقط** فاز اولین فچ را
 * تعیین می‌کند: پولینگ باید با چرخه‌ی گردآورنده همگام شود نه با لحظه‌ی
 * hydration (بند ۱۴). عمداً از `data` داخلی خوانده نمی‌شود چون تا اولین
 * دریافت موفق، تنها زمانی که داریم همان است.
 */
export function useLiveDashboard(initialUpdatedAt: string | null = null): LiveDashboardState {
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

    function schedule(delayMs: number = POLL_INTERVAL_MS): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, delayMs);
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

    // ⚠️ اولین فچ هرگز «همین حالا» نیست — داده‌ی رندر سرور تازه است و فچ
    // فوری فقط یک درخواست اضافه به مبدأ می‌زند (بند ۱۴). ولی یک بازه‌ی کامل
    // هم نیست: روی باقی‌مانده‌ی چرخه‌ی گردآورنده می‌نشیند تا با فتیله هم‌فاز
    // شود (توضیح `firstDelayMs`).
    schedule(firstDelayMs(initialUpdatedAt));
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // مقدار سرور است و در طول عمر صفحه عوض نمی‌شود، پس عملاً یک‌بار اجراست؛
    // اگر روزی عوض شد، ری‌ست تایمر رفتار درست است نه عارضه.
  }, [initialUpdatedAt]);

  return { data, failed, tick, refreshNow: () => fetchRef.current() };
}
