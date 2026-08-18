import { summarizeHistoryRange, type SummaryRange } from "./dashboard";
import { formatFaNumber } from "./fa-number";
import type { HistoryPoint, HistoryRange, PlatformHistoryByRange } from "./history";
import type { ReferencePrice } from "./reference-price";
import { MARKET_REFERENCE_SOURCE_NAME, RATE_CARD_RANGES } from "./site-content";
import type { FaqItem } from "./structured-data";

export const GOLD_PRICE_INSTRUMENT = "GOLD_18K";

export const GOLD_PRICE_RANGE_LABELS: Readonly<Record<HistoryRange, string>> = {
  DAILY: "۲۴ ساعت گذشته",
  WEEKLY: "هفته‌ی گذشته",
  MONTHLY: "ماه گذشته",
};

export interface GoldPriceView {
  priceDisplay: string | null;
  readAt: string | null;
  /**
   * ⚠️ `true` means the headline number is the last **hourly archive** point,
   * not a live read. Rendering it is allowed only next to the staleness
   * label — without that label an hourly aggregate quietly passes itself off
   * as "the price right now".
   */
  fromArchive: boolean;
  referenceName: string;
  ranges: SummaryRange[];
}

export interface GoldPriceInput {
  reference: ReferencePrice | null;
  history: PlatformHistoryByRange;
  referenceName?: string;
}

function lastPointOf(history: PlatformHistoryByRange): HistoryPoint | null {
  for (const range of RATE_CARD_RANGES) {
    const points = history[range.key]?.points ?? [];
    const last = points[points.length - 1];
    if (last !== undefined) return last;
  }
  return null;
}

export function buildGoldPriceView(input: GoldPriceInput): GoldPriceView {
  const ranges = RATE_CARD_RANGES.map((range) => {
    const summary = summarizeHistoryRange(
      { key: range.key, label: GOLD_PRICE_RANGE_LABELS[range.key] },
      input.history[range.key],
    );
    return { ...summary, enabled: summary.enabled && summary.hasEnoughCoverage };
  });

  const archived = input.reference === null ? lastPointOf(input.history) : null;
  const value = input.reference?.value ?? archived?.value ?? null;

  return {
    priceDisplay: value === null ? null : formatFaNumber(value),
    readAt: input.reference?.read_at ?? archived?.hour ?? null,
    fromArchive: input.reference === null && archived !== null,
    referenceName: input.referenceName ?? MARKET_REFERENCE_SOURCE_NAME,
    ranges,
  };
}

export const GOLD_PRICE_QUESTION = "قیمت طلا امروز چقدر است؟";

export const GOLD_PRICE_TITLE = "قیمت طلا امروز؛ نرخ لحظه‌ای هر گرم طلای ۱۸ عیار — تابلو";

export const GOLD_PRICE_DESCRIPTION =
  "قیمت امروز هر گرم طلای ۱۸ عیار به نرخ مرجع tala.ir، همراه با تغییر ۲۴ ساعت، هفته و ماه گذشته و نرخ اعلامی سکوهای آنلاین با کارمزد خرید و فروش هرکدام.";

export const GOLD_PRICE_LABELS = {
  priceCaption: "نرخ هر گرم طلای ۱۸ عیار",
  referencePrefix: "مرجع:",
  archiveNote: "این عدد از آخرین ثبت آرشیو ساعتی می‌آید، نه از خواندن تازه.",
  unavailable: "نرخ مرجع در دسترس نیست",
  unavailableNote:
    "خواندن نرخ مرجع همین حالا ممکن نشد. جدول سکوها پایین‌تر سر جایش است و نرخ مرجع به‌محض رسیدن داده‌ی تازه برمی‌گردد.",
  chartHeading: "روند نرخ مرجع",
  chartRangeLabel: "بازه‌ی نمودار",
  emptyChart: "برای این بازه هنوز سابقه‌ی کافی ثبت نشده است.",
  changeHeading: "تغییر قیمت طلا",
  changeMissing: "داده‌ی کافی ثبت نشده",
  high: "بالاترین",
  low: "پایین‌ترین",
  yearlyHeading: "نسبت به سال گذشته",
  yearlyBody:
    "این عدد نوشته نمی‌شود، چون داده‌اش را نداریم. آرشیو قیمت تابلو به یک سال پیش نمی‌رسد و بلندترین بازه‌ای که برایش سابقه‌ی واقعی داریم یک ماه است. عددی که پشتش داده نباشد ساخته نمی‌شود، حتی وقتی جای خالی‌اش در صفحه پیداست.",
} as const;

export interface GoldPriceSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  formula?: string;
  link?: { href: string; label: string };
}

export const GOLD_PRICE_SECTIONS: readonly [GoldPriceSection, GoldPriceSection, GoldPriceSection] =
  [
    {
      id: "gold-price-source",
      heading: "قیمت طلا امروز از کجا می‌آید؟",
      paragraphs: [
        "عدد بالای صفحه نرخ هر گرم طلای ۱۸ عیار به گزارش tala.ir است و ساعت ثبتش کنار خودش نوشته شده. tala.ir سکوی خرید و فروش نیست و به همین دلیل مرجع این صفحه شد؛ اگر مرجع یکی از فروشنده‌ها بود، معیار سنجش بازار هم دست فروشنده می‌افتاد.",
        "تابلو خودش هیچ قیمتی نمی‌سازد و بین سکوها میانگین نمی‌گیرد. پایین‌تر، نرخی که هر سکوی آنلاین برای همان یک گرم اعلام کرده با نام خودش آمده تا فاصله‌شان با نرخ مرجع و با یکدیگر دیده شود. کارمزد خرید و فروش هم ستون جدا دارد و داخل قیمت پخته نشده است.",
      ],
      link: { href: "/methodology", label: "روش خواندن و ثبت قیمت‌ها در تابلو" },
    },
    {
      id: "gold-price-drivers",
      heading: "چرا قیمت طلا تغییر می‌کند؟",
      paragraphs: [
        "نرخ گرم طلا در ایران روی دو پایه‌ی بیرونی سوار است: انس جهانی طلا که به دلار معامله می‌شود و نرخ دلار در بازار داخلی. تکان خوردن هرکدام همان روز خودش را در قیمت گرم نشان می‌دهد و وقتی هر دو در یک جهت حرکت کنند، تغییر بزرگ‌تر از حد انتظار درمی‌آید.",
        "پایه‌ی سوم خود بازار داخلی است. در روزهای پرخبر تقاضای خرید بالا می‌رود و قیمت معامله از ارزش فلزِ داخل قطعه فاصله می‌گیرد؛ به این فاصله حباب می‌گویند. برای همین نرخ صبح و عصر یک روز هم می‌تواند یکی نباشد و هر عددی که تابلو ثبت می‌کند ساعت خودش را همراه دارد.",
      ],
    },
    {
      id: "gold-price-formula",
      heading: "قیمت طلای ۱۸ عیار چگونه محاسبه می‌شود؟",
      paragraphs: [
        "۱۸ عیار یعنی از هر هزار واحد وزن قطعه، ۷۵۰ واحدش طلای خالص است؛ همان ضریب ۰٫۷۵. وزن یک انس تروا هم ۳۱٫۱۰۳ گرم است، پس ارزش فلزِ یک گرم را می‌شود مستقیم از انس جهانی و نرخ دلار بیرون کشید:",
        "این عدد ارزش خود فلز است، نه قیمتی که در بازار رد و بدل می‌شود. قیمت معامله می‌تواند از آن بالاتر یا پایین‌تر بنشیند و اختلافشان همان حباب است. روی طلای ساخته‌شده هم اجرت ساخت، سود فروشنده و مالیات بر ارزش افزوده اضافه می‌شود که هیچ‌کدام جزو نرخ گرم نیستند.",
      ],
      formula: "ارزش هر گرم ۱۸ عیار = انس جهانی (دلار) × نرخ دلار (تومان) × ۰٫۷۵ ÷ ۳۱٫۱۰۳",
      link: { href: "/mohasebe-tala", label: "محاسبه‌ی اجرت، سود و مالیات طلای زینتی" },
    },
  ];

export const GOLD_PRICE_FAQ_HEADING = "پرسش‌های پرتکرار درباره‌ی قیمت طلا";

export const GOLD_PRICE_FAQ: readonly FaqItem[] = [
  {
    question: "قیمت طلا امروز چقدر است؟",
    answer:
      "عدد بالای همین صفحه نرخ هر گرم طلای ۱۸ عیار به گزارش tala.ir است و ساعت ثبتش کنارش نوشته شده. اگر داده‌ی تازه نرسیده باشد، به‌جای نمایش عدد قدیمی به‌عنوان نرخ قطعی، برچسب کهنگی کنار همان عدد می‌آید.",
  },
  {
    question: "قیمت طلا نسبت به دیروز چقدر تغییر کرده است؟",
    answer:
      "ردیف «۲۴ ساعت گذشته» در جدول تغییرات همین را می‌گوید: اختلاف نرخ مرجع الان با نرخ همان مرجع در ابتدای بازه، یک بار به تومان و یک بار به درصد. مبنای مقایسه یک سری زمانی واحد از tala.ir است، نه ترکیب چند منبع.",
  },
  {
    question: "چرا تغییر قیمت طلا نسبت به سال گذشته نوشته نشده است؟",
    answer:
      "چون داده‌اش را نداریم. آرشیو قیمت تابلو به یک سال پیش نمی‌رسد و بلندترین بازه‌ای که برایش سابقه‌ی واقعی داریم یک ماه است. عددی که پشتش داده نباشد ساخته نمی‌شود.",
  },
  {
    question: "چرا قیمت طلای ۱۸ عیار در سکوهای مختلف یکی نیست؟",
    answer:
      "هر سکو قیمتش را خودش اعلام می‌کند و مبنای داخلی، موجودی و سیاست قیمت‌گذاری‌اش با بقیه فرق دارد. جدول پایین صفحه نرخ اعلامی هر سکو را با نام خودش می‌آورد و کارمزد خرید و فروش هم جدا از قیمت در ستون بعدی می‌نشیند.",
  },
  {
    question: "قیمت هر گرم طلای ۱۸ عیار چطور حساب می‌شود؟",
    answer:
      "۱۸ عیار یعنی ۷۵۰ هزارم وزن قطعه طلای خالص است. ارزش فلز هر گرم از این رابطه درمی‌آید: انس جهانی ضرب در نرخ دلار، ضرب در ۰٫۷۵، تقسیم بر ۳۱٫۱۰۳ که وزن یک انس تروا به گرم است. قیمت معامله می‌تواند از این عدد بالاتر یا پایین‌تر باشد و اختلافشان حباب نام دارد.",
  },
  {
    question: "قیمت این صفحه هر چند وقت به‌روز می‌شود؟",
    answer:
      "نرخ‌ها هر ۳۰ ثانیه یک بار خوانده می‌شوند و زمان ثبت هر عدد کنار خودش نوشته می‌شود. اگر خواندن قطع شود صفحه خطا نمی‌دهد؛ همان عدد قبلی با برچسب کهنگی می‌ماند تا معلوم باشد داده تازه نیست.",
  },
  {
    question: "تابلو خودش طلا می‌فروشد؟",
    answer:
      "نه. تابلو نه طلا می‌فروشد، نه معامله‌گر است و نه مشاور سرمایه‌گذاری. درآمدش از لینک‌های معرفی سکوهاست و این کمیسیون در ترتیب نمایش جدول اثری ندارد؛ ترتیب فقط بر پایه‌ی قیمت اعلامی هر سکوست.",
  },
];
