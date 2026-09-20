import { describe, expect, it } from "vitest";

import { domainOf, expectedDirName, sanitizeFilename } from "./naming.ts";
import type { TableInfo } from "./types.ts";

function makeInfo(name: string, url: string): TableInfo {
  return { name, symbol: "", url, extra: {} };
}

describe("sanitizeFilename", () => {
  it("把非法字符替换为全角", () => {
    expect(sanitizeFilename("a/b:c")).toBe("a／b：c");
    expect(sanitizeFilename('x*?"<>|\\')).toBe("x＊？＂＜＞｜＼");
  });

  it("把控制字符替换为下划线并折叠连续下划线", () => {
    expect(sanitizeFilename("a\u0000\u0001b")).toBe("a_b");
    expect(sanitizeFilename("a__b")).toBe("a_b");
  });

  it("替换结尾的点与空格", () => {
    expect(sanitizeFilename("trailing. ")).toBe("trailing．　");
    expect(sanitizeFilename("normal")).toBe("normal");
  });
});

describe("domainOf", () => {
  it("取主机名", () => {
    expect(domainOf("https://example.com/x")).toBe("example.com");
  });

  it("IP 与非法 URL 返回 null", () => {
    expect(domainOf("http://127.0.0.1/x")).toBeNull();
    expect(domainOf("http://[::1]/x")).toBeNull();
    expect(domainOf("not a url")).toBeNull();
  });
});

describe("expectedDirName", () => {
  it("用 URL 主机名加表名生成目录名", () => {
    expect(
      expectedDirName(
        makeInfo(
          "obj.スノート",
          "https://bmsdb.hexlataia.xyz/hinanjoy?name=obj.%E3%82%B9%E3%83%8E%E3%83%BC%E3%83%88"
        )
      )
    ).toBe("[bmsdb.hexlataia.xyz] obj.スノート");
  });

  it("URL 无域名时用旧目录名的 [domain] 前缀", () => {
    expect(expectedDirName(makeInfo("表", "http://127.0.0.1/table"), "[example.com] 旧名")).toBe(
      "[example.com] 表"
    );
  });

  it("两者都没有时回落 unknown.domain", () => {
    expect(expectedDirName(makeInfo("表", "http://127.0.0.1/table"))).toBe("[unknown.domain] 表");
  });
});
