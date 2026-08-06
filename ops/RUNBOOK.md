# رانبوک استقرار مظنه آنلاین — بلیت ۱۱

> اجرای نظارت‌شده. هر گامی که با ‏👤 علامت خورده «فقط با حضور صاحب کسب‌وکار»
> انجام می‌شود (دسترسی SSH، پنل آروان، سرچ‌کنسول، یا تصمیم برگشت‌ناپذیر).
> سرور `37.32.27.201` با پروژه‌ی تولیدی پادل‌یار (۱۱ کانتینر + کدیِ لبه روی
> ۸۰/۴۴۳) مشترک است — بند ۱۳ سند معماری، تصمیم ۵. قاعده‌ی طلایی کل این سند:
> **پادل‌یار نباید حتی یک ثانیه بلرزد.**

فایل‌های مرتبط این مخزن:

| فایل | نقش |
|---|---|
| `Dockerfile.collector` / `Dockerfile.web` | ساخت ایمیج‌ها (بیرون از سرور) |
| `compose.prod.yml` | اجرای چهار سرویس روی سرور |
| `.env.example` | نمونه‌ی پیکربندی — روی سرور به `‎.env‎` کپی می‌شود |
| `ops/caddy-snippet.Caddyfile` | بلوک سایت برای Caddyfile موجود پادل‌یار |
| `ops/verify-googlebot.py` | تأیید آفلاین reverse-DNS بازدیدهای گوگل‌بات |
| `ops/collector-healthcheck.py` | داخل ایمیج گردآورنده کپی می‌شود |

---

## ۰. وضعیت معیارهای پذیرش بلیت ۱۱

هر سه معیار پذیرش به سرور/آروان زنده نیاز دارند و در این پاس مخزنی **معوق**‌اند:

- [ ] معوق — «mazane.online از پشت آروان صفحه‌ی زنده می‌دهد و برنامه‌های
      موجود سرور سالم می‌مانند» ⟸ گام‌های ۳ تا ۶
- [ ] معوق — «با خواباندن عمدی مبدأ، لبه پاسخ ۲۰۰ کهنه می‌دهد (آزمایش
      ثبت‌شده)» ⟸ گام ۷ — **پیش‌شرط سخت لانچ** (بند ۱۰.۲)
- [ ] معوق — «پایش بیرونی فعال است و لاگ گوگل‌بات با تأیید معکوس دی‌ان‌اس
      ثبت می‌شود» ⟸ گام‌های ۸ و ۹

---

## ۱. پیش‌نیازها — قبل از جلسه‌ی استقرار

### ۱.۱ لایه‌ی وب دیگر نکست نیست — چه چیزی عوض شد

اپ وب به **TanStack Start + Vite + Nitro** مهاجرت کرده. پیامدهای عملیاتی:

| قبل (نکست) | حالا |
|---|---|
| خروجی `.next/standalone` | خروجی `.output/` |
| `node server.js` | `node .output/server/index.mjs` |
| نیاز به `output: "standalone"` در `next.config.ts` | چیزی لازم نیست — پریست در `web/vite.config.ts` است |
| `.next/static` و `public` جدا کپی می‌شدند | `.output` **خودبسنده** است: نه `node_modules`، نه کد منبع |

پیش‌نیاز پیکربندی قبلی (یک خط `output: "standalone"`) **منتفی شد**.
جایش یک قید تازه نشسته که همان اندازه مسدودکننده است:

> پریست Nitro باید `node-server` باشد. پیش‌فرض تاریخی این استک
> `cloudflare-module` بود که نه `ioredis` در آن کار می‌کند نه `pg`.
> در `web/vite.config.ts` صریح تنظیم شده و **سه‌جا** نگهبان دارد:
> یک مرحله در `Dockerfile.web`، یک گام در CI، و همین سند.

اندازه‌ها و مصرف واقعی (اندازه‌گیری‌شده، نه تخمین):

- ایمیج وب: **~۱۶۰MB** برای `linux/amd64` (پایه `node:22-alpine`).
- حافظه‌ی کانتینر وب: **~۳۱MB** بی‌کار، **~۶۱MB** پس از ۲۰۰ درخواست SSR.
  سقف `compose.prod.yml` از ۳۸۴M به **۲۵۶M** آمد؛ جمع سقف چهار سرویس
  ۹۹۲MB ← **۸۶۴MB**.
- `NODE_OPTIONS=--max-old-space-size=192` در `Dockerfile.web`. این عدد
  **جفت** سقف ۲۵۶M است: V8 وگرنه سقف heap را از رم میزبان حدس می‌زند و
  می‌تواند تا نزدیک ۲GB رشد کند — یعنی OOM-killer به‌جای این پروسه سراغ
  پادل‌یار برود. هر کدام عوض شد، دیگری هم.

### ۱.۲ 👤 تصمیم رجیستری ایمیج

ساخت روی سرور **گزینه نیست** (۱ هسته/۲GB — `vite build` بیش از رم آزاد سرور
حافظه می‌خواهد). دو مسیر برای رساندن ایمیج به سرور:

| مسیر | خوبی | ریسک |
|---|---|---|
| **GHCR (توصیه‌شده):** جاب `images` در CI با `push: true` + روی سرور `docker compose pull` | تکرارپذیر، بدون انتقال دستی | دسترسی ایران به `ghcr.io` ممکن است فیلتر/محدود باشد — قبل از اتکا، از خود سرور تست شود: `curl -sI https://ghcr.io/v2/` |
| **جایگزین بدون رجیستری:** از لپ‌تاپ `docker save mazane-web:v1 \| gzip \| ssh root@37.32.27.201 'gunzip \| docker load'` | به هیچ سرویس خارجی وابسته نیست | دستی؛ دیسک سرور فقط ~۸GB آزاد دارد — بعد از هر load، ایمیج‌های قدیمی پاک شوند (`docker image prune -f`) |

اگر GHCR انتخاب شد: در `.github/workflows/ci.yml` جاب `images` این‌ها اضافه
می‌شود: `docker/login-action` با `GITHUB_TOKEN`، `push: true`، و تگ‌های
`ghcr.io/smzerehpoush/mazane-{web,collector}:{latest,sha}`؛ و روی سرور یک‌بار
`docker login ghcr.io` با PAT فقط-خواندنی (scope: `read:packages`).

### ۱.۳ ساخت ایمیج‌ها (CI یا لپ‌تاپ)

روی لپ‌تاپ (مک ARM) حتماً با پلتفرم سرور:

```bash
docker build --platform linux/amd64 -f Dockerfile.collector -t mazane-collector:v1 .
docker build --platform linux/amd64 -f Dockerfile.web       -t mazane-web:v1 .
```

راستی‌آزمایی ایمیج وب **پیش از** فرستادن به سرور — عمداً بدون ردیس و بدون
پستگرس، چون انتظار ۲۰۰ است نه ۵۰۰ (قاعده‌ی سخت ۵: قطع منبع کهنگی است نه خطا):

```bash
docker run --rm -d --name mazane-web-smoke \
  --memory 256m --cpus 0.5 -p 127.0.0.1:3399:3000 mazane-web:v1
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3399/            # ۲۰۰
curl -sI http://127.0.0.1:3399/fonts/vazirmatn-variable-33.0.3.woff2 \
  | grep -iE 'HTTP|cache-control'      # ۲۰۰ + immutable — فونت خودمیزبان
docker stats --no-stream mazane-web-smoke                                  # ~۳۱MB
docker rm -f mazane-web-smoke
```

همین دود-تست در CI (جاب `images`) هم اجرا می‌شود.

### ۱.۴ 👤 آماده‌سازی `‎.env‎`

از روی `.env.example`. نکات:

- `POSTGRES_PASSWORD` و `MAZANE_REVALIDATE_TOKEN` با `openssl rand -hex 32`.
- `MAZANE_REVALIDATE_TOKEN` بین گردآورنده و وب مشترک است (compose خودش به هر
  دو می‌دهد). مسیر `/api/revalidate-blog` بدون توکنِ تنظیم‌شده **همیشه ۴۰۱**
  می‌دهد (fail closed) — پس اشتباه‌بودنش در لاگ گردآورنده دیده می‌شود.
  با مهاجرت از نکست دیگر کش صفحه‌ای در مبدأ نیست: پست تازه در بدترین حالت
  ۶۰ ثانیه (پنجره‌ی `s-maxage` لبه) دیرتر دیده می‌شود.
- `MAZANE_DAILY_PUBLISH_CAP` سقف انتشار روزانه‌ی بلاگ (پیش‌فرض ۲ — تصمیم ۱۶).
- `MAZANE_WEB_PORT` (پیش‌فرض ۳۳۰۰) نباید با درگاه‌های پادل‌یار تصادم کند —
  روی سرور چک شود: `ss -ltn | grep 3300`.
- اگر مسیر «بدون رجیستری» انتخاب شد، `MAZANE_IMAGE_*` را به تگ‌های load شده
  بگذارید (مثلاً `mazane-web:v1`).

### ۱.۵ فایل‌هایی که باید روی سرور باشند

فقط این‌ها (کل مخزن لازم نیست):

```
/opt/mazane/
├── compose.prod.yml
├── .env                        # از ۱.۴
└── collector/migrations/*.sql  # همان ساختار نسبی که compose mount می‌کند
```

---

## ۲. 👤 گام صفر روی سرور — عکس وضعیت پادل‌یار

قبل از هر تغییری، خط مبنا ثبت شود تا «سالم ماندن برنامه‌های موجود» قابل
راستی‌آزمایی باشد:

```bash
ssh root@37.32.27.201
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | tee /root/pre-mazane-docker-ps.txt
free -m ; df -h /            # رم و دیسک آزاد — انتظار: ~1.2GB رم، ~8GB دیسک
curl -sI https://<دامنه‌ی پادل‌یار>/ | head -5   # پادل‌یار از بیرون ۲۰۰ می‌دهد
```

اگر رم آزاد زیر ~۱GB بود توقف و بررسی — سقف‌های compose ما ۸۶۴MB است.

---

## ۳. 👤 استقرار کانتینرها

```bash
mkdir -p /opt/mazane
# فایل‌های گام ۱.۵ را scp کنید، سپس:
cd /opt/mazane
chmod 600 .env

docker network create mazane-edge        # شبکه‌ی مشترک با کدیِ لبه (گام ۵)

# --- ایمیج‌ها: یکی از دو مسیر گام ۱.۲ ---
docker compose -f compose.prod.yml pull            # مسیر GHCR
# یا docker load  (مسیر بدون رجیستری — از لپ‌تاپ push شده با ssh)
```

> ⚠️ `postgres:16` و `redis:7` از Docker Hub می‌آیند و هاب دسترسی IPهای
> ایرانی را محدود می‌کند. پادل‌یار همین حالا ایمیج pull می‌کند، پس احتمالاً
> `/etc/docker/daemon.json` سرور mirror دارد — اول همان را چک کنید. اگر
> نبود: یا از میرور آروان (`docker pull docker.arvancloud.ir/postgres:16`
> سپس `docker tag` به `postgres:16`) یا این دو ایمیج هم مثل ایمیج‌های مظنه
> با `docker save | ssh docker load` منتقل شوند. به `daemon.json` دست
> نزنید مگر با اجازه‌ی 👤 (ری‌استارت docker همه‌ی کانتینرهای پادل‌یار را
> می‌اندازد).

```bash

docker compose -f compose.prod.yml up -d postgres redis
docker compose -f compose.prod.yml ps              # هر دو باید healthy شوند
```

### مهاجرت‌ها (001 تا 012)

volume تازه است ⟸ پستگرس در اولین بوت **همه‌ی** فایل‌های
`/docker-entrypoint-initdb.d/*.sql` را به ترتیب واژه‌نگاری اجرا می‌کند
(001، 002، 003، 004، 010، 011، 012 — شکاف شماره‌ها عمدی است). راستی‌آزمایی:

```bash
docker compose -f compose.prod.yml exec postgres \
  psql -U mazane -d mazane -c '\dt'
# انتظار: جدول‌های قیمت/تاریخچه/references/posts/rollup — نه فهرست خالی
```

اگر در آینده volume از قبل مقداردهی شده بود و مهاجرت جدیدی اضافه شد، initdb
دیگر اجرا نمی‌شود — دستی و به ترتیب شماره:

```bash
docker compose -f compose.prod.yml exec postgres \
  psql -U mazane -d mazane -f /docker-entrypoint-initdb.d/013_xxx.sql
```

### بالا آوردن وب و گردآورنده

```bash
docker compose -f compose.prod.yml up -d web collector
docker compose -f compose.prod.yml ps    # همه healthy (گردآورنده تا ~۲ دقیقه start_period دارد)

curl -s http://127.0.0.1:3300/ | head -20         # HTML فارسی صفحه‌ی اصلی
# نکته: دیگر prerender زمان‌ساخت در کار نیست — هر درخواست SSR می‌شود و لودر
# همان لحظه ردیس/پستگرس را می‌خواند. اگر گردآورنده هنوز نوبتی نزده باشد،
# جدول خالی/کهنه است ولی پاسخ **۲۰۰** است، نه خطا (قاعده‌ی سخت ۵).
# پس «صفحه بالا آمد ولی قیمت ندارد» در دقیقه‌ی اول طبیعی است؛
# «صفحه ۵۰۰ داد» طبیعی نیست.
curl -s http://127.0.0.1:3300/robots.txt           # شامل Disallow: /go/ و Sitemap:
curl -sI http://127.0.0.1:3300/fonts/vazirmatn-variable-33.0.3.woff2 \
  | grep -iE 'HTTP|cache-control'   # ۲۰۰ + immutable — فونت از خود مبدأ می‌آید
docker compose -f compose.prod.yml logs --tail 50 collector   # «نوبت گردآوری» با قیمت‌ها
```

---

## ۴. 👤 راستی‌آزمایی سلامت پادل‌یار (تکرار بعد از هر گام باقی‌مانده)

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | diff /root/pre-mazane-docker-ps.txt - || true
free -m                                            # رم آزاد منفی نشده باشد
curl -sI https://<دامنه‌ی پادل‌یار>/ | head -3     # هنوز ۲۰۰
```

---

## ۵. 👤 اتصال به کدیِ لبه‌ی موجود

> تنها گامی که به پیکربندی پادل‌یار دست می‌زند. قبلش از Caddyfile موجود نسخه‌ی
> پشتیبان بگیرید.

```bash
CADDY=<نام کانتینر کدی پادل‌یار>          # از docker ps پیدا کنید
docker network connect mazane-edge $CADDY

# داخل کانتینر کدی، نام mazane-web باید resolve و پاسخ بدهد:
docker exec $CADDY wget -qO- http://mazane-web:3000/ | head -3
```

سپس محتوای `ops/caddy-snippet.Caddyfile` (بدون کامنت‌های سرصفحه، از بلوک
`mazane.online {` به بعد) به **انتهای** Caddyfile موجود اضافه شود. نکات:

- مسیر Caddyfile را از compose پادل‌یار پیدا کنید (معمولاً bind mount).
- برای لاگ پایدار، `/var/log/caddy` کانتینر کدی باید volume/bind داشته باشد؛
  اگر ندارد، در compose پادل‌یار اضافه شود (یک خط volume — با اجازه‌ی 👤).
- **TLS پشت آروان:** کدی برای `mazane.online` گواهی ACME می‌گیرد. مسیر
  HTTP-01 باید از لبه‌ی آروان عبور کند (`/.well-known/acme-challenge/*` کش و
  مسدود نشود). اگر صدور گیر کرد: در پنل آروان رکورد A را موقتاً «فقط DNS»
  (بدون پراکسی) کنید، صدور که انجام شد پراکسی را برگردانید.

```bash
docker exec $CADDY caddy validate --config /etc/caddy/Caddyfile   # اول اعتبارسنجی
docker exec $CADDY caddy reload   --config /etc/caddy/Caddyfile   # سپس reload (بدون قطعی)
docker exec $CADDY wget -qO- --header 'Host: mazane.online' http://127.0.0.1/ | head -3
```

خرابی در reload = برگرداندن Caddyfile پشتیبان + reload دوباره (بازگشت گام ۱۱).

---

## ۶. 👤 آروان — DNS و کش

در پنل آروان‌کلود (حساب موجود صاحب کسب‌وکار):

1. **DNS:** رکورد `A` برای `@` (و در صورت تمایل `www`) به `37.32.27.201` با
   **پراکسی روشن** (ابر). TTL کوتاه (۲ دقیقه) تا تثبیت.
2. **HTTPS لبه:** گواهی لبه‌ی آروان فعال؛ ارتباط لبه⟸مبدأ روی HTTPS (گواهی
   معتبر کدی از گام ۵) یا مطابق گزینه‌های پنل.
3. **کش:** حالت «پیروی از هدر مبدأ» — صفحه‌ی اصلی
   `Cache-Control: public, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400`
   می‌دهد (بند ۶.۲؛ منبع حقیقتش `web/src/lib/seo/cache-headers.ts` است).
   قانون کش دستی جداگانه برای HTML لازم نیست و **نباید** هدر مبدأ override
   شود — به‌ویژه `stale-if-error` که همان پیش‌شرط سخت گام ۷ است.
   دارایی‌های ایستا (`/assets/**` هش‌دار و `/fonts/**` نسخه‌دار) خودشان
   `max-age=31536000, immutable` می‌دهند؛ آن‌ها هم دست‌نخورده رد شوند.
4. راستی‌آزمایی از بیرون: `curl -sI https://mazane.online/` ⟸ ۲۰۰ + همان
   `Cache-Control` + هدرهای کش آروان (`X-Cache` یا `Ar-Cache`؛ بار دوم HIT).

---

## ۷. 👤 آزمون «۲۰۰ کهنه در قطعی مبدأ» — پیش‌شرط سخت لانچ (بند ۱۰.۲)

> **تا این آزمون پاس نشود لانچ ممنوع است.** تنها نقطه‌ی شکست معماری میزبانی
> همین است: اگر آروان در قطعی مبدأ به گوگل‌بات ۵xx بدهد، سایت در چند روز از
> ایندکس حذف می‌شود. (اقدام معوق ۳ صاحب کسب‌وکار در بند ۱۳.۱.)

رویه — ترجیحاً با یک نقطه‌ی دید خارج از ایران (VPS/VPN خارجی):

```bash
# ۱) گرم کردن کش لبه و ثبت خط مبنا (از بیرون):
curl -sI https://mazane.online/ ; sleep 5 ; curl -sI https://mazane.online/
# انتظار: ۲۰۰؛ بار دوم هدر کش آروان HIT

# ۲) خواباندن عمدی مبدأ (روی سرور):
docker compose -f /opt/mazane/compose.prod.yml stop web

# ۳) از بیرون، در دقیقه‌های ۱، ۲ و ۵ (مهم: بعد از انقضای s-maxage=60 هم):
date -u ; curl -sI https://mazane.online/
# قبولی: هر سه بار «۲۰۰» با HTML کهنه. مردودی: هر 5xx/52x.

# ۴) ثبت شواهد (معیار پذیرش «آزمایش ثبت‌شده»): خروجی کامل curl -i و date -u
#    هر سه نوبت در یک فایل/اسکرین‌شات نگه داشته شود.

# ۵) برگرداندن مبدأ:
docker compose -f /opt/mazane/compose.prod.yml start web
curl -sI https://mazane.online/        # دوباره ۲۰۰ تازه
```

اگر مردود شد: در تنظیمات کش آروان گزینه‌ی سروِ محتوای کش‌شده هنگام خطای مبدأ
را فعال کنید (و در صورت نبود، با پشتیبانی آروان طرح شود)، سپس آزمون از نو.
نتیجه هرچه بود، در همین سند زیر همین بند با تاریخ ثبت شود.

---

## ۸. 👤 پایش بیرونی (بند ۱۰.۲، الزام ۲)

پایش باید **از خارج ایران** باشد — تنها سؤال مهم این است که گوگل‌بات می‌رسد
یا نه. هر سرویس رایگان با نودهای خارجی کافی است (UptimeRobot، Better Stack،
StatusCake — انتخاب با 👤 چون حساب به ایمیل او می‌خورد):

- دو چک HTTPS هر ۵ دقیقه: `https://mazane.online/` و
  `https://mazane.online/robots.txt`؛ شرط قبولی: وضعیت ۲۰۰.
- هشدار به ایمیل صاحب کسب‌وکار.
- نکته: پس از آزمون گام ۷ فعال شود تا هشدار کاذب ندهد؛ یا هنگام آزمون در
  حالت pause باشد.

---

## ۹. لاگ گوگل‌بات + تأیید معکوس DNS (بند ۱۰ و تصمیم ۱۴)

لاگ JSON در گام ۵ فعال شد (`/var/log/caddy/mazane-access.log` داخل کانتینر
کدی، شامل User-Agent و IP واقعی پشت آروان). تأیید اصالت، آفلاین و دوره‌ای:

```bash
# روی سرور (python3 روی اوبونتو ۲۴.۰۴ موجود است) — اسکریپت را یک‌بار scp کنید:
docker exec <کانتینر کدی> cat /var/log/caddy/mazane-access.log > /tmp/mazane-access.log
python3 /opt/mazane/verify-googlebot.py /tmp/mazane-access.log
```

خروجی: هیت‌های اصیل گوگل (PTR به `googlebot.com`/`google.com` + forward
تأییدشده)، مدعیان جعلی، مسیرها و کدهای وضعیت — با هشدار صریح اگر گوگل‌باتِ
اصیل ۵xx دیده باشد. **هفتگی اجرا شود** (دستی یا cron ساده روی سرور) و تا
زمانی که دسترسی سرچ‌کنسول تأیید نشده (تصمیم ۱۴)، این تنها معیار «گوگل ما را
می‌خزد» است.

---

## ۱۰. 👤 سرچ‌کنسول — DNS TXT (بند ۱۰.۲، الزام ۳)

1. در سرچ‌کنسول، property از نوع **Domain** برای `mazane.online`.
2. رکورد `TXT` پیشنهادی گوگل در **پنل DNS آروان** اضافه شود (به میزبانی
   وابسته نیست و با تغییر هاست نمی‌شکند — دلیل انتخاب این روش).
3. سایت‌مپ نیاز به ثبت دستی ندارد: `robots.txt` خط `Sitemap:` دارد
   (`web/app/robots.ts`)؛ ثبت دستی در سرچ‌کنسول هم بلامانع است.
4. یادآوری: خودِ دسترسی صاحب کسب‌وکار به سرچ‌کنسول هنوز تأییدنشده است
   (اقدام معوق ۱، بند ۱۳.۱) — گام ۹ مستقل از نتیجه کار می‌کند.

---

## ۱۱. بازگشت (rollback)

ترتیب معکوس، بدون اثر بر پادل‌یار:

```bash
# ۱) قطع ترافیک لبه: بلوک mazane.online از Caddyfile پادل‌یار حذف/کامنت شود
docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile

# ۲) خواباندن مظنه (داده‌ها در volume می‌مانند):
docker compose -f /opt/mazane/compose.prod.yml down
# پاک‌سازی کامل (فقط اگر عمداً بخواهید تاریخچه هم برود): down -v

# ۳) اختیاری: docker network disconnect mazane-edge $CADDY
# ۴) 👤 آروان: pause پراکسی یا حذف رکورد — فقط اگر لازم شد
```

هر مرحله برگشت‌پذیر است؛ `docker compose up -d` دوباره همه‌چیز را برمی‌گرداند
(ایمیج‌ها روی سرور می‌مانند).

---

## ۱۲. چک‌لیست جمع‌بندی جلسه‌ی استقرار

- [ ] ۱.۱ CI سبز است و `.output/nitro.json` پریست `node-server` دارد
      (دود-تست ایمیج وب در جاب `images` پاس شده)
- [ ] ۱.۲ 👤 تصمیم رجیستری + سیم‌کشی push (در صورت GHCR)
- [ ] ۲ 👤 عکس وضعیت پادل‌یار ثبت شد
- [ ] ۳ 👤 چهار سرویس healthy؛ مهاجرت‌ها اعمال؛ `127.0.0.1:3300` پاسخ ۲۰۰
- [ ] ۴ 👤 پادل‌یار سالم (بعد از هر گام)
- [ ] ۵ 👤 کدی reload شد؛ `mazane.online` از لبه‌ی کدی سرو می‌شود
- [ ] ۶ 👤 آروان: DNS پراکسی‌دار + کش پیرو هدر مبدأ
- [ ] ۷ 👤 **آزمون ۲۰۰ کهنه پاس و شواهدش ثبت شد** (پیش‌شرط لانچ)
- [ ] ۸ 👤 پایش بیرونی روی `/` و `/robots.txt` فعال
- [ ] ۹ اولین اجرای `verify-googlebot.py` انجام و زمان‌بندی هفتگی گذاشته شد
- [ ] ۱۰ 👤 TXT سرچ‌کنسول تأیید شد
