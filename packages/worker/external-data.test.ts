import { describe, expect, it } from "vitest";

import { EXTERNAL_DATA_HOSTS } from "../../src/lib/constants/external-data.ts";

import { EXTERNAL_DATA_SOURCES, isAllowedExternalDataUrl } from "./external-data.ts";

describe("isAllowedExternalDataUrl", () => {
  it("放行白名单内的谱面数据地址", () => {
    expect(isAllowedExternalDataUrl(new URL("https://stellabms.xyz/sl/score.json"))).toBe(true);
  });

  it("拒绝非 https 协议", () => {
    expect(isAllowedExternalDataUrl(new URL("http://stellabms.xyz/sl/score.json"))).toBe(false);
  });

  it("拒绝未登记的主机", () => {
    expect(isAllowedExternalDataUrl(new URL("https://example.com/sl/score.json"))).toBe(false);
    expect(isAllowedExternalDataUrl(new URL("https://evil.stellabms.xyz/sl/score.json"))).toBe(
      false
    );
  });

  it("拒绝路径后缀不匹配的地址", () => {
    expect(isAllowedExternalDataUrl(new URL("https://stellabms.xyz/sl/score.txt"))).toBe(false);
  });
});

describe("白名单一致性", () => {
  it("客户端与 Worker 的主机集合一致", () => {
    const workerHosts = EXTERNAL_DATA_SOURCES.map((source) => source.host).sort();
    const clientHosts = [...EXTERNAL_DATA_HOSTS].sort();
    expect(clientHosts).toEqual(workerHosts);
  });
});
