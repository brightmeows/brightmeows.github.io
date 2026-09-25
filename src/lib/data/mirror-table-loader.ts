import type { MirrorTableItem } from "@brightmeows/mirror/types";

import { m } from "$lib/paraglide/messages.js";

/**
 * 加载镜像表列表并修正 URL
 */
export async function loadMirrorTables(
  tablesJsonPath: string,
  baseRoute: string
): Promise<MirrorTableItem[]> {
  const url = new URL(tablesJsonPath, window.location.origin).toString();
  const res = await fetch(url, { redirect: "follow" });
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
