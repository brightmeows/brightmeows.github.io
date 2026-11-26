import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { emptyUserLayer } from "@brightmeows/mirror/user-layer";
import { afterEach, describe, expect, it } from "vitest";

import { runPipeline } from "./engine.ts";
import { parseHealthFile } from "./health.ts";

const TABLE_URL = "http://93.184.216.34/table.html";
const TABLE_DIR = "[93.184.216.34] Test";
const NOW = new Date("2026-11-24T00:00:00.000Z");
const PATHS = { tableDir: "tables", indexDir: "indexes", warnings: "warnings.log" };
const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "bms-health-"));
  roots.push(root);
  const dir = path.join(root, "tables", TABLE_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Test", symbol: "T", url: TABLE_URL })
  );
  await writeFile(
    path.join(dir, "header.json"),
    JSON.stringify({ name: "Test", symbol: "T", data_url: "./data.json" })
  );
  await writeFile(path.join(dir, "data.json"), "[]");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function inputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function tableFetch(): typeof fetch {
  return (input) => {
    const url = inputUrl(input);
    if (url.endsWith("header.json")) {
      return Promise.resolve(jsonResponse({ name: "Test", symbol: "T", data_url: "./data.json" }));
    }
    if (url.endsWith("data.json")) {
      return Promise.resolve(jsonResponse([{ title: "x" }]));
    }
    return Promise.resolve(htmlResponse('<meta name="bmstable" content="header.json" />'));
  };
}

describe("runPipeline 的健康状态", () => {
  it("成功抓取时写 health.json 并更新数据时间", async () => {
    const root = await makeRoot();
    const result = await runPipeline({
      cwd: root,
      paths: PATHS,
      userLayer: emptyUserLayer(),
      fetchImpl: tableFetch(),
      now: NOW,
      concurrency: 1,
    });

    const health = parseHealthFile(
      await readFile(path.join(root, "tables", "health.json"), "utf8")
    );
    expect(health?.tables.get(TABLE_URL)).toMatchObject({
      status: "ok",
      lastSuccess: NOW.toISOString(),
      consecutiveFailures: 0,
    });
    expect(result.summary.tablesFetched).toBe(1);
    expect(result.summary.tablesSkipped).toBe(0);
    const manifest = await readFile(path.join(root, "indexes", "v2", "manifest.json"), "utf8");
    expect(manifest).toContain('"format":2');
    await expect(readFile(path.join(root, "indexes", "title.json"), "utf8")).rejects.toThrow();
  });

  it("未到复查期的 stale 表直接跳过，不触发抓取", async () => {
    const root = await makeRoot();
    await writeFile(
      path.join(root, "tables", "health.json"),
      JSON.stringify({
        generated_at: NOW.toISOString(),
        tables: {
          [TABLE_URL]: {
            status: "stale",
            last_success: "2026-06-12T21:44:59.000Z",
            last_attempt: NOW.toISOString(),
            consecutive_failures: 2,
            reason: "source_gone",
          },
        },
      })
    );

    const result = await runPipeline({
      cwd: root,
      paths: PATHS,
      userLayer: emptyUserLayer(),
      fetchImpl: () => Promise.reject(new Error("should not fetch")),
      now: NOW,
      concurrency: 1,
    });

    const health = parseHealthFile(
      await readFile(path.join(root, "tables", "health.json"), "utf8")
    );
    expect(health?.tables.get(TABLE_URL)).toMatchObject({
      status: "stale",
      lastAttempt: NOW.toISOString(),
      consecutiveFailures: 2,
      reason: "source_gone",
    });
    expect(result.summary.tablesFetched).toBe(0);
    expect(result.summary.tablesSkipped).toBe(1);
  });
});
