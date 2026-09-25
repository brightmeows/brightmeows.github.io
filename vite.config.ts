import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// 构建期语言注入：dev 默认 zh-cn（编辑现场），生产默认 en（baseLocale）；
// 双语构建由 PUBLIC_SITE_LOCALE 逐追指定。静态目标（PUBLIC_SITE_KIND=static）
// 只注入 __STATIC_TARGET__（隐藏切换器），语言仍由 __SITE_LOCALE__ 决定。
const siteLocale =
  process.env.PUBLIC_SITE_LOCALE ?? (process.env.NODE_ENV === "development" ? "zh-cn" : "en");
const staticTarget = process.env.PUBLIC_SITE_KIND === "static";

export default defineConfig({
  server: {
    fs: {
      allow: ["content"],
    },
  },
  define: {
    __SITE_LOCALE__: JSON.stringify(siteLocale),
    __STATIC_TARGET__: JSON.stringify(staticTarget),
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      // 渲染语言由 +layout.ts 的 overwriteGetLocale 按构建 locale 固定；
      // runtime 策略只留 cookie（切换器持久化，供边缘分发）与 baseLocale 兑底。
      strategy: ["cookie", "baseLocale"],
    }),
  ],
  resolve: {
    alias: {
      $blog: path.resolve("./content/blog"),
    },
  },
});
