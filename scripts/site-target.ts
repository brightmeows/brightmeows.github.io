/**
 * 打印某个静态目标的站点基址，供工作流把域名从 YAML 里彻底移出。
 *
 * 用法：`node scripts/site-target.ts --target=codeberg-pages`
 * 输出：`https://<siteBase>/`（带尾斜杠，直接喂给需要完整站点 URL 的 action）
 */

import { pathToFileURL } from "node:url";

import { findStaticTarget, readSiteConfig, CONFIG_PATH } from "./site-config.ts";

export function resolveSiteBase(targetName: string): string {
  const target = findStaticTarget(readSiteConfig(CONFIG_PATH), targetName);
  return `${target.siteBase.replace(/\/+$/, "")}/`;
}

function main(argv: string[]): void {
  const arg = argv.find((value) => value.startsWith("--target="));
  if (!arg) {
    throw new Error("用法：node scripts/site-target.ts --target=<静态目标名>");
  }
  process.stdout.write(resolveSiteBase(arg.slice("--target=".length)));
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
