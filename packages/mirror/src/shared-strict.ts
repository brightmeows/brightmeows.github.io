/**
 * 共享表载荷的强验证：在结构之上逐字段校验类型与数值范围；未知字段与
 * 未识别的段位约束值宽容保留，只产出警告。
 *
 * 段位约束词表对齐权威实现 beatoraja 的 CourseDataConstraint 全枚举
 * （比 bms-table 技能文档多 grade/ln/cn/hcn 四值）；清单外的字符串值
 * 只警告不拒收（真实难度表存在自定义约束与空串值，整表拒绝会误伤）。
 * 奖牌名是显示文本（beatoraja 只要求非空），不做枚举校验。
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
// 封闭清单与枚举（constraint 对齐 beatoraja 全枚举；技能文档扩充时同步维护）
// ---------------------------------------------------------------------------

/** 段位约束的已知值清单（beatoraja CourseDataConstraint 全枚举）。 */
export const SHARED_COURSE_CONSTRAINTS: readonly string[] = [
  "grade",
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
  "ln",
  "cn",
  "hcn",
];

/** 标准奖牌名（编辑器建议清单；名称本身是显示文本，校验不做枚举约束）。 */
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

/**
 * data 条目中要求“存在即须为字符串”的已知字段（level 单独校验非空）。
 * 真实难度表存在数字与显式 null（如 LN 表把 lr2_bmsid 发成整数），字符串
 * 之外接受数字与 null（null 视同缺失）；其余类型仍是硬错误。例外是哈希
 * 身份字段（md5/sha256）：数字会被段位解析原样送进视图的字符串消费链，
 * 只接受字符串与 null。
 */
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
  | { kind: "unknown_constraint"; values: string[] }
  | { kind: "level_not_listed"; levels: string[]; count: number }
  | { kind: "course_hash_unmatched"; hashes: string[] }
  | { kind: "level_order_duplicate"; levels: string[] }
  | { kind: "short_hash"; count: number }
  | { kind: "nonstandard_hash"; count: number }
  | { kind: "empty_constraint"; count: number };

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
  warnUnknownConstraint: "editor.strict_warn_unknown_constraint",
  warnLevelOrderDuplicate: "editor.strict_warn_level_order_duplicate",
  warnShortHash: "editor.strict_warn_short_hash",
  warnNonstandardHash: "editor.strict_warn_nonstandard_hash",
  warnEmptyConstraint: "editor.strict_warn_empty_constraint",
  compatUnlistedChip: "editor.compat_unlisted_chip",
  compatUnlistedTitle: "editor.compat_unlisted_title",
  compatLevelConfirm: "editor.compat_level_confirm",
  compatLevelCancel: "editor.compat_level_cancel",
} as const;

/** 单次校验的错误收集上限（10000 条全坏时不至于产出上万条错误对象）。 */
const MAX_STRICT_ERRORS = 100;

/** 单条警告里等级或哈希样例的展示上限（完整清单以编辑器条目为准）。 */
const MAX_WARNING_SAMPLES = 20;

/** beatoraja 的条目收录取门槛：md5 与 sha256 都不超过该长度时条目被静默跳过（内置 2018 版 jar 的 decodeJSONTableData，仅 INFO 日志）。 */
export const BEATORAJA_HASH_MIN_LENGTH = 24;

/** 标准 MD5 十六进制长度；非此长度 beatoraja 会收下条目，但永远匹配不到本地谱面。 */
export const MD5_HEX_LENGTH = 32;

/** 标准 SHA-256 十六进制长度；语义同 MD5_HEX_LENGTH。 */
export const SHA256_HEX_LENGTH = 64;

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
  const unknownConstraints = new Set<string>();
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
  checkLevelOrder(header, errors, warnings);
  const emptyConstraints = checkCourseField(
    header,
    errors,
    warnings,
    seenUnknown,
    unknownConstraints
  );
  if (unknownConstraints.size > 0) {
    warnings.push({
      kind: "unknown_constraint",
      values: [...unknownConstraints].slice(0, MAX_WARNING_SAMPLES),
    });
  }
  if (emptyConstraints > 0) {
    warnings.push({ kind: "empty_constraint", count: emptyConstraints });
  }
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
  const hashTally = { short: 0, nonstandard: 0 };
  data.forEach((entry, index) => {
    if (isRecord(entry)) records.push(entry);
    checkDataEntry(entry, index, errors, warnings, seenUnknown, hashTally);
  });
  if (hashTally.short > 0) {
    warnings.push({ kind: "short_hash", count: hashTally.short });
  }
  if (hashTally.nonstandard > 0) {
    warnings.push({ kind: "nonstandard_hash", count: hashTally.nonstandard });
  }
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

function checkLevelOrder(
  header: Record<string, unknown>,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[]
): void {
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
  // 重复项：beatoraja 按 level_order 生成等级组，重复值产生同名双组
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of levelOrder) {
    if (typeof item !== "string" && typeof item !== "number") continue;
    const key = String(item);
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  if (duplicates.size > 0) {
    warnings.push({
      kind: "level_order_duplicate",
      levels: [...duplicates].slice(0, MAX_WARNING_SAMPLES),
    });
  }
}

function checkCourseField(
  header: Record<string, unknown>,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  seenUnknown: Set<string>,
  unknownConstraints: Set<string>
): number {
  if (!("course" in header)) return 0;
  const course = header.course;
  if (!Array.isArray(course)) {
    errors.add({ code: "course_not_array", path: "header.course", params: {} });
    return 0;
  }
  let emptyCount = 0;
  course.forEach((entry, i) => {
    if (Array.isArray(entry)) {
      entry.forEach((item, j) => {
        const path = "header.course[" + i + "][" + j + "]";
        const index = i + "." + j;
        if (isRecord(item)) {
          emptyCount += checkCourseObject(
            item,
            path,
            index,
            errors,
            warnings,
            seenUnknown,
            unknownConstraints
          );
        } else {
          errors.add({ code: "course_element", path, params: { index } });
        }
      });
    } else if (isRecord(entry)) {
      emptyCount += checkCourseObject(
        entry,
        "header.course[" + i + "]",
        String(i),
        errors,
        warnings,
        seenUnknown,
        unknownConstraints
      );
    } else {
      errors.add({
        code: "course_element",
        path: "header.course[" + i + "]",
        params: { index: String(i) },
      });
    }
  });
  return emptyCount;
}

/** 校验单个段位对象（path 已带位置，index 是用于消息插值的段位序号）。 */
function checkCourseObject(
  course: Record<string, unknown>,
  path: string,
  index: string,
  errors: ErrorCollector,
  warnings: SharedStrictWarning[],
  seenUnknown: Set<string>,
  unknownConstraints: Set<string>
): number {
  let emptyCount = 0;
  collectUnknownFields(course, STRICT_COURSE_FIELDS, "course", warnings, seenUnknown);
  if (typeof course.name !== "string" || course.name.trim() === "") {
    errors.add({ code: "course_name", path: path + ".name", params: { index } });
  }
  if ("constraint" in course) {
    emptyCount += checkCourseConstraint(course.constraint, path, index, errors, unknownConstraints);
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
  return emptyCount;
}

function checkCourseConstraint(
  constraint: unknown,
  path: string,
  index: string,
  errors: ErrorCollector,
  unknownConstraints: Set<string>
): number {
  if (!Array.isArray(constraint)) {
    errors.add({ code: "course_constraint_type", path: path + ".constraint", params: { index } });
    return 0;
  }
  let emptyCount = 0;
  constraint.forEach((value, i) => {
    if (typeof value !== "string") {
      errors.add({
        code: "course_constraint_value",
        path: path + ".constraint[" + i + "]",
        params: { index },
      });
    } else if (value === "") {
      // 空串使 beatoraja 丢弃整份段位文件（CourseDataConstraint.getValue 返回 null 的连锁），专项警告
      emptyCount += 1;
    } else if (!SHARED_COURSE_CONSTRAINTS.includes(value)) {
      unknownConstraints.add(value);
    }
  });
  return emptyCount;
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
    if (typeof item.name !== "string" || item.name.trim() === "") {
      errors.add({
        code: "course_trophy_name",
        path: trophyPath + ".name",
        params: { index },
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
  seenUnknown: Set<string>,
  hashTally: { short: number; nonstandard: number }
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
  // level 接受非空字符串与数字（Overjoy 等真实表发数字等级，与 level_order
  // 的数字口径一致）；缺失、null、空串与其他类型报错（前两类由编辑器
  // 保存闸门重分类为未指派工作流）。
  const levelOk =
    (typeof entry.level === "string" && entry.level !== "") || typeof entry.level === "number";
  if (!levelOk) {
    errors.add({ code: "entry_level", path: "data[" + index + "].level", params: { index } });
  }
  for (const field of STRICT_DATA_STRING_FIELDS) {
    const value = entry[field];
    // 哈希身份字段是字符串消费者硬依赖（判重与段位解析把哈希原样送进
    // slice 类调用，数字会崩），数字不放行；其余字段按真实表形态接受数字。
    const numberOk = !(field === "md5" || field === "sha256") && typeof value === "number";
    if (field in entry && value !== null && typeof value !== "string" && !numberOk) {
      errors.add({
        code: "entry_field_type",
        path: "data[" + index + "]." + field,
        params: { index, field },
      });
    }
  }
  collectUnknownFields(entry, STRICT_DATA_FIELDS, "entry", warnings, seenUnknown);
  const hashClass = classifyEntryHashes(entry);
  if (hashClass === "short") hashTally.short += 1;
  else if (hashClass === "nonstandard") hashTally.nonstandard += 1;
}

/**
 * 条目哈希的 beatoraja 兼容分级：所有非空哈希都不超过门槛长度时 beatoraja
 * 静默跳过该条目（short）；有哈希超过门槛但没有标准长度哈希时 beatoraja
 * 会收下条目，但它永远匹配不到本地谱面（nonstandard）；存在标准长度哈希
 * 则无兼容问题（null）。
 */
function classifyEntryHashes(entry: Record<string, unknown>): "short" | "nonstandard" | null {
  let longest = 0;
  let hasStandard = false;
  for (const [field, standard] of [
    ["md5", MD5_HEX_LENGTH],
    ["sha256", SHA256_HEX_LENGTH],
  ] as const) {
    const value = entry[field];
    if (typeof value !== "string" || value === "") continue;
    longest = Math.max(longest, value.length);
    if (value.length === standard) hasStandard = true;
  }
  if (longest === 0) return null;
  if (longest <= BEATORAJA_HASH_MIN_LENGTH) return "short";
  return hasStandard ? null : "nonstandard";
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
    let unlistedCount = 0;
    for (const entry of data) {
      if (!isRecord(entry)) continue;
      const level = entry.level;
      const levelText = typeof level === "number" ? String(level) : level;
      if (typeof levelText === "string" && levelText !== "" && !listed.has(levelText)) {
        unlisted.add(levelText);
        unlistedCount += 1;
      }
    }
    if (unlisted.size > 0) {
      warnings.push({
        kind: "level_not_listed",
        levels: [...unlisted].slice(0, MAX_WARNING_SAMPLES),
        count: unlistedCount,
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
