/**
 * نگهبان هم‌خوانی `scripts/hash-admin-password.mjs` با `lib/admin-auth.ts`.
 *
 * اسکریپت عمداً الگوریتم را **کپی** می‌کند (نه import، چون `.mjs` ساده بدون
 * مرحله‌ی بیلد نمی‌تواند `.ts` را اجرا کند — شرح در خود اسکریپت). این تست
 * تنها نگهبانِ درز کردن آن دو نسخه از هم است: هش تولیدشده توسط اسکریپت باید
 * با `verifyPassword` واقعی تأیید شود.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { verifyPassword } from "../src/lib/admin-auth";

const SCRIPT_PATH = fileURLToPath(new URL("../scripts/hash-admin-password.mjs", import.meta.url));

function runScript(password: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, password], { encoding: "utf8" });
    return { stdout, status: 0 };
  } catch (error) {
    const err = error as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? "", status: err.status ?? 1 };
  }
}

describe("scripts/hash-admin-password.mjs", () => {
  it("هش تولیدشده با verifyPassword واقعی تأیید می‌شود", () => {
    const { stdout, status } = runScript("some-strong-password-۱۲۳۴");
    expect(status).toBe(0);
    const hash = stdout.trim();
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword("some-strong-password-۱۲۳۴", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("بدون آرگومان با پیام راهنما و کد خروج غیرصفر می‌ایستد", () => {
    const { status } = runScript("");
    // execFileSync با آرگومان خالی هم رشته‌ی خالی پاس می‌دهد — یعنی رمز غایب.
    expect(status).not.toBe(0);
  });
});
