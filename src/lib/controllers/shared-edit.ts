/**
 * 共享表编辑页的编排：加载回退链、保存流与改名校验。
 *
 * 页面（src/routes/bms/table/shared/[id]/edit/+page.svelte）只持 `$state`
 * 并在事件里调用本模块；DOM 与导航（confirm、window.location、goto）留在
 * 页面。取数经依赖注入收编——页面传真实现，单测传假实现，回退链的每条
 * 路径都是纯函数断言（见 shared-edit.test.ts）。
 *
 * 加载链语义（与 2026-10 之前的页面内实现逐分支一致）：
 * 1. 登录态不可用（静态宿主）：只依赖本站清单，命中即本地编辑，未命中 404；
 * 2. 未登录：清单命中即本地编辑，未命中引导登录（可能是待创建的新表）；
 * 3. 已登录：查 id 可用即为新表（带种子），已占用回落清单，仍未命中 404；
 * 4. 查 id 抛“接口不可用”：按静态宿主口径回落清单。
 */

import type { SharedTableItem } from "@brightmeows/mirror/shared";
import { validateSharedId } from "@brightmeows/mirror/shared";
import { sharedTablePath } from "@brightmeows/mirror/urls";

import { ApiUnavailableError } from "$lib/data/http";
import type { SharedCreateResult, SharedPayloadBody, SharedSaveResult } from "$lib/data/shared-api";
import { m } from "$lib/paraglide/messages.js";

/** 页面阶段：域状态机（login/notfound 是域结果，不并入 AsyncState；
 *  接口不可用不单独设相——四条路径都回落到清单或错误，原实现的
 *  “unavailable” 枚举成员从未被赋值，已随本控制器移除）。 */
export type SharedEditPhase = "loading" | "login" | "notfound" | "error" | "ready";

/** 编辑页状态：页面以整体替换的方式更新（控制器返回新对象）。 */
export interface SharedEditState {
  phase: SharedEditPhase;
  loadError: string | null;
  /** 待创建的新表（首次保存才落库）。 */
  isNew: boolean;
  /** 现役表清单条目；新表为 null。 */
  item: SharedTableItem | null;
  /** 线上并发基线（最近一次保存/创建后的 updated_at）。 */
  baseline: string | undefined;
  /** 新表初始种子（无草稿认领时使用）。 */
  seed: { name: string; symbol: string } | undefined;
}

export function initialSharedEditState(): SharedEditState {
  return {
    phase: "loading",
    loadError: null,
    isNew: false,
    item: null,
    baseline: undefined,
    seed: undefined,
  };
}

/** 取数依赖：页面传真实现（auth store 与 shared-api），单测传假实现。 */
export interface SharedEditDeps {
  auth: {
    ensureLoaded(): Promise<void>;
    unavailable(): boolean;
    login(): string | null;
  };
  /** 在共享清单里找表；cacheBust 穿透 60 秒边缘缓存。 */
  findInList(cacheBust: boolean): Promise<SharedTableItem | null>;
  /** 查询 id 是否可创建。 */
  checkId(id: string): Promise<{ available: boolean }>;
  /** 取走新表种子（sessionStorage 一次性认领）。 */
  takeSeed(): { name: string; symbol: string } | undefined;
  create(payload: SharedPayloadBody): Promise<SharedCreateResult>;
  save(payload: SharedPayloadBody): Promise<SharedSaveResult>;
}

/** 单步“清单命中即就绪”的公共收尾。 */
function readyFromList(state: SharedEditState, found: SharedTableItem | null): SharedEditState {
  if (found === null) {
    return { ...state, phase: "notfound" };
  }
  return { ...state, item: found, baseline: found.updated_at, phase: "ready" };
}

function errorState(state: SharedEditState, error: unknown): SharedEditState {
  return {
    ...state,
    phase: "error",
    loadError: error instanceof Error ? error.message : m["common.unknown_error"](),
  };
}

/** 加载回退链（四层，见文件头注）。 */
export async function loadSharedEdit(
  deps: SharedEditDeps,
  tableId: string
): Promise<SharedEditState> {
  const state = initialSharedEditState();
  await deps.auth.ensureLoaded();

  // 1. 接口不可用（静态宿主）：只依赖本站共享清单做本地编辑
  if (deps.auth.unavailable()) {
    try {
      return readyFromList(state, await deps.findInList(false));
    } catch (error) {
      return errorState(state, error);
    }
  }

  try {
    const login = deps.auth.login();
    // 2. 未登录：清单命中即本地编辑；未命中可能是待创建的新表，引导登录
    if (login === null) {
      const found = await deps.findInList(false);
      if (found === null) {
        return { ...state, phase: "login" };
      }
      return { ...state, item: found, baseline: found.updated_at, phase: "ready" };
    }
    // 3. 已登录：id 可用即为新表；已占用回落清单
    const check = await deps.checkId(tableId);
    if (check.available) {
      return { ...state, isNew: true, seed: deps.takeSeed(), phase: "ready" };
    }
    return readyFromList(state, await deps.findInList(false));
  } catch (error) {
    // 4. 查 id 抛“接口不可用”：按静态宿主口径回落清单
    if (error instanceof ApiUnavailableError) {
      try {
        return readyFromList(state, await deps.findInList(false));
      } catch (fallbackError) {
        return errorState(state, fallbackError);
      }
    }
    return errorState(state, error);
  }
}

/** 保存结果：控制器返回的新状态加保存回调要还给编辑器的并发基线。 */
export interface SharedEditSaveResult {
  state: SharedEditState;
  /** 新的线上 updated_at；拿不到（创建后清单未同步）为 undefined。 */
  newBaseline: string | undefined;
}

/** 保存流：创建（D1 占位后写 R2，再拉一次清单作基线）或整包覆盖保存。 */
export async function saveSharedEdit(
  state: SharedEditState,
  deps: SharedEditDeps,
  login: string,
  payload: SharedPayloadBody
): Promise<SharedEditSaveResult> {
  if (state.isNew) {
    const created = await deps.create(payload);
    // 创建接口不返回 updated_at，拉一次清单作并发基线（穿透缓存）
    const found = await deps.findInList(true);
    const baseline = found?.updated_at;
    const next: SharedEditState = {
      ...state,
      isNew: false,
      item: {
        id: created.id,
        name: typeof payload.header.name === "string" ? payload.header.name : created.id,
        symbol: typeof payload.header.symbol === "string" ? payload.header.symbol : undefined,
        author: login,
        created_at: "",
        updated_at: "",
        entries: created.entries,
        url: sharedTablePath(payload.id),
      },
      baseline,
    };
    return { state: next, newBaseline: baseline };
  }
  const saved = await deps.save(payload);
  const baseline = saved.updated_at !== "" ? saved.updated_at : undefined;
  return { state: { ...state, baseline }, newBaseline: baseline };
}

/** 保存前取当前线上基线（并发提示用）；表 id 经 deps.findInList 闭包携带。 */
export async function sharedEditConflictBaseline(
  deps: SharedEditDeps
): Promise<string | undefined> {
  return (await deps.findInList(true))?.updated_at;
}

/** 改名校验：与新建页共用同一套 id 规则；同 id 与非法 id 返回 null。 */
export function validateNewTableId(
  raw: string,
  currentId: string
): { id: string } | { error: "same" | "invalid" } {
  const result = validateSharedId(raw);
  if (!result.ok) {
    return { error: "invalid" };
  }
  if (result.id === currentId) {
    return { error: "same" };
  }
  return { id: result.id };
}

/** 写权限：新表看登录，现役表看作者本人（admin 可删不可编辑他人内容）。 */
export function sharedEditCanWrite(state: SharedEditState, login: string | null): boolean {
  if (state.isNew) return login !== null;
  return state.item !== null && login !== null && login === state.item.author;
}
