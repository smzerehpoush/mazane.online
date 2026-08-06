/**
 * بازتولید on-demand بلاگ — بلیت ۱۲؛ مصرف‌کننده: صف انتشار محتوا (بلیت ۱۳).
 *
 * قرارداد فراخوانی (برای بلیت ۱۳ — پس از هر انتشار، ویرایش یا پس‌گیری):
 *
 *     POST /api/revalidate-blog
 *     Authorization: Bearer $MAZANE_REVALIDATE_TOKEN
 *     Content-Type: application/json
 *     {"slug": "<post-slug>"}        // اختیاری؛ بدون آن فقط فهرست و سایت‌مپ
 *
 * چه چیزی بازتولید می‌شود: ‎/blog‎ (فهرست)، ‎/blog/<slug>‎ (خود پست — برای
 * اسلاگ تازه هم کار می‌کند چون صفحه dynamicParams دارد) و ‎/sitemap.xml‎
 * (تا انتشار/پس‌گیری بدون دیپلوی در سایت‌مپ منعکس شود).
 *
 * احراز: توکن مشترک در env — بدون آن endpoint عمومی می‌شد و هر کسی می‌توانست
 * هزینه‌ی بازتولید تحمیل کند. توکن تنظیم‌نشده ⟸ همیشه ۴۰۱ (fail closed).
 */
import { revalidatePath } from "next/cache";

/** همان قاعده‌ی اسلاگ لاتین تخت (بند ۱۳، تصمیم ۱۱ + مهاجرت 010_blog.sql). */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function POST(request: Request): Promise<Response> {
  const token = process.env.MAZANE_REVALIDATE_TOKEN;
  const authorization = request.headers.get("authorization");
  if (token === undefined || token === "" || authorization !== `Bearer ${token}`) {
    return Response.json({ revalidated: false }, { status: 401 });
  }

  let slug: string | null = null;
  try {
    const body = (await request.json()) as { slug?: unknown };
    if (typeof body.slug === "string") {
      if (!SLUG_PATTERN.test(body.slug)) {
        return Response.json(
          { revalidated: false, error: "bad slug" },
          { status: 400 },
        );
      }
      slug = body.slug;
    }
  } catch {
    // بدنه‌ی خالی یا غیر-JSON مجاز است — یعنی «فقط فهرست و سایت‌مپ».
  }

  revalidatePath("/blog");
  if (slug !== null) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");

  return Response.json({ revalidated: true, slug });
}
