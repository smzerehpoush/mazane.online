import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFaNumber } from "@/lib/fa-number";
import { formatDateFa } from "@/lib/format";
import type { ReferralClickReport } from "@/lib/referral-clicks";

export const Route = createFileRoute("/admin/clicks")({
  head: () => ({
    meta: [
      { title: "کلیک‌های معرف — پنل مدیریت تابلو" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminClicksPage,
});

interface Payload {
  report: ReferralClickReport;
  names: Record<string, string>;
}

function AdminClicksPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/admin-referral-clicks");
        if (response.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!response.ok) {
          if (!cancelled) setLoadError("خواندن آمار کلیک با خطا مواجه شد.");
          return;
        }
        const body = (await response.json()) as Payload;
        if (!cancelled) setPayload(body);
      } catch {
        if (!cancelled) setLoadError("ارتباط با سرور برقرار نشد.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const report = payload?.report ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-background px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>کلیک‌های معرف</CardTitle>
          <CardDescription>
            شمار کلیک روی نشانی‌های <span dir="ltr">/go/</span> به تفکیک سکو و روز (به وقت تهران).
            فقط اسلاگ سکو ذخیره می‌شود؛ نشانی معرف هیچ‌جا نگهداری نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError !== null && <p className="text-sm text-destructive">{loadError}</p>}
          {report === null && loadError === null && (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          )}

          {report !== null && !report.available && (
            <p className="text-sm text-muted-foreground">
              شمارنده در دسترس نیست — عددها ممکن است ناقص باشند.
            </p>
          )}

          {report !== null && report.rows.length === 0 && report.available && (
            <p className="text-sm text-muted-foreground">
              در {formatFaNumber(report.days.length)} روز گذشته کلیکی ثبت نشده است.
            </p>
          )}

          {report !== null && report.rows.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">سکو</TableHead>
                      <TableHead className="text-right">امروز</TableHead>
                      <TableHead className="text-right">
                        مجموع {formatFaNumber(report.days.length)} روز
                      </TableHead>
                      {report.days.map((day) => (
                        <TableHead key={day} className="whitespace-nowrap text-right">
                          {formatDateFa(day)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row) => (
                      <TableRow key={row.slug} data-platform={row.slug}>
                        <TableCell className="font-medium">
                          {payload?.names[row.slug] ?? row.slug}
                        </TableCell>
                        <TableCell>{formatFaNumber(row.today)}</TableCell>
                        <TableCell className="font-medium">{formatFaNumber(row.total)}</TableCell>
                        {row.daily.map((count, index) => (
                          <TableCell key={report.days[index]}>{formatFaNumber(count)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                مجموع کل: {formatFaNumber(report.total)} کلیک
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
