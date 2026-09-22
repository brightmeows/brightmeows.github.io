import path from "node:path";

import { defineConfig } from "vitest/config";

// 纯函数单测专用：不加载 SvelteKit / Tailwind / Paraglide 插件，
// 只补齐 $lib 别名，保持 Node 环境与毫秒级启动。
export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "worker/**/*.test.ts"],
  },
});
