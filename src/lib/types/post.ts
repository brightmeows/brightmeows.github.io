import type { Component } from "svelte";

import type { CategoryId } from "#lib/constants/content.js";

/**
 * Markdown frontmatter 的镜像，字段均可缺省
 */
export interface PostFrontmatter {
  title?: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  /** robots meta 内容（如 noindex, follow）；缺省不输出该标签。 */
  robots?: string;
  tags?: string[];
}

export interface PostMetadata extends PostFrontmatter {
  title: string;
}

export interface Post {
  category: CategoryId;
  slug: string;
  title: string;
  order?: number | undefined;
  date?: string | undefined;
  firstSentence: string;
  url: string;
}

/** SvelTeX 处理后的 Markdown 模块形状（动态 import 与 import.meta.glob 的目标类型）。 */
export interface PostModule {
  default: Component;
  metadata?: Partial<PostMetadata>;
}
