/**
 * Markdown frontmatter 的镜像，字段均可缺省
 */
export interface PostFrontmatter {
  title?: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  tags?: string[];
}

export interface PostMetadata extends PostFrontmatter {
  title: string;
}

export interface Post {
  slug: string;
  title: string;
  order?: number | undefined;
  date?: string | undefined;
  firstSentence: string;
  url: string;
}
