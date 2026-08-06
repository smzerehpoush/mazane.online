/**
 * چیپ‌های بالای صفحه — پنج سکوی ثابت نمودار با قیمت مرجع خودشان.
 *
 * سروررندر است و هیچ fetch کلاینتی ندارد: خزنده باید همان اول عددها را
 * ببیند (اولویت سئو). عددها انتخاب‌شده در `home-view` اند، نه محاسبه.
 */
import type { ChartPlatformView } from "./home-view";
import { toman } from "@/lib/site-content";

const TAG_FA: Record<ChartPlatformView["state"], string | null> = {
  effective: null,
  // کارمزدش را اعلام نکرده ⟸ تنها عددش اسمی است، نه مؤثر (قاعده‌ی جعل‌نکردن).
  nominal: "اسمی",
  // هنوز هیچ داده‌ای نداریم (سکوی تازه‌باز) — صفحه نمی‌شکند، فقط محو می‌ماند.
  "coming-soon": "به‌زودی",
};

export function PriceChips({ platforms }: { platforms: ChartPlatformView[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {platforms.map((platform) => {
        const dim = platform.state === "coming-soon";
        const tag = TAG_FA[platform.state];
        return (
          <div
            key={platform.slug}
            data-platform-chip={platform.slug}
            className={`glass-surface transition-smooth flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 hover:-translate-y-0.5 hover:shadow-lift ${
              dim ? "opacity-55" : ""
            }`}
          >
            <span
              className="size-2 rounded-full"
              style={{
                backgroundColor: platform.color,
                boxShadow: `0 0 10px ${platform.color}`,
              }}
            />
            <span className="text-xs font-medium">{platform.name}</span>
            {tag !== null && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {tag}
              </span>
            )}
            {platform.latestToman !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {toman(platform.latestToman)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
