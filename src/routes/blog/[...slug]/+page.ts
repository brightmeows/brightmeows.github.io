import type { Component } from "svelte";

import type { PageLoad } from "./$types";

import type { BlogPostMetadata } from "$lib/types/blog";
import { formatTitle } from "$lib/utils/title";

interface BlogPostModule extends BlogPostMetadata {
  default: Component;
}

/** 从 slug 路径中推测日期 */
function extractDateFromSlug(slug: string): string | undefined {
  const segments = slug.split("/");
  for (const seg of segments) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(seg);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return seg;
  }
  if (segments.length >= 4) {
    const [y, mm, dd] = segments;
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(mm) && /^\d{2}$/.test(dd)) {
      return `${y}-${mm}-${dd}`;
    }
  }
  return undefined;
}

const EPOCH_DATE = "1970-01-01";

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug.replace(/\/$/, "");

  try {
    const post = (await import(`$blog/${slug}.md`)) as BlogPostModule;

    // 元数据优先使用 frontmatter 导出，无 frontmatter 时从 slug 推算
    const title = post.title ?? slug;
    const date = post.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

    return {
      post: { slug, title, date, order: post.order },
      component: post.default,
      title: formatTitle(title),
    };
  } catch {
    throw new Error(`Post not found: ${slug}`);
  }
};
