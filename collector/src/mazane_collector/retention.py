"""نگه‌داری داده — تجمیع ساعتی، فشرده‌سازی تکراری‌ها، هرس خام (بلیت ۱۶).

چرا (بند ۷.۱، الزام معماری ۲): آرشیو منتسبِ «چه قیمتی، کی، از کدام منبع
نمایش داده شد» تنها دفاع مؤثر در برابر ادعای «قیمت کذب» است؛ پس هیچ حذفی
نباید زنجیره را بشکند. سیاست (بند ۱۳، تصمیم ۱۳): خام ۹۰ روز با فشرده‌سازی
تکراری‌های متوالی + تجمیع ساعتی برای همیشه.

منطق روی یک اینترفیس کوچک (`RetentionStore`) و توابع خالص روی ردیف‌ها سوار
است تا مرز تست گردآورنده بدون پستگرس زنده با فیک درون‌حافظه‌ای سبز شود.
هر گذر (`retention_pass`) سه گام دارد، به این ترتیب و همیشه محافظه‌کار:

۱) **تجمیع ساعتی** (`rollup_completed_hours`): به‌ازای هر منبع×دارایی×سمت،
   برای هر ساعتِ *کامل‌شده* یک ردیف باز/بسته/کمینه/بیشینه + شمار نمونه upsert
   می‌شود — بازاجرا تکرار نمی‌سازد و آخرین ساعتِ تجمیع‌شده هم هر بار
   بازتجمیع می‌شود (خودترمیمی برای ردیفی که چند ثانیه دیر نوشته شده باشد).
   **مراجع قیمت هم تجمیع می‌شوند**: عدد مرجع هم نمایش داده می‌شود و جزو
   آرشیو حقوقی است (بند ۷.۱ درباره‌اش مطلق است) — با `kind = REFERENCE` در
   همان جدول. فقط ردیف‌های `suppressed` بیرون می‌مانند: هرگز نمایش داده
   نشده‌اند، پس در «آنچه نمایش دادیم» جایی ندارند.

۲) **فشرده‌سازی تکراری‌های متوالی** (`compress_duplicate_runs`) — قرارداد
   دفاع‌پذیری: از هر دنباله‌ی بی‌وقفه‌ی مقدارِ یکسان در یک سری، **اولین و
   آخرین ردیف نگه داشته و فقط میانی‌ها حذف می‌شوند**. اثبات «چه قیمتی کی
   نمایش داده می‌شد» سالم می‌ماند: ردیف اول آغازِ نمایشِ آن مقدار را و ردیف
   آخر تداومش را سند می‌کند و میانی‌ها هیچ اطلاع تازه‌ای نداشتند (قاعده‌ی
   حذف فقط بین دو ردیفِ هم‌مقدار اعمال می‌شود). «یکسان» یعنی سه‌تاییِ
   (مقدار نمایش‌داده‌شده، raw_value، raw_scale) — اگر منبع فقط نمایشِ خامش
   را عوض کرده باشد، تکراری نیست و می‌ماند (قاعده‌ی ۲ قراردادها).
   دو قید محافظه‌کار: (الف) فشرده‌سازی هم حذفِ خام است ⟸ همان دروازه‌ی
   هرس را دارد: فقط ردیفی حذف می‌شود که ساعتِ سری‌اش تجمیعِ موفق دارد؛
   (ب) پنجره‌ی نگاه محدود است (`COMPRESSION_LOOKBACK`) — دنباله‌های
   طولانی‌تر از پنجره چند «لنگر» دوره‌ای اضافه نگه می‌دارند که زنجیره را
   فقط محکم‌تر می‌کند، هرگز سست‌تر.

۳) **هرس** (`prune_expired_raw`): ردیف خامِ قدیمی‌تر از ۹۰ روز فقط وقتی حذف
   می‌شود که برای همان (منبع، دارایی، سمت، ساعت) ردیف تجمیع موجود باشد —
   معیار پذیرش بلیت: «هرس فقط بعد از تجمیع موفق همان بازه». ساعتِ
   تجمیع‌نشده هر قدر کهنه باشد می‌ماند تا تجمیعش برسد. ردیف‌های سرکوب‌شده
   **هرگز** هرس نمی‌شوند: کم‌شمارند و سندِ کارکرد چک میانه‌اند («این عدد را
   دیدیم و نمایش ندادیم»). جدول‌های platforms، platform_terms و posts اصلاً
   موضوع این ماژول نیستند و هرگز هرس نمی‌شوند.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import NamedTuple, Protocol

from pydantic import BaseModel, ConfigDict

log = logging.getLogger("mazane.collector.retention")

RAW_RETENTION = timedelta(days=90)
# پنجره‌ی فشرده‌سازی: با گذر ساعتی، ۲۵ ساعت یعنی هر ساعتِ تازه‌تمام‌شده
# به‌همراه یک شبانه‌روز عقب‌تر دیده می‌شود تا دنباله‌های گذرنده از مرز ساعت
# هم فشرده شوند؛ درازتر از این فقط لنگرهای بی‌ضرر باقی می‌گذارد.
COMPRESSION_LOOKBACK = timedelta(hours=25)


class SourceKind(StrEnum):
    """منشأ ردیف خام: جدول سکوها یا جدول مراجع قیمت — هر دو آرشیو حقوقی‌اند."""

    PLATFORM = "PLATFORM"
    REFERENCE = "REFERENCE"


class RawRow(BaseModel):
    """نمای یکدستِ یک ردیف خام برای منطق نگه‌داری.

    `value` برای سکو همان `price_toman` نمایش‌داده‌شده است و برای مرجع همان
    `value` — چیزی که تجمیع باید حفظ کند دقیقاً «عدد نمایش‌داده‌شده» است.
    هویت ردیف برای حذف، زوج (kind, row_id) است چون دو جدول شمارنده‌ی
    جدای خودشان را دارند.
    """

    model_config = ConfigDict(frozen=True)

    row_id: int
    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    value: Decimal
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime
    suppressed: bool = False


class RollupKey(NamedTuple):
    """کلید طبیعی یک ردیف تجمیع — همان قید یکتایی جدول `hourly_rollups`."""

    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    hour_start: datetime


class HourlyRollup(BaseModel):
    """تجمیع یک ساعتِ یک سری: باز/بسته/کمینه/بیشینه + شمار نمونه."""

    model_config = ConfigDict(frozen=True)

    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    hour_start: datetime
    open_value: Decimal
    close_value: Decimal
    min_value: Decimal
    max_value: Decimal
    sample_count: int

    @property
    def key(self) -> RollupKey:
        return RollupKey(self.kind, self.source_slug, self.instrument, self.side, self.hour_start)


class RetentionStore(Protocol):
    """سطح تماس نگه‌داری با استور تاریخچه — پستگرس واقعی یا فیک تست."""

    async def load_raw_rows(
        self, *, until: datetime, since: datetime | None = None
    ) -> tuple[RawRow, ...]:
        """ردیف‌های خام (سکو + مرجع، با سرکوب‌شده‌ها) در `since <= fetched_at < until`."""
        ...

    async def latest_rollup_hour(self) -> datetime | None:
        """جدیدترین `hour_start` تجمیع‌شده — لبه‌ی پیشروی تجمیع، یا None در آغاز."""
        ...

    async def load_rollup_keys(
        self, *, until: datetime, since: datetime | None = None
    ) -> frozenset[RollupKey]:
        """کلیدهای تجمیعِ موجود در `since <= hour_start < until` — دروازه‌ی حذف."""
        ...

    async def upsert_rollups(self, rollups: Sequence[HourlyRollup]) -> None:
        """درج یا بازنویسی روی کلید طبیعی — بازاجرا هرگز ردیف تکراری نمی‌سازد."""
        ...

    async def delete_raw_rows(self, rows: Sequence[RawRow]) -> None:
        """حذف ردیف‌های خام به هویت (kind, row_id) — فقط از مسیر همین ماژول."""
        ...

    async def get_hourly_rollups(
        self,
        kind: SourceKind,
        source_slug: str,
        instrument: str | None = None,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[HourlyRollup, ...]:
        """کوئری تاریخچه: سری ساعتی یک منبع (و در صورت تعیین، یک دارایی)."""
        ...


class RetentionReport(NamedTuple):
    """خلاصه‌ی یک گذر نگه‌داری — برای لاگ حلقه‌ی اصلی."""

    rollups_written: int
    rows_compressed: int
    rows_pruned: int


def hour_floor(moment: datetime) -> datetime:
    """آغاز ساعتِ دربرگیرنده‌ی لحظه — مرز بازه‌های تجمیع."""
    return moment.replace(minute=0, second=0, microsecond=0)


def row_key(row: RawRow) -> RollupKey:
    """کلید تجمیعی که این ردیف خام به آن تعلق دارد."""
    return RollupKey(row.kind, row.source_slug, row.instrument, row.side, hour_floor(row.fetched_at))


def build_rollups(rows: Sequence[RawRow]) -> tuple[HourlyRollup, ...]:
    """تابع خالص تجمیع: ردیف‌های خام ⟸ ردیف‌های ساعتی. سرکوب‌شده‌ها بیرون."""
    groups: dict[RollupKey, list[RawRow]] = {}
    for row in rows:
        if row.suppressed:
            continue
        groups.setdefault(row_key(row), []).append(row)

    rollups: list[HourlyRollup] = []
    for key in sorted(groups):
        members = sorted(groups[key], key=lambda r: (r.fetched_at, r.row_id))
        values = [member.value for member in members]
        rollups.append(
            HourlyRollup(
                kind=key.kind,
                source_slug=key.source_slug,
                instrument=key.instrument,
                side=key.side,
                hour_start=key.hour_start,
                open_value=members[0].value,
                close_value=members[-1].value,
                min_value=min(values),
                max_value=max(values),
                sample_count=len(members),
            )
        )
    return tuple(rollups)


def duplicate_run_victims(rows: Sequence[RawRow]) -> tuple[RawRow, ...]:
    """ردیف‌های میانیِ هر دنباله‌ی بی‌وقفه‌ی مقدارِ یکسان، به تفکیک سری.

    «یکسان» = (value, raw_value, raw_scale). اولین و آخرین ردیف هر دنباله
    هرگز برنمی‌گردند — قرارداد دفاع‌پذیری سرِ ماژول.
    """
    series: dict[tuple[SourceKind, str, str, str], list[RawRow]] = {}
    for row in rows:
        series.setdefault((row.kind, row.source_slug, row.instrument, row.side), []).append(row)

    victims: list[RawRow] = []
    for members in series.values():
        members.sort(key=lambda r: (r.fetched_at, r.row_id))
        run: list[RawRow] = []
        for row in members:
            if run and (row.value, row.raw_value, row.raw_scale) != (
                run[0].value,
                run[0].raw_value,
                run[0].raw_scale,
            ):
                victims.extend(run[1:-1])
                run = []
            run.append(row)
        victims.extend(run[1:-1])
    return tuple(victims)


async def rollup_completed_hours(
    store: RetentionStore, *, now: datetime | None = None
) -> tuple[HourlyRollup, ...]:
    """تجمیع همه‌ی ساعت‌های کامل‌شده‌ی تجمیع‌نشده + بازتجمیع آخرین ساعت.

    جبران جاماندگی خودکار است: در نخستین اجرا (بدون هیچ تجمیعی) کل تاریخچه
    و پس از هر وقفه، از لبه‌ی پیشروی به بعد پوشش داده می‌شود. ساعتِ خالی
    ردیفی تولید نمی‌کند و upsert هرگز ردیفی را پاک نمی‌کند — پس بازتجمیعِ
    ساعتی که خامش بعداً هرس شده، تجمیع موجودش را خراب نمی‌کند (و اصلاً رخ
    نمی‌دهد: لبه‌ی پیشروی همیشه جلوتر از پنجره‌ی هرس است).
    """
    moment = now if now is not None else datetime.now(UTC)
    until = hour_floor(moment)  # فقط ساعت‌هایی که تمام شده‌اند
    since = await store.latest_rollup_hour()
    rows = await store.load_raw_rows(until=until, since=since)
    rollups = build_rollups(rows)
    if rollups:
        await store.upsert_rollups(rollups)
    return rollups


async def compress_duplicate_runs(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    lookback: timedelta = COMPRESSION_LOOKBACK,
) -> int:
    """حذف میانی‌های دنباله‌های تکراری در ساعت‌های کامل‌شده‌ی تجمیع‌شده."""
    moment = now if now is not None else datetime.now(UTC)
    until = hour_floor(moment)
    since = until - lookback
    rows = await store.load_raw_rows(until=until, since=since)
    rolled = await store.load_rollup_keys(until=until, since=since)
    published = [row for row in rows if not row.suppressed]
    victims = [row for row in duplicate_run_victims(published) if row_key(row) in rolled]
    if victims:
        await store.delete_raw_rows(victims)
    return len(victims)


async def prune_expired_raw(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    retention: timedelta = RAW_RETENTION,
) -> int:
    """حذف خامِ منتشرشده‌ی کهنه‌تر از پنجره — فقط با تجمیعِ موفقِ همان بازه."""
    moment = now if now is not None else datetime.now(UTC)
    cutoff = moment - retention
    rows = await store.load_raw_rows(until=cutoff)
    rolled = await store.load_rollup_keys(until=cutoff)
    victims = [row for row in rows if not row.suppressed and row_key(row) in rolled]
    skipped = sum(1 for row in rows if not row.suppressed) - len(victims)
    if skipped:
        # ساعتِ بی‌تجمیع هرس نمی‌شود؛ گذر بعدیِ تجمیع جبرانش می‌کند.
        log.warning("هرس: %s ردیف کهنه بدون تجمیعِ بازه‌شان ماندند", skipped)
    if victims:
        await store.delete_raw_rows(victims)
    return len(victims)


async def retention_pass(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    retention: timedelta = RAW_RETENTION,
    lookback: timedelta = COMPRESSION_LOOKBACK,
) -> RetentionReport:
    """یک گذر کامل نگه‌داری — ترتیبْ عمدی است: اول تجمیع (تا باز/بسته از خامِ
    کامل ساخته شود)، بعد فشرده‌سازی، و هرس در آخر و فقط پشت دروازه‌ی تجمیع."""
    rollups = await rollup_completed_hours(store, now=now)
    compressed = await compress_duplicate_runs(store, now=now, lookback=lookback)
    pruned = await prune_expired_raw(store, now=now, retention=retention)
    return RetentionReport(len(rollups), compressed, pruned)
