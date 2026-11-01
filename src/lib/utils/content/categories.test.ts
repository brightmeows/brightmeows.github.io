import { describe, expect, it } from "vitest";

import { duplicateSlugs, selectHomePosts, sortPosts, validateCategories } from "./categories";

import type { PostCategory } from "#lib/constants/content.js";
import type { Post } from "#lib/types/post.js";

function makeCategory(id: string, featuredOnHome = false): PostCategory {
  return {
    id,
    label: () => id,
    featuredOnHome,
  };
}

function makePost(overrides: Partial<Post> & Pick<Post, "category" | "slug">): Post {
  return {
    category: overrides.category,
    slug: overrides.slug,
    title: overrides.title ?? overrides.slug,
    order: overrides.order,
    date: overrides.date,
    firstSentence: overrides.firstSentence ?? "",
    url: overrides.url ?? `/${overrides.category}/${overrides.slug}`,
  };
}

describe("validateCategories", () => {
  it("接受合法注册表", () => {
    expect(
      validateCategories([makeCategory("blog", true), makeCategory("notes")], ["bms"])
    ).toEqual([]);
  });

  it("报告重复 id", () => {
    const issues = validateCategories([makeCategory("blog", true), makeCategory("blog")], []);
    expect(issues).toContain("分类 id 重复：blog");
  });

  it("报告非法 id 格式", () => {
    const issues = validateCategories([makeCategory("Blog", true)], []);
    expect(issues).toContain("分类 id 必须是 kebab-case：Blog");
  });

  it("报告占用保留顶层路径", () => {
    const issues = validateCategories([makeCategory("bms", true)], ["bms"]);
    expect(issues).toContain("分类 id 占用了保留顶层路径：bms");
  });

  it("要求恰好一个首页分类", () => {
    expect(validateCategories([makeCategory("blog"), makeCategory("notes")], [])).toContain(
      "featuredOnHome 必须恰好一个，实际为 0"
    );
    expect(
      validateCategories([makeCategory("blog", true), makeCategory("notes", true)], [])
    ).toContain("featuredOnHome 必须恰好一个，实际为 2");
  });
});

describe("duplicateSlugs", () => {
  it("同一分类内同名 slug 视为重复", () => {
    expect(
      duplicateSlugs([
        makePost({ category: "blog", slug: "same" }),
        makePost({ category: "blog", slug: "same" }),
      ])
    ).toEqual(["blog/same"]);
  });

  it("不同分类的同名 slug 合法", () => {
    expect(
      duplicateSlugs([
        makePost({ category: "blog", slug: "same" }),
        makePost({ category: "notes", slug: "same" }),
      ])
    ).toEqual([]);
  });
});

describe("sortPosts", () => {
  it("order 优先，其余按日期降序，缺日期排后", () => {
    const posts = [
      makePost({ category: "blog", slug: "order-2", order: 2 }),
      makePost({ category: "blog", slug: "order-1", order: 1 }),
      makePost({ category: "blog", slug: "date-old", date: "2026-01-01" }),
      makePost({ category: "blog", slug: "date-new", date: "2026-02-01" }),
      makePost({ category: "blog", slug: "no-date" }),
    ];

    expect(sortPosts(posts).map((post) => post.slug)).toEqual([
      "order-1",
      "order-2",
      "date-new",
      "date-old",
      "no-date",
    ]);
  });

  it("不修改输入数组", () => {
    const posts = [
      makePost({ category: "blog", slug: "a", order: 2 }),
      makePost({ category: "blog", slug: "b", order: 1 }),
    ];

    sortPosts(posts);
    expect(posts.map((post) => post.slug)).toEqual(["a", "b"]);
  });
});

describe("selectHomePosts", () => {
  const categories = [makeCategory("blog", true), makeCategory("notes")];

  it("只取 featuredOnHome 分类并排序截断", () => {
    const posts = [
      makePost({ category: "notes", slug: "note", date: "2026-03-01" }),
      makePost({ category: "blog", slug: "old", date: "2025-01-01" }),
      makePost({ category: "blog", slug: "new", date: "2026-01-01" }),
      makePost({ category: "blog", slug: "pinned", order: 0, date: "2020-01-01" }),
    ];

    expect(selectHomePosts(posts, categories).map((post) => post.slug)).toEqual([
      "pinned",
      "new",
      "old",
    ]);
    expect(selectHomePosts(posts, categories, 1).map((post) => post.slug)).toEqual(["pinned"]);
  });

  it("没有匹配分类时返回空数组", () => {
    expect(
      selectHomePosts([makePost({ category: "notes", slug: "note" })], [makeCategory("notes")])
    ).toEqual([]);
  });
});
