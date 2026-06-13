import type { NavChild } from "$lib/types/ui";

export const navChildren: NavChild[] = [
  { href: "/bms", title: "BMS 主页", description: "BMS 相关内容" },
  { href: "/blog", title: "博客", description: "博客文章" },
];

export const navShortcuts: NavChild[] = [
  {
    href: "/bms/table/mirror",
    title: "BMS 难度表镜像",
    description: "BMS 难度表镜像列表（支持多语言搜索）",
  },
  {
    href: "/bms/table/search",
    title: "BMS 难度表搜索",
    description: "BMS 难度表快捷搜索",
  },
  {
    href: "/bms/table/self-sp",
    title: "个人难度表（SP）",
    description: "个人 SP 难度表",
  },
  {
    href: "/bms/table/self-dp",
    title: "个人难度表（DP）",
    description: "个人 DP 难度表",
  },
];
