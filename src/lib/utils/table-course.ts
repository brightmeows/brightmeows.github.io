/**
 * 段位（course）编辑的纯函数层：头部 course 字段的解析、编辑模型与序列化。
 * 兼容规范的扁平（Course[]）与嵌套（Course[][]）两种形状，保留未知字段；
 * charts/md5/sha256 归一到统一的编辑行，序列化时统一写为 `charts`。
 */

import { moveItem } from "./table-editor";

/** 规范固定的 constraint 取值（未知值原样保留在模型里）。 */
export const COURSE_CONSTRAINTS: readonly string[] = [
  "grade_random",
  "grade_mirror",
  "no_speed",
  "no_good",
  "no_great",
  "gauge_lr2",
  "gauge_5k",
  "gauge_7k",
  "gauge_9k",
  "gauge_24k",
];

/** 奖牌名的固定取值（未知值同样保留）。 */
export type CourseHashIssue = "ok" | "missing" | "md5" | "sha256";

/** 段位谱面哈希格式校验：md5 与 sha256 至少填一，已填的须为对应定长十六进制。 */
export function courseHashIssue(item: CourseChartItem): CourseHashIssue {
  const md5 = item.md5.trim();
  const sha256 = item.sha256.trim();
  if (md5 === "" && sha256 === "") return "missing";
  if (md5 !== "" && !/^[0-9a-f]{32}$/iu.test(md5)) return "md5";
  if (sha256 !== "" && !/^[0-9a-f]{64}$/iu.test(sha256)) return "sha256";
  return "ok";
}

export const TROPHY_NAMES: readonly string[] = ["goldmedal", "silvermedal", "bronzemedal"];

export interface CourseChartItem {
  md5: string;
  sha256: string;
  levelText: string;
  /** 条目上的其他字段，原样保留。 */
  extra: Record<string, unknown>;
}

export interface CourseTrophyItem {
  name: string;
  missrateText: string;
  scorerateText: string;
  extra: Record<string, unknown>;
}

export interface EditableCourse {
  name: string;
  /** 全部 constraint 值（含未知值），顺序即写入顺序。 */
  constraints: string[];
  trophies: CourseTrophyItem[];
  charts: CourseChartItem[];
  /** 课程对象上的其他字段，原样保留。 */
  extra: Record<string, unknown>;
}

export interface EditableCourseGroup {
  courses: EditableCourse[];
}

export interface CourseModel {
  /** 原 course 的形状：flat 为 Course[]，nested 为 Course[][]。 */
  shape: "flat" | "nested";
  groups: EditableCourseGroup[];
  /** 原键是否存在；空模型且不存在时序列化返回 undefined（删除该键）。 */
  present: boolean;
}

export function emptyCourseModel(): CourseModel {
  return { shape: "flat", groups: [], present: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === undefined || value === null) return "";
  return JSON.stringify(value) ?? "";
}

function numberText(value: unknown): string {
  return typeof value === "number" || typeof value === "string" ? String(value) : "";
}

function parseCourseChart(raw: unknown): CourseChartItem | null {
  if (!isPlainObject(raw)) return null;
  const extra: Record<string, unknown> = { ...raw };
  const md5 = str(raw.md5);
  const sha256 = str(raw.sha256);
  const levelText = numberText(raw.level);
  delete extra.md5;
  delete extra.sha256;
  delete extra.level;
  if (md5 === "" && sha256 === "") return null;
  return { md5, sha256, levelText, extra };
}

function parseTrophy(raw: unknown): CourseTrophyItem | null {
  if (!isPlainObject(raw)) return null;
  const extra: Record<string, unknown> = { ...raw };
  const name = str(raw.name);
  const missrateText = numberText(raw.missrate);
  const scorerateText = numberText(raw.scorerate);
  delete extra.name;
  delete extra.missrate;
  delete extra.scorerate;
  return { name, missrateText, scorerateText, extra };
}

function parseCourseObject(raw: unknown): EditableCourse {
  const record = isPlainObject(raw) ? raw : {};
  const extra: Record<string, unknown> = { ...record };

  const name = str(record.name);
  delete extra.name;

  const constraints = Array.isArray(record.constraint)
    ? record.constraint.filter((item): item is string => typeof item === "string")
    : [];
  if (Array.isArray(record.constraint)) delete extra.constraint;

  const trophies = Array.isArray(record.trophy)
    ? record.trophy.flatMap((item): CourseTrophyItem[] => {
        const parsed = parseTrophy(item);
        return parsed === null ? [] : [parsed];
      })
    : [];
  if (Array.isArray(record.trophy)) delete extra.trophy;

  const charts: CourseChartItem[] = [];
  if (Array.isArray(record.charts)) {
    for (const item of record.charts) {
      const parsed = parseCourseChart(item);
      if (parsed !== null) charts.push(parsed);
    }
    delete extra.charts;
  }
  // 规范合并顺序：charts → md5 → sha256
  for (const key of ["md5", "sha256"] as const) {
    const values = record[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value !== "string" || value === "") continue;
      charts.push(
        key === "md5"
          ? { md5: value, sha256: "", levelText: "", extra: {} }
          : { md5: "", sha256: value, levelText: "", extra: {} }
      );
    }
    delete extra[key];
  }

  return { name, constraints, trophies, charts, extra };
}

/**
 * 解析头部 course 字段。扁平与嵌套都接受；混合形状按嵌套处理（非数组项包成单课程组）。
 * 未定义或非数组返回空模型（present=false）。
 */
export function parseCourse(raw: unknown): CourseModel {
  if (!Array.isArray(raw)) return emptyCourseModel();
  if (raw.length === 0) return { shape: "flat", groups: [], present: true };
  const nested = raw.some((item) => Array.isArray(item));
  const groups = raw.map((item) => ({
    courses: (Array.isArray(item) ? item : [item]).map(parseCourseObject),
  }));
  return { shape: nested ? "nested" : "flat", groups, present: true };
}

function serializeTrophy(trophy: CourseTrophyItem): Record<string, unknown> {
  const out: Record<string, unknown> = { ...trophy.extra };
  out.name = trophy.name;
  const missrate = trophy.missrateText.trim();
  if (missrate === "") delete out.missrate;
  else out.missrate = Number.isFinite(Number(missrate)) ? Number(missrate) : missrate;
  const scorerate = trophy.scorerateText.trim();
  if (scorerate === "") delete out.scorerate;
  else out.scorerate = Number.isFinite(Number(scorerate)) ? Number(scorerate) : scorerate;
  return out;
}

function serializeChart(chart: CourseChartItem): Record<string, unknown> {
  const out: Record<string, unknown> = { ...chart.extra };
  if (chart.md5.trim() !== "") out.md5 = chart.md5.trim();
  else delete out.md5;
  if (chart.sha256.trim() !== "") out.sha256 = chart.sha256.trim();
  else delete out.sha256;
  const level = chart.levelText.trim();
  if (level === "") delete out.level;
  else out.level = level;
  return out;
}

function serializeCourseObject(course: EditableCourse): Record<string, unknown> {
  const out: Record<string, unknown> = { ...course.extra };
  out.name = course.name;
  if (course.constraints.length > 0) out.constraint = [...course.constraints];
  else delete out.constraint;
  if (course.trophies.length > 0) out.trophy = course.trophies.map(serializeTrophy);
  else delete out.trophy;
  out.charts = course.charts.map(serializeChart);
  return out;
}

/** 序列化编辑模型；空且原本不存在的 course 返回 undefined（调用方删除该键）。 */
export function serializeCourse(model: CourseModel): unknown {
  const flat = model.groups.flatMap((group) => group.courses.map(serializeCourseObject));
  if (!model.present && flat.length === 0) return undefined;
  return model.shape === "nested"
    ? model.groups.map((group) => group.courses.map(serializeCourseObject))
    : flat;
}

/** 模型中没有任何课程。 */
export function isCourseEmpty(model: CourseModel): boolean {
  return model.groups.every((group) => group.courses.length === 0);
}

/** 课程的展示标签：名称为空时回退到“未命名”。 */
export function courseChartHash(item: CourseChartItem): string {
  return (item.md5.trim() || item.sha256.trim()).toLowerCase();
}

/** 构建表内哈希集合（小写），供解析状态与标签查找共用。 */
export function buildEntryHashSet(entries: readonly Record<string, unknown>[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    for (const key of ["md5", "sha256"] as const) {
      const value = entry[key];
      if (typeof value === "string" && value.trim() !== "") set.add(value.trim().toLowerCase());
    }
  }
  return set;
}

/** 段位谱面是否能在当前表内解析到。 */
export function courseChartResolvedIn(
  hashSet: ReadonlySet<string>,
  item: CourseChartItem
): boolean {
  const hash = courseChartHash(item);
  return hash !== "" && hashSet.has(hash);
}

/** 在最后一个课程组追加一个空课程；模型为空且原本不存在时建立嵌套形状。 */
export function addCourseToModel(model: CourseModel): CourseModel {
  const course: EditableCourse = { name: "", constraints: [], trophies: [], charts: [], extra: {} };
  const groups = [...model.groups];
  if (groups.length === 0) {
    const shape = model.present ? model.shape : "nested";
    return { shape, groups: [{ courses: [course] }], present: true };
  }
  const last = groups[groups.length - 1];
  if (last === undefined) return model;
  groups[groups.length - 1] = { courses: [...last.courses, course] };
  return { ...model, groups, present: true };
}

/** 删除指定课程；删空后保留组结构（序列化时为空组）。 */
export function removeCourseFromModel(
  model: CourseModel,
  groupIndex: number,
  courseIndex: number
): CourseModel {
  const groups = model.groups.map((group, gi) =>
    gi === groupIndex ? { courses: group.courses.filter((_, ci) => ci !== courseIndex) } : group
  );
  return { ...model, groups, present: true };
}

/** 追加一个空课程组（形状切换为嵌套）。 */
export function addGroupToModel(model: CourseModel): CourseModel {
  const course: EditableCourse = { name: "", constraints: [], trophies: [], charts: [], extra: {} };
  return {
    ...model,
    shape: "nested",
    groups: [...model.groups, { courses: [course] }],
    present: true,
  };
}

/** 删除课程组。 */
export function removeGroupFromModel(model: CourseModel, groupIndex: number): CourseModel {
  return {
    ...model,
    groups: model.groups.filter((_, index) => index !== groupIndex),
    present: true,
  };
}

/** 在课程组内上移或下移一个课程。 */
export function moveCourseInModel(
  model: CourseModel,
  groupIndex: number,
  courseIndex: number,
  delta: number
): CourseModel {
  const groups = model.groups.map((group, gi) => {
    if (gi !== groupIndex) return group;
    return { courses: moveItem(group.courses, courseIndex, courseIndex + delta) };
  });
  return { ...model, groups, present: true };
}

/** 移动课程内的段位谱面行。 */
export function moveChartRow(course: EditableCourse, index: number, delta: number): EditableCourse {
  return { ...course, charts: moveItem(course.charts, index, index + delta) };
}
