/**
 * 共享表（`/bms/table/shared`）的零依赖内核：id 规则、资源上限、载荷校验、
 * 字段保留与导出改写、清单变换。站点、Worker 与构建期脚本共用本模块，
 * 约束与镜像内核一致：零依赖、可擦除语法、相对导入带 .ts 扩展名。
 *
 * 数据纪律：共享表的权威数据是 R2 `shared/<id>/` 下的 header.json 与
 * data.json，D1 只存元数据（列表用）与 id/别名索引；编辑保存是整包覆盖，
 * 未知自定义字段必须原样保留（`applyEntryFields`），下载导出时把 data_url
 * 改写为同目录的 `./data.json` 使两个文件自包含。
 */

import { sharedTablePath } from "./urls.ts";

/** 单个 header.json 的字节上限（序列化后的 UTF-8 字节数）。 */
export const SHARED_MAX_HEADER_BYTES = 1024 * 1024;

/** 单个 data.json 的字节上限。 */
export const SHARED_MAX_DATA_BYTES = 10 * 1024 * 1024;

/** data 数组的条目数上限：同时是编辑器分页渲染的输入约束。 */
export const SHARED_MAX_ENTRIES = 10_000;

/** 每账号同时持有的共享表张数上限（回收站中的不占名额）。 */
export const SHARED_MAX_TABLES_PER_USER = 10;

/** id 的码点长度上限。 */
export const SHARED_MAX_ID_LENGTH = 32;

/**
 * 保留 id：与新建路由 `/bms/table/shared/new/` 及编辑子路径冲突。
 * `tables.json`（列表端点）无须列入——`.` 不在 id 字符集内。
 */
export const SHARED_RESERVED_IDS: readonly string[] = ["new", "edit"];

/** id 校验失败的原因码（前端按 i18n key 展示）。 */
export type SharedIdError = "empty" | "too_long" | "charset" | "reserved";

export type SharedIdResult = { ok: true; id: string } | { ok: false; error: SharedIdError };

/**
 * id 规范化：去首尾空白、NFC 归一、ASCII 大小写折叠。
 *
 * 折叠只处理 A–Z（不做 Unicode 全量小写，避免同形异码字混入），保证
 * `My-Table` 与 `my-table` 是同一个 id、去重口径与大小写无关。
 */
export function normalizeSharedId(raw: string): string {
  const trimmed = raw.trim().normalize("NFC");
  let out = "";
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0;
    out += cp >= 0x41 && cp <= 0x5a ? String.fromCodePoint(cp + 0x20) : ch;
  }
  return out;
}

/**
 * id 允许的字符：`[a-z0-9-]` 加中日韩文字（统一表意、扩展 A、兼容表意、
 * 假名、谚文、部件与重复字符、扩展 B 及以上）。全角与拉丁扩展等同形字符
 * 一律拒绝（NFC 不做兼容分解，全角 Ａ 不会折成 a，天然挡掉视觉混淆）。
 */
export function isAllowedSharedIdChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? -1;
  if (cp >= 0x30 && cp <= 0x39) return true; // 0-9
  if (cp >= 0x61 && cp <= 0x7a) return true; // a-z
  if (cp === 0x2d) return true; // -
  if (cp >= 0x3400 && cp <= 0x4dbf) return true; // CJK 扩展 A
  if (cp >= 0x4e00 && cp <= 0x9fff) return true; // CJK 统一表意
  if (cp >= 0xf900 && cp <= 0xfaff) return true; // CJK 兼容表意
  if (cp >= 0x3040 && cp <= 0x30ff) return true; // 假名与日文符号
  if (cp >= 0xac00 && cp <= 0xd7af) return true; // 谚文
  if (cp === 0x3005 || cp === 0x3007) return true; // 々 〇
  if (cp >= 0x20000 && cp <= 0x2ffff) return true; // CJK 扩展 B+
  return false;
}

/** 校验并规范化 id；失败返回稳定原因码（服务端与前端共用同一套规则）。 */
export function validateSharedId(raw: string): SharedIdResult {
  const id = normalizeSharedId(raw);
  if (id === "") return { ok: false, error: "empty" };
  if (Array.from(id).length > SHARED_MAX_ID_LENGTH) return { ok: false, error: "too_long" };
  for (const ch of id) {
    if (!isAllowedSharedIdChar(ch)) return { ok: false, error: "charset" };
  }
  if (SHARED_RESERVED_IDS.includes(id)) return { ok: false, error: "reserved" };
  return { ok: true, id };
}

/**
 * UTF-8 字节长度（不用 TextEncoder：内核要保持“只有 ES + URL”的最小宿主面）。
 * 用于对序列化后的 header/data 施加尺寸上限。
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0x7f) bytes += 1;
    else if (cp <= 0x7ff) bytes += 2;
    else if (cp <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** 载荷校验失败的原因码。 */
export type SharedPayloadError =
  | "header_invalid"
  | "header_too_large"
  | "missing_identity"
  | "data_invalid"
  | "data_too_large"
  | "too_many_entries"
  | "entry_invalid";

/**
 * 编辑器的字段合并：只覆盖调用方提交的已知字段，其余（含自定义字段）
 * 原样保留；值为 `undefined` 表示清除该键，不落成 JSON 里的 null。
 */
export function applyEntryFields(
  original: Record<string, unknown>,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...original };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

/** 返回把 header 的 data_url 指向指定地址的副本（不改动入参）。 */
export function withDataUrl(
  header: Record<string, unknown>,
  dataUrl: string
): Record<string, unknown> {
  return { ...header, data_url: dataUrl };
}

/**
 * 下载导出用：data_url 改写为同目录的 `./data.json`，使下载的两个文件
 * 自包含（线上权威件的 data_url 仍是 R2 绝对地址，两者只差这一键）。
 */
export function withLocalDataUrl(header: Record<string, unknown>): Record<string, unknown> {
  return withDataUrl(header, "./data.json");
}

/**
 * 需要按 Float 补写小数点的字段：難易度表规范里 header 的 trophy 数值字段。
 * beatoraja 内置的 jbmstable-parser（2018 年版 jar，0.8.9 仍未更新）对这两处
 * 做 `(double)` 原始类型强转，JS 序列化的整数形式会令已装机用户导入即抛
 * ClassCastException；主流表统一写 `5.0`，补写后与其对齐。
 */
const FLOAT_PAD_FIELDS: ReadonlySet<string> = new Set(["missrate", "scorerate"]);

/**
 * 补写哨兵：NUL 开头的串在真实表数据里不会出现。深拷贝时把目标整数值换成
 * 哨兵串，序列化后替换回裸数字；真实数据撞形时整体回退普通序列化。
 */
const FLOAT_PAD_SENTINEL = "\u0000bmstable-float:";

/** 序列化文本里的哨兵形态（\u0000 已被 JSON.stringify 转义为六字符序列）。 */
const FLOAT_PAD_TOKEN = /"\\u0000bmstable-float:([^"]+)"/g;

function containsFloatSentinel(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith(FLOAT_PAD_SENTINEL);
  if (Array.isArray(value)) return value.some(containsFloatSentinel);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, item]) => key.startsWith(FLOAT_PAD_SENTINEL) || containsFloatSentinel(item)
  );
}

function padFloatValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(padFloatValues);
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] =
      FLOAT_PAD_FIELDS.has(key) && typeof item === "number" && Number.isInteger(item)
        ? FLOAT_PAD_SENTINEL + item.toFixed(1)
        : padFloatValues(item);
  }
  return out;
}

/**
 * 共享表 JSON 产物的统一序列化（header.json、data.json、合并包与内嵌
 * header 的任何产物）：输出与 `JSON.stringify(value, null, 2)` 逐字节一致，
 * 仅把 missrate/scorerate 的整数值补写 `.0`（因果见上方 FLOAT_PAD_FIELDS）。
 * 数据与哨兵撞形时整体回退普通序列化：只损失旧版兼容，绝不改动数据本身。
 */
export function serializeSharedJson(value: unknown): string {
  if (containsFloatSentinel(value)) return JSON.stringify(value, null, 2);
  return JSON.stringify(padFloatValues(value), null, 2).replace(FLOAT_PAD_TOKEN, "$1");
}

/** R2 上共享表对象的键前缀（对象键用原始 id，公开 URL 才百分号编码）。 */
export function sharedObjectPrefix(id: string): string {
  return `shared/${id}`;
}

/** 共享表清单条目：D1 元数据加按请求 origin 填充的页面地址。 */
export interface SharedTableItem {
  /** 表 id（已规范化），同时是 R2 目录名与页面路径段。 */
  id: string;
  name: string;
  symbol?: string | undefined;
  author: string;
  created_at: string;
  updated_at: string;
  /** data.json 条目数，来自最近一次保存时的统计。 */
  entries: number;
  /** 站点共享页绝对地址；生成时按请求 origin 重写。 */
  url: string;
}

/** 把清单条目的 url 统一为请求 origin 下的共享页地址。 */
export function transformSharedTableList(
  items: SharedTableItem[],
  origin: string
): SharedTableItem[] {
  const base = origin.replace(/\/+$/, "");
  return items.map((item) => ({ ...item, url: `${base}${sharedTablePath(item.id)}` }));
}

/** 站点清单的稳定序列化：Worker 动态响应使用。 */
export function serializeSharedTableList(items: SharedTableItem[]): string {
  return `${JSON.stringify(items, null, 2)}\n`;
}
