import type { Handle } from "@sveltejs/kit";

/**
 * SvelteKit 服务器端 hooks
 * 在预渲染和 SSR 模式下执行
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // 非HTML响应，直接返回
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("text/html")) {
    return response;
  }

  // 如果页面设置了 bmstableMeta，注入 meta 标签
  if (event.locals.bmstableMeta) {
    const html = await response.text();
    const bmstableMeta = `<meta name="bmstable" content="${event.locals.bmstableMeta}" />`;
    return new Response(html.replace("%bmstable.meta%", bmstableMeta), {
      headers: response.headers,
    });
  }

  // 否则移除占位符
  const html = await response.text();
  return new Response(html.replace("%bmstable.meta%", ""), {
    headers: response.headers,
  });
};
