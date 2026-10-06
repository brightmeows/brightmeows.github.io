/**
 * opencc-js 懒加载共享模块
 *
 * opencc-js 全量打包后约 1.1MB（简繁日转换字典）。
 * 两个页面（mirror 表列表、谱面搜索）需要它做搜索时的自动简繁日转换，
 * 但不应在页面加载时立即拉取 1.1MB。
 *
 * 此模块将 opencc-js 的 dynamic import 封装为共享缓存，
 * 首次调用时加载一次，后续复用。
 *
 * 注意：ES 动态导入（`import("opencc-js")`）不暴露下载进度事件，
 * 因此此约 1.1MB 的加载无法添加字节级进度条。两个消费页面的搜索
 * 功能在加载完成前不可用，但用户无进度反馈。
 */

import type { StringConverter } from "$lib/types/common";

let cached: StringConverter[] | null = null;
let loading: Promise<StringConverter[]> | null = null;

/**
 * 获取用于搜索的简繁日转换器列表。
 * 首次调用时动态 import opencc-js，后续复用缓存的 converter 实例。
 * 多个调用者同时调用时共享同一个加载 Promise。
 */
export async function getSearchConverters(): Promise<StringConverter[]> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    try {
      const OpenCC = await import("opencc-js");
      const converters: StringConverter[] = [
        OpenCC.Converter({ from: "cn", to: "jp" }),
        OpenCC.Converter({ from: "jp", to: "cn" }),
        OpenCC.Converter({ from: "cn", to: "tw" }),
        OpenCC.Converter({ from: "tw", to: "cn" }),
      ];
      cached = converters;
      return converters;
    } finally {
      loading = null;
    }
  })();

  return loading;
}
