import type { PageServerLoad } from "./$types";

import { getBmsTables } from "$lib/loaders";
import { m } from "$lib/paraglide/messages.js";
import { formatTitle } from "$lib/utils/title";

/**
 * 自托管表编辑页：预渲染，与查看页同一入口枚举。
 * 不返回 bmstableMeta（编辑地址不是导入地址），编辑器在客户端加载 header 与 data。
 */
export const prerender = true;

export function entries() {
  return getBmsTables().map((table) => ({ table }));
}

export const load: PageServerLoad = ({ params }) => {
  return {
    title: formatTitle(`${m["editor.page_title"]()}: ${params.table}`),
  };
};
