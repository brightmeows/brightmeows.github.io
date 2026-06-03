import type { NavChild } from "$lib/components/NavPane.svelte";

export const navChildren: NavChild[] = [
  {
    href: "/bms/table/search",
    title: "谱面搜索",
    description: "跨难度表搜索谱面",
  },
  {
    href: "/bms/table/mirror",
    title: "难度表镜像",
    description: "BMS 难度表镜像列表（支持多语言搜索）",
  },
];
