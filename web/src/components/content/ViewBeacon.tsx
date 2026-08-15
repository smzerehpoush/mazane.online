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
      // Some browsers throw on sessionStorage in private mode. Its absence
      // must not break anything; we only lose the duplicate-submission guard.
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        /* Irrelevant — explained above. */
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
          /* The counter must never show an error to the user. */
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
