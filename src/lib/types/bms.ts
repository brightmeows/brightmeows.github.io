import type { MirrorTableItem } from "@brightmeows/mirror/types";

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

/** 谱面数据 */
export interface ChartData {
  title?: string | undefined;
  artist?: string | undefined;
  level?: string | undefined;
  sha256?: string | undefined;
  md5?: string | undefined;
  comment?: string | undefined;
  url?: string | undefined;
  url_diff?: string | undefined;
  [key: string]: unknown;
}

/** 难度分组 */
export interface DifficultyGroup {
  level: string;
  charts: ChartData[];
}

/** 段位奖牌条件 */
export interface Trophy {
  name: string; // 'goldmedal' | 'silvermedal' | 'bronzemedal'
  missrate?: number;
  scorerate?: number;
}

/** 段位内单谱面（已解析） */
export interface CourseChartInfo {
  md5?: string | undefined;
  sha256?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
  level?: string | undefined;
  resolved: boolean;
}

/** 段位（Course 对象） */
export interface Course {
  name: string;
  constraint?: string[] | undefined;
  trophy?: Trophy[] | undefined;
  charts: CourseChartInfo[];
}

/** 段位列表分组（始终归一化为嵌套数组的外层元素） */
export type ResolvedCourseGroup = Course[];

/** 表头数据 */
export interface HeaderData {
  name?: string;
  symbol?: string;
  data_url?: string;
  level_order?: string[];
  course?: unknown; // 原始值，由 resolveCourses 处理
  [key: string]: unknown;
}

/** 难度对照项 */
export interface LevelRefItem {
  level: string;
  ref: string;
}

/** 加载进度事件 */
export interface LoadProgressEvent {
  percent: number;
  phase: "connecting" | "downloading" | "parsing" | "processing" | "done";
  message: string;
  detail?: string;
}

/** 加载进度回调 */
export type ProgressCallback = (event: LoadProgressEvent) => void;
