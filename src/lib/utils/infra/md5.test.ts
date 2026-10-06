import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { md5 } from "./md5";

const encoder = new TextEncoder();

function hashText(text: string): string {
  return md5(encoder.encode(text));
}

describe("md5", () => {
  it("matches the RFC 1321 test suite", () => {
    expect(hashText("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(hashText("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(hashText("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(hashText("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(hashText("abcdefghijklmnopqrstuvwxyz")).toBe("c3fcd3d76192e4007dfb496cca67e13b");
    expect(hashText("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")).toBe(
      "d174ab98d277d9f5a5611c2c9f419d9f"
    );
    expect(
      hashText("12345678901234567890123456789012345678901234567890123456789012345678901234567890")
    ).toBe("57edf4a22be3c955ac49da2e2107b67a");
  });

  it("matches node:crypto for pseudo-random bytes across block boundaries", () => {
    // 确定性 LCG 生成 100000 字节，覆盖多块与填充边界
    const bytes = new Uint8Array(100_000);
    let state = 123456789;
    for (let i = 0; i < bytes.length; i += 1) {
      state = (state * 1103515245 + 12345) % 0x80000000;
      bytes[i] = state & 0xff;
    }
    const expected = createHash("md5").update(bytes).digest("hex");
    expect(md5(bytes)).toBe(expected);
  });
});
