import type { Plugin, ResolvedConfig } from "vite";
import { readFile, writeFile } from "node:fs/promises";

/**
 * Vite插件：在BMS表格页面的HTML中注入bmstable meta标签
 * 确保meta标签在所有link标签之前
 */
export function bmstableMetaPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "bmstable-meta-injection",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    // 在构建后处理HTML文件
    async writeBundle() {
      const outDir = config.build.outDir || "build";
      const bmsPaths = [
        `${outDir}/bms/table/self-sp/index.html`,
        `${outDir}/bms/table/self-dp/index.html`,
      ];

      // 处理固定路径
      for (const filePath of bmsPaths) {
        try {
          const html = await readFile(filePath, "utf-8");
          const bmstableMeta = `<meta name="bmstable" content="./header.json" />`;
          const modifiedHtml = html.replace("%bmstable.meta%", bmstableMeta);
          await writeFile(filePath, modifiedHtml, "utf-8");
          console.log(`[bmstable-meta] Injected meta into ${filePath}`);
        } catch (e) {
          // 文件不存在，跳过
        }
      }

      // 处理table-mirror动态路径
      const { readdir } = await import("node:fs/promises");
      try {
        const mirrorDir = `${outDir}/bms/table-mirror`;
        const dirs = await readdir(mirrorDir, { withFileTypes: true });
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            const filePath = `${mirrorDir}/${dir.name}/index.html`;
            try {
              const html = await readFile(filePath, "utf-8");
              const bmstableMeta = `<meta name="bmstable" content="./header.json" />`;
              const modifiedHtml = html.replace("%bmstable.meta%", bmstableMeta);
              await writeFile(filePath, modifiedHtml, "utf-8");
              console.log(
                `[bmstable-meta] Injected meta into ${filePath}`,
              );
            } catch {
              // 文件不存在，跳过
            }
          }
        }
      } catch {
        // table-mirror目录不存在，跳过
      }

      // 处理所有其他HTML，移除占位符
      // 这里我们不需要做额外处理，因为如果不存在%bmstable.meta%，replace不会有任何效果
    },
    // 同时也处理开发模式
    transformIndexHtml: {
      order: "pre",
      handler(html, { path }) {
        // 规范化路径
        const normalizedPath = path
          .replace(/^\.\//, "")
          .replace(/\/index\.html$/, "/")
          .replace(/^\/?/, "/");

        // BMS表格路径模式
        const bmsTablePatterns = [
          /^\/bms\/table\/self-sp\/$/,
          /^\/bms\/table\/self-dp\/$/,
          /^\/bms\/table-mirror\/[^/]+\/$/,
        ];

        const isBmsTable = bmsTablePatterns.some((pattern) =>
          pattern.test(normalizedPath)
        );

        if (isBmsTable) {
          console.log(`[bmstable-meta] Processing BMS table: ${normalizedPath}`);
          const bmstableMeta = `<meta name="bmstable" content="./header.json" />`;
          return html.replace("%bmstable.meta%", bmstableMeta);
        }

        return html.replace("%bmstable.meta%", "");
      },
    },
  };
}
