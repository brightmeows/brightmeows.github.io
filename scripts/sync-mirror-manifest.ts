/**
 * 把 R2 上的镜像表清单同步为仓库内快照（`src/lib/mirror/table-manifest.json`）。
 *
 * 只在「列表变动」时写入：判定口径是站点消费字段的投影（见 manifest.ts 的
 * projectTableList），因此上游元数据抖动与表内容更新都不会改动快照，也就不会
 * 触发部署。是否提交由调用方（update-tables 工作流）比对 git 状态决定。
 *
 * 用法：node scripts/sync-mirror-manifest.ts [--config=config/mirror.json] [--snapshot=src/lib/mirror/table-manifest.json] [--check]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { diffTableList, serializeTableManifest } from "../src/lib/mirror/manifest.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

/** 从共享配置读取 R2 基址（与站点代码同一来源）。 */
export function readR2Base(configPath: string): string {
  const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`共享配置不是对象：${configPath}`);
  }
  const { r2Base } = parsed as Record<string, unknown>;
  if (typeof r2Base !== "string" || !/^https?:\/\//.test(r2Base)) {
    throw new Error(`共享配置 r2Base 不是 http(s) 地址：${configPath}`);
  }
  return r2Base.replace(/\/+$/, "");
}

export interface SyncResult {
  /** 是否发生列表变动（check 模式下据此返回非零退出码）。 */
  changed: boolean;
  added: string[];
  removed: string[];
  updated: string[];
  /** 远端清单条数与快照是否已写入。 */
  total: number;
  written: boolean;
}

export interface SyncOptions {
  r2Base: string;
  snapshotPath: string;
  check?: boolean;
  fetchImpl?: typeof fetch;
}

function loadJsonArray(filePath: string | null): MirrorTableItem[] {
  if (filePath === null || !existsSync(filePath)) return [];
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`快照不是数组：${filePath}`);
  }
  return parsed as MirrorTableItem[];
}

/** 拉取远端清单、比对投影，必要时写入快照。 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const manifestUrl = `${options.r2Base}/tables/tables.json`;
  const res = await fetchImpl(manifestUrl);
  if (!res.ok) {
    throw new Error(`拉取 R2 清单失败：${manifestUrl} 返回 ${res.status}`);
  }
  const remote: unknown = await res.json();
  if (!Array.isArray(remote)) {
    throw new Error(`R2 清单不是数组：${manifestUrl}`);
  }
  const next = remote as MirrorTableItem[];
  const before = loadJsonArray(options.snapshotPath);
  const diff = diffTableList(before, next);
  const changed = diff.added.length + diff.removed.length + diff.updated.length > 0;
  let written = false;
  if (changed && !options.check) {
    writeFileSync(options.snapshotPath, serializeTableManifest(next));
    written = true;
  }
  return { changed, ...diff, total: next.length, written };
}

function parseArgs(argv: string[]): { configPath?: string; snapshotPath?: string; check: boolean } {
  const result: { configPath?: string; snapshotPath?: string; check: boolean } = { check: false };
  for (const arg of argv) {
    if (arg === "--check") {
      result.check = true;
    } else if (arg.startsWith("--config=")) {
      result.configPath = arg.slice("--config=".length);
    } else if (arg.startsWith("--snapshot=")) {
      result.snapshotPath = arg.slice("--snapshot=".length);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

async function main(argv: string[]): Promise<void> {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = parseArgs(argv);
  const configPath = args.configPath ?? path.join(repoRoot, "config", "mirror.json");
  const snapshotPath =
    args.snapshotPath ?? path.join(repoRoot, "src", "lib", "mirror", "table-manifest.json");

  const result = await runSync({
    r2Base: readR2Base(configPath),
    snapshotPath,
    check: args.check,
  });

  console.log(`清单来源：${readR2Base(configPath)}/tables/tables.json`);
  console.log(`快照路径：${snapshotPath}`);
  console.log(`远端条数：${result.total}`);
  if (!result.changed) {
    console.log("列表无变动（投影口径），快照未改动");
    return;
  }
  console.log(
    `列表变动：新增 ${result.added.length}、删除 ${result.removed.length}、展示字段变化 ${result.updated.length}`
  );
  for (const name of result.added) console.log(`  + ${name}`);
  for (const name of result.removed) console.log(`  - ${name}`);
  for (const name of result.updated) console.log(`  ~ ${name}`);
  console.log(result.written ? "快照已更新" : "检查模式：未写入");
  if (args.check) process.exitCode = 1;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
