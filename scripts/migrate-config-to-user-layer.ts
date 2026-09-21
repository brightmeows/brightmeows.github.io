/**
 * 一次性迁移：把存档的旧配置转成 R2 用户层对象。
 *
 * 输入是 `scripts/pipeline/fixtures/legacy-table.toml`（旧 config/table.toml 的
 * 存档副本），输出 `out/user/*.json`，由 `migrate-config` 工作流经 rclone 上传到
 * R2。运行前检查线上 `user/added.json`：已有数据时中止，避免覆盖真实用户数据
 * （`--force` 跳过检查）。迁移完成后本脚本与工作流可一并删除。
 *
 * 用法：node scripts/migrate-config-to-user-layer.ts [--out-dir=./out] [--force]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { normalizeBase } from "../src/lib/mirror/urls.ts";
import {
  parseAddedIndex,
  serializeUserIndex,
  serializeUserRecord,
  userAddedKey,
  userAuditKey,
  userAuthorizedKey,
  userDisabledKey,
  userFetchedKey,
  userMetaKey,
  userRemovedKey,
  userReplaceKey,
  type AuditEntry,
} from "../src/lib/mirror/user-layer.ts";

import { legacyTableConfigToUserLayer, parseLegacyTableConfig } from "./pipeline/legacy-config.ts";
import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

/** 旧配置的存档副本（相对仓库根目录）。 */
const FIXTURE_PATH = path.join("scripts", "pipeline", "fixtures", "legacy-table.toml");

export interface MigrateResult {
  added: number;
  disabled: number;
  replace: number;
  meta: number;
}

export interface MigrateOptions {
  repoRoot: string;
  outDir: string;
  r2Base: string;
  /** 清单对象键（config/site.json 的 r2.manifestObject），用于取真实目录名。 */
  manifestObject: string;
  force?: boolean | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/** 把 R2 对象键按同名路径写入输出目录。 */
async function writeKey(outDir: string, key: string, content: string): Promise<void> {
  const target = path.join(outDir, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

/** 读取线上 added 索引；不存在或损坏按空处理（迁移前的正常状态）。 */
async function fetchExistingAdded(r2Base: string, fetchImpl: typeof fetch): Promise<unknown[]> {
  try {
    const response = await fetchImpl(`${r2Base}/${userAddedKey()}`);
    if (!response.ok) {
      return [];
    }
    return parseAddedIndex(await response.json());
  } catch {
    return [];
  }
}

/**
 * 从线上清单取「URL 到真实元数据」的映射。
 * 旧配置的 `[[table]]` 不带 name/symbol，迁移时用清单里的真实值，避免写出
 * 空表名的目录占位；清单不可用时全部回落到按命名规则预计算。
 */
async function fetchKnownTables(
  r2Base: string,
  manifestObject: string,
  fetchImpl: typeof fetch
): Promise<Map<string, { dir_name: string; name: string; symbol: string }>> {
  const known = new Map<string, { dir_name: string; name: string; symbol: string }>();
  try {
    const response = await fetchImpl(`${r2Base}/${manifestObject}`);
    if (!response.ok) {
      return known;
    }
    const parsed: unknown = await response.json();
    if (!Array.isArray(parsed)) {
      return known;
    }
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";
      const dirName = typeof record.dir_name === "string" ? record.dir_name : "";
      if (url === "" || dirName === "") {
        continue;
      }
      known.set(url, {
        dir_name: dirName,
        name: typeof record.name === "string" ? record.name : "",
        symbol: typeof record.symbol === "string" ? record.symbol : "",
      });
    }
  } catch {
    // 清单不可用：返回空映射（调用方会回落到预计算目录名）
  }
  return known;
}

/** 生成用户层对象文件；返回各类条目数。 */
export async function migrateConfigToUserLayer(options: MigrateOptions): Promise<MigrateResult> {
  const fixturePath = path.join(options.repoRoot, FIXTURE_PATH);
  const text = await readFile(fixturePath, "utf8");
  const legacy = parseLegacyTableConfig(text);
  const at = new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const known = await fetchKnownTables(options.r2Base, options.manifestObject, fetchImpl);
  const layer = legacyTableConfigToUserLayer(legacy, {
    author: "legacy-config",
    now: at,
    known,
  });

  if (options.force !== true) {
    const existing = await fetchExistingAdded(options.r2Base, fetchImpl);
    if (existing.length > 0) {
      throw new Error(
        `线上 user/added.json 已有 ${existing.length} 条记录，中止迁移（确认要覆盖时加 --force）`
      );
    }
  }

  await writeKey(options.outDir, userAddedKey(), serializeUserIndex(layer.added));
  for (const entry of layer.fetched) {
    await writeKey(options.outDir, userFetchedKey(entry.id), serializeUserRecord(entry));
  }
  await writeKey(options.outDir, userDisabledKey(), serializeUserIndex(layer.disabled));
  await writeKey(options.outDir, userReplaceKey(), serializeUserIndex(layer.replace));
  await writeKey(options.outDir, userMetaKey(), serializeUserIndex(layer.meta));
  // 授权名单与黑名单显式写空索引：标记迁移完成时的初始状态
  await writeKey(options.outDir, userAuthorizedKey(), serializeUserIndex([]));
  await writeKey(options.outDir, userRemovedKey(), serializeUserIndex([]));

  const audit: AuditEntry = {
    at: at.toISOString(),
    actor: "legacy-config",
    role: "admin",
    action: "migrate",
    detail: `迁移旧 toml 配置：表 ${layer.added.length}、禁用 ${layer.disabled.length}、替换 ${layer.replace.length}`,
  };
  const stamp = at.toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await writeKey(options.outDir, userAuditKey(stamp, "migrate"), serializeUserRecord(audit));

  return {
    added: layer.added.length,
    disabled: layer.disabled.length,
    replace: layer.replace.length,
    meta: layer.meta.length,
  };
}

function parseArgs(argv: string[]): { outDir: string; force: boolean } {
  const result: { outDir: string; force: boolean } = { outDir: "out", force: false };
  for (const arg of argv) {
    if (arg.startsWith("--out-dir=")) {
      result.outDir = arg.slice("--out-dir=".length);
    } else if (arg === "--force") {
      result.force = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

async function main(argv: string[]): Promise<void> {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = parseArgs(argv);
  const config = readSiteConfig(CONFIG_PATH);
  const result = await migrateConfigToUserLayer({
    repoRoot,
    outDir: path.resolve(repoRoot, args.outDir),
    r2Base: normalizeBase(config.r2.base),
    manifestObject: config.r2.manifestObject,
    force: args.force,
  });
  console.log(
    `迁移对象已生成：表 ${result.added}、禁用 ${result.disabled}、替换 ${result.replace}、元数据覆盖 ${result.meta}`
  );
  console.log(`输出目录：${path.resolve(repoRoot, args.outDir)}/user`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
