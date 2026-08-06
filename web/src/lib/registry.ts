/**
 * رجیستری ایستای صفحه‌ها — «کدام نشانی وجود دارد» در زمان **بیلد**، نه در
 * زمان اجرا.
 *
 * ## چرا این فایل هست
 *
 * هویت یک صفحه با قیمتِ آن یکی نیست. قیمت زنده است و از ردیس می‌آید؛ ولی
 * «وال‌گلد یک سکوی ماست» و «طلای ۱۸ عیار صفحه دارد» فراداده‌ی ثابت است که
 * فقط با دیپلوی عوض می‌شود (منبع حقیقتش رجیستری کد گردآورنده است:
 * `collector/src/mazane_collector/platforms.py` و `instruments.py`).
 *
 * وقتی این دو به هم گره می‌خوردند، قطع ردیس صفحه‌ها را ۴۰۴ می‌کرد — نقض
 * مستقیم قاعده‌ی ۵ قراردادها («قطع منبع ⟸ کهنگی، نه خطا») و بدتر از آن،
 * ۴۰۴ کش‌شدنی که لبه‌ی آروان دقایقی پس از برگشت ردیس هم تکرارش می‌کند
 * (‎stale-if-error‎ نجات نمی‌دهد: طبق RFC 5861 فقط ۵xx را پوشش می‌دهد).
 *
 * پس هویت صفحه از اینجا می‌آید و قیمت از ردیس. اسلاگ **ناشناخته** همچنان
 * ۴۰۴ می‌ماند — این درست است و باید بماند.
 *
 * ## قواعدی که این فایل نقض نمی‌کند
 *
 * - قاعده‌ی ۱: هیچ فرمول قیمتی اینجا نیست — اینجا اصلاً قیمتی نیست.
 * - قاعده‌ی ۲: هیچ عدد بین‌سکویی؛ فقط نام و اسلاگ.
 * - تصمیم ۲۰: گلدیکا (`PERMISSION_PENDING`) اینجا **نیست** — این فهرست
 *   آینه‌ی فهرست *عمومی* است (`Platform.is_listed`)، نه کل رجیستری.
 *
 * ## نگهداری
 *
 * دستی نگهداری می‌شود و `tests/registry-parity.test.ts` با خواندن مستقیم
 * همان فایل‌های پایتون نمی‌گذارد از هم بپاشد: افزودن سکو یا دارایی در
 * گردآورنده بدون به‌روزرسانی این فایل، CI را قرمز می‌کند.
 *
 * فیلدهای معرف (بند ۶.۴) عمداً اینجا نیستند: امروز در گردآورنده هم برای
 * همه `None` اند و ‎/go/‎ به `website_url` می‌رود؛ آینگی‌شان فقط سطح حمله‌ی
 * نشت کد معرف را بی‌دلیل بزرگ می‌کرد.
 */
import type { InstrumentListing, ListedPlatform } from "./prices";

/**
 * سکوهای قابل نمایش عمومی، **به همان ترتیب** `PLATFORMS` گردآورنده (ترتیب
 * تاپل آنجا ترتیب فهرست عمومی است: اول قیمت‌مؤثردارها، بعد کارمزد-نامعلوم‌ها).
 */
export const REGISTRY_PLATFORMS: readonly ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Wallgold",
    website_url: "https://wallgold.ir",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Talasea",
    website_url: "https://talasea.ir",
    legal_entity: "شرکت توسعه راهکار الوند ارسباران",
    delivery_note_fa: "تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)",
  },
  {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Milli",
    website_url: "https://milli.gold",
    legal_entity: null,
    delivery_note_fa: "کارمزد تحویل فیزیکی ۳٪",
  },
  {
    slug: "technogold",
    name_fa: "تکنوگلد",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Technogold",
    website_url: "https://technogold.gold",
    legal_entity: "بازوی فینتک هلدینگ تکنولایف",
    delivery_note_fa: null,
  },
  {
    slug: "tlyn",
    name_fa: "طلاین",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Tlyn",
    website_url: "https://taline.ir",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "ecogold",
    name_fa: "اکوگلد",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Ecogold",
    website_url: "https://ecogold.ir",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "zarafza",
    name_fa: "زرافزا",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Zarafza",
    website_url: "https://zarafza.com",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "baazar",
    name_fa: "بازر",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Baazar",
    website_url: "https://baazar.ir",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "daric",
    name_fa: "داریک",
    data_policy: "ALLOWED",
    market_model: "ORDER_BOOK",
    name_en: "Daric",
    website_url: "https://daric.gold",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "melligold",
    name_fa: "ملی‌گلد",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Melligold",
    website_url: "https://melligold.com",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "digikala",
    name_fa: "دیجی‌کالا",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Digikala",
    website_url: "https://www.digikala.com/wealth/",
    legal_entity: null,
    delivery_note_fa:
      "تحویل فیزیکی طلا از ۵٫۴ گرم؛ کارمزد ضرب و تحویل ۴۰۰ میلی‌گرم به‌ازای هر شمش ۵ گرمی (عملاً حدود ۸٪)",
  },
  {
    slug: "hamrahgold",
    name_fa: "همراه‌گلد",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Hamrahgold",
    website_url: "https://pwa.hamrahgold.com",
    legal_entity: null,
    delivery_note_fa: null,
  },
  {
    slug: "invi",
    name_fa: "اینوی",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Invi",
    website_url: "https://invi.ir",
    legal_entity: null,
    delivery_note_fa: null,
  },
];

/**
 * دارایی‌ها با وضعیت دروازه‌ی انتشار (تصمیم ۱۰) — آینه‌ی همان چیزی که
 * `build_listings` گردآورنده از رجیستری آداپترها می‌سازد.
 *
 * `published` اینجا **کپی** است، نه محاسبه (قاعده‌ی ۱): آستانه و شمارش در
 * گردآورنده است. امروز فقط طلای ۱۸ عیار دو سکوی پشتیبان دارد؛ بقیه هنوز
 * هیچ آداپتری ندارند و مثل قبل ۴۰۴ می‌مانند و در سایت‌مپ نمی‌آیند.
 *
 * ⚠️ این فهرست فقط **کف** است: اگر payload زنده‌ی `mazane:instruments`
 * در دسترس باشد، همان مقدم است — پس باز شدن دروازه‌ی یک دارایی در
 * گردآورنده همچنان بدون دیپلویِ وب اثر می‌کند.
 */
export const REGISTRY_INSTRUMENTS: readonly InstrumentListing[] = [
  {
    slug: "tala-18",
    instrument: "GOLD_18K",
    name_fa: "طلای ۱۸ عیار",
    unit_fa: "گرم",
    purity: "750",
    currency: "TOMAN",
    supporting_platform_slugs: [
      "wallgold",
      "talasea",
      "milli",
      "technogold",
      "tlyn",
      "ecogold",
      "zarafza",
      "baazar",
      "daric",
      "melligold",
      "digikala",
      "hamrahgold",
      "invi",
    ],
    published: true,
  },
  {
    slug: "abshode",
    instrument: "ABSHODE_MITHQAL",
    name_fa: "طلای آب‌شده (مظنه)",
    unit_fa: "مثقال",
    purity: null,
    currency: "TOMAN",
    supporting_platform_slugs: [],
    published: false,
  },
  {
    slug: "noghre",
    instrument: "SILVER_990",
    name_fa: "نقره‌ی ۹۹۰",
    unit_fa: "گرم",
    purity: "990",
    currency: "TOMAN",
    supporting_platform_slugs: [],
    published: false,
  },
  {
    slug: "ons-jahani",
    instrument: "XAU",
    name_fa: "انس جهانی طلا",
    unit_fa: "اونس",
    purity: null,
    currency: "USD",
    supporting_platform_slugs: [],
    published: false,
  },
];
