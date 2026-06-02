import { fetchBmsHeader, fetchBmsTableData } from "./bms-data";

import type { ChartData, HeaderData } from "$lib/types/bms";

export interface TableLoadResult {
  tableData: ChartData[];
  headerData: HeaderData;
  dataFetchUrl: string;
}

/**
 * 加载 BMS 难度表完整数据（header + chart data）
 */
export async function loadBmsTable(headerUrl: string): Promise<TableLoadResult> {
  const headerData = await fetchBmsHeader(headerUrl);

  const dataUrl = headerData?.data_url;
  if (!dataUrl) {
    throw new Error("表头信息中未找到 data_url");
  }

  const headerUrlBase = new URL(headerUrl, window.location.href).toString();
  const result = await fetchBmsTableData(String(dataUrl), headerUrlBase);

  return {
    tableData: result.data,
    headerData,
    dataFetchUrl: result.fetchUrl,
  };
}
