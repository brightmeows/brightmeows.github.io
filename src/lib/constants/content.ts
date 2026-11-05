import { m } from "#lib/paraglide/messages.js";

/** 内容根目录：`content/posts/<分类>/`。 */
export const POSTS_DIR = "content/posts";

/** 内容分类：目录名即分类 id，label 是导航与列表页标题共用的唯一文案。 */
export interface PostCategory<Id extends string = string> {
  id: Id;
  label: () => string;
  featuredOnHome: boolean;
}

/** 内容分类注册表。新增分类时在这里加一项，并在 content/posts 下建同名目录。 */
export const POST_CATEGORIES = [
  {
    id: "blog",
    label: () => m["content.category.blog"](),
    featuredOnHome: true,
  },
  {
    id: "notes",
    label: () => m["content.category.notes"](),
    featuredOnHome: false,
  },
  {
    id: "reading",
    label: () => m["content.category.reading"](),
    featuredOnHome: false,
  },
] as const satisfies readonly PostCategory[];

/** 注册表里的分类 id 联合类型。 */
export type CategoryId = (typeof POST_CATEGORIES)[number]["id"];

/** 顶层保留路径：分类 id 不得占用，避免新分类覆盖既有路由。 */
export const RESERVED_TOP_LEVEL_PATHS = ["bms", "api", "assets", "_app"] as const;

/**
 * 按 id 取分类。
 * @param id - 注册表内的分类 id
 * @returns 对应分类
 */
export function getCategory(id: CategoryId): PostCategory<CategoryId> {
  const category = POST_CATEGORIES.find((item) => item.id === id);
  if (category === undefined) {
    throw new Error(`Unknown content category: ${id}`);
  }
  return category;
}

/**
 * 首页展示分类。注册表校验保证恰好一个。
 * @returns featuredOnHome 为 true 的分类
 */
export function getHomeCategory(): PostCategory<CategoryId> {
  const category = POST_CATEGORIES.find((item) => item.featuredOnHome);
  if (category === undefined) {
    throw new Error("No featuredOnHome content category configured");
  }
  return category;
}
