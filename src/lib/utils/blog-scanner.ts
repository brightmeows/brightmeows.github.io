import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { BlogPost } from "../types/blog";
import { extractFirstSentence } from "./blog-metadata";

export interface BlogPostMetadata {
  title: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  tags?: string[];
}

/**
 * 扫描博客目录并生成索引
 * @param blogDir - 博客目录路径
 * @param basePath - URL 基础路径（通常为空或 BASE_PATH 环境变量）
 * @returns 博客文章列表
 */
export function scanBlogDirectory(blogDir: string, basePath = ""): BlogPost[] {
  const posts: BlogPost[] = [];
  const entries = readdirSync(blogDir, { recursive: true });

  for (const entry of entries) {
    // 跳过非字符串条目和非 Markdown 文件
    if (typeof entry !== "string") continue;
    if (!entry.match(/\.(md|svx)$/)) continue;

    const fullPath = join(blogDir, entry);
    const content = readFileSync(fullPath, "utf-8");
    const parsed = matter(content);
    const metadata = parsed.data as BlogPostMetadata;

    // 从文件名提取 slug（不含扩展名）
    const filename = entry.replace(/\.(md|svx)$/, "");
    const slug = metadata.slug || filename;

    posts.push({
      slug,
      title: metadata.title,
      date: metadata.date,
      order: metadata.order,
      firstSentence: metadata.description || extractFirstSentence(content),
      url: `${basePath}/blog/${slug}`,
    });
  }

  return sortPosts(posts);
}

/**
 * 对博客文章进行排序
 * @param posts - 博客文章列表
 * @returns 排序后的博客文章列表
 */
function sortPosts(posts: BlogPost[]): BlogPost[] {
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
