/**
 * R2 边缘缓存规则的期望配置与只读比对逻辑。
 *
 * 期望规则在 `config/cache-rules.json`，R2 主机取 `config/site.json` 的
 * `r2.base`，zone 取 `origin`。这里只构造 Cloudflare Cache Rules 的规则 JSON
 * 并比较线上规则，不写 Cloudflare；规则的实际应用由人工或一次性写令牌完成。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isRecord } from "./guards.ts";

/** 默认配置文件路径（仓库根下的 config/cache-rules.json）。 */
export const CACHE_RULE_CONFIG_PATH = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "config",
  "cache-rules.json"
);

const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/u;
const KNOWN_ACTION_PARAMETERS = new Set(["cache", "edge_ttl", "browser_ttl"]);

/** 一个 zone 的 R2 缓存规则期望。 */
export interface CacheRuleConfig {
  /** zone 名，必须与 config/site.json 的 origin 主机一致。 */
  zone: string;
  /** Cloudflare 规则的稳定 ref。 */
  ruleRef: string;
  /** 面向控制台的规则描述。 */
  description: string;
  /** 表数据目录下需要缓存的 JSON 文件名。 */
  tableFiles: string[];
  /** indexes/v2 下需要缓存的 JSON 文件名。 */
  indexFiles: string[];
  /** 边缘缓存 TTL，秒。 */
  edgeTtl: number;
  /** 浏览器缓存 TTL，秒。 */
  browserTtl: number;
}

/** 构造出的 Cache Rules 规则。 */
export interface CacheRule {
  ref: string;
  description: string;
  expression: string;
  action: "set_cache_settings";
  action_parameters: {
    cache: true;
    edge_ttl: { mode: "override_origin"; default: number };
    browser_ttl: { mode: "override_origin"; default: number };
  };
  enabled: true;
}

/** 从 Cloudflare API 响应里归一化出来的缓存规则字段。 */
export interface LiveCacheRule {
  ref: string | undefined;
  description: string | undefined;
  expression: string | undefined;
  action: string | undefined;
  enabled: boolean | undefined;
  cache: boolean | undefined;
  edgeTtlMode: string | undefined;
  edgeTtlDefault: number | undefined;
  browserTtlMode: string | undefined;
  browserTtlDefault: number | undefined;
  hasCacheKey: boolean;
  unexpectedActionParameters: string[];
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${where} 必须是非空字符串`);
  }
  return value;
}

function requireHost(value: unknown, where: string): string {
  const raw = requireString(value, where);
  if (!/^[a-z0-9.-]+$/u.test(raw)) {
    throw new Error(`${where} 不是合法主机名：${raw}`);
  }
  return raw;
}

function requirePositiveInteger(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${where} 必须是正整数`);
  }
  return value;
}

function requireFileList(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${where} 必须是非空数组`);
  }
  const files = value.map((file, index) => {
    const name = requireString(file, `${where}[${index}]`);
    if (!FILE_NAME_PATTERN.test(name)) {
      throw new Error(`${where}[${index}] 必须是单层 JSON 文件名：${name}`);
    }
    return name;
  });
  if (new Set(files).size !== files.length) {
    throw new Error(`${where} 不能重复`);
  }
  return files;
}

/** 解析并校验 `config/cache-rules.json` 的对象；非法字段直接抛错。 */
export function parseCacheRuleConfig(
  value: unknown,
  source = CACHE_RULE_CONFIG_PATH
): CacheRuleConfig {
  if (!isRecord(value)) {
    throw new Error(`配置不是对象：${source}`);
  }
  return {
    zone: requireHost(value.zone, "zone"),
    ruleRef: requireString(value.ruleRef, "ruleRef"),
    description: requireString(value.description, "description"),
    tableFiles: requireFileList(value.tableFiles, "tableFiles"),
    indexFiles: requireFileList(value.indexFiles, "indexFiles"),
    edgeTtl: requirePositiveInteger(value.edgeTtl, "edgeTtl"),
    browserTtl: requirePositiveInteger(value.browserTtl, "browserTtl"),
  };
}

/** 读取并校验 `config/cache-rules.json`。 */
export function readCacheRuleConfig(configPath: string = CACHE_RULE_CONFIG_PATH): CacheRuleConfig {
  return parseCacheRuleConfig(JSON.parse(readFileSync(configPath, "utf8")), configPath);
}

/**
 * 构造 Cache Rules 的匹配表达式。
 *
 * `matches` 需要 Business 或 WAF Advanced，Free 上 dry-run 直接拒绝；这里用
 * `starts_with`、`ends_with` 与固定集合表达同一批路径。
 */
export function buildCacheExpression(config: CacheRuleConfig, r2Host: string): string {
  const tableConditions = config.tableFiles
    .map((file) => `ends_with(http.request.uri.path, "/${file}")`)
    .join(" or ");
  const tableExpression = `(starts_with(http.request.uri.path, "/tables/") and (${tableConditions}))`;
  const indexPaths = config.indexFiles.map((file) => `"/indexes/v2/${file}"`).join(" ");
  return `(http.host eq "${r2Host}" and (${tableExpression} or http.request.uri.path in {${indexPaths}}))`;
}

/** 构造一个 zone 的完整 Cache Rules 规则。 */
export function buildCacheRule(config: CacheRuleConfig, r2Host: string): CacheRule {
  return {
    ref: config.ruleRef,
    description: config.description,
    expression: buildCacheExpression(config, r2Host),
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      edge_ttl: { mode: "override_origin", default: config.edgeTtl },
      browser_ttl: { mode: "override_origin", default: config.browserTtl },
    },
    enabled: true,
  };
}

/**
 * 归一化表达式：把字符串外的连续空白压成一个空格并去掉首尾空白。
 *
 * 不删除空白本身，避免把 `and` 与相邻标识符粘成一个词。
 */
export function normalizeExpression(expression: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  let pendingSpace = false;
  for (const char of expression) {
    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      if (pendingSpace && result.length > 0) {
        result += " ";
      }
      pendingSpace = false;
      inString = true;
      result += char;
      continue;
    }
    if (/\s/u.test(char)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && result.length > 0) {
      result += " ";
    }
    pendingSpace = false;
    result += char;
  }
  return result;
}

/** 把一条 Cloudflare 缓存规则归一化；不是对象的项返回 null。 */
export function normalizeLiveRule(value: unknown): LiveCacheRule | null {
  if (!isRecord(value)) {
    return null;
  }
  const parameters = isRecord(value.action_parameters) ? value.action_parameters : {};
  const edgeTtl = isRecord(parameters.edge_ttl) ? parameters.edge_ttl : {};
  const browserTtl = isRecord(parameters.browser_ttl) ? parameters.browser_ttl : {};
  return {
    ref: readString(value, "ref"),
    description: readString(value, "description"),
    expression: readString(value, "expression"),
    action: readString(value, "action"),
    enabled: readBoolean(value, "enabled"),
    cache: readBoolean(parameters, "cache"),
    edgeTtlMode: readString(edgeTtl, "mode"),
    edgeTtlDefault: readNumber(edgeTtl, "default"),
    browserTtlMode: readString(browserTtl, "mode"),
    browserTtlDefault: readNumber(browserTtl, "default"),
    hasCacheKey: Object.hasOwn(parameters, "cache_key"),
    unexpectedActionParameters: Object.keys(parameters).filter(
      (key) => key !== "cache_key" && !KNOWN_ACTION_PARAMETERS.has(key)
    ),
  };
}

/** 从 entrypoint 的 `result` 里取出规则列表；没有 rules 时返回空数组。 */
export function normalizeLiveRules(payload: unknown): LiveCacheRule[] {
  if (!isRecord(payload) || !Array.isArray(payload.rules)) {
    return [];
  }
  return payload.rules
    .map((rule) => normalizeLiveRule(rule))
    .filter((rule): rule is LiveCacheRule => rule !== null);
}

/** 比对线上缓存规则与期望，返回面向人的差异描述。 */
export function checkCacheRule(expected: CacheRule, liveRules: LiveCacheRule[]): string[] {
  const issues: string[] = [];
  const matching = liveRules.filter((rule) => rule.ref === expected.ref);
  if (matching.length === 0) {
    issues.push(`缺少缓存规则 ${expected.ref}`);
    return issues;
  }
  if (matching.length > 1) {
    issues.push(`缓存规则 ${expected.ref} 出现 ${matching.length} 次`);
  }
  const index = liveRules.findIndex((rule) => rule.ref === expected.ref);
  if (index > 0) {
    issues.push(`缓存规则 ${expected.ref} 不在第一位（前面有 ${index} 条规则）`);
  }
  const rule = matching[0];
  if (rule === undefined) {
    return issues;
  }
  if (rule.description !== expected.description) {
    issues.push(
      `规则描述不一致：期望 ${expected.description}，线上 ${rule.description ?? "(缺失)"}`
    );
  }
  if (
    rule.expression === undefined ||
    normalizeExpression(rule.expression) !== normalizeExpression(expected.expression)
  ) {
    issues.push(`表达式不一致：期望 ${expected.expression}，线上 ${rule.expression ?? "(缺失)"}`);
  }
  if (rule.action !== expected.action) {
    issues.push(`action 不一致：期望 ${expected.action}，线上 ${rule.action ?? "(缺失)"}`);
  }
  if (rule.enabled !== true) {
    issues.push("缓存规则未启用（enabled 不为 true）");
  }
  if (rule.cache !== true) {
    issues.push("action_parameters.cache 不是 true");
  }
  if (rule.edgeTtlMode !== "override_origin") {
    issues.push(`edge_ttl.mode 不是 override_origin：线上 ${rule.edgeTtlMode ?? "(缺失)"}`);
  }
  if (rule.edgeTtlDefault !== expected.action_parameters.edge_ttl.default) {
    issues.push(
      `edge_ttl.default 不是 ${expected.action_parameters.edge_ttl.default}：线上 ${rule.edgeTtlDefault ?? "(缺失)"}`
    );
  }
  if (rule.browserTtlMode !== "override_origin") {
    issues.push(`browser_ttl.mode 不是 override_origin：线上 ${rule.browserTtlMode ?? "(缺失)"}`);
  }
  if (rule.browserTtlDefault !== expected.action_parameters.browser_ttl.default) {
    issues.push(
      `browser_ttl.default 不是 ${expected.action_parameters.browser_ttl.default}：线上 ${rule.browserTtlDefault ?? "(缺失)"}`
    );
  }
  if (rule.hasCacheKey) {
    issues.push("action_parameters.cache_key 不应存在（默认缓存键已包含 Origin）");
  }
  if (rule.unexpectedActionParameters.length > 0) {
    issues.push(`action_parameters 出现未预期字段：${rule.unexpectedActionParameters.join("、")}`);
  }
  return issues;
}
