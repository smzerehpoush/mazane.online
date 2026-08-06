/**
 * مسیر تخت ‎/[slug]‎ — صفحه‌ی دارایی یا صفحه‌ی سکو (بلیت ۷؛ بند ۱۳،
 * تصمیم‌های ۱۰، ۱۱ و ۱۹).
 *
 * حل اسلاگ با داده‌ی جدول مرکزی گردآورنده است (lib/slugs.ts):
 * اسلاگ دارایی ⟸ صفحه‌ی دارایی؛ اسلاگ سکو ⟸ صفحه‌ی سکو؛ ناشناخته،
 * رزروشده، یا دارایی با دروازه‌ی انتشار بسته ⟸ 404.
 *
 * رندر (بند ۶.۲): صفحه‌ی دارایی ISR شصت‌ثانیه‌ای + generateStaticParams —
 * دقیقاً تجویز سند. برای صفحه‌ی سکو سند SSG + revalidatePath هنگام ویرایش
 * تجویز کرده؛ **انحراف آگاهانه و مستند:** چون هر دو نوع صفحه در همین یک
 * مسیر تخت زندگی می‌کنند و «ویرایش» فراداده‌ی سکو فعلاً فقط با دیپلوی
 * رجیستری کد رخ می‌دهد (هیچ رویداد ویرایشی برای revalidatePath وجود
 * ندارد)، همان ISR ۶۰ ثانیه صفحه‌ی سکو را هم پوشش می‌دهد — هزینه‌اش یک
 * بازتولید در دقیقه در بدترین حالت است و قیمت‌های صفحه‌ی سکو را هم تازه
 * نگه می‌دارد. اگر روزی ویرایش تحریریه‌ی جدا آمد، revalidatePath همان‌جا
 * اضافه می‌شود.
 *
 * به‌روزرسان زنده اینجا mount نمی‌شود (انتخاب مستند بلیت ۷): اعداد این
 * صفحه‌ها فقط با ISR تازه می‌شوند — حداکثر ۶۰ ثانیه کهنگی، همان ضمانتی که
 * Googlebot می‌بیند. قلاب‌های data-live در تکه‌های مشترک بی‌اثر می‌مانند.
 *
 * کلمات رزرو هرگز به این مسیر نمی‌رسند — مسیرهای ایستای نکست (blog/،
 * darbare-pishnahad/، api/ و…) مقدم‌اند — و حل‌کننده هم جدا ردشان می‌کند
 * (دفاع در عمق؛ تستش در tests/asset-platform-pages.test.tsx).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetPage } from "./asset-page";
import { PlatformPage } from "./platform-page";
import { getInstruments, getListedPlatforms } from "../../lib/prices";
import { SITE_URL } from "../../lib/site";
import { resolveSlug } from "../../lib/slugs";

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

/**
 * دارایی‌ای که بعد از build دروازه‌اش باز شود (سکوی دوم فعال شود) هم
 * on-demand ساخته می‌شود — «صفحه خودکار ساخته و ایندکس می‌شود» (تصمیم ۱۰).
 */
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // build بیرون از سرور (بند ۱۳، تصمیم ۵) شاید به ردیس دسترسی نداشته باشد؛
  // هر دو خواندن در آن حالت [] می‌دهند و صفحه‌ها در اولین درخواست ساخته می‌شوند.
  const [instruments, platforms] = await Promise.all([
    getInstruments(),
    getListedPlatforms(),
  ]);
  return [
    ...instruments.filter((item) => item.published).map((item) => ({ slug: item.slug })),
    ...platforms.map((platform) => ({ slug: platform.slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (resolved === null) {
    return { title: "صفحه یافت نشد" };
  }
  if (resolved.kind === "instrument") {
    const { name_fa, unit_fa } = resolved.listing;
    return {
      title: `قیمت ${name_fa} در سکوهای آنلاین — مظنه آنلاین`,
      description: `مقایسه‌ی قیمت مؤثر خرید و فروش ${name_fa} (تومان بر ${unit_fa}) در سکوهای آنلاین ایران — با احتساب کارمزد و قیمت مرجع هر سکو.`,
      alternates: { canonical: `${SITE_URL}/${slug}` },
    };
  }
  const { name_fa } = resolved.platform;
  return {
    title: `${name_fa} — شرایط، کارمزد و قیمت‌ها — مظنه آنلاین`,
    description: `شرایط تجاری ${name_fa}: کارمزد خرید و فروش با منبع، تحویل فیزیکی، هویت حقوقی و قیمت‌های مؤثر لحظه‌ای.`,
    alternates: { canonical: `${SITE_URL}/${slug}` },
  };
}

export default async function SlugPage({ params }: Props) {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (resolved === null) notFound();
  // فراخوانی مستقیم (نه <AssetPage/>) تا درخت برگشتی کاملاً await شده باشد؛
  // هر دو کامپوننت سروری‌اند و همین ترکیب تابعی روی سرور کافی است.
  return resolved.kind === "instrument"
    ? AssetPage({ listing: resolved.listing })
    : PlatformPage({ platform: resolved.platform });
}
