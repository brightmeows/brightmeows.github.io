import type { PostCategory } from "#lib/constants/content.js";
import type { Post } from "#lib/types/post.js";

/**
 * 校验分类注册表：id 唯一、格式合法、不占保留顶层路径、首页分类恰好一个。
 * @param categories - 分类注册表
 * @param reservedPaths - 分类 id 不得占用的顶层路径
 * @returns 问题列表，空数组表示通过
 */
export function validateCategories(
  categories: readonly PostCategory[],
  reservedPaths: readonly string[]
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  const reserved = new Set(reservedPaths);

  for (const category of categories) {
    if (!/^[a-z][a-z0-9-]*$/.test(category.id)) {
      issues.push(`分类 id 必须是 kebab-case：${category.id}`);
    }
    if (seen.has(category.id)) {
      issues.push(`分类 id 重复：${category.id}`);
    }
    seen.add(category.id);
    if (reserved.has(category.id)) {
      issues.push(`分类 id 占用了保留顶层路径：${category.id}`);
    }
  }

  const homeCount = categories.filter((category) => category.featuredOnHome).length;
  if (homeCount !== 1) {
    issues.push(`featuredOnHome 必须恰好一个，实际为 ${homeCount}`);
  }

  return issues;
}

/**
 * 找出同一分类内重复的 slug；不同分类的同名 slug 合法。
 * @param posts - 内容文章列表
 * @returns 重复的 `分类/slug` 键
 */
export function duplicateSlugs(posts: readonly Post[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const post of posts) {
    const key = `${post.category}/${post.slug}`;
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }

  return [...duplicates];
}

/**
 * 文章与章节共用的排序键：有 order 的在前并按 order 升序；其余按 date 降序；缺 date 排后。
 * 构建期列表（sortPosts）与 reading 正文页的章间导航（[...slug]/+page.ts）
 * 共用此比较器，两侧顺序恒一致。
 * @param posts - 内容文章列表
 * @param a - 比较左值
 * @param b - 比较右值
 * @returns 排序后的新数组
 */
export function sortPosts(posts: readonly Post[]): Post[] {
  return [...posts].sort(compareByOrderThenDate);
}

/**
 * order 优先的排序比较器（见 sortPosts 语义）。
 */
export function compareByOrderThenDate(
  a: Pick<Post, "order" | "date">,
  b: Pick<Post, "order" | "date">
): number {
  if (a.order !== undefined && b.order !== undefined) {
    return a.order - b.order;
  }
  if (a.order !== undefined) {
    return -1;
  }
  if (b.order !== undefined) {
    return 1;
  }
  return compareDates(a.date, b.date);
}

function compareDates(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) {
    return 0;
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return new Date(b).getTime() - new Date(a).getTime();
}

/**
 * 首页取数：只取 featuredOnHome 分类，排序后截断。
 * @param posts - 内容文章列表
 * @param categories - 分类注册表
 * @param limit - 最多返回条数
 * @returns 首页文章
 */
export function selectHomePosts(
  posts: readonly Post[],
  categories: readonly PostCategory[],
  limit = 5
): Post[] {
  const featured = new Set(
    categories.filter((category) => category.featuredOnHome).map((category) => category.id)
  );

  return sortPosts(posts.filter((post) => featured.has(post.category))).slice(0, limit);
}
