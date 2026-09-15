import path from "node:path";

import { sveltex } from "@nvl/sveltex";
import adapter from "@sveltejs/adapter-static";
import type { Config } from "@sveltejs/kit";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import remarkGfm from "remark-gfm";

const config: Config = {
  preprocess: [
    await sveltex(
      {
        markdownBackend: "unified",
        codeBackend: "shiki",
        mathBackend: "katex",
      },
      {
        extensions: [".md", ".svx"],
        // 站点在 +layout.svelte 统一管理 <svelte:head>，关闭 SvelTeX 的
        // frontmatter head 注入（title/meta/noscript 等）避免重复标签
        frontmatter: {
          head: false,
        },
        // SvelTeX 默认不启用 GFM（表格/任务列表/删除线），需显式挂载
        markdown: {
          remarkPlugins: [remarkGfm],
        },
        // 站点为深色主题，代码块用 shiki 的 github-dark 配色
        code: {
          shiki: {
            theme: "github-dark",
          },
        },
        // katex CSS 由 MarkdownContent.svelte 本地引入，关闭 CDN 注入
        math: {
          css: {
            type: "none",
          },
        },
      }
    ),
    vitePreprocess(),
  ],

  kit: {
    adapter: adapter({
      fallback: "404.html",
      pages: "build",
      assets: "build",
    }),
    paths: {
      base: "",
    },
    alias: {
      $blog: path.resolve("./content/blog"),
    },
    prerender: {
      handleMissingId: "ignore",
      handleUnseenRoutes: "ignore",
    },
  },

  extensions: [".svelte", ".svx", ".md"],
};

export default config;
