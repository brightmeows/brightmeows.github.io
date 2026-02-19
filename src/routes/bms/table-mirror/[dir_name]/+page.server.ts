import { readFileSync } from "node:fs";
import { join } from "node:path";

import { error } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const prerender = true;

/**
 * 预渲染配置：告诉 SvelteKit 需要预渲染哪些路由
 * 在构建时执行，返回所有有效的 dir_name
 */
export function entries() {
  try {
    // 读取 tables_proxy.json
    const jsonPath = join("static", "bms", "table-mirror", "tables_proxy.json");
    const fileContent = readFileSync(jsonPath, "utf-8");
    const tables_proxy = JSON.parse(fileContent) as {
      dir_name: string;
      url: string;
      url_ori?: string;
    }[];

    // 过滤出有效的 dir_name
    const validTables = tables_proxy.filter(
      (item) => item.dir_name && item.dir_name.trim().length > 0
    );

    console.log(`[Prerender] Found ${validTables.length} tables to prerender`);

    // 返回所有需要预渲染的路由参数
    return validTables.map((item) => ({
      dir_name: item.dir_name,
    }));
  } catch (err) {
    console.error("[Prerender] Failed to load tables_proxy.json:", err);
    return [];
  }
}

/**
 * 服务端加载数据
 * 在构建时（预渲染）和运行时都会执行
 */
export const load: PageServerLoad = ({ params, locals }) => {
  const { dir_name } = params;

  try {
    // 读取 tables_proxy.json
    const jsonPath = join("static", "bms", "table-mirror", "tables_proxy.json");
    const fileContent = readFileSync(jsonPath, "utf-8");
    const tables_proxy = JSON.parse(fileContent) as {
      dir_name: string;
      url: string;
      url_ori?: string;
    }[];

    // 查找对应的表格配置
    const tableItem = tables_proxy.find((item) => item.dir_name === dir_name);

    if (!tableItem) {
      error(404, `Table not found: ${dir_name}`);
    }

    // 设置 locals，告诉 hooks 需要注入完整的 headerUrl
    locals.bmstableMeta = tableItem.url;

    return {
      dir_name,
      headerUrl: tableItem.url,
      originUrl: tableItem.url_ori ?? null,
    };
  } catch (err) {
    console.error(`Failed to load table ${dir_name}:`, err);
    throw err;
  }
};
