<script lang="ts">
  import { entryHashes, type BmsDropResult } from "@brightmeows/bms/editor";
  import {
    bmsTextToFields,
    bmsonTextToFields,
    decodeBmsBytes,
    fieldsToEntry,
    isBmsFileName,
  } from "@brightmeows/bms/file";

  import { btnGhost } from "$lib/constants/ui-classes";
  import { m } from "$lib/paraglide/messages.js";
  import { md5 } from "$lib/utils/infra/md5";

  /**
   * 本地 BMS/BMSON 拖拽区：目录递归收集（上限 200 个文件）、MD5 与 SHA-256、
   * 编码嗅探与头部解析，按当前表与批内哈希去重后交给父级追加。
   * 同时提供文件选择按钮（同一管线，移动端与键盘可达）。
   */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    disabled?: boolean;
    onadd: (result: BmsDropResult) => void;
  }

  let { entries, disabled = false, onadd }: Props = $props();

  const MAX_FILES = 200;

  let dragging = $state(false);
  let busy = $state(false);
  let progress = $state({ done: 0, total: 0 });
  let error = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function walkEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
    if (files.length >= MAX_FILES) return;
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
      });
      if (file !== null) files.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries 按批返回，需重复读取直到空批
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries(resolve, () => resolve([]));
        });
        if (batch.length === 0) break;
        for (const child of batch) {
          await walkEntry(child, files);
          if (files.length >= MAX_FILES) return;
        }
      }
    }
  }

  async function collectFiles(dataTransfer: DataTransfer): Promise<File[]> {
    const items = dataTransfer.items === undefined ? [] : [...dataTransfer.items];
    const fileEntries = items
      .map((item) => item.webkitGetAsEntry?.() ?? null)
      .filter((entry): entry is FileSystemEntry => entry !== null);
    if (fileEntries.length === 0) return [...dataTransfer.files].slice(0, MAX_FILES);
    const files: File[] = [];
    for (const entry of fileEntries) {
      await walkEntry(entry, files);
      if (files.length >= MAX_FILES) break;
    }
    return files.slice(0, MAX_FILES);
  }

  async function processFiles(files: File[]): Promise<void> {
    error = null;
    if (crypto?.subtle === undefined) {
      error = m["editor.bms_drop_unavailable"]();
      return;
    }
    const sourceFiles = files.filter((file) => isBmsFileName(file.name));
    const failed = files.length - sourceFiles.length;
    if (sourceFiles.length === 0) {
      onadd({ added: [], hints: {}, skipped: 0, failed, total: files.length });
      return;
    }
    busy = true;
    progress = { done: 0, total: sourceFiles.length };
    const knownHashes = new Set<string>();
    for (const entry of entries) {
      for (const hash of entryHashes(entry)) knownHashes.add(hash);
    }
    const added: Record<string, unknown>[] = [];
    const hints: Record<string, string> = {};
    let skipped = 0;
    let failedCount = failed;
    try {
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
            const fields = isBmson
              ? bmsonTextToFields(decoded.text)
              : bmsTextToFields(decoded.text);
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
        progress = { done: progress.done + 1, total: sourceFiles.length };
      }
    } finally {
      busy = false;
    }
    onadd({ added, hints, skipped, failed: failedCount, total: files.length });
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    dragging = false;
    const dataTransfer = event.dataTransfer;
    if (dataTransfer === null || disabled || busy) return;
    await processFiles(await collectFiles(dataTransfer));
  }
</script>

<div
  role="region"
  aria-label={m["editor.bms_drop_title"]()}
  class="rounded-lg border border-dashed px-4 py-4 transition-colors duration-200 {dragging
    ? 'border-[#64b5f6] bg-[#64b5f6]/10'
    : 'border-white/25 bg-black/10'}"
  ondragover={(event) => {
    event.preventDefault();
    if (!disabled && !busy) dragging = true;
  }}
  ondragleave={(event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) return;
    dragging = false;
  }}
  ondrop={(event) => {
    event.preventDefault();
    void handleDrop(event);
  }}
>
  <div class="flex flex-wrap items-center gap-3">
    <div class="min-w-0 flex-1">
      <div class="text-[0.9rem] text-white/75">{m["editor.bms_drop_title"]()}</div>
      <div class="text-[0.82rem] text-white/50">{m["editor.bms_drop_hint"]()}</div>
    </div>
    <button class={btnGhost} type="button" {disabled} onclick={() => fileInput?.click()}>
      {m["editor.bms_drop_button"]()}
    </button>
    <input
      class="hidden"
      type="file"
      multiple
      accept=".bms,.bme,.bml,.pms,.bmson"
      bind:this={fileInput}
      {disabled}
      onchange={(event) => {
        const files = event.currentTarget.files === null ? [] : [...event.currentTarget.files];
        event.currentTarget.value = "";
        void processFiles(files);
      }}
    />
  </div>
  {#if busy}
    <div class="mt-2 text-[0.85rem] text-[#90caf9]">
      {m["editor.bms_drop_busy"]({ done: progress.done, total: progress.total })}
    </div>
  {/if}
  {#if error !== null}
    <div class="mt-2 text-[0.85rem] text-red-300">{error}</div>
  {/if}
</div>
