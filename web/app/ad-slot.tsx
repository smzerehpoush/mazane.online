/**
 * جایگاه تبلیغ — بند ۱۳، تصمیم‌های ۹ و ۱۵.
 *
 * ارتفاع در CSS رزرو شده و ثابت است تا آمدن/نیامدن محتوا هرگز layout را
 * جابه‌جا نکند (CLS صفر). تا وقتی تبلیغ فروخته نشده، «پیشنهاد سردبیر»
 * (تحریریه) داخلش می‌نشیند — با لینک به معیارهای علنی انتخاب.
 *
 * قواعد روز فروش (همین‌جا ثبت تا گم نشود):
 *   - برچسب «تبلیغ» به‌جای «پیشنهاد سردبیر»، با همین تفکیک بصری؛
 *   - لینک خروجی فقط با `rel="sponsored nofollow noopener"` (قاعده‌ی ۷ قراردادها)؛
 *   - تبلیغ هرگز بر ترتیب جدول اثر ندارد (تصمیم ۹).
 */
import type { CSSProperties } from "react";

import { formatPercentPointsFa } from "../lib/format";

export const AD_SLOT_HEIGHT_PX = 96;

/**
 * پیشنهاد سردبیر — به قاعده‌ی منتشرشده در ‎/darbare-pishnahad‎ انتخاب شده:
 * کمترین هزینه‌ی رفت‌وبرگشتِ گردآورنده میان سکوهای با کارمزد API و
 * خریدوفروش باز. همه‌ی اعداد از گردآورنده‌اند؛ انتخاب فقط مقایسه است.
 */
export interface EditorialPick {
  slug: string;
  name_fa: string;
  /** همان رشته‌ی round_trip_percent گردآورنده. */
  round_trip_percent: string;
}

const slotStyle: CSSProperties = {
  height: `${AD_SLOT_HEIGHT_PX}px`,
  overflow: "hidden",
  boxSizing: "border-box",
  border: "1px dashed #b8a35a",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
  background: "#faf7ee",
};

export function AdSlot({
  position,
  pick,
}: {
  position: "top" | "bottom";
  pick: EditorialPick | null;
}) {
  return (
    <aside data-ad-slot={position} aria-label="جایگاه تبلیغ" style={slotStyle}>
      <p style={{ margin: 0 }}>
        <strong>پیشنهاد سردبیر</strong>
        {pick === null ? (
          <> — در این لحظه هیچ سکویی واجد معیار انتشار نیست.</>
        ) : (
          <>
            {" — "}
            {/* لینک درآمدزا (بلیت ۹؛ تصمیم ۲۱): فقط از ‎/go/‎ با rel کامل
                بند ۶.۴ — انتخابِ پیشنهاد تحریریه است و از فیلدهای معرف
                هیچ ورودی‌ای نمی‌گیرد (تست CI دارد). */}
            <a
              href={`/go/${pick.slug}`}
              rel="sponsored nofollow noopener"
              target="_blank"
              data-outbound="editorial-pick"
            >
              {pick.name_fa}
            </a>
            : کمترین هزینه‌ی رفت‌وبرگشت (
            {formatPercentPointsFa(pick.round_trip_percent)}) میان سکوهایی که
            کارمزدشان از API خودشان می‌آید و خرید و فروششان باز است.
          </>
        )}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "0.875em" }}>
        <a href="/darbare-pishnahad">معیارهای انتخاب پیشنهاد سردبیر</a>
      </p>
    </aside>
  );
}
