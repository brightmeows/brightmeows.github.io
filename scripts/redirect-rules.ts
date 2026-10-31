/**
 * 旧主机 301 的期望规则与只读比对逻辑。
 *
 * 期望的 zone 列表在 `config/redirects.json`，目标来源取 `config/site.json`
 * 的 `origin`。这里只构造 Cloudflare Single Redirects 的规则 JSON 并比较线上
 * 规则，不写 Cloudflare；规则的实际应用由人工完成。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 默认配置文件路径（仓库根下的 config/redirects.json）。 */
export const REDIRECT_CONFIG_PATH = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "config",
  "redirects.json"
);

/** 托管规则的 ref 前缀；只认这个前缀的规则，避免误伤其他规则。 */
export const MANAGED_REDIRECT_REF_PREFIX = "legacy-redirect-";

/** 旧主机 301 的状态码。 */
export const REDIRECT_STATUS_CODE = 301;

/** 旧主机 301 是否保留 query；旧表链接依赖它。 */
export const REDIRECT_PRESERVE_QUERY_STRING = true;

/** 一个 zone 的旧主机 301 期望。 */
export interface RedirectZone {
  /** zone 名，同时是 apex 主机名。 */
  name: string;
  /** 托管规则 ref，必须以 MANAGED_REDIRECT_REF_PREFIX 开头。 */
  ruleRef: string;
  /** 是否匹配 apex；主站 apex 不匹配时为 false。 */
  matchApex: boolean;
  /** 必须排除的主机，通常是 R2 自定义域。 */
  excludeHosts: string[];
}

/** `config/redirects.json` 的形状。 */
export interface RedirectConfig {
  zones: RedirectZone[];
}

/** 构造出的 Single Redirects 规则。 */
export interface RedirectRule {
  ref: string;
  expression: string;
  description: string;
  action: "redirect";
  action_parameters: {
    from_value: {
      target_url: { expression: string };
      status_code: number;
      preserve_query_string: boolean;
    };
  };
}

/** 从 Cloudflare API 响应里归一化出来的规则字段。 */
export interface LiveRule {
  ref: string | undefined;
  expression: string | undefined;
  action: string | undefined;
  enabled: boolean | undefined;
  statusCode: number | undefined;
  preserveQueryString: boolean | undefined;
  targetExpression: string | undefined;
  targetValue: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function requireBoolean(value: unknown, where: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${where} 必须是布尔值`);
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

function parseZone(value: unknown, index: number): RedirectZone {
  const where = `zones[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${where} 必须是对象`);
  }
  const name = requireHost(value.name, `${where}.name`);
  const ruleRef = requireString(value.ruleRef, `${where}.ruleRef`);
  if (!ruleRef.startsWith(MANAGED_REDIRECT_REF_PREFIX)) {
    throw new Error(`${where}.ruleRef 必须以 ${MANAGED_REDIRECT_REF_PREFIX} 开头`);
  }
  const matchApex = requireBoolean(value.matchApex, `${where}.matchApex`);
  if (!Array.isArray(value.excludeHosts)) {
    throw new Error(`${where}.excludeHosts 必须是数组`);
  }
  const excludeHosts = value.excludeHosts.map((host, hostIndex) =>
    requireHost(host, `${where}.excludeHosts[${hostIndex}]`)
  );
  if (new Set(excludeHosts).size !== excludeHosts.length) {
    throw new Error(`${where}.excludeHosts 不能重复`);
  }
  for (const host of excludeHosts) {
    if (host !== name && !host.endsWith(`.${name}`)) {
      throw new Error(`${where}.excludeHosts 的 ${host} 不在 ${name} 下`);
    }
  }
  return { name, ruleRef, matchApex, excludeHosts };
}

/** 解析并校验 `config/redirects.json` 的对象；非法字段直接抛错。 */
export function parseRedirectConfig(value: unknown, source = REDIRECT_CONFIG_PATH): RedirectConfig {
  if (!isRecord(value)) {
    throw new Error(`配置不是对象：${source}`);
  }
  if (!Array.isArray(value.zones) || value.zones.length === 0) {
    throw new Error(`配置缺少非空 zones 数组：${source}`);
  }
  const zones = value.zones.map((zone, index) => parseZone(zone, index));
  const names = new Set(zones.map((zone) => zone.name));
  if (names.size !== zones.length) {
    throw new Error(`zones 的 name 必须唯一：${source}`);
  }
  const refs = new Set(zones.map((zone) => zone.ruleRef));
  if (refs.size !== zones.length) {
    throw new Error(`zones 的 ruleRef 必须唯一：${source}`);
  }
  return { zones };
}

/** 读取并校验 `config/redirects.json`。 */
export function readRedirectConfig(configPath: string = REDIRECT_CONFIG_PATH): RedirectConfig {
  return parseRedirectConfig(JSON.parse(readFileSync(configPath, "utf8")));
}

/**
 * 构造规则的主机匹配表达式。
 *
 * 子域永远匹配；指定 apex 时把 `http.host eq` 与 wildcard 括在一起，再接
 * R2 等排除项。
 */
export function buildRuleExpression(zone: RedirectZone): string {
  const hostParts = zone.matchApex
    ? [`http.host eq "${zone.name}"`, `http.host wildcard "*.${zone.name}"`]
    : [`http.host wildcard "*.${zone.name}"`];
  const joined = hostParts.join(" or ");
  const hostExpression = hostParts.length > 1 ? `(${joined})` : joined;
  const exclusions = zone.excludeHosts.map((host) => `not http.host eq "${host}"`);
  return [hostExpression, ...exclusions].join(" and ");
}

/** 构造一个 zone 的完整 Single Redirects 规则。 */
export function buildRedirectRule(zone: RedirectZone, targetOrigin: string): RedirectRule {
  const target = targetOrigin.replace(/\/+$/u, "");
  return {
    ref: zone.ruleRef,
    expression: buildRuleExpression(zone),
    description: `Legacy host 301 to ${target}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        target_url: {
          expression: `concat(${JSON.stringify(target)}, http.request.uri.path)`,
        },
        status_code: REDIRECT_STATUS_CODE,
        preserve_query_string: REDIRECT_PRESERVE_QUERY_STRING,
      },
    },
  };
}

/** 把一条 Cloudflare 规则归一化；不是对象的项返回 null。 */
export function normalizeLiveRule(value: unknown): LiveRule | null {
  if (!isRecord(value)) {
    return null;
  }
  const parameters = isRecord(value.action_parameters) ? value.action_parameters : {};
  const fromValue = isRecord(parameters.from_value) ? parameters.from_value : {};
  const targetUrl = isRecord(fromValue.target_url) ? fromValue.target_url : {};
  return {
    ref: readString(value, "ref"),
    expression: readString(value, "expression"),
    action: readString(value, "action"),
    enabled: readBoolean(value, "enabled"),
    statusCode: readNumber(fromValue, "status_code"),
    preserveQueryString: readBoolean(fromValue, "preserve_query_string"),
    targetExpression: readString(targetUrl, "expression"),
    targetValue: readString(targetUrl, "value"),
  };
}

/** 从 entrypoint 的 `result` 里取出规则列表；没有 rules 时返回空数组。 */
export function normalizeLiveRules(payload: unknown): LiveRule[] {
  if (!isRecord(payload) || !Array.isArray(payload.rules)) {
    return [];
  }
  return payload.rules
    .map((rule) => normalizeLiveRule(rule))
    .filter((rule): rule is LiveRule => rule !== null);
}

/**
 * 比对单个 zone 的线上规则与期望。
 *
 * 托管规则必须在第一位；表达式、301、query 保留、动态 target 与 enabled 都要
 * 一致；多余或缺失的托管规则也报出来。
 */
export function checkZoneRules(
  zone: RedirectZone,
  targetOrigin: string,
  liveRules: LiveRule[]
): string[] {
  const expected = buildRedirectRule(zone, targetOrigin);
  const issues: string[] = [];
  const managed = liveRules.filter((rule) => rule.ref?.startsWith(MANAGED_REDIRECT_REF_PREFIX));
  const matching = managed.filter((rule) => rule.ref === expected.ref);
  if (matching.length === 0) {
    issues.push(`缺少托管规则 ${expected.ref}`);
  }
  if (matching.length > 1) {
    issues.push(`托管规则 ${expected.ref} 出现 ${matching.length} 次`);
  }
  const index = liveRules.findIndex((rule) => rule.ref === expected.ref);
  if (index > 0) {
    issues.push(`托管规则 ${expected.ref} 不在第一位（前面有 ${index} 条规则）`);
  }
  const extra = managed.filter((rule) => rule.ref !== expected.ref);
  if (extra.length > 0) {
    issues.push(`存在多余的托管规则：${extra.map((rule) => rule.ref ?? "(无 ref)").join("、")}`);
  }

  const rule = matching[0];
  if (rule === undefined) {
    return issues;
  }
  if (rule.expression !== expected.expression) {
    issues.push(`表达式不一致：期望 ${expected.expression}，线上 ${rule.expression ?? "(缺失)"}`);
  }
  if (rule.action !== expected.action) {
    issues.push(`action 不一致：期望 redirect，线上 ${rule.action ?? "(缺失)"}`);
  }
  if (rule.statusCode !== REDIRECT_STATUS_CODE) {
    issues.push(`状态码不是 ${REDIRECT_STATUS_CODE}：线上 ${rule.statusCode ?? "(缺失)"}`);
  }
  if (rule.preserveQueryString !== REDIRECT_PRESERVE_QUERY_STRING) {
    issues.push("preserve_query_string 不是 true");
  }
  const expectedTarget = expected.action_parameters.from_value.target_url.expression;
  if (rule.targetValue !== undefined) {
    issues.push(`使用了静态 target value：${rule.targetValue}`);
  } else if (rule.targetExpression !== expectedTarget) {
    issues.push(
      `target expression 不一致：期望 ${expectedTarget}，线上 ${rule.targetExpression ?? "(缺失)"}`
    );
  }
  if (rule.enabled !== true) {
    issues.push("托管规则未启用（enabled 不为 true）");
  }
  return issues;
}
