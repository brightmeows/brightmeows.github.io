import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import matter from "gray-matter";

import type { CategoryId, PostCategory } from "../constants/content";
import type { Post } from "../types/post";

import { extractFirstSentence, validateFrontmatter } from "./post-metadata";

import { duplicateSlugs, sortPosts, validateCategories } from "#lib/utils/content/categories.js";
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
 *
 * 分类由 `content/posts/<id>/` 的顶层目录决定；注册表负责文案与首页标记。
 * 目录结构、文件扩展名、slug 与首页分类都在这里做构建期断言，坏数据直接
 * 让构建失败。
 *
 * @param postsDir - 内容目录路径
 * @param categories - 分类注册表
 * @param reservedPaths - 分类 id 不得占用的顶层路径
 * @param basePath - URL 基础路径（通常为空或 BASE_PATH 环境变量）
 * @returns 内容文章列表
 */
export function scanPostsDirectory(
  postsDir: string,
  categories: readonly PostCategory<CategoryId>[],
  reservedPaths: readonly string[],
  basePath = ""
): Post[] {
  const categoryIssues = validateCategories(categories, reservedPaths);
  if (categoryIssues.length > 0) {
    throw new Error(categoryIssues.join("\n"));
  }

  const categoryIds = new Set<string>(categories.map((category) => category.id));
  const rootEntries = readdirSync(postsDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isDirectory()) {
      if (!categoryIds.has(entry.name)) {
        throw new Error(`content/posts 下存在未登记分类目录：${entry.name}`);
      }
      continue;
    }
    throw new Error(`content/posts 下存在散落文件：${entry.name}`);
  }

  const posts: Post[] = [];
  for (const category of categories) {
    const categoryDir = join(postsDir, category.id);
    if (!existsSync(categoryDir) || !statSync(categoryDir).isDirectory()) {
      throw new Error(`分类目录不存在：${category.id}`);
    }

    const entries = readdirSync(categoryDir, { recursive: true, encoding: "utf8" });
    for (const entry of entries) {
      const fullPath = join(categoryDir, entry);
      if (statSync(fullPath).isDirectory()) continue;
      if (!entry.endsWith(".md")) {
        throw new Error(`内容目录只支持 .md 文件：${fullPath}`);
      }

      const content = readFileSync(fullPath, "utf-8");
      const parsed = matter(content);
      const metadata = validateFrontmatter(parsed.data, fullPath);
      const slug = entry.slice(0, -3).split(sep).join("/");

      if (metadata.slug !== undefined && metadata.slug !== slug) {
        throw new Error(`${fullPath}: metadata.slug 必须等于文件相对路径（${slug}）`);
      }

      const title = metadata.title ?? extractFirstHeading(parsed.content) ?? slug;
      const date = metadata.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

      posts.push({
        category: category.id,
        slug,
        title,
        date,
        order: metadata.order,
        firstSentence: metadata.description ?? extractFirstSentence(content),
        url: `${basePath}/${category.id}/${slug}`,
      });
    }
  }

  const duplicates = duplicateSlugs(posts);
  if (duplicates.length > 0) {
    throw new Error(`同一分类内 slug 重复：${duplicates.join(", ")}`);
  }

  return sortPosts(posts);
}
