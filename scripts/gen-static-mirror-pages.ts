/**
 * 构建期为静态宿主（GitHub Pages / Codeberg Pages）生成镜像表页面与站点清单。
 *
 * 完全离线：只读仓库内快照（`src/lib/mirror/table-manifest.json`）与构建产物里的
 * SPA 外壳（`build/404.html`），产出与 Cloudflare Worker 运行时等价的页面——两处
 * 共用 `src/lib/mirror/manifest.ts` 里的注入与序列化函数，保证输出一致。
 *
 * 用法：
 *   node scripts/gen-static-mirror-pages.ts --site-base=https://brightmeows.github.io [--build-dir=build]
 *
 * 清单地址会发布在该目标的同源路径 `/bms/table/mirror/tables.json` 上，因此
 * `url` 字段按 `--site-base` 生成；快照本身是 origin 无关的原始清单。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  injectBmstableMeta,
  serializeSiteTableList,
  transformTableList,
} from "../src/lib/mirror/manifest.ts";
import { r2TableHeaderUrl } from "../src/lib/mirror/urls.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

/** 站点 SPA 外壳在构建产物里的路径（adapter-static 的 fallback）。 */
const SITE_SHELL_PATH = "404.html";
/** 镜像表页面与站点清单在构建产物里的目录。 */
const MIRROR_DIR = path.join("bms", "table", "mirror");

export interface GenerateOptions {
  /** 快照路径（origin 无关的原始清单）。 */
  snapshotPath: string;
  /** 构建产物根目录。 */
  buildDir: string;
  /** R2 基址，用于拼每张表的 header.json 绝对地址。 */
  r2Base: string;
  /** 本目标的站点基址，用于生成清单里的 url 字段。 */
  siteBase: string;
}

export interface GenerateResult {
  /** 生成的镜像页数量。 */
  pages: number;
  /** 站点清单路径（相对构建产物根目录）。 */
  listPath: string;
}

/** 读取快照并校验为非空数组。 */
export function readSnapshot(snapshotPath: string): MirrorTableItem[] {
  if (!existsSync(snapshotPath)) {
    throw new Error(`清单快照不存在：${snapshotPath}（先跑 scripts/sync-mirror-manifest.ts）`);
  }
  const parsed: unknown = JSON.parse(readFileSync(snapshotPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`清单快照不是数组：${snapshotPath}`);
  }
  return parsed as MirrorTableItem[];
}

/**
 * 按快照生成镜像页与站点清单。
 * 写入位置：`<buildDir>/bms/table/mirror/<dir_name>/index.html` 与 `.../tables.json`。
 */
export function generateStaticMirrorPages(options: GenerateOptions): GenerateResult {
  const list = readSnapshot(options.snapshotPath);
  const shellPath = path.join(options.buildDir, SITE_SHELL_PATH);
  if (!existsSync(shellPath)) {
    throw new Error(`构建产物里找不到 SPA 外壳：${shellPath}（先跑 pnpm build）`);
  }
  const shell = readFileSync(shellPath, "utf8");
  const mirrorDir = path.join(options.buildDir, MIRROR_DIR);

  for (const item of list) {
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
    serializeSiteTableList(transformTableList(list, options.siteBase))
  );

  return { pages: list.length, listPath: listPath.split(path.sep).join("/") };
}

function parseArgs(argv: string[]): {
  siteBase?: string;
  buildDir?: string;
  snapshotPath?: string;
  configPath?: string;
} {
  const result: {
    siteBase?: string;
    buildDir?: string;
    snapshotPath?: string;
    configPath?: string;
  } = {};
  for (const arg of argv) {
    if (arg.startsWith("--site-base=")) {
      result.siteBase = arg.slice("--site-base=".length);
    } else if (arg.startsWith("--build-dir=")) {
      result.buildDir = arg.slice("--build-dir=".length);
    } else if (arg.startsWith("--snapshot=")) {
      result.snapshotPath = arg.slice("--snapshot=".length);
    } else if (arg.startsWith("--config=")) {
      result.configPath = arg.slice("--config=".length);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

function main(argv: string[]): void {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = parseArgs(argv);
  const siteBase = args.siteBase;
  if (!siteBase || !/^https?:\/\//.test(siteBase)) {
    throw new Error("必须提供 --site-base=https://…（用于生成清单里的 url 字段）");
  }
  const configPath = args.configPath ?? path.join(repoRoot, "config", "mirror.json");
  const { r2Base } = JSON.parse(readFileSync(configPath, "utf8")) as { r2Base: string };

  const result = generateStaticMirrorPages({
    snapshotPath:
      args.snapshotPath ?? path.join(repoRoot, "src", "lib", "mirror", "table-manifest.json"),
    buildDir: args.buildDir ?? path.join(repoRoot, "build"),
    r2Base,
    siteBase,
  });

  console.log(`站点基址：${siteBase}`);
  console.log(`镜像页：${result.pages} 个`);
  console.log(`站点清单：${result.listPath}`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
