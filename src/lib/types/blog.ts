/**
 * Markdown frontmatter 的镜像，字段均可缺省
 */
export interface BlogFrontmatter {
  title?: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  tags?: string[];
}

export interface BlogPostMetadata extends BlogFrontmatter {
  title: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  order?: number;
  date?: string;
  firstSentence: string;
  url: string;
}
