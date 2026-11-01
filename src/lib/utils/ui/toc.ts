import { m } from "#lib/paraglide/messages.js";
import type { Tag1Group } from "#lib/types/bms-view.js";
import type { TocItem } from "#lib/types/ui.js";
import { slugifyHeadingText } from "#lib/utils/infra/slugify.js";
import { slugifyTag } from "#lib/utils/mirror-tables.js";

interface HeadingInfo {
  id: string;
  title: string;
  level: number;
}

export interface BuildTocFromHeadingsOptions {
  root?: ParentNode | null;
  minLevel?: number;
  maxLevel?: number;
}

function collectHeadingInfo(root: ParentNode, minLevel: number, maxLevel: number): HeadingInfo[] {
  const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(
    (el): el is HTMLHeadingElement => el instanceof HTMLHeadingElement
  );

  const usedIds: Record<string, number> = {};
  return headings
    .filter((h) => {
      const level = Number(h.tagName.slice(1));
      return level >= minLevel && level <= maxLevel;
    })
    .map((h) => {
      const text = h.textContent.trim();
      if (!text) return null;

      const baseId = h.id.trim() || slugifyHeadingText(text);
      const currentCount = usedIds[baseId] ?? 0;
      usedIds[baseId] = currentCount + 1;

      if (!h.id.trim()) {
        h.id = currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`;
      }

      return { id: h.id, title: text, level: Number(h.tagName.slice(1)) };
    })
    .filter((v): v is HeadingInfo => v !== null);
}

function buildTreeFromHeadingInfo(
  headingInfo: HeadingInfo[],
  minLevel: number
): (TocItem & { level: number })[] {
  const rootItems: (TocItem & { level: number })[] = [];
  const stack: { level: number; children: (TocItem & { level: number })[] }[] = [
    { level: minLevel - 1, children: rootItems },
  ];

  for (const h of headingInfo) {
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top || h.level > top.level) break;
      stack.pop();
    }
    const parent = stack[stack.length - 1] ?? { level: minLevel - 1, children: rootItems };
    const node: TocItem & { level: number } = {
      id: h.id,
      title: h.title,
      level: h.level,
      children: [],
    };
    parent.children.push(node);
    stack.push({
      level: h.level,
      children: node.children as (TocItem & { level: number })[],
    });
  }

  return rootItems;
}

function stripLevel(nodes: (TocItem & { level: number })[]): TocItem[] {
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    ...(n.children && n.children.length > 0
      ? {
          children: stripLevel(n.children as (TocItem & { level: number })[]),
        }
      : {}),
  }));
}

/** 从渲染后的标题构建目录树，并为缺少 id 的标题补上稳定锚点。 */
export function buildTocFromHeadings(options: BuildTocFromHeadingsOptions = {}): TocItem[] {
  if (typeof document === "undefined") return [];

  const minLevel = options.minLevel ?? 2;
  const maxLevel = options.maxLevel ?? 6;
  const root = options.root ?? document.querySelector("main") ?? document.body;

  const headingInfo = collectHeadingInfo(root, minLevel, maxLevel);
  const tree = buildTreeFromHeadingInfo(headingInfo, minLevel);
  return stripLevel(tree);
}

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
