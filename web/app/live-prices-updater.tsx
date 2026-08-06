"use client";

/**
 * به‌روزرسان زنده — بلیت ۸ (بند ۱۳، تصمیم ۱۳: چون ISR شصت‌ثانیه است،
 * polling سی‌ثانیه‌ای کلاینت‌ساید الزامی است).
 *
 * بعد از hydration هر ۳۰ ثانیه ‎GET /api/prices‎ (no-store) را می‌خواند و
 * فقط متن گره‌های نشان‌دار ‎data-live‎ را درجا عوض می‌کند: قیمت، برچسب
 * زمان و پسوند کهنگی. هیچ چیز سئویی دست نمی‌خورد — HTML اولیه، ترتیب
 * ردیف‌ها، دلتاها و داده‌ی ساخت‌یافته (بلیت ۱۰) همه مال رندر ISR اند.
 * اگر ارزان‌ترین سکو بین دو رندر جابه‌جا شود، ترتیب و دلتا تا رندر بعدی
 * ISR (حداکثر ۶۰ ثانیه) قدیمی می‌مانند — انتخاب عمدی و مستند (بند ۶.۲):
 * بازمرتب‌سازی کلاینتی با سمانتیک ترتیبِ سروررندر تناقض دارد.
 *
 * منطق سوآپ تابع خالص ‎lib/live-update.ts‎ است؛ اینجا فقط خواندن/نوشتن DOM.
 * خطای شبکه یا payload بی‌قیمت ⟸ مقادیر قبلی می‌مانند (کهنگی، نه خطا).
 */
import { useEffect } from "react";

import {
  nextRowDomState,
  type LivePriceRow,
  type LivePricesPayload,
} from "../lib/live-update";

const POLL_INTERVAL_MS = 30_000;

function applyPayloadToDom(payload: LivePricesPayload, nowMs: number): void {
  const bySlug = new Map<string, LivePriceRow>(
    payload.rows.map((row) => [row.platform_slug, row]),
  );
  for (const tr of document.querySelectorAll<HTMLElement>("tr[data-platform]")) {
    const slug = tr.getAttribute("data-platform");
    if (slug === null) continue;
    const priceEl = tr.querySelector<HTMLElement>('[data-live="price"]');
    const timeEl = tr.querySelector<HTMLElement>('[data-live="updated-at"]');
    const staleEl = tr.querySelector<HTMLElement>('[data-live="stale"]');
    const current = {
      priceText: priceEl?.textContent ?? "",
      updatedAtIso: timeEl?.getAttribute("datetime") ?? null,
      updatedText: timeEl?.textContent ?? "",
      staleText: staleEl?.textContent ?? "",
    };
    const next = nextRowDomState(current, bySlug.get(slug), nowMs);
    if (priceEl !== null && next.priceText !== current.priceText) {
      priceEl.textContent = next.priceText;
    }
    if (timeEl !== null && next.updatedAtIso !== null) {
      if (next.updatedAtIso !== current.updatedAtIso) {
        timeEl.setAttribute("datetime", next.updatedAtIso);
      }
      if (next.updatedText !== current.updatedText) {
        timeEl.textContent = next.updatedText;
      }
    }
    if (staleEl !== null && next.staleText !== current.staleText) {
      staleEl.textContent = next.staleText;
    }
  }
}

/** هیچ خروجی HTML ندارد — فقط اثر جانبی روی گره‌های data-live بعد از hydration. */
export function LivePricesUpdater() {
  useEffect(() => {
    let cancelled = false;

    async function tick(): Promise<void> {
      let payload: LivePricesPayload;
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok) return;
        payload = (await response.json()) as LivePricesPayload;
      } catch {
        return; // قطع شبکه ⟸ اعداد قبلی می‌مانند؛ رندر بعدی ISR جبران می‌کند
      }
      if (cancelled) return;
      applyPayloadToDom(payload, Date.now());
    }

    // اولین خواندن بلافاصله: HTML کش‌شده‌ی ISR ممکن است تا ۶۰ ثانیه کهنه باشد.
    void tick();
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
