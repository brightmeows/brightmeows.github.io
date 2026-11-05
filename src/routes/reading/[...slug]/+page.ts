import { error } from "@sveltejs/kit";
import type { Component } from "svelte";

import type { PageLoad } from "./$types";

import type { PostMetadata } from "#lib/types/post.js";
import { extractDateFromSlug, EPOCH_DATE } from "#lib/utils/infra/date.js";
import { formatTitle } from "#lib/utils/title.js";

interface PostModule {
  default: Component;
  metadata?: Partial<PostMetadata>;
}

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
    const post = await importer();
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
