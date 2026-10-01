/**
 * 统一表编辑器的决策点：保存闸门与新表草稿认领。
 *
 * 编辑器组件（TableEditorPage）的加载、草稿自动落盘与保存串接保留在
 * 组件里（状态是深层响应式的，DOM effect 与 confirm 也在此）；本模块
 * 只承载可独立断言的决策逻辑，语义由 editor.test.ts 锁定（与 2026-10
 * 之前的组件内实现逐分支一致）。
 */

import type { SharedPayloadError } from "@brightmeows/mirror/shared";
import { checkSharedPayload } from "@brightmeows/mirror/shared";

import type { DraftPayload } from "$lib/utils/table-editor";
import { countUnassigned } from "$lib/utils/table-editor";

/** 保存的本地闸门：载荷校验与未指派检查（通过后才值得联网查并发）。 */
export type LocalSaveGate =
  | { gate: "invalid_payload"; error: SharedPayloadError }
  | { gate: "unassigned"; count: number }
  | { gate: "pass"; header: Record<string, unknown>; data: Record<string, unknown>[] };

/** 保存闸门：先载荷校验（不过即拒），再未指派检查（发布前必须全部指派）。 */
export function decideLocalSaveGate(
  header: Record<string, unknown>,
  entries: Record<string, unknown>[]
): LocalSaveGate {
  const check = checkSharedPayload(header, entries);
  if (!check.ok) {
    return { gate: "invalid_payload", error: check.error };
  }
  const count = countUnassigned(entries);
  if (count > 0) {
    return { gate: "unassigned", count };
  }
  return { gate: "pass", header: check.header, data: check.data };
}

/** 新表进入编辑时的草稿来源决策：自有草稿优先，其次认领，最后空白开始。 */
export type NewTableDraftDecision =
  | { action: "pending"; draft: DraftPayload }
  | { action: "claim"; draft: DraftPayload }
  | { action: "fresh" };

/** 自有草稿挂起待确认；认领存在且源草稿仍在则直接套用；否则空白开始。 */
export function decideNewTableDraft(
  own: DraftPayload | null,
  claim: { sourceDraftKey: string } | null,
  claimed: DraftPayload | null
): NewTableDraftDecision {
  if (own !== null) {
    return { action: "pending", draft: own };
  }
  if (claim !== null && claimed !== null) {
    return { action: "claim", draft: claimed };
  }
  return { action: "fresh" };
}
