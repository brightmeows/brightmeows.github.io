import { describe, expect, it } from "vitest";

import {
  legacyEntryId,
  legacyTableConfigToUserLayer,
  parseLegacyTableConfig,
} from "./legacy-config.ts";

const TOML = `
[[disable]]
url = "https://disabled.example/x"

[[table]]
url = "https://a.example/table.html"
tag_order = "1"
tag1 = "SP"
tag2 = "Personal"

[[table]]
url = "https://b.example/two"
name = "自定义名"
symbol = "★"

[[replace]]
from = "https://old.example/a"
to = "https://new.example/a"
`;

describe("parseLegacyTableConfig", () => {
  it("解析 table/disable/replace 三段并保留标签字段", () => {
    const config = parseLegacyTableConfig(TOML);
    expect(config.table).toHaveLength(2);
    expect(config.table[0]).toMatchObject({
      url: "https://a.example/table.html",
      name: "",
      symbol: "",
    });
    expect(config.table[0]?.extra).toEqual({ tag_order: "1", tag1: "SP", tag2: "Personal" });
    expect(config.disable).toEqual(["https://disabled.example/x"]);
    expect(config.replace).toEqual([
      { from: "https://old.example/a", to: "https://new.example/a" },
    ]);
  });

  it("段缺失时按空数组处理", () => {
    expect(parseLegacyTableConfig("")).toEqual({ table: [], disable: [], replace: [] });
  });

  it("URL 非法时报错", () => {
    expect(() => parseLegacyTableConfig('[[table]]\nurl = "not a url"\n')).toThrow(/不是合法 URL/);
  });
});

describe("legacyTableConfigToUserLayer", () => {
  it("table 转成添加与抓取占位，标签进 meta 覆盖", () => {
    const config = parseLegacyTableConfig(TOML);
    const layer = legacyTableConfigToUserLayer(config, {
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(layer.added).toHaveLength(2);
    expect(layer.fetched).toHaveLength(2);
    expect(layer.added[0]).toMatchObject({
      url: "https://a.example/table.html",
      role: "admin",
      author: "legacy-config",
      added_at: "2026-09-21T00:00:00.000Z",
    });
    const fetchedA = layer.fetched.find((entry) => entry.url === "https://a.example/table.html");
    expect(fetchedA?.id).toBe(legacyEntryId("https://a.example/table.html"));
    // name 为空时目录名按命名规则预计算（结尾空白转全角），抓取成功后会被实际表名纠正
    expect(fetchedA?.dir_name).toBe("[a.example]\u3000");
    const metaA = layer.meta.find((entry) => entry.url === "https://a.example/table.html");
    expect(metaA).toMatchObject({ tag1: "SP", tag2: "Personal", tag_order: "1" });
    const fetchedB = layer.fetched.find((entry) => entry.url === "https://b.example/two");
    expect(fetchedB?.dir_name).toBe("[b.example] 自定义名");
    expect(fetchedB?.symbol).toBe("★");
    expect(layer.meta).toHaveLength(1);
  });

  it("known 映射覆盖目录名与名称（线上清单优先）", () => {
    const config = parseLegacyTableConfig(TOML);
    const known = new Map([
      [
        "https://a.example/table.html",
        { dir_name: "[a.example] 真实表名", name: "真实表名", symbol: "★" },
      ],
    ]);
    const layer = legacyTableConfigToUserLayer(config, { known });
    const fetched = layer.fetched.find((entry) => entry.url === "https://a.example/table.html");
    expect(fetched).toMatchObject({
      dir_name: "[a.example] 真实表名",
      name: "真实表名",
      symbol: "★",
    });
  });

  it("disable 与 replace 一一对应", () => {
    const layer = legacyTableConfigToUserLayer(parseLegacyTableConfig(TOML), {
      author: "brightmeows",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(layer.disabled).toEqual([
      {
        url: "https://disabled.example/x",
        author: "brightmeows",
        disabled_at: "2026-09-21T00:00:00.000Z",
      },
    ]);
    expect(layer.replace).toEqual([
      {
        from: "https://old.example/a",
        to: "https://new.example/a",
        author: "brightmeows",
        updated_at: "2026-09-21T00:00:00.000Z",
      },
    ]);
  });
});
