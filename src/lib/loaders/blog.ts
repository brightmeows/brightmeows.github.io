import { resolve } from "node:path";

import { BLOG_DIR } from "$lib/constants/blog";
import { scanBlogDirectory } from "$lib/utils/blog-scanner";
import type { BlogPost } from "$lib/types/blog";

let cached: BlogPost[] | null = null;

export function getBlogPosts(): BlogPost[] {
  if (!cached) {
    cached = scanBlogDirectory(resolve(process.cwd(), BLOG_DIR));
  }
  return cached;
}
