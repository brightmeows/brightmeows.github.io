/**
 * tables/state.toml 的解析、构建与序列化。
 *
 * 记录每张活跃表的 SHA3-256 与检查、变更时间；当三个文件哈希不变时沿用
 * 旧的 last_change（与旧实现的保留规则一致）。
 */

import { createHash } from "node:crypto";

import { parse as parseToml } from "smol-toml";

export interface FileHashes {
  info: string;
  header: string;
  data: string;
}

export interface TableState {
  lastCheck: string;
  lastChange: string;
  hashes: FileHashes;
}

export interface SyncState {
  lastSync: string;
  tables: Map<string, TableState>;
}

export interface StateEntry {
  url: string;
  hashes: FileHashes;
}

/** 计算 SHA3-256 十六进制摘要。 */
export function sha3_256Hex(content: string): string {
  return createHash("sha3-256").update(content, "utf8").digest("hex");
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/** 解析旧的 state.toml；任何结构问题都按“无历史状态”处理。 */
export function parseStateToml(text: string): SyncState | null {
  let root: unknown;
  try {
    root = parseToml(text);
  } catch {
    return null;
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return null;
  }
  const rootRecord = root as Record<string, unknown>;
  const global = rootRecord.global;
  if (typeof global !== "object" || global === null || Array.isArray(global)) {
    return null;
  }
  const lastSync = readString(global as Record<string, unknown>, "last_sync");
  if (lastSync === null) {
    return null;
  }
  const tablesRecord = rootRecord.tables;
  const tables = new Map<string, TableState>();
  if (typeof tablesRecord === "object" && tablesRecord !== null && !Array.isArray(tablesRecord)) {
    for (const [url, value] of Object.entries(tablesRecord as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const lastCheck = readString(record, "last_check");
      const lastChange = readString(record, "last_change");
      const info = readString(record, "sha3_256_info");
      const header = readString(record, "sha3_256_header");
      const data = readString(record, "sha3_256_data");
      if (
        lastCheck === null ||
        lastChange === null ||
        info === null ||
        header === null ||
        data === null
      ) {
        continue;
      }
      tables.set(url, { lastCheck, lastChange, hashes: { info, header, data } });
    }
  }
  return { lastSync, tables };
}

/** 用本轮哈希构建新状态；哈希与旧状态一致时保留 last_change。 */
export function buildState(
  previous: SyncState | null,
  entries: readonly StateEntry[],
  now: Date
): SyncState {
  const nowIso = now.toISOString();
  const tables = new Map<string, TableState>();
  for (const entry of entries) {
    const old = previous?.tables.get(entry.url);
    const unchanged =
      old !== undefined &&
      old.hashes.info === entry.hashes.info &&
      old.hashes.header === entry.hashes.header &&
      old.hashes.data === entry.hashes.data;
    tables.set(entry.url, {
      lastCheck: nowIso,
      lastChange: unchanged ? old.lastChange : nowIso,
      hashes: entry.hashes,
    });
  }
  return { lastSync: nowIso, tables };
}

function tomlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** 序列化为与旧实现同构的 TOML 文本。 */
export function serializeStateToml(state: SyncState): string {
  const urls = [...state.tables.keys()].sort(compareByteOrder);
  const sections = [
    `[global]\nlast_sync = ${tomlString(state.lastSync)}`,
    ...urls.map((url) => {
      const table = state.tables.get(url);
      if (table === undefined) {
        return "";
      }
      return [
        `[tables.${tomlString(url)}]`,
        `last_check = ${tomlString(table.lastCheck)}`,
        `last_change = ${tomlString(table.lastChange)}`,
        `sha3_256_info = ${tomlString(table.hashes.info)}`,
        `sha3_256_header = ${tomlString(table.hashes.header)}`,
        `sha3_256_data = ${tomlString(table.hashes.data)}`,
      ].join("\n");
    }),
  ];
  return `${sections.join("\n\n")}\n`;
}

function compareByteOrder(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
