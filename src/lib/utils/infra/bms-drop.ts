import { entryHashes, type BmsDropResult } from "@brightmeows/bms/editor";
import {
  bmsTextToFields,
  bmsonTextToFields,
  decodeBmsBytes,
  fieldsToEntry,
  isBmsFileName,
} from "@brightmeows/bms/file";

import { md5 } from "./md5.js";

/**
 * 本地 BMS/BMSON 拖拽导入管线（无 UI）：目录递归收集（上限 200 个文件）、
 * MD5 与 SHA-256、编码嗅探与头部解析，按已知哈希与批内哈希去重后返回
 * 追加结果与文件等级建议。拖拽区组件与页面级拖拽遮罩共用同一管线。
 */

/** 单次拖入的文件数上限。 */
export const BMS_DROP_MAX_FILES = 200;

/** 当前浏览器是否具备哈希计算能力（Web Crypto 缺失时拖拽导入不可用）。 */
export function isHashingAvailable(): boolean {
  // 不信 DOM 类型视图（Crypto.subtle 声明非空），按真实运行时探测：
  // 站点允许被 http 页面 iframe 嵌入，非安全上下文没有 crypto.subtle。
  const subtle = (globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle;
  return typeof subtle !== "undefined";
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

async function walkEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  if (files.length >= BMS_DROP_MAX_FILES) return;
  if (isFileEntry(entry)) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file(resolve, () => resolve(null));
    });
    if (file !== null) files.push(file);
    return;
  }
  if (isDirectoryEntry(entry)) {
    const reader = entry.createReader();
    // readEntries 按批返回，需重复读取直到空批
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve, () => resolve([]));
      });
      if (batch.length === 0) break;
      for (const child of batch) {
        await walkEntry(child, files);
        if (files.length >= BMS_DROP_MAX_FILES) return;
      }
    }
  }
}

/** 从 DataTransfer 收集文件：优先按目录递归展开，退化为普通文件列表。 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = [...dataTransfer.items];
  const fileEntries = items
    .map((item) => item.webkitGetAsEntry() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (fileEntries.length === 0) return [...dataTransfer.files].slice(0, BMS_DROP_MAX_FILES);
  const files: File[] = [];
  for (const entry of fileEntries) {
    await walkEntry(entry, files);
    if (files.length >= BMS_DROP_MAX_FILES) break;
  }
  return files.slice(0, BMS_DROP_MAX_FILES);
}

/**
 * 解析文件并产出导入结果：非 BMS 文件计入 failed，与已知条目或批内
 * 重复的计入 skipped；onProgress 报告逐文件进度（用于忙碌提示）。
 */
export async function processBmsFiles(
  files: File[],
  knownEntries: readonly Record<string, unknown>[],
  onProgress?: (done: number, total: number) => void
): Promise<BmsDropResult> {
  const sourceFiles = files.filter((file) => isBmsFileName(file.name));
  const failed = files.length - sourceFiles.length;
  if (sourceFiles.length === 0) {
    return { added: [], hints: {}, skipped: 0, failed, total: files.length };
  }
  const knownHashes = new Set<string>();
  for (const entry of knownEntries) {
    for (const hash of entryHashes(entry)) knownHashes.add(hash);
  }
  const added: Record<string, unknown>[] = [];
  const hints: Record<string, string> = {};
  let skipped = 0;
  let failedCount = failed;
  for (const file of sourceFiles) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const md5Hex = md5(bytes);
      const sha256 = await sha256Hex(bytes);
      if (knownHashes.has(md5Hex) || knownHashes.has(sha256)) {
        skipped += 1;
      } else {
        const decoded = decodeBmsBytes(bytes);
        const isBmson = file.name.toLowerCase().endsWith(".bmson");
        const fields = isBmson ? bmsonTextToFields(decoded.text) : bmsTextToFields(decoded.text);
        if (fields === null) {
          failedCount += 1;
        } else {
          const result = fieldsToEntry(fields, md5Hex, sha256);
          added.push(result.entry);
          if (result.levelHint !== "") hints[md5Hex] = result.levelHint;
          knownHashes.add(md5Hex);
          knownHashes.add(sha256);
        }
      }
    } catch {
      failedCount += 1;
    }
    onProgress?.(added.length + skipped + failedCount, sourceFiles.length);
  }
  return { added, hints, skipped, failed: failedCount, total: files.length };
}
