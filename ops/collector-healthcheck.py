#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta

import redis


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
    except Exception as exc:  # noqa: BLE001
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
