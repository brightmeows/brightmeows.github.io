/**
 * 多语构建编排：四个 flavor 各跑一遍 `vite build`，再组装最终产物。
 *
 * flavor 矩阵（locale 与目标形态都是构建输入，见 vite.config.ts 的 define）：
 * - en    → `build/` 根：主站英文树（语言切换器可见）
 * - zh-cn → `build/_i18n/zh-cn/`：主站中文树（内部前缀，永不进入用户 URL；
 *           Worker 按 cookie/Accept-Language 把请求映射到这里）
 * - ja    → `build/_i18n/ja/`：主站日文树（同上）
 * - static → `build-static/`：静态宿主单语产物（`__STATIC_TARGET__`，
 *           隐藏切换器；GitHub Pages 与 Codeberg 只发这棵树）
 *
 * 每遍经 `BUILD_OUT`（svelte.config.ts 的 adapter 输出目录）落到 `.build-out/`，
 * 组装完即清理，避免旧 flavor 残留污染下一次构建。
 *
 * 用法：`pnpm build`（deploy、CI check job 与本地验收共用同一入口）。
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

/** 主站语言：en 在根树，其余挂内部前缀；static flavor 复用 en。 */
const LOCALES = ["en", "zh-cn", "ja"] as const;

interface Flavor {
  /** 单遍构建的输出目录（相对仓库根）。 */
  out: string;
  locale: (typeof LOCALES)[number];
  /** 静态目标形态（隐藏切换器）。 */
  static?: boolean;
}

const FLAVORS: Flavor[] = [
  ...LOCALES.map((locale) => ({ out: path.join(".build-out", locale), locale })),
  { out: path.join(".build-out", "static"), locale: "en", static: true },
];

function buildFlavor(flavor: Flavor): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BUILD_OUT: flavor.out,
    PUBLIC_SITE_LOCALE: flavor.locale,
  };
  if (flavor.static) env.PUBLIC_SITE_KIND = "static";
  console.log(`\n=== build ${flavor.locale}${flavor.static ? " (static)" : ""} → ${flavor.out}`);
  const result = spawnSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit", env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** 递归改写目录下所有 HTML 的 `<html lang>`（app.html 模板是硬编码的 lang="en"）。 */
function rewriteHtmlLang(dir: string, locale: string): void {
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".html")) {
        const html = readFileSync(full, "utf8");
        const rewritten = html.replace('<html lang="en">', `<html lang="${locale}">`);
        if (rewritten !== html) writeFileSync(full, rewritten);
      }
    }
  };
  walk(dir);
}

function main(): void {
  rmSync(".build-out", { recursive: true, force: true });
  rmSync("build", { recursive: true, force: true });
  rmSync("build-static", { recursive: true, force: true });

  for (const flavor of FLAVORS) buildFlavor(flavor);

  mkdirSync("build", { recursive: true });
  cpSync(path.join(".build-out", "en"), "build", { recursive: true });
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    cpSync(path.join(".build-out", locale), path.join("build", "_i18n", locale), {
      recursive: true,
    });
  }

  // 各语言树页面引用的 /_app 走共享根：同名文件按内容哈希命名（内容一致才同名），
  // 各语言独有 chunk 互不碰撞，构建期合并后按原样取（见 worker/i18n.ts 的
  // isSharedAsset）。version.json 按构建时间取值会分叉，统一用 en 树的值，
  // 避免非英语客户端版本比对永远不一致。
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const tree = path.join("build", "_i18n", locale);
    cpSync(path.join("build", "_app", "version.json"), path.join(tree, "_app", "version.json"));
    cpSync(path.join(tree, "_app"), path.join("build", "_app"), { recursive: true, force: true });
    rmSync(path.join(tree, "_app"), { recursive: true, force: true });

    // app.html 的 lang 是硬编码模板，按 flavor 改写（客户端 effect 会再设一次）
    rewriteHtmlLang(tree, locale);
  }

  cpSync(path.join(".build-out", "static"), "build-static", { recursive: true });
  rmSync(".build-out", { recursive: true, force: true });

  console.log(
    "\n组装完成：build/（en 根 + _i18n/zh-cn、_i18n/ja，_app 已合并多语 chunk）与 build-static/"
  );
}

main();
