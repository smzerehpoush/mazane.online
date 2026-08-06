import type { NextConfig } from "next";

/**
 * هدر CDN صفحه‌ی اصلی ISR — بند ۶.۲ (تصمیم قطعی رندر):
 *
 *     Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 *
 * دو مکانیزم عمداً با هم و هم‌مقدارند:
 *
 * - ‎expireTime: 360‎ — هدری که خود نکست برای صفحات ISR می‌سازد را تنظیم
 *   می‌کند: ‎s-maxage = revalidate‎ و ‎stale-while-revalidate = expireTime − revalidate‎؛
 *   با ‎revalidate = 60‎ صفحه‌ی اصلی یعنی ‎s-maxage=60, stale-while-revalidate=300‎
 *   (بدون ‎public‎ — نکست این directive را نمی‌گذارد).
 * - ‎headers()‎ برای ‎/‎ همان مقدار را با ‎public‎ صریح می‌گذارد. روی نسخه‌ی
 *   فعلی (15.5.x) با ‎next start‎ تأیید عملی شد که این مقدار دست‌نخورده سرو
 *   می‌شود؛ مستندات نکست هشدار می‌دهد که Cache-Control دستی برای خروجی
 *   ISR ممکن است در نسخه‌های دیگر بازنویسی شود — اگر شد، fallback همان هدر
 *   expireTime است که فقط ‎public‎ را کم دارد و برای کش اشتراکی هم‌معناست
 *   (وجود ‎s-maxage‎ خودش پاسخ را برای کش اشتراکی قابل‌کش می‌کند).
 *
 * ⚠️ این دو باید با ‎revalidate‎ صفحه هم‌ساز بمانند: تغییر revalidate بدون
 * به‌روزکردن این‌جا یعنی هدر دروغ می‌گوید.
 */
const nextConfig: NextConfig = {
  // خروجی standalone برای Dockerfile.web (بلیت ۱۱): ساخت بیرون از سرور،
  // اجرای سبک روی سرور تک‌هسته‌ای — پیش‌نیاز ۱.۱ ops/RUNBOOK.md.
  output: "standalone",
  expireTime: 360,
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
