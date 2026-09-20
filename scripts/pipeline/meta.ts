/**
 * 从 HTML 提取 header JSON 地址。
 *
 * 用 parse5 解析：属性值里的 HTML 实体由解析器自动解码，这正是
 * bmsdb.hexlataia.xyz 这类站点能正常工作的前提（content 里带 `&amp;`）。
 *
 * 提取顺序与旧实现一致：优先 `<meta name|property="bmstable">`，其后依次
 * 尝试 link[rel=bmstable]、a[href]、link[href]、script[src]、meta[content]
 * 中形如 `*header*.json` 的地址，最后退回全文扫描（实测仍有站点依赖该链，
 * 例如 upl.konjiki.jp）。
 */

import { parse } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

function isElement(node: Node): node is Element {
  return "tagName" in node && "attrs" in node;
}

function childrenOf(node: Node): readonly Node[] {
  const candidate = node as {
    childNodes?: readonly Node[];
    content?: { childNodes?: readonly Node[] };
  };
  if (candidate.childNodes !== undefined) {
    return candidate.childNodes;
  }
  if (candidate.content?.childNodes !== undefined) {
    return candidate.content.childNodes;
  }
  return [];
}

function attrValue(element: Element, name: string): string | null {
  for (const attr of element.attrs) {
    if (attr.name.toLowerCase() === name) {
      return attr.value;
    }
  }
  return null;
}

/** 按文档顺序收集全部元素。 */
function collectElements(html: string): Element[] {
  const document = parse(html);
  const elements: Element[] = [];
  const stack: Node[] = [document];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      break;
    }
    if (isElement(node)) {
      elements.push(node);
    }
    const children = childrenOf(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) {
        stack.push(child);
      }
    }
  }
  return elements;
}

/** `<meta name|property="bmstable">` 的 content（不做其它回退）。 */
export function extractBmstableContent(html: string): string | null {
  for (const element of collectElements(html)) {
    if (element.tagName.toLowerCase() !== "meta") {
      continue;
    }
    const marker = attrValue(element, "name") ?? attrValue(element, "property");
    if (marker?.toLowerCase() !== "bmstable") {
      continue;
    }
    const content = attrValue(element, "content");
    if (content !== null && content !== "") {
      return content;
    }
  }
  return null;
}

/** 与旧实现一致的判断：含 `header` 且以 `.json` 结尾。 */
function looksLikeHeaderJson(value: string): boolean {
  const lower = asciiLower(value);
  return lower.includes("header") && lower.endsWith(".json");
}

/** 长度不变的 ASCII 小写化，保证偏移量与原文一致。 */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/gu, (char) => char.toLowerCase());
}

function findFirstHref(
  elements: readonly Element[],
  tagName: string,
  attr: string,
  keep: (element: Element, value: string) => boolean
): string | null {
  for (const element of elements) {
    if (element.tagName.toLowerCase() !== tagName) {
      continue;
    }
    const value = attrValue(element, attr);
    if (value !== null && value !== "" && keep(element, value)) {
      return value;
    }
  }
  return null;
}

/** 全文扫描：`header` 之后出现 `.json`，起点回溯到最近的引号或空白之后。 */
export function findHeaderJsonInText(text: string): string | null {
  const lower = asciiLower(text);
  let position = 0;
  while (position < lower.length) {
    const index = lower.indexOf("header", position);
    if (index === -1) {
      return null;
    }
    const json = lower.indexOf(".json", index);
    if (json !== -1) {
      const end = json + ".json".length;
      let start = index;
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const char = lower[cursor];
        if (
          char === '"' ||
          char === "'" ||
          char === " " ||
          char === "\t" ||
          char === "\n" ||
          char === "\r" ||
          char === "\f" ||
          char === "\v"
        ) {
          start = cursor + 1;
          break;
        }
      }
      if (end > start) {
        return text.slice(start, end);
      }
    }
    position = index + "header".length;
  }
  return null;
}

/** 按旧实现的顺序提取 header JSON 地址；全部失败返回 null。 */
export function extractBmstableUrlHint(html: string): string | null {
  const elements = collectElements(html);

  const meta = extractBmstableContent(html);
  if (meta !== null) {
    return meta;
  }

  const linkRel = findFirstHref(
    elements,
    "link",
    "href",
    (element, value) => attrValue(element, "rel")?.toLowerCase() === "bmstable" && value !== ""
  );
  if (linkRel !== null) {
    return linkRel;
  }

  const anchor = findFirstHref(elements, "a", "href", (_element, value) =>
    looksLikeHeaderJson(value)
  );
  if (anchor !== null) {
    return anchor;
  }

  const linkHref = findFirstHref(elements, "link", "href", (_element, value) =>
    looksLikeHeaderJson(value)
  );
  if (linkHref !== null) {
    return linkHref;
  }

  const scriptSrc = findFirstHref(elements, "script", "src", (_element, value) =>
    looksLikeHeaderJson(value)
  );
  if (scriptSrc !== null) {
    return scriptSrc;
  }

  const metaContent = findFirstHref(elements, "meta", "content", (_element, value) =>
    looksLikeHeaderJson(value)
  );
  if (metaContent !== null) {
    return metaContent;
  }

  return findHeaderJsonInText(html);
}
