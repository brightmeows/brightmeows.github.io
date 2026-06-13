import type { NavChild } from "$lib/types/ui";

export const navChildren: NavChild[] = [
  { href: "/bms/table", title: "难度表", description: "浏览所有难度表" },
  {
    href: "/bms/table/mirror",
    title: "难度表镜像",
    description: "BMS 难度表镜像列表（支持多语言搜索）",
  },
  {
    href: "/bms/table/self-sp",
    title: "谱面合集（SP）",
    description: "个人 SP 难度表",
  },
  {
    href: "/bms/table/self-dp",
    title: "谱面合集（DP）",
    description: "个人 DP 难度表",
  },
];
