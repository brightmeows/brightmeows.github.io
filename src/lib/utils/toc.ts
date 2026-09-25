import { m } from "$lib/paraglide/messages.js";
import type { Tag1Group } from "$lib/types/bms";
import type { TocItem } from "$lib/types/ui";
import { slugifyTag } from "$lib/utils/mirror-tables";

/**
 * 为分组构建 TOC 项
 */
export function buildGroupTocItems(groups: Tag1Group[]): TocItem[] {
  return groups.map((g) => ({
    id: `tag1-group-${slugifyTag(g.tag1) || "untagged"}`,
    title: m["toc.group"]({ name: g.tag1 }),
    href: `#tag1-group-${slugifyTag(g.tag1) || "untagged"}`,
    children: g.subgroups.map((sg) => ({
      id: `tag2-group-${slugifyTag(g.tag1) || "untagged"}-${slugifyTag(sg.tag2) || "untagged"}`,
      title: `${sg.tag2} (${sg.items.length})`,
      href: `#tag2-group-${slugifyTag(g.tag1) || "untagged"}-${slugifyTag(sg.tag2) || "untagged"}`,
    })),
  }));
}
