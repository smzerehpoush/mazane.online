/**
 * ⚠️ خودِ این هوک هیچ DOM ای دست نمی‌زند و هیچ چیزی رندر نمی‌کند — فقط
 * وضعیت. نشاندن مقادیر روی گره‌ها کار `DashboardLive` است.
 */
import { useEffect, useRef, useState } from "react";

import type { LiveDashboard, LivePricesPayload } from "./live-update";

export const POLL_INTERVAL_MS = 30_000;

export interface LiveDashboardState {
  data: LiveDashboard | null;
  failed: boolean;
  tick: number;
  refreshNow: () => void;
}

const MIN_FIRST_DELAY_MS = 1_000;

/**
 * ⚠️ چرا مهم است: فاز فتیله به `updatedAt` **سرور** قفل است، ولی اگر اولین
 * فچ ۳۰ ثانیه بعد از mount باشد این دو هرگز روی هم نمی‌افتند. صفحه‌ای که ۵
 * ثانیه بعد از `updatedAt` هیدریت شود، فتیله‌اش هر دور ۵ ثانیه **زودتر** از
 * رسیدن داده تمام می‌شود و چون `infinite` است دوباره پر می‌شود — خطا هرگز
 * جبران نمی‌شود و («فتیله دقیقاً هم‌زمان با دریافت داده تمام می‌شود»)
 * برای همیشه نقض می‌ماند. با تنظیم اولین فچ روی باقی‌مانده‌ی همان چرخه، هر دو
 * ساعت روی یک فاز می‌نشینند و بعد از آن هم‌قدم می‌مانند.
 */
export function firstDelayMs(updatedAt: string | null, nowMs: number = Date.now()): number {
  if (updatedAt === null) return POLL_INTERVAL_MS;
  const elapsed = nowMs - new Date(updatedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return POLL_INTERVAL_MS;
  return Math.max(MIN_FIRST_DELAY_MS, POLL_INTERVAL_MS - (elapsed % POLL_INTERVAL_MS));
}

/**
 * ⚠️ `initialUpdatedAt` زمان داده‌ی رندر سرور است و **فقط** فاز اولین فچ را
 * تعیین می‌کند: پولینگ باید با چرخه‌ی گردآورنده همگام شود نه با لحظه‌ی
 * hydration. عمداً از `data` داخلی خوانده نمی‌شود چون تا اولین
 * دریافت موفق، تنها زمانی که داریم همان است.
 */
export function useLiveDashboard(initialUpdatedAt: string | null = null): LiveDashboardState {
  const [data, setData] = useState<LiveDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

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
        if (payload.dashboard !== undefined) {
          setData(payload.dashboard);
          setTick((value) => value + 1);
        }
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    function schedule(delayMs: number = POLL_INTERVAL_MS): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, delayMs);
    }

    async function run(): Promise<void> {
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
      void run();
    }

    // ⚠️ اولین فچ هرگز «همین حالا» نیست — داده‌ی رندر سرور تازه است و فچ
    // فوری فقط یک درخواست اضافه به مبدأ می‌زند. ولی یک بازه‌ی کامل
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
