import type { DraftPayload } from "@brightmeows/bms/editor";

import { decideNewTableDraft } from "#lib/controllers/editor.js";
import {
  deleteDraft,
  loadDraft,
  saveDraft,
  takeDraftClaim,
  type DraftWriteResult,
} from "#lib/data/api/table-drafts.js";
import { m } from "#lib/paraglide/messages.js";

/** 草稿落盘状态机的词汇。 */
export type DraftStatus = "idle" | "saving" | "saved" | "unavailable" | "quota" | "error";

/** 草稿 ISO 时间戳转本地时钟（无效时间戳原样返回）。 */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

/** 草稿生命周期的宿主接入点：模型态读写与载荷装配由页面模型注入。 */
export interface DraftLifecycleDeps {
  /** 草稿键（按来源生成，见 draftStorageKey）。 */
  draftKey: () => string;
  /** 模型是否加载完成（header 与 data 双就绪）；防抖落盘的前置条件。 */
  isReady: () => boolean;
  /** 装配当前草稿载荷（header 字段、条目、并发基线、时间戳）。 */
  capturePayload: () => DraftPayload;
  /** 草稿内容套用到模型：header 字段、条目、并发基线并清空通知。 */
  adoptDraft: (draft: DraftPayload) => void;
}

/**
 * 草稿生命周期子模型：防抖落盘、恢复与放弃、新表草稿认领与离页守卫。
 * 草稿域状态（dirty、pendingDraft、draftStatus、lastSavedAt、draftChecked）
 * 在此私有的行为冻结拆分；模型侧状态经 deps 注入读写。
 */
export function createDraftLifecycle(deps: DraftLifecycleDeps) {
  let dirty = $state(false);
  let pendingDraft = $state<DraftPayload | null>(null);
  let draftStatus = $state<DraftStatus>("idle");
  let lastSavedAt = $state<string | null>(null);
  let draftChecked = $state(false);

  /** 编辑标记（通知清空由调用方与 markDirty 一并处理）。 */
  function markEdited(): void {
    dirty = true;
  }

  /** 保存成功后的落账：清脏标记与草稿状态（成功通知由模型侧处理）。 */
  function markSaved(): void {
    dirty = false;
    draftStatus = "idle";
    lastSavedAt = null;
  }

  /** 应用一份草稿：模型侧套用先行，草稿侧落账随后（与拆分前同序）。 */
  function restore(draft: DraftPayload): void {
    deps.adoptDraft(draft);
    pendingDraft = null;
    dirty = true;
    draftStatus = "saved";
    lastSavedAt = draft.savedAt;
  }

  /** 加载完成后的草稿探查（只做一次；放弃修改后重置再查）。 */
  async function discover(): Promise<void> {
    if (draftChecked) return;
    draftChecked = true;
    pendingDraft = await loadDraft(deps.draftKey());
  }

  /** 新表（尚未创建）的草稿三向决策：自有草稿挂起、认领套用、空白开始。 */
  async function prepareNewTable(): Promise<void> {
    const own = await loadDraft(deps.draftKey());
    const claim = takeDraftClaim();
    const claimed = claim !== null ? await loadDraft(claim.sourceDraftKey) : null;
    const decision = decideNewTableDraft(own, claim, claimed);
    if (decision.action === "claim") {
      restore(decision.draft);
    } else if (decision.action === "pending") {
      pendingDraft = decision.draft;
    }
  }

  /** 恢复挂起的草稿。 */
  function restorePending(): void {
    const draft = pendingDraft;
    if (draft === null) return;
    restore(draft);
  }

  /** 丢弃挂起的草稿（不触碰模型内容）。 */
  async function discardPending(): Promise<void> {
    await deleteDraft(deps.draftKey());
    pendingDraft = null;
  }

  /** 放弃全部未保存修改：删草稿并复位草稿态（模型内容回载由调用方负责）。 */
  async function resetAfterDiscard(): Promise<void> {
    await deleteDraft(deps.draftKey());
    dirty = false;
    pendingDraft = null;
    draftStatus = "idle";
    lastSavedAt = null;
    draftChecked = false;
  }

  // ---- 草稿自动落盘（防抖 1.2 秒；草稿未决时不写，避免覆盖待恢复内容） ----
  $effect(() => {
    if (!dirty || !deps.isReady() || pendingDraft !== null) return;
    const payload = deps.capturePayload();
    const timer = setTimeout(() => {
      void persist(payload);
    }, 1200);
    return () => clearTimeout(timer);
  });

  /** 落盘一份草稿载荷（$state 是深层代理，IndexedDB 结构克隆不接受代理对象，先取静态快照）。 */
  async function persist(payload: DraftPayload): Promise<DraftWriteResult> {
    draftStatus = "saving";
    const result = await saveDraft(deps.draftKey(), $state.snapshot(payload));
    if (result === "ok") {
      draftStatus = "saved";
      lastSavedAt = payload.savedAt;
    } else {
      draftStatus = result;
    }
    return result;
  }

  // 草稿不可用时退回离页警告（草稿可用时无警告，防误关由草稿承担）。
  const draftGuardActive = $derived(
    dirty && (draftStatus === "unavailable" || draftStatus === "quota" || draftStatus === "error")
  );
  $effect(() => {
    if (!draftGuardActive) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  const draftStatusText = $derived.by(() => {
    switch (draftStatus) {
      case "idle":
        return "";
      case "saving":
        return m["editor.draft_saving"]();
      case "saved":
        return lastSavedAt === null
          ? ""
          : m["editor.draft_saved_at"]({ time: formatClock(lastSavedAt) });
      case "unavailable":
      case "quota":
        return m["editor.draft_unavailable"]();
      case "error":
        return m["editor.draft_error"]();
      default:
        return "";
    }
  });

  return {
    get dirty() {
      return dirty;
    },
    markEdited,
    markSaved,
    get pendingDraft() {
      return pendingDraft;
    },
    restore,
    discover,
    prepareNewTable,
    restorePending,
    discardPending,
    resetAfterDiscard,
    persist,
    get draftStatusText() {
      return draftStatusText;
    },
  };
}

export type DraftLifecycle = ReturnType<typeof createDraftLifecycle>;
