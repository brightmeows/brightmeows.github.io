import { deLocalizeUrl } from "./lib/paraglide/runtime.js";

export const reroute = ({ url }: { url: URL }) => deLocalizeUrl(url).pathname;

export const transport = {};

/**
 * 客户端 hooks
 * 在开发模式下执行
 */
export const handle = async ({ event, resolve }: any) => {
  const response = await resolve(event);

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("text/html")) {
    return response;
  }

  // 检查是否设置了 bmstableMeta
  if (event.locals.bmstableMeta) {
    const html = await response.text();
    const bmstableMeta = `<meta name="bmstable" content="${event.locals.bmstableMeta}" />`;
    return new Response(html.replace("%bmstable.meta%", bmstableMeta), {
      headers: response.headers,
    });
  }

  const html = await response.text();
  return new Response(html.replace("%bmstable.meta%", ""), {
    headers: response.headers,
  });
};
