/** 镜像表格项 */
export interface MirrorTableItem {
  name: string;
  symbol?: string;
  url: string;
  url_from?: string;
  comment?: string;
  date?: string;
  state?: string;
  tag1?: string;
  tag2?: string;
  tag_order?: string | number;
  dir_name?: string;
  url_data_json?: string;
  url_header_json?: string;
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
  title?: string;
  artist?: string;
  level?: string;
  sha256?: string;
  md5?: string;
  comment?: string;
  url?: string;
  url_diff?: string;
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
  md5?: string;
  sha256?: string;
  title?: string;
  artist?: string;
  level?: string;
  resolved: boolean;
}

/** 段位（Course 对象） */
export interface Course {
  name: string;
  constraint?: string[];
  trophy?: Trophy[];
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
