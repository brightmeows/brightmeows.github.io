import { describe, expect, it } from "vitest";

import type { MirrorTableItem } from "../types/bms.ts";

import {
  diffTableList,
  injectBmstableMeta,
  projectTableList,
  renderBmstableMetaTag,
  serializeTableListProjection,
  transformTableList,
  type TableListProjection,
} from "./manifest.ts";

const SHELL =
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>x</title></head><body></body></html>';

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

describe("projectTableList", () => {
  const base: MirrorTableItem = {
    name: "表一",
    symbol: "Γ",
    url: "http://src.example/table.html",
    dir_name: "[src.example] 表一",
    tag1: "難易度表",
    tag2: "通常",
    tag_order: 1,
  };

  it("按 dir_name 排序，序列化结果稳定", () => {
    const list: MirrorTableItem[] = [
      { ...base, dir_name: "b", name: "B" },
      { ...base, dir_name: "a", name: "A" },
    ];
    const s1 = serializeTableListProjection(list);
    const s2 = serializeTableListProjection([...list].reverse());
    expect(s1).toBe(s2);
    const parsed = JSON.parse(s1) as TableListProjection[];
    expect(parsed.map((item) => item.dir_name)).toEqual(["a", "b"]);
  });

  it("忽略 comment/date/state 与表内容更新时间", () => {
    const before: MirrorTableItem[] = [{ ...base, comment: "旧", date: "2020-01-01", state: "" }];
    const after: MirrorTableItem[] = [{ ...base, comment: "新", date: "2026-09-19", state: "1" }];
    expect(serializeTableListProjection(after)).toBe(serializeTableListProjection(before));
  });

  it("能识别新增、删除与展示字段变化", () => {
    const baseList = [base];
    expect(
      serializeTableListProjection([
        ...baseList,
        { ...base, name: "表二", dir_name: "[src.example] 表二" },
      ])
    ).not.toBe(serializeTableListProjection(baseList));
    expect(serializeTableListProjection([])).not.toBe(serializeTableListProjection(baseList));
    expect(serializeTableListProjection([{ ...base, name: "改名" }])).not.toBe(
      serializeTableListProjection(baseList)
    );
  });

  it("缺少 url_from 时回落到 url", () => {
    const [projected] = projectTableList([base]);
    expect(projected?.url_from).toBe("http://src.example/table.html");
  });
});

describe("diffTableList", () => {
  const base: MirrorTableItem = {
    name: "表一",
    symbol: "Γ",
    url: "http://src.example/table.html",
    dir_name: "[src.example] 表一",
    tag1: "難易度表",
    tag2: "通常",
    tag_order: 1,
    date: "2020-01-01",
    comment: "旧",
  };

  it("无变动时三项皆空", () => {
    const diff = diffTableList([base], [{ ...base, date: "2026-09-19", comment: "新" }]);
    expect(diff).toEqual({ added: [], removed: [], updated: [] });
  });

  it("分别识别新增、删除与展示字段变化", () => {
    expect(diffTableList([], [base]).added).toEqual(["[src.example] 表一"]);
    expect(diffTableList([base], []).removed).toEqual(["[src.example] 表一"]);
    expect(diffTableList([base], [{ ...base, symbol: "Δ" }]).updated).toEqual([
      "[src.example] 表一",
    ]);
  });
});
