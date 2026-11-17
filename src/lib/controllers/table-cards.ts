/**
 * 难度表编辑页三卡的可见性决策：`?show=` 解析与序列化、动态默认与
 * 至少保留一张的约束。URL、sessionStorage 与滚动等副作用留在页面层。
 */
export const TABLE_CARD_IDS = ["header", "charts", "course"] as const;

/** 三张工作卡的身份。 */
export type TableCardId = (typeof TABLE_CARD_IDS)[number];

/** 动态默认组合的输入：数据是否就绪、是否新建、头部身份是否为空。 */
export interface TableCardDefaults {
  dataReady: boolean;
  isNew: boolean;
  headerUnfilled: boolean;
}

/** 解析 `?show=`；空值、全非法或缺失返回 null，交给调用方走动态默认。 */
export function parseCardShow(raw: string | null | undefined): TableCardId[] | null {
  if (raw === null || raw === undefined) return null;
  const selected = new Set<TableCardId>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (isTableCardId(id)) selected.add(id);
  }
  return selected.size === 0 ? null : orderCards(selected);
}

/** 序列化可见组合，按 header、charts、course 的固定顺序输出。 */
export function serializeCardShow(cards: readonly TableCardId[]): string {
  return orderCards(new Set(cards)).join(",");
}

/**
 * 首次进入的动态默认：data 未就绪时开头加谱面，新建或头部未填只开头，
 * 其余只开谱面。同会话记住的上次组合由调用方优先使用。
 */
export function defaultCardShow(defaults: TableCardDefaults): TableCardId[] {
  if (!defaults.dataReady) return ["header", "charts"];
  if (defaults.isNew || defaults.headerUnfilled) return ["header"];
  return ["charts"];
}

/** 查看态默认只展开谱面；Header 与段位折叠。 */
export function defaultViewSections(): TableCardId[] {
  return ["charts"];
}

/** 切换一张卡；关闭最后一张时原样返回，页面据此提示至少保留一张。 */
export function toggleCardShow(current: readonly TableCardId[], id: TableCardId): TableCardId[] {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next.size === 0 ? [...current] : orderCards(next);
}

/** 显式设置一张卡的显隐；关闭最后一张时原样返回。 */
export function setCardShow(
  current: readonly TableCardId[],
  id: TableCardId,
  visible: boolean
): TableCardId[] {
  const next = new Set(current);
  if (visible) next.add(id);
  else next.delete(id);
  return next.size === 0 ? [...current] : orderCards(next);
}

/** 查看态设置一张 section 的展开状态；允许全部折叠。 */
export function setSectionOpen(
  current: readonly TableCardId[],
  id: TableCardId,
  open: boolean
): TableCardId[] {
  const next = new Set(current);
  if (open) next.add(id);
  else next.delete(id);
  return orderCards(next);
}

/** 卡片组合为空时回退到给定默认；用于查看态全部折叠后切入编辑态。 */
export function ensureVisibleCards(
  current: readonly TableCardId[],
  fallback: readonly TableCardId[]
): TableCardId[] {
  return current.length > 0 ? orderCards(new Set(current)) : orderCards(new Set(fallback));
}

/** 字符串是否为已知卡片 id。 */
export function isTableCardId(value: string): value is TableCardId {
  return (TABLE_CARD_IDS as readonly string[]).includes(value);
}

function orderCards(cards: ReadonlySet<TableCardId>): TableCardId[] {
  return TABLE_CARD_IDS.filter((id) => cards.has(id));
}
