#!/usr/bin/env python3
"""Healthcheck داکر برای کانتینر گردآورنده (Dockerfile.collector آن را کپی می‌کند).

گردآورنده سرور HTTP ندارد؛ «زنده بودن» واقعی‌اش یعنی حلقه‌ی سکوها هنوز
می‌چرخد و می‌نویسد. پس دو چیز را چک می‌کنیم:

1. ردیس در دسترس است (وابستگی حیاتی خود کانتینر).
2. تازه‌ترین کلید ‎tablo:updated_at:*‎ جوان‌تر از آستانه است (پیش‌فرض ۱۵
   دقیقه؛ حلقه هر ۳۰ ثانیه ۱۴ سکو را می‌زند، پس اگر «همه» برای ۱۵ دقیقه
   ساکت باشند یا event loop گیر کرده یا شبکه‌ی خروجی کلاً قطع است — هر دو
   ارزش علامت unhealthy دارند).

سازگاری با قاعده‌ی ۵ قراردادها («قطع منبع ⟸ کهنگی، نه خطا»): این چک قطعِ
«یک» منبع را خطا نمی‌گیرد — فقط سکوت سراسری را. و چون docker compose ساده
کانتینر unhealthy را ری‌استارت نمی‌کند (وضعیت فقط در ‎docker ps‎ و
‎depends_on‎ اثر دارد)، این چک نمی‌تواند restart storm بسازد؛ فقط سیگنال
دیدبانی است.

آستانه با TABLO_HEALTH_MAX_STALE_MINUTES قابل تنظیم است.
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta

import redis  # redis-py — وابستگی خود گردآورنده است، داخل ایمیج موجود است


def main() -> int:
    url = os.environ.get("TABLO_REDIS_URL", "redis://127.0.0.1:6379/0")
    max_stale = timedelta(
        minutes=int(os.environ.get("TABLO_HEALTH_MAX_STALE_MINUTES", "15"))
    )

    try:
        client = redis.Redis.from_url(
            url, socket_timeout=5, socket_connect_timeout=5, decode_responses=True
        )
        client.ping()
    except Exception as exc:  # noqa: BLE001 — هر خطایی یعنی unhealthy
        print(f"unhealthy: redis unreachable: {exc}")
        return 1

    newest: datetime | None = None
    try:
        for key in client.scan_iter(match="tablo:updated_at:*", count=200):
            raw = client.get(key)
            if not raw:
                continue
            try:
                ts = datetime.fromisoformat(raw)
            except ValueError:
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            if newest is None or ts > newest:
                newest = ts
    except Exception as exc:  # noqa: BLE001
        print(f"unhealthy: redis scan failed: {exc}")
        return 1

    if newest is None:
        # هنوز هیچ نوبتی ذخیره نشده؛ start_period داکر بوت را پوشش می‌دهد —
        # اگر بعد از آن هم هیچ کلیدی نباشد، واقعاً چیزی ننوشته‌ایم.
        print("unhealthy: no tablo:updated_at:* keys yet")
        return 1

    age = datetime.now(UTC) - newest
    if age > max_stale:
        print(f"unhealthy: freshest platform update is {age} old (limit {max_stale})")
        return 1

    print(f"healthy: freshest platform update is {age} old")
    return 0


if __name__ == "__main__":
    sys.exit(main())
