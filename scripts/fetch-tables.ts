/**
 * 难度表数据管线入口（默认流水线，无子命令）。
 *
 * 用法：在仓库根目录执行 `node scripts/fetch-tables.ts`。
 * 活跃表集合来自 R2 基线叠加用户层——基线由工作流经 rclone 同步，用户层经站点
 * Worker 的内部接口读取（需要环境变量 INTERNAL_API_TOKEN）。产物写入 tables/、
 * indexes/ 与 warnings.log（均在 gitignore 中）。
 */

import { runPipeline } from "./pipeline/engine.ts";

try {
  const result = await runPipeline();
  const failed = result.summary.tablesFailed.length;
  process.stdout.write(
    `完成：表 ${result.summary.tablesTotal} 张，成功 ${result.summary.tablesFetched}，失败 ${failed}；日志 ${result.warningsPath}\n`
  );
  if (failed > 0) {
    process.stdout.write("失败清单见 warnings.log 的运行汇总\n");
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
}
