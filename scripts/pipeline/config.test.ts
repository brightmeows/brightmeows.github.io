import { describe, expect, it } from "vitest";

import { parseListConfig, parseTableConfig } from "./config.ts";

describe("parseTableConfig", () => {
  const text = `
# 注释与空段都应被忽略
[[table]]
url = "https://bms.hexlataia.xyz/tables/ai.html"
tag_order = "1"
tag1 = "SP"

[[table]]
name = "自定义表"
symbol = "★"
url = "https://example.com/table"

[[disable]]
url = "https://disabled.example.com/table.html"

[[replace]]
from = "http://ereter.net/dpoverjoy"
to = "https://ereter.net/static/analyzer/json/header.json"

[unknown_section]
value = 1
`;

  it("解析表、禁用与替换规则", () => {
    const config = parseTableConfig(text);
    expect(config.table).toHaveLength(2);
    expect(config.table[0]?.url).toBe("https://bms.hexlataia.xyz/tables/ai.html");
    expect(config.table[0]?.extra).toEqual({ tag_order: "1", tag1: "SP" });
    expect(config.table[1]?.name).toBe("自定义表");
    expect(config.table[1]?.symbol).toBe("★");
    expect(config.disable).toEqual(["https://disabled.example.com/table.html"]);
    expect(config.replace).toEqual([
      {
        from: "http://ereter.net/dpoverjoy",
        to: "https://ereter.net/static/analyzer/json/header.json",
      },
    ]);
  });

  it("缺省段为空数组，URL 被规范化", () => {
    const config = parseTableConfig('[[table]]\nurl = "https://example.com"\n');
    expect(config.table[0]?.url).toBe("https://example.com/");
    expect(config.disable).toEqual([]);
    expect(config.replace).toEqual([]);
  });

  it("非法 URL 直接抛错", () => {
    expect(() => parseTableConfig('[[table]]\nurl = "not a url"\n')).toThrow();
  });
});

describe("parseListConfig", () => {
  it("解析列表源", () => {
    const sources = parseListConfig(
      '[[source]]\nname = "DARKSABUN"\nurl = "https://example.com/list?table=all"\n'
    );
    expect(sources).toEqual([{ name: "DARKSABUN", url: "https://example.com/list?table=all" }]);
  });
});
