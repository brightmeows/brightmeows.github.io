import type { BlogFrontmatter } from "$lib/types/blog";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 校验 Markdown frontmatter 的字段类型与格式
 *
 * frontmatter 来自磁盘文件，类型系统覆盖不到；非法值会让页面在运行时悄悄变坏，
 * 因此在构建期直接抛错。
 *
 * @param data - gray-matter 解析出的原始数据
 * @param source - 出错信息中显示的文件来源
 * @returns 校验通过的 frontmatter
 */
export function validateFrontmatter(data: unknown, source: string): BlogFrontmatter {
  if (!isRecord(data)) {
    throw new Error(`${source}: frontmatter 必须是键值映射`);
  }

  const result: BlogFrontmatter = {};
  const { title, date, order, slug, description, tags } = data;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error(`${source}: title 必须是非空字符串，实际为 ${JSON.stringify(title)}`);
    }
    result.title = title;
  }
  if (date !== undefined) {
    if (typeof date !== "string" || !DATE_PATTERN.test(date) || Number.isNaN(Date.parse(date))) {
      throw new Error(
        `${source}: date 必须是 YYYY-MM-DD 格式的合法日期，实际为 ${JSON.stringify(date)}`
      );
    }
    result.date = date;
  }
  if (order !== undefined) {
    if (typeof order !== "number" || !Number.isInteger(order)) {
      throw new Error(`${source}: order 必须是整数，实际为 ${JSON.stringify(order)}`);
    }
    result.order = order;
  }
  if (slug !== undefined) {
    if (typeof slug !== "string" || slug.trim().length === 0) {
      throw new Error(`${source}: slug 必须是非空字符串，实际为 ${JSON.stringify(slug)}`);
    }
    result.slug = slug;
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      throw new Error(`${source}: description 必须是字符串，实际为 ${JSON.stringify(description)}`);
    }
    result.description = description;
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === "string")) {
      throw new Error(`${source}: tags 必须是字符串数组，实际为 ${JSON.stringify(tags)}`);
    }
    result.tags = tags;
  }

  return result;
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
