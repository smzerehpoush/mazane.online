/**
 * منطق ‎POST /api/post-view‎ — ثبت یک بازدید پست بلاگ.
 *
 * جدا از مسیر، تا مرز تست وب بتواند رفتار را با منبع seed شده بسنجد.
 *
 * قرارداد:
 *     POST /api/post-view      {"slug": "<post-slug>"}
 *     ← 204 بدون بدنه            ثبت شد (یا بی‌صدا نادیده گرفته شد)
 *     ← 400                      بدنه‌ی نامعتبر یا اسلاگ بدشکل
 *     ← 405                      متد دیگر
 *
 * سه تصمیم که عمدی‌اند:
 *
 * ۱. **اسلاگ پیش از نوشتن اعتبارسنجی می‌شود** — فقط پستِ *منتشرشده* شمرده
 *    می‌شود. یعنی کسی نمی‌تواند با اسلاگ دلخواه ردیف بسازد یا شمارنده‌ی
 *    پیش‌نویس و پست پس‌گرفته‌شده را بالا ببرد.
 * ۲. **پست ناموجود هم ۲۰۴ می‌گیرد، نه ۴۰۴.** این نقطه هیچ اطلاعاتی درباره‌ی
 *    وجود یا نبودِ یک اسلاگ لو نمی‌دهد، و مهم‌تر: پاسخش را هیچ انسانی
 *    نمی‌بیند — تفکیک خطا فقط سطح حمله را بزرگ می‌کند.
 * ۳. **شکست شمارنده هرگز به کاربر نمی‌رسد** (قاعده‌ی ۵): قطع پستگرس یعنی
 *    بازدید ثبت نمی‌شود، نه اینکه چیزی بشکند. باز هم ۲۰۴.
 *
 * ‎Cache-Control: no-store‎ الزامی است — این یک نوشتن است و لبه نباید
 * پاسخش را کش کند و درخواست‌های بعدی را ببلعد.
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { getPublishedPost } from "./blog-source";
import { recordPostView } from "./view-counter";

/** همان شکل اسلاگ که مهاجرت ۰۱۰ روی جدول `posts` قید کرده. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** سقف طول بدنه — بدنه‌ی معتبر چند ده بایت است؛ بقیه‌اش سوءاستفاده است. */
const MAX_BODY_BYTES = 512;

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
}

function badRequest(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 400,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE },
  });
}

export async function postViewResponse(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return badRequest("بدنه بیش از حد بزرگ است");

  let slug: unknown;
  try {
    const body: unknown = JSON.parse(raw);
    slug = typeof body === "object" && body !== null ? (body as { slug?: unknown }).slug : undefined;
  } catch {
    return badRequest("بدنه JSON معتبر نیست");
  }

  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    return badRequest("اسلاگ نامعتبر است");
  }

  // فقط پست منتشرشده شمرده می‌شود. خطای استور اینجا هم بی‌صدا رد می‌شود:
  // نشمردن یک بازدید، به‌مراتب بی‌ضررتر از شکستن مسیر است.
  try {
    const post = await getPublishedPost(slug);
    if (post !== null) await recordPostView(slug);
  } catch (error) {
    console.error("post-view: could not record view", error);
  }

  return noContent();
}

export function postViewMethodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "فقط POST" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
      Allow: "POST",
    },
  });
}
