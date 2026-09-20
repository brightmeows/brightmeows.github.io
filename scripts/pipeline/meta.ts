/**
 * 从 HTML 提取 `<meta name="bmstable">` 的 content。
 *
 * 用 parse5 解析：属性值里的 HTML 实体由解析器自动解码，这正是
 * bmsdb.hexlataia.xyz 这类站点能正常工作的前提（content 里带 `&amp;`）。
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

function bmstableContent(element: Element): string | null {
  if (element.tagName.toLowerCase() !== "meta") {
    return null;
  }
  const marker = attrValue(element, "name") ?? attrValue(element, "property");
  if (marker?.toLowerCase() !== "bmstable") {
    return null;
  }
  const content = attrValue(element, "content");
  if (content === null || content === "") {
    return null;
  }
  return content;
}

/** 按文档顺序查找第一个 bmstable meta 的 content；找不到返回 null。 */
export function extractBmstableContent(html: string): string | null {
  const document = parse(html);
  const stack: Node[] = [document];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      break;
    }
    if (isElement(node)) {
      const content = bmstableContent(node);
      if (content !== null) {
        return content;
      }
    }
    const children = childrenOf(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) {
        stack.push(child);
      }
    }
  }
  return null;
}
