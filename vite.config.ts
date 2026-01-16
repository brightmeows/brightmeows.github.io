import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { blogIndexPlugin } from "./src/lib/vite-plugin/blog-index.ts";
import { bmstableMetaPlugin } from "./src/lib/vite-plugin/bmstable-meta.ts";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
    }),
    blogIndexPlugin(),
    bmstableMetaPlugin(),
  ],
  resolve: {
    alias: {
      $content: path.resolve("./src/content"),
    },
  },
});
