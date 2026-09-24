/**
 * 检测 R2 清单的列表变动，变动时写出新基线供工作流推回 R2。
 *
 * 2026-09 之前这件事靠“把清单快照提交进仓库”实现：比对本地快照、有变动就提交，
 * 用 git 提交的副作用触发三端重建。现在不再落仓库——基线也放 R2
 * （`meta/last-notified.json`，刻意不在 rclone 的同步白名单里），工作流在变动时
 * 推回新基线并用 App token 触发 deploy 与 mirror。
 *
 * 判定口径不变（`projectTableList` 的投影）：上游元数据抖动与表内容更新都不会
 * 触发重建，只有站点消费的展示字段或表集合变化才会。
 *
 * 用法：node scripts/detect-mirror-change.ts [--out=<基线路径>] [--config=<配置路径>]
 * 输出：stdout 只打印 `true` 或 `false`（有无列表变动），日志一律走 stderr。
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { diffTableList, serializeTableManifest } from "@brightmeows/mirror/manifest";
import type { MirrorTableItem } from "@brightmeows/mirror/types";

import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

export interface DetectResult {
  changed: boolean;
  added: string[];
  removed: string[];
  updated: string[];
  /** 远端清单条数。 */
  total: number;
  /** 是否写出了新基线。 */
  written: boolean;
}

export interface DetectOptions {
  r2Base: string;
  /** 管线清单对象键（如 `tables/tables.json`）。 */
  manifestObject: string;
  /** 上次通知时的清单对象键（如 `meta/last-notified.json`）。 */
  baselineObject: string;
  /** 变动时把新基线写到这个路径（缺省只报告不写）。 */
  outPath?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/** 拉一个 JSON 数组对象；基线缺失按空数组处理。 */
async function fetchJsonArray(
  url: string,
  fetchImpl: typeof fetch,
  missingOk: boolean
): Promise<MirrorTableItem[]> {
  const response = await fetchImpl(url);
  if (response.status === 404 && missingOk) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`拉取失败：${url} 返回 ${response.status}`);
  }
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error(`对象不是数组：${url}`);
  }
  return parsed as MirrorTableItem[];
}

/** 拉取远端清单与基线、比对投影，必要时写出新基线。 */
export async function detectMirrorChange(options: DetectOptions): Promise<DetectResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.r2Base.replace(/\/+$/, "");
  const manifestUrl = `${base}/${options.manifestObject}`;
  const baselineUrl = `${base}/${options.baselineObject}`;

  const [next, before] = await Promise.all([
    fetchJsonArray(manifestUrl, fetchImpl, false),
    fetchJsonArray(baselineUrl, fetchImpl, true),
  ]);
  const diff = diffTableList(before, next);
  const changed = diff.added.length + diff.removed.length + diff.updated.length > 0;

  let written = false;
  if (changed && options.outPath !== undefined) {
    writeFileSync(options.outPath, serializeTableManifest(next));
    written = true;
  }
  return { changed, ...diff, total: next.length, written };
}

function parseArgs(argv: string[]): { outPath?: string; configPath?: string } {
  const result: { outPath?: string; configPath?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith("--out=")) {
      result.outPath = arg.slice("--out=".length);
    } else if (arg.startsWith("--config=")) {
      result.configPath = arg.slice("--config=".length);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

async function main(argv: string[]): Promise<void> {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = parseArgs(argv);
  const config = readSiteConfig(args.configPath ?? CONFIG_PATH);
  const outPath = args.outPath === undefined ? undefined : path.resolve(repoRoot, args.outPath);

  const result = await detectMirrorChange({
    r2Base: config.r2.base,
    manifestObject: config.r2.manifestObject,
    baselineObject: config.r2.baselineObject,
    ...(outPath === undefined ? {} : { outPath }),
  });

  process.stderr.write(`清单：${config.r2.base}/${config.r2.manifestObject}\n`);
  process.stderr.write(`基线：${config.r2.base}/${config.r2.baselineObject}\n`);
  process.stderr.write(`远端条数：${result.total}\n`);
  if (!result.changed) {
    process.stderr.write("列表无变动（投影口径）\n");
  } else {
    process.stderr.write(
      `列表变动：新增 ${result.added.length}、删除 ${result.removed.length}、展示字段变化 ${result.updated.length}\n`
    );
    for (const name of result.added) process.stderr.write(`  + ${name}\n`);
    for (const name of result.removed) process.stderr.write(`  - ${name}\n`);
    for (const name of result.updated) process.stderr.write(`  ~ ${name}\n`);
    process.stderr.write(result.written ? `新基线已写出：${outPath}\n` : "仅报告，未写出基线\n");
  }
  // 供工作流捕获的唯一输出
  process.stdout.write(`${result.changed}\n`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
