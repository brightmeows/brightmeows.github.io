/**
 * 单表抓取：供 `fetch-table` 工作流调用（用户提交添加后由 Worker 触发）。
 *
 * 复用管线的抓取与规范化逻辑（`fetchTable`、`patchDataUrl`、目录命名），抓取
 * 成功时把 `tables/<dir_name>/{header,data,info}.json`、`user/fetched/<id>.json`
 * 与状态文件写到输出目录，交给工作流用 rclone 上传到 R2；失败只写 failed 状态，
 * 不产出数据目录——半成品目录会被管线当作基线，必须避免。
 *
 * 用法：
 *   node scripts/fetch-table-once.ts --url=<表源> --request-id=<id> --out-dir=./out [--author=<login>]
 *
 * 退出码恒为 0（除参数错误外）：状态文件已写出，工作流需要上传它。结果摘要写在
 * `<out-dir>/result.json`（state 为 done 或 failed）。
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  serializeUserRecord,
  userFetchedKey,
  userStatusKey,
  type FetchedEntry,
  type StatusEntry,
} from "../src/lib/mirror/user-layer.ts";

import { describeError } from "./pipeline/errors.ts";
import { DEFAULT_TIMEOUT_MS, fetchTable, patchDataUrl } from "./pipeline/fetch.ts";
import { expectedDirName } from "./pipeline/naming.ts";
import { serializeJson } from "./pipeline/output.ts";
import { tableInfoToJson } from "./pipeline/table-info.ts";
import type { TableInfo } from "./pipeline/types.ts";

export interface FetchOnceOptions {
  /** 表源 URL（用户提交的原始地址）。 */
  url: string;
  /** 添加请求 id，关联 `user/status/<id>.json` 与 `user/fetched/<id>.json`。 */
  requestId: string;
  /** 输出目录（工作流上传的根）。 */
  outDir: string;
  /** 添加者 GitHub 登录名；仅记录在失败状态里，便于排查。 */
  author?: string | undefined;
  timeoutMs?: number | undefined;
}

export interface FetchOnceResult {
  state: "done" | "failed";
  dirName?: string | undefined;
  message?: string | undefined;
}

/** 把 R2 对象键按同名路径写入输出目录。 */
async function writeKey(outDir: string, key: string, value: unknown): Promise<void> {
  const target = path.join(outDir, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, serializeUserRecord(value));
}

function statusEntry(
  options: FetchOnceOptions,
  state: "done" | "failed",
  at: string,
  message?: string
): StatusEntry {
  const detail =
    message === undefined || options.author === undefined
      ? message
      : `提交者 ${options.author}：${message}`;
  return {
    id: options.requestId,
    url: options.url,
    state,
    ...(detail === undefined || detail === "" ? {} : { message: detail }),
    updated_at: at,
  };
}

/** 抓取单张表并写出上传所需文件；失败时只写状态。 */
export async function fetchTableOnce(options: FetchOnceOptions): Promise<FetchOnceResult> {
  const at = new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const fetched = await fetchTable(
      { name: "", symbol: "", url: options.url, extra: {} },
      { timeoutMs }
    );
    const rawName = fetched.header.name;
    const rawSymbol = fetched.header.symbol;
    const updated: TableInfo = {
      name: typeof rawName === "string" ? rawName : "",
      symbol: typeof rawSymbol === "string" ? rawSymbol : "",
      url: options.url,
      extra: {
        url_header_json: fetched.headerJsonUrl,
        url_data_json: fetched.dataJsonUrl,
      },
    };
    const dirName = expectedDirName(updated);

    const dir = path.join(options.outDir, "tables", dirName);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "header.json"), patchDataUrl(fetched.headerRaw));
    await writeFile(path.join(dir, "data.json"), fetched.dataRaw);
    await writeFile(path.join(dir, "info.json"), serializeJson(tableInfoToJson(updated)));

    const fetchedEntry: FetchedEntry = {
      id: options.requestId,
      url: options.url,
      dir_name: dirName,
      name: updated.name,
      ...(updated.symbol === "" ? {} : { symbol: updated.symbol }),
      fetched_at: at,
    };
    await writeKey(options.outDir, userFetchedKey(options.requestId), fetchedEntry);
    await writeKey(
      options.outDir,
      userStatusKey(options.requestId),
      statusEntry(options, "done", at)
    );
    return { state: "done", dirName };
  } catch (error) {
    const message = describeError(error);
    await writeKey(
      options.outDir,
      userStatusKey(options.requestId),
      statusEntry(options, "failed", at, message)
    );
    return { state: "failed", message };
  }
}

function parseArgs(argv: string[]): FetchOnceOptions {
  const result: {
    url?: string;
    requestId?: string;
    outDir?: string;
    author?: string | undefined;
    timeoutMs?: number;
  } = {};
  for (const arg of argv) {
    if (arg.startsWith("--url=")) {
      result.url = arg.slice("--url=".length);
    } else if (arg.startsWith("--request-id=")) {
      result.requestId = arg.slice("--request-id=".length);
    } else if (arg.startsWith("--out-dir=")) {
      result.outDir = arg.slice("--out-dir=".length);
    } else if (arg.startsWith("--author=")) {
      const author = arg.slice("--author=".length);
      result.author = author === "" ? undefined : author;
    } else if (arg.startsWith("--timeout-ms=")) {
      result.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  if (result.url === undefined || result.url === "") {
    throw new Error("必须提供 --url=<表源 URL>");
  }
  if (result.requestId === undefined || result.requestId === "") {
    throw new Error("必须提供 --request-id=<id>");
  }
  try {
    new URL(result.url);
  } catch {
    throw new Error(`--url 不是合法 URL：${result.url}`);
  }
  return {
    url: result.url,
    requestId: result.requestId,
    outDir: result.outDir ?? "out",
    ...(result.author === undefined ? {} : { author: result.author }),
    ...(result.timeoutMs === undefined ? {} : { timeoutMs: result.timeoutMs }),
  };
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const result = await fetchTableOnce(options);
  await mkdir(options.outDir, { recursive: true });
  await writeFile(
    path.join(options.outDir, "result.json"),
    serializeUserRecord({
      state: result.state,
      ...(result.dirName === undefined ? {} : { dir_name: result.dirName }),
      ...(result.message === undefined ? {} : { message: result.message }),
    })
  );
  if (result.state === "done") {
    console.log(`抓取成功：${result.dirName}`);
  } else {
    // 状态文件已写出且会被上传，工作流据 result.json 判断；这里不置非零退出码
    console.error(`抓取失败：${result.message ?? "未知错误"}`);
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
