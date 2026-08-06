/**
 * seed مشترک تست‌های بلیت ۸ — همان الگوی home.test.tsx در نسخه‌ی کمینه:
 * منبع داده با ‎setPriceSource‎ تزریق می‌شود؛ هیچ ردیس/شبکه‌ای در کار نیست
 * و اعداد همان شکل JSON کانونی گردآورنده‌اند (مؤثرها از قبل محاسبه شده).
 *
 * این فایل تست نیست (الگوی ‎*.test.*‎ را ندارد) — فقط کمک‌کار مرز وب است.
 */
import {
  setPriceSource,
  type FeeSource,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
  type Side,
} from "../../lib/prices";

export function quote(
  slug: string,
  side: Side,
  priceToman: number,
  fetchedAt: string,
): Quote {
  return {
    platform_slug: slug,
    instrument: "GOLD_18K",
    side,
    price_toman: priceToman,
    raw_value: String(priceToman),
    raw_scale: "1",
    fetched_at: fetchedAt,
  };
}

export function makeSnapshot(opts: {
  slug: string;
  mid: number;
  /** برای fee_source=UNKNOWN نده — گردآورنده برای آن سکوها فقط MID می‌نویسد. */
  buy?: number;
  sell?: number;
  feeSource?: FeeSource;
  fetchedAt?: string;
}): PlatformSnapshot {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
  const feeSource = opts.feeSource ?? "API";
  const unknown = feeSource === "UNKNOWN";
  const quotes: Quote[] = [quote(opts.slug, "MID", opts.mid, fetchedAt)];
  if (!unknown && opts.buy !== undefined) {
    quotes.push(quote(opts.slug, "BUY", opts.buy, fetchedAt));
  }
  if (!unknown && opts.sell !== undefined) {
    quotes.push(quote(opts.slug, "SELL", opts.sell, fetchedAt));
  }
  return {
    platform_slug: opts.slug,
    quotes,
    terms: {
      platform_slug: opts.slug,
      buy_fee_percent: unknown ? null : "0.5",
      sell_fee_percent: unknown ? null : "0.5",
      round_trip_percent: unknown ? null : "0.9950",
      fee_source: feeSource,
      buy_enabled: true,
      sell_enabled: true,
      observed_at: fetchedAt,
    },
    fetched_at: fetchedAt,
    suppressed: false,
  };
}

export const LISTED: ListedPlatform[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" },
  { slug: "talasea", name_fa: "طلاسی", data_policy: "ALLOWED" },
  { slug: "milli", name_fa: "میلی", data_policy: "ALLOWED" },
];

export const DIGIKALA: ListedPlatform = {
  slug: "digikala",
  name_fa: "دیجی‌کالا",
  data_policy: "ALLOWED",
};

export function freshIso(): string {
  return new Date(Date.now() - 30_000).toISOString(); // ۳۰ ثانیه پیش — تازه
}

export function staleIso(): string {
  return new Date(Date.now() - 10 * 60_000).toISOString(); // ۱۰ دقیقه پیش — کهنه
}

export interface SeededStore {
  listed?: ListedPlatform[];
  snapshots: Record<string, PlatformSnapshot | null>;
  updatedAt: Record<string, string | null>;
}

export function seed(store: SeededStore): void {
  setPriceSource({
    getListedPlatforms: async () => store.listed ?? LISTED,
    getSnapshot: async (slug) => store.snapshots[slug] ?? null,
    getUpdatedAt: async (slug) => store.updatedAt[slug] ?? null,
  });
}

/** استور سالم: هر سه سکوی فهرست‌شده تازه + گلدیکا هم در استور (ولی نه در فهرست). */
export function healthyStore(): SeededStore {
  const now = freshIso();
  return {
    snapshots: {
      wallgold: makeSnapshot({ slug: "wallgold", mid: 18611000, buy: 18704055, sell: 18517945, fetchedAt: now }),
      talasea: makeSnapshot({ slug: "talasea", mid: 18530000, buy: 18715300, sell: 18344700, fetchedAt: now }),
      milli: makeSnapshot({ slug: "milli", mid: 18538000, buy: 18630690, sell: 18445310, fetchedAt: now }),
      goldika: makeSnapshot({ slug: "goldika", mid: 18514235, buy: 18736406, sell: 18292064, fetchedAt: now }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now, goldika: now },
  };
}

/** استور سالم + دیجی‌کالا با کارمزد UNKNOWN: فقط MID، بدون هیچ عدد کارمزد. */
export function storeWithUnknownFee(): SeededStore {
  const store = healthyStore();
  const now = freshIso();
  store.listed = [...LISTED, DIGIKALA];
  store.snapshots.digikala = makeSnapshot({
    slug: "digikala",
    mid: 18520000,
    feeSource: "UNKNOWN",
    fetchedAt: now,
  });
  store.updatedAt.digikala = now;
  return store;
}

/** ردیف اصلی یک سکو در HTML رندرشده (تا اولین ‎</tr>‎ — ردیف جزئیات جدا است). */
export function rowOf(html: string, slug: string): string {
  const match = html.match(
    new RegExp(`<tr[^>]*data-platform="${slug}"[\\s\\S]*?</tr>`),
  );
  if (!match) throw new Error(`ردیف ${slug} در HTML نیست`);
  return match[0];
}
