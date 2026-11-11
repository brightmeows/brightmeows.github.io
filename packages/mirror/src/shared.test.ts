import { describe, expect, it } from "vitest";

import {
  applyEntryFields,
  isAllowedSharedIdChar,
  normalizeSharedId,
  serializeSharedJson,
  serializeSharedTableList,
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

  it("__proto__ 键按自有属性保真（覆盖与新增均不触发 setter）", () => {
    const original = JSON.parse('{"md5":"a","__proto__":{"old":1}}') as Record<string, unknown>;
    const merged = applyEntryFields(original, { level: "9" });
    expect(Object.getOwnPropertyNames(merged)).toContain("__proto__");
    expect(Object.entries(merged)).toContainEqual(["__proto__", { old: 1 }]);
    const overridden = applyEntryFields(
      original,
      JSON.parse('{"__proto__":{"new":2}}') as Record<string, unknown>
    );
    expect(Object.entries(overridden)).toContainEqual(["__proto__", { new: 2 }]);
    expect(Object.prototype).not.toHaveProperty("new");
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

describe("serializeSharedJson", () => {
  it("整数 Float 字段补写 .0，小数与非目标字段原样", () => {
    const header = {
      name: "表",
      level_order: [1, 2, "3+"],
      course: [
        [
          {
            name: "段位",
            trophy: [
              { name: "silvermedal", missrate: 5, scorerate: 70 },
              { name: "goldmedal", missrate: 2.5, scorerate: 80 },
            ],
          },
        ],
      ],
    };
    const text = serializeSharedJson(header);
    expect(text).toContain('"missrate": 5.0');
    expect(text).toContain('"scorerate": 70.0');
    expect(text).toContain('"scorerate": 80.0');
    expect(text).toContain('"missrate": 2.5');
    expect(text).toContain('"level_order": [\n    1,\n    2,\n    "3+"\n  ]');
  });

  it("无整数 Float 字段时与 JSON.stringify 输出逐字节一致", () => {
    const value = {
      name: "表★",
      n: 2.5,
      deep: [[{ s: '引"号\\与\n换行' }], [1, 2]],
      empty: {},
      list: [],
    };
    expect(serializeSharedJson(value)).toBe(JSON.stringify(value, null, 2));
  });

  it("对任意深度生效（合并包形态）", () => {
    const pkg = {
      header: { course: [[{ trophy: [{ name: "g", missrate: 100 }] }]] },
      data: [],
    };
    expect(serializeSharedJson(pkg)).toContain('"missrate": 100.0');
  });

  it("data 条目走同一序列化器，自定义字段撞名同样补写", () => {
    expect(serializeSharedJson([{ md5: "a", missrate: 5 }])).toContain('"missrate": 5.0');
    expect(serializeSharedJson([{ md5: "a", total: 480 }])).toContain('"total": 480');
  });

  it("数据撞上哨兵时整体回退，绝不腐蚀数据", () => {
    const evil = {
      name: "x",
      note: "\u0000bmstable-float:9.9",
      trophy: [{ name: "t", missrate: 5 }],
    };
    expect(serializeSharedJson(evil)).toBe(JSON.stringify(evil, null, 2));
  });

  it("键名撞哨兵同样回退", () => {
    const evil = { "\u0000bmstable-float:1.0": true };
    expect(serializeSharedJson(evil)).toBe(JSON.stringify(evil, null, 2));
  });

  it("__proto__ 自有属性原样保留（展开复制不触发 setter）", () => {
    const evil = JSON.parse(
      '{"name":"x","__proto__":{"polluted":true},"trophy":[{"name":"t","missrate":5}]}'
    ) as Record<string, unknown>;
    const text = serializeSharedJson(evil);
    expect(text).toContain('"__proto__"');
    expect(text).toContain('"polluted"');
    expect(text).toContain('"missrate": 5.0');
  });

  it("字符串与非有限数值原样交给 JSON.stringify", () => {
    expect(serializeSharedJson({ missrate: "5" })).toBe('{\n  "missrate": "5"\n}');
    expect(serializeSharedJson({ missrate: Number.NaN })).toBe('{\n  "missrate": null\n}');
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
