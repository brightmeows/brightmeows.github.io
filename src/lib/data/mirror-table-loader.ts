import type { MirrorTableItem } from "@brightmeows/mirror/types";

import { m } from "$lib/paraglide/messages.js";

/** 清单加载选项。 */
export interface LoadMirrorTablesOptions {
  /** 附加时间戳查询参数穿透边缘缓存（管理操作后使用；访客保持默认缓存）。 */
  cacheBust?: boolean | undefined;
}

/**
 * 加载镜像表列表并修正 URL
 */
export async function loadMirrorTables(
  tablesJsonPath: string,
  baseRoute: string,
  options: LoadMirrorTablesOptions = {}
): Promise<MirrorTableItem[]> {
  const url = new URL(tablesJsonPath, window.location.origin);
  if (options.cacheBust === true) {
    url.searchParams.set("t", String(Date.now()));
  }
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) {
    throw new Error(m["mirror.tables_load_failed"]({ status: res.status }));
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(m["mirror.tables_invalid"]());
  }

  return (data as MirrorTableItem[]).map((item) => {
    const dir = String(item.dir_name ?? "").replace(/^\/+|\/+$/g, "");
    if (!dir) return item;
    return { ...item, url: `/${baseRoute}/${dir}/` };
  });
}
