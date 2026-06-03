export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * 已知路径片段 → 显示标签的映射。
 * 未收录的片段按原样显示（如 table ID、博客 slug），
 * 可通过 `currentLabel` 覆写最后一段的标签。
 */
const segmentLabelMap: Record<string, string> = {
  bms: "BMS",
  table: "难度表",
  mirror: "难度表镜像",
  blog: "博客",
};

/**
 * 根据 URL pathname 自动推导面包屑链。
 *
 * @param pathname  当前页面路径（`page.url.pathname`）
 * @param currentLabel  可选，覆写最后一段的显示标签（用于动态数据如难度表名、文章标题）
 * @returns 面包屑数组，最后一项不带 href
 *
 * 示例：
 *   deriveBreadcrumbs("/bms/table/self-sp", "BrightMeowS譜面合集（SP）")
 *   → [{label:"主页",href:"/"}, {label:"BMS",href:"/bms"}, {label:"难度表",href:"/bms/table"}, {label:"BrightMeowS譜面合集（SP）"}]
 */
export function deriveBreadcrumbs(pathname: string, currentLabel?: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "主页", href: "/" }];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    if (isLast && currentLabel !== undefined) {
      items.push({ label: currentLabel });
    } else {
      const label = segmentLabelMap[segment] ?? segment;
      if (isLast) {
        items.push({ label });
      } else {
        items.push({ label, href: currentPath });
      }
    }
  }

  return items;
}
