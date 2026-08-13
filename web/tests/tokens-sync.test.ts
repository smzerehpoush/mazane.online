/**
 * ⚠️ چرا این تست لازم است: `tokens.css` خودش را «منبع حقیقت رنگ‌ها»
 * اعلام می‌کند و معیار پذیرش می‌گوید «هیچ رنگ هگزی بیرون از
 * `tokens.css` نیست» — ولی **هیچ‌چیز آن فایل را مصرف نمی‌کند**. تیلویند فقط
 * `../src` را می‌کاود و `` بیرون آن است، پس پالت در `styles.css`
 * دست‌نویس تکرار شده. یعنی عملاً دو منبع حقیقت داریم که می‌توانند بی‌صدا
 * واگرا شوند.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

function colorVars(source: string, selector: string): Record<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  if (block === null) throw new Error(`بلوک ${selector} پیدا نشد`);
  const out: Record<string, string> = {};
  for (const [, name, value] of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const trimmed = value!.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) out[name!] = trimmed.toLowerCase();
  }
  return out;
}

describe("پالت رنگ — سند و پیاده‌سازی نباید واگرا شوند", () => {
  const tokens = read("docs/tokens.css");
  const styles = read("web/src/styles.css");

  it.each([
    ["روشن", ":root"],
    ["تاریک", '\\[data-theme="dark"\\]'],
  ])("تم %s: هر رنگ سند دقیقاً همان مقدار را در styles.css دارد", (_label, selector) => {
    const fromDoc = colorVars(tokens, selector);
    const fromCss = colorVars(styles, selector);

    expect(Object.keys(fromDoc).length).toBeGreaterThan(15);

    const drift: string[] = [];
    for (const [name, value] of Object.entries(fromDoc)) {
      const actual = fromCss[name];
      if (actual === undefined) drift.push(`${name}: در styles.css نیست`);
      else if (actual !== value) drift.push(`${name}: سند ${value} ≠ کد ${actual}`);
    }
    expect(drift, `واگرایی پالت:\n${drift.join("\n")}`).toEqual([]);
  });

  it("اصلاح کنتراست --tx3 در هر دو فایل هست", () => {
    expect(colorVars(tokens, ":root")["--tx3"]).toBe("#666d78");
    expect(colorVars(styles, ":root")["--tx3"]).toBe("#666d78");
    expect(colorVars(tokens, '\\[data-theme="dark"\\]')["--tx3"]).toBe("#8b94a1");
    expect(colorVars(styles, '\\[data-theme="dark"\\]')["--tx3"]).toBe("#8b94a1");
  });
});
