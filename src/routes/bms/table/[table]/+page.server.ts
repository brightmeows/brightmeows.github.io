import type { PageServerLoad } from "./$types";

import { getBmsTables } from "#lib/loaders/index.js";
import { formatTitle } from "#lib/utils/title.js";

export const prerender = true;

/** 预渲染枚举：按自托管表目录展开静态路径。 */
export function entries() {
  return getBmsTables().map((table) => ({ table }));
}

/** 自托管表页 SSG 数据：标题与相对 header 地址（bmstable meta 注入用）。 */
export const load: PageServerLoad = ({ params }) => {
  return {
    title: formatTitle(`BMS ${params.table}`),
    bmstableMeta: "./header.json",
  };
};
