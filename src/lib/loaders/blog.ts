import { resolve } from "node:path";

import { scanBlogDirectory } from "./blog-scanner";

import { BLOG_DIR } from "#lib/constants/blog.js";
import type { BlogPost } from "#lib/types/blog.js";

let cached: BlogPost[] | null = null;

/** 博客文章清单（进程内缓存，SSG 单进程构建安全）。 */
export function getBlogPosts(): BlogPost[] {
  cached ??= scanBlogDirectory(resolve(process.cwd(), BLOG_DIR));
  return cached;
}
