import type { SharedNewTableSeed, SharedNewTableSeedPayload } from "@brightmeows/bms/shared";

/**
 * 新建流程的跨页种子：前置屏（/bms/table/shared/new/）把可选的 name/symbol
 * 与导入的整包内容交给编辑器首屏，一次性消费（take 后清空，不残留到下次
 * 新建）。用模块级 runes store 承载，避免 URL 传参把内容摆到地址栏。
 */
class SharedNewSeed {
  name = $state("");
  symbol = $state("");
  payload = $state<SharedNewTableSeedPayload | null>(null);

  /** 写入身份种子（另存共享路径）；同时清空遗留的导入内容。 */
  set(name: string, symbol: string): void {
    this.name = name;
    this.symbol = symbol;
    this.payload = null;
  }

  /** 写入导入的整包内容（强验证通过后调用）。 */
  setPayload(payload: SharedNewTableSeedPayload): void {
    this.payload = payload;
  }

  /** 读取当前种子（不消费）；供新建页预填输入框。 */
  peek(): SharedNewTableSeed {
    return { name: this.name, symbol: this.symbol, payload: this.payload ?? undefined };
  }

  /** 取走种子并清空，不残留到下次新建。 */
  take(): SharedNewTableSeed {
    const seed = this.peek();
    this.name = "";
    this.symbol = "";
    this.payload = null;
    return seed;
  }
}

export const sharedNewSeed = new SharedNewSeed();
