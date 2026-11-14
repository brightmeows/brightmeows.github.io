import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { READING_BOOKS } from "#lib/constants/content.js";
import { m } from "#lib/paraglide/messages.js";
import type { PostModule } from "#lib/types/post.js";
import { compareByOrderThenDate } from "#lib/utils/content/categories.js";
import { extractDateFromSlug, EPOCH_DATE } from "#lib/utils/infra/date.js";
import { lookup } from "#lib/utils/infra/object.js";
import { formatTitle } from "#lib/utils/title.js";

// slug 含书名子目录（compendium/<章>），动态 import 模板经 Vite 静态分析只展开
// 单层 glob，匹配不到两级路径，因此改用显式 ** glob 展开全部分类内容。
const modules = import.meta.glob<PostModule>("#posts/reading/**/*.md");

/** 阅读区正文页数据：按 slug 动态 import Markdown 模块，返回组件与元数据。 */
export const load: PageLoad = async ({ params }) => {
  const slug = params.slug.replace(/\/$/, "");

  try {
    const importer =
      modules[`/content/posts/reading/${slug}.md`] ?? modules[`#posts/reading/${slug}.md`];
    if (!importer) {
      throw new Error(`module not found: ${slug}`);
    }
    // 全集按共享排序键（order 升序、date 降序兜底，见 compareByOrderThenDate）
    // 排序，算出章间导航（prev/next）；与书目录页（构建期 sortPosts）共用
    // 同一比较器，目录顺序与章间导航恒一致。
    const sorted = await Promise.all(
      Object.entries(modules).map(async ([key, loadModule]) => {
        const mod = await loadModule();
        const chapterSlug = key.split("reading/")[1]?.replace(/\.md$/, "") ?? "";
        const meta = mod.metadata ?? {};
        return {
          slug: chapterSlug,
          order: meta.order,
          date: meta.date ?? extractDateFromSlug(chapterSlug),
          title: meta.title ?? "",
        };
      })
    );
    sorted.sort(compareByOrderThenDate);
    const index = sorted.findIndex((entry) => entry.slug === slug);
    const prevEntry = index > 0 ? sorted[index - 1] : undefined;
    const nextEntry = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined;
    const bookId = slug.split("/")[0] ?? "";
    const bookTitle = lookup(READING_BOOKS, bookId);
    const post = await importer();
    const meta = post.metadata ?? {};

    // 元数据优先使用 frontmatter 导出，无 frontmatter 时从 slug 推算
    const title = meta.title ?? slug;
    const date = meta.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

    return {
      post: { slug, title, date, order: meta.order },
      component: post.default,
      title: formatTitle(title),
      description: meta.description,
      prev: prevEntry
        ? {
            href: `/reading/${prevEntry.slug}/`,
            label: m["content.reading.prev_chapter"](),
            title: prevEntry.title,
          }
        : undefined,
      next: nextEntry
        ? {
            href: `/reading/${nextEntry.slug}/`,
            label: m["content.reading.next_chapter"](),
            title: nextEntry.title,
          }
        : undefined,
      chapters: bookTitle
        ? {
            bookHref: `/reading/${bookId}/`,
            bookTitle,
            items: sorted.map((entry) => ({
              href: `/reading/${entry.slug}/`,
              title: entry.title,
              current: entry.slug === slug,
            })),
          }
        : undefined,
    };
  } catch {
    // SvelteKit error() 是官方 404 模式，返回 never（内部 throw HttpError）
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error(404, `Post not found: ${slug}`);
  }
};
