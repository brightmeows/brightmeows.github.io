import matter from "gray-matter";

export interface BlogPostMetadata {
  title: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  tags?: string[];
}

/**
 * 解析 Markdown 文件的 frontmatter 和内容
 * @param content - Markdown 文件内容
 * @returns 解析后的元数据和正文内容
 */
export function parseFrontmatter(content: string): {
  metadata: BlogPostMetadata;
  content: string;
} {
  const parsed = matter(content);
  return {
    metadata: parsed.data as BlogPostMetadata,
    content: parsed.content,
  };
}

/**
 * 从 Markdown 内容中提取第一行作为摘要
 * @param markdown - Markdown 内容
 * @returns 提取的摘要文本
 */
export function extractFirstSentence(markdown: string): string {
  // 移除 frontmatter
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\s*/, "");

  // 移除标题行
  const withoutHeadings = withoutFrontmatter.replace(/^#+\s+.*$/gm, "");

  // 按换行符分割,取第一个非空行
  const lines = withoutHeadings.split(/\n/);
  const firstLine = lines.find((line) => line.trim().length > 0);

  if (firstLine) {
    const trimmed = firstLine.trim();
    // 如果第一行过长(超过 150 字符),截取并添加省略号
    if (trimmed.length > 150) {
      return trimmed.slice(0, 150) + "...";
    }
    return trimmed;
  }

  // 如果没有找到有效行,返回前 100 个字符
  const fallback = withoutHeadings.slice(0, 100).trim();
  return fallback.length > 0 ? fallback + "..." : "暂无预览";
}
