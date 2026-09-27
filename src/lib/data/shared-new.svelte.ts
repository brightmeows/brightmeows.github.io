/**
 * 新建流程的跨页种子：前置屏（/bms/table/shared/new/）把可选的
 * name/symbol 交给编辑器首屏，一次性消费（take 后清空，不残留到下次新建）。
 * 用模块级 runes store 承载，避免 URL 传参把内容摆到地址栏。
 */
class SharedNewSeed {
  name = $state("");
  symbol = $state("");

  set(name: string, symbol: string): void {
    this.name = name;
    this.symbol = symbol;
  }

  take(): { name: string; symbol: string } {
    const seed = { name: this.name, symbol: this.symbol };
    this.name = "";
    this.symbol = "";
    return seed;
  }
}

export const sharedNewSeed = new SharedNewSeed();
