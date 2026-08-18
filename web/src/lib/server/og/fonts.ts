import "@tanstack/react-start/server-only";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REGULAR_FILE = "vazirmatn-regular-33.0.3.ttf";
const BOLD_FILE = "vazirmatn-bold-33.0.3.ttf";

/**
 * ⚠️ The production image ships **only** `.output` (Dockerfile.web), and the
 * alpine base has no system fonts and no fontconfig config at all — a
 * `sharp({ text })` call without `fontfile` renders tofu there, not Persian.
 * The only copy of these files that survives into the image is the one nitro
 * copies from `public/` into `.output/public/`; moving them anywhere else
 * silently turns every OG card into the text-free fallback.
 */
const CANDIDATE_DIRS = ["public/fonts", ".output/public/fonts"] as const;

export interface OgFontFiles {
  regular: string;
  bold: string;
}

let cached: OgFontFiles | null | undefined;

function locate(): OgFontFiles | null {
  const override = process.env["TABLO_OG_FONT_DIR"];
  const dirs = override === undefined || override === "" ? [...CANDIDATE_DIRS] : [override];

  for (const dir of dirs) {
    const base = resolve(process.cwd(), dir);
    const regular = resolve(base, REGULAR_FILE);
    const bold = resolve(base, BOLD_FILE);
    if (existsSync(regular) && existsSync(bold)) return { regular, bold };
  }
  return null;
}

export function ogFontFiles(): OgFontFiles | null {
  if (cached === undefined) cached = locate();
  return cached;
}

export function resetOgFontFiles(): void {
  cached = undefined;
}
