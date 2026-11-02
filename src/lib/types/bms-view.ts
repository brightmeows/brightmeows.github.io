/**
 * 站点侧视图与页面交互类型：清单分组、加载进度协议、镜像管理交互面。
 * 表内容格式模型在 `bms-format.ts`；两者按消费方拆分（2026-10，原
 * `bms.ts` 混装）。
 */

import type { MirrorTableItem } from "@brightmeows/mirror/types";
import type { MetaOverride } from "@brightmeows/mirror/user-layer";

/** 难度表列表项 */
export interface TableEntry {
  id: string;
  name: string;
  symbol?: string | undefined;
}

/** 二级分组（按 tag2） */
export interface Tag2Group {
  tag2: string;
  items: MirrorTableItem[];
}

/** 一级分组（按 tag1） */
export interface Tag1Group {
  tag1: string;
  order: number;
  subgroups: Tag2Group[];
}

/** 加载进度事件 */
export interface LoadProgressEvent {
  percent: number;
  phase: "connecting" | "downloading" | "parsing" | "processing" | "done";
  message: string;
  detail?: string;
}

export type ProgressCallback = (event: LoadProgressEvent) => void;

/** 元数据覆盖的可编辑字段（留空表示不覆盖该项）。 */
export interface MirrorMetaFields {
  name?: string | undefined;
  symbol?: string | undefined;
  tag1?: string | undefined;
  tag2?: string | undefined;
  tag_order?: string | undefined;
}

/** 列表页向行组件传递的管理交互面（非管理员时 isAdmin 为 false）。 */
export interface MirrorAdminUi {
  isAdmin: boolean;
  overviewState: MirrorOverviewState;
  expandedUrl: string | null;
  busy: boolean;
  overrideOf: (item: MirrorTableItem) => MetaOverride | null;
  toggleEdit: (item: MirrorTableItem) => void;
  openEdit: (item: MirrorTableItem) => void;
  authorize: (item: MirrorTableItem) => void;
  disable: (item: MirrorTableItem, note: string) => void;
  saveMeta: (item: MirrorTableItem, fields: MirrorMetaFields) => void;
  clearMeta: (item: MirrorTableItem) => void;
  /** 清单中出现过的一级标签值（去重排序，供编辑建议）。 */
  tag1Options: string[];
  /** 清单中出现过的二级标签值（去重排序，供编辑建议）。 */
  tag2Options: string[];
  /** 下一个可用的一级标签序号（现有最大值加一）。 */
  nextTagOrder: string;
}

export type MirrorOverviewState = "idle" | "loading" | "ready" | "error";
