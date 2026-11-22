/**
 * 多语构建编排：三个 flavor 各跑一遍 `vite build`（串行），再组装最终产物。
 *
 * 两条构建路径共用 `.build-out/<locale>` 的 flavor 中间目录约定：
 * - 本脚本（`pnpm build`）：本地与 Deploy 的整跑路径，三遍串行后组装。
 * - CI check 的 matrix 拆 job（ci.yml build-flavor + verify）：各 flavor 在
 *   独立 runner 经 `pnpm build:flavor` 单独 build，artifact 汇合后由 verify
 *   跑 `node scripts/assemble-site.ts` 单独组装；不经过本脚本。
 *
 * 应用版本：本次组装只生成一次，三个 flavor 共用（外部已设则沿用）。
 * 版本号内嵌进各树 HTML 的客户端配置，并与 `_app/version.json` 比对；分叉会
 * 让非英语客户端在未命中路由的 fallback 上反复整页刷新。CI matrix 路径下
 * version 由 BUILD_VERSION=github.run_id 注入各 flavor job（run 级唯一，三个
 * job 天然一致）。版本机制的完整说明见 assemble-site.ts 头注。
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

import { assembleSite, FLAVOR_OUT_ROOT, LOCALES } from "./assemble-site.ts";

interface Flavor {
  /** 单遍构建的输出目录（相对仓库根）。 */
  out: string;
  locale: (typeof LOCALES)[number];
}

const FLAVORS = LOCALES.map((locale) => ({
  out: path.join(FLAVOR_OUT_ROOT, locale),
  locale,
}));

function buildFlavor(flavor: Flavor, version: string): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BUILD_OUT: flavor.out,
    PUBLIC_SITE_LOCALE: flavor.locale,
    BUILD_VERSION: version,
  };
  console.log(`\n=== build ${flavor.locale} → ${flavor.out}`);
  const result = spawnSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit", env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  rmSync(FLAVOR_OUT_ROOT, { recursive: true, force: true });
  const version = process.env.BUILD_VERSION ?? Date.now().toString();

  for (const flavor of FLAVORS) buildFlavor(flavor, version);

  assembleSite();
}

main();
