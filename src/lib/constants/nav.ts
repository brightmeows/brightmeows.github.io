/**
 * 站内导航数据的单一来源，由顶栏（TopBar）消费。
 *
 * label 为延迟求值的显示文本：locale 由根 layout load 注入，
 * 模块顶层不能求值消息，故保留为函数。
 *
 * 内容区 NavPane 卡片导航移除后，原 routes/ 下各层 nav.ts 在此收敛：
 * 顶层链接常驻长栏左侧，/bms 子树整体折叠为顶层 BMS 项的下拉菜单
 * （不再单独设“更多”菜单），不随页面变化。路径均为站内绝对路径，
 * 渲染时经 resolve() 处理 base。
 */

import { m } from "$lib/paraglide/messages.js";

export interface NavItem {
  /** 站内绝对路径 */
  href: string;
  /** 显示文本（调用时按当前 locale 求值） */
  label: () => string;
}

/** 顶层下拉导航项：本身也是链接（如 /bms 首页），children 收全部子页入口。 */
export interface NavDropdown extends NavItem {
  children: NavItem[];
}

/** /bms 子树的下拉项，topLevelNav 中唯一带 children 的入口。 */
export const bmsNav: NavDropdown = {
  href: "/bms",
  label: () => m["nav.bms"](),
  children: [
    { href: "/bms", label: () => m["nav.overview"]() },
    { href: "/bms/table", label: () => m["nav.table"]() },
    { href: "/bms/table/mirror", label: () => m["nav.mirror"]() },
    { href: "/bms/table/shared", label: () => m["nav.shared"]() },
    { href: "/bms/table/search", label: () => m["nav.search"]() },
    { href: "/bms/table/self-sp", label: () => m["nav.self_sp"]() },
    { href: "/bms/table/self-dp", label: () => m["nav.self_dp"]() },
  ],
};

/** 长栏左侧的顶层导航项。 */
export const topLevelNav: (NavItem | NavDropdown)[] = [
  { href: "/", label: () => m["nav.home"]() },
  bmsNav,
  { href: "/blog", label: () => m["nav.blog"]() },
];
