/**
 * تابع خالص اعتبارسنجی سمت کلاینت فرم آپلود عکس شاخص (بلیت ۲۴ — تکمیل UI).
 * قرارداد واقعی/قطعی سمت سرور در `tests/admin-post-image.test.ts` سنجیده
 * می‌شود — این‌جا فقط منطق فعال/غیرفعال بودن دکمه‌ی آپلود در کلاینت است.
 */
import { describe, expect, it } from "vitest";

import { canUploadPostImage } from "../src/lib/admin-post-image-form";

function fakeFile(): File {
  return new File(["x"], "cover.webp", { type: "image/webp" });
}

describe("canUploadPostImage", () => {
  it("فایل غایب ⟸ نادرست", () => {
    expect(canUploadPostImage({ file: null, alt: "توصیف عکس" })).toBe(false);
  });

  it("متن جایگزین خالی ⟸ نادرست", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "" })).toBe(false);
  });

  it("متن جایگزین فقط فاصله ⟸ نادرست", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "   " })).toBe(false);
  });

  it("فایل و متن جایگزین هر دو حاضر ⟸ درست", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "توصیف عکس" })).toBe(true);
  });
});
