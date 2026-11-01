import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";

import type { Post } from "../types/post";

import { extractFirstSentence, validateFrontmatter } from "./post-metadata";

import { extractDateFromSlug, EPOCH_DATE } from "#lib/utils/infra/date.js";

/**
 * 从 Markdown 内容中提取第一个 ATX 标题（# Title）
 */
function extractFirstHeading(content: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim();
}

/**
 * 扫描内容目录并生成索引
 * @param postsDir - 内容目录路径
 * @param basePath - URL 基础路径（通常为空或 BASE_PATH 环境变量）
 * @returns 内容文章列表
 */
export function scanPostsDirectory(postsDir: string, basePath = ""): Post[] {
  const posts: Post[] = [];
  const entries = readdirSync(postsDir, { recursive: true });

  for (const entry of entries) {
    // 跳过非字符串条目和非 Markdown 文件
    if (typeof entry !== "string") continue;
    if (!/\.(md|svx)$/.exec(entry)) continue;

    const fullPath = join(postsDir, entry);
    const content = readFileSync(fullPath, "utf-8");
    const parsed = matter(content);
    const metadata = validateFrontmatter(parsed.data, fullPath);

    // 从文件名提取 slug（不含扩展名）
    const filename = entry.replace(/\.(md|svx)$/, "");
    const slug = metadata.slug ?? filename;

    // title：优先 frontmatter，其次第一个标题，最后用 slug
    const title = metadata.title ?? extractFirstHeading(parsed.content) ?? slug;
    // date：优先 frontmatter，其次目录路径，最后 UTC epoch
    const date = metadata.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

    posts.push({
      slug,
      title,
      date,
      order: metadata.order,
      firstSentence: metadata.description ?? extractFirstSentence(content),
      url: `${basePath}/blog/${slug}`,
    });
  }

  return sortPosts(posts);
}

/**
 * 对内容文章进行排序
 * @param posts - 内容文章列表
 * @returns 排序后的内容文章列表
 */
function sortPosts(posts: Post[]): Post[] {
  return posts.sort((a, b) => {
    // order 优先
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    // 然后按 date 降序
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });
}
