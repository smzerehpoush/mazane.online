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
import { Textarea } from "@/components/ui/textarea";
import { formatFaNumber } from "@/lib/fa-number";
import {
  KYC_LEVELS,
  KYC_LEVEL_LABELS_FA,
  MAX_FAQ_ITEMS,
  MOBILE_APPS,
  MOBILE_APP_LABELS_FA,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS_FA,
  linesToList,
  listToLines,
  type FaqItem,
  type KycLevel,
  type MobileApp,
  type PaymentMethod,
  type PlatformProfileEntry,
} from "@/lib/platform-profile";
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

interface ProfileRow {
  slug: string;
  name_fa: string;
  payment_methods: PaymentMethod[];
  kyc_level: KycLevel | null;
  mobile_app: MobileApp | null;
  delivery_cost_fa: string;
  min_buy_text: string;
  min_sell_text: string;
  pros_text: string;
  cons_text: string;
  faq: FaqItem[];
}

const NOT_CHECKED_FA = "هنوز بررسی نشده";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring";

function toProfileRow(entry: PlatformProfileEntry, name_fa: string): ProfileRow {
  return {
    slug: entry.slug,
    name_fa,
    payment_methods: entry.payment_methods,
    kyc_level: entry.kyc_level,
    mobile_app: entry.mobile_app,
    delivery_cost_fa: entry.delivery_cost_fa ?? "",
    min_buy_text: entry.min_buy_toman === null ? "" : String(entry.min_buy_toman),
    min_sell_text: entry.min_sell_toman === null ? "" : String(entry.min_sell_toman),
    pros_text: listToLines(entry.pros_fa),
    cons_text: listToLines(entry.cons_fa),
    faq: entry.faq,
  };
}

function parsedMinimum(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function minimumError(row: ProfileRow): string | null {
  for (const [label, text] of [
    ["حداقل خرید", row.min_buy_text],
    ["حداقل فروش", row.min_sell_text],
  ] as const) {
    if (text.trim().length > 0 && parsedMinimum(text) === null) {
      return `${label} باید عددی صحیح و بزرگ‌تر از صفر باشد.`;
    }
  }
  return null;
}

function toProfileEntry(row: ProfileRow): PlatformProfileEntry {
  return {
    slug: row.slug,
    payment_methods: row.payment_methods,
    kyc_level: row.kyc_level,
    mobile_app: row.mobile_app,
    delivery_cost_fa: row.delivery_cost_fa.trim() === "" ? null : row.delivery_cost_fa.trim(),
    min_buy_toman: parsedMinimum(row.min_buy_text),
    min_sell_toman: parsedMinimum(row.min_sell_text),
    pros_fa: linesToList(row.pros_text),
    cons_fa: linesToList(row.cons_text),
    faq: row.faq.filter(
      (item) => item.question_fa.trim().length > 0 && item.answer_fa.trim().length > 0,
    ),
  };
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
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
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
          profiles?: PlatformProfileEntry[];
        };
        if (cancelled) return;
        const settingsBySlug = new Map(body.settings.map((s) => [s.slug, s]));
        const profilesBySlug = new Map((body.profiles ?? []).map((p) => [p.slug, p]));
        setProfiles(
          body.platforms.flatMap((platform) => {
            const profile = profilesBySlug.get(platform.slug);
            return profile === undefined ? [] : [toProfileRow(profile, platform.name_fa)];
          }),
        );
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
  const profilesOk = profiles.every((profile) => minimumError(profile) === null);

  function updateProfile(slug: string, patch: Partial<ProfileRow>) {
    setProfiles((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
    setSaved(false);
  }

  function togglePaymentMethod(slug: string, method: PaymentMethod) {
    setProfiles((prev) =>
      prev.map((p) =>
        p.slug === slug
          ? {
              ...p,
              payment_methods: p.payment_methods.includes(method)
                ? p.payment_methods.filter((m) => m !== method)
                : [...p.payment_methods, method],
            }
          : p,
      ),
    );
    setSaved(false);
  }

  function updateFaq(slug: string, index: number, patch: Partial<FaqItem>) {
    setProfiles((prev) =>
      prev.map((p) =>
        p.slug === slug
          ? { ...p, faq: p.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)) }
          : p,
      ),
    );
    setSaved(false);
  }

  function addFaq(slug: string) {
    setProfiles((prev) =>
      prev.map((p) =>
        p.slug === slug && p.faq.length < MAX_FAQ_ITEMS
          ? { ...p, faq: [...p.faq, { question_fa: "", answer_fa: "" }] }
          : p,
      ),
    );
    setSaved(false);
  }

  function removeFaq(slug: string, index: number) {
    setProfiles((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, faq: p.faq.filter((_, i) => i !== index) } : p)),
    );
    setSaved(false);
  }

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
        body: JSON.stringify({ entries, profiles: profiles.map(toProfileEntry) }),
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
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-background px-4 py-10">
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
            </>
          )}
        </CardContent>
      </Card>

      {profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>شناسنامه‌ی سکوها</CardTitle>
            <CardDescription>
              این فیلدها دستی پر می‌شود و هیچ‌کدام در ترتیب یا مرتب‌سازی جدول قیمت اثری ندارد. هر
              فیلدی که خالی بماند در صفحه‌ی آن سکو اصلاً نمایش داده نمی‌شود، پس چیزی را حدسی پر
              نکنید. مجوز و پروانه عمداً اینجا نیست.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {profiles.map((profile) => {
              const numberError = minimumError(profile);
              return (
                <details
                  key={profile.slug}
                  data-profile={profile.slug}
                  className="rounded-lg border p-3"
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    {profile.name_fa}
                  </summary>

                  <div className="mt-4 flex flex-col gap-4">
                    <fieldset className="flex flex-col gap-2">
                      <legend className="text-xs text-muted-foreground">روش‌های پرداخت</legend>
                      <div className="flex flex-wrap gap-3">
                        {PAYMENT_METHODS.map((method) => (
                          <label key={method} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={profile.payment_methods.includes(method)}
                              onChange={() => togglePaymentMethod(profile.slug, method)}
                              className="size-4"
                            />
                            {PAYMENT_METHOD_LABELS_FA[method]}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        احراز هویت
                        <select
                          className={SELECT_CLASS}
                          value={profile.kyc_level ?? ""}
                          onChange={(event) =>
                            updateProfile(profile.slug, {
                              kyc_level: (event.target.value || null) as KycLevel | null,
                            })
                          }
                        >
                          <option value="">{NOT_CHECKED_FA}</option>
                          {KYC_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {KYC_LEVEL_LABELS_FA[level]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        اپلیکیشن موبایل
                        <select
                          className={SELECT_CLASS}
                          value={profile.mobile_app ?? ""}
                          onChange={(event) =>
                            updateProfile(profile.slug, {
                              mobile_app: (event.target.value || null) as MobileApp | null,
                            })
                          }
                        >
                          <option value="">{NOT_CHECKED_FA}</option>
                          {MOBILE_APPS.map((app) => (
                            <option key={app} value={app}>
                              {MOBILE_APP_LABELS_FA[app]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        حداقل خرید (تومان)
                        <Input
                          inputMode="numeric"
                          value={profile.min_buy_text}
                          onChange={(event) =>
                            updateProfile(profile.slug, { min_buy_text: event.target.value })
                          }
                          aria-invalid={numberError !== null}
                          className="text-sm"
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        حداقل فروش (تومان)
                        <Input
                          inputMode="numeric"
                          value={profile.min_sell_text}
                          onChange={(event) =>
                            updateProfile(profile.slug, { min_sell_text: event.target.value })
                          }
                          aria-invalid={numberError !== null}
                          className="text-sm"
                        />
                      </label>
                    </div>

                    {numberError !== null && (
                      <p className="text-xs text-destructive">{numberError}</p>
                    )}

                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      هزینه‌ی تحویل فیزیکی
                      <Input
                        value={profile.delivery_cost_fa}
                        onChange={(event) =>
                          updateProfile(profile.slug, { delivery_cost_fa: event.target.value })
                        }
                        className="text-sm"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        نقاط قوت (هر خط یک مورد)
                        <Textarea
                          rows={4}
                          value={profile.pros_text}
                          onChange={(event) =>
                            updateProfile(profile.slug, { pros_text: event.target.value })
                          }
                          className="text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        نقاط ضعف (هر خط یک مورد)
                        <Textarea
                          rows={4}
                          value={profile.cons_text}
                          onChange={(event) =>
                            updateProfile(profile.slug, { cons_text: event.target.value })
                          }
                          className="text-sm"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-3">
                      <span className="text-xs text-muted-foreground">پرسش‌های پرتکرار</span>
                      {profile.faq.map((item, index) => (
                        <div key={index} className="flex flex-col gap-2 rounded-md border p-2">
                          <Input
                            value={item.question_fa}
                            onChange={(event) =>
                              updateFaq(profile.slug, index, { question_fa: event.target.value })
                            }
                            placeholder="پرسش"
                            aria-label={`پرسش ${formatFaNumber(index + 1)} برای ${profile.name_fa}`}
                            className="text-sm"
                          />
                          <Textarea
                            rows={3}
                            value={item.answer_fa}
                            onChange={(event) =>
                              updateFaq(profile.slug, index, { answer_fa: event.target.value })
                            }
                            placeholder="پاسخ"
                            aria-label={`پاسخ ${formatFaNumber(index + 1)} برای ${profile.name_fa}`}
                            className="text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeFaq(profile.slug, index)}
                            className="self-start"
                          >
                            حذف این پرسش
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={profile.faq.length >= MAX_FAQ_ITEMS}
                        onClick={() => addFaq(profile.slug)}
                        className="self-start"
                      >
                        افزودن پرسش
                      </Button>
                    </div>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      )}

      {rows !== null && (
        <div className="flex flex-col gap-3">
          {saveError !== null && <p className="text-sm text-destructive">{saveError}</p>}
          {saved && <p className="text-sm text-emerald-600">ذخیره شد.</p>}

          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !countOk || !colorsOk || !referralsOk || !profilesOk}
            className="self-start"
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </Button>
        </div>
      )}
    </div>
  );
}
