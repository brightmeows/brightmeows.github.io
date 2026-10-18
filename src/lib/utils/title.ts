import { m } from "#lib/paraglide/messages.js";

/** 页面标题：附加站点名后缀。 */
export function formatTitle(title: string): string {
  return `${title} - ${m["site.name"]()}`;
}
