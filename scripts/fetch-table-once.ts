/**
 * 单表抓取：供 `fetch-table` 工作流调用（用户提交添加后由 Worker 触发）。
 *
 * 复用管线的抓取与规范化逻辑（`fetchTable`、`patchDataUrl`、目录命名）：抓取成功
 * 时把 `tables/<dir_name>/{header,data,info}.json` 写到输出目录，交工作流用 rclone
 * 上传到 R2；抓取结果与状态则经站点 Worker 的内部接口写进 D1（不再落 R2 对象）。
 * 失败时不产出数据目录——半成品目录会被管线当作基线，必须避免。
 *
 * 用法：
 *   node scripts/fetch-table-once.ts --url=<表源> --request-id=<id> --out-dir=./out [--author=<login>]
 *
 * 退出码恒为 0（除参数错误外）：状态已经写进 D1，工作流据 `<out-dir>/result.json`
 * 判断是否上传数据目录。
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { serializeUserRecord } from "../src/lib/mirror/user-layer.ts";

import { callInternal } from "./internal-api.ts";
import { describeError } from "./pipeline/errors.ts";
import { DEFAULT_TIMEOUT_MS, fetchTable, patchDataUrl } from "./pipeline/fetch.ts";
import { expectedDirName } from "./pipeline/naming.ts";
import { serializeJson } from "./pipeline/output.ts";
import { tableInfoToJson } from "./pipeline/table-info.ts";
import type { TableInfo } from "./pipeline/types.ts";

export interface FetchOnceOptions {
  /** 表源 URL（用户提交的原始地址）。 */
  url: string;
  /** 添加请求 id，关联 D1 里的抓取结果与状态。 */
  requestId: string;
  /** 输出目录（工作流上传的根）。 */
  outDir: string;
  /** 添加者 GitHub 登录名；仅记录在失败状态里，便于排查。 */
  author?: string | undefined;
  timeoutMs?: number | undefined;
  /** 内部接口基址与 token（缺省走环境变量，测试可注入）。 */
  apiBase?: string | undefined;
  apiToken?: string | undefined;
}

export interface FetchOnceResult {
  state: "done" | "failed";
  dirName?: string | undefined;
  message?: string | undefined;
}

/** 回写抓取结果与状态：done 需要目录名与表名，failed 只带消息。 */
async function reportResult(
  options: FetchOnceOptions,
  payload: {
    state: "done" | "failed";
    dirName?: string | undefined;
    name?: string | undefined;
    symbol?: string | undefined;
    message?: string | undefined;
  }
): Promise<void> {
  await callInternal("/api/internal/fetch-result", {
    method: "POST",
    body: {
      requestId: options.requestId,
      url: options.url,
      state: payload.state,
      ...(payload.dirName === undefined ? {} : { dir_name: payload.dirName }),
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.symbol === undefined ? {} : { symbol: payload.symbol }),
      ...(payload.message === undefined ? {} : { message: payload.message }),
    },
    ...(options.apiBase === undefined ? {} : { base: options.apiBase }),
    ...(options.apiToken === undefined ? {} : { token: options.apiToken }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
}

/** 失败状态里的消息：带上提交者便于排查。 */
function failureMessage(options: FetchOnceOptions, message: string): string {
  return options.author === undefined ? message : `提交者 ${options.author}：${message}`;
}

/** 抓取单张表：数据目录写入 out/，结果与状态写进 D1。 */
export async function fetchTableOnce(options: FetchOnceOptions): Promise<FetchOnceResult> {
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

    // 先落数据再回写状态：状态写入失败时异常会被下面的 catch 接住，
    // 那时 result.json 记为 failed，工作流不会上传这份目录。
    await reportResult(options, {
      state: "done",
      dirName,
      name: updated.name,
      symbol: updated.symbol,
    });
    return { state: "done", dirName };
  } catch (error) {
    const message = describeError(error);
    try {
      await reportResult(options, { state: "failed", message: failureMessage(options, message) });
    } catch (reportError) {
      // 状态回写失败不改变抓取结论：数据目录未产出，工作流据 result.json 判断
      console.error(`状态回写失败：${describeError(reportError)}`);
    }
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
    // 状态已经写进 D1；这里不置非零退出码，工作流据 result.json 判断后续动作
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
