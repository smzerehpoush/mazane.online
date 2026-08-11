"""خط لوله‌ی محتوا، سمت سرور (بلیت ۱۳؛ بند ۱۳، تصمیم‌های ۱۶–۱۷).

معماری نجات «لپ‌تاپ شاید خاموش باشد»: مولد محتوا (روی ماشین صاحب کسب‌وکار)
صف پیش‌نویس را در جدول `posts` پر می‌کند؛ **سرور با آهنگ ثابت خالی می‌کند**
— مستقل از اینکه چند پیش‌نویس منتظر است. اجزا:

- `queue`     ⟸ صف شدن پیش‌نویس (دروازه‌ی اسلاگ مرکزی + دروازه‌ی
               اعتبارسنجی — میان‌بر ندارد) + سنجش عمق صف
               (هدف ۱۴ روز، هشدار زیر ۵ روز)
- `gate`      ⟸ دروازه‌ی اعتبارسنجی تصمیم ۱۶ (بلیت ۱۴): قالب/جای‌خالی،
               رد رقمِ مدل، گپ داده، شباهت متنی — توابع خالص
- `generator` ⟸ مولد لپ‌تاپ (`tablo-generate`، تصمیم ۱۷): کوئری داده ⟸
               جای‌خالی ⟸ نثر جمینای ⟸ دروازه ⟸ صف
- `publisher` ⟸ انتشار سررسید با سقف روزانه‌ی سمت سرور
               (`TABLO_DAILY_PUBLISH_CAP`، پیش‌فرض ۲) + بازتولید ISR وب
- `retract`   ⟸ پس‌گیری تک‌فرمانی (`tablo-retract <slug>`)
- `gateway`   ⟸ سطح تماس کمینه با جدول `posts` (پستگرس واقعی یا فیک تست)
- `revalidate`⟸ فراخوان `POST /api/revalidate-blog` وب

منطق روی اینترفیس تزریقی `ContentGateway` سوار است تا مرز تست گردآورنده
بدون پستگرس زنده سبز شود — همان الگوی `retention.py`.
"""

from .gate import (
    SIMILARITY_THRESHOLD,
    DataGapError,
    DigitOutsideSlotError,
    DraftRejected,
    NearDuplicateError,
    UnfilledSlotError,
    gate_draft,
    has_data_gap,
    render_draft,
    similarity,
    validate_draft,
)
from .gateway import ContentGateway, PostgresContentGateway, PostRow
from .generator import (
    MECHANICAL_MODEL,
    PROSE_MODEL,
    FakeLlmClient,
    GeminiClient,
    LlmClient,
    generate_launch_drafts,
)
from .publisher import DEFAULT_DAILY_PUBLISH_CAP, drain_pass, publish_due
from .queue import QueueDepth, check_queue_depth, enqueue_draft
from .retract import RetractOutcome, retract_post
from .revalidate import BlogRevalidator, HttpRevalidator, revalidator_from_env

__all__ = [
    "BlogRevalidator",
    "ContentGateway",
    "DEFAULT_DAILY_PUBLISH_CAP",
    "DataGapError",
    "DigitOutsideSlotError",
    "DraftRejected",
    "FakeLlmClient",
    "GeminiClient",
    "HttpRevalidator",
    "LlmClient",
    "MECHANICAL_MODEL",
    "NearDuplicateError",
    "PROSE_MODEL",
    "PostRow",
    "PostgresContentGateway",
    "QueueDepth",
    "RetractOutcome",
    "SIMILARITY_THRESHOLD",
    "UnfilledSlotError",
    "check_queue_depth",
    "drain_pass",
    "enqueue_draft",
    "gate_draft",
    "generate_launch_drafts",
    "has_data_gap",
    "publish_due",
    "render_draft",
    "retract_post",
    "revalidator_from_env",
    "similarity",
    "validate_draft",
]
