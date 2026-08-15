import { describe, expect, it } from "vitest";

import { canUploadPostImage } from "../src/lib/admin-post-image-form";

function fakeFile(): File {
  return new File(["x"], "cover.webp", { type: "image/webp" });
}

describe("canUploadPostImage", () => {
  it("missing file ⟸ false", () => {
    expect(canUploadPostImage({ file: null, alt: "توصیف عکس" })).toBe(false);
  });

  it("empty alt text ⟸ false", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "" })).toBe(false);
  });

  it("whitespace-only alt text ⟸ false", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "   " })).toBe(false);
  });

  it("both file and alt text present ⟸ true", () => {
    expect(canUploadPostImage({ file: fakeFile(), alt: "توصیف عکس" })).toBe(true);
  });
});
