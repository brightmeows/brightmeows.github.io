import { detectQueryType } from "../api/bms-search";
import type {
  CandidateEntry,
  WorkerLoadHashRequest,
  WorkerMessage,
  WorkerSearchRequest,
} from "../api/bms-search";

import { m } from "#lib/paraglide/messages.js";
import { errorDetailOf } from "#lib/utils/infra/error.js";

/** 索引加载阶段。 */
export type IndexPhase = "loading" | "ready" | "error";

/** 哈希索引组阶段：首屏不加载，输入哈希时才按需拉取。 */
export type HashIndexPhase = "idle" | "loading" | "ready" | "error";

/** 单个索引文件的加载状态（模板进度列表用）。 */
export interface IndexProgressItem {
  name: string;
  status: "loading" | "done" | "error";
}

/** 首屏加载的索引组；哈希组按需加载，不进入这张进度表。 */
const INDEX_NAMES = ["title", "artist"] as const;

/**
 * 搜索索引 Worker 的共享客户端（Svelte 5 runes）。
 *
 * 封装三件页面各自重复过的事：Worker 生命周期（创建/终止）、索引加载状态
 * （phase/progress/errorMessage，直接供模板渲染）、搜索请求的 Promise 化等待
 * （按 searchId 配对结果，取消时未决请求以空结果落定）。消息协议变化只改这里。
 *
 * 每页各建一个实例（单搜与批量搜是互斥路由，不会同时挂载），随组件销毁
 * dispose；Worker 内部命中 IndexedDB 缓存，重建成本为本地解析而非网络。
 */
export class SearchIndexClient {
  /** 索引加载阶段；仅 `ready` 后可发起搜索。 */
  phase = $state<IndexPhase>("loading");
  /** 四个索引文件的加载进度（按固定顺序）。 */
  progress = $state<IndexProgressItem[]>(
    INDEX_NAMES.map((name) => ({ name, status: "loading" as const }))
  );
  /** 加载失败原因；phase 为 `error` 时展示。 */
  errorMessage = $state<string | null>(null);
  /** 哈希索引组阶段；`idle` 表示尚未按需加载。 */
  hashPhase = $state<HashIndexPhase>("idle");
  /** 哈希索引组失败原因。 */
  hashErrorMessage = $state<string | null>(null);
  /** 是否有索引组因 manifest 或文件校验失败而使用缓存。 */
  stale = $state(false);
  /** 上一次成功生成的 manifest 时间，stale 提示用。 */
  updatedAt = $state<string | null>(null);

  #worker: Worker | null = null;
  #nextSearchId = 1;
  #pending = new Map<number, (candidates: CandidateEntry[]) => void>();
  #hashWaiters: (() => void)[] = [];
  #readyWaiters: (() => void)[] = [];

  /** 创建 Worker 并接线消息监听；重复调用只建一次，创建失败进入 error 态。 */
  start(): void {
    if (this.#worker) return;
    try {
      const worker = new Worker(new URL("../api/bms-search.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("message", (e: MessageEvent<WorkerMessage>) => {
        this.#onMessage(e.data);
      });
      this.#worker = worker;
    } catch (err) {
      console.warn("Web Worker 创建失败:", err);
      this.phase = "error";
      this.errorMessage = m["search.worker_create_failed"]({
        error: errorDetailOf(err),
      });
    }
  }

  /** 终止 Worker；未决搜索以空结果落定。 */
  dispose(): void {
    this.#worker?.terminate();
    this.#worker = null;
    this.#settlePending([]);
    this.#settleHashWaiters();
    this.#settleReadyWaiters();
  }

  /**
   * 等待首屏索引组就绪：加载期间允许用户提前输入，搜索时再等它落定。
   * 已就绪或失败时立即返回。
   */
  waitReady(): Promise<void> {
    if (this.phase !== "loading") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#readyWaiters.push(resolve);
    });
  }

  /**
   * 确保哈希索引组已加载：首次调用触发 Worker 拉取，后续复用同一份内存。
   * 失败或不可用时直接落定，调用方的搜索会得到空结果。
   */
  ensureHashIndices(): Promise<void> {
    if (this.hashPhase === "ready" || this.hashPhase === "error") {
      return Promise.resolve();
    }
    const waiter = new Promise<void>((resolve) => {
      this.#hashWaiters.push(resolve);
    });
    if (this.hashPhase === "idle" && this.#worker) {
      this.hashPhase = "loading";
      const request: WorkerLoadHashRequest = { type: "load-hash" };
      this.#worker.postMessage(request);
    }
    return waiter;
  }

  /**
   * 发起一次索引搜索；结果按 searchId 配对返回。
   * Worker 不存在或索引未就绪时返回空结果（调用方应先检查 phase）。
   */
  async search(query: string, needles?: string[]): Promise<CandidateEntry[]> {
    // 哈希查询依赖按需加载的索引组，先等它就绪再发请求
    if (detectQueryType(query) !== "text") {
      await this.ensureHashIndices();
    }
    return new Promise((resolve) => {
      if (!this.#worker || this.phase !== "ready") {
        resolve([]);
        return;
      }
      const searchId = this.#nextSearchId++;
      this.#pending.set(searchId, resolve);
      const request: WorkerSearchRequest = { type: "search", searchId, query, needles };
      this.#worker.postMessage(request);
    });
  }

  /** 让所有未决搜索以空结果立即落定（发起新批次或取消时调用）。 */
  cancelPending(): void {
    this.#settlePending([]);
  }

  #settlePending(candidates: CandidateEntry[]): void {
    for (const resolve of this.#pending.values()) {
      resolve(candidates);
    }
    this.#pending.clear();
  }

  #settleHashWaiters(): void {
    const waiters = this.#hashWaiters;
    this.#hashWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  #settleReadyWaiters(): void {
    const waiters = this.#readyWaiters;
    this.#readyWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  #onMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case "index-progress": {
        this.progress = this.progress.map((item) =>
          item.name === msg.name ? { ...item, status: msg.status } : item
        );
        break;
      }
      case "ready": {
        this.stale = this.stale || (msg.stale ?? false);
        this.updatedAt = msg.updatedAt ?? this.updatedAt;
        if (msg.error) {
          this.phase = "error";
          // Worker 无 DOM 上下文无法按 locale 求值消息，发代码由主线程翻译
          this.errorMessage =
            msg.error === "index-load-failed" ? m["search.index_load_failed"]() : msg.error;
        } else {
          this.phase = "ready";
        }
        this.#settleReadyWaiters();
        break;
      }
      case "hash-ready": {
        this.stale = this.stale || (msg.stale ?? false);
        this.updatedAt = msg.updatedAt ?? this.updatedAt;
        if (msg.error) {
          this.hashPhase = "error";
          this.hashErrorMessage =
            msg.error === "index-load-failed" ? m["search.index_load_failed"]() : msg.error;
        } else {
          this.hashPhase = "ready";
          this.hashErrorMessage = null;
        }
        this.#settleHashWaiters();
        break;
      }
      case "search-result": {
        const resolve = this.#pending.get(msg.searchId);
        if (resolve) {
          this.#pending.delete(msg.searchId);
          resolve(msg.candidates);
        }
        break;
      }
    }
  }
}
