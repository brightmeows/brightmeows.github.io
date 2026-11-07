/**
 * 外部只读比对：把 `config/redirects.json` 的旧主机 301 期望与 Cloudflare
 * 三个 zone 的 `http_request_dynamic_redirect` entrypoint 对比。**只读**，不做
 * 任何写入。
 *
 * 为什么需要它：规则在 Cloudflare 控制台，改了仓库但线上没跟上时，旧表导入
 * 链接会静默退化；beatoraja 等原生客户端不会给出可定位的错误。
 *
 * 需要环境变量：`CLOUDFLARE_RULES_TOKEN`，权限为
 * `Zone > Dynamic URL Redirects > Read` 与 `Zone > Zone > Read`，scoped 到三个 zone。
 *
 * 用法：`node scripts/check-redirect-rules.ts`
 * 退出码：0 一致；1 不一致或读取失败。凭据缺失按失败处理，不静默跳过。
 */

import * as v from "valibot";

import {
  checkZoneRules,
  normalizeLiveRules,
  readRedirectConfig,
  type LiveRule,
} from "./redirect-rules.ts";
import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

const API_BASE = "https://api.cloudflare.com/client/v4";

/** Cloudflare API 响应封套的形状（只取比对用到的字段）。 */
const CloudflareResponseSchema = v.object({
  result: v.optional(v.unknown()),
  success: v.optional(v.boolean()),
  errors: v.optional(v.unknown()),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`缺少环境变量 ${name}（比对旧主机 301 规则需要它，刻意不静默跳过）`);
  }
  return value;
}

async function cfGet(token: string, apiPath: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${apiPath}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Cloudflare API ${apiPath} 失败：${res.status}`);
  }
  const body = v.parse(CloudflareResponseSchema, await res.json());
  if (body.success === false) {
    throw new Error(`Cloudflare API ${apiPath} 返回失败：${JSON.stringify(body.errors ?? [])}`);
  }
  return body.result;
}

async function resolveZoneId(token: string, zoneName: string): Promise<string> {
  const result = await cfGet(token, `/zones?name=${encodeURIComponent(zoneName)}&per_page=50`);
  if (!Array.isArray(result)) {
    throw new Error(`读取 zone ${zoneName} 失败：结果不是数组`);
  }
  const zones: unknown[] = result;
  const zone = zones.find((item) => isRecord(item) && item.name === zoneName);
  if (!isRecord(zone) || typeof zone.id !== "string") {
    throw new Error(`找不到 zone ${zoneName}，或令牌没有 Zone Read 权限`);
  }
  return zone.id;
}

async function readLiveRules(token: string, zoneId: string): Promise<LiveRule[]> {
  const result = await cfGet(
    token,
    `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`
  );
  return normalizeLiveRules(result);
}

async function main(): Promise<void> {
  const site = readSiteConfig(CONFIG_PATH);
  const redirects = readRedirectConfig();
  const token = requireEnv("CLOUDFLARE_RULES_TOKEN");
  const targetHost = new URL(site.origin).host;
  if (!redirects.zones.some((zone) => zone.name === targetHost)) {
    throw new Error(`config/redirects.json 缺少目标主机 ${targetHost} 所在 zone`);
  }

  let failed = false;
  for (const zone of redirects.zones) {
    const zoneId = await resolveZoneId(token, zone.name);
    const liveRules = await readLiveRules(token, zoneId);
    const issues = checkZoneRules(zone, site.origin, liveRules);
    if (issues.length === 0) {
      console.log(`${zone.name}: ${zone.ruleRef} 一致`);
      continue;
    }
    failed = true;
    console.error(`${zone.name}: ${issues.length} 个问题`);
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
  }
  if (failed) {
    console.error(
      "旧主机 301 规则与 config/redirects.json 不一致；按上面的问题修 Cloudflare zone 规则。"
    );
    process.exitCode = 1;
  }
}

const isMain = process.argv[1]?.endsWith("check-redirect-rules.ts") ?? false;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
