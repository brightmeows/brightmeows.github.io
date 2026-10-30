import { describe, expect, it } from "vitest";

import { injectBmstableMeta, renderBmstableMetaTag, transformTableList } from "./manifest.ts";
import type { MirrorTableItem } from "./types.ts";

const SHELL =
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>x</title></head><body></body></html>';

describe("transformTableList", () => {
  it("写入 url_from 与站点内镜像页绝对地址", () => {
    const list: MirrorTableItem[] = [
      { name: "表一", url: "http://example.com/table.html", dir_name: "[example.com] 表一" },
    ];
    const result = transformTableList(list, "https://brightmeows.com");
    expect(result).toHaveLength(1);
    expect(result[0]?.url_from).toBe("http://example.com/table.html");
    expect(result[0]?.url).toBe(
      "https://brightmeows.com/bms/table/mirror/%5Bexample.com%5D%20%E8%A1%A8%E4%B8%80/"
    );
    expect(result[0]?.dir_name).toBe("[example.com] 表一");
  });

  it("origin 尾部斜杠不会拼出双斜杠", () => {
    const result = transformTableList(
      [{ name: "x", url: "http://e.com/", dir_name: "x" }],
      "https://s.site/"
    );
    expect(result[0]?.url).toBe("https://s.site/bms/table/mirror/x/");
  });

  it("缺少 dir_name 时报错而不是静默丢弃", () => {
    expect(() =>
      transformTableList([{ name: "坏条目", url: "http://e.com/" }], "https://s.site")
    ).toThrow(/dir_name/);
  });
});

describe("renderBmstableMetaTag", () => {
  it("输出单行标签且属性顺序为 name 在前", () => {
    const tag = renderBmstableMetaTag("https://r2.example/tables/x/header.json");
    expect(tag).toBe('<meta name="bmstable" content="https://r2.example/tables/x/header.json" />');
    expect(tag).not.toContain("\n");
  });

  it("转义 content 里的 & 与引号，避免破坏按引号切分的解析", () => {
    const tag = renderBmstableMetaTag('https://r2.example/a&b"c/header.json');
    expect(tag).toBe(
      '<meta name="bmstable" content="https://r2.example/a&amp;b&quot;c/header.json" />'
    );
    // 除属性定界符外不应再有引号，保证 jbmstable-parser 按 `"` 切分取到第 4 段
    expect(tag.split('"')).toEqual([
      "<meta name=",
      "bmstable",
      " content=",
      "https://r2.example/a&amp;b&quot;c/header.json",
      " />",
    ]);
  });
});

describe("injectBmstableMeta", () => {
  it("注入到 <head> 之后且 meta 独占一行", () => {
    const out = injectBmstableMeta(SHELL, "https://r2.example/tables/x/header.json");
    const lines = out.split("\n");
    const metaLine = lines.find((line) => line.includes("bmstable"));
    expect(metaLine).toBe(
      '<meta name="bmstable" content="https://r2.example/tables/x/header.json" />'
    );
    // 按 jbmstable-parser 的方式解析：取该行按引号切分的第 4 段
    expect(metaLine?.split('"')[3]).toBe("https://r2.example/tables/x/header.json");
    // 注入点位于 <head> 与原内容之间，且只注入一次
    expect(out.indexOf("bmstable")).toBeLessThan(out.indexOf('<meta charset="utf-8" />'));
    expect(out.match(/bmstable/g)).toHaveLength(1);
  });

  it("带属性的 <head> 也能命中", () => {
    const out = injectBmstableMeta(
      '<html><head data-x="1"><title>t</title></head></html>',
      "https://r2/a/header.json"
    );
    const metaLine = out.split("\n").find((line) => line.includes("bmstable"));
    expect(metaLine?.split('"')[3]).toBe("https://r2/a/header.json");
  });

  it("找不到 <head> 时报错", () => {
    expect(() =>
      injectBmstableMeta("<html><body>x</body></html>", "https://r2/a/header.json")
    ).toThrow(/head/);
  });
});
