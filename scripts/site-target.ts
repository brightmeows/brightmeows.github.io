/**
 * 打印某个静态目标的相关地址，供工作流把域名从 YAML 里彻底移出。
 *
 * 用法：
 *   node scripts/site-target.ts --target=codeberg-pages               # 站点基址（带尾斜杠）
 *   node scripts/site-target.ts --target=codeberg-pages --legacy-base # 平台原域（带尾斜杠）
 *   node scripts/site-target.ts --target=codeberg-pages --server      # git-pages 服务 TLS 主机名
 *
 * git-pages 的自定义域在证书就绪前需要以 `--server` 的值做 TLS 连接（站点 URL 仅作
 * 发布目标），因此 Codeberg 部署同时派生这三个值；工作流不出现任何域名。
 */

import { pathToFileURL } from "node:url";

import { findStaticTarget, readSiteConfig, CONFIG_PATH } from "./site-config.ts";

export function resolveSiteBase(targetName: string): string {
  const target = findStaticTarget(readSiteConfig(CONFIG_PATH), targetName);
  return `${target.siteBase.replace(/\/+$/, "")}/`;
}

/** 平台原域（legacyHosts 的第一项）的完整 URL。 */
export function resolveLegacyBase(targetName: string): string {
  const target = findStaticTarget(readSiteConfig(CONFIG_PATH), targetName);
  const host = target.legacyHosts[0];
  if (host === undefined) {
    throw new Error(`目标 ${targetName} 没有 legacyHosts，无法取平台原域`);
  }
  return `https://${host}/`;
}

/** git-pages 服务的 TLS 主机名（未配置时报错，不静默回退）。 */
export function resolvePagesServer(targetName: string): string {
  const target = findStaticTarget(readSiteConfig(CONFIG_PATH), targetName);
  if (target.pagesServer === undefined) {
    throw new Error(`目标 ${targetName} 未配置 pagesServer（git-pages 上传需要它）`);
  }
  return target.pagesServer;
}

function main(argv: string[]): void {
  const arg = argv.find((value) => value.startsWith("--target="));
  if (!arg) {
    throw new Error(
      "用法：node scripts/site-target.ts --target=<静态目标名> [--legacy-base|--server]"
    );
  }
  const targetName = arg.slice("--target=".length);
  const value = argv.includes("--server")
    ? resolvePagesServer(targetName)
    : argv.includes("--legacy-base")
      ? resolveLegacyBase(targetName)
      : resolveSiteBase(targetName);
  process.stdout.write(value);
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
