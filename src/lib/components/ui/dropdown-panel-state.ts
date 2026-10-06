/**
 * 互斥面板组的状态转移（纯函数，无 runes）：供 dropdown-panel.svelte.ts
 * 的面板组使用，并由相邻测试直接锁定语义。
 */

/** 互斥面板组的下一步状态：toggle 已开面板即关闭，换 id 即换开。 */
export function reducePanelState(
  current: string | null,
  action: { type: "toggle"; id: string } | { type: "close" }
): string | null {
  if (action.type === "close") return null;
  return current === action.id ? null : action.id;
}
