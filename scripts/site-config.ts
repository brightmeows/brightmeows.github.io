/**
 * 读取并校验 `config/site.json`（仓库内站点与部署配置的单一来源）。
 *
 * 供 `scripts/` 下的工具与校验脚本共用。这里用 `readFileSync` 而不是 JSON import，
 * 因为脚本会被 Node 直接执行（Node 的 JSON 模块需要 import 属性，且类型剥离下
 * 行为不一致）。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 静态宿主目标：构建期用 `--target=<name>` 生成镜像页与该目标的 tables.json。 */
export interface StaticTarget {
  name: string;
  kind: "static";
  /** 自定义子域（`<name>.<主站 host>`），API 会话与 CORS 白名单都以此为准。 */
  siteBase: string;
  /** 平台默认域（如 *.github.io）；浏览器访问会被前端兜底跳转到 siteBase。 */
  legacyHosts: string[];
  /** git-pages 服务的 TLS 主机名（Codeberg）：自定义域证书就绪前上传时的连接用。 */
  pagesServer?: string;
}

/** Worker 目标：hosts 必须与 wrangler.jsonc 的 routes 一致。 */
export interface WorkerTarget {
  name: string;
  kind: "worker";
  hosts: string[];
}

export type SiteTarget = StaticTarget | WorkerTarget;

export interface SiteConfig {
  origin: string;
  targets: SiteTarget[];
  r2: {
    base: string;
    manifestObject: string;
    /** 上次通知下游重建时的清单对象键（列表变动的判定基线）。 */
    baselineObject: string;
    corsOrigins: string[];
  };
}

/** 默认配置文件路径（仓库根下的 config/site.json）。 */
export const CONFIG_PATH = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "config",
  "site.json"
);

function requireHttpUrl(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^https?:\/\/[^/]+/.test(value)) {
    throw new Error(`${where} 必须是 http(s) URL`);
  }
  return value;
}

function requireOrigin(value: unknown, where: string): string {
  const url = requireHttpUrl(value, where);
  if (url.replace(/^https?:\/\/[^/]+/, "") !== "") {
    throw new Error(`${where} 必须是纯来源（不含路径）：${url}`);
  }
  return url;
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

function parseTarget(value: unknown, index: number): SiteTarget {
  const where = `targets[${index}]`;
  if (typeof value !== "object" || value === null) {
    throw new Error(`${where} 必须是对象`);
  }
  const record = value as Record<string, unknown>;
  const name = requireString(record.name, `${where}.name`);
  if (record.kind === "static") {
    if (!Array.isArray(record.legacyHosts) || record.legacyHosts.length === 0) {
      throw new Error(`${where}.legacyHosts 必须是非空数组`);
    }
    return {
      name,
      kind: "static",
      siteBase: requireOrigin(record.siteBase, `${where}.siteBase`),
      legacyHosts: record.legacyHosts.map((host, i) =>
        requireHost(host, `${where}.legacyHosts[${i}]`)
      ),
      ...(record.pagesServer === undefined
        ? {}
        : { pagesServer: requireHost(record.pagesServer, `${where}.pagesServer`) }),
    };
  }
  if (record.kind === "worker") {
    if (!Array.isArray(record.hosts) || record.hosts.length === 0) {
      throw new Error(`${where}.hosts 必须是非空数组`);
    }
    return {
      name,
      kind: "worker",
      hosts: record.hosts.map((host, i) => requireString(host, `${where}.hosts[${i}]`)),
    };
  }
  throw new Error(`${where}.kind 只能是 "static" 或 "worker"`);
}

/** 解析并校验配置对象；任何缺失或非法字段都会抛出，不做静默兜底。 */
export function parseSiteConfig(value: unknown, source = CONFIG_PATH): SiteConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error(`配置不是对象：${source}`);
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.targets) || record.targets.length === 0) {
    throw new Error(`配置缺少 targets 数组：${source}`);
  }
  const targets = record.targets.map((target, index) => parseTarget(target, index));
  const names = new Set(targets.map((target) => target.name));
  if (names.size !== targets.length) {
    throw new Error(`targets 的 name 必须唯一：${source}`);
  }
  const r2 = record.r2;
  if (typeof r2 !== "object" || r2 === null) {
    throw new Error(`配置缺少 r2 段：${source}`);
  }
  const r2Record = r2 as Record<string, unknown>;
  const manifestObject = requireString(r2Record.manifestObject, "r2.manifestObject");
  if (manifestObject.startsWith("/")) {
    throw new Error(`r2.manifestObject 不应以斜杠开头：${manifestObject}`);
  }
  const baselineObject = requireString(r2Record.baselineObject, "r2.baselineObject");
  if (baselineObject.startsWith("/")) {
    throw new Error(`r2.baselineObject 不应以斜杠开头：${baselineObject}`);
  }
  if (!Array.isArray(r2Record.corsOrigins) || r2Record.corsOrigins.length === 0) {
    throw new Error(`r2.corsOrigins 必须是非空数组：${source}`);
  }
  return {
    origin: requireOrigin(record.origin, "origin"),
    targets,
    r2: {
      base: requireHttpUrl(r2Record.base, "r2.base").replace(/\/+$/, ""),
      manifestObject,
      baselineObject,
      corsOrigins: r2Record.corsOrigins.map((origin, i) =>
        requireOrigin(origin, `r2.corsOrigins[${i}]`)
      ),
    },
  };
}

/** 读取配置文件。 */
export function readSiteConfig(configPath: string = CONFIG_PATH): SiteConfig {
  return parseSiteConfig(JSON.parse(readFileSync(configPath, "utf8")));
}

/** 按名称取静态目标；不存在时报错（生成脚本的 --target 用）。 */
export function findStaticTarget(config: SiteConfig, name: string): StaticTarget {
  const target = config.targets.find((item) => item.name === name);
  if (!target) {
    const names = config.targets.map((item) => item.name).join("、");
    throw new Error(`配置里没有目标 ${name}（可选：${names}）`);
  }
  if (target.kind !== "static") {
    throw new Error(`目标 ${name} 不是静态宿主（kind=${target.kind}）`);
  }
  return target;
}
