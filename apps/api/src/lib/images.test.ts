import assert from "node:assert/strict";
import test from "node:test";
import { detectImage } from "./images.js";

test("detects supported image formats from their bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");

  assert.deepEqual(detectImage(png), { extension: ".png", mime: "image/png" });
  assert.deepEqual(detectImage(jpeg), { extension: ".jpg", mime: "image/jpeg" });
  assert.deepEqual(detectImage(webp), { extension: ".webp", mime: "image/webp" });
});

test("rejects executable content even when a filename could look like an image", () => {
  const executable = Buffer.from("MZ harmless thesis marker", "ascii");
  assert.equal(detectImage(executable), undefined);
});
