import { describe, expect, it } from "vitest";

import { mergeActiveSet } from "./overlay.ts";
import type { TableConfig, TableInfo } from "./types.ts";

function makeInfo(name: string, url: string, extra: Record<string, unknown> = {}): TableInfo {
  return { name, symbol: "s", url, extra: extra as TableInfo["extra"] };
}

function emptyConfig(): TableConfig {
  return { table: [], disable: [], replace: [] };
}

describe("mergeActiveSet", () => {
  it("lists 覆盖 base", () => {
    const base = new Map([["https://a/", makeInfo("旧名", "https://a/")]]);
    const lists = new Map([["https://a/", makeInfo("新名", "https://a/")]]);
    const result = mergeActiveSet({
      base,
      lists,
      config: null,
      oldDirMap: new Map(),
    });
    expect(result.activeSet.tableInfoMap.get("https://a/")?.name).toBe("新名");
  });

  it("config 补充表时保留已有 name/symbol 与 extra", () => {
    const base = new Map([
      ["https://a/", makeInfo("已有名", "https://a/", { comment: "来自列表" })],
    ]);
    const config: TableConfig = {
      table: [
        {
          name: "",
          symbol: "",
          url: "https://a/",
          extra: { tag1: "SP" },
        },
      ],
      disable: [],
      replace: [],
    };
    const result = mergeActiveSet({ base, lists: new Map(), config, oldDirMap: new Map() });
    const info = result.activeSet.tableInfoMap.get("https://a/");
    expect(info?.name).toBe("已有名");
    expect(info?.symbol).toBe("s");
    expect(info?.extra).toEqual({ tag1: "SP", comment: "来自列表" });
  });

  it("replace 精确匹配时迁移 URL 与旧目录名映射", () => {
    const base = new Map([["http://old/", makeInfo("表", "http://old/")]]);
    const oldDirMap = new Map([["http://old/", "[old] 表"]]);
    const config: TableConfig = {
      table: [],
      disable: [],
      replace: [{ from: "http://old/", to: "https://new/" }],
    };
    const result = mergeActiveSet({ base, lists: new Map(), config, oldDirMap });
    expect(result.activeSet.tableInfoMap.has("http://old/")).toBe(false);
    expect(result.activeSet.tableInfoMap.get("https://new/")?.url).toBe("https://new/");
    expect(result.activeSet.oldDirMap.get("https://new/")).toBe("[old] 表");
  });

  it("replace 支持忽略尾斜杠的匹配，未匹配时报告", () => {
    const base = new Map([["https://old/table.html", makeInfo("表", "https://old/table.html")]]);
    const config: TableConfig = {
      table: [],
      disable: [],
      replace: [
        { from: "https://old/table.html/", to: "https://new/table.html" },
        { from: "https://missing/", to: "https://x/" },
      ],
    };
    const result = mergeActiveSet({ base, lists: new Map(), config, oldDirMap: new Map() });
    expect(result.activeSet.tableInfoMap.has("https://new/table.html")).toBe(true);
    expect(result.unmatchedReplace).toEqual(["https://missing/"]);
  });

  it("disable 移除表", () => {
    const base = new Map([["https://a/", makeInfo("表", "https://a/")]]);
    const config: TableConfig = { ...emptyConfig(), disable: ["https://a/"] };
    const result = mergeActiveSet({ base, lists: new Map(), config, oldDirMap: new Map() });
    expect(result.activeSet.activeUrls.size).toBe(0);
  });
});
