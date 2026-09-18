import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  mirrorTableAbsoluteUrl,
  normalizeBase,
  r2TableHeaderUrl,
  viewerPath,
} from "../src/lib/mirror/urls.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

/** 生成物标记：清理过期目录时只删除带此标记的 index.html。 */
export const GENERATED_MARKER = "<!-- generated-by: gen-mirror-pages -->";

export interface MirrorConfig {
  r2Base: string;
  siteBase: string;
}

export interface ExistingStubDir {
  name: string;
  generated: boolean;
}

export interface GenerationOptions {
  inputPath: string;
  mirrorDir: string;
  r2Base: string;
  siteBase: string;
  /** 只检查不写入；存在待应用变更时 changed 非空。 */
  check?: boolean;
}

export interface GenerationResult {
  /** 本次写入、更新或删除的相对路径，排序稳定。 */
  changed: string[];
  /** 存在但非本工具生成、因此未清理的目录。 */
  skipped: string[];
}

export function readMirrorConfig(configPath: string): MirrorConfig {
  const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`共享配置不是对象：${configPath}`);
  }
  const record = parsed as Record<string, unknown>;
  const { r2Base, siteBase } = record;
  if (typeof r2Base !== "string" || !/^https?:\/\//.test(r2Base)) {
    throw new Error(`共享配置 r2Base 不是 http(s) 地址：${configPath}`);
  }
  if (typeof siteBase !== "string" || !/^https?:\/\//.test(siteBase)) {
    throw new Error(`共享配置 siteBase 不是 http(s) 地址：${configPath}`);
  }
  return { r2Base: normalizeBase(r2Base), siteBase: normalizeBase(siteBase) };
}

/** 站点清单条目的运行期保证：dir_name/url/url_from 均已填充。 */
export type TransformedTableItem = MirrorTableItem &
  Required<Pick<MirrorTableItem, "dir_name" | "url" | "url_from">>;

/**
 * 将 R2 清单变换为站点清单：保留原字段，写入 url_from 与镜像页绝对 URL。
 * dir_name 直接取清单字段（与 R2 目录名一致），缺失即失败。
 */
export function transformTableList(
  list: MirrorTableItem[],
  siteBase: string
): TransformedTableItem[] {
  return list.map((item) => {
    const dirName = item.dir_name;
    if (typeof dirName !== "string" || dirName.trim() === "") {
      throw new Error(`清单条目缺少 dir_name：${item.name ?? "(未命名)"}`);
    }
    return {
      ...item,
      url_from: item.url,
      dir_name: dirName,
      url: mirrorTableAbsoluteUrl(siteBase, dirName),
    };
  });
}

/** 站点清单的稳定序列化（2 空格缩进 + 尾换行）。 */
export function serializeTableList(list: MirrorTableItem[]): string {
  return `${JSON.stringify(list, null, 2)}\n`;
}

/** 渲染单表 stub：携带 bmstable meta，并在浏览器中跳转到 viewer。 */
export function renderStub(tableId: string, headerUrl: string): string {
  const jsViewerTarget = JSON.stringify(viewerPath(tableId)).replaceAll("<", "\\u003c");
  const htmlHeaderUrl = headerUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const htmlViewerTarget = viewerPath(tableId)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="bmstable" content="${htmlHeaderUrl}" />
    <meta name="robots" content="noindex" />
    <title>BMS 难度表镜像</title>
    ${GENERATED_MARKER}
    <script>location.replace(${jsViewerTarget});</script>
  </head>
  <body>
    <p><a href="${htmlViewerTarget}">打开难度表</a></p>
  </body>
</html>
`;
}

/** 计算需要清理的过期 stub 目录；非本工具生成的目录只报告不删除。 */
export function planStubCleanup(
  existing: ExistingStubDir[],
  desiredIds: string[]
): { stale: string[]; skipped: string[] } {
  const desired = new Set(desiredIds);
  const stale: string[] = [];
  const skipped: string[] = [];
  for (const dir of existing) {
    if (desired.has(dir.name)) continue;
    (dir.generated ? stale : skipped).push(dir.name);
  }
  return { stale: stale.sort(), skipped: skipped.sort() };
}

function collectExistingStubs(mirrorDir: string): ExistingStubDir[] {
  if (!existsSync(mirrorDir)) return [];
  return readdirSync(mirrorDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const indexPath = path.join(mirrorDir, entry.name, "index.html");
      const generated =
        existsSync(indexPath) && readFileSync(indexPath, "utf8").includes(GENERATED_MARKER);
      return { name: entry.name, generated };
    });
}

function writeIfChanged(
  filePath: string,
  content: string,
  check: boolean,
  changed: string[],
  relativePath: string
): void {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  if (existing === content) return;
  changed.push(relativePath);
  if (check) return;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

/**
 * 按清单生成全部 stub 与站点清单，并清理过期 stub。
 * 输出字节稳定：同一输入重复运行不产生变更。
 */
export function runGeneration(options: GenerationOptions): GenerationResult {
  const check = options.check ?? false;
  const parsed: unknown = JSON.parse(readFileSync(options.inputPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`清单不是数组：${options.inputPath}`);
  }
  const list = parsed as MirrorTableItem[];
  const transformed = transformTableList(list, options.siteBase);

  const changed: string[] = [];
  for (const item of transformed) {
    const dirName = item.dir_name;
    const stubPath = path.join(options.mirrorDir, dirName, "index.html");
    const stub = renderStub(dirName, r2TableHeaderUrl(options.r2Base, dirName));
    writeIfChanged(stubPath, stub, check, changed, `${dirName}/index.html`);
  }

  const listContent = serializeTableList(transformed);
  writeIfChanged(
    path.join(options.mirrorDir, "tables.json"),
    listContent,
    check,
    changed,
    "tables.json"
  );

  const desiredIds = transformed.map((item) => item.dir_name);
  const { stale, skipped } = planStubCleanup(collectExistingStubs(options.mirrorDir), desiredIds);
  for (const dirName of stale) {
    changed.push(`${dirName}/`);
    if (!check) {
      rmSync(path.join(options.mirrorDir, dirName), { recursive: true, force: true });
    }
  }

  return { changed: changed.sort(), skipped };
}

function parseArgs(argv: string[]): {
  input?: string;
  mirrorDir?: string;
  configPath?: string;
  check: boolean;
} {
  const result: { input?: string; mirrorDir?: string; configPath?: string; check: boolean } = {
    check: false,
  };
  for (const arg of argv) {
    if (arg === "--check") {
      result.check = true;
    } else if (arg.startsWith("--input=")) {
      result.input = arg.slice("--input=".length);
    } else if (arg.startsWith("--mirror-dir=")) {
      result.mirrorDir = arg.slice("--mirror-dir=".length);
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
  const configPath = args.configPath ?? path.join(repoRoot, "config", "mirror.json");
  const inputPath = args.input ?? path.join(repoRoot, "tables", "tables.json");
  const mirrorDir = args.mirrorDir ?? path.join(repoRoot, "static", "bms", "table", "mirror");

  const config = readMirrorConfig(configPath);
  const result = runGeneration({
    inputPath,
    mirrorDir,
    r2Base: config.r2Base,
    siteBase: config.siteBase,
    check: args.check,
  });

  console.log(`输入：${inputPath}`);
  console.log(`输出：${mirrorDir}`);
  console.log(`变更：${result.changed.length} 项${args.check ? "（检查模式，未写入）" : ""}`);
  for (const item of result.changed) {
    console.log(`  ${item}`);
  }
  if (result.skipped.length > 0) {
    console.warn(`跳过 ${result.skipped.length} 个非生成目录：${result.skipped.join("、")}`);
  }
  if (args.check && result.changed.length > 0) {
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2));
}
