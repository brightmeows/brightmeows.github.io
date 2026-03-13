import { readFileSync } from "node:fs";
import { join } from "node:path";

import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const prerender = true;

/**
 * 预渲染配置：告诉 SvelteKit 需要预渲染哪些路由
 * 在构建时执行，返回所有有效的 dir_name
 */
export function entries() {
  // 读取 tables_proxy.json
  const jsonPath = join("static", "bms", "table", "mirror-proxy", "tables_proxy.json");
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

  console.log(`[Prerender] Found ${validTables.length} tables to prerender for redirects`);

  // 返回所有需要预渲染的路由参数
  return validTables.map((item) => ({
    dir_name: item.dir_name,
  }));
}

/**
 * 服务端加载数据
 * 在构建时（预渲染）和运行时都会执行
 */
export const load: PageServerLoad = ({ params }) => {
  const { dir_name } = params;

  // 对路径组件进行编码，确保 Location 头只包含 ASCII 字符
  const encodedDirName = encodeURIComponent(dir_name);

  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw redirect(308, `/bms/table/mirror-proxy/${encodedDirName}`);
};
