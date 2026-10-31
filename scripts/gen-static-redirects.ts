/**
 * 构建期为 Codeberg 跳转宿主生成跳转壳。
 *
 * Codeberg Pages 发 `_redirects` 让服务端对自定义域与平台默认域发真 301，
 * 另发一个带 meta refresh 与 JS 的客户端跳转壳（index.html）兜底。域名全部
 * 来自 `config/site.json`，工作流里不出现域名。
 *
 * 用法：
 *   node scripts/gen-static-redirects.ts --target=codeberg-pages
 *
 * 产物写入 `build-static/`（与 `pnpm build` 的 `build/` 隔离），不访问网络。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONFIG_PATH, findRedirectTarget, readSiteConfig } from "./site-config.ts";

interface Options {
  target: string;
  buildDir: string;
}

function parseArgs(argv: string[]): Options {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const target = argv.find((value) => value.startsWith("--target="))?.slice("--target=".length);
  const buildDir = argv
    .find((value) => value.startsWith("--build-dir="))
    ?.slice("--build-dir=".length);
  if (target === undefined || target === "") {
    throw new Error("必须提供 --target=<目标名>");
  }
  return { target, buildDir: buildDir ?? path.join(repoRoot, "build-static") };
}

function shellHtml(origin: string): string {
  const escaped = origin.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${escaped}/" />
    <meta http-equiv="refresh" content="0; url=${escaped}/" />
    <title>正在前往 ${escaped}</title>
  </head>
  <body>
    <p>正在前往 <a href="${escaped}/">${escaped}</a>…</p>
    <script>
      const base = ${JSON.stringify(origin)};
      location.replace(base + location.pathname + location.search + location.hash);
    </script>
  </body>
</html>
`;
}

function codebergRedirects(hosts: string[], origin: string): string {
  return [
    "# 静态宿主不再提供镜像：所有路径 301 到主站，! 让规则覆盖已存在的文件",
    ...hosts.map((host) => `//${host}/* ${origin}/:splat 301!`),
    "",
  ].join("\n");
}

function main(argv: string[]): void {
  const options = parseArgs(argv);
  const config = readSiteConfig(CONFIG_PATH);
  const target = findRedirectTarget(config, options.target);
  const origin = config.origin.replace(/\/+$/, "");
  const host = new URL(target.siteBase).host;
  if (target.pagesServer === undefined) {
    throw new Error(`目标 ${options.target} 不是 git-pages 跳转宿主（缺 pagesServer）`);
  }

  rmSync(options.buildDir, { recursive: true, force: true });
  mkdirSync(options.buildDir, { recursive: true });

  writeFileSync(
    path.join(options.buildDir, "_redirects"),
    codebergRedirects([host, ...target.legacyHosts], origin)
  );
  writeFileSync(path.join(options.buildDir, "index.html"), shellHtml(origin));

  console.log(`跳转目标：${options.target}（${host}）`);
  console.log(`跳转目标地址：${origin}`);
  console.log(`产物目录：${options.buildDir}`);
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
