/**
 * 表编辑的决策点：保存闸门与新表草稿来源。
 *
 * 合并页（BmsTablePage）的加载、草稿自动落盘与保存串接保留在组件里
 * （状态是深层响应式的，DOM effect 与 confirm 也在此）；本模块只承载
 * 可独立断言的决策逻辑，语义由 editor.test.ts 锁定（与 2026-10 之前的
 * 组件内实现逐分支一致）。
 */

import type { DraftPayload, TableEditPayload } from "@brightmeows/bms/editor";
import {
  buildCombinedPackage,
  countUnassigned,
  shouldWarnOverwrite,
} from "@brightmeows/bms/editor";
import type { SharedPayloadError } from "@brightmeows/mirror/shared";
import { checkSharedPayload, withLocalDataUrl } from "@brightmeows/mirror/shared";

import { m } from "#lib/paraglide/messages.js";
import { sharedPayloadErrorMessage } from "#lib/utils/shared-table.js";

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

// ---- 保存编排（闸门与并发检查先行，提交随后；busy 时序由两段拆分保持） ----

/** 编辑器保存结果里统一的通知形状（与页面 notice 状态同构）。 */
export interface EditorNotice {
  kind: "ok" | "warn" | "error";
  text: string;
}

export type EditorSavePlan =
  | { kind: "rejected"; notice: EditorNotice }
  | { kind: "proceed"; header: Record<string, unknown>; data: Record<string, unknown>[] };

/**
 * 保存前置段：载荷闸门（先于未指派判定）与并发基线检查（shouldWarnOverwrite
 * 命中且用户取消则拒绝）。confirm 注入（页面传 window.confirm，单测传假实现）。
 */
export async function planEditorSave(deps: {
  header: Record<string, unknown>;
  entries: Record<string, unknown>[];
  baselineUpdatedAt: string | undefined;
  conflictCheck: (() => Promise<string | undefined>) | undefined;
  confirm: (message: string) => boolean;
}): Promise<EditorSavePlan> {
  const gate = decideLocalSaveGate(deps.header, deps.entries);
  if (gate.gate === "invalid_payload") {
    return {
      kind: "rejected",
      notice: { kind: "error", text: sharedPayloadErrorMessage(gate.error) },
    };
  }
  if (gate.gate === "unassigned") {
    return {
      kind: "rejected",
      notice: { kind: "warn", text: m["editor.publish_unassigned_blocked"]({ count: gate.count }) },
    };
  }
  if (deps.conflictCheck !== undefined) {
    const online = await deps.conflictCheck();
    if (
      shouldWarnOverwrite(deps.baselineUpdatedAt, online) &&
      !deps.confirm(m["editor.save_conflict_confirm"]())
    ) {
      return {
        kind: "rejected",
        notice: { kind: "warn", text: m["editor.save_conflict_canceled"]() },
      };
    }
  }
  return { kind: "proceed", header: gate.header, data: gate.data };
}

export type EditorSaveOutcome =
  | { kind: "saved"; nextBaseline: string | undefined; count: number }
  | { kind: "failed"; text: string };

/** 保存提交段：调用 onSave、落新基线、清草稿；失败翻译消息。 */
export async function commitEditorSave(deps: {
  plan: { header: Record<string, unknown>; data: Record<string, unknown>[] };
  onSave: (payload: TableEditPayload) => Promise<string | undefined>;
  deleteDraft: (key: string) => Promise<void>;
  draftKey: string;
}): Promise<EditorSaveOutcome> {
  try {
    const nextBaseline = await deps.onSave({ header: deps.plan.header, data: deps.plan.data });
    await deps.deleteDraft(deps.draftKey);
    return { kind: "saved", nextBaseline, count: deps.plan.data.length };
  } catch (error) {
    return {
      kind: "failed",
      text: error instanceof Error ? error.message : m["editor.save_failed"](),
    };
  }
}

// ---- 另存共享（桥接导出与同源认领的分叉决策） ----

export type SaveAsSharedPlan =
  | { kind: "invalid"; notice: EditorNotice }
  /** 桥接：导出合并包加开主站新建页。 */
  | { kind: "export" }
  /** 同源且载荷合法：走草稿随行认领（草稿写失败时页面退回导出路径）。 */
  | { kind: "claim" };

/** 另存共享的前置决策：载荷校验与模式分叉。 */
export function planSaveAsShared(
  header: Record<string, unknown>,
  entries: Record<string, unknown>[],
  mode: "bridge" | "same-origin"
): SaveAsSharedPlan {
  const check = checkSharedPayload(header, entries);
  if (!check.ok) {
    return {
      kind: "invalid",
      notice: { kind: "error", text: sharedPayloadErrorMessage(check.error) },
    };
  }
  return mode === "bridge" ? { kind: "export" } : { kind: "claim" };
}

/** 导出合并包的包体构造（桥接与草稿失败回退共用）。 */
export function buildSharedExportPackage(
  header: Record<string, unknown>,
  entries: Record<string, unknown>[]
): Record<string, unknown> {
  return buildCombinedPackage(withLocalDataUrl(header), entries);
}
