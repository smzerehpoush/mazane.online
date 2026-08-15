/**
 * ⚠️ This page has nothing to do with the price table — chart membership
 * does not affect the price table's ordering/listing.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MAX_CHART_PLATFORMS,
  MIN_CHART_PLATFORMS,
  isValidChartColor,
  isValidReferralUrl,
  type PlatformOption,
  type PlatformSettingEntry,
} from "@/lib/platform-settings";

export const Route = createFileRoute("/admin/platforms")({
  head: () => ({
    meta: [
      { title: "تنظیمات نمودار — پنل مدیریت تابلو" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPlatformsPage,
});

const DEFAULT_PALETTE = ["#1d6fe0", "#0bb0d4", "#9b8ce8", "#12a06a", "#e0921d", "#d64545"];

interface Row extends PlatformSettingEntry {
  name_fa: string;
  website_url: string | null;
}

function nextDefaultColor(rows: Row[]): string {
  const used = new Set(rows.filter((r) => r.in_chart).map((r) => r.chart_color));
  return DEFAULT_PALETTE.find((c) => !used.has(c)) ?? DEFAULT_PALETTE[0]!;
}

function activeOrdered(rows: Row[]): Row[] {
  return rows.filter((r) => r.in_chart).sort((a, b) => (a.chart_order ?? 0) - (b.chart_order ?? 0));
}

function referralError(row: Row): string | null {
  const trimmed = row.referral_url?.trim() ?? "";
  if (trimmed.length === 0) return null;
  if (row.website_url === null)
    return "این سکو نشانی رسمی مستندی ندارد — لینک معرف پذیرفته نمی‌شود.";
  if (!isValidReferralUrl(trimmed, row.website_url)) {
    return `باید https و هم‌دامنه یا زیردامنه‌ی ${row.website_url} باشد.`;
  }
  return null;
}

function AdminPlatformsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/admin-platform-settings");
        if (response.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!response.ok) {
          if (!cancelled) setLoadError("خواندن تنظیمات با خطا مواجه شد.");
          return;
        }
        const body = (await response.json()) as {
          platforms: PlatformOption[];
          settings: PlatformSettingEntry[];
        };
        if (cancelled) return;
        const settingsBySlug = new Map(body.settings.map((s) => [s.slug, s]));
        setRows(
          body.platforms.map((platform) => {
            const setting = settingsBySlug.get(platform.slug);
            return {
              slug: platform.slug,
              name_fa: platform.name_fa,
              website_url: platform.website_url,
              in_chart: setting?.in_chart ?? false,
              chart_color: setting?.chart_color ?? null,
              chart_order: setting?.chart_order ?? null,
              referral_url: setting?.referral_url ?? null,
            };
          }),
        );
      } catch {
        if (!cancelled) setLoadError("ارتباط با سرور برقرار نشد.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const activeCount = useMemo(() => (rows ?? []).filter((r) => r.in_chart).length, [rows]);
  const countOk = activeCount >= MIN_CHART_PLATFORMS && activeCount <= MAX_CHART_PLATFORMS;
  const colorsOk = (rows ?? [])
    .filter((r) => r.in_chart)
    .every((r) => r.chart_color !== null && isValidChartColor(r.chart_color));
  const referralsOk = (rows ?? []).every((r) => referralError(r) === null);

  function toggle(slug: string) {
    setRows((prev) => {
      if (prev === null) return prev;
      const next = prev.map((r) => ({ ...r }));
      const row = next.find((r) => r.slug === slug);
      if (row === undefined) return prev;
      if (row.in_chart) {
        row.in_chart = false;
      } else {
        row.in_chart = true;
        if (row.chart_color === null) row.chart_color = nextDefaultColor(next);
        row.chart_order = activeOrdered(next.filter((r) => r.slug !== slug)).length;
      }
      return next;
    });
    setSaved(false);
  }

  function setColor(slug: string, color: string) {
    setRows((prev) =>
      prev === null ? prev : prev.map((r) => (r.slug === slug ? { ...r, chart_color: color } : r)),
    );
    setSaved(false);
  }

  function setReferralUrl(slug: string, referral_url: string) {
    setRows((prev) =>
      prev === null
        ? prev
        : prev.map((r) => (r.slug === slug ? { ...r, referral_url: referral_url || null } : r)),
    );
    setSaved(false);
  }

  function move(slug: string, direction: -1 | 1) {
    setRows((prev) => {
      if (prev === null) return prev;
      const ordered = activeOrdered(prev);
      const index = ordered.findIndex((r) => r.slug === slug);
      const swapWith = index + direction;
      if (index === -1 || swapWith < 0 || swapWith >= ordered.length) return prev;

      const a = ordered[index]!;
      const b = ordered[swapWith]!;
      const aOrder = a.chart_order;
      const bOrder = b.chart_order;
      return prev.map((r) => {
        if (r.slug === a.slug) return { ...r, chart_order: bOrder };
        if (r.slug === b.slug) return { ...r, chart_order: aOrder };
        return r;
      });
    });
    setSaved(false);
  }

  async function onSave() {
    if (rows === null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const ordered = activeOrdered(rows);
      const orderBySlug = new Map(ordered.map((r, i) => [r.slug, i]));
      const entries: PlatformSettingEntry[] = rows.map((r) => ({
        slug: r.slug,
        in_chart: r.in_chart,
        chart_color: r.in_chart ? r.chart_color : null,
        chart_order: r.in_chart ? (orderBySlug.get(r.slug) ?? 0) : null,
        referral_url: r.referral_url,
      }));

      const response = await fetch("/api/admin-platform-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(body?.error ?? "ذخیره با خطا مواجه شد.");
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-background px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>تنظیمات نمودار صفحه‌ی اصلی</CardTitle>
          <CardDescription>
            بین {MIN_CHART_PLATFORMS} تا {MAX_CHART_PLATFORMS} سکو را برای نمودار انتخاب کنید و
            رنگ/ترتیبشان را تعیین کنید؛ نشانی معرف هر سکو مستقل از نمودار است — خالی یعنی بدون
            override. تغییر تا نیم دقیقه بعد روی سایت زنده دیده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError !== null && <p className="text-sm text-destructive">{loadError}</p>}
          {rows === null && loadError === null && (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          )}
          {rows !== null && (
            <>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => {
                  const ordered = activeOrdered(rows);
                  const position = ordered.findIndex((r) => r.slug === row.slug);
                  const referralErrorMessage = referralError(row);
                  return (
                    <li
                      key={row.slug}
                      data-platform={row.slug}
                      className="flex flex-col gap-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={row.in_chart}
                          onCheckedChange={() => toggle(row.slug)}
                          aria-label={`نمایش ${row.name_fa} در نمودار`}
                        />
                        <span className="flex-1 text-sm font-medium text-foreground">
                          {row.name_fa}
                        </span>
                        {row.in_chart && (
                          <>
                            <input
                              type="color"
                              value={row.chart_color ?? "#1d6fe0"}
                              onChange={(event) => setColor(row.slug, event.target.value)}
                              aria-label={`رنگ ${row.name_fa}`}
                              className="h-8 w-10 cursor-pointer rounded border"
                            />
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={position <= 0}
                                onClick={() => move(row.slug, -1)}
                                aria-label={`جابه‌جایی ${row.name_fa} به بالا`}
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={position === -1 || position >= ordered.length - 1}
                                onClick={() => move(row.slug, 1)}
                                aria-label={`جابه‌جایی ${row.name_fa} به پایین`}
                              >
                                ↓
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pr-1">
                        <span className="w-16 shrink-0 text-xs text-muted-foreground">
                          لینک معرف
                        </span>
                        <Input
                          type="url"
                          dir="ltr"
                          value={row.referral_url ?? ""}
                          onChange={(event) => setReferralUrl(row.slug, event.target.value)}
                          placeholder={row.website_url ?? "https://..."}
                          aria-label={`نشانی معرف ${row.name_fa}`}
                          aria-invalid={referralErrorMessage !== null}
                          className="flex-1 text-left text-xs"
                        />
                      </div>
                      {referralErrorMessage !== null && (
                        <p className="pr-[4.5rem] text-xs text-destructive">
                          {referralErrorMessage}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p className="text-sm text-muted-foreground">
                {activeCount} سکو انتخاب شده —{" "}
                {countOk
                  ? "شمار مجاز است."
                  : `باید بین ${MIN_CHART_PLATFORMS} تا ${MAX_CHART_PLATFORMS} سکو انتخاب شود.`}
              </p>

              {saveError !== null && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && <p className="text-sm text-emerald-600">ذخیره شد.</p>}

              <Button
                type="button"
                onClick={() => void onSave()}
                disabled={saving || !countOk || !colorsOk || !referralsOk}
              >
                {saving ? "در حال ذخیره…" : "ذخیره"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
