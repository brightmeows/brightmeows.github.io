/**
 * 默认流水线编排：基线扫描、overlay、fetch、post_process。
 *
 * 与旧实现 bms-table-fetch 的四阶段同构，区别在活跃表集合的来源：不再有
 * 列表源与 toml 配置，改为 R2 基线叠加用户层（站长与访客的增删记录）。
 * 并发抓取后做安全网重命名、孤儿处理、生成 tables.json 与 indexes，
 * 并写 state.toml 与单轮 warnings.log。
 */

import path from "node:path";

import type { UserLayer } from "../../src/lib/mirror/user-layer.ts";
import { internalApiBase } from "../internal-api.ts";

import { describeError } from "./errors.ts";
import { DEFAULT_TIMEOUT_MS, fetchTable, patchDataUrl, type FetchOptions } from "./fetch.ts";
import {
  atomicWrite,
  cleanTmpFiles,
  identityNormalizer,
  isChangedJsonFile,
  readTextIfExists,
} from "./fs-utils.ts";
import { compareUtf8, cloneJson } from "./json-utils.ts";
import {
  computeOrphans,
  computeRenames,
  executeOrphans,
  executeRenames,
  maybeRenameDir,
} from "./layout.ts";
import { RunLog, type PipelineLogger, type RunSummary } from "./log.ts";
import { expectedDirName } from "./naming.ts";
import { normalizeData, normalizeHeader } from "./normalize.ts";
import { serializeJson, writeIndexes, writeTablesJson } from "./output.ts";
import { mergeActiveSet } from "./overlay.ts";
import { mapPool } from "./pool.ts";
import { scanDirs, scanDirsFull } from "./scan.ts";
import { buildState, parseStateToml, serializeStateToml, sha3_256Hex } from "./state.ts";
import { tableInfoToJson } from "./table-info.ts";
import type { TableInfo } from "./types.ts";
import { loadUserLayer } from "./user-layer.ts";

export interface PipelinePaths {
  tableDir: string;
  indexDir: string;
  warnings: string;
}

/** 相对工作目录的默认路径，与旧实现的固定布局一致（列表源目录已退役）。 */
export const DEFAULT_PATHS: PipelinePaths = {
  tableDir: "tables",
  indexDir: "indexes",
  warnings: "warnings.log",
};

export interface PipelineOptions {
  cwd?: string;
  /** 覆盖默认路径（对拍与测试用）。 */
  paths?: Partial<PipelinePaths>;
  /** 抓取并发上限（决策：24）。 */
  concurrency?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  log?: PipelineLogger;
  /** 用户层内部接口基址；缺省取站点 origin（可用 INTERNAL_API_BASE 覆盖）。 */
  userLayerBase?: string | undefined;
  /** 用户层接口的共享 token；缺省读环境变量 INTERNAL_API_TOKEN。 */
  userLayerToken?: string | undefined;
  /** 直接注入用户层（对拍与演练用）；提供时不再拉取接口。 */
  userLayer?: UserLayer | undefined;
}

export interface PipelineResult {
  summary: RunSummary;
  warningsPath: string;
}

function resolvePaths(cwd: string, overrides: Partial<PipelinePaths> = {}): PipelinePaths {
  const merged = { ...DEFAULT_PATHS, ...overrides };
  return {
    tableDir: path.resolve(cwd, merged.tableDir),
    indexDir: path.resolve(cwd, merged.indexDir),
    warnings: path.resolve(cwd, merged.warnings),
  };
}

/** 执行完整流水线。 */
export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = resolvePaths(cwd, options.paths);
  const log = options.log ?? new RunLog();
  const concurrency = options.concurrency ?? 24;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchOptions: FetchOptions = { timeoutMs, fetchImpl: options.fetchImpl };
  const startedAt = new Date();

  log.info(`管线启动：表目录 ${paths.tableDir}`);

  await cleanTmpFiles(paths.tableDir);
  const baseEntries = await scanDirs(paths.tableDir);
  log.info(`基线扫描：${baseEntries.length} 个表目录`);
  const base = new Map(baseEntries.map((entry) => [entry.info.url, entry.info]));
  const oldDirMap = new Map(baseEntries.map((entry) => [entry.info.url, entry.dirName]));

  const { layer: userLayer, warnings: userWarnings } = await resolveUserLayer(options, log);
  for (const warning of userWarnings) {
    log.warn(warning);
  }
  log.info(
    `用户层：添加 ${userLayer.added.length}、删除 ${userLayer.removed.length}、禁用 ${userLayer.disabled.length}、替换 ${userLayer.replace.length}`
  );
  const { activeSet, unmatchedReplace } = mergeActiveSet({
    base,
    user: userLayer,
    oldDirMap,
  });
  for (const url of unmatchedReplace) {
    log.warn(`replace 规则未匹配到表：${url}`);
  }
  log.info(`活跃表：${activeSet.activeUrls.size} 张`);

  const preRenames = computeRenames(baseEntries, activeSet.tableInfoMap);
  const executedPreRenames = await executeRenames(preRenames, paths.tableDir, (message) =>
    log.warn(message)
  );
  if (executedPreRenames.length > 0) {
    log.info(`抓取前重命名：${executedPreRenames.length} 个目录`);
  }

  const targets = [...activeSet.tableInfoMap.values()].sort((left, right) =>
    compareUtf8(left.url, right.url)
  );
  const failures: string[] = [];
  let fetched = 0;
  await mapPool(targets, concurrency, async (info) => {
    const oldDirName = activeSet.oldDirMap.get(info.url);
    try {
      await fetchAndSaveTable(info, paths.tableDir, oldDirName, fetchOptions, log);
      fetched += 1;
    } catch (error) {
      failures.push(info.name === "" ? info.url : info.name);
      log.warn(
        `抓取失败：${info.name === "" ? info.url : info.name}（${info.url}）${describeError(error)}`
      );
    }
  });
  log.info(`抓取完成：成功 ${fetched}，失败 ${failures.length}`);

  let scanned = await scanDirsFull(paths.tableDir);
  const safetyRenames = computeRenames(scanned);
  const executedSafetyRenames = await executeRenames(safetyRenames, paths.tableDir, (message) =>
    log.warn(message)
  );
  if (executedSafetyRenames.length > 0) {
    log.info(`安全网重命名：${executedSafetyRenames.length} 个目录`);
  }
  const renamed = new Map(executedSafetyRenames.map((action) => [action.oldName, action.newName]));
  scanned = scanned.map((entry) => {
    const newName = renamed.get(entry.dirName);
    return newName === undefined ? entry : { ...entry, dirName: newName };
  });

  const orphans = computeOrphans(scanned, activeSet.activeUrls);
  const orphansMoved = await executeOrphans(orphans, paths.tableDir, (message) =>
    log.warn(message)
  );
  log.info(orphansMoved > 0 ? `孤儿目录移动：${orphansMoved} 个` : "孤儿目录：无");

  const tablesJsonPath = path.join(paths.tableDir, "tables.json");
  const tablesJsonEntries = await writeTablesJson(tablesJsonPath, scanned, activeSet.activeUrls);
  const indexResult = await writeIndexes(paths.indexDir, scanned, activeSet.activeUrls);
  for (const dirName of indexResult.unrecognized) {
    log.warn(`data.json 格式无法识别：${dirName}`);
  }

  const statePath = path.join(paths.tableDir, "state.toml");
  const previousState = parseStateToml((await readTextIfExists(statePath)) ?? "");
  const stateEntries = [];
  for (const entry of scanned) {
    if (!activeSet.activeUrls.has(entry.info.url)) {
      continue;
    }
    const dir = path.join(paths.tableDir, entry.dirName);
    const infoContent = await readTextIfExists(path.join(dir, "info.json"));
    const headerContent = await readTextIfExists(path.join(dir, "header.json"));
    const dataContent = await readTextIfExists(path.join(dir, "data.json"));
    if (infoContent === null || headerContent === null || dataContent === null) {
      log.warn(`state：跳过 ${entry.dirName}，缺少 info/header/data 文件`);
      continue;
    }
    stateEntries.push({
      url: entry.info.url,
      hashes: {
        info: sha3_256Hex(infoContent),
        header: sha3_256Hex(headerContent),
        data: sha3_256Hex(dataContent),
      },
    });
  }
  await atomicWrite(
    statePath,
    serializeStateToml(buildState(previousState, stateEntries, new Date()))
  );

  const finishedAt = new Date();
  const summary: RunSummary = {
    startedAt,
    finishedAt,
    userAdded: userLayer.added.length,
    userRemoved: userLayer.removed.length,
    userDisabled: userLayer.disabled.length,
    userReplaced: userLayer.replace.length,
    userWarnings: userWarnings.length,
    tablesTotal: activeSet.activeUrls.size,
    tablesFetched: fetched,
    tablesFailed: failures,
    renamed: executedPreRenames.length + executedSafetyRenames.length,
    orphansMoved,
    tablesJsonEntries,
    indexSizes: indexResult.sizes,
    longHashWarnings: indexResult.longHashWarnings,
    unrecognizedData: indexResult.unrecognized,
  };
  await atomicWrite(paths.warnings, log.render(summary));
  log.info(
    `管线完成：用时 ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)} 秒，告警 ${log.warningCount} 条`
  );
  return { summary, warningsPath: paths.warnings };
}

interface UserLayerLoad {
  layer: UserLayer;
  warnings: string[];
}

/** 加载用户层：优先使用注入，否则按 R2 公开基址拉取并报告来源。 */
async function resolveUserLayer(
  options: PipelineOptions,
  log: PipelineLogger
): Promise<UserLayerLoad> {
  if (options.userLayer !== undefined) {
    return { layer: options.userLayer, warnings: [] };
  }
  const base = options.userLayerBase ?? internalApiBase();
  log.info(`用户层来源：${base}/api/internal/user-layer`);
  const result = await loadUserLayer({
    base,
    ...(options.userLayerToken === undefined ? {} : { token: options.userLayerToken }),
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  });
  return { layer: result.layer, warnings: result.warnings };
}

/**
 * 抓取单张表并落盘。
 *
 * 流程与旧实现一致：预重命名、抓取、用 header 的 name/symbol 更新 info、
 * 按新 info 计算目录名、条件写入 header/data/info。
 */
async function fetchAndSaveTable(
  info: TableInfo,
  baseDir: string,
  oldDirName: string | undefined,
  fetchOptions: FetchOptions,
  log: PipelineLogger
): Promise<void> {
  const preDirName = expectedDirName(info, oldDirName);
  await maybeRenameDir(baseDir, preDirName, oldDirName, (message) => log.warn(message));

  const fetched = await fetchTable(info, fetchOptions);
  const updated: TableInfo = {
    name: String(fetched.header.name),
    symbol: String(fetched.header.symbol),
    url: info.url,
    extra: {
      ...cloneJson(info.extra),
      url_header_json: fetched.headerJsonUrl,
      url_data_json: fetched.dataJsonUrl,
    },
  };

  const dirName = expectedDirName(updated, preDirName);
  if (dirName !== preDirName) {
    await maybeRenameDir(baseDir, dirName, preDirName, (message) => log.warn(message));
  }
  const outDir = path.join(baseDir, dirName);

  const patchedHeader = patchDataUrl(fetched.headerRaw);
  const headerPath = path.join(outDir, "header.json");
  if (await isChangedJsonFile(headerPath, patchedHeader, normalizeHeader)) {
    await atomicWrite(headerPath, patchedHeader);
  }
  const dataPath = path.join(outDir, "data.json");
  if (await isChangedJsonFile(dataPath, fetched.dataRaw, normalizeData)) {
    await atomicWrite(dataPath, fetched.dataRaw);
  }
  const infoPath = path.join(outDir, "info.json");
  const infoContent = serializeJson(tableInfoToJson(updated));
  if (await isChangedJsonFile(infoPath, infoContent, identityNormalizer)) {
    await atomicWrite(infoPath, infoContent);
  }
}
