const SITE_NAME = "白喵斯的小屋";

export function formatTitle(title: string): string {
  return `${title} - ${SITE_NAME}`;
}

export function formatBlogPostTitle(postTitle: string): string {
  return `${postTitle} - ${SITE_NAME}`;
}

export function formatBmsTableTitle(tableTitle: string): string {
  return `${tableTitle} - ${SITE_NAME}`;
}

export { SITE_NAME };
