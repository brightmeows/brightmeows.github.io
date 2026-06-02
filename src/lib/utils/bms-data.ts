import type { ChartData, DifficultyGroup, HeaderData } from "$lib/types/bms";

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
 * 获取 header.json
 */
export async function fetchBmsHeader(headerUrl: string): Promise<HeaderData> {
  const headerUrlBase = new URL(headerUrl, window.location.href).toString();
  const headerResponse = await fetch(headerUrlBase, { redirect: "follow" });
  if (!headerResponse.ok) {
    throw new Error(`无法加载表头信息: ${headerResponse.status}`);
  }
  return (await headerResponse.json()) as HeaderData;
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
  baseUrl: string
): Promise<FetchTableDataResult> {
  const resolvedDataUrl = new URL(dataUrl, baseUrl);
  const finalDataUrl = resolvedDataUrl.toString();
  const isJsonp =
    resolvedDataUrl.hostname === "script.google.com" &&
    resolvedDataUrl.pathname.startsWith("/macros/");

  let tableDataRaw: unknown;
  if (isJsonp) {
    tableDataRaw = await fetchJsonp(finalDataUrl);
  } else {
    const dataResponse = await fetch(finalDataUrl, { redirect: "follow" });
    if (!dataResponse.ok) {
      throw new Error(`无法加载谱面数据: ${dataResponse.status}`);
    }
    tableDataRaw = await dataResponse.json();
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
