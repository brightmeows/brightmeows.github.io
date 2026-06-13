import type {
  ChartData,
  Course,
  CourseChartInfo,
  DifficultyGroup,
  ResolvedCourseGroup,
  Trophy,
} from "$lib/types/bms";

/**
 * 按难度等级分组
 */
export function groupChartsByLevel(charts: ChartData[]): DifficultyGroup[] {
  const groupsMap: Record<string, DifficultyGroup> = {};
  for (const chart of charts) {
    const level = chart.level ?? "unknown";
    if (!groupsMap[level]) {
      groupsMap[level] = { level, charts: [] };
    }
    groupsMap[level].charts.push(chart);
  }
  return Object.values(groupsMap);
}

/**
 * 计算统计摘要
 */
export function computeTableStats(groups: DifficultyGroup[]): {
  totalCharts: number;
  difficulties: string[];
} {
  if (!groups || groups.length === 0) {
    return { totalCharts: 0, difficulties: [] };
  }
  const { totalCharts, difficulties } = groups.reduce(
    (acc, group) => {
      if (!acc.difficulties.includes(group.level)) {
        acc.difficulties.push(group.level);
      }
      acc.totalCharts += group.charts.length;
      return acc;
    },
    { totalCharts: 0, difficulties: [] as string[] }
  );
  return { totalCharts, difficulties: Array.from(difficulties) };
}

/**
 * 将 header.json 中的 raw course 数据与 tableData 交叉关联，返回解析后的段位列表。
 *
 * - 输入为 null/undefined/[[]]（空值）→ 返回 []
 * - 扁平 Array<Course> → 包裹为单组 [[course1, course2, ...]]
 * - 嵌套 Array<Array<Course>> → 保持分组结构
 *
 * 每个 course 内的 md5/sha256 引用会尝试在 charts 中查找匹配的 title/artist/level。
 * 匹配失败时 resolved=false，保留 hash 前缀用于显示。
 */
export function resolveCourses(courseRaw: unknown, charts: ChartData[]): ResolvedCourseGroup[] {
  if (!courseRaw) return [];

  // 构建 hash→chart 索引
  const chartByHash = new Map<string, ChartData>();
  for (const chart of charts) {
    if (chart.md5) chartByHash.set(chart.md5, chart);
    if (chart.sha256) chartByHash.set(chart.sha256, chart);
  }

  // 将单个 md5/sha256 解析为 CourseChartInfo
  function resolveHash(hash: string): CourseChartInfo {
    const chart = chartByHash.get(hash);
    if (chart) {
      return {
        md5: chart.md5,
        sha256: chart.sha256,
        title: chart.title,
        artist: chart.artist,
        level: chart.level,
        resolved: true,
      };
    }
    return {
      md5: hash.length === 32 ? hash : undefined,
      sha256: hash.length === 64 ? hash : undefined,
      resolved: false,
    };
  }

  // 解析单个 course 对象的谱面列表（合并 charts → md5 → sha256）
  function resolveCourse(raw: Record<string, unknown>): CourseChartInfo[] {
    const result: CourseChartInfo[] = [];

    const rawCharts = raw.charts;
    if (Array.isArray(rawCharts)) {
      for (const item of rawCharts) {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const md5 = typeof obj.md5 === "string" ? obj.md5 : undefined;
          const sha256 = typeof obj.sha256 === "string" ? obj.sha256 : undefined;
          if (md5 || sha256) {
            const chart = chartByHash.get(md5 ?? sha256!);
            if (chart) {
              result.push({
                md5: chart.md5,
                sha256: chart.sha256,
                title: chart.title,
                artist: chart.artist,
                level: chart.level,
                resolved: true,
              });
            } else {
              result.push({ md5, sha256, resolved: false });
            }
          }
        }
      }
    }

    const rawMd5 = raw.md5;
    if (Array.isArray(rawMd5)) {
      for (const hash of rawMd5) {
        if (typeof hash === "string") {
          result.push(resolveHash(hash));
        }
      }
    }

    const rawSha256 = raw.sha256;
    if (Array.isArray(rawSha256)) {
      for (const hash of rawSha256) {
        if (typeof hash === "string") {
          result.push(resolveHash(hash));
        }
      }
    }

    return result;
  }

  // 归一化: 确保 courseRaw 为 Array<Array<Course>>
  let groups: unknown[];
  if (Array.isArray(courseRaw)) {
    if (courseRaw.length === 1 && Array.isArray(courseRaw[0]) && courseRaw[0].length === 0) {
      return [];
    }
    if (courseRaw.length > 0 && Array.isArray(courseRaw[0])) {
      groups = courseRaw as unknown[];
    } else {
      groups = [courseRaw];
    }
  } else {
    return [];
  }

  const result: ResolvedCourseGroup[] = [];
  for (const rawGroup of groups) {
    if (!Array.isArray(rawGroup)) continue;
    const resolvedGroup: Course[] = [];
    for (const rawCourse of rawGroup) {
      if (!rawCourse || typeof rawCourse !== "object") continue;
      const rc = rawCourse as Record<string, unknown>;
      const name = typeof rc.name === "string" ? rc.name : "";
      if (!name) continue;
      resolvedGroup.push({
        name,
        constraint: Array.isArray(rc.constraint)
          ? (rc.constraint as string[]).filter((c): c is string => typeof c === "string")
          : undefined,
        trophy: Array.isArray(rc.trophy) ? (rc.trophy as Trophy[]) : undefined,
        charts: resolveCourse(rc),
      });
    }
    if (resolvedGroup.length > 0) {
      result.push(resolvedGroup);
    }
  }

  return result;
}
