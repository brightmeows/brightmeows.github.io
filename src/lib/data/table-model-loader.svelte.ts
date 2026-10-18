import type { ChartData } from "@brightmeows/bms/format";

import { fetchBmsHeader, fetchBmsTableData } from "#lib/data/api/bms-data.js";
import { m } from "#lib/paraglide/messages.js";
import type { ProgressCallback } from "#lib/types/bms-view.js";
import { resolveUrl } from "#lib/utils/infra/url.js";

type LoadPhase = "loading" | "loaded" | "error";

/** 两段式加载的宿主接入点：模型态写入由页面模型注入。 */
export interface TableLoaderDeps {
  headerUrl: () => string | null;
  /** header.data_url 缺失时的回退数据地址。 */
  dataUrlFallback: () => string | null;
  /** 新表初始种子（无草稿认领时使用）。 */
  seed: () => { name: string; symbol: string } | undefined;
  /** 线上并发基线尚无值时以进入时的基线初始化。 */
  initBaseline: () => void;
  /** header 状态套用到模型（核心字段、levels、course、extra）。 */
  applyHeaderState: (header: Record<string, unknown>) => void;
  /** 新表种子写入模型身份字段。 */
  setSeedIdentity: (seed: { name: string; symbol: string }) => void;
  /** 数据段写入模型条目。 */
  setEntries: (charts: ChartData[]) => void;
  /** 新表的草稿三向决策（自有草稿挂起、认领套用）。 */
  prepareNewTable: () => Promise<void>;
  /** 数据段加载完成后的草稿探查（殿后）。 */
  discoverDraft: () => Promise<void>;
}

/**
 * 表加载子模型：header 先行、data 随后（保持查看器的独立错误处理）、
 * 新表种子路径与重试。加载进度经 ProgressCallback 回写本域状态。
 */
export function createTableLoader(deps: TableLoaderDeps) {
  let headerLoadState = $state<LoadPhase>("loading");
  let headerError = $state<string | null>(null);
  let dataLoadState = $state<"idle" | "loading" | "loaded" | "error">("idle");
  let dataError = $state<string | null>(null);
  let dataSourceUrl = $state<string | null>(null);
  let dataFetchUrl = $state<string | null>(null);
  let loadPercent = $state(0);
  let loadMessage = $state<string>(m["editor.loading"]());
  let loadDetail = $state("");

  const ready = $derived(headerLoadState === "loaded" && dataLoadState === "loaded");

  const progressCallback: ProgressCallback = (event) => {
    loadPercent = event.percent;
    loadMessage = event.message;
    loadDetail = event.detail ?? "";
  };

  async function loadHeader(): Promise<void> {
    const headerUrl = deps.headerUrl();
    if (headerUrl === null) {
      await loadNewTable();
      return;
    }
    headerLoadState = "loading";
    headerError = null;
    loadPercent = 0;
    loadMessage = m["editor.loading"]();
    loadDetail = "";
    deps.initBaseline();
    try {
      const header = await fetchBmsHeader(headerUrl, progressCallback);
      deps.applyHeaderState(header);
      const fallback = deps.dataUrlFallback();
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== "" ? header.data_url : fallback;
      dataSourceUrl = dataUrl;
      headerLoadState = "loaded";
      if (dataUrl === null) {
        dataError = m["table.data_url_missing"]();
        dataLoadState = "error";
        return;
      }
      void loadData(dataUrl, headerUrl);
    } catch (error) {
      headerError = error instanceof Error ? error.message : m["common.unknown_error"]();
      headerLoadState = "error";
      console.error("加载BMS难度表header失败:", error);
    }
  }

  async function loadData(dataUrl: string, baseUrl: string | null): Promise<void> {
    dataLoadState = "loading";
    dataError = null;
    dataFetchUrl = null;
    deps.setEntries([]);
    loadPercent = 0;
    loadMessage = m["table.loading_charts"]();
    loadDetail = "";
    try {
      const result = await fetchBmsTableData(dataUrl, resolveUrl(baseUrl ?? ""), progressCallback);
      deps.setEntries(result.data);
      dataFetchUrl = result.fetchUrl;
      dataLoadState = "loaded";
      void deps.discoverDraft();
    } catch (error) {
      dataError = error instanceof Error ? error.message : m["common.unknown_error"]();
      dataLoadState = "error";
      console.error("加载BMS谱面数据失败:", error);
    }
  }

  /** 新表（尚未创建的共享表）：种子、自有草稿与认领的三向决策。 */
  async function loadNewTable(): Promise<void> {
    headerLoadState = "loading";
    const seed = deps.seed();
    if (seed !== undefined) {
      deps.setSeedIdentity(seed);
    }
    // 先清空再应用草稿：认领（另存为我的共享表）会把源表的头部与条目一起
    // 搬进来，清空若排在 prepareNewTable 之后会把刚套用的条目抹掉，
    // 认领结果只剩头部字段。
    deps.setEntries([]);
    await deps.prepareNewTable();
    headerLoadState = "loaded";
    dataLoadState = "loaded";
  }

  function retryData(): void {
    if (dataSourceUrl !== null) void loadData(dataSourceUrl, deps.headerUrl());
  }

  function retryAll(): void {
    void loadHeader();
  }

  return {
    get headerLoadState() {
      return headerLoadState;
    },
    get headerError() {
      return headerError;
    },
    get dataLoadState() {
      return dataLoadState;
    },
    get dataError() {
      return dataError;
    },
    get dataFetchUrl() {
      return dataFetchUrl;
    },
    get loadPercent() {
      return loadPercent;
    },
    get loadMessage() {
      return loadMessage;
    },
    get loadDetail() {
      return loadDetail;
    },
    get ready() {
      return ready;
    },
    loadHeader,
    retryData,
    retryAll,
  };
}

export type TableLoader = ReturnType<typeof createTableLoader>;
