/**
 * BMS 难度表内容格式的类型模型：header.json 与 data.json（含 course 段位）
 * 的公开格式。消费方：查看器、编辑器、搜索与数据层。宽格式域（可含未知
 * 自定义字段）故保留索引签名；纯类型模块，无运行时依赖。
 */

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
