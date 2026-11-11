/**
 * 表编辑的决策点：保存闸门与新表草稿来源。
 *
 * 合并页（BmsTablePage）的加载、草稿自动落盘与保存串接保留在组件里
 * （状态是深层响应式的，DOM effect 与 confirm 也在此）；本模块只承载
 * 可独立断言的决策逻辑，语义由 editor.test.ts 锁定（与 2026-10 之前的
 * 组件内实现逐分支一致）。
 */

import type { DraftPayload, TableEditPayload } from "@brightmeows/bms/editor";
import { shouldWarnOverwrite } from "@brightmeows/bms/editor";
import { strictIssueMessage, strictWarningMessage } from "@brightmeows/bms/shared";
import {
  STRICT_EDITOR_MESSAGE_KEYS,
  strictCheckSharedPayload,
  type SharedStrictError,
  type SharedStrictWarning,
} from "@brightmeows/mirror/shared-strict";

import { m } from "#lib/paraglide/messages.js";
import { translateMessage } from "#lib/utils/i18n/i18n.js";

/** 保存的本地闸门：强验证、未指派检查（通过后才值得联网查并发）。 */
export type LocalSaveGate =
  | { gate: "invalid_payload"; errors: SharedStrictError[]; truncated: boolean }
  | { gate: "unassigned"; count: number }
  | {
      gate: "pass";
      header: Record<string, unknown>;
      data: Record<string, unknown>[];
      warnings: SharedStrictWarning[];
    };

/**
 * 保存闸门：先强验证（不过即拒），再未指派检查（发布前必须全部指派）。
 * 强验证里“缺失、null 或空 level”重分类进未指派计数——那是编辑器的指派
 * 工作流，提示文案保持原口径；数字 level 合法，其余非法类型仍是硬错误。
 */
export function decideLocalSaveGate(
  header: Record<string, unknown>,
  entries: Record<string, unknown>[]
): LocalSaveGate {
  const check = strictCheckSharedPayload(header, entries);
  const errors: SharedStrictError[] = [];
  let unassigned = 0;
  for (const error of check.errors) {
    if (error.code === "entry_level") {
      const index = typeof error.params.index === "number" ? error.params.index : -1;
      const level = entries[index]?.level;
      if (level === undefined || level === null || level === "") {
        unassigned += 1;
        continue;
      }
    }
    errors.push(error);
  }
  if (errors.length > 0) {
    return { gate: "invalid_payload", errors, truncated: check.truncated };
  }
  if (unassigned > 0) {
    return { gate: "unassigned", count: unassigned };
  }
  // data_url 缺失是导入期的补全提醒：编辑器表单不含该字段（平台入库必改写），
  // 保存路径不再提示，避免每次保存都误报。
  const warnings = check.warnings.filter((warning) => warning.kind !== "missing_data_url");
  return { gate: "pass", header, data: entries, warnings };
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
  | {
      kind: "proceed";
      header: Record<string, unknown>;
      data: Record<string, unknown>[];
      /** 强验证警告（非阻断）；放行的同时交由页面呈现。 */
      warnings: SharedStrictWarning[];
    };

/**
 * 保存前置段：强验证闸门（先于未指派判定）与并发基线检查（shouldWarnOverwrite
 * 命中且用户取消则拒绝）。confirm 注入（页面传真实现或玻璃弹层，单测传假
 * 实现）；确认原语可同步可异步，页面侧的弹层返回 Promise。
 */
export async function planEditorSave(deps: {
  header: Record<string, unknown>;
  entries: Record<string, unknown>[];
  baselineUpdatedAt: string | undefined;
  conflictCheck: (() => Promise<string | undefined>) | undefined;
  confirm: (message: string) => boolean | Promise<boolean>;
}): Promise<EditorSavePlan> {
  const gate = decideLocalSaveGate(deps.header, deps.entries);
  if (gate.gate === "invalid_payload") {
    return {
      kind: "rejected",
      notice: { kind: "error", text: strictErrorsNotice(gate) },
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
    if (shouldWarnOverwrite(deps.baselineUpdatedAt, online)) {
      const approved = await deps.confirm(m["editor.save_conflict_confirm"]());
      if (!approved) {
        return {
          kind: "rejected",
          notice: { kind: "warn", text: m["editor.save_conflict_canceled"]() },
        };
      }
    }
  }
  return { kind: "proceed", header: gate.header, data: gate.data, warnings: gate.warnings };
}

// ---- 导入与批量粘贴的应用闸门（replace 类覆盖在写入前要求确认） ----

export type ImportApplyPlan =
  /** 直接应用：空表或纯追加不拦截。 */
  | { kind: "apply" }
  /** 需确认：文案带覆盖范围与计数，用户取消则丢弃本次应用。 */
  | { kind: "confirm"; message: string };

/**
 * 导入（合并包/header/data）与批量粘贴的应用闸门：数据 replace 覆盖非空表
 * 优先按条目覆盖计数确认；套用表头（名称、等级顺序等）落到非空表按表头
 * 覆盖确认。空表两者都放行——新建流程的第一步导入不设闸。
 */
export function planImportApply(deps: {
  /** 是否套用导入的表头。 */
  headerApplied: boolean;
  /** 是否写入导入的条目数据。 */
  hasData: boolean;
  /** 条目写入模式。 */
  dataMode: "append" | "replace";
  /** 当前表条目数。 */
  currentCount: number;
}): ImportApplyPlan {
  if (deps.currentCount <= 0) return { kind: "apply" };
  if (deps.hasData && deps.dataMode === "replace") {
    return {
      kind: "confirm",
      message: m["editor.replace_entries_confirm"]({ count: deps.currentCount }),
    };
  }
  if (deps.headerApplied) {
    return { kind: "confirm", message: m["editor.import_header_confirm"]() };
  }
  return { kind: "apply" };
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
  /** 载荷合法：走草稿随行认领。 */
  | { kind: "claim" };

/** 另存共享的前置决策：载荷强验证。 */
export function planSaveAsShared(
  header: Record<string, unknown>,
  entries: Record<string, unknown>[]
): SaveAsSharedPlan {
  const check = strictCheckSharedPayload(header, entries);
  if (!check.ok) {
    return {
      kind: "invalid",
      notice: { kind: "error", text: strictErrorsNotice(check) },
    };
  }
  return { kind: "claim" };
}

// ---- 强验证问题清单的展示格式化（新建页与导入面板共用） ----

/** 单条强验证错误翻译为当前语言句子（代码是闭集，未知键不存在）。 */
function strictIssueText(error: SharedStrictError): string {
  const message = strictIssueMessage(error);
  return translateMessage(message.key, message.params) ?? message.key;
}

/** 强验证错误清单 → 通知文本：逐句拼接并封顶 10 条，余量或截断在末尾注明。 */
export function strictErrorsNotice(report: {
  errors: SharedStrictError[];
  truncated: boolean;
}): string {
  const shown = report.errors.slice(0, 10).map(strictIssueText);
  let text = shown.join(" ");
  if (report.truncated) {
    text += translateMessage(STRICT_EDITOR_MESSAGE_KEYS.errorTruncated) ?? "";
  } else if (report.errors.length > shown.length) {
    const more = translateMessage(STRICT_EDITOR_MESSAGE_KEYS.errorMore, {
      count: report.errors.length - shown.length,
    });
    text += more ?? "";
  }
  return translateMessage(STRICT_EDITOR_MESSAGE_KEYS.failed, { list: text }) ?? text;
}

/** 强验证警告清单 → 通知文本（空清单返回空串，调用方按有无决定呈现）。 */
export function strictWarningsNotice(warnings: SharedStrictWarning[]): string {
  if (warnings.length === 0) return "";
  const list = warnings
    .map((warning) => {
      const message = strictWarningMessage(warning);
      return translateMessage(message.key, message.params) ?? message.key;
    })
    .join(" ");
  return translateMessage(STRICT_EDITOR_MESSAGE_KEYS.warnings, { list }) ?? list;
}
