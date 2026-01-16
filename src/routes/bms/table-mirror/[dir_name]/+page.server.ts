import type { PageServerLoad } from "./$types";
import { loadTablesProxy, fetchTableData, generateTableEntries } from "$lib/server/bms-table-loader";
import { error } from "@sveltejs/kit";

/**
 * 预渲染配置:告诉 SvelteKit 哪些路由需要预渲染
 */
export async function entries() {
  return await generateTableEntries();
}

/**
 * 启用预渲染
 */
export const prerender = true;

/**
 * 服务端加载数据:在构建时执行
 */
export const load: PageServerLoad = async ({ params }) => {
  const { dir_name } = params;

  try {
    // 1. 从 tables_proxy.json 查找配置
    const tables = await loadTablesProxy();
    const table = tables.find((t) => t.dir_name === dir_name);

    if (!table) {
      throw error(404, `Table not found: ${dir_name}`);
    }

    // 2. 并行获取 header 和 data
    const { header, data } = await fetchTableData(table.url, dir_name);

    // 3. 计算 data URL
    const dataUrl = header.data_url;
    let dataFetchUrl: string | null = null;
    if (dataUrl) {
      const isAbsolute = (u: string) => /^(https?:)?\/\//i.test(u) || u.startsWith("/");
      dataFetchUrl = isAbsolute(dataUrl)
        ? dataUrl
        : new URL(dataUrl, table.url).toString();
    }

    // 4. 返回所有数据给组件
    return {
      dir_name,
      headerUrl: table.url,
      originUrl: table.url_ori || null,
      header,
      tableData: data,
      dataFetchUrl,
    };
  } catch (err) {
    // 构建时失败会跳过该页面
    console.error(`Failed to load table ${dir_name}:`, err);
    throw err;
  }
};
