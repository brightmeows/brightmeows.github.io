/** 镜像表格项 */
export interface MirrorTableItem {
  name: string;
  symbol?: string;
  url: string;
  url_ori?: string;
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

/** 表头数据 */
export interface HeaderData {
  name?: string;
  symbol?: string;
  data_url?: string;
  level_order?: string[];
  [key: string]: unknown;
}

/** 难度对照项 */
export interface LevelRefItem {
  level: string;
  ref: string;
}
