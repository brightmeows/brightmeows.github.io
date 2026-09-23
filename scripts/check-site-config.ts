/**
 * 离线一致性校验：把「不能 import 配置」的消费者钉在 `config/site.json` 上。
 *
 * 六条断言，每条都是纯函数（输入为文本），便于单测：
 * 1. 工作流里的 `--target=<名>` 必须存在于配置且是静态目标
 * 2. `wrangler.jsonc` 的 routes 主机必须 ⊆ cloudflare 目标的 hosts
 * 3. 工作流文件里不得出现配置中的任何域名（域名一律由 `--target` 解析）
 * 4. `r2.corsOrigins` 必须覆盖 `origin` 与所有静态目标的 `siteBase`
 * 5. update-tables 写出的基线文件名必须等于 `r2.baselineObject` 的 basename
 *    （rclone copy 保留本地文件名，名字不一致会把对象写到错的键上）
 * 6. `.nvmrc` 与 `package.json` 的 `packageManager` 存在，且工作流通过文件读取版本
 *    （不能读文件的平台允许写字面量，但必须与 `.nvmrc` 相同）
 *
 * 纯读、不联网、毫秒级，进 pre-commit 与 CI。用法：`node scripts/check-site-config.ts`
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONFIG_PATH, readSiteConfig, type SiteConfig } from "./site-config.ts";

/** 收集工作流文本里所有 `--target=<名>`。 */
export function collectTargetFlags(text: string): string[] {
  return [...text.matchAll(/--target=([A-Za-z0-9._-]+)/g)].map((match) => match[1] ?? "");
}

/**
 * 从 wrangler.jsonc 提取 routes 的主机名。
 * 用正则而不是 JSON 解析：该文件带注释与尾逗号（JSONC），而 routes 里的键只有
 * `pattern`/`custom_domain`，`pattern` 在整份文件里唯一。
 */
export function wranglerRouteHosts(text: string): string[] {
  return [...text.matchAll(/"pattern"\s*:\s*"([^"]+)"/g)].map((match) =>
    (match[1] ?? "").replace(/\/\*$/, "").replace(/\/$/, "")
  );
}

/**
 * 在文本里找出任意出现过的域名（配置里的域名都不该出现在工作流里）。
 *
 * 例外：仓库自身的远程地址形如 `git@github.com:owner/brightmeows.github.io.git`，
 * 其中包含 `brightmeows.github.io`（仓库名恰好等于 GitHub Pages 的默认域名），
 * 这不是硬编码域名，跳过。
 */
export function findDomainsInText(text: string, domains: string[]): string[] {
  const hits: string[] = [];
  for (const domain of domains) {
    let from = 0;
    while (true) {
      const index = text.indexOf(domain, from);
      if (index === -1) break;
      from = index + domain.length;
      const before = text.slice(Math.max(0, index - 24), index);
      if (/github\.com[:/][^\s]*$/.test(before)) continue;
      hits.push(domain);
      break;
    }
  }
  return hits;
}

/** 断言 1：`--target=` 必须指向配置里存在的静态目标。 */
export function targetFlagIssues(flags: string[], config: SiteConfig): string[] {
  const staticNames = new Set(
    config.targets.filter((target) => target.kind === "static").map((target) => target.name)
  );
  return flags
    .filter((flag) => !staticNames.has(flag))
    .map(
      (flag) =>
        `工作流里的 --target=${flag} 不是配置中的静态目标（可选：${[...staticNames].join("、")}）`
    );
}

/** 断言 2：wrangler routes 主机必须都在 cloudflare 目标的 hosts 里。 */
export function routeHostIssues(hosts: string[], config: SiteConfig): string[] {
  const worker = config.targets.find((target) => target.kind === "worker");
  if (!worker) return ["配置里没有 kind=worker 的目标，无法核对 wrangler.jsonc 的 routes"];
  const allowed = new Set(worker.hosts);
  return hosts
    .filter((host) => !allowed.has(host))
    .map((host) => `wrangler.jsonc 的 route 主机 ${host} 不在配置的 ${worker.name}.hosts 里`);
}

/** 断言 3：工作流文本里不得出现配置中的域名。 */
export function hardcodedDomainIssues(
  files: { path: string; text: string }[],
  config: SiteConfig
): string[] {
  const domains = collectDomains(config);
  const issues: string[] = [];
  for (const file of files) {
    for (const domain of findDomainsInText(file.text, domains)) {
      issues.push(`${file.path} 里出现域名 ${domain}：工作流不应硬编码域名，请改用 --target`);
    }
  }
  return issues;
}

/** 断言 4：corsOrigins 覆盖 origin 与所有静态目标的 siteBase。 */
export function corsCoverageIssues(config: SiteConfig): string[] {
  const required = [
    config.origin,
    ...config.targets.filter((target) => target.kind === "static").map((target) => target.siteBase),
  ];
  const origins = new Set(config.r2.corsOrigins);
  return required
    .filter((origin) => !origins.has(origin))
    .map((origin) => `r2.corsOrigins 缺少 ${origin}：该来源无法从浏览器读取 R2 数据`);
}

/**
 * 断言 5：基线文件名与配置的对象键 basename 一致。
 * rclone copy 保留本地文件名，若工作流写出的名字与 `r2.baselineObject` 不符，
 * 对象会被写到另一个键上，下次读取仍视为「首次运行」而重复触发下游重建。
 */
export function baselineFileNameIssues(args: {
  config: SiteConfig;
  updateTablesText: string;
}): string[] {
  // 文件名限定为字词、点与横线：工作流里该参数常出现在 $(...) 命令替换中
  const match = /--out=\.\/([\w.-]+)/u.exec(args.updateTablesText);
  if (match?.[1] === undefined) {
    return ["update-tables.yml 里找不到 --out=./<基线文件名>"];
  }
  const expected = path.posix.basename(args.config.r2.baselineObject);
  return match[1] === expected
    ? []
    : [
        `update-tables.yml 写出的基线文件名 ${match[1]} 与 r2.baselineObject 的 basename 不一致（应为 ${expected}）`,
      ];
}

/** 断言 6：版本来源唯一（`.nvmrc` + `packageManager`）。 */
export function versionSourceIssues(args: {
  nvmrc: string | null;
  packageJson: unknown;
  workflowFiles: { path: string; text: string }[];
}): string[] {
  const issues: string[] = [];
  const pinned = args.nvmrc?.trim() ?? "";
  if (pinned === "") {
    issues.push("缺少 .nvmrc：node 版本没有单一来源");
  }
  const manager =
    typeof args.packageJson === "object" && args.packageJson !== null
      ? (args.packageJson as Record<string, unknown>).packageManager
      : undefined;
  if (typeof manager !== "string" || !manager.startsWith("pnpm@")) {
    issues.push("package.json 缺少 packageManager（pnpm@<版本>）：pnpm 版本没有单一来源");
  }
  for (const file of args.workflowFiles) {
    for (const match of file.text.matchAll(/node-version(-file)?:\s*(\S+)/g)) {
      const [, suffix, value] = match;
      if (suffix === "-file") {
        if (value !== ".nvmrc") {
          issues.push(`${file.path} 的 node-version-file 指向 ${value}，应为 .nvmrc`);
        }
        continue;
      }
      if (value !== pinned) {
        issues.push(
          `${file.path} 写了字面量 node-version: ${value}，与 .nvmrc 的 ${pinned} 不一致（应改用 node-version-file）`
        );
      }
    }
  }
  return issues;
}

/** 配置里出现过的全部域名（用于断言 3 的扫描列表）。 */
export function collectDomains(config: SiteConfig): string[] {
  const hostOf = (url: string): string => new URL(url).host;
  return [
    ...new Set([
      hostOf(config.origin),
      hostOf(config.r2.base),
      ...config.targets.flatMap((target) =>
        target.kind === "static" ? [hostOf(target.siteBase)] : target.hosts
      ),
    ]),
  ];
}

function listWorkflowFiles(repoRoot: string): string[] {
  const dirs = [path.join(".github", "workflows"), path.join(".forgejo", "workflows")];
  return dirs.flatMap((dir) => {
    const absolute = path.join(repoRoot, dir);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute)
      .filter((name) => name.endsWith(".yml"))
      .map((name) => path.join(dir, name));
  });
}

function read(repoRoot: string, relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function readJson(repoRoot: string, relative: string): unknown {
  return JSON.parse(read(repoRoot, relative));
}

function main(): void {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const config = readSiteConfig(CONFIG_PATH);
  const workflowFiles = listWorkflowFiles(repoRoot).map((file) => ({
    path: file,
    text: read(repoRoot, file),
  }));
  const allWorkflowText = workflowFiles.map((file) => file.text).join("\n");

  const nvmrcPath = path.join(repoRoot, ".nvmrc");
  const issues: string[] = [
    ...targetFlagIssues(collectTargetFlags(allWorkflowText), config),
    ...routeHostIssues(wranglerRouteHosts(read(repoRoot, "wrangler.jsonc")), config),
    ...hardcodedDomainIssues(workflowFiles, config),
    ...corsCoverageIssues(config),
    ...baselineFileNameIssues({
      config,
      updateTablesText: read(repoRoot, path.join(".github", "workflows", "update-tables.yml")),
    }),
    ...versionSourceIssues({
      nvmrc: existsSync(nvmrcPath) ? readFileSync(nvmrcPath, "utf8") : null,
      packageJson: readJson(repoRoot, "package.json"),
      workflowFiles,
    }),
  ];

  if (issues.length === 0) {
    console.log(`配置一致性校验通过（${workflowFiles.length} 个工作流文件）`);
    return;
  }
  console.error(`配置一致性校验失败，共 ${issues.length} 处：`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
