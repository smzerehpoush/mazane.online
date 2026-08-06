"""خط لوله‌ی محتوا، سمت سرور (بلیت ۱۳؛ بند ۱۳، تصمیم‌های ۱۶–۱۷).

معماری نجات «لپ‌تاپ شاید خاموش باشد»: مولد محتوا (روی ماشین صاحب کسب‌وکار)
صف پیش‌نویس را در جدول `posts` پر می‌کند؛ **سرور با آهنگ ثابت خالی می‌کند**
— مستقل از اینکه چند پیش‌نویس منتظر است. اجزا:

- `queue`     ⟸ صف شدن پیش‌نویس (دروازه‌ی اسلاگ مرکزی) + سنجش عمق صف
               (هدف ۱۴ روز، هشدار زیر ۵ روز)
- `publisher` ⟸ انتشار سررسید با سقف روزانه‌ی سمت سرور
               (`MAZANE_DAILY_PUBLISH_CAP`، پیش‌فرض ۲) + بازتولید ISR وب
- `retract`   ⟸ پس‌گیری تک‌فرمانی (`mazane-retract <slug>`)
- `gateway`   ⟸ سطح تماس کمینه با جدول `posts` (پستگرس واقعی یا فیک تست)
- `revalidate`⟸ فراخوان `POST /api/revalidate-blog` وب

منطق روی اینترفیس تزریقی `ContentGateway` سوار است تا مرز تست گردآورنده
بدون پستگرس زنده سبز شود — همان الگوی `retention.py`.
"""

from .gateway import ContentGateway, PostgresContentGateway, PostRow
from .publisher import DEFAULT_DAILY_PUBLISH_CAP, drain_pass, publish_due
from .queue import QueueDepth, check_queue_depth, enqueue_draft
from .retract import RetractOutcome, retract_post
from .revalidate import BlogRevalidator, HttpRevalidator, revalidator_from_env

__all__ = [
    "BlogRevalidator",
    "ContentGateway",
    "DEFAULT_DAILY_PUBLISH_CAP",
    "HttpRevalidator",
    "PostRow",
    "PostgresContentGateway",
    "QueueDepth",
    "RetractOutcome",
    "check_queue_depth",
    "drain_pass",
    "enqueue_draft",
    "publish_due",
    "retract_post",
    "revalidator_from_env",
]
