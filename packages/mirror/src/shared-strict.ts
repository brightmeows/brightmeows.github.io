/**
 * 共享表载荷的强验证（bms-table 技能字段表口径）：在结构之上逐字段校验
 * 类型、枚举与数值范围；未知字段宽容保留，只产出按字段名去重的警告。
 *
 * 与 mirror/shared.ts 的关系：结构与上限判定沿用同源常量（utf8ByteLength
 * 与 SHARED_MAX_*），错误码沿用 SharedPayloadError 并扩充字段级代码。
 * 错误是硬规则（拒绝导入或保存）；警告只提示不阻断，服务端只消费错误，
 * 警告仅存在于客户端。校验不裁剪数据——未知字段由编辑侧 applyEntryFields
 * 原样保留。翻译由调用方完成（本模块返回稳定代码与插值参数）。
 *
 * 约束与镜像内核一致：零依赖、可擦除语法、相对导入带 .ts 扩展名。
 */

import {
  SHARED_MAX_DATA_BYTES,
  SHARED_MAX_ENTRIES,
  SHARED_MAX_HEADER_BYTES,
  utf8ByteLength,
  type SharedPayloadError,
} from "./shared.ts";
import { isRecord } from "./types.ts";

// ---------------------------------------------------------------------------
// 封闭清单与枚举（bms-table 技能字段表；技能扩充时同步维护）
// ---------------------------------------------------------------------------

/** 段位约束的封闭枚举（技能：constraint 可选值）。 */
export const SHARED_COURSE_CONSTRAINTS: readonly string[] = [
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

/** 奖牌条件的封闭枚举（技能：trophy name 可选值）。 */
export const SHARED_TROPHY_NAMES: readonly string[] = ["goldmedal", "silvermedal", "bronzemedal"];

/** header 的已知字段清单（封闭）：清单外即“未知字段”。 */
export const STRICT_HEADER_FIELDS: readonly string[] = [
  "name",
  "data_url",
  "symbol",
  "tag",
  "level_order",
  "course",
  "mode",
];

/**
 * data 条目的已知字段清单：规范标准字段加规范点名的社区常见自定义字段
 * （total、judge 等；難易度表の仕様要求解析器对未知字段保持宽容）。
 * 只用于豁免未知字段警告，类型约束由 STRICT_DATA_STRING_FIELDS 另行承担
 * （total、judge、eval 是数值，进字符串类型清单会误报 field_type）。
 */
export const STRICT_DATA_FIELDS: readonly string[] = [
  "md5",
  "sha256",
  "level",
  "title",
  "artist",
  "url",
  "url_diff",
  "name_diff",
  "url_pack",
  "name_pack",
  "comment",
  "org_md5",
  "mode",
  "ipfs",
  "ipfs_diff",
  "lr2_bmsid",
  "total",
  "judge",
  "note",
  "tag",
  "eval",
];

/** data 条目中要求“存在即须为字符串”的已知字段（level 单独校验非空）。 */
export const STRICT_DATA_STRING_FIELDS: readonly string[] = [
  "md5",
  "sha256",
  "title",
  "artist",
  "url",
  "url_diff",
  "name_diff",
  "url_pack",
  "name_pack",
  "comment",
  "org_md5",
  "mode",
  "ipfs",
  "ipfs_diff",
  "lr2_bmsid",
];

/** 段位对象的已知字段清单（封闭）。 */
export const STRICT_COURSE_FIELDS: readonly string[] = [
  "name",
  "constraint",
  "trophy",
  "charts",
  "md5",
  "sha256",
];

// ---------------------------------------------------------------------------
// 结果类型
// ---------------------------------------------------------------------------

/** 强验证错误代码：基线错误码（结构、身份与上限）加字段级代码。 */
export type SharedStrictCode =
  | SharedPayloadError
  | "field_type"
  | "level_order_not_array"
  | "level_order_element"
  | "course_not_array"
  | "course_element"
  | "course_name"
  | "course_constraint_type"
  | "course_constraint_value"
  | "course_trophy_type"
  | "course_trophy_name"
  | "course_trophy_range"
  | "course_charts"
  | "course_hashes"
  | "entry_level"
  | "entry_field_type";

/** 单条强验证错误：稳定代码加定位路径与插值参数（翻译由调用方完成）。 */
export interface SharedStrictError {
  code: SharedStrictCode;
  /** 定位路径，如 `header.course[2].trophy[0].missrate` 或 `data[12].level`。 */
  path: string;
  params: Record<string, string | number>;
}

/** 强验证警告：只提示不阻断（可省略的必须键、未知字段与交叉一致性）。 */
export type SharedStrictWarning =
  | { kind: "missing_data_url" }
  | { kind: "unknown_field"; scope: "header" | "course" | "entry"; field: string }
  | { kind: "level_not_listed"; levels: string[] }
  | { kind: "course_hash_unmatched"; hashes: string[] };

/** 强验证结果：ok 为 false 时 errors 非空；警告与错误互不排斥。 */
export interface SharedStrictReport {
  ok: boolean;
  errors: SharedStrictError[];
  warnings: SharedStrictWarning[];
  /** 错误数达到收集上限被截断。 */
  truncated: boolean;
  /** 通过形状校验的条目引用（仅 data 校验填充；调用方免二次转型取用）。 */
  entries: Record<string, unknown>[];
  /** 通过校验的 header 引用（完整载荷校验填充；非法时为 null）。 */
  header: Record<string, unknown> | null;
}

/**
 * editor.strict_* 消息键的单一来源：站点侧映射器与格式化器经本表取键，
 * scripts/check-i18n-coverage.ts 经本表把动态引用计入（同 API_ERROR_CODES
 * 的先例）。键的条目在 messages/{en,zh-cn,ja}.json 维护。
 */
export const STRICT_EDITOR_MESSAGE_KEYS = {
  fieldType: "editor.strict_field_type",
  notArray: "editor.strict_not_array",
  levelOrderElement: "editor.strict_level_order_element",
  courseElement: "editor.strict_course_element",
  courseName: "editor.strict_course_name",
  courseConstraintType: "editor.strict_course_constraint_type",
  courseConstraintValue: "editor.strict_course_constraint_value",
  courseTrophyType: "editor.strict_course_trophy_type",
  courseTrophyName: "editor.strict_course_trophy_name",
  courseTrophyRange: "editor.strict_course_trophy_range",
  courseCharts: "editor.strict_course_charts",
  courseHashes: "editor.strict_course_hashes",
  entryLevel: "editor.strict_entry_level",
  failed: "editor.strict_failed",
  errorMore: "editor.strict_error_more",
  errorTruncated: "editor.strict_error_truncated",
  warnings: "editor.strict_warnings",
  warnMissingDataUrl: "editor.strict_warn_missing_data_url",
  warnUnknownField: "editor.strict_warn_unknown_field",
  warnLevelNotListed: "editor.strict_warn_level_not_listed",
  warnCourseHash: "editor.strict_warn_course_hash",
} as const;

/** 单次校验的错误收集上限（10000 条全坏时不至于产出上万条错误对象）。 */
const MAX_STRICT_ERRORS = 100;

/** 单条警告里等级或哈希样例的展示上限（完整清单以编辑器条目为准）。 */
const MAX_WARNING_SAMPLES = 20;

// ---------------------------------------------------------------------------
// 校验入口
// ---------------------------------------------------------------------------

/**
 * 校验 header：对象、序列化尺寸、已知字段类型、level_order 与 course 结构；
 * 产出缺失 data_url 与未知字段警告。不含身份检查（name/symbol 由完整
 * 载荷校验或表单承担）。
 */
export function strictCheckHeader(header: unknown): SharedStrictReport {
  const errors = new ErrorCollector();
  const warnings: SharedStrictWarning[] = [];
  const seenUnknown = new Set<string>();
  if (!isRecord(header)) {
    errors.add({ code: "header_invalid", path: "header", params: {} });
    return finish(errors, warnings);
  }
  if (utf8ByteLength(JSON.stringify(header)) > SHARED_MAX_HEADER_BYTES) {
    errors.add({ code: "header_too_large", path: "header", params: {} });
    return finish(errors, warnings);
  }
  collectUnknownFields(header, STRICT_HEADER_FIELDS, "header", warnings, seenUnknown);
  for (const field of ["tag", "mode"] as const) {
    if (field in header && typeof header[field] !== "string") {
      errors.add(fieldTypeError("header." + field));
    }
  }
  if ("data_url" in header) {
    const dataUrl = header.data_url;
    if (typeof dataUrl !== "string" || dataUrl.trim() === "") {
      errors.add(fieldTypeError("header.data_url"));
    }
  } else {
    warnings.push({ kind: "missing_data_url" });
  }
  checkLevelOrder(header, errors);
  checkCourseField(header, errors, warnings, seenUnknown);
  return finish(errors, warnings, [], header);
}

/**
 * 校验 data：数组、条目数与序列化尺寸、逐条身份与 level、已知字段类型；
 * 产出未知字段警告（按字段名去重）。
 */
export function strictCheckData(data: unknown): SharedStrictReport {
  const errors = new ErrorCollector();
  const warnings: SharedStrictWarning[] = [];
  const seenUnknown = new Set<string>();
  if (!Array.isArray(data)) {
    errors.add({ code: "data_invalid", path: "data", params: {} });
    return finish(errors, warnings);
  }
  if (data.length > SHARED_MAX_ENTRIES) {
    errors.add({ code: "too_many_entries", path: "data", params: {} });
    // 尺寸类错误即短路：超大载荷不再付出全量序列化与逐条遍历的代价
    return finish(errors, warnings);
  }
  if (utf8ByteLength(JSON.stringify(data)) > SHARED_MAX_DATA_BYTES) {
    errors.add({ code: "data_too_large", path: "data", params: {} });
    return finish(errors, warnings);
  }
  const records: Record<string, unknown>[] = [];
  data.forEach((entry, index) => {
    if (isRecord(entry)) records.push(entry);
    checkDataEntry(entry, index, errors, warnings, seenUnknown);
  });
  return finish(errors, warnings, records);
}

/**
 * 校验完整载荷：header 与 data 两侧加身份检查与交叉一致性（level 是否
 * 列入 level_order、course 哈希是否命中条目）。保存门槛与服务端复验用。
 */
export function strictCheckSharedPayload(header: unknown, data: unknown): SharedStrictReport {
  const headerReport = strictCheckHeader(header);
  const dataReport = strictCheckData(data);
  const errors = new ErrorCollector();
  for (const error of headerReport.errors) errors.add(error);
  if (isRecord(header) && !hasIdentity(header)) {
    errors.add({ code: "missing_identity", path: "header", params: {} });
  }
  for (const error of dataReport.errors) errors.add(error);
  const warnings = [
    ...headerReport.warnings,
    ...dataReport.warnings,
    ...crossWarnings(header, data),
  ];
  return finish(errors, warnings, dataReport.entries, headerReport.header);
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

/** 错误收集器：达到上限后丢弃后续并标记截断。 */
class ErrorCollector {
  readonly errors: SharedStrictError[] = [];
  truncated = false;

  add(error: SharedStrictError): void {
    if (this.errors.length >= MAX_STRICT_ERRORS) {
      this.truncated = true;
      return;
    }
    this.errors.push(error);
  }
}

/** 基线错误码判定：结构、身份与上限（沿用 api.shared_* 消息键与服务端错误码）。 */
export function isBaselinePayloadCode(code: SharedStrictCode): code is SharedPayloadError {
  return (
    code === "header_invalid" ||
    code === "header_too_large" ||
    code === "missing_identity" ||
    code === "data_invalid" ||
    code === "data_too_large" ||
    code === "too_many_entries" ||
    code === "entry_invalid"
  );
}

/** 任意值的稳定文本化（错误参数展示用）：字符串原样，其余 JSON 序列化。 */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  return `${JSON.stringify(value)}`;
}

/** header 身份：name 与 symbol 皆为非空字符串。 */
function hasIdentity(header: Record<string, unknown>): boolean {
  return (
    typeof header.name === "string" &&
    header.name.trim() !== "" &&
    typeof header.symbol === "string" &&
    header.symbol.trim() !== ""
  );
}

function fieldTypeError(path: string): SharedStrictError {
  return { code: "field_type", path, params: {} };
}

function finish(
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  entries: Record<string, unknown>[] = [],
  header: Record<string, unknown> | null = null
): SharedStrictReport {
  return {
    ok: errors.errors.length === 0,
    errors: errors.errors,
    warnings,
    truncated: errors.truncated,
    entries,
    header,
  };
}

/** 收集清单外的未知字段警告（按 scope 加字段名去重，保持插入序）。 */
function collectUnknownFields(
  record: Record<string, unknown>,
  known: readonly string[],
  scope: "header" | "course" | "entry",
  warnings: SharedStrictWarning[],
  seen: Set<string>
): void {
  for (const key of Object.keys(record)) {
    const id = scope + ":" + key;
    if (known.includes(key) || seen.has(id)) continue;
    seen.add(id);
    warnings.push({ kind: "unknown_field", scope, field: key });
  }
}

function checkLevelOrder(header: Record<string, unknown>, errors: ErrorCollector): void {
  if (!("level_order" in header)) return;
  const levelOrder = header.level_order;
  if (!Array.isArray(levelOrder)) {
    errors.add({ code: "level_order_not_array", path: "header.level_order", params: {} });
    return;
  }
  levelOrder.forEach((item, i) => {
    if (typeof item !== "string" && typeof item !== "number") {
      errors.add({
        code: "level_order_element",
        path: "header.level_order[" + i + "]",
        params: { index: i },
      });
    }
  });
}

function checkCourseField(
  header: Record<string, unknown>,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  seenUnknown: Set<string>
): void {
  if (!("course" in header)) return;
  const course = header.course;
  if (!Array.isArray(course)) {
    errors.add({ code: "course_not_array", path: "header.course", params: {} });
    return;
  }
  course.forEach((entry, i) => {
    if (Array.isArray(entry)) {
      entry.forEach((item, j) => {
        const path = "header.course[" + i + "][" + j + "]";
        const index = i + "." + j;
        if (isRecord(item)) {
          checkCourseObject(item, path, index, errors, warnings, seenUnknown);
        } else {
          errors.add({ code: "course_element", path, params: { index } });
        }
      });
    } else if (isRecord(entry)) {
      checkCourseObject(
        entry,
        "header.course[" + i + "]",
        String(i),
        errors,
        warnings,
        seenUnknown
      );
    } else {
      errors.add({
        code: "course_element",
        path: "header.course[" + i + "]",
        params: { index: String(i) },
      });
    }
  });
}

/** 校验单个段位对象（path 已带位置，index 是用于消息插值的段位序号）。 */
function checkCourseObject(
  course: Record<string, unknown>,
  path: string,
  index: string,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  seenUnknown: Set<string>
): void {
  collectUnknownFields(course, STRICT_COURSE_FIELDS, "course", warnings, seenUnknown);
  if (typeof course.name !== "string" || course.name.trim() === "") {
    errors.add({ code: "course_name", path: path + ".name", params: { index } });
  }
  if ("constraint" in course) {
    checkCourseConstraint(course.constraint, path, index, errors);
  }
  if ("trophy" in course) {
    checkCourseTrophy(course.trophy, path, index, errors);
  }
  if ("charts" in course) {
    const charts = course.charts;
    if (!Array.isArray(charts)) {
      errors.add({ code: "course_charts", path: path + ".charts", params: { index } });
    } else {
      charts.forEach((chart, i) => {
        if (!isRecord(chart)) {
          errors.add({
            code: "course_charts",
            path: path + ".charts[" + i + "]",
            params: { index },
          });
        }
      });
    }
  }
  for (const field of ["md5", "sha256"] as const) {
    if (!(field in course)) continue;
    const hashes = course[field];
    if (!Array.isArray(hashes) || !hashes.every((hash) => typeof hash === "string")) {
      errors.add({ code: "course_hashes", path: path + "." + field, params: { index, field } });
    }
  }
}

function checkCourseConstraint(
  constraint: unknown,
  path: string,
  index: string,
  errors: ErrorCollector
): void {
  if (!Array.isArray(constraint)) {
    errors.add({ code: "course_constraint_type", path: path + ".constraint", params: { index } });
    return;
  }
  constraint.forEach((value, i) => {
    if (typeof value !== "string" || !SHARED_COURSE_CONSTRAINTS.includes(value)) {
      errors.add({
        code: "course_constraint_value",
        path: path + ".constraint[" + i + "]",
        params: { index, value: textOf(value) },
      });
    }
  });
}

function checkCourseTrophy(
  trophy: unknown,
  path: string,
  index: string,
  errors: ErrorCollector
): void {
  if (!Array.isArray(trophy)) {
    errors.add({ code: "course_trophy_type", path: path + ".trophy", params: { index } });
    return;
  }
  trophy.forEach((item, i) => {
    const trophyPath = path + ".trophy[" + i + "]";
    if (!isRecord(item)) {
      errors.add({ code: "course_trophy_type", path: trophyPath, params: { index } });
      return;
    }
    if (typeof item.name !== "string" || !SHARED_TROPHY_NAMES.includes(item.name)) {
      errors.add({
        code: "course_trophy_name",
        path: trophyPath + ".name",
        params: { index, value: textOf(item.name) },
      });
    }
    for (const field of ["missrate", "scorerate"] as const) {
      const rate = item[field];
      if (rate !== undefined && (typeof rate !== "number" || rate < 0 || rate > 100)) {
        errors.add({
          code: "course_trophy_range",
          path: trophyPath + "." + field,
          params: { index, field, value: textOf(rate) },
        });
      }
    }
  });
}

function checkDataEntry(
  entry: unknown,
  index: number,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  seenUnknown: Set<string>
): void {
  if (!isRecord(entry)) {
    errors.add({ code: "entry_invalid", path: "data[" + index + "]", params: { index } });
    return;
  }
  const hasChartIdentity =
    (typeof entry.md5 === "string" && entry.md5 !== "") ||
    (typeof entry.sha256 === "string" && entry.sha256 !== "");
  if (!hasChartIdentity) {
    errors.add({ code: "entry_invalid", path: "data[" + index + "]", params: { index } });
  }
  if (typeof entry.level !== "string" || entry.level === "") {
    errors.add({ code: "entry_level", path: "data[" + index + "].level", params: { index } });
  }
  for (const field of STRICT_DATA_STRING_FIELDS) {
    if (field in entry && typeof entry[field] !== "string") {
      errors.add({
        code: "entry_field_type",
        path: "data[" + index + "]." + field,
        params: { index, field },
      });
    }
  }
  collectUnknownFields(entry, STRICT_DATA_FIELDS, "entry", warnings, seenUnknown);
}

/**
 * 交叉一致性警告：level 是否列入 level_order、course 哈希是否命中条目。
 * 独立导出，供分量分别校验的调用方（如新建页的分头导入）复用。
 */
export function crossWarnings(header: unknown, data: unknown): SharedStrictWarning[] {
  const warnings: SharedStrictWarning[] = [];
  if (!isRecord(header) || !Array.isArray(data)) return warnings;
  const levelOrder = header.level_order;
  if (Array.isArray(levelOrder)) {
    const listed = new Set(
      levelOrder
        .filter(
          (item): item is string | number => typeof item === "string" || typeof item === "number"
        )
        .map(String)
    );
    const unlisted = new Set<string>();
    for (const entry of data) {
      if (!isRecord(entry)) continue;
      const level = entry.level;
      if (typeof level === "string" && level !== "" && !listed.has(level)) {
        unlisted.add(level);
      }
    }
    if (unlisted.size > 0) {
      warnings.push({
        kind: "level_not_listed",
        levels: [...unlisted].slice(0, MAX_WARNING_SAMPLES),
      });
    }
  }
  const dataHashes = collectDataHashes(data);
  const unmatched = [...collectCourseHashes(header)].filter((hash) => !dataHashes.has(hash));
  if (unmatched.length > 0) {
    warnings.push({
      kind: "course_hash_unmatched",
      hashes: unmatched.slice(0, MAX_WARNING_SAMPLES),
    });
  }
  return warnings;
}

/** 收集 data 条目的全部哈希（小写归一）。 */
function collectDataHashes(data: unknown[]): Set<string> {
  const hashes = new Set<string>();
  for (const entry of data) {
    if (!isRecord(entry)) continue;
    for (const field of ["md5", "sha256"] as const) {
      const value = entry[field];
      if (typeof value === "string" && value !== "") hashes.add(value.toLowerCase());
    }
  }
  return hashes;
}

/** 收集段位引用的全部哈希（md5/sha256 清单与 charts 条目，小写归一）。 */
function collectCourseHashes(header: Record<string, unknown>): Set<string> {
  const hashes = new Set<string>();
  const course = header.course;
  if (!Array.isArray(course)) return hashes;
  const collectFromChart = (chart: unknown): void => {
    if (!isRecord(chart)) return;
    for (const field of ["md5", "sha256"] as const) {
      const value = chart[field];
      if (typeof value === "string" && value !== "") hashes.add(value.toLowerCase());
    }
  };
  const collectFromCourse = (item: Record<string, unknown>): void => {
    for (const field of ["md5", "sha256"] as const) {
      const list = item[field];
      if (!Array.isArray(list)) continue;
      for (const hash of list) {
        if (typeof hash === "string" && hash !== "") hashes.add(hash.toLowerCase());
      }
    }
    if (Array.isArray(item.charts)) {
      for (const chart of item.charts) collectFromChart(chart);
    }
  };
  for (const entry of course) {
    if (Array.isArray(entry)) {
      for (const item of entry) {
        if (isRecord(item)) collectFromCourse(item);
      }
    } else if (isRecord(entry)) {
      collectFromCourse(entry);
    }
  }
  return hashes;
}
