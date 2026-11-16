import Bird from "@lucide/svelte/icons/bird";
import GitFork from "@lucide/svelte/icons/git-fork";
import Mountain from "@lucide/svelte/icons/mountain";
import Video from "@lucide/svelte/icons/video";
import type { Component } from "svelte";

/** 站长外部身份链接：首页外部入口与顶栏资料卡共用，数组顺序即展示顺序。 */
export interface SocialLink {
  href: string;
  label: string;
  icon: Component;
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { href: "https://github.com/brightmeows", label: "GitHub", icon: GitFork },
  { href: "https://codeberg.org/brightmeows", label: "Codeberg", icon: Mountain },
  { href: "https://space.bilibili.com/215242890", label: "Bilibili", icon: Video },
  { href: "https://x.com/MiyakoWoW", label: "X (Twitter)", icon: Bird },
];
