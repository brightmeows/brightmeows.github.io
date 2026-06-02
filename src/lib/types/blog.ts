export interface BlogPostMetadata {
  title: string;
  date?: string;
  order?: number;
  slug?: string;
  description?: string;
  tags?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  order?: number;
  date?: string;
  firstSentence: string;
  url: string;
}
