import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { blogIndexPlugin } from "./src/lib/vite-plugin/blog-index.ts";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
    }),
    blogIndexPlugin(),
  ],
  resolve: {
    alias: {
      $content: path.resolve("./src/content"),
    },
  },
});
