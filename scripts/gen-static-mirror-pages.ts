/**
 * 构建期为静态宿主（GitHub Pages / Codeberg Pages）生成镜像表页面与站点清单。
 *
 * 清单来源是主站的 `/bms/table/mirror/tables.json`——它已由 Worker 合成用户增删
 * 与保护标记。静态宿主与主站展示同一份清单，合成逻辑只存在于 Worker 一处；
 * 本脚本负责把 url 字段重写为自己域名并产出等价页面（与 Worker 共用
 * `packages/mirror/src/` 的注入与序列化函数，保证输出逐字节一致）。清单拉取失败即
 * 整步失败，避免用缺页产物覆盖上一版仍可用的静态站点。
 *
 * 用法：
 *   node scripts/gen-static-mirror-pages.ts --target=github-pages [--build-dir=build-static]
 *   node scripts/gen-static-mirror-pages.ts --site-base=https://example.com   # 显式覆盖（本地演练用）
 *
 * `--manifest-base=https://…` 可覆盖清单来源基址，缺省取 config/site.json 的 origin。
 *
 * 注意：脚本不再读仓库内快照，构建机需要能访问主站（清单合成与用户层都在
 * 主站侧），这是 2026-09 的显式取舍。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  injectBmstableMeta,
  serializeSiteTableList,
  transformTableList,
} from "@brightmeows/mirror/manifest";
import type { MirrorTableItem } from "@brightmeows/mirror/types";
import { normalizeBase, r2TableHeaderUrl } from "@brightmeows/mirror/urls";

import { CONFIG_PATH, findStaticTarget, readSiteConfig } from "./site-config.ts";

/** 站点 SPA 外壳在构建产物里的路径（adapter-static 的 fallback）。 */
const SITE_SHELL_PATH = "404.html";
/** 镜像表页面与站点清单在构建产物里的目录。 */
const MIRROR_DIR = path.join("bms", "table", "mirror");
/** 主站站点清单路径。 */
const SITE_LIST_PATH = "/bms/table/mirror/tables.json";

/** 各静态目标的域配置提交物：GitHub Pages 的 CNAME 与 Codeberg Pages 的 .domains。 */
const DOMAIN_FILE_BY_TARGET: Record<string, string> = {
  "github-pages": "CNAME",
  "codeberg-pages": ".domains",
};

export interface GenerateOptions {
  /** 清单来源基址（主站 origin）。 */
  manifestBase: string;
  /** 构建产物根目录。 */
  buildDir: string;
  /** R2 基址，用于拼每张表的 header.json 绝对地址。 */
  r2Base: string;
  /** 本目标的站点基址，用于生成清单里的 url 字段。 */
  siteBase: string;
  fetchImpl?: typeof fetch | undefined;
}

export interface GenerateResult {
  /** 生成的镜像页数量。 */
  pages: number;
  /** 站点清单路径（相对构建产物根目录）。 */
  listPath: string;
}

/**
 * 拉取主站站点清单。条目里的 `url` 指向主站、`url_from` 是原始源地址；
 * 生成前把 url 还原为源地址，交由 transformTableList 按本目标域名重写。
 */
export async function fetchSiteTableList(
  manifestBase: string,
  fetchImpl: typeof fetch = fetch
): Promise<MirrorTableItem[]> {
  const url = `${normalizeBase(manifestBase)}${SITE_LIST_PATH}`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`拉取主站清单失败：${url} 返回 ${response.status}`);
  }
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error(`主站清单不是数组：${url}`);
  }
  return parsed as MirrorTableItem[];
}

export interface StaticGenerateOptions {
  buildDir: string;
  r2Base: string;
  siteBase: string;
}

/**
 * 按清单生成镜像页与站点清单。
 * 写入位置：`<buildDir>/bms/table/mirror/<dir_name>/index.html` 与 `.../tables.json`。
 */
export function generateStaticMirrorPages(
  list: readonly MirrorTableItem[],
  options: StaticGenerateOptions
): GenerateResult {
  const shellPath = path.join(options.buildDir, SITE_SHELL_PATH);
  if (!existsSync(shellPath)) {
    throw new Error(`构建产物里找不到 SPA 外壳：${shellPath}（先跑 pnpm build）`);
  }
  const shell = readFileSync(shellPath, "utf8");
  const mirrorDir = path.join(options.buildDir, MIRROR_DIR);
  const remapped = list.map((item) => ({ ...item, url: item.url_from ?? item.url }));

  for (const item of remapped) {
    const dirName = item.dir_name;
    if (typeof dirName !== "string" || dirName.trim() === "") {
      throw new Error(`清单条目缺少 dir_name：${item.name ?? "(未命名)"}`);
    }
    const page = injectBmstableMeta(shell, r2TableHeaderUrl(options.r2Base, dirName));
    const target = path.join(mirrorDir, dirName, "index.html");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, page);
  }

  mkdirSync(mirrorDir, { recursive: true });
  const listPath = path.join(MIRROR_DIR, "tables.json");
  writeFileSync(
    path.join(options.buildDir, listPath),
    serializeSiteTableList(transformTableList(remapped, options.siteBase))
  );

  return { pages: list.length, listPath: listPath.split(path.sep).join("/") };
}

function parseArgs(argv: string[]): {
  target?: string;
  siteBase?: string;
  manifestBase?: string;
  buildDir?: string;
  configPath?: string;
} {
  const result: {
    target?: string;
    siteBase?: string;
    manifestBase?: string;
    buildDir?: string;
    configPath?: string;
  } = {};
  for (const arg of argv) {
    if (arg.startsWith("--target=")) {
      result.target = arg.slice("--target=".length);
    } else if (arg.startsWith("--site-base=")) {
      result.siteBase = arg.slice("--site-base=".length);
    } else if (arg.startsWith("--manifest-base=")) {
      result.manifestBase = arg.slice("--manifest-base=".length);
    } else if (arg.startsWith("--build-dir=")) {
      result.buildDir = arg.slice("--build-dir=".length);
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
  const configPath = args.configPath ?? CONFIG_PATH;
  const config = readSiteConfig(configPath);

  // 站点基址来自配置里的目标；--site-base 仅用于本地演练覆盖
  if (!args.target && !args.siteBase) {
    const names = config.targets.map((target) => target.name).join("、");
    throw new Error(`必须提供 --target=<名称>（可选：${names}）或 --site-base=https://…`);
  }
  const siteBase = args.siteBase ?? findStaticTarget(config, args.target ?? "").siteBase;
  const manifestBase = args.manifestBase ?? config.origin;

  // 域配置提交物（内容 = 自定义子域 host）：域名从配置派生，不在仓库里维护副本。
  // --site-base 覆盖（本地演练）时无 target，跳过。
  const buildDir = args.buildDir ?? path.join(repoRoot, "build-static");
  if (args.target !== undefined) {
    const domainFile = DOMAIN_FILE_BY_TARGET[args.target];
    if (domainFile !== undefined) {
      const host = new URL(siteBase).host;
      writeFileSync(path.join(buildDir, domainFile), `${host}\n`);
    }
  }

  const list = await fetchSiteTableList(manifestBase);
  const result = generateStaticMirrorPages(list, {
    buildDir,
    r2Base: config.r2.base,
    siteBase,
  });

  console.log(`清单来源：${normalizeBase(manifestBase)}${SITE_LIST_PATH}（${list.length} 张表）`);
  console.log(
    `站点基址：${siteBase}${args.target ? `（目标 ${args.target}）` : "（--site-base 覆盖）"}`
  );
  if (args.target !== undefined && DOMAIN_FILE_BY_TARGET[args.target] !== undefined) {
    console.log(`域配置提交物：${DOMAIN_FILE_BY_TARGET[args.target]}`);
  }
  console.log(`镜像页：${result.pages} 个`);
  console.log(`站点清单：${result.listPath}`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
