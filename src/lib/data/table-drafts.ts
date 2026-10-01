import type { DraftPayload } from "$lib/utils/table-editor";

/**
 * 表编辑器草稿的 IndexedDB 存储：单快照、按表键隔离、结构克隆直存
 * （不做 JSON 文本序列化，避免大表在每次落盘时阻塞输入）。
 * 隐私模式或配额不足时读返回 null、写返回 unavailable/quota，由调用方降级提示。
 */

const DB_NAME = "bms-table-editor";
const DB_VERSION = 1;
const STORE = "drafts";

export type DraftWriteResult = "ok" | "unavailable" | "quota" | "error";

interface DraftRecord {
  key: string;
  payload: DraftPayload;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException === "undefined" || !(error instanceof DOMException)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function isDraftRecord(value: unknown): value is DraftRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.key === "string" && typeof record.payload === "object";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(null));
    request.addEventListener("blocked", () => resolve(null));
  });
  return dbPromise;
}

/** 读取草稿；不可用或不存在时返回 null。 */
export async function loadDraft(key: string): Promise<DraftPayload | null> {
  const db = await openDatabase();
  if (db === null) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.addEventListener("success", () => {
        const value: unknown = request.result;
        resolve(isDraftRecord(value) ? value.payload : null);
      });
      request.addEventListener("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** 写入草稿；配额不足与不可用分别返回稳定结果码。 */
export async function saveDraft(key: string, payload: DraftPayload): Promise<DraftWriteResult> {
  const db = await openDatabase();
  if (db === null) return "unavailable";
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ key, payload });
      transaction.addEventListener("complete", () => resolve("ok"));
      transaction.addEventListener("error", () =>
        resolve(isQuotaError(transaction.error) ? "quota" : "error")
      );
      transaction.addEventListener("abort", () =>
        resolve(isQuotaError(transaction.error) ? "quota" : "error")
      );
    } catch (error) {
      resolve(isQuotaError(error) ? "quota" : "error");
    }
  });
}

/** 删除草稿；失败静默（草稿只是本地降级手段，不应反向影响编辑流程）。 */
export async function deleteDraft(key: string): Promise<void> {
  const db = await openDatabase();
  if (db === null) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(key);
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () => resolve());
      transaction.addEventListener("abort", () => resolve());
    } catch {
      resolve();
    }
  });
}
