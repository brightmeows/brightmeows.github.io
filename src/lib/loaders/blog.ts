import { resolve } from "node:path";

import { BLOG_DIR } from "$lib/constants/blog";
import type { BlogPost } from "$lib/types/blog";
import { scanBlogDirectory } from "$lib/utils/blog-scanner";

let cached: BlogPost[] | null = null;

export function getBlogPosts(): BlogPost[] {
  cached ??= scanBlogDirectory(resolve(process.cwd(), BLOG_DIR));
  return cached;
}
