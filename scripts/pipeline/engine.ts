/**
 * 默认流水线编排：基线扫描、overlay、fetch、post_process。
 *
 * 与旧实现 bms-table-fetch 的四阶段同构，区别在活跃表集合的来源：不再有
 * 列表源与 toml 配置，改为 R2 基线叠加用户层（站长与访客的增删记录）。
 * 并发抓取后做安全网重命名、孤儿处理、生成 tables.json 与 v2 搜索索引，
 * 并写 state.toml 与单轮 warnings.log。
 */

import path from "node:path";

import type { UserLayer } from "@brightmeows/mirror/user-layer";

import { internalApiBase } from "../internal-api.ts";

import { writeCompactSearchIndexes, type CompactIndexWriteResult } from "./compact-index.ts";
import { describeError } from "./errors.ts";
import { DEFAULT_TIMEOUT_MS, fetchTable, patchDataUrl, type FetchOptions } from "./fetch.ts";
import {
  atomicWrite,
  cleanTmpFiles,
  identityNormalizer,
  isChangedJsonFile,
  readTextIfExists,
} from "./fs-utils.ts";
import {
  buildHealthState,
  classifyFetchError,
  countStale,
  initialHealthState,
  parseHealthFile,
  reasonLabel,
  shouldRecheck,
  type FetchOutcome,
  type HealthFile,
} from "./health.ts";
import { buildIndexes, type IndexBuildResult } from "./index-build.ts";
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
import { serializeJson, writeHealthJson, writeTablesJson } from "./output.ts";
import { mergeActiveSet } from "./overlay.ts";
import { mapPool } from "./pool.ts";
import { scanDirs, scanDirsFull } from "./scan.ts";
import {
  buildState,
  parseStateToml,
  serializeStateToml,
  sha3_256Hex,
  type StateEntry,
  type SyncState,
} from "./state.ts";
import { tableInfoToJson } from "./table-info.ts";
import type { FullDirEntry, TableInfo } from "./types.ts";
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
  /** 固定本轮时间（测试用）；缺省取启动时刻。 */
  now?: Date | undefined;
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
  const startedAt = options.now ?? new Date();

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

  const { statePath, healthPath, previousState, initialHealth } = await preparePipelineHealth(
    paths.tableDir,
    activeSet.activeUrls,
    log,
    startedAt
  );

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
  const { fetchTargets, outcomes, skipped } = planFetchTargets(targets, initialHealth, startedAt);
  if (skipped > 0) {
    log.info(`跳过 stale 表：${skipped} 张（未到月度复查）`);
  }
  const failures: string[] = [];
  let fetched = 0;
  await mapPool(fetchTargets, concurrency, async (info) => {
    const oldDirName = activeSet.oldDirMap.get(info.url);
    try {
      await fetchAndSaveTable(info, paths.tableDir, oldDirName, fetchOptions, log);
      outcomes.set(info.url, { kind: "ok" });
      fetched += 1;
    } catch (error) {
      const reason = classifyFetchError(error);
      outcomes.set(info.url, { kind: "failed", reason });
      failures.push(info.name === "" ? info.url : info.name);
      log.warn(
        `抓取失败：${info.name === "" ? info.url : info.name}（${info.url}）[${reasonLabel(reason)}] ${describeError(error)}`
      );
    }
  });
  log.info(`抓取完成：成功 ${fetched}，失败 ${failures.length}，跳过 stale ${skipped}`);

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
  const indexResult = await writeSearchIndexes(
    log,
    paths,
    scanned,
    activeSet.activeUrls,
    startedAt
  );
  for (const dirName of indexResult.built.unrecognized) {
    log.warn(`data.json 格式无法识别：${dirName}`);
  }

  const stateEntries = await collectStateEntries(
    scanned,
    activeSet.activeUrls,
    paths.tableDir,
    log
  );
  const newState = buildState(previousState, stateEntries, startedAt);
  await atomicWrite(statePath, serializeStateToml(newState));
  const lastChangeByUrl = new Map(
    [...newState.tables].map(([url, table]) => [url, table.lastChange])
  );
  const health = buildHealthState(initialHealth, outcomes, startedAt, lastChangeByUrl);
  const healthEntries = await writeHealthJson(healthPath, health);

  const finishedAt = options.now ?? new Date();
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
    tablesSkipped: skipped,
    tablesStale: countStale(health),
    healthEntries,
    renamed: executedPreRenames.length + executedSafetyRenames.length,
    orphansMoved,
    tablesJsonEntries,
    indexSizes: indexResult.compact.sizes,
    longHashWarnings: indexResult.built.longHashWarnings,
    unrecognizedData: indexResult.built.unrecognized,
  };
  await atomicWrite(paths.warnings, log.render(summary));
  log.info(
    `管线完成：用时 ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)} 秒，告警 ${log.warningCount} 条`
  );
  return { summary, warningsPath: paths.warnings };
}

/** 构建索引并写 v2；失败让管线在同步 R2 前失败。 */
async function writeSearchIndexes(
  log: PipelineLogger,
  paths: PipelinePaths,
  scanned: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>,
  now: Date
): Promise<SearchIndexWriteResult> {
  const activeEntries = scanned.filter((entry) => activeUrls.has(entry.info.url));
  const built = buildIndexes(activeEntries);
  const compact = await writeCompactSearchIndexes(paths.indexDir, scanned, activeUrls, built, now);
  log.info(
    `v2 索引：${Object.entries(compact.sizes)
      .map(([name, size]) => `${name}=${size}`)
      .join(" ")}；表 ${compact.tableCount} 张；manifest ${compact.manifestVersion}`
  );
  if (compact.registryReset) {
    log.warn("v2 manifest 结构非法，表 ID 注册表已从 1 重排");
  }
  return { built, compact };
}

interface SearchIndexWriteResult {
  built: IndexBuildResult;
  compact: CompactIndexWriteResult;
}

interface PipelineHealth {
  statePath: string;
  healthPath: string;
  previousState: SyncState | null;
  initialHealth: HealthFile;
}

/** 读取 state.toml 与 health.json，初始化当前活跃表的健康状态。 */
async function preparePipelineHealth(
  tableDir: string,
  activeUrls: ReadonlySet<string>,
  log: PipelineLogger,
  now: Date
): Promise<PipelineHealth> {
  const statePath = path.join(tableDir, "state.toml");
  const previousState = parseStateToml((await readTextIfExists(statePath)) ?? "");
  const healthPath = path.join(tableDir, "health.json");
  const previousHealthText = await readTextIfExists(healthPath);
  const previousHealth = previousHealthText === null ? null : parseHealthFile(previousHealthText);
  if (previousHealthText !== null && previousHealth === null) {
    log.warn("health.json 解析失败，按无历史状态处理");
  }
  const initialHealth = initialHealthState({
    previous: previousHealth,
    state: previousState,
    activeUrls,
    now,
  });
  return { statePath, healthPath, previousState, initialHealth };
}

interface PlannedFetch {
  fetchTargets: TableInfo[];
  outcomes: Map<string, FetchOutcome>;
  skipped: number;
}

/** 按健康状态筛选本轮要抓取的表；未到复查期的 stale 表直接跳过。 */
function planFetchTargets(
  targets: readonly TableInfo[],
  initialHealth: HealthFile,
  now: Date
): PlannedFetch {
  const outcomes = new Map<string, FetchOutcome>();
  const fetchTargets: TableInfo[] = [];
  for (const info of targets) {
    const health = initialHealth.tables.get(info.url);
    if (health?.status === "stale" && !shouldRecheck(health, now)) {
      outcomes.set(info.url, { kind: "skipped" });
      continue;
    }
    fetchTargets.push(info);
  }
  return { fetchTargets, outcomes, skipped: targets.length - fetchTargets.length };
}

/** 读取活跃表三份产物的哈希，供 state.toml 判断 last_change。 */
async function collectStateEntries(
  scanned: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>,
  tableDir: string,
  log: PipelineLogger
): Promise<StateEntry[]> {
  const entries: StateEntry[] = [];
  for (const entry of scanned) {
    if (!activeUrls.has(entry.info.url)) {
      continue;
    }
    const dir = path.join(tableDir, entry.dirName);
    const infoContent = await readTextIfExists(path.join(dir, "info.json"));
    const headerContent = await readTextIfExists(path.join(dir, "header.json"));
    const dataContent = await readTextIfExists(path.join(dir, "data.json"));
    if (infoContent === null || headerContent === null || dataContent === null) {
      log.warn(`state：跳过 ${entry.dirName}，缺少 info/header/data 文件`);
      continue;
    }
    entries.push({
      url: entry.info.url,
      hashes: {
        info: sha3_256Hex(infoContent),
        header: sha3_256Hex(headerContent),
        data: sha3_256Hex(dataContent),
      },
    });
  }
  return entries;
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
