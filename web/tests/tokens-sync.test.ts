/**
 * ⚠️ Why this test is needed: `tokens.css` declares itself the "single
 * source of truth for colors" and the acceptance criterion says "no hex
 * color exists outside `tokens.css`" — but **nothing actually consumes that
 * file**. Tailwind only scans `../src`, and `` is outside that, so the
 * palette is hand-duplicated in `styles.css`. That means we effectively
 * have two sources of truth that can silently drift apart.
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
  if (block === null) throw new Error(`Block ${selector} not found`);
  const out: Record<string, string> = {};
  for (const [, name, value] of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const trimmed = value!.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) out[name!] = trimmed.toLowerCase();
  }
  return out;
}

describe("Color palette — doc and implementation must not drift apart", () => {
  const tokens = read("docs/tokens.css");
  const styles = read("web/src/styles.css");

  it.each([
    ["light", ":root"],
    ["dark", '\\[data-theme="dark"\\]'],
  ])("%s theme: every doc color has that exact same value in styles.css", (_label, selector) => {
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

  it("The --tx3 contrast fix is in both files", () => {
    expect(colorVars(tokens, ":root")["--tx3"]).toBe("#666d78");
    expect(colorVars(styles, ":root")["--tx3"]).toBe("#666d78");
    expect(colorVars(tokens, '\\[data-theme="dark"\\]')["--tx3"]).toBe("#8b94a1");
    expect(colorVars(styles, '\\[data-theme="dark"\\]')["--tx3"]).toBe("#8b94a1");
  });
});
