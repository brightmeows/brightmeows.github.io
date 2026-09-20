/**
 * 新旧实现对拍。
 *
 * 用 R2 上的公开基线（tables/<dir>/info.json 与 lists 缓存）搭两个独立
 * 工作区，分别跑新实现与旧二进制（bms-table-fetch release），再逐对象比对
 * 对外产物：info/header/data 逐字节比较，tables.json 与 indexes 按语义比较。
 *
 * 全程只读线上基线、不写 R2；差异报告与两份产物都留在工作区供复核。
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { runPipeline } from "./engine.ts";
import { describeError } from "./errors.ts";
import { canonicalJson, compareUtf8 } from "./json-utils.ts";
import type { PipelineLogger } from "./log.ts";

const execFileAsync = promisify(execFile);

/** 旧工具的版本（仓库归档后 release 资产仍可下载）。 */
export const OLD_TOOL_VERSION = "v0.4.2";

function oldToolUrl(version: string): string {
  return `https://github.com/brightmeows/bms-table-fetch/releases/download/${version}/bms-table-fetch-${version}-linux-amd64.tar.xz`;
}

export type ParityDifferenceKind = "only-new" | "only-rust" | "file-differs";

export interface ParityDifference {
  kind: ParityDifferenceKind;
  table: string;
  file: string | null;
  detail: string;
}

export interface ParityOptions {
  /** 仓库根目录（读取 config/*.toml 与 scripts/）。 */
  repoRoot: string;
  /** 工作区目录（会被清空重建）。 */
  workspace: string;
  /** 公开的 R2 基址。 */
  r2Base: string;
  /** 旧二进制路径；缺省时按版本号下载到工作区。 */
  oldBinary?: string;
  concurrency?: number;
  timeoutMs?: number;
  /** 只对拍清单前 N 张表；0 或缺省为全部。 */
  limit?: number;
  log?: (message: string) => void;
}

export interface ParityReport {
  checked: number;
  newFailures: string[];
  rustFailures: string[];
  differences: ParityDifference[];
  newWorkspace: string;
  rustWorkspace: string;
}

const OUTPUT_FILES = ["info.json", "header.json", "data.json"] as const;

interface BaselineEntry {
  dirName: string;
  url: string;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url);
  return response.ok ? response.text() : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`拉取失败：${url} 返回 ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

function manifestEntries(manifest: unknown): BaselineEntry[] {
  if (!Array.isArray(manifest)) {
    throw new Error("R2 清单不是数组");
  }
  const entries: BaselineEntry[] = [];
  for (const item of manifest) {
    const record = item as Record<string, unknown>;
    const dirName = typeof record.dir_name === "string" ? record.dir_name : null;
    const url = typeof record.url === "string" ? record.url : null;
    if (dirName !== null && url !== null) {
      entries.push({ dirName, url });
    }
  }
  return entries;
}

/** 拉取公开基线到 `<workspace>/baseline`，随后可复制成两个独立工作区。
 *
 * limit 模式（entries 为子集）下把列表缓存裁到同一子集，并把列表源指向一个
 * 不可达地址，让阶段一保留缓存而不是抓回全量列表，从而真正限制活跃表集合。
 */
async function prepareBaseline(
  repoRoot: string,
  workspace: string,
  r2Base: string,
  entries: readonly BaselineEntry[],
  listText: string | null,
  limited: boolean,
  log: (message: string) => void
): Promise<string> {
  const baseline = path.join(workspace, "baseline");
  await rm(baseline, { recursive: true, force: true });
  for (const dir of ["config", "lists", "tables"]) {
    await mkdir(path.join(baseline, dir), { recursive: true });
  }
  for (const name of ["table.toml", "list.toml"]) {
    await cp(path.join(repoRoot, "config", name), path.join(baseline, "config", name));
  }
  if (listText !== null) {
    const urls = new Set(entries.map((entry) => entry.url));
    const listEntries = JSON.parse(listText) as unknown;
    const selected = Array.isArray(listEntries)
      ? listEntries.filter((item) => urls.has(String((item as Record<string, unknown>).url)))
      : listEntries;
    await writeFile(
      path.join(baseline, "lists", "DARKSABUN.json"),
      limited ? JSON.stringify(selected, null, 2) : listText
    );
  }
  if (limited) {
    await writeFile(
      path.join(baseline, "config", "list.toml"),
      '[[source]]\nname = "DARKSABUN"\nurl = "http://127.0.0.1:1/offline-list"\n'
    );
  }

  let done = 0;
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (queue.length > 0) {
        const entry = queue.shift();
        if (entry === undefined) {
          return;
        }
        const text = await fetchText(
          `${r2Base}/tables/${encodeURIComponent(entry.dirName)}/info.json`
        );
        if (text !== null) {
          const dir = path.join(baseline, "tables", entry.dirName);
          await mkdir(dir, { recursive: true });
          await writeFile(path.join(dir, "info.json"), text);
        }
        done += 1;
        if (done % 100 === 0) {
          log(`基线进度：${done}/${entries.length}`);
        }
      }
    })
  );
  return baseline;
}

async function copyWorkspaces(baseline: string, targets: readonly string[]): Promise<void> {
  for (const target of targets) {
    await rm(target, { recursive: true, force: true });
    await cp(baseline, target, { recursive: true });
  }
}

async function downloadOldBinary(workspace: string, version: string): Promise<string> {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error(
      `对拍需要 linux-amd64 的旧二进制；当前为 ${process.platform}-${process.arch}，可用 PARITY_OLD_BINARY 指定路径`
    );
  }
  const dir = path.join(workspace, "tool");
  await mkdir(dir, { recursive: true });
  const binary = path.join(dir, "bms-table-fetch");
  if (existsSync(binary)) {
    return binary;
  }
  const archive = path.join(dir, "bms-table-fetch.tar.xz");
  const response = await fetch(oldToolUrl(version));
  if (!response.ok) {
    throw new Error(`下载旧二进制失败：${response.status}`);
  }
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  await execFileAsync("tar", ["-xJf", archive, "-C", dir]);
  await rm(archive, { force: true });
  return binary;
}

function pipelineLogger(log: (message: string) => void, prefix: string): PipelineLogger {
  let count = 0;
  return {
    warn: (message: string): void => {
      count += 1;
      log(`[${prefix}] [warn] ${message}`);
    },
    info: (message: string): void => log(`[${prefix}] ${message}`),
    get warningCount(): number {
      return count;
    },
    render: (summary): string =>
      `对拍运行 ${prefix}：成功 ${summary.tablesFetched}/${summary.tablesTotal}\n`,
  };
}

/** 运行对拍并返回差异报告。 */
export async function runParity(options: ParityOptions): Promise<ParityReport> {
  const log =
    options.log ??
    ((message: string): void => {
      process.stdout.write(`${message}\n`);
    });
  const r2Base = trimSlash(options.r2Base);
  const concurrency = options.concurrency ?? 24;
  const timeoutMs = options.timeoutMs ?? 60_000;

  log(`对拍开始：基线 ${r2Base}`);
  const manifest = await fetchJson(`${r2Base}/tables/tables.json`);
  const allEntries = manifestEntries(manifest);
  const entries =
    options.limit !== undefined && options.limit > 0
      ? allEntries.slice(0, options.limit)
      : allEntries;
  const listText = await fetchText(`${r2Base}/lists/DARKSABUN.json`);
  const limited = options.limit !== undefined && options.limit > 0;
  log(`基线表数：${allEntries.length}，本次对拍 ${entries.length} 张`);

  const baseline = await prepareBaseline(
    options.repoRoot,
    options.workspace,
    r2Base,
    entries,
    listText,
    limited,
    log
  );
  const newWorkspace = path.join(options.workspace, "new");
  const rustWorkspace = path.join(options.workspace, "rust");
  await copyWorkspaces(baseline, [newWorkspace, rustWorkspace]);

  log("运行新实现……");
  const startedNew = Date.now();
  const newResult = await runPipeline({
    cwd: newWorkspace,
    concurrency,
    timeoutMs,
    log: pipelineLogger(log, "new"),
  });
  const newSeconds = ((Date.now() - startedNew) / 1000).toFixed(1);
  log(
    `新实现完成：成功 ${newResult.summary.tablesFetched}/${newResult.summary.tablesTotal}，用时 ${newSeconds} 秒`
  );

  log("运行旧实现……");
  const binary =
    options.oldBinary ?? (await downloadOldBinary(options.workspace, OLD_TOOL_VERSION));
  const startedRust = Date.now();
  let rustOutput: string;
  try {
    const result = await execFileAsync(binary, [], {
      cwd: rustWorkspace,
      maxBuffer: 64 * 1024 * 1024,
    });
    rustOutput = `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    rustOutput = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    log(`旧实现退出码非零（继续比对产物）：${describeError(error)}`);
  }
  const rustSeconds = ((Date.now() - startedRust) / 1000).toFixed(1);
  await writeFile(path.join(options.workspace, "rust-run.log"), rustOutput);
  log(`旧实现完成：用时 ${rustSeconds} 秒`);

  const newFailures = newResult.summary.tablesFailed.slice().sort(compareUtf8);
  const rustFailures = parseRustFailures(rustOutput).sort(compareUtf8);
  const dirToUrl = new Map(entries.map((entry) => [entry.dirName, entry.url]));
  const differences = await compareWorkspaces(newWorkspace, rustWorkspace, {
    newFailures: new Set(newFailures),
    rustFailures: new Set(rustFailures),
    dirToUrl,
  });
  log(`对拍完成：差异 ${differences.length} 条`);

  return {
    checked: entries.length,
    newFailures,
    rustFailures,
    differences,
    newWorkspace,
    rustWorkspace,
  };
}

function parseRustFailures(output: string): string[] {
  const failures: string[] = [];
  for (const line of output.split("\n")) {
    const match = /Failed to fetch .+? from (https?:\/\/\S+)/u.exec(line);
    if (match?.[1] !== undefined) {
      failures.push(match[1]);
    }
  }
  return failures;
}

async function listDirectoryNames(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== "_orphaned")
    .map((entry) => entry.name)
    .sort(compareUtf8);
}

async function readIfExists(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export interface CompareContext {
  newFailures: ReadonlySet<string>;
  rustFailures: ReadonlySet<string>;
  dirToUrl: ReadonlyMap<string, string>;
}

export async function compareWorkspaces(
  newRoot: string,
  rustRoot: string,
  context?: CompareContext
): Promise<ParityDifference[]> {
  const differences: ParityDifference[] = [];
  const attribute = (table: string, side: "new" | "rust"): string => {
    if (context === undefined) {
      return side === "new" ? "新实现缺少该文件" : "旧实现缺少该文件";
    }
    const url = context.dirToUrl.get(table);
    const failed =
      url !== undefined && (side === "new" ? context.newFailures : context.rustFailures).has(url);
    return `${side === "new" ? "新实现" : "旧实现"}缺少该文件${failed ? "（该侧本轮抓取失败）" : ""}`;
  };
  const newDirs = await listDirectoryNames(path.join(newRoot, "tables"));
  const rustDirs = await listDirectoryNames(path.join(rustRoot, "tables"));
  const newSet = new Set(newDirs);
  const rustSet = new Set(rustDirs);

  for (const dir of newDirs) {
    if (!rustSet.has(dir)) {
      differences.push({
        kind: "only-new",
        table: dir,
        file: null,
        detail: "只有新实现生成了该目录",
      });
    }
  }
  for (const dir of rustDirs) {
    if (!newSet.has(dir)) {
      differences.push({
        kind: "only-rust",
        table: dir,
        file: null,
        detail: "只有旧实现生成了该目录",
      });
    }
  }

  for (const dir of newDirs) {
    if (!rustSet.has(dir)) {
      continue;
    }
    for (const file of OUTPUT_FILES) {
      const left = await readIfExists(path.join(newRoot, "tables", dir, file));
      const right = await readIfExists(path.join(rustRoot, "tables", dir, file));
      if (left === null && right === null) {
        continue;
      }
      if (left === null || right === null) {
        differences.push({
          kind: "file-differs",
          table: dir,
          file,
          detail: left === null ? attribute(dir, "new") : attribute(dir, "rust"),
        });
        continue;
      }
      if (!left.equals(right)) {
        differences.push({
          kind: "file-differs",
          table: dir,
          file,
          detail: `字节不同（新 ${left.length} B，旧 ${right.length} B）`,
        });
      }
    }
  }

  await compareJsonFile(
    path.join(newRoot, "tables", "tables.json"),
    path.join(rustRoot, "tables", "tables.json"),
    "tables.json",
    differences
  );
  for (const file of ["title.json", "artist.json", "md5.json", "sha256.json"]) {
    await compareJsonFile(
      path.join(newRoot, "indexes", file),
      path.join(rustRoot, "indexes", file),
      file,
      differences
    );
  }
  return differences;
}

async function compareJsonFile(
  leftPath: string,
  rightPath: string,
  label: string,
  differences: ParityDifference[]
): Promise<void> {
  const left = await readIfExists(leftPath);
  const right = await readIfExists(rightPath);
  if (left === null && right === null) {
    return;
  }
  if (left === null || right === null) {
    differences.push({
      kind: "file-differs",
      table: "(顶层)",
      file: label,
      detail: left === null ? "新实现缺少该文件" : "旧实现缺少该文件",
    });
    return;
  }
  const leftJson = JSON.parse(left.toString("utf8")) as unknown;
  const rightJson = JSON.parse(right.toString("utf8")) as unknown;
  if (canonicalJson(leftJson) !== canonicalJson(rightJson)) {
    differences.push({ kind: "file-differs", table: "(顶层)", file: label, detail: "语义不同" });
  }
}

/** 对拍报告转成可读文本（人工复核与日志用）。 */
export function formatParityReport(report: ParityReport): string {
  const lines: string[] = [
    `对拍表数：${report.checked}`,
    `新实现失败 ${report.newFailures.length} 张，旧实现失败 ${report.rustFailures.length} 张`,
    `差异条目：${report.differences.length}`,
  ];
  for (const difference of report.differences) {
    lines.push(
      `  [${difference.kind}] ${difference.table}${difference.file ? ` / ${difference.file}` : ""} ${difference.detail}`
    );
  }
  const onlyNewFailures = report.newFailures.filter((url) => !report.rustFailures.includes(url));
  const onlyRustFailures = report.rustFailures.filter((url) => !report.newFailures.includes(url));
  if (onlyNewFailures.length > 0) {
    lines.push(`仅新实现失败：${onlyNewFailures.join("；")}`);
  }
  if (onlyRustFailures.length > 0) {
    lines.push(`仅旧实现失败：${onlyRustFailures.join("；")}`);
  }
  lines.push(`产物工作区：${report.newWorkspace} 与 ${report.rustWorkspace}`);
  return `${lines.join("\n")}\n`;
}
