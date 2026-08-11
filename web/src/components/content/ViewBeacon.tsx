/**
 * فرستنده‌ی بازدید پست — تنها جایی که شمارنده صدا زده می‌شود.
 *
 * چرا از مرورگر و نه در رندر سرور: HTML صفحه در لبه‌ی آروان کش می‌شود، پس
 * شمارش سمت سرور فقط cache-miss ها را می‌دید (دلیل کامل در `lib/views.ts`).
 *
 * سه فیلتر ساده، بدون کوکی و بدون هیچ داده‌ی شخصی:
 *
 * ۱. **مکث ۳ ثانیه‌ای در حالت مرئی.** رد شدن سریع و بیشتر خزنده‌ها شمرده
 *    نمی‌شوند. تب پنهان اصلاً تایمر را شروع نمی‌کند.
 * ۲. **یک‌بار در هر نشست تب** (`sessionStorage`). رفرش یا برگشت با دکمه‌ی
 *    back دوباره نمی‌شمارد. `sessionStorage` کوکی نیست، به سرور نمی‌رود و
 *    با بستن تب پاک می‌شود.
 * ۳. **رد کردن مرورگر خودکار** (`navigator.webdriver`).
 *
 * عدد نتیجه یک تخمین صادقانه است، نه آمار دقیق — و فقط برای *ترتیب دادن*
 * پست‌ها استفاده می‌شود، نه نمایش عدد. اگر روزی عدد را نشان دادیم، باید
 * صریح بگوییم تخمینی است.
 */
import { useEffect } from "react";

const DWELL_MS = 3000;

export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.webdriver) return;

    const key = `tablo:viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key) !== null) return;
    } catch {
      // sessionStorage در حالت خصوصی بعضی مرورگرها throw می‌کند —
      // نبودش نباید چیزی بشکند؛ فقط محافظ تکرار را از دست می‌دهیم.
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        /* بی‌اهمیت — بالا توضیح داده شد */
      }
      const body = JSON.stringify({ slug });
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon("/api/post-view", blob)) {
        // sendBeacon در دسترس نبود یا صف پر بود ⟸ تلاش دوم، بی‌سروصدا.
        void fetch("/api/post-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* شمارنده هرگز نباید به کاربر خطا نشان دهد */
        });
      }
    };

    const start = () => {
      if (timer !== null || document.visibilityState !== "visible") return;
      timer = setTimeout(send, DWELL_MS);
    };

    const stop = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    };

    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slug]);

  return null;
}
