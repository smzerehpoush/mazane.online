/**
 * صفحه‌ی خطای آخرین سنگر — وقتی SSR اصلاً بالا نیامده و هیچ React ای نیست.
 * HTML خودکفا و فارسیِ راست‌به‌چپ، بدون هیچ درخواست بیرونی (نه فونت، نه
 * تله‌متری): همین صفحه است که در قطعی کامل سرو می‌شود.
 *
 * ⚠️ این صفحه جای «قیمت کهنه» نیست: قطع ردیس/پستگرس در لایه‌ی داده به
 * «داده‌ای نیست» ترجمه شده و صفحه ۲۰۰ می‌ماند (قاعده‌ی ۵ قراردادها).
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>این صفحه بالا نیامد — تابلو</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      body { font: 15px/1.9 Vazirmatn, system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>این صفحه بالا نیامد</h1>
      <p>مشکلی از سمت ما پیش آمد. می‌توانید دوباره تلاش کنید یا به صفحه‌ی اصلی برگردید.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">تلاش دوباره</button>
        <a class="secondary" href="/">صفحه‌ی اصلی</a>
      </div>
    </div>
  </body>
</html>`;
}
