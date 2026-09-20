import { defineConfig } from "vitest/config";

// 手动对拍专用配置：不进默认门槛（pnpm test 只跑离线纯函数单测），
// 因为对拍需要网络、公开 R2 基线与旧二进制（release v0.4.2）。
// 运行：pnpm test:parity
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/pipeline/parity.manual.ts"],
    testTimeout: 45 * 60 * 1000,
    hookTimeout: 45 * 60 * 1000,
  },
});
