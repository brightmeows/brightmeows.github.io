import type { MirrorTableItem } from "@brightmeows/mirror/types";

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
    throw new Error(`无法加载 tables.json: ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("tables.json 格式错误：不是数组");
  }

  return (data as MirrorTableItem[]).map((item) => {
    const dir = String(item.dir_name ?? "").replace(/^\/+|\/+$/g, "");
    if (!dir) return item;
    return { ...item, url: `/${baseRoute}/${dir}/` };
  });
}
