import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { serializeTableManifest } from "../src/lib/mirror/manifest.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

import { detectMirrorChange } from "./detect-mirror-change.ts";

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

interface StubPayloads {
  manifest?: unknown;
  manifestStatus?: number;
  baseline?: unknown;
  baselineStatus?: number;
}

/** 按 URL 分派载荷：清单与基线各自可定制（基线默认模拟 404 缺失）。 */
function stubFetch(payloads: StubPayloads): typeof fetch {
  return (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isManifest = url.includes("tables/tables.json");
    const status = isManifest ? (payloads.manifestStatus ?? 200) : (payloads.baselineStatus ?? 404);
    const body = isManifest ? payloads.manifest : payloads.baseline;
    return Promise.resolve(
      new Response(JSON.stringify(body ?? []), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  };
}

function baseOptions(): {
  r2Base: string;
  manifestObject: string;
  baselineObject: string;
} {
  return {
    r2Base: "https://r2.example",
    manifestObject: "tables/tables.json",
    baselineObject: "meta/last-notified.json",
  };
}

function tempOut(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "mirror-baseline-")), "baseline.json");
}

describe("detectMirrorChange", () => {
  it("基线缺失（首次运行）视为变动并写出新基线", async () => {
    const outPath = tempOut();
    const result = await detectMirrorChange({
      ...baseOptions(),
      outPath,
      fetchImpl: stubFetch({ manifest }),
    });
    expect(result.changed).toBe(true);
    expect(result.written).toBe(true);
    expect(result.added).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(readFileSync(outPath, "utf8")).toBe(serializeTableManifest(manifest));
  });

  it("基线投影一致时不视为变动，也不写出基线", async () => {
    const outPath = tempOut();
    const result = await detectMirrorChange({
      ...baseOptions(),
      outPath,
      fetchImpl: stubFetch({
        manifest: manifest.map((item) => ({ ...item, comment: "上游改过", date: "2026-09-19" })),
        baseline: manifest,
        baselineStatus: 200,
      }),
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

  it("基线缺一条时判定为新增并写出完整清单", async () => {
    const outPath = tempOut();
    const result = await detectMirrorChange({
      ...baseOptions(),
      outPath,
      fetchImpl: stubFetch({
        manifest,
        baseline: [manifest[0]],
        baselineStatus: 200,
      }),
    });
    expect(result.changed).toBe(true);
    expect(result.added).toEqual(["[b.example] 表二"]);
    expect(readFileSync(outPath, "utf8")).toBe(serializeTableManifest(manifest));
  });

  it("只报告不写基线（未给 --out）时 written 为 false", async () => {
    const result = await detectMirrorChange({
      ...baseOptions(),
      fetchImpl: stubFetch({ manifest }),
    });
    expect(result.changed).toBe(true);
    expect(result.written).toBe(false);
  });

  it("清单缺失或返回非数组时报错", async () => {
    await expect(
      detectMirrorChange({
        ...baseOptions(),
        fetchImpl: stubFetch({ manifestStatus: 503 }),
      })
    ).rejects.toThrow(/503/);
    await expect(
      detectMirrorChange({
        ...baseOptions(),
        fetchImpl: stubFetch({ manifest: { oops: true } }),
      })
    ).rejects.toThrow(/不是数组/);
  });
});
