#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import json
import socket
import sys
from collections import Counter
from datetime import UTC, datetime
from typing import Any, Iterable, Iterator, TextIO

GOOGLE_HOST_SUFFIXES = (".googlebot.com", ".google.com")


def open_log(path: str) -> TextIO:
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "rt", encoding="utf-8", errors="replace")


def iter_lines(paths: list[str]) -> Iterator[str]:
    if not paths:
        yield from sys.stdin
        return
    for path in paths:
        with open_log(path) as handle:
            yield from handle


def header_value(headers: dict[str, Any], name: str) -> str | None:
    lowered = name.lower()
    for key, value in headers.items():
        if key.lower() == lowered:
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    return None


def client_ip(request: dict[str, Any]) -> str | None:
    headers = request.get("headers") or {}
    real_ip = header_value(headers, "Ar-Real-Ip")
    if real_ip:
        return real_ip.strip()
    forwarded = header_value(headers, "X-Forwarded-For")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    for key in ("client_ip", "remote_ip"):
        value = request.get(key)
        if value:
            return str(value)
    return None


def verify_ip(ip: str, cache: dict[str, tuple[bool, str]]) -> tuple[bool, str]:
    if ip in cache:
        return cache[ip]
    try:
        hostname, _aliases, _addrs = socket.gethostbyaddr(ip)
    except OSError as exc:
        result = (False, f"PTR ندارد ({exc})")
        cache[ip] = result
        return result
    bare = hostname.rstrip(".")
    if not bare.lower().endswith(GOOGLE_HOST_SUFFIXES):
        result = (False, f"PTR غیرگوگلی: {bare}")
        cache[ip] = result
        return result
    try:
        infos = socket.getaddrinfo(bare, None)
    except OSError as exc:
        result = (False, f"forward lookup شکست خورد برای {bare} ({exc})")
        cache[ip] = result
        return result
    forward_ips = {info[4][0] for info in infos}
    if ip not in forward_ips:
        result = (False, f"forward-confirm نشد: {bare} به {sorted(forward_ips)} برمی‌گردد")
        cache[ip] = result
        return result
    result = (True, bare)
    cache[ip] = result
    return result


def parse_ts(value: Any) -> datetime | None:
    try:
        return datetime.fromtimestamp(float(value), tz=UTC)
    except (TypeError, ValueError):
        return None


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="تأیید reverse-DNS بازدیدهای Googlebot از لاگ JSON کدی"
    )
    parser.add_argument(
        "logs", nargs="*", help="فایل(های) لاگ JSON کدی؛ خالی = stdin؛ ‎.gz‎ مجاز"
    )
    parser.add_argument(
        "--top", type=int, default=10, help="تعداد مسیرهای پربازدید در گزارش (پیش‌فرض ۱۰)"
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    total_lines = 0
    googlebot_hits = 0
    hits_by_ip: Counter[str] = Counter()
    paths_genuine: Counter[str] = Counter()
    status_genuine: Counter[int] = Counter()
    first_ts: datetime | None = None
    last_ts: datetime | None = None

    records: list[tuple[str, str, int, datetime | None]] = []

    for line in iter_lines(args.logs):
        line = line.strip()
        if not line:
            continue
        total_lines += 1
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        request = entry.get("request")
        if not isinstance(request, dict):
            continue
        user_agent = header_value(request.get("headers") or {}, "User-Agent") or ""
        if "googlebot" not in user_agent.lower():
            continue
        ip = client_ip(request)
        if not ip:
            continue
        googlebot_hits += 1
        hits_by_ip[ip] += 1
        records.append(
            (
                ip,
                str(request.get("uri", "?")),
                int(entry.get("status") or 0),
                parse_ts(entry.get("ts")),
            )
        )

    cache: dict[str, tuple[bool, str]] = {}
    genuine_ips: dict[str, str] = {}
    impostor_ips: dict[str, str] = {}
    for ip in hits_by_ip:
        ok, detail = verify_ip(ip, cache)
        (genuine_ips if ok else impostor_ips)[ip] = detail

    genuine_hits = 0
    for ip, uri, status, ts in records:
        if ip not in genuine_ips:
            continue
        genuine_hits += 1
        paths_genuine[uri] += 1
        status_genuine[status] += 1
        if ts is not None:
            first_ts = ts if first_ts is None or ts < first_ts else first_ts
            last_ts = ts if last_ts is None or ts > last_ts else last_ts

    print(f"log lines read: {total_lines}")
    print(f"requests with Googlebot UA: {googlebot_hits} from {len(hits_by_ip)} unique IPs")
    print(f"genuine hits (reverse DNS + forward confirmed): {genuine_hits}")
    if first_ts and last_ts:
        print(f"genuine hit range: {first_ts.isoformat()} to {last_ts.isoformat()}")
    if genuine_ips:
        print("\ngenuine Google IPs:")
        for ip, host in sorted(genuine_ips.items(), key=lambda kv: -hits_by_ip[kv[0]]):
            print(f"  {ip}  ({host})  — {hits_by_ip[ip]} hits")
    if impostor_ips:
        print("\nimpostors (Googlebot UA, not confirmed):")
        for ip, why in sorted(impostor_ips.items(), key=lambda kv: -hits_by_ip[kv[0]]):
            print(f"  {ip}  — {hits_by_ip[ip]} hits — {why}")
    if status_genuine:
        print("\ngenuine hit status codes:", dict(sorted(status_genuine.items())))
        errors = sum(n for code, n in status_genuine.items() if code >= 500)
        if errors:
            print(f"  ⚠️ {errors} 5xx responses to genuine Googlebot — investigate immediately")
    if paths_genuine:
        print(f"\ntop genuine-hit paths (up to {args.top}):")
        for uri, count in paths_genuine.most_common(args.top):
            print(f"  {count:>6}  {uri}")
    if googlebot_hits == 0:
        print("\nno requests with Googlebot UA found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
