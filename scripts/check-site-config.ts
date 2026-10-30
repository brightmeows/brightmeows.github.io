/**
 * 离线一致性校验：把“不能 import 配置”的消费者钉在 `config/site.json` 上。
 *
 * 七条断言，每条都是纯函数（输入为文本），便于单测：
 * 1. 工作流里的 `--target=<名>` 必须存在于配置且是跳转目标
 * 2. `wrangler.jsonc` 的 routes 主机必须 ⊆ cloudflare 目标的 hosts
 * 3. 工作流文件里不得出现配置中的任何域名（域名一律由 `--target` 解析）
 * 4. `r2.corsOrigins` 必须覆盖 `origin`（跳转目标不再直接读 R2）
 * 5. `.nvmrc` 存在，`package.json` 的 `devEngines.packageManager` 声明 pnpm 版本范围，
 *    且工作流不显式传 pnpm 版本；node 版本通过文件读取（不能读文件的平台允许写
 *    字面量，但必须与 `.nvmrc` 相同）
 * 6. `wrangler.jsonc` 的 `vars` 与 `r2.base`/`r2.manifestObject` 一致，且不引入
 *    配置之外的键（Worker 从 env 读这两个值，这里是它们的守门）
 * 7. 跳转目标的 `siteBase` 主机必须是 `<name>.<主站 host>`：子域名与 target 名
 *    对齐是机械规则，断言守住“名字即事实”
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
    for (;;) {
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

/** 断言 1：`--target=` 必须指向配置里存在的跳转目标。 */
export function targetFlagIssues(flags: string[], config: SiteConfig): string[] {
  const redirectNames = new Set(
    config.targets.filter((target) => target.kind === "redirect").map((target) => target.name)
  );
  return flags
    .filter((flag) => !redirectNames.has(flag))
    .map(
      (flag) =>
        `工作流里的 --target=${flag} 不是配置中的跳转目标（可选：${[...redirectNames].join("、")}）`
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

/** 断言 4：corsOrigins 覆盖 origin。 */
export function corsCoverageIssues(config: SiteConfig): string[] {
  const required = [config.origin];
  const origins = new Set(config.r2.corsOrigins);
  return required
    .filter((origin) => !origins.has(origin))
    .map((origin) => `r2.corsOrigins 缺少 ${origin}：该来源无法从浏览器读取 R2 数据`);
}

/** 断言 5：版本来源唯一（`.nvmrc` + `devEngines.packageManager`）。 */
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
  const root =
    typeof args.packageJson === "object" && args.packageJson !== null
      ? (args.packageJson as Record<string, unknown>)
      : {};
  const devEngines = root.devEngines as { packageManager?: unknown } | undefined;
  const manager =
    typeof devEngines?.packageManager === "object" && devEngines.packageManager !== null
      ? (devEngines.packageManager as { name?: unknown; version?: unknown })
      : undefined;
  if (manager === undefined || manager.name !== "pnpm" || typeof manager.version !== "string") {
    issues.push(
      "package.json 缺少 devEngines.packageManager（name 为 pnpm、version 为范围）：pnpm 版本没有单一来源"
    );
  } else if (/^\d+\.\d+\.\d+$/u.test(manager.version.trim())) {
    issues.push(
      `devEngines.packageManager 锁死了单点版本 ${manager.version}：应声明范围（如 >=11.25.0 <12.0.0）`
    );
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
    // pnpm/action-setup 不得显式传 version：否则 pnpm 版本出现第二处来源
    const lines = file.text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!/uses:\s*pnpm\/action-setup/u.test(lines[i] ?? "")) continue;
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j] ?? "";
        if (/^\s*-\s/u.test(line)) break;
        if (/^\s*version:/u.test(line)) {
          issues.push(
            `${file.path} 给 pnpm/action-setup 传了 version：pnpm 版本来源应唯一（devEngines.packageManager）`
          );
          break;
        }
      }
    }
  }
  return issues;
}

/**
 * 断言 6：`wrangler.jsonc` 的 `vars` 与配置的 r2 字段一致，且键集受控。
 *
 * Worker 不再 import `config/site.json`（改从 env 读 `R2_BASE` 与 `R2_MANIFEST_OBJECT`），
 * 这两个值的一致性只能靠断言守：值要一致，键集也不得超出配置管理的范围。
 *
 */
export function wranglerVarsIssues(args: { config: SiteConfig; wranglerText: string }): string[] {
  const match = /"vars"\s*:\s*\{([^}]*)\}/u.exec(args.wranglerText);
  if (match?.[1] === undefined) {
    return ["wrangler.jsonc 里找不到 vars 块：Worker 的 R2 基址与清单对象键没有单一来源"];
  }
  const entries = new Map<string, string>();
  for (const item of match[1].matchAll(/"([A-Za-z0-9_]+)"\s*:\s*"([^"]*)"/gu)) {
    entries.set(item[1] ?? "", item[2] ?? "");
  }
  const issues: string[] = [];
  const expected: [string, string][] = [
    ["R2_BASE", args.config.r2.base],
    ["R2_MANIFEST_OBJECT", args.config.r2.manifestObject],
  ];
  for (const [key, value] of expected) {
    const actual = entries.get(key);
    if (actual === undefined) {
      issues.push(`wrangler.jsonc 的 vars 缺少 ${key}`);
    } else if (actual !== value) {
      issues.push(`wrangler.jsonc 的 vars.${key} 与 config/site.json 不一致（应为 ${value}）`);
    }
  }

  for (const key of entries.keys()) {
    if (!["R2_BASE", "R2_MANIFEST_OBJECT"].includes(key)) {
      issues.push(`wrangler.jsonc 的 vars 出现未受配置管理的键 ${key}`);
    }
  }
  return issues;
}

/**
 * 断言 7：跳转目标的 siteBase 主机必须是 `<name>.<主站 host>`。
 *
 * 子域名与 target 名对齐是机械规则：名字即事实，Worker 的 Origin 白名单、
 * 会话 cookie 的 Domain、CORS 配置都依赖这条规则的可推导性。
 */
export function redirectSiteBaseIssues(config: SiteConfig): string[] {
  const mainHost = new URL(config.origin).host;
  return config.targets
    .filter((target) => target.kind === "redirect")
    .map((target) => {
      const expectedHost = `${target.name}.${mainHost}`;
      return new URL(target.siteBase).host === expectedHost
        ? null
        : `跳转目标 ${target.name} 的 siteBase 主机应为 ${expectedHost}（与 target 名对齐），实际是 ${new URL(target.siteBase).host}`;
    })
    .filter((issue): issue is string => issue !== null);
}

/** 配置里出现过的全部域名（用于断言 3 的扫描列表；含跳转目标的原域与 git-pages 服务主机）。 */
export function collectDomains(config: SiteConfig): string[] {
  const hostOf = (url: string): string => new URL(url).host;
  return [
    ...new Set([
      hostOf(config.origin),
      hostOf(config.r2.base),
      ...config.targets.flatMap((target) =>
        target.kind === "redirect"
          ? [
              hostOf(target.siteBase),
              ...target.legacyHosts,
              ...(target.pagesServer === undefined ? [] : [target.pagesServer]),
            ]
          : target.hosts
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
  const wranglerText = read(repoRoot, "wrangler.jsonc");
  const issues: string[] = [
    ...targetFlagIssues(collectTargetFlags(allWorkflowText), config),
    ...routeHostIssues(wranglerRouteHosts(wranglerText), config),
    ...wranglerVarsIssues({ config, wranglerText }),
    ...redirectSiteBaseIssues(config),
    ...hardcodedDomainIssues(workflowFiles, config),
    ...corsCoverageIssues(config),
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
