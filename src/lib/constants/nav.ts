/**
 * 站内导航数据的单一来源，由顶栏（TopBar）消费。
 *
 * 内容区 NavPane 卡片导航移除后，原 routes/ 下各层 nav.ts 在此收敛：
 * 顶层链接常驻长栏左侧，“更多”菜单静态收录全部子页入口（已去重），
 * 不随页面变化。路径均为站内绝对路径，渲染时经 resolve() 处理 base。
 */

export interface NavItem {
  /** 站内绝对路径 */
  href: string;
  /** 显示文本 */
  label: string;
}

/** 长栏左侧的顶层链接。 */
export const topLevelNav: NavItem[] = [
  { href: "/", label: "主页" },
  { href: "/bms", label: "BMS" },
  { href: "/blog", label: "博客" },
];

/** “更多”菜单的静态全量子页入口。 */
export const moreNav: NavItem[] = [
  { href: "/bms/table", label: "难度表" },
  { href: "/bms/table/mirror", label: "难度表镜像" },
  { href: "/bms/table/search", label: "谱面搜索" },
  { href: "/bms/table/self-sp", label: "个人难度表（SP）" },
  { href: "/bms/table/self-dp", label: "个人难度表（DP）" },
];
