/**
 * 多语产物组装：把 `.build-out/<locale>` 的各 flavor 产物合成最终 `build/`。
 *
 * 两个入口共用本模块：
 * - `pnpm build`（scripts/build-site.ts）：本地与 Deploy 的整跑路径，串行三遍
 *   vite build 后调 assembleSite()。
 * - `node scripts/assemble-site.ts`（CI verify job）：matrix 拆 job 后，各
 *   flavor 在独立 runner 单独 build 并经 artifact 汇合，组装单独跑。
 *
 * 组装结构（en 在根树，其余挂内部前缀 `_i18n/`，永不进入用户 URL）：
 * - `.build-out/en` → `build/`
 * - `.build-out/zh-cn`、`ja` → `build/_i18n/<locale>/`
 * - 各语言树的 `_app` 合并进 `build/_app`（同名文件按内容哈希命名，内容一致
 *   才同名，各语言独有 chunk 互不碰撞；构建期合并后按原样取，见 worker/i18n.ts
 *   的 isSharedAsset）。三个 flavor 的 BUILD_VERSION 注入同一个值，各树 HTML
 *   内嵌 version 与合并后的 `_app/version.json` 天然一致。
 * - app.html 的 lang 是硬编码模板，按 flavor 改写（客户端 effect 会再设一次）。
 *
 * 版本坑：客户端在未命中路由的 fallback 与跳转前会与 `/_app/version.json` 比对，
 * 两边不一致就整页刷新，而未命中路由时刷新不收敛（表现为非英语 404 空白页）。
 * 因此三个 flavor 必须注入同一个值（CI 下由 BUILD_VERSION=github.run_id 保证），
 * 不要事后改写产物里的版本比对文件。
 */

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

/** 主站语言：en 在根树，其余挂内部前缀。 */
export const LOCALES = ["en", "zh-cn", "ja"] as const;

/** 各 flavor 单遍构建的输出根目录（内部约定，相对仓库根）。 */
export const FLAVOR_OUT_ROOT = ".build-out";

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

/** 合并 `.build-out` 下各 flavor 为 `build/`，组装完清理 flavor 中间目录。 */
export function assembleSite(): void {
  rmSync("build", { recursive: true, force: true });
  mkdirSync("build", { recursive: true });
  cpSync(path.join(FLAVOR_OUT_ROOT, "en"), "build", { recursive: true });
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    cpSync(path.join(FLAVOR_OUT_ROOT, locale), path.join("build", "_i18n", locale), {
      recursive: true,
    });
  }

  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const tree = path.join("build", "_i18n", locale);
    cpSync(path.join(tree, "_app"), path.join("build", "_app"), { recursive: true, force: true });
    rmSync(path.join(tree, "_app"), { recursive: true, force: true });

    rewriteHtmlLang(tree, locale);
  }

  rmSync(FLAVOR_OUT_ROOT, { recursive: true, force: true });

  console.log("\n组装完成：build/（en 根 + _i18n/zh-cn、_i18n/ja，_app 已合并多语 chunk）");
}

function isMain(): boolean {
  return (
    process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href
  );
}

if (isMain()) assembleSite();
