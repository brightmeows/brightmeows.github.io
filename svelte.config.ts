import path from "node:path";

import adapter from "@sveltejs/adapter-static";
import type { Config } from "@sveltejs/kit";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from "mdsvex";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const config: Config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    mdsvex({
      extensions: [".svx", ".md"],
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [
        [
          rehypeKatex as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          {
            strict: "warn",
            throwOnError: false,
            macros: {
              "\\N": "\\mathbb{N}",
              "\\Z": "\\mathbb{Z}",
            },
          },
        ],
      ],
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
      $content: path.resolve("./src/content"),
    },
    prerender: {
      handleMissingId: "ignore",
      handleUnseenRoutes: "ignore",
    },
  },

  extensions: [".svelte", ".svx", ".md"],
};

export default config;
