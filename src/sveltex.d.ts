/**
 * SvelTeX 类型声明
 *
 * 为 Markdown 和 Svx 文件提供 TypeScript 类型支持。
 * SvelTeX 预处理器将 Markdown 文件编译为 Svelte 组件，并把 frontmatter
 * 解析结果导出为 `metadata`（形状与 frontmatter 一一对应）。
 */

declare module "*.md" {
  import type { Component } from "svelte";

  import type { BlogPostMetadata } from "$lib/types/blog";

  const component: Component;
  export default component;
  export const metadata: Partial<BlogPostMetadata> | undefined;
}

declare module "*.svx" {
  import type { Component } from "svelte";

  import type { BlogPostMetadata } from "$lib/types/blog";

  const component: Component;
  export default component;
  export const metadata: Partial<BlogPostMetadata> | undefined;
}
