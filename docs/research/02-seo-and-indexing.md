---
title: "SEO، ایندکس شدن در گوگل و سیاست‌های محتوایی برای مضنه آنلاین"
date: 2026-08-06
scope: >-
  پژوهش مبتنی بر منابع دست‌اول (Google Search Central، schema.org، web.dev، RFCها،
  و مستندات رسمی فریم‌ورک‌ها) دربارهٔ ریسک «Thin affiliate»، مکانیزم‌های ایندکس شدن،
  داده‌های ساخت‌یافته، SEO فارسی/RTL، محدودیت‌های ایران، و انتخاب استراتژی رندرینگ.
status: draft
audience: تیم فنی و محتوایی tablo.gold
---

# SEO، ایندکس شدن و سیاست‌های گوگل برای مضنه آنلاین

> ⚠️ **بازنگری‌شده در ۲۰۲۶-۰۸-۱۰ — سند تصمیم ۰۰۰۲.** این سند یافته‌های تحقیق
> در تاریخ خودش را ثبت می‌کند و دست‌نخورده می‌ماند. ولی توصیه‌هایش درباره‌ی
> «قیمت مؤثر» دیگر مبنای پیاده‌سازی نیستند: از هر سکو **یک قیمت** (پیش از
> کارمزد) ثبت می‌شود و دو کارمزد **جدا** کنارش می‌نشیند. مشخصات جاری در
> `CONTEXT.md` و `docs/design/` است.
>
> ‏⚠️ **تغییر نام ۲۰۲۶-۰۸-۱۰:** برند از «مظنه آنلاین» به «تابلو» تغییر کرد.
> هرجا در همین سند نام قدیم آمده، ثبت تاریخی است. واژه‌ی «مظنه» به‌عنوان
> اصطلاح بازار (قیمت مثقال طلای آب‌شده) سر جایش است — آن نام ما نبود،
> واژه‌ی دامنه است.

> **قاعدهٔ این سند:** هر ادعا با URL منبع مالکِ آن ادعا همراه است. جایی که حرف من است نه حرف گوگل، صریحاً با برچسب **[توصیهٔ من]** مشخص شده. جایی که منبع درجه‌دوم است، با **[منبع ثانویه]** علامت خورده.
>
> **تاریخ گردآوری:** ۱۴۰۵/۰۵/۱۵ معادل 2026-08-06. مستندات گوگل به‌سرعت تغییر می‌کنند؛ چند مورد در این سند با دانش رایج SEO در تضاد است و در آن موارد **مستند زنده ملاک است** (پرچم‌گذاری شده‌اند).

---

## ۰. خلاصهٔ مدیریتی — هشت چیزی که تصمیم را عوض می‌کند

| # | یافته | اثر بر پروژه |
|---|---|---|
| ۱ | «Thin affiliation» تخلف صریح است، اما محصولِ **قیمت مؤثر** (نه ticker) دقیقاً روی چهار مورد از پنج نمونهٔ افیلیتِ *مجازِ* خودِ گوگل می‌نشیند. | ریسک پایین — مشروط به اینکه جدول قیمت مؤثر **در HTML اولیه** باشد. |
| ۲ | لینک‌های افیلیت **باید** با `rel="sponsored"` (یا حداقل `nofollow`) علامت بخورند؛ گوگل صریحاً از احتمال **manual action** برای سایت‌هایی که این کار را نکنند می‌گوید. | یک خط کد، ولی وجودی. |
| ۳ | **FAQ rich result از ۷ مه ۲۰۲۶ کاملاً حذف شد** و مستنداتش در ۱۵ ژوئن ۲۰۲۶ پاک شد. HowTo و Sitelinks Searchbox هم قبلاً حذف شده بودند. | روی FAQPage/HowTo هیچ سرمایه‌گذاری‌ای نکنید. |
| ۴ | صفحهٔ قیمت **واجد شرایط merchant listing نیست** چون مضنه آنلاین فروشنده نیست. | فقط `Product` + `AggregateOffer` (product snippet) و آن هم با احتیاط. |
| ۵ | رندرینگ: SPA کلاینت‌ساید برای صفحه‌ای که هر چند دقیقه عوض می‌شود و باید crawlable باشد، اشتباه است. | ISR/SWR + SSG برای بلاگ. |
| ۶ | گوگل: خطای شبکه/DNS ⇒ «already indexed URLs that are unreachable **will be removed from Google's index within days**». | میزبانی **خارج از ایران** — تصمیم قطعی، بند ۷. |
| ۷ | **املای درست «مظنه» است و گوگل «مضنه» را به آن اصلاح می‌کند.** نام برند فعلی روی فرم غلط نشسته. | تغییر برند به «مظنه آنلاین»؛ دامنه بدون تغییر. بند ۸.۱. |
| ۸ | کوئری واقعی «کارمزد خرید طلا در **میلی**» است، نه «قیمت طلا». «اسپرد» فضای فارکس است. | موتور سئو = صفحات per-platform، نه صفحهٔ قیمت. بند ۸. |

---

## ۱. ریسک وجودی: سیاست «Thin affiliation» و سایت‌های مقایسه‌ای

این بخش را اول خواندم چون اگر مدل کسب‌وکار از نظر گوگل spam باشد، بقیهٔ سند بی‌معناست. **خبر خوب: نیست.**

### ۱.۰ حکم، در برابر محصول واقعی — نه یک سایت افیلیت عمومی

پژوهش موازی تیم، شکل محصول را قطعی کرده و این حکمِ سیاستی را از «شاید» به «تقریباً قطعاً امن» می‌برد. دادهٔ تعیین‌کننده:

> چهار پلتفرم اصلی (**WallGold، Milli، Talasea، Goldika**) قیمت پایه را در بازهٔ **۰٫۰۸٪** از هم اعلام می‌کنند — یعنی عملاً یکسان. اما **کارمزد رفت‌وبرگشت آن‌ها از ۱٪ تا ۲٫۴٪** فرق دارد.

این عدد، پاسخ کاملی به آزمون گوگل است. بگذارید صریح باشم دربارهٔ اینکه چرا:

**۱. محصول یک price ticker نیست، یک موتور محاسبه است.** اگر مضنه آنلاین فقط قیمت پایه را نشان می‌داد، چهار عدد تقریباً یکسان می‌دید و *واقعاً* مصداق thin affiliation بود — چون هیچ چیزی به کاربر نمی‌گفت که خودش با باز کردن چهار تب نفهمد. اما محصول واقعی، **قیمت مؤثر** است: `قیمت پایه + کارمزد خرید + کارمزد فروش + کارمزد برداشت + حداقل سفارش`. این عدد **در هیچ‌کدام از آن چهار سایت وجود ندارد** و از هیچ صفحه‌ای قابل کپی کردن نیست — فقط از محاسبه به دست می‌آید.

**۲. اختلاف ۱٪ تا ۲٫۴٪ یعنی ارزش‌افزوده قابل اندازه‌گیری و مادی است.** روی خرید ۱۰۰ میلیون تومان، انتخاب اشتباه پلتفرم = **۱٫۴ میلیون تومان** ضرر که کاربر هرگز متوجهش نمی‌شود چون قیمت‌های اعلامی یکسان‌اند. این دقیقاً همان «significant added benefits» است که گوگل در آزمون بند ۱.۲ می‌خواهد. آزمون گوگل می‌پرسد «آیا کاربر دلیلی دارد که به‌جای منبع اصلی به این سایت بیاید؟» — جواب اینجا نه فقط بله، بلکه **کمّی** است.

**۳. هیچ رقیبی این کار را نمی‌کند.** پژوهش تأیید کرده که هیچ سایت فارسی‌زبانی مقایسهٔ چندپلتفرمی انجام نمی‌دهد. یعنی محتوا نه کپی است، نه بازنشر، نه syndicated — سه چیزی که تعریف thin affiliation روی آن‌ها بنا شده.

**تطبیق مستقیم با فهرست خودِ گوگل:** سیاست گوگل پنج نمونهٔ صفحهٔ افیلیت *خوب* را نام می‌برد. محصول ما **چهارتای آن‌ها** را همزمان دارد:

| نمونهٔ گوگل (نقل مستقیم) | تحقق در مضنه آنلاین |
|---|---|
| "additional information about price" | ✅ **هستهٔ محصول** — قیمت مؤثر، اسپرد، کارمزد رفت‌وبرگشت |
| "product comparisons" | ✅ مقایسهٔ چهار پلتفرم در یک جدول |
| "rigorous testing and ratings" | ✅ شرایط هر پلتفرم، حداقل سفارش، زمان تسویه (نیازمند تست واقعی) |
| "navigation of products or categories" | ✅ تفکیک بر اساس نوع دارایی و حداقل سرمایه |
| "original product reviews" | ⚠️ **این تنها موردی است که هنوز نداریم** — صفحات بررسی پلتفرم |

**حکم:** با این شکل محصول، ریسک thin affiliation **پایین** است — نه به این دلیل که ما خوش‌بینیم، بلکه چون محصول عیناً روی چهار مورد از پنج نمونهٔ مجازِ خودِ گوگل می‌نشیند. **[این تطبیق، استنباط من از متن سیاست است؛ گوگل حکمی دربارهٔ سایت خاصی صادر نمی‌کند.]**

**اما — سه شرط که اگر نقض شوند حکم برمی‌گردد:**

1. **ماشین‌حساب باید در HTML رندرشده باشد، نه فقط پشت تعامل کاربر.** اگر قیمت مؤثر فقط بعد از کلیک کاربر محاسبه شود، Googlebot صفحه‌ای می‌بیند که فقط چهار عدد تقریباً یکسان دارد — یعنی *دقیقاً* همان چیزی که thin به نظر می‌رسد. **جدول قیمت مؤثر برای همهٔ پلتفرم‌ها باید در HTML اولیه باشد.** این مهم‌ترین پل میان بند ۱ و بند ۵ این سند است.
2. **روش‌شناسی باید منتشر شود.** فرمول محاسبهٔ قیمت مؤثر، منبع هر عدد کارمزد، و تاریخ آخرین راستی‌آزمایی. بدون این، ادعای «۲٫۴٪» غیرقابل‌راستی‌آزمایی است و در حوزهٔ YMYL (بند ۱.۵) ضعف trust محسوب می‌شود.
3. **ترتیب جدول باید بر اساس قیمت مؤثر باشد، نه کمیسیون.** اگر پلتفرمی با کارمزد ۲٫۴٪ به‌خاطر کمیسیون بالاتر اول جدول بیاید، کل ادعای ارزش‌افزوده فرو می‌ریزد و از «مقایسهٔ بی‌طرف» به «تبلیغات پنهان» تبدیل می‌شود.

### ۱.۱ متن دقیق سیاست

صفحهٔ رسمی: <https://developers.google.com/search/docs/essentials/spam-policies> — آخرین به‌روزرسانی مندرج در خود صفحه: **2026-05-15 UTC**.

سرفصل‌های کامل این صفحه امروز: Cloaking، Doorway abuse، Expired domain abuse، Hacked content، Hidden text and link abuse، Keyword stuffing، Link spam، Machine-generated traffic، Malicious practices، Misleading functionality، Scaled content abuse، Scraping، Site reputation abuse، Sneaky redirects، **Thin affiliation**، User-generated spam.

**تعریف تخلف (نقل مستقیم):**

> "Thin affiliation is the practice of publishing content with product affiliate links where the product descriptions and reviews are copied directly from the original merchant without any original content or added value."

و در ادامه:

> "Affiliate pages can be considered thin if they are a part of a program that distributes its content across a network of affiliates without providing additional value."

**و اینجا نکتهٔ حیاتی است — گوگل خودش مسیر مجاز را نام می‌برد:**

> "Good affiliate sites add value by offering meaningful content or features. Examples of good affiliate pages include offering **additional information about price**, **original product reviews**, **rigorous testing and ratings**, **navigation of products or categories**, and **product comparisons**."

یعنی دقیقاً همان چیزی که مضنه آنلاین قرار است باشد: «اطلاعات اضافه دربارهٔ قیمت» + «مقایسهٔ محصولات» + «بررسی اصیل». مدل کسب‌وکار در متن سیاست به‌عنوان نمونهٔ **خوب** ذکر شده، نه بد.

### ۱.۲ آزمون تعیین‌کنندهٔ گوگل

پست رسمی وبلاگ Search Central (۲۰۱۴، هنوز معتبر و از خودِ گوگل): <https://developers.google.com/search/blog/2014/01/affiliate-programs-and-added-value>

> "Does this site provide significant added benefits that would make a user want to visit this site in search results instead of the original source of the content?"

اگر جواب «نه» باشد، گوگل می‌گوید ممکن است اقدام کند، از جمله **حذف از ایندکس**.

**ترجمهٔ عملی برای مضنه آنلاین:** آیا کاربری که می‌خواهد طلا بخرد، دلیلی دارد که به‌جای رفتن مستقیم به سایت پلتفرم X، اول به مضنه بیاید؟ اگر تنها چیزی که ارائه می‌دهیم «قیمت X را از سایت X کپی کرده‌ایم» باشد، جواب نه است.

### ۱.۳ چه چیزی مضنه آنلاین را از thin بیرون می‌آورد — چک‌لیست ارزش‌افزوده

**[توصیهٔ من — این فهرست استنباط من از متن سیاست است، نه فهرست رسمی گوگل]**

آنچه باید بسازیم و *هیچ‌کدام از پلتفرم‌های مقصد ندارند*:

1. **داده‌ای که فقط از تجمیع به دست می‌آید:**
   - اسپرد خرید/فروش هر پلتفرم (مضنه) و مقایسهٔ آن — این خودِ اسم برند است.
   - کارمزد مؤثر: قیمت اعلامی + کارمزد + کارمزد برداشت = «قیمت واقعی تمام‌شده». هیچ پلتفرمی این را نمی‌گوید.
   - نمودار تاریخی اختلاف قیمت پلتفرم‌ها (داده‌ای که فقط ما داریم چون ما هستیم که هر دقیقه snapshot می‌گیریم).
   - «الان ارزان‌ترین کجاست» با timestamp قابل راستی‌آزمایی.
2. **تست و رتبه‌بندی واقعی** (گوگل عین کلمهٔ "rigorous testing and ratings" را دارد):
   - زمان واقعی تسویه/برداشت طلا در هر پلتفرم، تست‌شده توسط تیم.
   - رفتار پشتیبانی، احراز هویت، حداقل خرید، امکان تحویل فیزیکی.
3. **محتوای تجربی (Experience در E-E-A-T):** «ما ۱۰ میلیون تومان در پنج پلتفرم خریدیم؛ این نتیجه بود.»
4. **پیمایش و دسته‌بندی:** فیلتر بر اساس نوع دارایی (طلای آب‌شده / سکه / گرمی)، حداقل سرمایه، امکان فروش فوری.

### ۱.۴ خطرهای جانبی که باید فعالانه اجتناب کرد

| تخلف | متن گوگل | ریسک مضنه |
|---|---|---|
| **Scaled content abuse** | "Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users." | **بالا.** وسوسهٔ تولید خودکار «قیمت طلا در [شهر]» × ۱۰۰۰ شهر، یا مقالات LLM انبوه. **نکنید.** |
| **Site reputation abuse** | "…third-party content is published on a host site mainly because of that host's already-established ranking signals…" | پایین امروز؛ اگر بعداً «رپورتاژ» فروختید، بالا می‌شود. |
| **Scraping** | تخلف مستقل در همان صفحه | اگر توضیحات پلتفرم‌ها را کپی کنیم. |
| **Cloaking** | "…presenting different content to users and search engines with the intent to manipulate search rankings" | اگر برای Googlebot قیمت‌های کامل و برای کاربر paywall نشان دهیم. |

> **[توصیهٔ من]** محتوای تولیدشده با AI ممنوع نیست — گوگل در <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content> آن را رد نکرده — اما تولید انبوهِ بی‌ارزش، مصداق Scaled content abuse است. قاعدهٔ ایمن: هر مقاله باید حداقل یک دادهٔ اختصاصی مضنه (نمودار، جدول مقایسه، عدد تست‌شده) داشته باشد که در جای دیگری نیست.

### ۱.۵ E-E-A-T و YMYL — چرا برای مضنه مضاعف مهم است

منبع: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content> (به‌روزرسانی 2025-12-10)

> "…experience, expertise, authoritativeness, and trustworthiness… **trust is most important.** The others contribute to trust, but content doesn't necessarily have to demonstrate all of them."

قیمت طلا و سرمایه‌گذاری = **YMYL (Your Money or Your Life)**. گوگل در همین صفحه می‌گوید برای موضوعاتی که «could impact health, financial stability, or safety» استاندارد کیفیت بالاتر است.

سؤالات «Who, How, Why» که گوگل مطرح می‌کند و ما باید در سایت به آن‌ها جواب بدهیم:

- **Who:** "Is it self-evident to your visitors who authored your content?" و "Do bylines lead to further information about the author?"
  → **الزام:** هر مقاله نویسندهٔ نام‌دار با صفحهٔ پروفایل. صفحهٔ «دربارهٔ ما» با هویت حقیقی/حقوقی، نشانی، تماس.
- **How:** "Is the use of automation, including AI-generation, self-evident to visitors?"
  → **الزام:** اگر قیمت‌ها خودکار جمع می‌شوند، بنویسید «به‌روزرسانی خودکار هر ۶۰ ثانیه، منبع: API رسمی پلتفرم X».
- **Why:** گوگل می‌گوید این «perhaps the most important question» است — محتوا باید برای آدم‌ها باشد، نه برای رتبه.

**افشای مدل درآمدی:** گوگل این را جای دیگری الزام نکرده، اما در بخش trust مستقیماً مرتبط است، و از منظر قوانین تبلیغات هم لازم است. **[توصیهٔ من]** یک صفحهٔ «چطور درآمد کسب می‌کنیم» + یک بنر کوچک روی جدول مقایسه که می‌گوید برخی لینک‌ها ارجاعی‌اند و این روی ترتیب نمایش اثر ندارد (و واقعاً هم نگذارید اثر بگذارد — رتبه‌بندی باید بر اساس قیمت باشد نه کمیسیون).

### ۱.۶ سیاست جدید نقدها (۲۴ ژوئیه ۲۰۲۶)

<https://developers.google.com/search/docs/appearance/structured-data/review-snippet> — گوگل در ژوئیه ۲۰۲۶ بند تازه‌ای اضافه کرد:

> "Don't include fake or undisclosed incentivized reviews on your page or in your structured data markup."

مصادیق: نقدی که نویسنده‌اش واقعاً محصول را تجربه نکرده، یا در ازای پول/تخفیف/کد/محصول رایگان نوشته شده **بدون افشای صریح**.

**و یک قاعدهٔ حیاتی برای ما:**

> صفحاتی که در آن‌ها موجودیت، خودش را نقد می‌کند واجد شرایط star review نیستند — این برای `LocalBusiness` و `Organization` وقتی صدق می‌کند که "the entity that's being reviewed controls the reviews about itself".

یعنی: مضنه آنلاین **نمی‌تواند** برای خودش AggregateRating بگذارد، اما **می‌تواند** پلتفرم‌های ثالث را نقد کند و برای آن‌ها markup بزند (این self-serving نیست).

### ۱.۷ الزام `rel` روی لینک‌های درآمدزا — دقیق‌ترین بخش این سند

منبع مالک: <https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links> (به‌روزرسانی مندرج: **10 دسامبر 2025**)

سه مقدار وجود دارد:

| مقدار | کاربرد طبق گوگل |
|---|---|
| `rel="sponsored"` | "Mark links that are advertisements or paid placements (commonly called paid links) with the `sponsored` value." |
| `rel="ugc"` | لینک‌های داخل محتوای کاربر (کامنت، فروم) |
| `rel="nofollow"` | حالت عمومی — "The `nofollow` attribute was previously recommended for these types of links and is still an acceptable way to flag them, though `sponsored` is preferred." |

**پاسخ دقیق به سؤال «کدام attribute؟»:**

- لینک افیلیت/ارجاعی → **`rel="sponsored"`**. این انتخاب ترجیحی و صریح گوگل است.
- `rel="nofollow"` هنوز پذیرفتنی است ولی ترجیحی نیست.
- ترکیب مجاز است: "You may specify multiple `rel` values as a space- or comma-separated list" — مثل `rel="ugc nofollow"`.
- گوگل این‌ها را **hint** می‌داند نه directive مطلق: "Links marked with these `rel` attributes will generally not be followed."

**اگر نگذاریم چه می‌شود؟** خودِ صفحهٔ qualify-outbound-links عواقب را ننوشته، اما پست رسمی وبلاگ Search Central با تاریخ **۲۶ ژوئیه ۲۰۲۱** نوشته است:
<https://developers.google.com/search/blog/2021/07/link-tagging-and-link-spam-update>

گوگل در آن پست از سایت‌های عضو برنامه‌های افیلیت می‌خواهد که این لینک‌ها را با `rel="sponsored"` علامت بزنند — **فرقی نمی‌کند لینک دستی ساخته شده باشد یا داینامیک** — و می‌گوید در صورت مشاهدهٔ سایت‌هایی که این کار را نمی‌کنند ممکن است **manual action** صادر کند تا آن لینک‌ها روی Search اثر نگذارند، و سیستم‌هایش نیز ممکن است اقدام الگوریتمی کنند. [بخشی از جزئیات این پست از خلاصهٔ جست‌وجو گرفته شده — **منبع ثانویه** برای عبارت‌بندی دقیق، اما URL و تاریخ اول‌شخص است.]

**پیاده‌سازی الزامی برای مضنه آنلاین:**

```html
<!-- هر لینک خروجی به پلتفرم که کمیسیون دارد -->
<a href="https://platform.example/ref?aff=mazane"
   rel="sponsored nofollow noopener"
   target="_blank">خرید از پلتفرم X</a>
```

نکات پیاده‌سازی:

- اگر لینک‌ها را با **ریدایرکت داخلی** می‌سازید (`/go/platform-x`)، هم روی `<a>` مبدأ `rel="sponsored"` بگذارید، **هم** مسیر `/go/*` را در `robots.txt` ببندید:
  ```
  User-agent: *
  Disallow: /go/
  ```
- اگر لینک با JavaScript ساخته می‌شود، همچنان `rel` را در DOM قرار دهید (گوگل صفحه را رندر می‌کند — بند ۵.۱).
- بنرهای تبلیغاتی هم `rel="sponsored"` می‌خواهند، نه فقط لینک‌های متنی.

---

## ۲. مکانیزم ایندکس شدن

### ۲.۱ Google Search Console

سه ابزار اصلی:

1. **گزارش Sitemaps** — ثبت آدرس sitemap.
2. **URL Inspection** — دیدن وضعیت ایندکس یک URL و «Request Indexing». صفِ دستی است و سهمیهٔ روزانه دارد؛ برای راه‌اندازی اولیه چند صفحهٔ کلیدی خوب است، برای عملیات روزمره خیر.
3. **Performance report** — و از **ژوئن ۲۰۲۶** گزارش تازهٔ **Generative AI performance** برای دیدن عملکرد در AI Overviews / AI Mode:
   <https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports>

### ۲.۲ Indexing API — نه، برای ما نیست

<https://developers.google.com/search/apis/indexing-api/v3/quickstart>

> "The Indexing API can only be used to crawl pages with either `JobPosting` or `BroadcastEvent` embedded in a `VideoObject`."

**نتیجهٔ قاطع:** Indexing API برای صفحات قیمت، صفحات مقایسه یا بلاگ **مجاز نیست**. استفادهٔ خارج از این دو نوع، سوءاستفاده محسوب می‌شود. هر ابزار/افزونه‌ای که ادعا کند «با Indexing API صفحاتت را فوری ایندکس می‌کنیم» دارد شما را به تخلف می‌برد. برای بقیهٔ صفحات، گوگل خودش می‌گوید از sitemap استفاده کنید.

### ۲.۳ sitemap.xml — مشخصات و معنای `lastmod`

**مشخصات پروتکل:** <https://www.sitemaps.org/protocol.html>

- تگ‌های الزامی: `<urlset>`, `<url>`, `<loc>`. اختیاری: `<lastmod>`, `<changefreq>`, `<priority>`.
- محدودیت: "each Sitemap file that you provide must have no more than **50,000 URLs** and must be no larger than **50MB (52,428,800 bytes)**"
- فایل ایندکس: "may not list more than **50,000 Sitemaps** and must be no larger than 50MB"
- فرمت تاریخ: W3C Datetime — می‌شود فقط `YYYY-MM-DD` بود.
- **کدگذاری:** فایل باید UTF-8 باشد و URLها باید با RFC-3986 (URI)، RFC-3987 (IRI) و استاندارد XML سازگار باشند؛ همچنین همهٔ مقادیر XML باید escape شوند (`&` → `&amp;`). ← **این برای اسلاگ‌های فارسی حیاتی است، بند ۴.۴.**

**آنچه گوگل خودش می‌گوید:** <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>

- "All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."
- **`lastmod`:** "Google uses the `<lastmod>` value **if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate**."
  → **این جملهٔ کلیدی است.** اگر برای همهٔ URLها `lastmod` را روی `now()` بگذاریم چون قیمت‌ها هر دقیقه عوض می‌شوند، گوگل اعتماد به `lastmod` سایت را از دست می‌دهد و کلاً نادیده‌اش می‌گیرد.
  **[توصیهٔ من]** `lastmod` را فقط بر اساس **تغییر معنادار محتوا** (متن تحلیل، افزوده شدن پلتفرم، ویرایش مقاله) به‌روز کنید، نه بر اساس نوسان عدد قیمت.
- "Google **ignores** `<priority>` and `<changefreq>` values." ← این دو تگ برای گوگل بی‌اثرند. (Next.js هنوز آن‌ها را در خروجی می‌گذارد؛ بی‌ضرر است.)
- ثبت: از طریق گزارش Sitemaps در Search Console، Search Console API، یا خط `Sitemap:` در robots.txt.

**[توصیهٔ من] ساختار سایت‌مپ برای مضنه آنلاین** (سه سایت‌مپ زیر یک ایندکس):

```
/sitemap.xml            → sitemap index
  /sitemaps/core.xml    → صفحهٔ اصلی، صفحات مقایسه، صفحات هر دارایی، صفحات پلتفرم
  /sitemaps/blog.xml    → مقالات، lastmod = تاریخ آخرین ویرایش واقعی
  /sitemaps/pages.xml   → دربارهٔ ما، تماس، روش کسب درآمد، حریم خصوصی
```

### ۲.۴ robots.txt

<https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt> و استاندارد **RFC 9309** (<https://www.rfc-editor.org/rfc/rfc9309.html>)

- محل: "You must place the robots.txt file in the top-level directory of a site, on a supported protocol." قوانین فقط برای همان host/protocol/port اعمال می‌شود.
- **محدودیت حجم:** "Google enforces a robots.txt file size limit of **500 kibibytes (KiB)**. Content which is after the maximum file size is ignored."
- فیلدهای پشتیبانی‌شده: `user-agent`, `allow`, `disallow`, `sitemap`.
- **تمایز خزش و ایندکس (اشتباه رایج):** "Google can't index the content of pages which are disallowed for crawling, but it may still index the URL and show it in search results without a snippet."
  → برای جلوگیری از ایندکس باید `noindex` بگذارید و صفحه را **باز** بگذارید تا خزیده شود. `Disallow` + `noindex` با هم = گوگل هرگز `noindex` را نمی‌بیند.
- کش: "Google generally caches the contents of robots.txt file for up to **24 hours**."

**[توصیهٔ من] robots.txt پیشنهادی:**

```
User-agent: *
Allow: /
Disallow: /go/
Disallow: /api/
Disallow: /*?sort=
Disallow: /*?utm_

Sitemap: https://tablo.gold/sitemap.xml
```

### ۲.۵ IndexNow — مفید ولی نه برای گوگل

<https://www.indexnow.org/>

موتورهای مشارکت‌کنندهٔ اعلام‌شده روی صفحهٔ رسمی: **Microsoft Bing, Naver, Seznam.cz, Yandex, Yep**.

**گوگل در این فهرست نیست.** گوگل IndexNow را پشتیبانی نمی‌کند. (گوگل در ۲۰۲۱ اعلام کرد در حال آزمایش است؛ تا امروز 2026-08-06 در فهرست رسمی indexnow.org نیامده. **[منبع ثانویه]** برای تاریخچه؛ **منبع اول‌شخص** = فهرست فعلی indexnow.org.)

**[توصیهٔ من]** IndexNow را پیاده کنید (هزینه‌اش نزدیک صفر است: یک فایل کلید در ریشه + یک POST هنگام انتشار مقاله) اما فقط برای Bing/Yandex. **هیچ اثری روی ایندکس گوگل نخواهد داشت** — انتظار اشتباه نداشته باشید.

### ۲.۶ Crawl budget — به ما ربطی ندارد

<https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget>

گوگل مخاطب این راهنما را صریحاً تعریف کرده: سایت‌های **بیش از ۱ میلیون** صفحهٔ یکتا با تغییر هفتگی، یا **بیش از ۱۰٬۰۰۰** صفحهٔ یکتا با تغییر روزانه، یا سایت‌هایی که بخش زیادی از صفحاتشان در Search Console «Discovered - currently not indexed» است.

> "If your site doesn't have a large number of pages that change rapidly, or if your pages seem to be crawled the same day that they are published, **you don't need to read this guide**."

**نتیجه برای مضنه آنلاین:** با چند ده تا چند صد صفحه، crawl budget مسئلهٔ شما نیست. **وقت را روی کیفیت محتوا بگذارید نه بهینه‌سازی crawl budget.** تنها استثنا: اگر صفحات فیلتر/مرتب‌سازی را کنترل نکنید، ممکن است هزاران URL پارامتری بسازید و مصنوعاً وارد این دسته شوید — که با `Disallow` و canonical حل می‌شود (بند بعد).

### ۲.۷ Canonical برای صفحه‌ای که مدام عوض می‌شود

<https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>

روش‌ها به ترتیب قدرتی که گوگل اعلام کرده:

1. **Redirect** — "A strong signal that the target of the redirect should become canonical."
2. **`rel="canonical"`** — "A strong signal that the specified URL should become canonical."
3. **Sitemap** — "A weak signal."
4. **HTTP header `Link: <...>; rel="canonical"`** — برای فایل‌های غیر HTML.

گوگل canonical را **hint** می‌داند نه directive: "if you don't specify a canonical URL, Google will identify which version of the URL is objectively the best version."

و توصیهٔ صریح: "Do include a `rel="canonical"` link on the canonical page itself (also known as a self-referential canonical)."

**نکتهٔ مهم دربارهٔ صفحهٔ قیمت:** canonical ربطی به **تازگی** محتوا ندارد — ربطی به **آدرس** دارد. تغییر مکرر قیمت هیچ اثری روی canonical ندارد. مسئلهٔ واقعی، URLهای پارامتری است.

**[توصیهٔ من] معماری URL برای صفحات قیمت:**

```
/                                  ← داشبورد زندهٔ مقایسه (canonical به خودش)
/gold/abshode                      ← طلای آب‌شده: مقایسه در همهٔ پلتفرم‌ها
/gold/coin-emami                   ← سکه امامی
/platform/talasea                  ← صفحهٔ بررسی پلتفرم
/blog/<slug>                       ← مقاله

# اینها نباید URL جدا بسازند:
/?sort=price   → canonical به /
/?ref=xyz      → canonical به /  + Disallow در robots.txt
```

- هر صفحه یک self-referential canonical مطلق (`https://tablo.gold/gold/abshode`) داشته باشد.
- فیلتر و مرتب‌سازی را با `history.replaceState` یا بدون تغییر URL انجام دهید تا اصلاً URL جدید ساخته نشود. **[توصیهٔ من]**
- برای «تازگی»، به‌جای canonical از `dateModified` در structured data و نمایش timestamp در متن صفحه استفاده کنید.

---

## ۳. داده‌های ساخت‌یافته — کدام‌ها واقعاً rich result می‌دهند

### ۳.۱ وضعیت امروز (2026-08-06) — این جدول با دانش رایج SEO تضاد دارد

منبع مالک: <https://developers.google.com/search/docs/appearance/structured-data/search-gallery> — **آخرین به‌روزرسانی صفحه: 15 ژوئن 2026**.

انواعی که امروز در گالری رسمی گوگل هستند: Article، Breadcrumb، Carousel، Course list، Dataset، Discussion forum، Education Q&A، Employer aggregate rating، Event، Image metadata، Job posting، Local business، Math solver، Movie، Organization، Product (+ Merchant listing، Product variants، Loyalty program، Merchant return policy، Merchant shipping policy)، Profile page، Q&A، Recipe، Review snippet، Software app، Speakable، Subscription and paywalled content، Vacation rental، Video، Book actions.

| نوع | وضعیت برای گوگل امروز | حکم برای مضنه |
|---|---|---|
| `Article` / `BlogPosting` | ✅ پشتیبانی می‌شود | **استفاده کن** — بلاگ |
| `BreadcrumbList` | ✅ پشتیبانی می‌شود | **استفاده کن** — همه‌جا |
| `Organization` | ✅ پشتیبانی می‌شود | **استفاده کن** — صفحهٔ اصلی/دربارهٔ ما |
| `Product` + `Offer` (merchant listing) | ✅ ولی **ما واجد شرایط نیستیم** | ❌ |
| `Product` + `AggregateOffer` (product snippet) | ✅ پشتیبانی می‌شود | ⚠️ با احتیاط — بند ۳.۳ |
| `Review` / `AggregateRating` (review snippet) | ✅ پشتیبانی می‌شود | **استفاده کن** — صفحهٔ بررسی پلتفرم |
| `WebSite` (name/alternateName) | ✅ برای Site name | **استفاده کن** — فقط صفحهٔ اصلی |
| `WebSite` + `SearchAction` (Sitelinks Searchbox) | ❌ **حذف شده — ۲۱ نوامبر ۲۰۲۴** | ❌ ننویس |
| `FAQPage` | ❌ **حذف کامل — ۷ مه ۲۰۲۶** | ❌ ننویس |
| `HowTo` | ❌ **حذف شده — ۲۰۲۵** | ❌ ننویس |
| `FinancialProduct` | schema.org دارد، **گوگل rich result نمی‌دهد** | اختیاری/بی‌اثر |
| `ExchangeRateSpecification` | schema.org **pending**، گوگل rich result نمی‌دهد | ❌ بی‌فایده |

### ۳.۲ جزئیات حذف‌ها — با تاریخ و منبع

**FAQ — این مهم‌ترین تغییری است که احتمالاً هنوز در هیچ آموزش SEO فارسی منعکس نشده:**

مسیر کامل:
1. **۸ اوت ۲۰۲۳** — <https://developers.google.com/search/blog/2023/08/howto-faq-changes> — گوگل FAQ rich result را محدود کرد به "well-known, authoritative government and health websites"، و HowTo را فقط به دسکتاپ.
2. **۲۰۲۵** — HowTo کاملاً حذف شد و مستنداتش پاک شد (اعلام در <https://developers.google.com/search/blog/2025/06/simplifying-search-results>). امروز HowTo در گالری وجود ندارد.
3. **۸ مه ۲۰۲۶** — changelog رسمی گوگل (<https://developers.google.com/search/updates>): «Added deprecation notice to FAQ rich result documentation (feature removed **May 7, 2026**).»
4. **۱۵ ژوئن ۲۰۲۶** — changelog: «Removed FAQ rich result feature documentation as it no longer appears in Google Search results.»

**Sitelinks Searchbox:** <https://developers.google.com/search/blog/2024/10/sitelinks-search-box> — «Farewell, Sitelinks Search Box» — حذف از **۲۱ نوامبر ۲۰۲۴**، جهانی، در همهٔ زبان‌ها.

**نکتهٔ آرامش‌بخش از خود گوگل:** markup منسوخ ضرری ندارد — "Unsupported structured data like this won't cause issues in Search, and won't trigger errors in Search Console reports." پس اگر جایی FAQPage نوشتید، فاجعه نیست؛ فقط بی‌فایده است. **ولی وقت و پول رویش نگذارید.**

### ۳.۳ آیا می‌شود قیمت طلا را `Product`/`Offer` مارک‌آپ کرد؟

**پاسخ کوتاه: merchant listing نه، product snippet شاید.**

منبع: <https://developers.google.com/search/docs/appearance/structured-data/merchant-listing>

> "Only pages where a shopper can purchase a product are eligible for merchant listing experiences, **not pages with links to other sites that sell the product**."

> "merchant listings require an `Offer` as the merchant has to be the seller of the product."

> "Product snippets accept an `Offer` or `AggregateOffer` but merchant listings require an `Offer`."

**مضنه آنلاین دقیقاً همان «صفحه‌ای با لینک به سایت‌های دیگری که محصول را می‌فروشند» است.** پس merchant listing از ابتدا منتفی است.

اما product snippet: <https://developers.google.com/search/docs/appearance/structured-data/product-snippet>

- `AggregateOffer` پذیرفته می‌شود.
- الزامی: `lowPrice` («The lowest price of all offers available») و `priceCurrency` (ISO 4217 سه‌حرفی).
- اختیاری: `highPrice`، `offerCount`.
- product snippet برای «product review pages, editorial content, and shopping aggregator sites» است — یعنی دقیقاً دستهٔ ما.

**⚠️ سه هشدار جدی:**

1. **ارز:** ISO 4217 سه‌حرفی الزامی است. ریال ایران = **`IRR`**. **تومان کد ISO ندارد.** اگر قیمت‌ها را به تومان نشان می‌دهید، در markup باید عدد را به ریال (×۱۰) تبدیل کنید و `"priceCurrency": "IRR"` بگذارید — وگرنه دادهٔ ساخت‌یافته دروغ است.
2. **قاعدهٔ visibility:** <https://developers.google.com/search/docs/appearance/structured-data/sd-policies> — "Don't mark up content that is not visible to readers of the page" و "Your structured data must be a true representation of the page content." پس `lowPrice` باید همان عددی باشد که کاربر روی صفحه می‌بیند، در همان لحظه. اگر صفحه cache شده و قیمت داخل HTML قدیمی است، markup هم باید همان قدیمی باشد (سازگار)، نه عدد زندهٔ متفاوت.
3. **جریمهٔ تخلف:** "A structured data manual action means that a page loses eligibility for appearance as a rich result; it doesn't affect how the page ranks in Google web search." — یعنی جریمهٔ structured data فقط rich result را می‌گیرد، رتبه را نمی‌زند. ریسک محدود است، ولی صفر نیست.

> **[توصیهٔ من]** `Product` + `AggregateOffer` را **فقط روی صفحات دارایی مشخص** (`/gold/coin-emami`) بگذارید که واقعاً یک محصول قابل‌تعریف است، نه روی داشبورد کلی. برای «طلای آب‌شده» که کالای استانداردِ گرمی است، من شخصاً محافظه‌کارانه عمل می‌کنم و فقط `Article`/`Dataset` می‌زنم، چون «محصول» بودنش قابل مناقشه است و ریسکِ «misleading» دارد.

### ۳.۴ نمونه‌های آمادهٔ JSON-LD

#### الف) صفحهٔ اصلی / داشبورد مقایسه

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://tablo.gold/#website",
      "url": "https://tablo.gold/",
      "name": "مضنه آنلاین",
      "alternateName": ["Mazane Online", "مضنه"],
      "inLanguage": "fa-IR",
      "publisher": { "@id": "https://tablo.gold/#organization" }
    },
    {
      "@type": "Organization",
      "@id": "https://tablo.gold/#organization",
      "name": "مضنه آنلاین",
      "alternateName": "Mazane Online",
      "url": "https://tablo.gold/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://tablo.gold/logo.png",
        "width": 512,
        "height": 512
      },
      "description": "مقایسهٔ زندهٔ قیمت طلا در پلتفرم‌های معاملهٔ آنلاین طلای ایران",
      "email": "info@tablo.gold",
      "sameAs": [
        "https://t.me/mazaneonline",
        "https://www.instagram.com/mazaneonline"
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "خانه", "item": "https://tablo.gold/" }
      ]
    }
  ]
}
```

> **توجه:** `WebSite` باید **فقط روی صفحهٔ اصلی** باشد. گوگل: "The `WebSite` structured data must be on the home page of a site."
> (<https://developers.google.com/search/docs/appearance/site-names>)
>
> `Organization` هم طبق <https://developers.google.com/search/docs/appearance/structured-data/organization>: "We recommend placing this information on your home page, or a single page that describes your organization, for example the *about us* page. You don't need to include it on every page of your site."
>
> **`SearchAction` عمداً حذف شده** — بند ۳.۲.

#### ب) صفحهٔ یک دارایی مشخص با مقایسهٔ قیمت — `/gold/coin-emami`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": "https://tablo.gold/gold/coin-emami#product",
      "name": "سکه تمام بهار آزادی طرح امام",
      "description": "مقایسهٔ زندهٔ قیمت خرید و فروش سکه امامی در پلتفرم‌های معاملهٔ آنلاین طلا",
      "image": "https://tablo.gold/images/coin-emami.jpg",
      "category": "طلا و سکه",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "IRR",
        "lowPrice": "920000000",
        "highPrice": "934500000",
        "offerCount": 6,
        "offers": [
          {
            "@type": "Offer",
            "priceCurrency": "IRR",
            "price": "920000000",
            "availability": "https://schema.org/InStock",
            "url": "https://tablo.gold/go/platform-a",
            "seller": { "@type": "Organization", "name": "پلتفرم الف" }
          },
          {
            "@type": "Offer",
            "priceCurrency": "IRR",
            "price": "934500000",
            "availability": "https://schema.org/InStock",
            "url": "https://tablo.gold/go/platform-b",
            "seller": { "@type": "Organization", "name": "پلتفرم ب" }
          }
        ]
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "خانه", "item": "https://tablo.gold/" },
        { "@type": "ListItem", "position": 2, "name": "طلا", "item": "https://tablo.gold/gold" },
        { "@type": "ListItem", "position": 3, "name": "سکه امامی", "item": "https://tablo.gold/gold/coin-emami" }
      ]
    }
  ]
}
```

> `priceCurrency` = `IRR` و اعداد به **ریال**. اگر روی صفحه تومان نشان می‌دهید، این تبدیل را در سمت سرور انجام دهید.
> اعداد باید با آنچه در HTML رندرشده دیده می‌شود یکی باشد.

#### ج) صفحهٔ بررسی یک پلتفرم — `/platform/example-gold`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Review",
      "@id": "https://tablo.gold/platform/example-gold#review",
      "headline": "بررسی کامل پلتفرم اگزمپل‌گلد: کارمزد، اسپرد و سرعت برداشت",
      "reviewBody": "ما با خرید واقعی ۱۰ میلیون تومان طلا در این پلتفرم، کارمزد مؤثر و زمان تسویه را اندازه گرفتیم…",
      "datePublished": "2026-08-06",
      "dateModified": "2026-08-06",
      "author": {
        "@type": "Person",
        "name": "مهدیار زره‌پوش",
        "url": "https://tablo.gold/authors/mahdiyar"
      },
      "publisher": { "@id": "https://tablo.gold/#organization" },
      "itemReviewed": {
        "@type": "Organization",
        "@id": "https://tablo.gold/platform/example-gold#org",
        "name": "اگزمپل‌گلد",
        "url": "https://example-gold.ir/"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": 4.2,
        "bestRating": 5,
        "worstRating": 1
      },
      "positiveNotes": {
        "@type": "ItemList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "کمترین اسپرد میان پلتفرم‌های بررسی‌شده" },
          { "@type": "ListItem", "position": 2, "name": "تسویه زیر ۲۴ ساعت" }
        ]
      },
      "negativeNotes": {
        "@type": "ItemList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "کارمزد برداشت بالاتر از میانگین" }
        ]
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "خانه", "item": "https://tablo.gold/" },
        { "@type": "ListItem", "position": 2, "name": "پلتفرم‌ها", "item": "https://tablo.gold/platform" },
        { "@type": "ListItem", "position": 3, "name": "اگزمپل‌گلد", "item": "https://tablo.gold/platform/example-gold" }
      ]
    }
  ]
}
```

> `itemReviewed` یک **Organization ثالث** است، پس قاعدهٔ self-serving نقض نمی‌شود.
> الزامات `AggregateRating` طبق گوگل: `itemReviewed`، `ratingValue`، و **حداقل یکی از** `ratingCount` یا `reviewCount`. (اگر AggregateRating می‌زنید نه Review تکی.)
> اگر نقد بر پایهٔ تست واقعی نیست یا انگیزهٔ مالی دارد، طبق سیاست ۲۴ ژوئیه ۲۰۲۶ **نباید** markup بزنید.

#### د) مقالهٔ بلاگ

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://tablo.gold/blog/gold-spread-explained#article",
  "headline": "اسپرد در معاملات طلای آنلاین چیست و چقدر از سود شما را می‌خورد؟",
  "description": "توضیح اسپرد خرید و فروش، محاسبهٔ کارمزد مؤثر و مقایسهٔ آن در پلتفرم‌های ایرانی",
  "image": [
    "https://tablo.gold/blog/gold-spread-16x9.jpg",
    "https://tablo.gold/blog/gold-spread-4x3.jpg",
    "https://tablo.gold/blog/gold-spread-1x1.jpg"
  ],
  "datePublished": "2026-08-06T09:00:00+03:30",
  "dateModified": "2026-08-06T09:00:00+03:30",
  "inLanguage": "fa-IR",
  "author": {
    "@type": "Person",
    "name": "مهدیار زره‌پوش",
    "url": "https://tablo.gold/authors/mahdiyar"
  },
  "publisher": { "@id": "https://tablo.gold/#organization" },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://tablo.gold/blog/gold-spread-explained"
  }
}
```

طبق <https://developers.google.com/search/docs/appearance/structured-data/article>:

- **هیچ property الزامی نیست** — "there are no required properties; instead, add the properties that apply to your content."
- توصیه‌شده: `author`، `datePublished`، `dateModified`، `headline`، `image`.
- قواعد `author`: "Make sure that all the authors that are presented as authors on the web page are also included in markup"؛ چند نویسنده = چند فیلد جدا؛ "To help Google better understand who the author is, we **strongly recommend** using the `type` and `url` (or `sameAs`) properties"؛ و "In the `author.name` property, only specify the name of the author. Don't add any other piece of information." (یعنی «نوشتهٔ مهدیار زره‌پوش، تحلیل‌گر بازار» ننویسید — فقط نام.)
- عنوان: "Consider using a concise title, as long titles may be truncated on some devices."
- تاریخ‌ها به فرمت ISO 8601 **با timezone** — برای ایران `+03:30`.

### ۳.۵ داده‌های ساخت‌یافته و AI Overviews / AI Mode

راهنمای رسمی جدید گوگل (۱۵ مه ۲۰۲۶): <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
و پست اعلام: <https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing>

نکاتی که مستقیماً روی برنامه‌ریزی ما اثر می‌گذارد:

- **AEO/GEO اسطوره است:** "From Google Search's perspective, optimizing for generative AI search is optimizing for the search experience, and thus still SEO."
- **structured data برای AI لازم نیست:** "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add." (اما برای rich resultهای معمولی همچنان ارزش دارد.)
- **llms.txt لازم نیست:** "don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search" — گوگل خودش از llms.txt استفاده نمی‌کند و ساختنش «neither harm nor help». (changelog ۱۵ ژوئن ۲۰۲۶ هم همین را می‌گوید.)
- **قطعه‌قطعه کردن محتوا لازم نیست:** "no requirement to break your content into tiny pieces for AI to better understand it."
- **شرط ورود:** صفحه باید "be indexed and eligible to be shown in Google Search with a snippet" باشد — یعنی اگر `nosnippet` یا `max-snippet:0` بگذارید، از AI features حذف می‌شوید.
- **محتوای non-commodity:** "Create the content yourself based on what you know about the topic, and consider what in-depth experience you can bring to your content." ← دقیقاً همان استدلال بند ۱.۳.
- **هشدار دربارهٔ فروشندگان SEO:** "Be wary of third-party tools that promise ranking success or claim to use 'internal' Google metrics… no third-party tool has access to our internal ranking or AI systems." (راهنمای مکمل: changelog ۵ ژوئن ۲۰۲۶ — «evaluating third-party SEO tools, services, and advice».)

---

## ۴. SEO فارسی / RTL و مسائل خاص ایران

### ۴.۱ اعلان زبان و جهت

```html
<html lang="fa" dir="rtl">
```

- `lang="fa"` کد ISO 639-1 فارسی است. اگر منطقه هم مهم است: `lang="fa-IR"`.
- `dir="rtl"` روی `<html>`، نه فقط روی `<body>`.
- برای بخش‌هایی که محتوای لاتین دارند (کد، نام برند انگلیسی) از `dir="ltr"` محلی استفاده کنید تا نقطه‌گذاری جابه‌جا نشود.
- در Open Graph: `og:locale` = `fa_IR`.

> W3C راهنمای رسمی اعلان زبان دارد در <https://www.w3.org/International/questions/qa-html-language-declarations> — این URL در محیط من قابل fetch نبود (محدودیت شبکه)، پس محتوایش را نقل نمی‌کنم؛ فقط به‌عنوان مرجع معرفی می‌شود.

### ۴.۲ hreflang — فقط اگر نسخهٔ انگلیسی ساختید

<https://developers.google.com/search/docs/specialty/international/localized-versions>

- سه روش: HTML `<link>`، HTTP Header، یا Sitemap.
- **دوطرفه بودن الزامی است:** "If two pages don't both point to each other, the tags will be ignored."
- فرمت کد: "The first code of the `hreflang` attribute is the language code (in ISO 639-1 format) followed by an optional second code that represents the region code (in ISO 3166-1 Alpha 2 format)."
- `x-default`: "used when no other language/region matches the user's browser setting."

نمونه (اگر روزی `/en/` اضافه شد):

```html
<link rel="alternate" hreflang="fa-IR" href="https://tablo.gold/gold/coin-emami" />
<link rel="alternate" hreflang="en"    href="https://tablo.gold/en/gold/coin-emami" />
<link rel="alternate" hreflang="x-default" href="https://tablo.gold/gold/coin-emami" />
```

هر دو صفحه باید **همین بلوک کامل** را داشته باشند.

**[توصیهٔ من]** فعلاً نسخهٔ انگلیسی نسازید. یک سایت فارسی عمیق بهتر از دو سایت سطحی است، و hreflang ناقص بدتر از نبودنش است.

### ۴.۳ نرمال‌سازی نویسه‌های فارسی — این واقعاً تطبیق جست‌وجو را می‌شکند

مسئله: چهار جفت نویسهٔ متفاوت که **در نمایش تقریباً یکسان‌اند** ولی از نظر بایت متفاوت:

| نویسه | Unicode | نام | نتیجه |
|---|---|---|---|
| ی | `U+06CC` | ARABIC LETTER FARSI YEH | **درست برای فارسی** |
| ي | `U+064A` | ARABIC LETTER YEH | عربی — باید نرمال شود |
| ى | `U+0649` | ARABIC LETTER ALEF MAKSURA | باید نرمال شود |
| ک | `U+06A9` | ARABIC LETTER KEHEH | **درست برای فارسی** |
| ك | `U+0643` | ARABIC LETTER KAF | عربی — باید نرمال شود |
| ۰-۹ | `U+06F0`–`U+06F9` | EXTENDED ARABIC-INDIC DIGIT | ارقام فارسی |
| ٠-٩ | `U+0660`–`U+0669` | ARABIC-INDIC DIGIT | ارقام عربی |
| ‌ | `U+200C` | ZERO WIDTH NON-JOINER (نیم‌فاصله) | معنادار، اما مسئله‌ساز در URL |

منابع دست‌اول:

- فصل ۹ استاندارد یونیکد (خط عربی)، جایی که رفتار این نویسه‌ها تعریف شده: <https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-9/>
- دادهٔ locale فارسی در CLDR یونیکد: <https://cldr.unicode.org/translation/language-specific/persian>
- توصیف اشکال U+06CC نسبت به U+064A و U+0649: "U+06CC ARABIC LETTER FARSI YEH is exactly like U+0649 in final and isolated forms, but exactly like U+064A in initial and medial forms." — یعنی **ظاهر یکسان، بایت متفاوت.**
- یادداشت‌های املای فارسی (منبع W3C i18n، نویسنده Richard Ishida): <https://r12a.github.io/scripts/arab/pes.html>

**چرا SEO را می‌شکند:** اگر عنوان مقالهٔ شما «قیمت طلاي آب‌شده» با `ي` عربی باشد و کاربر «طلای آب‌شده» با `ی` فارسی جست‌وجو کند، رشته‌ها از نظر بایت یکی نیستند. گوگل تا حد زیادی این را خودش نرمال می‌کند، اما:

1. **جست‌وجوی داخلی سایت شما** قطعاً می‌شکند مگر خودتان نرمال کنید.
2. **اسلاگ URL** اگر با نویسهٔ عربی ساخته شود، URL دیگری است — و لینک‌های دستیِ کاربران به آن نمی‌خورد.
3. **تطبیق دیتابیس** برای نام پلتفرم‌ها و دارایی‌ها می‌شکند.

> ⚠️ **مهم:** من نتوانستم سندی از **خودِ گوگل** پیدا کنم که صریحاً بگوید نرمال‌سازی ی/ک روی رتبه اثر دارد. این یک الزام **مهندسی و UX** است که از استاندارد یونیکد و CLDR می‌آید، نه یک قاعدهٔ منتشرشدهٔ گوگل. **[توصیهٔ من — نه قاعدهٔ گوگل]**

**پیاده‌سازی الزامی — نرمال‌سازی در ورودی:**

```js
// هر رشتهٔ فارسی که وارد سیستم می‌شود (عنوان، اسلاگ، جست‌وجو، نام پلتفرم)
// از این تابع رد شود — یک بار، در مرز ورودی.
const PERSIAN_NORMALIZE = [
  [/ي/g, 'ی'],  // ي  ->  ی
  [/ى/g, 'ی'],  // ى  ->  ی
  [/ك/g, 'ک'],  // ك  ->  ک
  [/ۀ/g, 'ه‌ی'], // ۀ -> ه‌ی  (اختیاری)
  [/[ً-ْ]/g, ''],          // حذف اعراب (تشکیل)
  [/ـ/g, ''],                   // حذف کشیده (tatweel)
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeFa(input) {
  let s = input.normalize('NFC');
  for (const [re, to] of PERSIAN_NORMALIZE) s = s.replace(re, to);
  // ارقام فارسی/عربی -> ارقام لاتین برای پردازش داخلی
  s = s.replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));
  return s;
}
```

**ارقام در نمایش قیمت:** **[توصیهٔ من]** در متن قابل مشاهده، ارقام فارسی (۱۲۳) برای خوانایی خوب است، اما:

- در **داده‌های ساخت‌یافته JSON-LD** حتماً ارقام لاتین (`"920000000"`) — schema.org عدد می‌خواهد.
- در **URL و اسلاگ** حتماً لاتین.
- در **`<title>`** ارقام فارسی مانعی ندارد؛ گوگل هر دو را می‌فهمد.
- برای نمایش، `Intl.NumberFormat('fa-IR')` استفاده کنید نه جایگزینی دستی.

### ۴.۴ ساختار URL: اسلاگ فارسی یا لاتین؟

منبع: <https://developers.google.com/search/docs/crawling-indexing/url-structure>

آنچه گوگل می‌گوید:

- **نویسه‌های غیر ASCII:** "characters in the non-ASCII range should be percent encoded" — یعنی URL فارسی **پشتیبانی می‌شود** به شرط percent-encoding استاندارد UTF-8.
- **کلمات به زبان مخاطب:** گوگل توصیه می‌کند از "words in your audience's language in the URL (and, if applicable, transliterated words)" استفاده کنید و مثال‌هایی از آلمانی و ژاپنی می‌آورد.
- **خط تیره:** "we recommend using hyphens (`-`) instead of underscores (`_`)."
- **کلمه به‌جای شناسه:** "readable words rather than long ID numbers."

**پس گوگل هر دو را قبول می‌کند.** انتخاب، مهندسی است نه SEO.

**[توصیهٔ من — این یک judgement call است، نه قاعدهٔ گوگل]: اسلاگ لاتینِ ترانویسی‌شده.**

دلایل:

| مسئله | اسلاگ فارسی | اسلاگ لاتین |
|---|---|---|
| ظاهر در نوار آدرس | خوانا (مرورگرهای مدرن decode می‌کنند) | خوانا |
| کپی/پیست در تلگرام و واتس‌اپ | به `%D8%B7%D9%84%D8%A7%DB%8C...` تبدیل می‌شود — زشت و بلند | تمیز |
| نیم‌فاصله `U+200C` در اسلاگ | فاجعه: `%E2%80%8C` نامرئی است، کاربر نمی‌تواند تایپ کند، دو URL تقریباً یکسان می‌سازد | وجود ندارد |
| ی/ک عربی در اسلاگ | دو URL متفاوت برای یک صفحه | وجود ندارد |
| طول URL | ~۳ برابر بعد از encoding | کوتاه |
| نمایش در SERP | گوگل decode‌شده نشان می‌دهد | لاتین |

**قاعدهٔ اسلاگ‌سازی پیشنهادی:**

```
/gold/abshode                       نه  /طلا/آب‌شده
/gold/coin-emami                    نه  /طلا/سکه-امامی
/platform/talasea                   نه  /پلتفرم/طلاسی
/blog/gold-spread-explained         نه  /بلاگ/اسپرد-طلا-چیست
```

با `<h1>` و `<title>` **کاملاً فارسی**. اسلاگ لاتین هیچ کلمهٔ کلیدی فارسی‌ای را از دست نمی‌دهد چون گوگل رتبه را از محتوا و عنوان می‌گیرد، نه از URL.

**اگر تصمیم گرفتید فارسی باشد** (تصمیم قابل‌دفاعی است):

- نیم‌فاصله را **حتماً** به `-` تبدیل کنید: `آب‌شده` → `آب-شده`.
- نرمال‌سازی ی/ک را قبل از ساخت اسلاگ اعمال کنید.
- در `sitemap.xml` باید percent-encoded باشند (الزام RFC-3986/3987 در spec پروتکل).
- در `<link rel="canonical">` هم percent-encoded بنویسید تا با آنچه سرور می‌بیند یکی باشد.

### ۴.۵ TLD، هدف‌گیری کشوری و میزبانی

<https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites>

- **ccTLD:** "These are tied to a specific country… and therefore provide a strong signal to both users and search engines that your site is explicitly intended for a certain country."
- **gTLD:** اگر دامنه عمومی است (`.com`، `.online`، `.org`) باید "explicitly set a country target using one of the methods described previously."
- **محل سرور:** "The server location is often physically near your users and can be a signal about your site's intended audience" — اما گوگل تأکید می‌کند "is not a definitive signal" چون CDN و انتخاب‌های زیرساختی آن را جابه‌جا می‌کنند.
- و: "Google crawls the web from different locations around the world. We do **not** attempt to vary the crawler source used for a single site."

**دربارهٔ `.online`:** یک gTLD است، نه ccTLD. پس سیگنال کشوری ندارد. اما این تقریباً بی‌اهمیت است، چون:

**[توصیهٔ من]** سیگنال‌های واقعیِ «این سایت برای ایران است» که در اختیار شماست:

1. زبان محتوا فارسی — **قوی‌ترین سیگنال عملی**.
2. `lang="fa-IR"` و `og:locale=fa_IR`.
3. ذکر ریال/تومان و نام شهرها/بازارهای ایرانی در محتوا.
4. لینک‌های ورودی از سایت‌های ایرانی.
5. `Organization` schema با `address` ایرانی.

⚠️ **هشدار دربارهٔ منابع قدیمی:** بعضی راهنماها می‌گویند «در Search Console کشور هدف را روی ایران بگذارید». ابزار **International Targeting** وجود ندارد: گوگل حذف آن را در **۲۴ اوت ۲۰۲۲** اعلام کرد و در **۲۲ سپتامبر ۲۰۲۲** از Search Console برداشت، با این استدلال که هدف‌گیری کشوری از طریق Search Console «little value for the ecosystem» داشت. `hreflang` همچنان پشتیبانی می‌شود.
(<https://support.google.com/webmasters/answer/12474899> — جزئیات کامل در **بند ۷.۵**.)

### ۴.۶ وضعیت دسترسی به سرویس‌های گوگل از ایران — بخش پرریسک این سند

> **📌 این بخش در بازبینی دوم جایگزین شد.** مکانیزم deindex شدن حالا از مستندات اول‌شخص گوگل اثبات شده است — **بند ۷ را بخوانید**، آنجا تصمیم میزبانی با پشتوانهٔ سند گرفته می‌شود. آنچه در ادامهٔ همین بند می‌آید، زمینهٔ عمومی است و همچنان عمدتاً منبع ثانویه دارد.

**آنچه با اطمینان بالا می‌دانیم:**

- تحریم‌های آمریکا سرویس‌های تجاری گوگل (Google Ads، AdSense، سرویس‌های پولی Cloud) را برای کاربران ایران مسدود کرده است. **[منبع ثانویه]**
- Google Search و مرور معمولی زیر قاعدهٔ «ارتباطات شخصی» عموماً در دسترس است. **[منبع ثانویه]**
- ایران در ۲۰۲۶ قطعی‌های شدید اینترنت داشته: خاموشی سراسری از **۸ ژانویه ۲۰۲۶**، بازگشت محدود اینترنت پس از حدود ۲۳۸ ساعت، و اختلالات مرحله‌ای که تا ماه‌ها ادامه داشت. دسترسی به گوگل حدود **۱۸ ژانویه ۲۰۲۶** بازگشت. **[منبع ثانویه — ویکی‌پدیا، الجزیره، Internet Society Pulse]**
- حدود ۲۰٪ از یک میلیون دامنهٔ برتر جهان و ۳۰٪ از ۱۰۰ هزار دامنهٔ برتر برای کاربران ایران مسدود است. **[منبع ثانویه]**

**آنچه نامعلوم است:** آیا Google Search Console صراحتاً IPهای ایران را مسدود می‌کند؟ منابع ثانویه می‌گویند بله (به‌عنوان «ابزار تجاری»)، اما **من سند رسمی گوگل برای این ادعا پیدا نکردم.** تجربهٔ عملی وبمسترهای ایرانی معمولاً این است که GSC با VPN کار می‌کند.

**[توصیهٔ من] — استراتژی مقاوم در برابر این عدم‌قطعیت:**

1. **حساب Google را با ایمیل و شمارهٔ غیرایرانی بسازید و همیشه از طریق VPN/سرور خارج به GSC وصل شوید.** حساب را قبل از راه‌اندازی سایت بسازید و تأیید کنید.
2. **تأیید مالکیت را با DNS TXT انجام دهید،** نه با فایل HTML یا تگ meta. دلیل: DNS مستقل از دسترسی شماست و اگر بعداً میزبانی عوض شد، تأیید نمی‌شکند.
3. **میزبانی را خارج از ایران بگذارید** (اروپا/ترکیه/امارات) با CDN. دلایل:
   - Googlebot از خارج می‌خزد؛ اگر سرور داخل ایران باشد و فیلترینگ خروجی/ورودی مانع شود، **صفحات از ایندکس می‌افتند**. (این سناریو واقعی است و در انجمن Search Central گزارش شده — thread موجود در support.google.com که در محیط من قابل fetch نبود: `support.google.com/webmasters/thread/405153915` با عنوان «Site pages removed from Google due to Iran internet and DNS restrictions».)
   - قطعی‌های داخلی ۲۰۲۶ نشان داد میزبانی داخل ایران ریسک در دسترس‌بودن دارد و uptime پایین مستقیماً روی خزش اثر می‌گذارد.
   - **معاوضه:** کاربران داخل ایران ممکن است به سرور خارجی کندتر وصل شوند، و اگر CDN شما ایران را مسدود کند (بعضی CDNها می‌کنند) کاربر ایرانی سایت را نمی‌بیند. **CDN را با دقت انتخاب کنید** — ArvanCloud (ایرانی) با origin خارجی یک الگوی رایج و کارآمد است.
4. **دامنه:** `.online` انتخاب معقولی است — ثبتش تابع تحریم نیست و ccTLD نبودنش تقریباً بی‌اثر است. `.ir` سیگنال کشوری قوی‌تری می‌دهد ولی ثبت/تمدیدش نزد ثبت‌کننده‌های بین‌المللی مشکل دارد و اگر روزی خواستید سایت را بین‌المللی کنید محدودتان می‌کند. **`.online` را نگه دارید.** اگر خواستید سیگنال محلی اضافه کنید، `mazane.ir` را هم ثبت کنید و ۳۰۱ به `.online` بدهید (نه محتوای تکراری).
5. **آنالیتیکس:** Google Analytics هم همان ریسک را دارد. **[توصیهٔ من]** یک آنالیتیکس خودمیزبان (Plausible/Umami self-hosted) به‌عنوان منبع اصلی، و GA4 به‌عنوان مکمل. Search Console جایگزین ندارد و باید نگهش دارید.
6. **Bing Webmaster Tools را هم راه بیندازید** (<https://www.bing.com/webmasters>) — رایگان، تحریم کمتر، و IndexNow را می‌پذیرد.

### ۴.۷ موتورهای جست‌وجوی ایرانی

**پارسی‌جو** (parsijoo.ir) و **یوز** (yooz.ir) دو موتور بومی‌اند که با بودجهٔ دولتی ساخته شدند. سهم بازار آن‌ها در برابر گوگل ناچیز است.

**[توصیهٔ من]** ثبت سایت در آن‌ها هزینهٔ تقریباً صفر دارد (چند دقیقه) و بازدهی نزدیک صفر. **این را در اولویت آخر بگذارید.** قبل از صرف وقت، اول چک کنید که سرویس ثبت سایتشان هنوز کار می‌کند — منابعی که دیدم قدیمی بودند و وضعیت فعلی این دو سرویس را نتوانستم از منبع اول‌شخص تأیید کنم. **[منبع ثانویه — ویکی‌پدیای فارسی و رسانه‌های ایرانی]**

آنچه **واقعاً** برای مخاطب ایرانی ارزش دارد و باید در اولویت باشد:

- حضور در **تلگرام** و **اینستاگرام** با لینک به سایت (ترافیک مستقیم + سیگنال برند).
- ثبت در **Bing** (بخشی از کاربران ایرانی به‌خاطر فیلترینگ از Bing استفاده می‌کنند).
- لینک از سایت‌های خبری اقتصادی ایرانی.

---

## ۵. پیامدهای انتخاب استک فنی برای SEO

### ۵.۱ چرا SSR/SSG مهم است — از زبان خود گوگل

<https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics> (به‌روزرسانی: **2026-03-04 UTC**)

> "Google processes JavaScript web apps in three main phases: 1. Crawling 2. Rendering 3. Indexing"

و دربارهٔ صف رندر:

> "The page may stay on this queue for **a few seconds, but it can take longer than that**."

و توصیهٔ صریح:

> "Keep in mind that **server-side or pre-rendering is still a great idea** because it makes your website faster for users and crawlers, and **not all bots can run JavaScript**."

**معنای این برای مضنه آنلاین:** یک SPA کلاینت‌ساید (React خالی + fetch در `useEffect`) کار می‌کند اما:

- ایندکس شدن با تأخیر انجام می‌شود (صف رندر).
- بقیهٔ خزنده‌ها — Bing، Yandex، خزنده‌های شبکه‌های اجتماعی برای پیش‌نمایش لینک، خزنده‌های AI — JavaScript اجرا نمی‌کنند. لینک شما در تلگرام بدون عنوان و توضیح ظاهر می‌شود.
- برای سایتی که #۱ اولویتش ایندکس شدن است، این ریسک بی‌دلیل است.

**Dynamic rendering هم جواب نیست:** <https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering>

> "Dynamic rendering was a **workaround and not a long-term solution** for problems with JavaScript-generated content in search engines. Instead, we recommend that you use **server-side rendering, static rendering, or hydration** as a solution."

### ۵.۲ Core Web Vitals — اعداد دقیق

<https://web.dev/articles/vitals>

| متریک | آستانهٔ «Good» | صدک |
|---|---|---|
| **LCP** — Largest Contentful Paint | "LCP should occur within **2.5 seconds**" | ۷۵ |
| **INP** — Interaction to Next Paint | "pages should have a INP of **200 milliseconds** or less" | ۷۵ |
| **CLS** — Cumulative Layout Shift | "pages should maintain a CLS of **0.1** or less" | ۷۵ |

**تأیید: INP جای FID را گرفت.** web.dev می‌گوید "INP became a stable Core Web Vital metric in **2024**" و این "is exactly what happened to FID". اگر جایی FID دیدید، منسوخ است.

**[توصیهٔ من] ریسک‌های خاص مضنه آنلاین:**

- **CLS:** جدول قیمتی که هر ۶۰ ثانیه به‌روز می‌شود، اگر ارتفاع سلول‌ها با تغییر رقم عوض شود، CLS می‌سازد. **راه‌حل:** ارتفاع ثابت برای ردیف‌ها، `font-variant-numeric: tabular-nums`، عرض ثابت برای ستون قیمت.
- **CLS از بنر تبلیغاتی:** اسلات‌های تبلیغ باید `min-height` رزروشده داشته باشند قبل از لود شدن.
- **LCP:** فونت فارسی (وزیرمتن/ایران‌سنس) اگر بلاک کند، LCP را می‌کشد. `font-display: swap` + `preload` روی فونت اصلی + subset فارسی (نه فونت کامل با گلیف عربی/لاتین اضافه).
- **INP:** اگر هر tick قیمت باعث re-render کل جدول شود، تعامل کاربر بلاک می‌شود. به‌روزرسانی را batch کنید.

### ۵.۳ مقایسهٔ فریم‌ورک‌ها — از مستندات خودشان

#### Next.js (App Router) — **[توصیهٔ من: این را انتخاب کنید]**

نسخهٔ مستندات در زمان بررسی: **16.3.0**.

**Metadata API:** <https://nextjs.org/docs/app/api-reference/functions/generate-metadata>

- `export const metadata` برای متادیتای ثابت، `generateMetadata()` برای داینامیک.
- شامل `title` (با `template`/`default`/`absolute`)، `description`، `alternates.canonical`، `alternates.languages` (hreflang)، `openGraph`، `robots`، `verification.google`.
- `metadataBase` را در root layout بگذارید تا canonicalها مطلق شوند.
- **نکتهٔ مهم دربارهٔ streaming metadata:** از v15.2 متادیتا می‌تواند stream شود. مستندات می‌گوید: "We have verified that metadata is interpreted correctly by bots that execute JavaScript and inspect the full DOM (e.g. `Googlebot`)." و "For **HTML-limited bots** that can't execute JavaScript (e.g. `facebookexternalhit`), metadata continues to block page rendering. The resulting metadata will be available in the `<head>` tag." — Next.js این بات‌ها را از User-Agent تشخیص می‌دهد و می‌شود با `htmlLimitedBots` تنظیمش کرد.

**Sitemap و robots داینامیک:** <https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap>

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): MetadataRoute.Sitemap {
  const posts = await getPosts()
  return [
    { url: 'https://tablo.gold', lastModified: new Date('2026-08-06') },
    ...posts.map((p) => ({
      url: `https://tablo.gold/blog/${p.slug}`,
      lastModified: p.updatedAt,   // تاریخ ویرایش واقعی، نه now()
    })),
  ]
}
```

فایل `app/robots.ts` هم به همین شکل کار می‌کند. برای بیش از ۵۰٬۰۰۰ URL از `generateSitemaps` استفاده کنید (که ما نیاز نخواهیم داشت).

**ISR — پاسخ به «صفحه‌ای که هر چند دقیقه عوض می‌شود ولی باید crawlable باشد»:**
<https://nextjs.org/docs/app/guides/incremental-static-regeneration>

سمانتیک دقیق stale-while-revalidate از مستندات:

1. در `next build` صفحه prerender می‌شود.
2. همهٔ درخواست‌ها cache شده و آنی سرو می‌شوند.
3. "After 60 seconds has passed, the next request **will still return the cached (now stale) page**"
4. "The cache is invalidated and a new version of the page begins generating **in the background**"
5. "Once generated successfully, the next request will return the updated page"

→ **هیچ کاربری (و هیچ خزنده‌ای) منتظر نمی‌ماند.** اولین بازدیدکننده بعد از انقضا، نسخهٔ کهنه را فوری می‌گیرد.

```ts
// app/gold/[asset]/page.tsx
export const revalidate = 60   // حداکثر یک بار در دقیقه بازتولید

export async function generateStaticParams() {
  return (await getAssets()).map((a) => ({ asset: a.slug }))
}
```

و بازاعتبارسنجی on-demand وقتی قیمت‌ها واقعاً جهش کردند:

```ts
'use server'
import { revalidateTag } from 'next/cache'

export async function onPriceUpdate() {
  revalidateTag('prices', 'max')
}
```

هشدارهایی که خود مستندات می‌دهد و باید بدانید:

- ISR فقط با Node.js runtime کار می‌کند، با Static Export نه.
- اگر چند instance دارید، cache پیش‌فرض per-instance است — برای هماهنگی به custom cache handler نیاز دارید.
- هدر `x-nextjs-cache` مقادیر `HIT`/`STALE`/`MISS`/`REVALIDATED` می‌دهد — برای دیباگ عالی است.
- "We recommend setting a **high** revalidation time. For instance, 1 hour instead of 1 second." — برای قیمت زنده این توصیه با نیاز ما در تضاد است؛ راه‌حل بند ۵.۴.

#### Astro

<https://docs.astro.build/en/guides/on-demand-rendering/>

- پیش‌فرض: static (همه چیز در build).
- `export const prerender = false` روی یک صفحه = رندر on-demand.
- `output: 'server'` = همه on-demand، و `export const prerender = true` برای استثناها.
- **نیازمند adapter:** "To render any page on demand, you need to add an adapter" — Node، Netlify، Vercel، Cloudflare.
- **کش:** مستندات ISR داخلی ندارد؛ باید دستی هدر بگذارید: `Astro.response.headers.set('Cache-Control', 'public, max-age=3600')`.

**ارزیابی [توصیهٔ من]:** Astro برای بلاگ عالی است (کمترین JS، بهترین Core Web Vitals). برای بخش قیمت زنده، ISR داخلی ندارد و باید خودتان با CDN و `stale-while-revalidate` بسازید. اگر Vercel/Netlify استفاده کنید، adapterها ISR را می‌دهند ولی کمتر مستند و کمتر یکپارچه از Next.js است.

#### Nuxt

<https://nuxt.com/docs/4.x/guide/concepts/rendering>

- Universal (SSR) پیش‌فرض؛ `ssr: false` برای CSR.
- **Hybrid rendering با `routeRules`** — قوی‌ترین نقطهٔ Nuxt برای این پروژه:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/':            { isr: 60 },        // داشبورد قیمت
    '/gold/**':     { swr: 60 },        // صفحات دارایی
    '/blog/**':     { prerender: true },// مقالات
    '/platform/**': { prerender: true },
    '/api/**':      { cors: true },
  },
})
```

- `swr` = پاسخ سرور برای TTL کش می‌شود و بعد در پس‌زمینه بازتولید.
- `isr` = مثل swr ولی روی edge CDN کش می‌شود؛ "content persists until the next deploy inside the CDN".

**ارزیابی [توصیهٔ من]:** از نظر مدل کش، `routeRules` تمیزترین API میان این سه است. اگر تیم Vue بلد است، Nuxt انتخاب کاملاً معتبری است و از نظر SEO چیزی از Next.js کم ندارد.

#### گزینهٔ JVM (Spring Boot + Thymeleaf یا Ktor)

مخزن فعلی فقط فایل‌های پروژهٔ IntelliJ IDEA (`.iml`) دارد که به قصد پروژهٔ Java/Kotlin اشاره می‌کند.

**واقعیت SEO:** Spring Boot + Thymeleaf **صد در صد SSR** است. HTML کامل از سرور می‌آید، Googlebot بدون هیچ صف رندری آن را می‌خواند. از نظر crawlability این **بهترین** حالت ممکن است — بهتر از هر SPA hydrate‌شده.

آنچه باید خودتان بسازید (که در Next/Nuxt آماده است):

| قابلیت | Next.js/Nuxt | Spring Boot |
|---|---|---|
| SSR | آماده | آماده (Thymeleaf) |
| کش صفحه با stale-while-revalidate | `revalidate` / `routeRules` | دستی: Caffeine/Redis + هدر `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` |
| sitemap.xml داینامیک | فایل‌کانونشن | یک `@GetMapping("/sitemap.xml")` که XML می‌سازد |
| متادیتا و canonical | Metadata API | fragment مشترک Thymeleaf |
| JSON-LD | JSX/کامپوننت | Thymeleaf template |
| بهینه‌سازی تصویر | `next/image` | دستی یا سرویس ثالث |
| بهینه‌سازی فونت | `next/font` | دستی |

**[توصیهٔ من]** اگر تیم شما Java/Kotlin است و JS نمی‌نویسد، **Spring Boot + Thymeleaf گزینهٔ کاملاً معتبری است و از نظر SEO حتی ساده‌تر است** — چون هیچ پیچیدگی hydration ندارد. کار اضافه‌ای که باید بکنید عمدتاً کش و sitemap است که هر کدام چند ساعت کار است، نه چند هفته.

اما اگر تیم انتخاب آزاد دارد، **Next.js App Router را توصیه می‌کنم** به این دلایل مشخص:

1. ISR با on-demand revalidation دقیقاً مسئلهٔ «HTML استاتیک + دادهٔ چنددقیقه‌ای» را حل می‌کند و مستنداتش صریح است.
2. `sitemap.ts`/`robots.ts`/Metadata API سه چیزی که در SEO بیشترین اشتباه در آن‌ها رخ می‌دهد را به کد type-safe تبدیل می‌کند.
3. `next/font` و `next/image` مستقیماً روی LCP و CLS اثر می‌گذارند — دو متریکی که در بند ۵.۲ به‌عنوان ریسک این پروژه شناسایی شد.
4. اکوسیستم محتوا (MDX برای بلاگ) بالغ است.

### ۵.۴ معماری رندرینگ پیشنهادی — پاسخ نهایی به سؤال اصلی

**مسئله:** HTML باید crawlable باشد؛ داده هر چند دقیقه عوض می‌شود؛ نمی‌خواهیم برای هر خزش، دیتابیس را بزنیم.

**[توصیهٔ من] معماری دولایه — HTML کهنهٔ کوتاه + به‌روزرسانی زندهٔ کلاینت:**

| مسیر | استراتژی | دلیل |
|---|---|---|
| `/` (داشبورد) | ISR با `revalidate = 60` + به‌روزرسانی کلاینت‌ساید بعد از hydration | Googlebot HTML کامل با قیمت‌های حداکثر ۶۰ ثانیه کهنه می‌بیند؛ کاربر انسانی قیمت زنده می‌بیند |
| `/gold/[asset]` | ISR `revalidate = 60` + `generateStaticParams` | همان |
| `/platform/[slug]` | SSG (بازتولید هنگام ویرایش محتوا با `revalidatePath`) | محتوای تحریریه، ندرتاً عوض می‌شود |
| `/blog/[slug]` | SSG کامل | بهترین Core Web Vitals |
| `/api/prices` | داینامیک، `Cache-Control: no-store` | فقط برای مصرف کلاینت |

#### آیا «HTML کهنه + JS تازه» از نظر گوگل مجاز است؟

این سؤالِ درستی است و جواب **بله** است. سه دلیل مستند:

**۱. تعریف cloaking بر پایهٔ user-agent است، نه بر پایهٔ زمان.** متن سیاست:

> "Cloaking refers to the practice of presenting different content to users and search engines **with the intent to manipulate search rankings and mislead users**."

و هر دو مثالی که گوگل می‌زند، صریحاً user-agent-محورند:

> "Showing a page about travel destinations to search engines while showing a page about discount drugs to users"
>
> "Inserting text or keywords into a page only when **the user agent that is requesting the page is a search engine**, not a human visitor"

در معماری ما هیچ شاخهٔ کدی بر اساس user-agent وجود ندارد. سرور به Googlebot و کاربر **بایت‌های یکسان** می‌دهد؛ هر دو هم اگر JS اجرا کنند همان به‌روزرسانی زنده را می‌گیرند. تفاوت، تفاوتِ *لحظهٔ درخواست* است — همان چیزی که هر سایت خبری هم دارد. **[استدلال من بر پایهٔ متن سیاست؛ گوگل حکم موردی صادر نمی‌کند.]**

**۲. گوگل خودش انتظار دارد محتوا کهنه شود و مکانیزم recrawl دارد.** مستندات crawl budget سه محرک تقاضای خزش را نام می‌برد و یکی‌شان مستقیماً همین است:

> **Staleness:** "Our systems want to recrawl documents frequently enough to pick up any changes."
>
> **Popularity:** "URLs that are more popular on the Internet tend to be crawled more often."

(<https://developers.google.com/crawling/docs/crawl-budget> — توجه: گوگل در ۲۰۲۶ مستندات خزش را به دامنهٔ جدید `developers.google.com/crawling/` منتقل/تکرار کرده است.)

یعنی گوگل صفحهٔ شما را بر اساس نرخ تغییرش دوباره می‌خزد. **هیچ الزامی وجود ندارد که HTML در لحظهٔ خزش دقیق‌ترین عدد ممکن را داشته باشد.** آنچه اهمیت دارد این است که عددِ داخل HTML **در لحظهٔ تولید آن HTML درست بوده** و صفحه تاریخ‌دار باشد.

**۳. سرعت خزش عملاً از سرعت تغییر قیمت خیلی کندتر است.** گوگل می‌گوید:

> "Googlebot shouldn't access your site more than once every few seconds on average."
> (<https://developers.google.com/search/docs/crawling-indexing/googlebot>)

برای سایتی در این اندازه، هر URL شاید روزی چند بار خزیده شود — نه هر ۳۰ ثانیه. پس **تلاش برای «تازه نگه داشتن HTML در حد ثانیه» از اساس بی‌معناست**؛ هیچ خزنده‌ای آن‌قدر سریع نمی‌آید. `revalidate = 60` بسیار فراتر از چیزی است که Googlebot اصلاً می‌بیند. این را در کنار هشدار خود Next.js بگذارید ("We recommend setting a **high** revalidation time") — تنش ظاهری میان آن توصیه و نیاز ما، در عمل وجود ندارد: ۶۰ ثانیه برای **کاربر** است، نه برای گوگل.

**سه الزام همراه (بدون این‌ها استدلال بالا نمی‌ایستد):**

1. **timestamp در HTML رندرشده:**
   ```html
   <p>آخرین به‌روزرسانی:
     <time datetime="2026-08-06T14:32:00+03:30">۱۴:۳۲ — ۱۵ مرداد ۱۴۰۵</time>
   </p>
   ```
   این هم شفافیت است (بند ۱.۵ — «How» در E-E-A-T)، هم دفاع در برابر ادعای گمراه‌کنندگی.
2. **اعداد JSON-LD باید با اعداد HTML یکی باشند** — نه با فید زنده. اگر JS قیمت را در DOM به‌روز می‌کند، `Product`/`AggregateOffer` را هم همان لحظه به‌روز کنید یا اصلاً مقدار اولیه را دست نزنید. سیاست: "Don't mark up content that is not visible to readers of the page." (بند ۳.۳)
3. **جدول قیمت مؤثر باید در HTML اولیه باشد** — تکرار بند ۱.۰، چون این همان جایی است که ارزش‌افزوده اثبات می‌شود. اگر Googlebot فقط چهار عدد پایهٔ تقریباً یکسان ببیند، صفحه thin به نظر می‌رسد صرف‌نظر از اینکه کاربر بعداً چه می‌بیند.

#### هدرهای HTTP — کش و خزش کارآمد

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
ETag: "prices-20260806T143200"
```

گوگل صراحتاً conditional request را پشتیبانی می‌کند: زیرساخت خزش گوگل هم `ETag`/`If-None-Match` و هم `Last-Modified`/`If-Modified-Since` را می‌فهمد، و **`ETag` را ترجیح می‌دهد** چون برخلاف `Last-Modified` ساختار تاریخی ندارد و کمتر دچار خطا می‌شود. اگر Googlebot درخواست شرطی بزند و شما `304 Not Modified` برگردانید، محتوا دانلود نمی‌شود و منابع سرور آزاد می‌شود.
(منبع: <https://developers.google.com/search/blog/2024/12/crawling-december-caching> — «Crawling December: HTTP caching»، دسامبر ۲۰۲۴. متن کامل پست در محیط پژوهش من قابل استخراج نبود؛ نقل‌قول‌ها از خلاصهٔ نتایج جست‌وجوی همان دامنه است — **[صحت‌سنجی مجدد توصیه می‌شود]**.)

**[توصیهٔ من]** `ETag` را از hash محتوای رندرشده بسازید، نه از timestamp — وگرنه هر ۶۰ ثانیه ETag عوض می‌شود حتی وقتی قیمت‌ها تغییر معناداری نکرده‌اند، و مزیت ۳۰۴ از بین می‌رود. برای صفحات بلاگ که واقعاً ثابت‌اند، ETag پایدار = خزش خیلی ارزان‌تر.

---

## ۶. چک‌لیست اجرایی SEO — به ترتیب اولویت

### فاز ۰ — قبل از نوشتن اولین خط کد

- [ ] **۱.** حساب Google با ایمیل غیرایرانی بسازید و از طریق VPN/سرور خارجی به Search Console دسترسی بگیرید. **قبل** از راه‌اندازی سایت این را تست کنید — اگر جواب نداد، کل برنامه‌ریزی عوض می‌شود. *(بند ۴.۶)*
- [ ] **۲.** تصمیم میزبانی: سرور خارج از ایران + CDN که ایران را مسدود نمی‌کند. *(بند ۴.۶)*
- [ ] **۳.** تصمیم استک: Next.js App Router (توصیه) یا Nuxt یا Spring Boot+Thymeleaf. **هر چه هست، باید SSR/SSG بدهد. SPA کلاینت‌ساید نه.** *(بند ۵.۱، ۵.۳)*
- [ ] **۴.** قرارداد اسلاگ: لاتینِ ترانویسی‌شده با خط تیره. تابع `normalizeFa()` را قبل از هر ورودی فارسی بگذارید. *(بند ۴.۳، ۴.۴)*

### فاز ۱ — حیاتی: بدون این‌ها راه نیندازید

- [ ] **۵.** **هر لینک درآمدزا `rel="sponsored"` داشته باشد.** یک تست خودکار بنویسید که در CI شکست بخورد اگر لینک خروجی بدون `sponsored` پیدا شود. *(بند ۱.۷)*
- [ ] **۶.** `/go/*` را در robots.txt ببندید. *(بند ۱.۷، ۲.۴)*
- [ ] **۷.** **جدول قیمت مؤثر همهٔ پلتفرم‌ها باید در HTML اولیه (server-rendered) باشد** — نه پشت کلیک، نه فقط بعد از hydration. این تنها چیزی است که صفحه را از «چهار عدد یکسان» (thin) به «مقایسهٔ ارزشمند» تبدیل می‌کند، و Googlebot باید آن را ببیند. *(بند ۱.۰، ۵.۴)*
- [ ] **۸.** صفحهٔ **روش‌شناسی**: فرمول قیمت مؤثر، منبع هر عدد کارمزد، تاریخ آخرین راستی‌آزمایی، و برچسب‌گذاری کارمزدهای دستی در برابر API. ادعای «۱٪ تا ۲٫۴٪» بدون این، غیرقابل‌راستی‌آزمایی است. *(بند ۱.۰، ۱.۵)*
- [ ] **۹.** ترتیب پیش‌فرض جدول = **قیمت مؤثر**، نه کمیسیون. این را در کد قفل کنید، نه در سیاست شفاهی. *(بند ۱.۰)*
- [ ] **۱۰.** صفحات اعتماد: «دربارهٔ ما» با هویت واقعی، «تماس»، «چطور درآمد کسب می‌کنیم». YMYL است. *(بند ۱.۵)*
- [ ] **۹.** `<html lang="fa" dir="rtl">` و `og:locale=fa_IR`. *(بند ۴.۱)*
- [ ] **۱۰.** هر صفحه: `<title>` یکتای فارسی، `meta description` یکتا، `<link rel="canonical">` مطلق و self-referential. *(بند ۲.۷)*
- [ ] **۱۱.** `robots.txt` با خط `Sitemap:`. *(بند ۲.۴)*
- [ ] **۱۲.** `sitemap.xml` (index + سه فایل)، با `lastmod` مبتنی بر **تغییر معنادار محتوا**، نه نوسان قیمت. *(بند ۲.۳)*
- [ ] **۱۳.** HTTPS با ریدایرکت ۳۰۱ از HTTP و از `www` به بدون `www` (یا برعکس — یکی را انتخاب کنید).

### فاز ۲ — روز راه‌اندازی

- [ ] **۱۴.** Search Console: تأیید مالکیت با **DNS TXT**، ثبت sitemap، URL Inspection روی ۵ صفحهٔ کلیدی + Request Indexing. *(بند ۲.۱)*
- [ ] **۱۵.** Bing Webmaster Tools: تأیید + sitemap + کلید IndexNow. *(بند ۲.۵)*
- [ ] **۱۶.** JSON-LD: `Organization` + `WebSite` روی صفحهٔ اصلی (**بدون `SearchAction`**)، `BreadcrumbList` روی همهٔ صفحات. *(بند ۳.۴)*
- [ ] **۱۷.** Rich Results Test روی هر الگوی صفحه: <https://search.google.com/test/rich-results>
- [ ] **۱۸.** Core Web Vitals: `font-display: swap` + preload فونت subset‌شدهٔ فارسی، `min-height` روی اسلات‌های تبلیغ و ردیف‌های جدول، `tabular-nums` روی اعداد. *(بند ۵.۲)*

### فاز ۳ — هفته‌های اول

- [ ] **۱۹.** `BlogPosting` روی مقالات با `author` (فقط نام) + `url` نویسنده + `datePublished`/`dateModified` با `+03:30`. *(بند ۳.۴-د)*
- [ ] **۲۰.** `Review` روی صفحات بررسی پلتفرم، فقط جایی که تست واقعی انجام شده. *(بند ۱.۶، ۳.۴-ج)*
- [ ] **۲۱.** `Product` + `AggregateOffer` با `priceCurrency: "IRR"` — فقط روی صفحات دارایی مشخص، با اعداد ریالی منطبق با HTML. *(بند ۳.۳)*
- [ ] **۲۲.** IndexNow را برای Bing/Yandex وصل کنید (**نه برای گوگل**). *(بند ۲.۵)*
- [ ] **۲۳.** آنالیتیکس خودمیزبان به‌عنوان منبع اصلی + GA4 مکمل. *(بند ۴.۶)*
- [ ] **۲۴.** پایش هفتگی گزارش Pages در Search Console: «Discovered - currently not indexed» و «Crawled - currently not indexed» علائم اولیهٔ مشکل کیفیت‌اند.
- [ ] **۲۵.** `ETag` مبتنی بر hash محتوا روی صفحات (نه timestamp) + پاسخ `304` به درخواست‌های شرطی. گوگل `ETag` را بر `Last-Modified` ترجیح می‌دهد. *(بند ۵.۴)*

> **شماره‌گذاری:** موارد ۷ تا ۱۰ در بازبینی دوم اضافه/بازچینی شدند (بعد از تثبیت شکل محصول). شماره‌های بعدی ممکن است با نسخهٔ قبلی این سند یکی نباشند.

### فاز ۴ — نکنید

- [ ] ❌ `FAQPage` markup ننویسید — از ۷ مه ۲۰۲۶ حذف شده. *(بند ۳.۲)*
- [ ] ❌ `HowTo` markup ننویسید — حذف شده.
- [ ] ❌ `WebSite` + `SearchAction` ننویسید — از ۲۱ نوامبر ۲۰۲۴ حذف شده.
- [ ] ❌ Indexing API استفاده نکنید — فقط JobPosting و BroadcastEvent. *(بند ۲.۲)*
- [ ] ❌ `llms.txt` نسازید به این امید که روی گوگل اثر دارد — گوگل استفاده نمی‌کند. *(بند ۳.۵)*
- [ ] ❌ صفحات انبوهِ تولیدشده («قیمت طلا در [شهر]» × ۵۰۰) نسازید — Scaled content abuse. *(بند ۱.۴)*
- [ ] ❌ توضیحات پلتفرم‌ها را از سایتشان کپی نکنید — Scraping + Thin affiliation. *(بند ۱.۱، ۱.۴)*
- [ ] ❌ برای خودتان `AggregateRating` نگذارید — self-serving. *(بند ۱.۶)*
- [ ] ❌ وقت روی crawl budget نگذارید — سایت خیلی کوچک است. *(بند ۲.۶)*
- [ ] ❌ dynamic rendering پیاده نکنید — گوگل خودش می‌گوید منسوخ است. *(بند ۵.۱)*
- [ ] ❌ ترتیب نمایش پلتفرم‌ها را بر اساس کمیسیون نچینید — اعتماد را می‌زند و ادعای «مقایسهٔ بی‌طرف» را دروغ می‌کند.
- [ ] ❌ جدول قیمت مؤثر را پشت hydration یا کلیک کاربر پنهان نکنید — Googlebot باید ارزش‌افزوده را در HTML ببیند. *(بند ۱.۰)*
- [ ] ❌ سعی نکنید HTML را «در حد ثانیه» تازه نگه دارید — Googlebot اصلاً آن‌قدر سریع نمی‌خزد. *(بند ۵.۴)*

---

## ۷. ریسک ایندکس شدن از ایران — بستن شکاف بند ۴.۶

> این بخش در بازبینی دوم اضافه شد تا تصمیم میزبانی را قطعی کند. **نتیجه: بند ۴.۶ دیگر «ضعیف‌ترین بخش سند» نیست — مکانیزم از منبع اول‌شخص گوگل اثبات شد.**

### ۷.۱ مکانیزم deindex شدن — این دیگر حدس نیست

شکافِ بند ۴.۶ این بود که ادعای «سایت‌های میزبان‌شده در ایران از ایندکس می‌افتند» فقط منبع ثانویه داشت. **این مکانیزم حالا از مستندات اول‌شخص گوگل اثبات‌پذیر است** — و برای گرفتن تصمیم میزبانی نیازی به سند ایران‌محور نداریم، چون مکانیزم عمومی است.

منبع مالک: <https://developers.google.com/crawling/docs/troubleshooting/dns-network-errors> — **آخرین به‌روزرسانی: 2025-12-18 UTC**

**۱. گوگل خطای شبکه و DNS را هم‌ارز خطای ۵xx می‌داند:**

> "Google treats network timeouts, connection reset, and DNS errors similarly to `5xx` server errors."

**۲. جملهٔ تعیین‌کننده — بازهٔ زمانی deindex:**

> "**Already indexed URLs that are unreachable will be removed from Google's index within days.**"

«within days» — یعنی **روز**، نه هفته و نه ماه. یک قطعی چندروزهٔ اینترنت یا یک قاعدهٔ فایروال که کوئری‌های DNS گوگل را ببندد، کافی است تا سایت از ایندکس بیفتد.

**۳. گوگل صریحاً فایروال را به‌عنوان علت خطای DNS نام می‌برد:**

> خطاهای DNS "Most commonly caused by misconfiguration, but they may be **also caused by a firewall rule that's blocking Google DNS queries**."

این دقیقاً سناریوی فیلترینگ/محدودیت شبکه است.

**۴. واکنش فوری خزنده:**

> "In case of network errors, crawling immediately starts slowing down, as a network error is a sign that the server may not be able to handle the serving load."

**۵. و برای خطاهای HTTP (سند مکمل)** — <https://developers.google.com/search/docs/crawling-indexing/http-network-errors>:

> "5xx and 429 server errors prompt Google's crawlers to temporarily slow down with crawling."
>
> "For Google Search, already indexed URLs are preserved in the index, but eventually dropped."
>
> "Google's indexing pipeline removes from the index URLs that persistently return a server error."

**تفاوت ظریف و مهم:** خطای ۵xx → «preserved… but eventually dropped» (تدریجی‌تر). خطای شبکه/DNS → «removed… **within days**» (سریع‌تر). یعنی **غیرقابل‌دسترس بودن بدتر از خطا دادن است.** سروری که تایم‌اوت می‌شود، بدتر از سروری است که ۵۰۳ برمی‌گرداند.

### ۷.۲ تصمیم میزبانی — حالا با پشتوانه

**[توصیهٔ من — اما حالا بر پایهٔ مکانیزم مستند، نه حدس]**

مقایسهٔ ریسک با معیارِ «Googlebot از خارج ایران می‌خزد» (که خودِ گوگل تأیید کرده: "Google crawls the web from different locations around the world"):

| گزینه | ریسک deindex | ریسک سرعت برای کاربر ایرانی | حکم |
|---|---|---|---|
| میزبانی داخل ایران، بدون CDN | **بالا** — هر قطعی/فیلترینگ خروجی = خطای شبکه = حذف ظرف چند روز | کم | ❌ |
| میزبانی خارج، بدون CDN | پایین | متوسط تا بالا | ⚠️ |
| **میزبانی خارج + CDN ایرانی (مثل ArvanCloud) با origin خارجی** | **پایین** | **کم** | ✅ **پیشنهاد** |
| میزبانی خارج + CDN خارجی که ایران را مسدود می‌کند | پایین برای گوگل، **فاجعه برای کاربر** | کاربر اصلاً سایت را نمی‌بیند | ❌ |

⚠️ **نکتهٔ حیاتی دربارهٔ CDN:** اگر CDN جلوی سایت باشد، **آن CDN است که باید برای Googlebot در دسترس باشد، نه origin.** پس CDN را طوری انتخاب کنید که از خارج ایران بدون محدودیت پاسخ دهد. یک CDN ایرانی که فقط به IPهای ایران سرویس می‌دهد، دقیقاً همان فاجعه‌ای است که می‌خواستیم از آن فرار کنیم — چون Googlebot از خارج می‌آید.

**[توصیهٔ من] الزامات پایش:**

1. **مانیتورینگ در دسترس‌بودن از خارج ایران** (UptimeRobot / BetterStack با probe اروپا) — نه از داخل. تنها چیزی که اهمیت دارد این است که آیا از بیرون قابل دسترسی هستید یا نه. آستانهٔ هشدار: هر قطعی بیش از ۱۵ دقیقه.
2. **در زمان قطعی داخلی، مطمئن شوید سرور خارجی همچنان به Googlebot پاسخ می‌دهد.** اگر معماری‌تان به سرویسی داخل ایران وابسته است (مثلاً API قیمت‌ها روی سرور داخلی)، صفحهٔ کش‌شده باید همچنان سرو شود — نه ۵۰۰. اینجا ISR ذاتاً به نفع ماست: HTML آخرین نسخهٔ موفق روی CDN می‌ماند.
3. **هرگز ۵xx برای شکست فراخوانی API قیمت برنگردانید.** اگر کالکتور قطع شد، صفحهٔ کش‌شده با برچسب «آخرین به‌روزرسانی: N دقیقه پیش» را با **۲۰۰** سرو کنید. برگرداندن ۵۰۳ به‌خاطر قطعی یک منبع دادهٔ فرعی، شما را در مسیر «persistently return a server error» می‌گذارد.

### ۷.۳ تِرِدهای انجمن Search Central دربارهٔ ایران — چه چیزی تأیید شد

دو تِرِد مستقل در انجمن رسمی Google Search Central وجود دارد که دقیقاً همین مسئله را گزارش می‌کنند:

1. **«Site pages removed from Google due to Iran internet and DNS restrictions»**
   <https://support.google.com/webmasters/thread/405153915>
2. **«Temporary Googlebot block due to Iran-wide restrictions – Not server-related»** (۲۹ ژوئن ۲۰۲۵)
   <https://support.google.com/webmasters/thread/353821277>

⚠️ **صداقت روش‌شناختی:** **من نتوانستم محتوای این تِرِدها را استخراج کنم.** دامنهٔ `support.google.com` در محیط پژوهش من فقط پوستهٔ ناوبری برمی‌گرداند و متن گفت‌وگو در دسترس نبود — با سه مسیر مختلف تلاش شد. پس **نمی‌دانم آیا کارمند گوگل یا Product Expert پاسخی داده و آن پاسخ چه بوده.**

آنچه **می‌توان** با اطمینان گفت:

- وجود این تِرِدها با این عناوین، تأیید می‌کند که **این مسئله واقعی است و صاحبان سایت‌های ایرانی آن را تجربه کرده‌اند** — عنوان تِرِد اول صریحاً می‌گوید صفحات «removed from Google» شده‌اند.
- عنوان تِرِد دوم («Not server-related») نشان می‌دهد صاحب سایت خودش تشخیص داده که مشکل از سرورش نیست، بلکه از محدودیت سراسری است.
- **اما تصمیم میزبانی به محتوای این تِرِدها نیاز ندارد** — مکانیزم در بند ۷.۱ از مستندات اول‌شخص گوگل اثبات شد و عمومی است. تِرِدها فقط شاهد میدانی‌اند.

**[اگر کسی در تیم به `support.google.com` دسترسی مرورگری دارد، خواندن این دو تِرِد ارزش ۱۰ دقیقه وقت را دارد — به‌ویژه برای دیدن اینکه آیا Googler پاسخ داده.]**

### ۷.۴ دسترسی به Search Console از ایران — پاسخ قطعی: سند اول‌شخص وجود ندارد

**بگذارید این را قطعی کنم تا تیم دنبالش نگردد:**

**هیچ سند رسمی‌ای از گوگل وجود ندارد که بگوید Google Search Console برای کاربران ایران مسدود است یا نیست.** من با چند مسیر جست‌وجو کردم: صفحات Terms، مستندات Search Console، صفحات sanctions compliance. آنچه یافت شد:

- گوگل صفحات «sanctions compliance» **برای محصولات Publisher/Ads** دارد (<https://support.google.com/publisherpolicies/answer/11128499>) و در آن‌ها عبارت‌هایی مثل «when you're physically present in a sanctioned country or territory, you won't be able to sign in to your publisher account» آمده. **این دربارهٔ AdSense/Publisher است، نه Search Console.**
- Google Maps Platform فهرست «Prohibited Territories» دارد (<https://cloud.google.com/maps-platform/terms/maps-prohibited-territories>).
- **Search Console در هیچ‌کدام از این فهرست‌ها به‌صراحت نام برده نشده.**

**حالت شکست واقعی که گزارش می‌شود [منبع ثانویه — تجربهٔ کاربران، نه سند]:** Search Console معمولاً از IP ایران **بارگذاری نمی‌شود یا در تأیید مالکیت گیر می‌کند**، و با VPN کار می‌کند. مشکل بیشتر در **ساختن و نگه‌داشتن خودِ حساب Google** است تا در خودِ Search Console.

**[توصیهٔ من — بدون تغییر نسبت به بند ۴.۶، اما حالا با علت روشن]:** حساب را با ایمیل و شمارهٔ غیرایرانی بسازید، همیشه از VPN/سرور خارج وصل شوید، و **تأیید مالکیت را با DNS TXT انجام دهید** — چون DNS تنها روش تأییدی است که به دسترسی مداوم شما وابسته نیست و با تغییر میزبانی نمی‌شکند.

### ۷.۵ ابزار International Targeting — ادعای بند ۴.۵ تأیید شد

در بند ۴.۵ گفتم «ابزار International Targeting دیگر وجود ندارد» و آن را صراحتاً **استنباط** برچسب زدم. **حالا تأیید شده و از حالت استنباط خارج می‌شود:**

سند رسمی Search Console Help: <https://support.google.com/webmasters/answer/12474899> — «The International Targeting report is deprecated»

- **اعلام:** ۲۴ اوت ۲۰۲۲
- **حذف از Search Console:** ۲۲ سپتامبر ۲۰۲۲
- دلیل اعلام‌شدهٔ گوگل: توانایی هدف‌گیری کشوری از طریق Search Console «little value for the ecosystem» داشت و دیگر پشتیبانی نمی‌شود.
- **آنچه باقی ماند:** گوگل همچنان `hreflang` را پشتیبانی می‌کند و از آن استفاده می‌کند.

[پوشش رسانه‌ای تأییدکننده — **منبع ثانویه**: <https://searchengineland.com/google-search-console-to-remove-international-targeting-report-387477>]

**نتیجهٔ عملی:** هیچ کلیدی در Search Console نیست که «این سایت برای ایران است» را اعلام کند. سیگنال‌های واقعی همان‌هایی هستند که در بند ۴.۵ فهرست شدند (زبان محتوا، `lang`، ارز، لینک‌های ورودی ایرانی). **این ادعا دیگر نیازی به برچسب احتیاط ندارد.**

---

## ۸. تقاضای واقعی جست‌وجو — دادهٔ میدانی، نه فرض

> **روش‌شناسی و محدودیت آن — لطفاً قبل از استفاده بخوانید.**
>
> Google Keyword Planner به حساب Google Ads نیاز دارد که طبق پژوهش حقوقی تیم برای کاربران ایران در دسترس نیست. پس **حجم جست‌وجو (search volume) در اختیار ما نیست و هیچ عددی در این بخش ادعا نمی‌شود.**
>
> آنچه هست: خروجی **واقعی و زندهٔ Google Autocomplete** که در تاریخ ۲۰۲۶-۰۸-۰۶ با پارامترهای `hl=fa&gl=ir` از endpoint عمومی `suggestqueries.google.com/complete/search` گرفته شد. Autocomplete بازتاب کوئری‌های واقعی کاربران است، پس این داده **شکل کوئری (query shape) و ترتیب نسبی** را نشان می‌دهد، **نه حجم**. ترتیب پیشنهادها یک سیگنال تقریبی از تقاضای نسبی است — **[این تفسیر من است؛ گوگل الگوریتم ترتیب autocomplete را منتشر نکرده]**.

### ۸.۱ مسئلهٔ املا: مظنه یا مضنه — این را همین حالا حل کنید

**این یافته، اسم برند را تحت تأثیر قرار می‌دهد و ارزان‌ترین اصلاح ممکن است.**

**املای درست «مظنه» است.** ریشهٔ عربی (مَظِنّة) و در فارسی به معنای «نرخ و بها»؛ در بازار طلای ایران یعنی قیمت یک مثقال (۴٫۳۳۱۸ گرم) طلای آب‌شدهٔ عیار ۷۰۵. «مضنه» غلط املایی رایج است. [منابع آموزشی فارسی — **منبع ثانویه**، ولی اجماع کامل دارند.]

**و اما دادهٔ تعیین‌کننده — گوگل خودش چه می‌کند:**

خروجی واقعی autocomplete برای دو املا:

```
q = "مظنه"                          q = "مضنه"
 - مظنه                              - مظنه          ← اصلاح شد
 - مظنه طلا                          - مظنه طلا      ← اصلاح شد
 - مظنه طلا امروز                    - مظنه طلا امروز ← اصلاح شد
 - مظنه دلار                         - مظنه دلار     ← اصلاح شد
 - مظنه طلا چیست                     - مضنه          ← فقط این یکی خودش
 - مظنه چیست                         - مظنه طلا چیست ← اصلاح شد
 - مظنه جهانی طلا                    - مضنه یا مزنه  ← !
 - مظنه طلا انلاین                   - مظنه چیست     ← اصلاح شد
 - مظنه طلای آب شده                  - مظنه جهانی طلا ← اصلاح شد
```

و برای عبارت کامل:

```
q = "مضنه طلا"  →  هر ۱۰ پیشنهاد بدون استثنا «مظنه طلا …» برمی‌گردد.
```

**تفسیر فنی:** در پاسخ JSON، فیلد `google:suggestsubtypes` برای پیشنهادهای «مظنه» زیر کوئری «مضنه» مقدار `[512, 10, 11]` دارد، در حالی که پیشنهادهای مستقیم `[512]` هستند. زیرنوع‌های ۱۰/۱۱ در این endpoint نشانهٔ پیشنهادهای **اصلاح‌شده/بازنویسی‌شده** هستند. **[تفسیر subtypeها استنباط من از رفتار مشاهده‌شده است — گوگل این کدها را مستند نکرده.]**

**نتیجه‌گیری قطعی:**

1. **گوگل «مضنه» را به «مظنه» اصلاح می‌کند.** کاربری که «مضنه طلا» تایپ می‌کند، عملاً به نتایج «مظنه طلا» هدایت می‌شود. پس از نظر ترافیک ارگانیک، این دو کوئری **جدا نیستند**.
2. **«مظنه» فرم غالب است.** کل درخت پیشنهاد به آن می‌رود.
3. **اما «مضنه» تقاضای واقعی خودش را هم دارد** — چون به‌عنوان پیشنهاد مستقل با subtype `[512]` ظاهر می‌شود، و مهم‌تر: **`مضنه یا مزنه` یک کوئری واقعی است** — یعنی مردم فعالانه دربارهٔ املای درست سردرگم‌اند و جست‌وجو می‌کنند.

**[توصیهٔ من — و این یک تصمیم برندینگ است، پس نظر نهایی با شماست]:**

| کجا | چه بنویسید | چرا |
|---|---|---|
| `<title>` و `<h1>` صفحهٔ اصلی | **مظنه** | املای درست؛ فرم غالب جست‌وجو؛ اعتبار در حوزهٔ YMYL — غلط املایی در نام برندِ یک سایت مالی به اعتماد آسیب می‌زند |
| نام برند در متن | **مظنه آنلاین** | همان |
| `Organization.name` | `مظنه آنلاین` | |
| `Organization.alternateName` | `["مضنه آنلاین", "Mazane Online", "مظنه"]` | هر دو املا را پوشش می‌دهد بدون آنکه غلط را ترویج کند |
| دامنه | `tablo.gold` | دامنهٔ محصول (تغییر مالک از mazane.online)؛ پوشش املای مظنه/مضنه فقط از مسیر محتوا و `alternateName` است، نه خود دامنه |
| یک مقالهٔ بلاگ | «مظنه یا مضنه؟ املای درست و معنای مظنه در بازار طلا» | کوئری واقعی `مضنه یا مزنه` را می‌گیرد، هر دو املا را در یک صفحه دارد، و ارزش آموزشی واقعی دارد |

این کار هم ترافیک هر دو املا را می‌گیرد، هم برند را روی فرم درست می‌نشاند. **اگر امروز تغییر ندهید، بعداً تغییر نام برند پرهزینه است.**

### ۸.۲ فرضیهٔ «صفحات per-platform» — تأیید شد، قوی‌تر از انتظار

فرضیهٔ تیم این بود که کوئری‌های واقعی شکل «کارمزد گلدیکا» یا «طلاسی بهتره یا میلی» دارند. **این تأیید شد.** دادهٔ خام:

**الف) الگوی «کارمزد خرید طلا در [پلتفرم]» — دقیقاً محصول ماست:**

```
q = "کارمزد خرید طلا"
 - کارمزد خرید طلا در میلی          ← جایگاه ۱
 - کارمزد خرید طلا در بانکت
 - کارمزد خرید طلای آب شده
 - کارمزد خرید طلا
 - کارمزد خرید طلا در طلاسی
 - کارمزد خرید طلا در ملی گلد
 - کارمزد خرید طلا در دیجی کالا
 - کارمزد خرید طلا در بله
 - کارمزد خرید طلا در بلو بانک
```

**اینکه «در میلی» جایگاه اول را گرفته، یعنی الگوی «کارمزد + نام پلتفرم» پرتقاضاترین شکل این کوئری است — نه «کارمزد خرید طلا» به‌تنهایی.** این تأییدِ مستقیمِ تز محصول است: مردم دنبال کارمزدند، و به تفکیک پلتفرم.

**ب) الگوی مقایسهٔ دوتایی «X یا Y» — فراوان و ارگانیک:**

```
q = "طلاسی بهتره یا"
 - طلاسی بهتره یا میلی گلد
 - طلاسی بهتره یا میلی
 - طلاسی بهتره یا ملی گلد
 - طلاسی بهتره یا طلاین
 - طلاسی بهتره یا وال گلد
 - طلاسی بهتره یا گلدیکا

q = "میلی یا"        → میلی یا ملی گلد / میلی یا طلاین / میلی یا وال گلد / میلی یا داریک
q = "گلدیکا یا"      → گلدیکا یا میلی / میلی بهتره یا گلدیکا / طلاسی یا گلدیکا؟
q = "ملی گلد یا میلی گلد" → ملی گلد بهتره یا میلی گلد / ملی گلد معتبره یا میلی گلد
```

**ج) الگوی اعتماد «[پلتفرم] معتبره؟» — شاید بزرگ‌ترین فرصت:**

```
q = "میلی گلد معتبره"   → معتبره؟ / معتبره یانه؟؟ / چقدر معتبره / سایت... / برنامه...
q = "وال گلد معتبر"     → معتبر است / معتبره / معتبره یا میلی / چقدر معتبر است
q = "طلاین"             → طلاین کلاهبرداری / طلاین معتبر است / طلاین کلاهبرداری است
q = "طلای دیجیتال"      → طلای دیجیتال دیجی کالا کلاهبرداری
```

**«نی نی سایت» در تقریباً هر شاخه ظاهر می‌شود** — یعنی مردم برای این سؤالات به یک **انجمن** پناه می‌برند، چون منبع ساخت‌یافته‌ای وجود ندارد. این تعریفِ یک شکاف ساختاری است.

**د) الگوی عملیاتی «چطور/چقدر طول می‌کشد»:**

```
q = "فروش طلا در میلی"  → چقدر طول میکشد / سقف فروش / کارمزد فروش / نحوه فروش / آموزش
q = "برداشت طلا از"      → برداشت طلا از ملی گلد / از وال گلد / از میلی گلد / از میلی
q = "حداقل خرید طلا در"  → در میلی گلد / در ملی گلد / در طلاین / در داریک / در طلاسی / در بلو بانک
```

**این دقیقاً همان داده‌هایی است که معماری (`PlatformTerms`) قرار است نگه دارد** — حداقل سفارش، کارمزد، وضعیت خرید/فروش. یعنی مدل داده و تقاضای جست‌وجو **بر هم منطبق‌اند**، که خبر بسیار خوبی است.

### ۸.۳ سه یافتهٔ غیرمنتظره که برنامه را تغییر می‌دهد

**۱. «اسپرد» کلمهٔ اشتباهی است — این را قبل از نوشتن محتوا بدانید.**

```
q = "اسپرد طلا"
 - اسپرد طلا در لایت فایننس
 - اسپرد طلا در بروکرها
 - اسپرد طلا در آلپاری
 - اسپرد طلا در آمارکتس
 - اسپرد طلا در ارانته
```

کل این فضا متعلق به **بروکرهای فارکس** است، نه پلتفرم‌های طلای ایرانی. اگر محتوا را حول «اسپرد» بسازیم، با فارکس رقابت می‌کنیم و مخاطب اشتباهی می‌گیریم.

**واژگان درستِ مخاطب ما: «کارمزد».** این را در `<title>`، `<h1>` و متن استفاده کنید. «اسپرد» را فقط به‌عنوان توضیح فنی داخل مقاله بیاورید، نه به‌عنوان کلمهٔ هدف. **[توصیهٔ من]**

**۲. بازار خیلی بزرگ‌تر از چهار پلتفرم است.** پلتفرم‌هایی که در autocomplete ظاهر شدند و در فهرست فعلی ما نیستند:

| نام | نوع |
|---|---|
| **ملی گلد** | پلتفرم مستقل — **نه** همان «میلی» |
| **طلاین** | پلتفرم مستقل (با حجم بالای کوئری «کلاهبرداری») |
| **داریک** | پلتفرم مستقل |
| **بانکت** | پلتفرم/بانک |
| **دیجی‌کالا (طلای دیجیتال)** | بازیگر بزرگ |
| **بلو بانک / بله / بانک ملی / بانک مهر / بانک ملت** | کانال بانکی |
| **اسنپ‌پی، آساکوین، گلدناف، نوبیتکس، والکس، کاریزما** | کانال‌های جانبی |

**[توصیهٔ من]** جدول مقایسهٔ زندهٔ قیمت مؤثر را روی همان چهار پلتفرمی که API دارند نگه دارید (کیفیت داده مهم‌تر از پوشش است)، اما **صفحات محتوایی/بررسی را برای این نام‌های پرجست‌وجو هم بسازید** — حتی اگر قیمت زنده نداشته باشند. اینها ترافیک دارند و رقیب ساخت‌یافته ندارند.

**۳. سردرگمی «میلی» و «ملی گلد» یک فرصت آماده است.** کوئری‌های `میلی یا ملی`، `ملی گلد بهتره یا میلی گلد`، `میلی گلد معتبره یا ملی گلد` نشان می‌دهند مردم این دو را با هم اشتباه می‌گیرند. یک صفحهٔ «تفاوت میلی گلد و ملی گلد» تقاضای موجود و بدون رقیب دارد.

### ۸.۴ نقشهٔ محتوا و صفحات — پیشنهاد نهایی

**[توصیهٔ من]** نگاشت شکل کوئری به نوع صفحه:

| شکل کوئری (نمونهٔ واقعی) | صفحهٔ مقصد | نوع |
|---|---|---|
| `مظنه طلا امروز`، `قیمت لحظه ای طلا`، `مظنه طلا انلاین` | `/` داشبورد | ISR 60s |
| `قیمت لحظه ای طلا میلی`، `قیمت لحظه ای طلا طلاسی` | `/platform/[slug]` (بخش قیمت زنده) | ISR 60s |
| `طلای آب شده گرمی چند`، `مظنه طلای آب شده` | `/gold/abshode` | ISR 60s |
| **`کارمزد خرید طلا در میلی`** ← پرتقاضاترین | **`/platform/[slug]`** | SSG |
| `حداقل خرید طلا در طلاسی`، `سقف فروش طلا در میلی` | `/platform/[slug]` (جدول شرایط) | SSG |
| `برداشت طلا از وال گلد`، `فروش طلا در میلی چقدر طول میکشد` | `/platform/[slug]` (بخش عملیاتی) | SSG |
| **`میلی گلد معتبره`، `طلاین کلاهبرداری`** | **`/platform/[slug]`** (بخش اعتبار: مجوز، هویت حقوقی، تست واقعی) | SSG |
| **`طلاسی بهتره یا میلی گلد`** | **`/compare/[a]-vs-[b]`** — صفحهٔ مقایسهٔ دوتایی | SSG |
| `بهترین اپلیکیشن خرید طلا`، `بهترین سایت خرید طلای آب شده` | `/best/gold-apps` — صفحهٔ رتبه‌بندی | SSG |
| `مظنه چیست`، `مظنه طلا چند گرم است`، `مضنه یا مزنه` | `/blog/*` آموزشی | SSG |
| `مالیات خرید و فروش طلای آب شده`، `طلای آب شده بخرم یا سکه` | `/blog/*` تحلیلی | SSG |

**دو نکتهٔ ساختاری:**

1. **صفحات `/compare/[a]-vs-[b]` را دستی و محدود بسازید.** با ۱۰ پلتفرم، ۴۵ ترکیب ممکن است — تولید خودکار هر ۴۵ تا مصداق **Scaled content abuse** است (بند ۱.۴). فقط جفت‌هایی را بسازید که autocomplete واقعاً نشان داده (`طلاسی×میلی`، `طلاسی×ملی‌گلد`، `میلی×ملی‌گلد`، `طلاسی×وال‌گلد`، `گلدیکا×میلی`، `میلی×طلاین`)، هر کدام با تحلیل اختصاصی. **حدود ۶ تا ۸ صفحه، نه ۴۵ تا.**
2. **بخش «اعتبار» در صفحات پلتفرم، بالاترین ارزش‌افزوده و بالاترین ریسک را همزمان دارد.** کوئری `کلاهبرداری` تقاضای زیادی دارد، اما نوشتن «X کلاهبرداری است» بدون مستند، ریسک حقوقی دارد. **[توصیهٔ من]** فقط واقعیت‌های قابل‌راستی‌آزمایی بنویسید: شمارهٔ ثبت، نماد اعتماد الکترونیکی، هویت حقوقی، و نتیجهٔ تست واقعی خودتان. قضاوت را به خواننده بسپارید.

---

## ۹. رقبای سئویی — tgju.org و alanchand.com

### ۹.۱ tgju.org

عنوان صفحهٔ اصلی: `قیمت طلا, قیمت سکه, قیمت دلار - شبکه اطلاع رسانی طلا و ارز`

ساختار URL:

```
/gold-chart          طلا
/coin                سکه
/currency            ارز
/gold-global         انس جهانی
/profile/geram18     پروفایل هر نماد
/profile/sekee
/profile/price_dollar_rl
/panel/technical     تحلیل تکنیکال
/news/tag/…          اخبار
```

الگوی معماری: **یک صفحهٔ پروفایل به ازای هر نماد قیمتی** (`/profile/<symbol>`) با نمودار، سابقه، بالا/پایین روز. به‌علاوهٔ تحلیل تکنیکال و اخبار.

### ۹.۲ alanchand.com

عنوان: `الان چند؟ - قیمت های لحظه ای ارز، طلا و کریپتو`

ساختار URL:

```
/currencies-price
/gold-price
/crypto-price
/exchange-rates/[currency-pair]
```

معماری ساده‌تر و مسطح‌تر: یک صفحه به ازای هر دستهٔ دارایی، به‌علاوهٔ مبدل نرخ.

### ۹.۳ شکاف ساختاری — تأیید شد و از انتظار وسیع‌تر است

فرض تیم این بود که «هیچ‌کدام پلتفرم‌ها را مقایسه نمی‌کنند، پس شکاف وسیع است». **تأیید می‌کنم، و اضافه می‌کنم که شکاف حتی از این هم عمیق‌تر است.**

| بُعد | tgju | alanchand | مضنه آنلاین |
|---|---|---|---|
| قیمت لحظه‌ای بازار | ✅ عمیق | ✅ | ✅ |
| نمودار و سابقه | ✅ قوی | محدود | برنامه‌ریزی‌شده |
| ارز و کریپتو | ✅ | ✅ | ❌ (عمداً) |
| **مقایسهٔ پلتفرم‌های خرید آنلاین** | ❌ | ❌ | ✅ |
| **کارمزد به تفکیک پلتفرم** | ❌ | ❌ | ✅ |
| **قیمت مؤثر (با کارمزد)** | ❌ | ❌ | ✅ |
| **بررسی/اعتبارسنجی پلتفرم** | ❌ | ❌ | ✅ |
| **حداقل سفارش، زمان تسویه** | ❌ | ❌ | ✅ |

**دو مشاهدهٔ مهم‌تر از خودِ جدول:**

**۱. اینها رقیب نیستند — رقیب واقعی «نی‌نی‌سایت» است.** tgju و alanchand کوئری «قیمت» را می‌گیرند، که ما در آن **نباید** رقابت کنیم: tgju سال‌ها اقتدار دامنه دارد و شکست دادنش روی `قیمت طلا` غیرواقع‌بینانه است. اما هیچ‌کدام کوئری‌های `کارمزد خرید طلا در میلی`، `طلاسی بهتره یا میلی گلد`، `میلی گلد معتبره` را نمی‌گیرند. **آن کوئری‌ها امروز به انجمن‌ها می‌روند** — یعنی به محتوای بی‌ساختار، بی‌تاریخ، و بی‌مرجع. جایگزین کردن یک تِرِد انجمن با یک صفحهٔ ساخت‌یافتهٔ به‌روز، بسیار شدنی‌تر از جایگزین کردن tgju است.

**۲. tgju در واقع الگویی است که باید از آن یاد گرفت، نه با آن جنگید.** الگوی `/profile/<symbol>` — یک صفحهٔ پایدار و قابل‌ایندکس به ازای هر موجودیت — دقیقاً همان الگویی است که ما باید برای **پلتفرم‌ها** پیاده کنیم: `/platform/<slug>`. tgju این را برای نمادهای قیمتی انجام داده و کار می‌کند؛ هیچ‌کس آن را برای پلتفرم‌ها انجام نداده.

**[توصیهٔ من] موضع‌گیری سئویی:**

- **در کوئری‌های خالصِ «قیمت» رقابت نکنید** (`قیمت طلا`، `قیمت دلار`). آنجا را ببازید و اهمیتی ندهید.
- **در کوئری‌های «کارمزد / مقایسه / اعتبار / حداقل خرید» تمرکز کامل کنید.** رقیب ساخت‌یافته صفر است.
- **`مظنه` یک استثناست:** tala.ir صفحهٔ `/price/mazaneh` را دارد و tgju هم قوی است، اما «مظنه» به‌عنوان بخشی از نام برند ما، در طول زمان کوئری برندی می‌سازد که رقابتی نیست.

---

## منابع

### Google Search Central — سیاست‌ها و اصول

- Spam policies for Google web search — <https://developers.google.com/search/docs/essentials/spam-policies>
- Creating helpful, reliable, people-first content (E-E-A-T) — <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Google Search Essentials — <https://developers.google.com/search/docs/essentials>
- Guidance on AI-generated content — <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>
- Optimizing for generative AI features (مه ۲۰۲۶) — <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
- Documentation changelog — <https://developers.google.com/search/updates>

### Google Search Central — وبلاگ (اعلان‌های تاریخ‌دار)

- Affiliate programs and added value (ژانویه ۲۰۱۴) — <https://developers.google.com/search/blog/2014/01/affiliate-programs-and-added-value>
- A reminder on qualifying links and our link spam update (۲۶ ژوئیه ۲۰۲۱) — <https://developers.google.com/search/blog/2021/07/link-tagging-and-link-spam-update>
- Changes to HowTo and FAQ rich results (اوت ۲۰۲۳) — <https://developers.google.com/search/blog/2023/08/howto-faq-changes>
- Farewell, Sitelinks Search Box (اکتبر ۲۰۲۴) — <https://developers.google.com/search/blog/2024/10/sitelinks-search-box>
- Crawling December: HTTP caching (دسامبر ۲۰۲۴) — <https://developers.google.com/search/blog/2024/12/crawling-december-caching>
- Simplifying the search results page (ژوئن ۲۰۲۵) — <https://developers.google.com/search/blog/2025/06/simplifying-search-results>
- A new resource for optimizing for generative AI (مه ۲۰۲۶) — <https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing>
- Generative AI performance reports in Search Console (ژوئن ۲۰۲۶) — <https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports>

### Google Search Central — خزش و ایندکس

- Qualify your outbound links (rel sponsored/ugc/nofollow) — <https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links>
- Build and submit a sitemap — <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- robots.txt specifications — <https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt>
- Consolidate duplicate URLs (canonicalization) — <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
- Large site owner's guide to managing crawl budget — <https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget>
- Crawl budget management (دامنهٔ جدید مستندات خزش، ۲۰۲۶) — <https://developers.google.com/crawling/docs/crawl-budget>
- What is Googlebot (نرخ خزش) — <https://developers.google.com/search/docs/crawling-indexing/googlebot>
- URL structure best practices — <https://developers.google.com/search/docs/crawling-indexing/url-structure>
- JavaScript SEO basics — <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>
- Dynamic rendering (منسوخ) — <https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering>
- Indexing API quickstart — <https://developers.google.com/search/apis/indexing-api/v3/quickstart>

### Google Search Central — داده‌های ساخت‌یافته

- Structured data markup that Google Search supports (گالری) — <https://developers.google.com/search/docs/appearance/structured-data/search-gallery>
- General structured data guidelines — <https://developers.google.com/search/docs/appearance/structured-data/sd-policies>
- Article (Article/NewsArticle/BlogPosting) — <https://developers.google.com/search/docs/appearance/structured-data/article>
- Product structured data overview — <https://developers.google.com/search/docs/appearance/structured-data/product>
- Merchant listing — <https://developers.google.com/search/docs/appearance/structured-data/merchant-listing>
- Product snippet — <https://developers.google.com/search/docs/appearance/structured-data/product-snippet>
- Review snippet — <https://developers.google.com/search/docs/appearance/structured-data/review-snippet>
- Organization — <https://developers.google.com/search/docs/appearance/structured-data/organization>
- Site names (WebSite schema) — <https://developers.google.com/search/docs/appearance/site-names>
- FAQPage (منسوخ) — <https://developers.google.com/search/docs/appearance/structured-data/faqpage>

### Google Search Central — بین‌المللی

- Localized versions / hreflang — <https://developers.google.com/search/docs/specialty/international/localized-versions>
- Managing multi-regional sites — <https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites>

### خطاهای خزش و در دسترس‌بودن (بند ۷)

- Debug network and DNS errors for Google's crawlers (به‌روزرسانی 2025-12-18) — <https://developers.google.com/crawling/docs/troubleshooting/dns-network-errors>
- HTTP status codes, network and DNS errors, and Google Search — <https://developers.google.com/search/docs/crawling-indexing/http-network-errors>
- How HTTP status codes affect Google's crawlers — <https://developers.google.com/crawling/docs/troubleshooting/http-status-codes>
- The International Targeting report is deprecated (اعلام ۲۴ اوت ۲۰۲۲، حذف ۲۲ سپتامبر ۲۰۲۲) — <https://support.google.com/webmasters/answer/12474899>
- Sanctions compliance — Publisher Policies (مربوط به AdSense/Publisher، نه Search Console) — <https://support.google.com/publisherpolicies/answer/11128499>

### تِرِدهای انجمن Search Central دربارهٔ ایران (محتوا استخراج نشد — بند ۷.۳)

- «Site pages removed from Google due to Iran internet and DNS restrictions» — <https://support.google.com/webmasters/thread/405153915>
- «Temporary Googlebot block due to Iran-wide restrictions – Not server-related» (۲۹ ژوئن ۲۰۲۵) — <https://support.google.com/webmasters/thread/353821277>

### دادهٔ تقاضای جست‌وجو (بند ۸)

- Google Autocomplete public endpoint — `https://suggestqueries.google.com/complete/search?client=firefox&hl=fa&gl=ir&ie=utf-8&oe=utf-8&q=<query>` — **دادهٔ خام، برداشت‌شده در 2026-08-06**
- (حجم جست‌وجو در دسترس نبود — Keyword Planner نیازمند حساب Google Ads است که طبق پژوهش حقوقی تیم برای ایران در دسترس نیست.)

### رقبا (بند ۹)

- tgju.org — <https://www.tgju.org/>
- alanchand.com — <https://alanchand.com/>
- tala.ir صفحهٔ مظنه — <https://www.tala.ir/price/mazaneh>

### استانداردها و مشخصات

- Sitemaps XML protocol — <https://www.sitemaps.org/protocol.html>
- RFC 9309 — Robots Exclusion Protocol — <https://www.rfc-editor.org/rfc/rfc9309.html>
- IndexNow — <https://www.indexnow.org/>
- schema.org ExchangeRateSpecification — <https://schema.org/ExchangeRateSpecification>
- Unicode 17.0 Core Specification, Chapter 9 (Middle Eastern scripts) — <https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-9/>
- CLDR Persian locale notes — <https://cldr.unicode.org/translation/language-specific/persian>
- Persian orthography notes (W3C i18n, R. Ishida) — <https://r12a.github.io/scripts/arab/pes.html>
- W3C — Declaring language in HTML (مرجع، در این پژوهش fetch نشد) — <https://www.w3.org/International/questions/qa-html-language-declarations>

### عملکرد

- Web Vitals (LCP/INP/CLS) — <https://web.dev/articles/vitals>

### مستندات فریم‌ورک‌ها

- Next.js — generateMetadata — <https://nextjs.org/docs/app/api-reference/functions/generate-metadata>
- Next.js — sitemap.xml file convention — <https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap>
- Next.js — Incremental Static Regeneration — <https://nextjs.org/docs/app/guides/incremental-static-regeneration>
- Astro — On-demand rendering — <https://docs.astro.build/en/guides/on-demand-rendering/>
- Nuxt — Rendering modes — <https://nuxt.com/docs/4.x/guide/concepts/rendering>

### ابزارها

- Rich Results Test — <https://search.google.com/test/rich-results>
- Bing Webmaster Tools — <https://www.bing.com/webmasters>

### منابع ثانویه (صراحتاً غیرمرجع — فقط برای زمینهٔ ایران)

- 2026 Internet blackout in Iran — <https://en.wikipedia.org/wiki/2026_Internet_blackout_in_Iran>
- Iran restores SMS as phased rollback of internet blackout begins (الجزیره، ۱۷ ژانویه ۲۰۲۶) — <https://www.aljazeera.com/news/2026/1/17/iran-restores-sms-as-phased-rollback-of-internet-blackout-begins>
- Internet Society Pulse — Shutdown, Iran — <https://pulse.internetsociety.org/en/shutdowns/blackout-in-iran/>
- US Sanctions Block 20% of Top Global Web Domains for Iranian Users — <https://wanaen.com/us-sanctions-block-20-of-top-global-web-domains-for-iranian-users/>
- Google Search Central Community thread «Site pages removed from Google due to Iran internet and DNS restrictions» (در محیط پژوهش fetch نشد) — <https://support.google.com/webmasters/thread/405153915>
- OFAC Iran Sanctions — <https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions>

---

## پیوست: مواردی که دانش عمومی SEO با مستندات زنده تضاد دارد

این‌ها را اگر مشاور یا آموزشی خلافش گفت، **مستند زنده ملاک است**:

| باور رایج | واقعیت امروز (2026-08-06) | منبع |
|---|---|---|
| «FAQPage schema اسنیپت غنی می‌دهد» | ❌ از ۷ مه ۲۰۲۶ کاملاً حذف شد | changelog گوگل، ۸ مه ۲۰۲۶ |
| «HowTo schema برای آموزش‌ها بگذار» | ❌ حذف شده، مستنداتش پاک شده | گالری structured data |
| «SearchAction برای sitelinks searchbox» | ❌ از ۲۱ نوامبر ۲۰۲۴ حذف شده | وبلاگ Search Central، اکتبر ۲۰۲۴ |
| «FID را بهینه کن» | ❌ INP جایش را گرفت (۲۰۲۴) | web.dev/articles/vitals |
| «Indexing API صفحات را فوری ایندکس می‌کند» | ❌ فقط JobPosting و BroadcastEvent | مستندات Indexing API |
| «priority و changefreq در sitemap مهم‌اند» | ❌ "Google ignores `<priority>` and `<changefreq>`" | build-sitemap |
| «rel=nofollow برای افیلیت کافی است» | ⚠️ پذیرفتنی ولی `sponsored` ترجیح گوگل است | qualify-outbound-links |
| «Dynamic rendering راه‌حل SEO برای SPA است» | ❌ "a workaround and not a long-term solution" | dynamic-rendering |
| «در Search Console کشور هدف را ایران بگذار» | ❌ ابزار International Targeting در ۲۲ سپتامبر ۲۰۲۲ حذف شد | support.google.com/webmasters/answer/12474899 |
| «اسپرد» کلمهٔ کلیدی بازار طلای ایران است | ❌ فضای «اسپرد طلا» متعلق به بروکرهای فارکس است؛ واژهٔ مخاطب ما «کارمزد» است | دادهٔ autocomplete، بند ۸.۳ |
| «مضنه» و «مظنه» دو کوئری جدا هستند | ❌ گوگل «مضنه» را به «مظنه» اصلاح می‌کند | دادهٔ autocomplete، بند ۸.۱ |
| «Google از IndexNow پشتیبانی می‌کند» | ❌ در فهرست رسمی indexnow.org نیست | indexnow.org |
| «llms.txt برای دیده‌شدن در AI لازم است» | ❌ "Google Search itself doesn't use them" | ai-optimization-guide |
| «برای AI باید AEO/GEO جدا کار کنی» | ❌ "optimizing for generative AI search is… still SEO" | ai-optimization-guide |
| «صفحهٔ مقایسه می‌تواند merchant listing بگیرد» | ❌ فقط صفحاتی که خودشان می‌فروشند | merchant-listing |
