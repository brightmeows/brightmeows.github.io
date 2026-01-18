import type { PageServerLoad } from "./$types";

/**
 * 服务端加载数据
 * 设置 locals，告诉 hooks 使用相对路径注入 bmstable meta 标签
 */
export const load: PageServerLoad = async ({ locals }) => {
  locals.bmstableMeta = "./header.json";

  return {};
};
