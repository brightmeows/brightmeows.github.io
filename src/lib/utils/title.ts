import { m } from "$lib/paraglide/messages.js";

export function formatTitle(title: string): string {
  return `${title} - ${m["site.name"]()}`;
}
