import { describe, expect, it } from "vitest";

import type { MirrorTableItem } from "../types/bms.ts";

import { renderBmstableMetaTag, transformTableList } from "./manifest.ts";

describe("transformTableList", () => {
  it("写入 url_from 与站点内镜像页绝对地址", () => {
    const list: MirrorTableItem[] = [
      { name: "表一", url: "http://example.com/table.html", dir_name: "[example.com] 表一" },
    ];
    const result = transformTableList(list, "https://miyakomeow.site");
    expect(result).toHaveLength(1);
    expect(result[0]?.url_from).toBe("http://example.com/table.html");
    expect(result[0]?.url).toBe(
      "https://miyakomeow.site/bms/table/mirror/%5Bexample.com%5D%20%E8%A1%A8%E4%B8%80/"
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
