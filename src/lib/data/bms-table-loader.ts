import { fetchBmsHeader, fetchBmsTableData } from "./bms-data";

import type { ChartData, HeaderData, ProgressCallback } from "$lib/types/bms";

export interface TableLoadResult {
  tableData: ChartData[];
  headerData: HeaderData;
  dataFetchUrl: string;
}

/**
 * 加载 BMS 难度表完整数据（header + chart data）
 * @param headerUrl - header.json 的 URL
 * @param onProgress - 可选进度回调，接收全局 0-100% 进度事件
 */
export async function loadBmsTable(
  headerUrl: string,
  onProgress?: ProgressCallback
): Promise<TableLoadResult> {
  onProgress?.({ percent: 0, phase: "connecting", message: "正在初始化..." });

  // Phase 1: Header (sub 0-100% → global 0-35%)
  const headerData = await fetchBmsHeader(headerUrl, (subEvent) => {
    onProgress?.({
      ...subEvent,
      percent: Math.round(subEvent.percent * 0.35),
    });
  });

  const dataUrl = headerData.data_url;
  if (!dataUrl) {
    throw new Error("表头信息中未找到 data_url");
  }

  // Phase 2: Prepare (gap)
  onProgress?.({ percent: 38, phase: "connecting", message: "准备连接谱面数据源..." });

  const headerUrlBase = new URL(headerUrl, window.location.href).toString();

  // Phase 3: Data (sub 0-100% → global 40-95%)
  const result = await fetchBmsTableData(dataUrl, headerUrlBase, (subEvent) => {
    onProgress?.({
      ...subEvent,
      percent: 40 + Math.round(subEvent.percent * 0.55),
    });
  });

  onProgress?.({ percent: 100, phase: "done", message: "加载完成" });
  return {
    tableData: result.data,
    headerData,
    dataFetchUrl: result.fetchUrl,
  };
}
