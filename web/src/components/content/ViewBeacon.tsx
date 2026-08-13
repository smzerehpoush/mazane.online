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
