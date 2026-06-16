import type { ChartData, HeaderData, ProgressCallback } from "$lib/types/bms";
import { fetchStream } from "$lib/utils/fetch-stream";
import { formatBytes } from "$lib/utils/format";
import { resolveUrl, resolveUrlAs } from "$lib/utils/url";

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
    const requestUrl = resolveUrlAs(url);
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
 * 带进度跟踪的 fetch。
 * 委托 fetchStream 处理流式读取，将字节级进度转换为 ProgressCallback 格式。
 */
async function fetchWithProgress(url: string, onProgress?: ProgressCallback): Promise<Response> {
  const onStreamProgress = onProgress
    ? ({ loaded, total }: { loaded: number; total: number }) => {
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
    : undefined;

  const { response } = await fetchStream(url, undefined, onStreamProgress);

  // 无 Content-Length 时，fetchStream 完成即表示下载完毕
  if (onProgress && !response.headers.get("Content-Length")) {
    onProgress({
      percent: 100,
      phase: "downloading",
      message: "下载完成",
      detail: "",
    });
  }

  return response;
}

/**
 * 获取 header.json
 */
export async function fetchBmsHeader(
  headerUrl: string,
  onProgress?: ProgressCallback
): Promise<HeaderData> {
  const headerUrlBase = resolveUrl(headerUrl);

  onProgress?.({ percent: 0, phase: "connecting", message: "正在请求表头信息..." });

  let headerResponse: Response;
  try {
    headerResponse = await fetchWithProgress(headerUrlBase, onProgress);
  } catch (err) {
    throw new Error(`无法加载表头信息: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }

  // percent=100 确保经上级 *0.35 映射后不低于下载阶段已达的 35%
  onProgress?.({ percent: 100, phase: "parsing", message: "正在解析表头信息..." });
  let data: unknown;
  try {
    data = await headerResponse.json();
  } catch (err) {
    throw new Error(`表头数据格式无效: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }

  // 运行时校验：确保 header.json 是对象而非数组或其他类型
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(
      "表头数据格式无效：期望 JSON 对象，实际接收 " + (Array.isArray(data) ? "数组" : typeof data)
    );
  }

  onProgress?.({ percent: 100, phase: "done", message: "表头信息加载完成" });
  return data as HeaderData;
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
    try {
      const { response: dataResponse } = await fetchStream(
        finalDataUrl,
        undefined,
        onProgress
          ? ({ loaded, total }) => {
              const pct = total ? Math.min(Math.round((loaded / total) * 100), 100) : 50;
              onProgress({
                percent: 5 + Math.round(pct * 0.8),
                phase: "downloading",
                message: "下载中...",
              });
            }
          : undefined
      );
      onProgress?.({ percent: 88, phase: "parsing", message: "解析谱面数据..." });
      try {
        tableDataRaw = await dataResponse.json();
      } catch (err) {
        throw new Error(`谱面数据格式无效: ${err instanceof Error ? err.message : String(err)}`, {
          cause: err,
        });
      }
    } catch (err) {
      throw new Error(`无法加载谱面数据: ${err instanceof Error ? err.message : String(err)}`, {
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
