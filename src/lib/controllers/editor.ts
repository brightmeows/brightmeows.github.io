/**
 * 统一表编辑器的决策点：保存闸门与新表草稿认领。
 *
 * 编辑器组件（TableEditorPage）的加载、草稿自动落盘与保存串接保留在
 * 组件里（状态是深层响应式的，DOM effect 与 confirm 也在此）；本模块
 * 只承载可独立断言的决策逻辑，语义由 editor.test.ts 锁定（与 2026-10
 * 之前的组件内实现逐分支一致）。
 */

import type { SharedPayloadError } from "@brightmeows/mirror/shared";
import { checkSharedPayload, withLocalDataUrl } from "@brightmeows/mirror/shared";

import type { FetchTableDataResult } from "$lib/data/bms-data";
import type { DraftClaim } from "$lib/data/table-drafts";
import { m } from "$lib/paraglide/messages.js";
import type { HeaderData } from "$lib/types/bms-format";
import type { ProgressCallback } from "$lib/types/bms-view";
import { sharedPayloadErrorMessage } from "$lib/utils/shared-table";
import type { DraftPayload, TableEditPayload } from "$lib/utils/table-editor";
import {
  buildCombinedPackage,
  countUnassigned,
  shouldWarnOverwrite,
} from "$lib/utils/table-editor";

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

// ---- 加载编排（统一编辑器页的四相回退：远端加载与新表草稿认领） ----

/** 编辑器加载的页面交接面：来源参数与数据层取数绑定。 */
export interface EditorLoadDeps {
  /** header.json 地址；null 表示新表。 */
  headerUrl: string | null;
  /** header.data_url 缺失时的回退数据地址。 */
  dataUrlFallback: string | null;
  draftKey: string;
  fetchHeader: (url: string, onProgress: ProgressCallback | undefined) => Promise<HeaderData>;
  /** 拉取 data.json；基准 URL 解析留组件绑定（url.ts 依赖 window，控制器保持环境无关）。 */
  fetchData: (
    dataUrl: string,
    onProgress: ProgressCallback | undefined
  ) => Promise<FetchTableDataResult>;
  loadDraft: (key: string) => Promise<DraftPayload | null>;
  takeDraftClaim: () => DraftClaim | null;
}

export type EditorLoadResult =
  | {
      kind: "ready";
      header: Record<string, unknown>;
      data: Record<string, unknown>[];
      /** 加载完成后发现的本地草稿（待用户确认恢复）。 */
      draft: DraftPayload | null;
    }
  | { kind: "new"; decision: NewTableDraftDecision }
  | { kind: "error"; message: string };

/**
 * 加载编排：远端路径取 header 与 data 并探查本地草稿；新表路径做草稿认领
 * 三向决策（自有、认领、空白）。进度回调透传给页面写加载指示器。
 */
export async function loadEditorTables(
  deps: EditorLoadDeps,
  onProgress: ProgressCallback
): Promise<EditorLoadResult> {
  try {
    if (deps.headerUrl === null) {
      const own = await deps.loadDraft(deps.draftKey);
      const claim = deps.takeDraftClaim();
      const claimed = claim !== null ? await deps.loadDraft(claim.sourceDraftKey) : null;
      return { kind: "new", decision: decideNewTableDraft(own, claim, claimed) };
    }

    const header = await deps.fetchHeader(deps.headerUrl, onProgress);
    const dataUrl =
      typeof header.data_url === "string" && header.data_url !== ""
        ? header.data_url
        : (deps.dataUrlFallback ?? deps.headerUrl);
    const result = await deps.fetchData(dataUrl, onProgress);

    const draft = await deps.loadDraft(deps.draftKey);
    return {
      kind: "ready",
      header,
      data: result.data.map((item) => ({ ...item })),
      draft,
    };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : m["common.unknown_error"](),
    };
  }
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
