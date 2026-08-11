/**
 * نشاندن داده‌ی زنده روی داشبورد — جانشین `live-prices-updater` صفحه‌ی اصلی.
 *
 * ⚠️ **چرا DOM مستقیم و نه state ری‌اکت**: نشانگر محور باید با ترنزیشن ۸۰۰
 * میلی‌ثانیه‌ای بلغزد (بند ۵). اگر موقعیت از state بیاید، هر آپدیت یک رندر
 * تازه‌ی درخت است و کوچک‌ترین تغییر در `key` یا ترتیب، گره را re-mount می‌کند و
 * ترنزیشن می‌میرد — دقیقاً همان خرابی‌ای که «کد سالم به نظر می‌رسد».
 * نوشتن مستقیم روی `style.right` گره‌ی موجود، این ریسک را از بین می‌برد و
 * ضمناً هیچ re-render سراسری‌ای در چرخه‌ی ۳۰ ثانیه‌ای رخ نمی‌دهد.
 *
 * ⚠️ **هیچ محاسبه یا قالب‌بندی‌ای اینجا نیست** (قاعده‌ی سخت ۱ و بند ۱۴):
 * `rail_percent` و `price_display` از قبل سمت سرور ساخته شده‌اند
 * (`lib/dashboard.ts`، همان تابعی که رندر اولیه را ساخت). این جزء فقط
 * می‌نشاندشان.
 *
 * ⚠️ **فلش آپدیت** (بند ۶): جهت رنگ از تغییر قیمت **خودِ همان منبع** نسبت به
 * مقدار قبلی‌اش می‌آید — نه مقایسه با منبع دیگر. هیچ عددی منتشر نمی‌شود، پس
 * با تصمیم ۳ (حذف درصد اختلاف) تناقضی ندارد.
 */
import { useEffect, useRef } from "react";

import type { LiveDashboard } from "@/lib/live-update";

const FLASH_MS = 900;

function setText(root: ParentNode, selector: string, value: string | null): void {
  if (value === null) return;
  const element = root.querySelector<HTMLElement>(selector);
  if (element !== null && element.textContent !== value) element.textContent = value;
}

export function DashboardLive({ data }: { data: LiveDashboard | null }) {
  /** آخرین قیمت هر سکو — مبنای جهت فلش. */
  const previousPrices = useRef(new Map<string, number>());

  useEffect(() => {
    if (data === null) return;

    for (const source of data.sources) {
      // ── نشانگر محور: فقط مقدار CSS، بدون هیچ دست‌کاری ساختار ──────────
      const marker = document.querySelector<HTMLElement>(
        `[data-rail-marker="${CSS.escape(source.slug)}"]`,
      );
      if (marker !== null && source.rail_percent !== null) {
        marker.style.right = `${source.rail_percent}%`;
        const stem = marker.querySelector<HTMLElement>("[data-rail-stem]");
        if (stem !== null) stem.style.height = `${source.stem_long ? 38 : 10}px`;
        setText(marker, "[data-rail-price]", source.price_display);
      }

      // ── کارت منبع: قیمت + فلش ─────────────────────────────────────────
      const card = document.querySelector<HTMLElement>(
        `[data-source-card="${CSS.escape(source.slug)}"]`,
      );
      if (card === null) continue;
      setText(card, "[data-source-price]", source.price_display);

      const previous = previousPrices.current.get(source.slug);
      if (source.price_toman !== null) {
        if (previous !== undefined && previous !== source.price_toman) {
          // گران‌تر شد ⟸ قرمز، ارزان‌تر شد ⟸ سبز. برعکسِ شهود بازار سهام،
          // چون اینجا کاربر **خریدار** است: قیمت پایین‌تر خبر خوب اوست.
          card.style.backgroundColor =
            source.price_toman > previous ? "var(--rdbg)" : "var(--gnbg)";
          window.setTimeout(() => {
            card.style.backgroundColor = "";
          }, FLASH_MS);
        }
        previousPrices.current.set(source.slug, source.price_toman);
      }
    }

    // ── پاورقی محور ────────────────────────────────────────────────────
    const max = document.querySelector<HTMLElement>("[data-rail-max]");
    if (max !== null && data.max_display !== null) {
      max.textContent = `گران‌تر · ${data.max_display}`;
    }
    const min = document.querySelector<HTMLElement>("[data-rail-min]");
    if (min !== null && data.min_display !== null) {
      min.textContent = `${data.min_display} · ارزان‌تر`;
    }
    const spread = document.querySelector<HTMLElement>("[data-rail-spread]");
    if (spread !== null && data.spread_display !== null) {
      spread.textContent = `بازه اختلاف ${data.spread_display} تومان`;
    }

    // ── لنگر مرجع ──────────────────────────────────────────────────────
    if (data.reference_percent !== null) {
      for (const anchor of document.querySelectorAll<HTMLElement>(".rail-anchor")) {
        anchor.style.right = `${data.reference_percent}%`;
      }
    }
  }, [data]);

  return null;
}
