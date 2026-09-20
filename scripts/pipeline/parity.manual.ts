/**
 * 手动对拍入口（不进默认门槛）：
 *
 *   pnpm test:parity
 *
 * 用公开 R2 基线与固定版本的旧二进制（bms-table-fetch release）跑两条实现，
 * 逐对象比对对外产物。默认对拍清单里的全部表；可用环境变量收窄：
 *
 *   PARITY_LIMIT=N        只对拍清单前 N 张表
 *   PARITY_OLD_BINARY=... 指定本地旧二进制路径（默认自动下载 v0.4.2）
 *   PARITY_WORKSPACE=...  指定工作区目录（默认系统临时目录）
 *   PARITY_ALLOW_DIFFS=1  有差异时只报告不失败
 */

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CONFIG_PATH, readSiteConfig } from "../site-config.ts";

import { formatParityReport, runParity } from "./parity.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("新旧实现对拍", () => {
  it(
    "新实现与旧二进制的对外产物一致",
    async () => {
      const limit = Number.parseInt(process.env.PARITY_LIMIT ?? "0", 10);
      const oldBinary = process.env.PARITY_OLD_BINARY;
      const workspace =
        process.env.PARITY_WORKSPACE ?? path.join(os.tmpdir(), "bms-parity-workspace");
      const report = await runParity({
        repoRoot,
        workspace,
        r2Base: readSiteConfig(CONFIG_PATH).r2.base,
        ...(oldBinary === undefined ? {} : { oldBinary }),
        limit: Number.isNaN(limit) ? 0 : limit,
      });
      process.stdout.write(formatParityReport(report));
      if (process.env.PARITY_ALLOW_DIFFS === "1") {
        return;
      }
      expect(report.differences).toEqual([]);
    },
    45 * 60 * 1000
  );
});
