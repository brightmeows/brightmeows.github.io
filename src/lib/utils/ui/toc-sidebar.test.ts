import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChapterTocItems,
  parseSidebarFlag,
  readSidebarFlag,
  writeSidebarFlag,
} from "./toc-sidebar";

class FakeStorage {
  #map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }
}

describe("parseSidebarFlag", () => {
  it('"1" 为真，"0" 为假', () => {
    expect(parseSidebarFlag("1", false)).toBe(true);
    expect(parseSidebarFlag("0", true)).toBe(false);
  });

  it("缺省（null）与非法值回退 fallback", () => {
    expect(parseSidebarFlag(null, true)).toBe(true);
    expect(parseSidebarFlag(null, false)).toBe(false);
    expect(parseSidebarFlag("", false)).toBe(false);
    expect(parseSidebarFlag("yes", false)).toBe(false);
  });
});

describe("侧栏旗标存取", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("写入后可读回，无存储值回退 fallback", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    writeSidebarFlag("tocSidebar.collapsed", true);
    expect(readSidebarFlag("tocSidebar.collapsed", false)).toBe(true);
    writeSidebarFlag("tocSidebar.collapsed", false);
    expect(readSidebarFlag("tocSidebar.collapsed", true)).toBe(false);
    expect(readSidebarFlag("missing", true)).toBe(true);
    expect(readSidebarFlag("missing", false)).toBe(false);
  });
});

describe("buildChapterTocItems", () => {
  it("映射章节为目录外链项，id 按序号生成，current 不进入目录项", () => {
    const items = buildChapterTocItems({
      bookHref: "/reading/compendium/",
      bookTitle: "Maths-CS-AI Compendium",
      items: [
        { href: "/reading/compendium/00-introduction/", title: "导读与学习路线", current: true },
        { href: "/reading/compendium/01-vectors/", title: "向量", current: false },
      ],
    });
    expect(items).toEqual([
      { id: "chapter-0", title: "导读与学习路线", href: "/reading/compendium/00-introduction/" },
      { id: "chapter-1", title: "向量", href: "/reading/compendium/01-vectors/" },
    ]);
  });
});
