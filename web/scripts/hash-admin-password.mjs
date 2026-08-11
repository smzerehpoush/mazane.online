#!/usr/bin/env node
/**
 * هش رمز عبور پنل مدیریت برای TABLO_ADMIN_PASSWORD_HASH (بلیت ۲۰).
 *
 * فقط هش را در stdout چاپ می‌کند — رمز خام هیچ‌جا لاگ نمی‌شود (نه در stdout،
 * نه در stderr، نه در فایل). خروجی مستقیم در `.env` سرور کپی می‌شود.
 *
 * ⚠️ الگوریتم اینجا عمداً **کپی** همان چیزی است که
 * `src/lib/admin-auth.ts` (`hashPassword`/`verifyPassword`) پیاده می‌کند،
 * نه import از آن — این یک اسکریپت Node ساده‌ی `.mjs` است و بدون مرحله‌ی
 * بیلد/ts-node نمی‌تواند مستقیم `.ts` را اجرا کند. هر تغییری در فرمت هش یا
 * پارامترهای scrypt در `admin-auth.ts`، باید همین‌جا هم بیاید — وگرنه هش
 * تولیدی این اسکریپت با `verifyPassword` هم‌خوان نمی‌ماند.
 *
 * اجرا:
 *   node scripts/hash-admin-password.mjs '<رمز عبور>'
 *   npm run admin:hash-password -- '<رمز عبور>'
 */
import { randomBytes, scryptSync } from "node:crypto";

const SCRYPT_KEYLEN = 64; // باید با admin-auth.ts یکی بماند

const password = process.argv[2];

if (typeof password !== "string" || password.length === 0) {
  console.error("استفاده: node scripts/hash-admin-password.mjs '<رمز عبور>'");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  process.stdout.write(`${salt.toString("hex")}:${hash.toString("hex")}\n`);
}
