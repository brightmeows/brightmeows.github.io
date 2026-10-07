import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sveltex } from "@nvl/sveltex";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

// 构建期语言注入：dev 默认 zh-cn（编辑现场），生产默认 en（baseLocale）；
// 多语构建由 PUBLIC_SITE_LOCALE 逐 flavor 指定。静态目标（PUBLIC_SITE_KIND=static）
// 只注入 __STATIC_TARGET__（隐藏切换器），语言仍由 __SITE_LOCALE__ 决定。
const siteLocale =
  process.env.PUBLIC_SITE_LOCALE ?? (process.env.NODE_ENV === "development" ? "zh-cn" : "en");
const staticTarget = process.env.PUBLIC_SITE_KIND === "static";

// Kit 3：svelte.config.ts 移除，SvelTeX preprocess 链与 kit 配置并入
// sveltekit() 插件选项（SvelTeX 工厂是异步的，模块顶层 await）。
const sveltexPreprocess = await sveltex(
  {
    markdownBackend: "unified",
    codeBackend: "shiki",
    mathBackend: "katex",
  },
  {
    extensions: [".md", ".svx"],
    // 站点在 +layout.svelte 统一管理 <svelte:head>，关闭 SvelTeX 的
    // frontmatter head 注入（title/meta/noscript 等）避免重复标签
    frontmatter: { head: false },
    // SvelTeX 默认不启用 GFM（表格/任务列表/删除线），需显式挂载
    markdown: { remarkPlugins: [remarkGfm] },
    // 站点为深色主题，代码块用 shiki 的 github-dark 配色
    code: { shiki: { theme: "github-dark" } },
    // katex CSS 由 MarkdownContent.svelte 本地引入，关闭 CDN 注入
    math: { css: { type: "none" } },
  }
);

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
    sveltekit({
      preprocess: [sveltexPreprocess, vitePreprocess()],
      extensions: [".svelte", ".svx", ".md"],
      adapter: adapter({
        fallback: "404.html",
        // 多语构建的单遍输出目录由 BUILD_OUT 注入（scripts/build-site.ts）
        pages: process.env.BUILD_OUT ?? "build",
        assets: process.env.BUILD_OUT ?? "build",
      }),
      paths: { base: "" },
      prerender: {
        handleMissingId: "ignore",
        handleUnseenRoutes: "ignore",
      },
    }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      // 渲染语言由 +layout.ts 的 overwriteGetLocale 按构建 locale 固定；
      // runtime 策略只留 cookie（切换器持久化，供边缘分发）与 baseLocale 兑底。
      strategy: ["cookie", "baseLocale"],
    }),
  ],
});
