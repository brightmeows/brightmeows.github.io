let suppressNextEnterId: string | null = null;

/** 导航链接点击后抑制下一次悬停展开，避免新页面挂载时指针仍停在触发项上。 */
export function suppressNextNavHover(id: string): void {
  suppressNextEnterId = id;
}

/** 读取并消费一次悬停抑制标记；无论 id 是否匹配都清空，避免标记滞留。 */
export function consumeNavHoverSuppression(id: string): boolean {
  const suppressed = suppressNextEnterId === id;
  suppressNextEnterId = null;
  return suppressed;
}
