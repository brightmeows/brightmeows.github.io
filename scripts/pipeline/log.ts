/**
 * 运行日志：控制台即时输出，warnings.log 每轮重写。
 *
 * 旧实现把 warn 追加进一个无时间戳的日志（已膨胀到 10 MB），这里改为
 * 每轮重写：文件头写运行区间与汇总，条目带时间戳，长哈希类噪声按表折叠。
 */

export interface RunSummary {
  startedAt: Date;
  finishedAt: Date;
  listSources: number;
  listFailures: string[];
  tablesTotal: number;
  tablesFetched: number;
  tablesFailed: string[];
  renamed: number;
  orphansMoved: number;
  tablesJsonEntries: number;
  indexSizes: Record<string, number>;
  longHashWarnings: Map<string, { count: number; sample: string }>;
  unrecognizedData: string[];
}

interface LoggedWarning {
  at: string;
  message: string;
}

/** 记录告警并在结束时写出单轮日志文件。 */
export class RunLog {
  private readonly warnings: LoggedWarning[] = [];

  warn(message: string): void {
    const at = new Date().toISOString();
    this.warnings.push({ at, message });
    process.stderr.write(`[${at}] [warn] ${message}\n`);
  }

  info(message: string): void {
    process.stdout.write(`[${new Date().toISOString()}] [info] ${message}\n`);
  }

  /** 本轮告警条数（供汇总与测试）。 */
  get warningCount(): number {
    return this.warnings.length;
  }

  /** 渲染 warnings.log 内容（纯函数，便于单测）。 */
  render(summary: RunSummary): string {
    const lines: string[] = [
      "# BMS 难度表管线告警日志",
      `# 运行区间：${summary.startedAt.toISOString()} 至 ${summary.finishedAt.toISOString()}`,
      `# 汇总：表 ${summary.tablesTotal} 张，成功 ${summary.tablesFetched}，失败 ${summary.tablesFailed.length}`,
      `# 列表源 ${summary.listSources} 个（失败 ${summary.listFailures.length}）；目录重命名 ${summary.renamed}；孤儿 ${summary.orphansMoved}`,
      `# tables.json ${summary.tablesJsonEntries} 项；索引 ${Object.entries(summary.indexSizes)
        .map(([name, size]) => `${name}=${size}`)
        .join(" ")}`,
      "",
    ];

    if (summary.listFailures.length > 0) {
      lines.push(`# 列表源失败：${summary.listFailures.join("；")}`, "");
    }
    if (summary.tablesFailed.length > 0) {
      lines.push(`# 抓取失败表（保留基线数据）：${summary.tablesFailed.join("；")}`, "");
    }
    if (summary.unrecognizedData.length > 0) {
      lines.push(`# data.json 格式无法识别：${summary.unrecognizedData.join("；")}`, "");
    }
    if (summary.longHashWarnings.size > 0) {
      lines.push("# 超长哈希告警（按表折叠）：");
      for (const [dirName, warning] of [...summary.longHashWarnings.entries()].sort(
        (left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0)
      )) {
        lines.push(`#   ${dirName}：${warning.count} 条，示例 ${warning.sample}`);
      }
      lines.push("");
    }

    for (const warning of this.warnings) {
      lines.push(`[${warning.at}] [warn] ${warning.message}`);
    }
    return `${lines.join("\n")}\n`;
  }
}
