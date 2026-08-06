/**
 * ⚠️ داده‌ی موقتی — جای‌نگه‌دار تا وقتی صفحه به داده‌ی واقعی وصل شود.
 *
 * هیچ‌کدام از اعداد این فایل واقعی نیستند و **هیچ‌کدام نباید منتشر بمانند**.
 * مسیر جایگزینی:
 *   نمودار و چیپ‌ها ⟸ `@/lib/server/history-source` (hourly_rollups)
 *   جدول و کارت‌ها   ⟸ `@/lib/server/price-source` (ردیس، اعداد گردآورنده)
 *   پست‌ها           ⟸ `@/lib/server/blog-source` (پستگرس)
 *
 * ثابت‌های واقعی سایت (برند، ناوبری، یادداشت حقوقی، fa()، toman()، پیکربندی
 * نمودار) از اینجا رفته‌اند به `@/lib/site-content` و همان‌جا می‌مانند.
 *
 * ⚠️ `PlatformId` های زیر اسلاگ واقعی سکو **نیستند** (اسلاگ‌های درست در
 * `CHART_PLATFORMS` اند: milli، melligold، talasea، tlyn، wallgold).
 */
import { fa, toman } from "@/lib/site-content";

export { fa, toman };

export const showSidebar = true;

export type PlatformId = "mili" | "meligold" | "talasi" | "talain" | "wallgold";

export interface ChartPlatform {
  id: PlatformId;
  name: string;
  color: string;
  /** Rendered faded (coming soon) */
  dim?: boolean;
  /** Small chip label, e.g. اسمی / به‌زودی */
  tag?: string;
  /** Hidden price on chip (coming soon platforms) */
  hidePrice?: boolean;
  /** Offset from the base price for the mock series */
  offset: number;
}

export const chartPlatforms: ChartPlatform[] = [
  { id: "mili", name: "میلی", color: "#1d6fe0", offset: 40_000 },
  { id: "meligold", name: "ملی‌گلد", color: "#0bb0d4", tag: "اسمی", offset: -50_000 },
  { id: "talasi", name: "طلاسی", color: "#9b8ce8", dim: true, tag: "به‌زودی", hidePrice: true, offset: 20_000 },
  { id: "talain", name: "طلاین", color: "#12a06a", offset: -20_000 },
  { id: "wallgold", name: "وال‌گلد", color: "#e0921d", offset: 50_000 },

];

const BASE_PRICE = 12_000_000;
const POINTS = 150;

/** Deterministic pseudo-random so SSR and client render identically. */
function noise(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

export interface ChartPoint {
  t: number;
  label: string;
  mili: number;
  meligold: number;
  talasi: number;
  talain: number;
  wallgold: number;
}

function buildSeries(): ChartPoint[] {
  const points: ChartPoint[] = [];
  const walks: Record<PlatformId, number> = {
    mili: 0,
    meligold: 0,
    talasi: 0,
    talain: 0,
    wallgold: 0,
  };

  for (let i = 0; i < POINTS; i++) {
    const minutes = Math.round((i * 24 * 60) / (POINTS - 1));
    const hh = Math.floor(minutes / 60) % 24;
    const mm = minutes % 60;
    const drift = Math.sin(i / 26) * 26_000 + Math.sin(i / 9.5) * 9_000;

    chartPlatforms.forEach((p, idx) => {
      walks[p.id] += noise(i * 7 + idx * 101) * 9_000;
      walks[p.id] *= 0.97;
    });

    points.push({
      t: i,
      label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      mili: Math.round(BASE_PRICE + 40_000 + drift + walks.mili),
      meligold: Math.round(BASE_PRICE - 50_000 + drift * 0.9 + walks.meligold),
      talasi: Math.round(BASE_PRICE + 20_000 + drift * 1.05 + walks.talasi),
      talain: Math.round(BASE_PRICE - 20_000 + drift * 0.95 + walks.talain),
      wallgold: Math.round(BASE_PRICE + 50_000 + drift * 1.1 + walks.wallgold),
    });
  }
  return points;
}

export const chartSeries: ChartPoint[] = buildSeries();

const lastPoint = chartSeries[chartSeries.length - 1] as ChartPoint;

export const latestPrices: Record<PlatformId, number> = {
  mili: lastPoint.mili,
  meligold: lastPoint.meligold,
  talasi: lastPoint.talasi,
  talain: lastPoint.talain,
  wallgold: lastPoint.wallgold,
};

export interface TableRow {
  name: string;
  buy: number;
  sell: number;
  /** No fee: single number shown in both columns */
  noFee?: boolean;
  badge?: string;
}

export const tableRows: TableRow[] = [
  { name: "میلی", buy: 12_038_400, sell: 11_902_000 },
  { name: "ملی‌گلد", buy: 11_951_000, sell: 11_951_000, noFee: true },
  { name: "طلاین", buy: 11_984_500, sell: 11_856_300 },
  { name: "وال‌گلد", buy: 12_061_200, sell: 11_918_700 },
  { name: "داریک", buy: 11_929_800, sell: 11_924_500, badge: "دفتر سفارش" },
  { name: "تکنوگلد", buy: 12_012_600, sell: 11_871_400 },
  { name: "اکوگلد", buy: 12_045_900, sell: 11_889_200 },
  { name: "زرافزا", buy: 11_997_300, sell: 11_863_800 },
  { name: "بازر", buy: 12_074_500, sell: 11_845_100 },
  { name: "دیجی‌کالا", buy: 12_026_000, sell: 12_026_000, noFee: true },
  { name: "همراه‌گلد", buy: 12_053_700, sell: 11_907_600 },
  { name: "گلدیکا", buy: 11_968_400, sell: 11_881_900 },
  { name: "اینوی", buy: 12_089_100, sell: 11_836_500 },
];

export const latestPosts = [
  { title: "چرا اختلاف قیمت طلا میان سکوها گاهی به ۱ درصد می‌رسد؟", date: "۱۵ مرداد ۱۴۰۵" },
  { title: "کارمزد پنهان در خرید طلای آب‌شده را چطور پیدا کنیم", date: "۱۲ مرداد ۱۴۰۵" },
  { title: "دفتر سفارش در برابر قیمت‌گذاری لحظه‌ای؛ کدام به سود شماست؟", date: "۸ مرداد ۱۴۰۵" },
  { title: "راهنمای کوتاه فروش طلای دیجیتال بدون ضرر اسپرد", date: "۳ مرداد ۱۴۰۵" },
];

export const popularPosts = [
  {
    title: "قیمت واقعی هر گرم طلای ۱۸ عیار چگونه محاسبه می‌شود؟",
    summary:
      "از مظنه‌ی مثقال بازار تا قیمت نهایی هر گرم، تمام ضریب‌ها و کسری‌هایی را که سکوها روی نرخ اعمال می‌کنند مرور می‌کنیم.",
    views: 2483,
  },
  {
    title: "اسپرد خرید و فروش؛ هزینه‌ای که کمتر کسی حساب می‌کند",
    summary:
      "فاصله‌ی قیمت خرید و فروش در هر سکو یعنی زیان لحظه‌ی ورود. با یک مثال ساده نشان می‌دهیم این عدد چقدر اهمیت دارد.",
    views: 1907,
  },
  {
    title: "پنج نکته پیش از نخستین خرید طلای آنلاین",
    summary:
      "از بررسی مجوز و انبار فیزیکی تا امکان تحویل و بازخرید؛ فهرستی کوتاه که پیش از ثبت سفارش باید کنترل کنید.",
    views: 1542,
  },
];
