import { deLocalizeUrl } from "./lib/paraglide/runtime.js";

export const reroute = ({ url }: { url: URL }) => deLocalizeUrl(url).pathname;

export const transport = {};

// BMS表格路径模式
const BMS_TABLE_PATTERNS = [
  /^\/bms\/table\/self-sp\/?$/,
  /^\/bms\/table\/self-dp\/?$/,
  /^\/bms\/table-mirror\/[^/]+\/?$/,
];

// 检查是否为BMS表格页面
function isBmsTablePath(pathname: string): boolean {
  return BMS_TABLE_PATTERNS.some((pattern) => pattern.test(pathname));
}

// 注意：SvelteKit的静态构建不会执行server hooks
// 因此我们主要依赖Vite插件来处理构建时的HTML修改
// 这个hook主要用于开发模式
export const handle = async ({ event, resolve }: any) => {
  const response = await resolve(event);

  // 只处理HTML响应
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("text/html")) {
    return response;
  }

  const pathname = event.url.pathname;

  // 读取并修改HTML
  const html = await response.text();
  let modifiedHtml = html;

  if (isBmsTablePath(pathname)) {
    // BMS表格页面，注入bmstable meta
    const bmstableMeta = `<meta name="bmstable" content="./header.json" />`;
    modifiedHtml = html.replace("%bmstable.meta%", bmstableMeta);
  } else {
    // 非BMS表格页面，移除占位符
    modifiedHtml = html.replace("%bmstable.meta%", "");
  }

  return new Response(modifiedHtml, {
    headers: response.headers,
  });
};
