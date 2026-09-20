import { describe, expect, it } from "vitest";

import { extractBmstableContent, extractBmstableUrlHint } from "./meta.ts";

describe("extractBmstableContent", () => {
  it("提取 name=bmstable 的 content", () => {
    const html = '<html><head><meta name="bmstable" content="header.json"></head></html>';
    expect(extractBmstableContent(html)).toBe("header.json");
  });

  it("支持 property 形式、大小写与属性顺序变化", () => {
    expect(extractBmstableContent('<meta PROPERTY="bmstable" content="h.json">')).toBe("h.json");
    expect(extractBmstableContent('<meta content="h.json" name="BmStable">')).toBe("h.json");
  });

  it("支持无引号属性", () => {
    expect(extractBmstableContent("<meta name=bmstable content=header.json>")).toBe("header.json");
  });

  it("解码 HTML 实体（bmsdb 的 content 里带 &amp;）", () => {
    const html =
      '<meta name="bmstable" content="/hinanjoy/header.json?name=Thasyka&amp;symbol=Th&amp;filter=%7B%22a%22%3A%22a%22%7D">';
    expect(extractBmstableContent(html)).toBe(
      "/hinanjoy/header.json?name=Thasyka&symbol=Th&filter=%7B%22a%22%3A%22a%22%7D"
    );
  });

  it("忽略注释里的 meta，找不到时返回 null", () => {
    expect(extractBmstableContent('<!-- <meta name="bmstable" content="x"> -->')).toBeNull();
    expect(extractBmstableContent("<html><head></head></html>")).toBeNull();
    expect(extractBmstableContent('{"name":"x","symbol":"x","data_url":"d.json"}')).toBeNull();
  });

  it("content 为空时不算命中", () => {
    expect(extractBmstableContent('<meta name="bmstable" content="">')).toBeNull();
  });
});

describe("extractBmstableUrlHint", () => {
  it("meta 优先于回退链", () => {
    const html =
      '<link rel="bmstable" href="other.json"><meta name="bmstable" content="header.json">';
    expect(extractBmstableUrlHint(html)).toBe("header.json");
  });

  it("回退到 link[rel=bmstable]", () => {
    const html = '<link rel="bmstable" href="data/header.json">';
    expect(extractBmstableUrlHint(html)).toBe("data/header.json");
  });

  it("回退到 a/link/script 里的 header*.json", () => {
    expect(extractBmstableUrlHint('<a href="json/header_7i.json">表</a>')).toBe(
      "json/header_7i.json"
    );
    expect(extractBmstableUrlHint('<script src="assets/header.json"></script>')).toBe(
      "assets/header.json"
    );
  });

  it("回退到全文扫描（upl.konjiki.jp 这类页面）", () => {
    const html = '<html><body><script>var x = "data/header.json";</script></body></html>';
    expect(extractBmstableUrlHint(html)).toBe("data/header.json");
  });

  it("没有任何线索时返回 null", () => {
    expect(extractBmstableUrlHint("<html><body>表</body></html>")).toBeNull();
  });
});
