/**
 * 站内导航数据的单一来源，由顶栏（TopBar）消费。
 *
 * label 为延迟求值的显示文本：locale 由根 layout load 注入，
 * 模块顶层不能求值消息，故保留为函数。
 *
 * 内容区 NavPane 卡片导航移除后，原 routes/ 下各层 nav.ts 在此收敛：
 * 顶层链接常驻长栏左侧，/bms 子树按“公共服务 / 个人表”拆成两个顶层
 * 下拉，不随页面变化。路径均为站内绝对路径，渲染时经 resolve() 处理 base。
 */

import { m } from "#lib/paraglide/messages.js";

export interface NavItem {
  /** 站内绝对路径 */
  href: string;
  /** 显示文本（调用时按当前 locale 求值） */
  label: () => string;
}

/** 顶层下拉导航项：按钮展开子页菜单（不跳转），children 收全部子页入口。 */
export interface NavDropdown {
  /** 弹层互斥标识（顶栏内唯一） */
  id: string;
  /** 下拉按钮显示文本（调用时按当前 locale 求值） */
  label: () => string;
  /** 子页入口（当前在任一子页时按钮高亮） */
  children: NavItem[];
}

/** BMS 公共服务下拉：面向全部访客的 BMS 页面，首项为 /bms 概览。 */
export const bmsServicesNav: NavDropdown = {
  id: "bms-services",
  label: () => m["nav.bms_services"](),
  children: [
    { href: "/bms", label: () => m["nav.overview"]() },
    { href: "/bms/table", label: () => m["nav.table"]() },
    { href: "/bms/table/mirror", label: () => m["nav.mirror"]() },
    { href: "/bms/table/shared", label: () => m["nav.shared"]() },
    { href: "/bms/table/search", label: () => m["nav.search"]() },
  ],
};

/** BMS 个人表下拉：自托管的个人难度表。 */
export const bmsPersonalNav: NavDropdown = {
  id: "bms-personal",
  label: () => m["nav.bms_personal"](),
  children: [
    { href: "/bms/table/self-sp", label: () => m["nav.self_sp"]() },
    { href: "/bms/table/self-dp", label: () => m["nav.self_dp"]() },
  ],
};

/** 长栏左侧的顶层导航项。 */
export const topLevelNav: (NavItem | NavDropdown)[] = [
  { href: "/", label: () => m["nav.home"]() },
  bmsServicesNav,
  bmsPersonalNav,
  { href: "/blog", label: () => m["nav.blog"]() },
];
