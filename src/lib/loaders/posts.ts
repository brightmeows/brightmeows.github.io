import { resolve } from "node:path";

import { scanPostsDirectory } from "./post-scanner";

import {
  POSTS_DIR,
  POST_CATEGORIES,
  RESERVED_TOP_LEVEL_PATHS,
  type CategoryId,
} from "#lib/constants/content.js";
import type { Post } from "#lib/types/post.js";
import { selectHomePosts } from "#lib/utils/content/categories.js";

let cached: Post[] | null = null;

function getAllPosts(): Post[] {
  cached ??= scanPostsDirectory(
    resolve(process.cwd(), POSTS_DIR),
    POST_CATEGORIES,
    RESERVED_TOP_LEVEL_PATHS
  );
  return cached;
}

/**
 * 指定分类的文章清单。
 * @param category - 分类 id
 * @returns 该分类的文章
 */
export function getPostsByCategory(category: CategoryId): Post[] {
  return getAllPosts().filter((post) => post.category === category);
}

/**
 * 首页文章：只取 featuredOnHome 分类，按 order 优先排序后截取。
 * @param limit - 最多返回条数
 * @returns 首页文章
 */
export function getHomePosts(limit = 5): Post[] {
  return selectHomePosts(getAllPosts(), POST_CATEGORIES, limit);
}
