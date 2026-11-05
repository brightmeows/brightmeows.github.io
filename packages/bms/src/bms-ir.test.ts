import { describe, expect, it } from "vitest";

import { extractBmsIrSongMd5 } from "./bms-ir.ts";

describe("extractBmsIrSongMd5", () => {
  it("extracts songmd5 from apex and www chart URLs", () => {
    const apex = "https://bms-ir.org/new/song?songmd5=c46a81cb184f5a804c119930d6eba748&view=new";
    expect(extractBmsIrSongMd5(apex)).toEqual({
      ok: true,
      md5: "c46a81cb184f5a804c119930d6eba748",
    });
    const www = "http://www.bms-ir.org/new/song?view=new&songmd5=C46A81CB184F5A804C119930D6EBA748";
    expect(extractBmsIrSongMd5(www)).toEqual({
      ok: true,
      md5: "c46a81cb184f5a804c119930d6eba748",
    });
  });

  it("accepts whitespace padding and trailing fragments", () => {
    const url = `  https://bms-ir.org/new/song?songmd5=${"a".repeat(32)}#top  `;
    expect(extractBmsIrSongMd5(url)).toEqual({ ok: true, md5: "a".repeat(32) });
  });

  it("rejects foreign hosts, non-song URLs, bare domains, and malformed hashes", () => {
    expect(extractBmsIrSongMd5(`https://example.com/new/song?songmd5=${"a".repeat(32)}`).ok).toBe(
      false
    );
    expect(extractBmsIrSongMd5("https://bms-ir.org/new/sa?id=30").ok).toBe(false);
    expect(extractBmsIrSongMd5(`bms-ir.org/new/song?songmd5=${"a".repeat(32)}`).ok).toBe(false);
    expect(extractBmsIrSongMd5("https://bms-ir.org/new/song?songmd5=abc").ok).toBe(false);
  });
});
