import { describe, expect, it } from "vitest";

import { IncrementalAggregator } from "./search-aggregator";

import type { ChartData } from "$lib/types/bms";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const MD5_A = "1".repeat(32);

describe("IncrementalAggregator", () => {
  describe("身份优先级与合并", () => {
    it("同一 sha256 跨表合并为一个谱面，标题不同不拆分", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A, title: "Foo" }]);
      agg.addTable("t2", "表二", [{ sha256: SHA_A, title: "Foo (acoustic)" }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.appearances.map((a) => a.tableId)).toEqual(["t1", "t2"]);
    });

    it("sha256 匹配大小写不敏感", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A.toUpperCase() }]);
      agg.addTable("t2", "表二", [{ sha256: SHA_A }]);

      expect(agg.allResults).toHaveLength(1);
    });

    it("无 sha256 时按 md5 合并，后到的 sha256 补全进强索引", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ md5: MD5_A }]);
      agg.addTable("t2", "表二", [{ md5: MD5_A, sha256: SHA_A }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.sha256).toBe(SHA_A);
      expect(results[0]?.md5).toBe(MD5_A);
    });

    it("title 相同但 sha256 冲突视为不同谱面", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ title: "Foo", sha256: SHA_A }]);
      agg.addTable("t2", "表二", [{ title: "Foo", sha256: SHA_B }]);

      expect(agg.allResults).toHaveLength(2);
    });

    it("artist 相同但 sha256 冲突不合并", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ artist: "X", sha256: SHA_A }]);
      agg.addTable("t2", "表二", [{ artist: "X", sha256: SHA_B }]);

      expect(agg.allResults).toHaveLength(2);
    });

    it("仅有 title/artist 的弱身份条目互相合并", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ title: "Foo", artist: "X" }]);
      agg.addTable("t2", "表二", [{ title: "Foo", artist: "X" }]);

      expect(agg.allResults).toHaveLength(1);
      expect(agg.allResults[0]?.appearances).toHaveLength(2);
    });
  });

  describe("弱身份 promote", () => {
    it("title 占位遇到 hash 后升级，后续同 title 条目仍能合并", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ title: "Foo" }]);
      agg.addTable("t2", "表二", [{ title: "Foo", sha256: SHA_A }]);
      // byTitle 在 promote 时被删除，第三次依赖 hash map 的 title 扫描兜底
      agg.addTable("t3", "表三", [{ title: "foo" }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.sha256).toBe(SHA_A);
      expect(results[0]?.appearances).toHaveLength(3);
    });
  });

  describe("表数据替换与清理", () => {
    it("同表重载替换旧 appearance，不产生重复", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A }]);
      agg.addTable("t1", "表一", [{ sha256: SHA_A }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.appearances).toHaveLength(1);
    });

    it("同表换成不同谱面后，旧谱面的空条目不再出现在结果里", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A }]);
      agg.addTable("t1", "表一", [{ sha256: SHA_B }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.sha256).toBe(SHA_B);
    });

    it("removeTable 清掉该表全部 appearance", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A }]);
      agg.addTable("t2", "表二", [{ sha256: SHA_A }]);
      agg.removeTable("t1");

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.appearances.map((a) => a.tableId)).toEqual(["t2"]);
    });

    it("appearance 携带表名与 symbol", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A }], "▲");

      const appearance = agg.allResults[0]?.appearances[0];
      expect(appearance?.tableName).toBe("表一");
      expect(appearance?.symbol).toBe("▲");
    });
  });

  describe("preCreate 占位", () => {
    it("占位 appearance 被 addTable 真实数据替换且不重复", () => {
      const agg = new IncrementalAggregator();
      agg.preCreate([{ tableId: "t1", matchedKeys: [{ key: "Foo", source: "title" }] }]);
      agg.addTable("t1", "表一", [{ title: "Foo", sha256: SHA_A }]);

      const results = agg.allResults;
      expect(results).toHaveLength(1);
      expect(results[0]?.sha256).toBe(SHA_A);
      expect(results[0]?.appearances).toHaveLength(1);
      expect(results[0]?.appearances[0]?.tableName).toBe("表一");
    });

    it("removeTable 清掉占位", () => {
      const agg = new IncrementalAggregator();
      agg.preCreate([{ tableId: "t1", matchedKeys: [{ key: "Foo", source: "title" }] }]);
      expect(agg.allResults).toHaveLength(1);

      agg.removeTable("t1");
      expect(agg.allResults).toHaveLength(0);
    });

    it("matchedKeys 全空的条目被跳过", () => {
      const agg = new IncrementalAggregator();
      const results = agg.preCreate([{ tableId: "t1", matchedKeys: [] }]);
      expect(results).toHaveLength(0);
    });
  });

  describe("错误与边界", () => {
    it("完全没有身份信息的谱面抛错", () => {
      const agg = new IncrementalAggregator();
      expect(() => agg.addTable("t1", "表一", [{}])).toThrow(/no identity information/);
    });

    it("finalize 与 allResults 等价", () => {
      const agg = new IncrementalAggregator();
      agg.addTable("t1", "表一", [{ sha256: SHA_A }]);
      expect(agg.finalize()).toEqual(agg.allResults);
    });
  });
});

describe("preCreate 的 ChartData 占位字段", () => {
  it("matchedKeys 中出现的字段进入占位 chart", () => {
    const agg = new IncrementalAggregator();
    agg.preCreate([
      {
        tableId: "t1",
        matchedKeys: [
          { key: "Foo", source: "title" },
          { key: SHA_A, source: "sha256" },
        ],
      },
    ]);

    const chart: ChartData | undefined = agg.allResults[0]?.appearances[0]?.chart;
    expect(chart?.title).toBe("Foo");
    expect(chart?.sha256).toBe(SHA_A);
  });
});
