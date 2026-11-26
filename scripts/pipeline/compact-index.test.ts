import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseCompactSearchIndexManifest } from "@brightmeows/mirror/search-index";
import { describe, expect, it } from "vitest";

import {
  buildCompactSearchManifest,
  buildCompactTableRegistry,
  sha256Hex,
  toCompactSearchIndex,
  writeCompactSearchIndexes,
} from "./compact-index.ts";
import { buildIndexes } from "./index-build.ts";
import type { FullDirEntry, TableInfo } from "./types.ts";

function entry(dirName: string, url: string): FullDirEntry {
  const info: TableInfo = { name: dirName, symbol: "", url, extra: {} };
  return { dirName, info, dataRaw: null };
}

const ENTRIES = [entry("[b] 表", "https://b.example/"), entry("[a] 表", "https://a.example/")];

describe("sha256Hex", () => {
  it("输出标准 SHA-256 十六进制", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("buildCompactTableRegistry", () => {
  it("首次按 URL 字节序分配 ID，输出按 ID 排序", () => {
    const { tables, nextId } = buildCompactTableRegistry(ENTRIES, null);
    expect(tables).toEqual([
      { id: 1, dir: "[a] 表", url: "https://a.example/" },
      { id: 2, dir: "[b] 表", url: "https://b.example/" },
    ]);
    expect(nextId).toBe(3);
  });

  it("rename 保持 ID，新增表取 nextId", () => {
    const first = buildCompactTableRegistry(ENTRIES, null);
    const renamed = [entry("[a] 新名", "https://a.example/"), ENTRIES[0]!];
    const second = buildCompactTableRegistry(
      renamed,
      buildCompactSearchManifest(first.tables, first.nextId, emptyFiles(), new Date(0))
    );
    expect(second.tables).toEqual([
      { id: 1, dir: "[a] 新名", url: "https://a.example/" },
      { id: 2, dir: "[b] 表", url: "https://b.example/" },
    ]);
    expect(second.nextId).toBe(3);

    const added = [...renamed, entry("[c] 表", "https://c.example/")];
    const third = buildCompactTableRegistry(
      added,
      buildCompactSearchManifest(second.tables, second.nextId, emptyFiles(), new Date(0))
    );
    expect(third.tables.at(-1)).toEqual({
      id: 3,
      dir: "[c] 表",
      url: "https://c.example/",
    });
    expect(third.nextId).toBe(4);
  });

  it("删除的表不再占用 ID，重新加入取新 ID", () => {
    const first = buildCompactTableRegistry(ENTRIES, null);
    const previous = buildCompactSearchManifest(
      first.tables,
      first.nextId,
      emptyFiles(),
      new Date(0)
    );
    const removed = buildCompactTableRegistry([ENTRIES[1]!], previous);
    expect(removed.tables).toEqual([{ id: 1, dir: "[a] 表", url: "https://a.example/" }]);
    expect(removed.nextId).toBe(3);

    const readded = buildCompactTableRegistry(ENTRIES, {
      ...previous,
      tables: removed.tables,
      next_id: removed.nextId,
    });
    expect(readded.tables).toEqual([
      { id: 1, dir: "[a] 表", url: "https://a.example/" },
      { id: 3, dir: "[b] 表", url: "https://b.example/" },
    ]);
  });
});

describe("toCompactSearchIndex", () => {
  const idByDir = new Map([
    ["[a] 表", 1],
    ["[b] 表", 2],
  ]);

  it("把目录名换成 ID，按字节序与 ID 升序", () => {
    const map = new Map<string, Set<string>>([
      ["b", new Set(["[b] 表", "[a] 表"])],
      ["a", new Set(["[a] 表"])],
    ]);
    expect(toCompactSearchIndex(map, idByDir)).toEqual({
      a: [1],
      b: [1, 2],
    });
  });

  it("未知目录与空集合不进索引", () => {
    const map = new Map<string, Set<string>>([
      ["a", new Set(["[missing]"])],
      ["b", new Set(["[a] 表"])],
    ]);
    expect(toCompactSearchIndex(map, idByDir)).toEqual({ b: [1] });
  });

  it("__proto__ term 成为自有属性", () => {
    const map = new Map<string, Set<string>>([["__proto__", new Set(["[a] 表"])]]);
    const index = toCompactSearchIndex(map, idByDir);
    expect(Object.getOwnPropertyDescriptor(index, "__proto__")?.value).toEqual([1]);
    expect(Object.getPrototypeOf(index)).toBe(Object.prototype);
  });
});

describe("buildCompactSearchManifest", () => {
  it("generated_at 不参与 version，内容变化会换 version", () => {
    const tables = [{ id: 1, dir: "[a] 表", url: "https://a.example/" }];
    const files = emptyFiles();
    const first = buildCompactSearchManifest(tables, 2, files, new Date("2026-11-25T00:00:00Z"));
    const second = buildCompactSearchManifest(tables, 2, files, new Date("2026-11-26T00:00:00Z"));
    expect(first.version).toBe(second.version);
    expect(first.generated_at).not.toBe(second.generated_at);

    const changed = buildCompactSearchManifest(
      tables,
      2,
      { ...files, title: { ...files.title, hash: "f".repeat(64) } },
      new Date("2026-11-25T00:00:00Z")
    );
    expect(changed.version).not.toBe(first.version);
  });
});

describe("writeCompactSearchIndexes", () => {
  it("写入四个文件与 manifest，下一轮复用 ID", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "compact-search-"));
    try {
      const dataRaw = JSON.stringify([{ title: "曲名", artist: "作者", md5: "a".repeat(32) }]);
      const entries = [{ ...entry("[a] 表", "https://a.example/"), dataRaw }];
      const built = buildIndexes(entries);
      const first = await writeCompactSearchIndexes(
        dir,
        entries,
        new Set(["https://a.example/"]),
        built,
        new Date("2026-11-25T00:00:00Z")
      );
      expect(first.tableCount).toBe(1);
      expect(first.registryReset).toBe(false);
      const manifestRaw = await readFile(first.manifestPath, "utf8");
      const manifest = parseCompactSearchIndexManifest(manifestRaw);
      expect(manifest).not.toBeNull();
      expect(manifest?.tables).toEqual([{ id: 1, dir: "[a] 表", url: "https://a.example/" }]);
      expect(manifest?.next_id).toBe(2);

      const second = await writeCompactSearchIndexes(
        dir,
        entries,
        new Set(["https://a.example/"]),
        built,
        new Date("2026-11-25T01:00:00Z")
      );
      expect(second.manifestVersion).toBe(first.manifestVersion);
      expect(second.tableCount).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function emptyFiles() {
  return {
    title: { hash: "a".repeat(64), bytes: 0, terms: 0 },
    artist: { hash: "b".repeat(64), bytes: 0, terms: 0 },
    md5: { hash: "c".repeat(64), bytes: 0, terms: 0 },
    sha256: { hash: "d".repeat(64), bytes: 0, terms: 0 },
  };
}
