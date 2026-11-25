import { describe, expect, it } from "vitest";

import { sha256Hex } from "./hash.ts";

describe("sha256Hex", () => {
  it("输出标准 SHA-256 十六进制", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("接受 ArrayBuffer", async () => {
    const bytes = new TextEncoder().encode("abc");
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await sha256Hex(buffer)).toBe(await sha256Hex(bytes));
  });
});
