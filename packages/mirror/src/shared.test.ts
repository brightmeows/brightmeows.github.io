import { describe, expect, it } from "vitest";

import {
  applyEntryFields,
  checkSharedPayload,
  isAllowedSharedIdChar,
  normalizeSharedId,
  serializeSharedTableList,
  SHARED_MAX_DATA_BYTES,
  SHARED_MAX_ENTRIES,
  SHARED_MAX_HEADER_BYTES,
  transformSharedTableList,
  utf8ByteLength,
  validateSharedId,
  withLocalDataUrl,
} from "./shared.ts";

describe("normalizeSharedId", () => {
  it("去首尾空白并做 ASCII 大小写折叠", () => {
    expect(normalizeSharedId("  My-Table ")).toBe("my-table");
    expect(normalizeSharedId("ABC123")).toBe("abc123");
  });

  it("NFC 归一：组合字符与预组合字符收敛为同一形式", () => {
    const composed = "é"; // é
    const decomposed = "é"; // e + combining acute
    expect(normalizeSharedId(decomposed)).toBe(normalizeSharedId(composed));
  });

  it("不折叠非 ASCII 大小写（同形字符交由字符集校验拒绝）", () => {
    expect(normalizeSharedId("А")).toBe("А"); // 西里尔 А 原样保留
  });
});

describe("validateSharedId", () => {
  it("接受 ASCII slug 与 CJK", () => {
    expect(validateSharedId("my-table-1")).toEqual({ ok: true, id: "my-table-1" });
    expect(validateSharedId("我的发狂表")).toEqual({ ok: true, id: "我的发狂表" });
    expect(validateSharedId("差分表2")).toEqual({ ok: true, id: "差分表2" });
    expect(validateSharedId("カナ表")).toEqual({ ok: true, id: "カナ表" });
  });

  it("规范化后判重：大小写与空白不产生新 id", () => {
    expect(validateSharedId("  Cool-Table ")).toEqual({ ok: true, id: "cool-table" });
  });

  it("拒绝空 id、超长、保留词", () => {
    expect(validateSharedId("   ")).toEqual({ ok: false, error: "empty" });
    expect(validateSharedId("一".repeat(33))).toEqual({ ok: false, error: "too_long" });
    expect(validateSharedId("new")).toEqual({ ok: false, error: "reserved" });
    expect(validateSharedId("Edit")).toEqual({ ok: false, error: "reserved" });
  });

  it("拒绝字符集外字符：空格、斜杠、点、全角与拉丁扩展", () => {
    expect(validateSharedId("a b")).toEqual({ ok: false, error: "charset" });
    expect(validateSharedId("a/b")).toEqual({ ok: false, error: "charset" });
    expect(validateSharedId("tables.json")).toEqual({ ok: false, error: "charset" });
    expect(validateSharedId("ａ")).toEqual({ ok: false, error: "charset" }); // 全角 ａ
    expect(validateSharedId("é")).toEqual({ ok: false, error: "charset" });
  });
});

describe("isAllowedSharedIdChar", () => {
  it("放行 ASCII slug 字符与 CJK", () => {
    expect(isAllowedSharedIdChar("z")).toBe(true);
    expect(isAllowedSharedIdChar("0")).toBe(true);
    expect(isAllowedSharedIdChar("-")).toBe(true);
    expect(isAllowedSharedIdChar("永")).toBe(true);
  });

  it("拒绝其余字符", () => {
    expect(isAllowedSharedIdChar("_")).toBe(false);
    expect(isAllowedSharedIdChar(".")).toBe(false);
    expect(isAllowedSharedIdChar("A")).toBe(false); // 大写已在规范化阶段折叠
    expect(isAllowedSharedIdChar("é")).toBe(false);
  });
});

describe("utf8ByteLength", () => {
  it("按 UTF-8 编码计字节", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("差")).toBe(3);
    expect(utf8ByteLength("あ")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("")).toBe(0);
  });
});

describe("checkSharedPayload", () => {
  const header = { name: "测试表", symbol: "▼", data_url: "https://example.test/data.json" };
  const data = [{ md5: "0".repeat(32), level: "12", title: "chart" }];

  it("接受合法载荷并原样保留未知字段", () => {
    const result = checkSharedPayload({ ...header, custom: 1 }, [
      ...data,
      { sha256: "a", level: "1" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.header.custom).toBe(1);
      expect(result.data).toHaveLength(2);
    }
  });

  it("拒绝非对象 header 与缺失 name/symbol", () => {
    expect(checkSharedPayload(null, data)).toEqual({ ok: false, error: "header_invalid" });
    expect(checkSharedPayload([], data)).toEqual({ ok: false, error: "header_invalid" });
    expect(checkSharedPayload({ symbol: "▼" }, data)).toEqual({
      ok: false,
      error: "missing_identity",
    });
    expect(checkSharedPayload({ name: "t" }, data)).toEqual({
      ok: false,
      error: "missing_identity",
    });
    expect(checkSharedPayload({ name: "  ", symbol: "x" }, data)).toEqual({
      ok: false,
      error: "missing_identity",
    });
  });

  it("拒绝非数组 data 与缺身份字段的条目", () => {
    expect(checkSharedPayload(header, {})).toEqual({ ok: false, error: "data_invalid" });
    expect(checkSharedPayload(header, [{ level: "1" }])).toEqual({
      ok: false,
      error: "entry_invalid",
    });
    expect(checkSharedPayload(header, ["x"])).toEqual({ ok: false, error: "entry_invalid" });
    expect(checkSharedPayload(header, [{ md5: "" }])).toEqual({
      ok: false,
      error: "entry_invalid",
    });
  });

  it("拒绝超条目数上限", () => {
    const entries = Array.from({ length: SHARED_MAX_ENTRIES + 1 }, () => ({ md5: "a" }));
    expect(checkSharedPayload(header, entries)).toEqual({ ok: false, error: "too_many_entries" });
  });

  it("拒绝超过尺寸上限的 header 与 data", () => {
    const bigHeader = { ...header, pad: "x".repeat(SHARED_MAX_HEADER_BYTES) };
    expect(checkSharedPayload(bigHeader, data)).toEqual({
      ok: false,
      error: "header_too_large",
    });
    const bigEntry = { md5: "a".repeat(32), note: "y".repeat(SHARED_MAX_DATA_BYTES) };
    expect(checkSharedPayload(header, [bigEntry])).toEqual({ ok: false, error: "data_too_large" });
  });
});

describe("applyEntryFields", () => {
  it("只覆盖已知字段，未知自定义字段原样保留", () => {
    const original = { md5: "a", level: "1", total: 480, judge: 3 };
    const merged = applyEntryFields(original, { level: "12", title: "新标题" });
    expect(merged).toEqual({ md5: "a", level: "12", total: 480, judge: 3, title: "新标题" });
  });

  it("undefined 表示清除该键，不落成 null", () => {
    const merged = applyEntryFields({ md5: "a", comment: "旧" }, { comment: undefined });
    expect("comment" in merged).toBe(false);
    expect(JSON.stringify(merged)).not.toContain("comment");
  });

  it("不改动入参", () => {
    const original = { md5: "a", level: "1" };
    applyEntryFields(original, { level: "9" });
    expect(original.level).toBe("1");
  });
});

describe("withLocalDataUrl", () => {
  it("改写为 ./data.json 且不改动入参", () => {
    const header = { name: "t", data_url: "https://r2.test/shared/x/data.json" };
    const local = withLocalDataUrl(header);
    expect(local.data_url).toBe("./data.json");
    expect(header.data_url).toBe("https://r2.test/shared/x/data.json");
  });
});

describe("清单变换与序列化", () => {
  const items = [
    {
      id: "我的表",
      name: "我的表",
      author: "someone",
      created_at: "2026-09-27T00:00:00.000Z",
      updated_at: "2026-09-27T00:00:00.000Z",
      entries: 3,
      url: "https://old.test/bms/table/shared/x/",
    },
  ];

  it("url 按请求 origin 重写并保留其余字段", () => {
    const [item] = transformSharedTableList(items, "https://site.test/");
    expect(item?.url).toBe("https://site.test/bms/table/shared/%E6%88%91%E7%9A%84%E8%A1%A8/");
    expect(item?.id).toBe("我的表");
  });

  it("序列化为稳定 JSON 加尾换行", () => {
    expect(serializeSharedTableList(items)).toBe(`${JSON.stringify(items, null, 2)}\n`);
  });
});
