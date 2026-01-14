import { mdsvex } from "mdsvex";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import type { Config } from "@sveltejs/kit";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import path from "node:path";

const config: Config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    mdsvex({
      extensions: [".svx", ".md"],
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [[rehypeKatex, {
        strict: "warn",
        throwOnError: false,
        macros: {
          "\\N": "\\mathbb{N}",
          "\\Z": "\\mathbb{Z}",
        },
      }]],
    }),
    vitePreprocess(),
  ],

  kit: {
    adapter: adapter({
      fallback: "404.html",
      pages: "build",
      assets: "build",
      preload: false,
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
