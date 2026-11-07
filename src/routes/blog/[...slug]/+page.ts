import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { extractDateFromSlug, EPOCH_DATE } from "#lib/utils/infra/date.js";
import { isPostModule } from "#lib/utils/infra/post-module.js";
import { formatTitle } from "#lib/utils/title.js";

/** 博客分类正文页数据：按 slug 动态 import Markdown 模块，返回组件与元数据。 */
export const load: PageLoad = async ({ params }) => {
  const slug = params.slug.replace(/\/$/, "");

  try {
    const post: unknown = await import(`#posts/blog/${slug}.md`);
    if (!isPostModule(post)) {
      throw new Error(`invalid post module: ${slug}`);
    }
    const meta = post.metadata ?? {};

    // 元数据优先使用 frontmatter 导出，无 frontmatter 时从 slug 推算
    const title = meta.title ?? slug;
    const date = meta.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

    return {
      post: { slug, title, date, order: meta.order },
      component: post.default,
      title: formatTitle(title),
    };
  } catch {
    // SvelteKit error() 是官方 404 模式，返回 never（内部 throw HttpError）
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error(404, `Post not found: ${slug}`);
  }
};
