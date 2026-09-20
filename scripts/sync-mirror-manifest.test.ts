import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { serializeTableManifest } from "../src/lib/mirror/manifest.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

import { runSync } from "./sync-mirror-manifest.ts";

const manifest: MirrorTableItem[] = [
  {
    name: "表一",
    symbol: "Γ",
    url: "http://a.example/table.html",
    dir_name: "[a.example] 表一",
    tag1: "難易度表",
    tag2: "通常",
    tag_order: 1,
  },
  {
    name: "表二",
    symbol: "Δ",
    url: "http://b.example/table.html",
    dir_name: "[b.example] 表二",
    tag1: "難易度表",
    tag2: "通常",
    tag_order: 2,
  },
];

/** 用固定载荷替代网络请求。 */
function stubFetch(payload: unknown, status = 200): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
}

function tempSnapshot(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "mirror-manifest-")), "table-manifest.json");
}

describe("runSync", () => {
  it("快照不存在时写入完整清单", async () => {
    const snapshotPath = tempSnapshot();
    const result = await runSync({
      r2Base: "https://r2.example",
      manifestObject: "tables/tables.json",
      snapshotPath,
      fetchImpl: stubFetch(manifest),
    });
    expect(result.changed).toBe(true);
    expect(result.written).toBe(true);
    expect(result.added).toHaveLength(2);
    expect(readFileSync(snapshotPath, "utf8")).toBe(serializeTableManifest(manifest));
  });

  it("快照与远端投影一致时不写入、不视为变动", async () => {
    const snapshotPath = tempSnapshot();
    writeFileSync(snapshotPath, serializeTableManifest(manifest));
    const result = await runSync({
      r2Base: "https://r2.example",
      manifestObject: "tables/tables.json",
      snapshotPath,
      fetchImpl: stubFetch(
        manifest.map((item) => ({ ...item, comment: "上游改过", date: "2026-09-19" }))
      ),
    });
    expect(result).toEqual({
      changed: false,
      added: [],
      removed: [],
      updated: [],
      total: 2,
      written: false,
    });
  });

  it("快照缺一条时判定为新增并写回正确内容", async () => {
    const snapshotPath = tempSnapshot();
    writeFileSync(snapshotPath, serializeTableManifest([manifest[0]!]));
    const result = await runSync({
      r2Base: "https://r2.example",
      manifestObject: "tables/tables.json",
      snapshotPath,
      fetchImpl: stubFetch(manifest),
    });
    expect(result.changed).toBe(true);
    expect(result.added).toEqual(["[b.example] 表二"]);
    expect(readFileSync(snapshotPath, "utf8")).toBe(serializeTableManifest(manifest));
  });

  it("check 模式只报告不写入", async () => {
    const snapshotPath = tempSnapshot();
    writeFileSync(snapshotPath, serializeTableManifest([manifest[0]!]));
    const result = await runSync({
      r2Base: "https://r2.example",
      manifestObject: "tables/tables.json",
      snapshotPath,
      check: true,
      fetchImpl: stubFetch(manifest),
    });
    expect(result.changed).toBe(true);
    expect(result.written).toBe(false);
    expect(readFileSync(snapshotPath, "utf8")).toBe(serializeTableManifest([manifest[0]!]));
  });

  it("远端返回非数组或非 2xx 时报错", async () => {
    const snapshotPath = tempSnapshot();
    await expect(
      runSync({
        r2Base: "https://r2.example",
        manifestObject: "tables/tables.json",
        snapshotPath,
        fetchImpl: stubFetch({ oops: true }),
      })
    ).rejects.toThrow(/不是数组/);
    await expect(
      runSync({
        r2Base: "https://r2.example",
        manifestObject: "tables/tables.json",
        snapshotPath,
        fetchImpl: stubFetch(manifest, 503),
      })
    ).rejects.toThrow(/503/);
  });
});
