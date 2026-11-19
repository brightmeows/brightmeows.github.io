/**
 * SvelTeX 类型声明
 *
 * 为 Markdown 和 Svx 文件提供 TypeScript 类型支持。
 * SvelTeX 预处理器将 Markdown 文件编译为 Svelte 组件，并把 frontmatter
 * 解析结果导出为 `metadata`（形状与 frontmatter 一一对应）。
 */

declare module "*.md" {
  import type { Component } from "svelte";

  import type { PostFrontmatter } from "#lib/types/post.js";

  const component: Component;
  export default component;
  export const metadata: PostFrontmatter | undefined;
}

declare module "*.svx" {
  import type { Component } from "svelte";

  import type { PostFrontmatter } from "#lib/types/post.js";

  const component: Component;
  export default component;
  export const metadata: PostFrontmatter | undefined;
}
/**
 * Markdown 模块类型声明：*.md/*.svx 导出 default（Svelte 组件）与 metadata
 * （frontmatter 镜像，类型 Partial<PostMetadata>），读取方式为
 * post.metadata?.title（与 mdsvex 摊平成独立命名导出的行为不同）。
 */
