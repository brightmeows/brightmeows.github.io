import { describe, expect, it } from "vitest";

import {
  injectBmstableMeta,
  injectMirrorTableMeta,
  mergeTableHealth,
  MIRROR_TABLE_META_ID,
  parseTableHealthManifest,
  renderBmstableMetaTag,
  tableHealthOf,
  transformTableList,
} from "./manifest.ts";
import type { MirrorTableHealth, MirrorTableItem } from "./types.ts";

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

describe("injectMirrorTableMeta", () => {
  const health: MirrorTableHealth = {
    status: "stale",
    last_success: "2026-06-12T21:44:59.000Z",
    reason: "source_gone",
  };

  it("注入 application/json script，JSON 内容不含裸 <", () => {
    const out = injectMirrorTableMeta(SHELL, health);
    expect(out).toContain(`id="${MIRROR_TABLE_META_ID}"`);
    const start = out.indexOf(">", out.indexOf(MIRROR_TABLE_META_ID)) + 1;
    const end = out.indexOf("</script>", start);
    const json = out.slice(start, end);
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual(health);
  });

  it("找不到 <head> 时报错", () => {
    expect(() => injectMirrorTableMeta("<html><body>x</body></html>", health)).toThrow(/head/);
  });
});

describe("parseTableHealthManifest", () => {
  it("只收合法条目，坏条目与非对象顶层返回空结果", () => {
    const parsed = parseTableHealthManifest({
      generated_at: "2026-11-24T00:00:00.000Z",
      tables: {
        "https://a": {
          status: "stale",
          last_success: "2026-06-12T21:44:59.000Z",
          reason: "source_gone",
        },
        "https://b": { status: "ok" },
        "https://c": { status: "bad" },
      },
    });
    expect(parsed.get("https://a")).toEqual({
      status: "stale",
      last_success: "2026-06-12T21:44:59.000Z",
      reason: "source_gone",
    });
    expect(parsed.get("https://b")).toEqual({ status: "ok" });
    expect(parsed.has("https://c")).toBe(false);
    expect(parseTableHealthManifest(null).size).toBe(0);
    expect(parseTableHealthManifest({ tables: [] }).size).toBe(0);
  });
});

describe("mergeTableHealth", () => {
  it("按源 URL 合并字段，没有健康记录的条目保持原对象", () => {
    const list: MirrorTableItem[] = [
      { name: "a", url: "https://a" },
      { name: "b", url: "https://b" },
    ];
    const merged = mergeTableHealth(
      list,
      new Map([
        [
          "https://a",
          {
            status: "stale" as const,
            last_success: "2026-06-12T21:44:59.000Z",
            reason: "source_gone" as const,
          },
        ],
      ])
    );
    expect(merged[0]).toMatchObject({
      status: "stale",
      last_success: "2026-06-12T21:44:59.000Z",
      reason: "source_gone",
    });
    expect(merged[1]).toBe(list[1]);
  });
});

describe("tableHealthOf", () => {
  it("有状态时提取公开字段，无状态时返回 null", () => {
    expect(
      tableHealthOf({
        name: "a",
        url: "https://a",
        status: "stale",
        last_success: "2026-06-12T21:44:59.000Z",
        reason: "access_denied",
      })
    ).toEqual({
      status: "stale",
      last_success: "2026-06-12T21:44:59.000Z",
      reason: "access_denied",
    });
    expect(tableHealthOf({ name: "a", url: "https://a" })).toBeNull();
  });
});
