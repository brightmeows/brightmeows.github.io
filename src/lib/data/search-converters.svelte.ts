import type { StringConverter } from "$lib/types/common";
import { getSearchConverters } from "$lib/utils/opencc-loader";

/**
 * 搜索输入的简繁日转换器共享 store（Svelte 5 runes）。
 *
 * opencc-js 全量约 1.1MB，镜像列表、单搜与批量搜三个页面都在输入框首次
 * 聚焦时触发懒加载。共享同一实例保证跨页只加载一次；页面只需
 * `onfocus={searchConverters.ensureLoaded}` 与在派生式里读 `searchConverters.list`。
 */
class SearchConvertersStore {
  /** 已加载的转换器；空数组表示尚未加载完成（加载完成前搜索按原文匹配）。 */
  list = $state<StringConverter[]>([]);

  #requested = false;

  /** 惰性加载；重复调用不重复请求。加载失败不重试（与原页面接线一致）。 */
  ensureLoaded = (): void => {
    if (this.#requested) return;
    this.#requested = true;
    void getSearchConverters().then((c) => {
      this.list = c;
    });
  };
}

/** 全站共享的搜索转换器 store。 */
export const searchConverters = new SearchConvertersStore();
