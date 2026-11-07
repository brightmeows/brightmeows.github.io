import type { PageServerLoad } from "./$types";

import { READING_BOOKS } from "#lib/constants/content.js";
import { getPostsByCategory } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { lookup } from "#lib/utils/infra/object.js";
import { formatTitle } from "#lib/utils/title.js";

/** 书架条目：分类内按 slug 首段分组出的一本书。 */
interface ReadingBook {
  id: string;
  title: string;
  description: string;
  chapterCount: number;
  href: string;
}

/** 书的描述文案（按书 id 显式映射，保证 i18n 引用可被静态扫描）。 */
const bookDescriptions: Record<string, () => string> = {
  compendium: () => m["content.reading.compendium_desc"](),
};

/** 阅读区书架页 SSG 数据：按书分组（/reading/ 只展示书这一层）。 */
export const load: PageServerLoad = () => {
  const posts = getPostsByCategory("reading");
  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const book = post.slug.split("/")[0] ?? post.slug;
    const list = groups.get(book) ?? [];
    list.push(post);
    groups.set(book, list);
  }
  const books: ReadingBook[] = [...groups.entries()].map(([id, list]) => ({
    id,
    title: lookup(READING_BOOKS, id) ?? id,
    description: (bookDescriptions[id] ?? (() => ""))(),
    chapterCount: list.length,
    href: `/reading/${id}/`,
  }));

  return {
    books,
    title: formatTitle(m["content.category.reading"]()),
  };
};
