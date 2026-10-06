import { resolve } from "node:path";

import { scanBlogDirectory } from "./blog-scanner";

import { BLOG_DIR } from "#lib/constants/blog.js";
import type { BlogPost } from "#lib/types/blog.js";

let cached: BlogPost[] | null = null;

export function getBlogPosts(): BlogPost[] {
  cached ??= scanBlogDirectory(resolve(process.cwd(), BLOG_DIR));
  return cached;
}
