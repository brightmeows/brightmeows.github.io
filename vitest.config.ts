import path from "node:path";

import { defineConfig } from "vitest/config";

// 纯函数单测专用：不加载 SvelteKit / Tailwind / Paraglide 插件，
// 只补齐 $lib 别名，保持 Node 环境与毫秒级启动。
export default defineConfig({
  // 纯函数测试不加载 SvelteKit 插件，根 tsconfig 的 "$app/tsconfig"
  // 在这里解析不了；给 oxc 一个独立 tsconfig，避免它去读根配置。
  tsconfig: "./tsconfig.vitest.json",
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "packages/**/*.test.ts"],
  },
});
