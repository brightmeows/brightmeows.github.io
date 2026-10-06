import type { MirrorTableItem } from "@brightmeows/mirror/types";

import { fetchSiteTableList } from "./table-list";

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
  const data = await fetchSiteTableList<MirrorTableItem>(
    tablesJsonPath,
    {
      loadFailed: (status) => m["mirror.tables_load_failed"]({ status }),
      invalid: () => m["mirror.tables_invalid"](),
    },
    options
  );

  return data.map((item) => {
    const dir = String(item.dir_name ?? "").replace(/^\/+|\/+$/g, "");
    if (!dir) return item;
    return { ...item, url: `/${baseRoute}/${dir}/` };
  });
}
