/**
 * 管线共享类型。
 *
 * 字段语义以旧实现 bms-table-fetch v0.4.2 为准：info.json、tables.json、
 * header.json、data.json 与 indexes 属于对外对象，字段与序列化顺序保持兼容。
 */

/** JSON 值（与 JSON.parse 的结果同构）。 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** 难度表条目：name/symbol/url 为核心字段，其余字段（tag1、comment、date 等）原样保留。 */
export interface TableInfo {
  name: string;
  symbol: string;
  url: string;
  extra: Record<string, JsonValue>;
}

/** overlay 之后的活跃表集合。 */
export interface ActiveSet {
  activeUrls: Set<string>;
  tableInfoMap: Map<string, TableInfo>;
  oldDirMap: Map<string, string>;
}

/** 轻量扫描结果：只读 info.json。 */
export interface DirEntry {
  dirName: string;
  info: TableInfo;
}

/** 全量扫描结果：info.json 加可选的 data.json 原文。 */
export interface FullDirEntry extends DirEntry {
  dataRaw: string | null;
}

/** 待执行的目录重命名。 */
export interface RenameAction {
  oldName: string;
  newName: string;
}
