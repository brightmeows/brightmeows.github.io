import { cubicIn, cubicOut } from "svelte/easing";
import type { FadeParams, FlyParams } from "svelte/transition";

/**
 * 过渡预设：出入场参数单点化（TopBar 的 panelIn/panelOut 先例），调用方
 * 模板里写 `in:fly={panelFly().in}`。减少动效偏好在过渡触发时现查——
 * 过渡只在客户端触发，无需响应式监听；SSR 环境无 window，按常规偏好取值。
 */

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 浮动面板出入场（dock 面板与胶囊、选中栏）：y 24 升入 180ms cubicOut、降出 140ms cubicIn。 */
export function panelFly(): { in: FlyParams; out: FlyParams } {
  const reduce = reducedMotion();
  return {
    in: { y: 24, opacity: 0, duration: reduce ? 0 : 180, easing: cubicOut },
    out: { y: 24, opacity: 0, duration: reduce ? 0 : 140, easing: cubicIn },
  };
}

/** 行内弹层出入场（JSON 预览）：y 10 升入 160ms cubicOut、120ms 淡出。 */
export function popoverFly(): { in: FlyParams; out: FadeParams } {
  const reduce = reducedMotion();
  return {
    in: { y: 10, opacity: 0, duration: reduce ? 0 : 160, easing: cubicOut },
    out: { duration: reduce ? 0 : 120 },
  };
}
