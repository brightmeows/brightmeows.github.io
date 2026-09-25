import { m } from "$lib/paraglide/messages.js";
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
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("JSONP request failed"));
    });
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
            message: m["progress.downloading"](),
            detail: `${formatBytes(loaded)} / ${formatBytes(total)}`,
          });
        } else {
          onProgress({
            percent: 50,
            phase: "downloading",
            message: m["progress.downloading"](),
            detail: m["progress.downloaded"]({ bytes: formatBytes(loaded) }),
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
      message: m["progress.download_done"](),
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

  onProgress?.({ percent: 0, phase: "connecting", message: m["bmsdata.requesting_header"]() });

  let headerResponse: Response;
  try {
    headerResponse = await fetchWithProgress(headerUrlBase, onProgress);
  } catch (err) {
    throw new Error(
      m["bmsdata.header_load_failed"]({
        error: err instanceof Error ? err.message : String(err),
      }),
      { cause: err }
    );
  }

  // percent=100 确保经上级 *0.35 映射后不低于下载阶段已达的 35%
  onProgress?.({ percent: 100, phase: "parsing", message: m["bmsdata.parsing_header"]() });
  let data: unknown;
  try {
    data = await headerResponse.json();
  } catch (err) {
    throw new Error(
      m["bmsdata.header_format_invalid"]({
        error: err instanceof Error ? err.message : String(err),
      }),
      { cause: err }
    );
  }

  // 运行时校验：确保 header.json 是对象而非数组或其他类型
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(
      m["bmsdata.header_invalid_type"]({
        actual: Array.isArray(data) ? m["bmsdata.actual_array"]() : String(typeof data),
      })
    );
  }

  onProgress?.({ percent: 100, phase: "done", message: m["bmsdata.header_done"]() });
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
    onProgress?.({ percent: 0, phase: "connecting", message: m["bmsdata.waiting_jsonp"]() });
    try {
      tableDataRaw = await fetchJsonp(finalDataUrl);
    } catch (err) {
      throw new Error(
        m["bmsdata.jsonp_failed"]({ error: err instanceof Error ? err.message : String(err) }),
        { cause: err }
      );
    }
    onProgress?.({ percent: 85, phase: "parsing", message: m["bmsdata.jsonp_received"]() });
  } else {
    onProgress?.({ percent: 5, phase: "connecting", message: m["bmsdata.connecting"]() });
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
                message: m["progress.downloading"](),
              });
            }
          : undefined
      );
      onProgress?.({ percent: 88, phase: "parsing", message: m["bmsdata.parsing_charts"]() });
      try {
        tableDataRaw = await dataResponse.json();
      } catch (err) {
        throw new Error(
          m["bmsdata.chart_format_invalid"]({
            error: err instanceof Error ? err.message : String(err),
          }),
          { cause: err }
        );
      }
    } catch (err) {
      throw new Error(
        m["bmsdata.chart_load_failed"]({ error: err instanceof Error ? err.message : String(err) }),
        { cause: err }
      );
    }
  }

  if (!Array.isArray(tableDataRaw)) {
    let apiError: string = m["bmsdata.chart_invalid"]();
    if (typeof tableDataRaw === "object" && tableDataRaw !== null && "error" in tableDataRaw) {
      const err = (tableDataRaw as Record<string, unknown>).error;
      if (err !== undefined) {
        apiError = typeof err === "string" ? err : JSON.stringify(err);
      } else {
        apiError = m["common.unknown_error"]();
      }
    }
    throw new Error(m["bmsdata.chart_parse_failed"]({ error: apiError }));
  }

  onProgress?.({ percent: 100, phase: "done", message: m["bmsdata.chart_done"]() });
  return { data: tableDataRaw as ChartData[], fetchUrl: finalDataUrl };
}
