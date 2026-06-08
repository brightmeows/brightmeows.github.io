import type {
  ChartData,
  Course,
  CourseChartInfo,
  DifficultyGroup,
  HeaderData,
  ProgressCallback,
  ResolvedCourseGroup,
  Trophy,
} from "$lib/types/bms";

/**
 * JSONP 请求
 */
export function fetchJsonp(url: string, timeoutMs = 10000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
    const script = document.createElement("script");
    const win = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      delete win[callbackName];
      if (script.parentNode) document.body.removeChild(script);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("JSONP request timed out"));
    }, timeoutMs);
    const requestUrl = new URL(url, window.location.href);
    requestUrl.searchParams.set("callback", callbackName);
    script.src = requestUrl.toString();
    win[callbackName] = (data: unknown) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("JSONP request failed"));
    };
    document.body.appendChild(script);
  });
}

/**
 * 字节大小格式化
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 带进度跟踪的 fetch。
 * 当 response.body 可用时，通过 ReadableStream 逐 chunk 读取并报告字节级进度。
 * Content-Length 缺失时仍跟踪字节但只显示"已下载 X MB"。
 * 如果 body 不可用或未提供 onProgress，退化为普通 fetch。
 */
export async function fetchWithProgress(
  url: string,
  onProgress?: ProgressCallback
): Promise<Response> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!onProgress || !response.body) {
    return response;
  }

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      if (total) {
        const pct = Math.min(Math.round((loaded / total) * 100), 100);
        onProgress({
          percent: pct,
          phase: "downloading",
          message: "下载中...",
          detail: `${formatBytes(loaded)} / ${formatBytes(total)}`,
        });
      } else {
        onProgress({
          percent: 50,
          phase: "downloading",
          message: "下载中...",
          detail: `已下载 ${formatBytes(loaded)}`,
        });
      }
    }
  }

  // 流读取完成，确保进度最终到达 100%
  if (!total && onProgress) {
    onProgress({
      percent: 100,
      phase: "downloading",
      message: "下载完成",
      detail: `已下载 ${formatBytes(loaded)}`,
    });
  }

  // 合并所有 chunk 重建 Response
  const combined = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  return new Response(combined, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * 获取 header.json
 */
export async function fetchBmsHeader(
  headerUrl: string,
  onProgress?: ProgressCallback
): Promise<HeaderData> {
  const headerUrlBase = new URL(headerUrl, window.location.href).toString();

  onProgress?.({ percent: 0, phase: "connecting", message: "正在请求表头信息..." });

  let headerResponse: Response;
  try {
    headerResponse = await fetchWithProgress(headerUrlBase, onProgress);
  } catch (err) {
    throw new Error(`无法加载表头信息: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }

  // percent=100 确保经 loadBmsTable 的 *0.35 映射后不低于下载阶段已达的 35%
  onProgress?.({ percent: 100, phase: "parsing", message: "正在解析表头信息..." });
  let data: HeaderData;
  try {
    data = (await headerResponse.json()) as HeaderData;
  } catch (err) {
    throw new Error(`表头数据格式无效: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }

  onProgress?.({ percent: 100, phase: "done", message: "表头信息加载完成" });
  return data;
}

export interface FetchTableDataResult {
  data: ChartData[];
  fetchUrl: string;
}

/**
 * 获取谱面数据（自动判断 JSONP）
 */
export async function fetchBmsTableData(
  dataUrl: string,
  baseUrl: string,
  onProgress?: ProgressCallback
): Promise<FetchTableDataResult> {
  const resolvedDataUrl = new URL(dataUrl, baseUrl);
  const finalDataUrl = resolvedDataUrl.toString();
  const isJsonp =
    resolvedDataUrl.hostname === "script.google.com" &&
    resolvedDataUrl.pathname.startsWith("/macros/");

  let tableDataRaw: unknown;
  if (isJsonp) {
    onProgress?.({ percent: 0, phase: "connecting", message: "等待 JSONP 响应..." });
    try {
      tableDataRaw = await fetchJsonp(finalDataUrl);
    } catch (err) {
      throw new Error(`JSONP 请求失败: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      });
    }
    onProgress?.({ percent: 85, phase: "parsing", message: "JSONP 数据接收完成，解析中..." });
  } else {
    onProgress?.({ percent: 5, phase: "connecting", message: "连接谱面数据源..." });
    let dataResponse: Response;
    try {
      dataResponse = await fetchWithProgress(finalDataUrl, (ev) => {
        onProgress?.({
          ...ev,
          percent: 5 + Math.round(ev.percent * 0.8),
        });
      });
    } catch (err) {
      throw new Error(`无法加载谱面数据: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      });
    }
    onProgress?.({ percent: 88, phase: "parsing", message: "解析谱面数据..." });
    try {
      tableDataRaw = await dataResponse.json();
    } catch (err) {
      throw new Error(`谱面数据格式无效: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      });
    }
  }

  if (!Array.isArray(tableDataRaw)) {
    let apiError = "谱面数据格式无效";
    if (typeof tableDataRaw === "object" && tableDataRaw !== null && "error" in tableDataRaw) {
      const err = (tableDataRaw as Record<string, unknown>).error;
      if (err !== undefined) {
        apiError = typeof err === "string" ? err : JSON.stringify(err);
      } else {
        apiError = "未知错误";
      }
    }
    throw new Error(`无法解析谱面数据: ${apiError}`);
  }

  onProgress?.({ percent: 100, phase: "done", message: "谱面数据加载完成" });
  return { data: tableDataRaw as ChartData[], fetchUrl: finalDataUrl };
}

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
export function resolveCourses(
  courseRaw: unknown,
  charts: ChartData[]
): ResolvedCourseGroup[] {
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
    return { md5: hash.length === 32 ? hash : undefined, sha256: hash.length === 64 ? hash : undefined, resolved: false };
  }

  // 解析单个 course 对象的谱面列表（合并 charts → md5 → sha256）
  function resolveCourse(raw: Record<string, unknown>): CourseChartInfo[] {
    const result: CourseChartInfo[] = [];

    // charts 数组: 每个元素是 ChartInfo，可能有 md5/sha256
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

    // md5 数组: 字符串列表
    const rawMd5 = raw.md5;
    if (Array.isArray(rawMd5)) {
      for (const hash of rawMd5) {
        if (typeof hash === "string") {
          result.push(resolveHash(hash));
        }
      }
    }

    // sha256 数组: 字符串列表
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
      // 空值标记 [[]]
      return [];
    }
    if (courseRaw.length > 0 && Array.isArray(courseRaw[0])) {
      // 已嵌套
      groups = courseRaw as unknown[];
    } else {
      // 扁平 → 包裹
      groups = [courseRaw];
    }
  } else {
    return [];
  }

  // 解析每组
  const result: ResolvedCourseGroup[] = [];
  for (const rawGroup of groups) {
    if (!Array.isArray(rawGroup)) continue;
    const resolvedGroup: Course[] = [];
    for (const rawCourse of rawGroup) {
      if (!rawCourse || typeof rawCourse !== "object") continue;
      const rc = rawCourse as Record<string, unknown>;
      const name = typeof rc.name === "string" ? rc.name : "";
      if (!name) continue; // 跳过无名段位
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
