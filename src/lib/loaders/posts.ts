import { resolve } from "node:path";

import { scanPostsDirectory } from "./post-scanner";

import { POSTS_DIR } from "#lib/constants/content.js";
import type { Post } from "#lib/types/post.js";

let cached: Post[] | null = null;

/** 内容文章清单（进程内缓存，SSG 单进程构建安全）。 */
export function getPosts(): Post[] {
  cached ??= scanPostsDirectory(resolve(process.cwd(), POSTS_DIR));
  return cached;
}
