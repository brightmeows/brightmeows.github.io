import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
  const { dir_name } = params;

  // 从 tables_proxy.json 查找对应项
  const res = await fetch("/bms/table-mirror/tables_proxy.json");
  const tables_proxy = await res.json() as Array<{
    dir_name: string;
    url: string;
    url_ori?: string;
  }>;

  const tableItem = tables_proxy.find((item) => item.dir_name === dir_name);

  if (!tableItem) {
    throw new Error(`Table not found: ${dir_name}`);
  }

  return {
    dir_name,
    headerUrl: tableItem.url,
    originUrl: tableItem.url_ori || null,
  };
};
