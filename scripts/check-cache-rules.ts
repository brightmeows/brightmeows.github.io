/**
 * 外部只读比对：把 `config/cache-rules.json` 的 R2 边缘缓存期望与 Cloudflare
 * `http_request_cache_settings` entrypoint 对比。**只读**，不做任何写入。
 *
 * 为什么需要它：规则在 Cloudflare 控制台，改了仓库但线上没跟上时，表数据与
 * 搜索索引会静默退回每次直连 R2；功能正常，只是慢，很难从现象定位。
 *
 * 需要环境变量：CLOUDFLARE_RULES_TOKEN，权限为
 * `Cache Settings Read`（或 `Cache Rules Read`）与 `Zone Read`，scoped 到目标 zone。
 *
 * 用法：`pnpm check:cache`
 * 退出码：0 一致；1 不一致或读取失败。凭据缺失按失败处理，不静默跳过。
 */

import * as v from "valibot";

import {
  buildCacheRule,
  checkCacheRule,
  normalizeLiveRules,
  readCacheRuleConfig,
} from "./cache-rules.ts";
import { isRecord } from "./guards.ts";
import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

const API_BASE = "https://api.cloudflare.com/client/v4";

/** Cloudflare API 响应封套的形状（只取比对用到的字段）。 */
const CloudflareResponseSchema = v.object({
  result: v.optional(v.unknown()),
  success: v.optional(v.boolean()),
  errors: v.optional(v.unknown()),
});

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

async function readLiveRules(token: string, zoneId: string) {
  const result = await cfGet(
    token,
    `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`
  );
  return normalizeLiveRules(result);
}

async function main(): Promise<void> {
  const site = readSiteConfig(CONFIG_PATH);
  const config = readCacheRuleConfig();
  const zoneHost = new URL(site.origin).hostname;
  if (config.zone !== zoneHost) {
    throw new Error(
      `config/cache-rules.json 的 zone 与 config/site.json 的 origin 不一致：${config.zone} != ${zoneHost}`
    );
  }
  const r2Host = new URL(site.r2.base).hostname;
  const expected = buildCacheRule(config, r2Host);
  const tokenEnvName = "CLOUDFLARE_RULES_TOKEN";
  const token = process.env[tokenEnvName];
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error(`缺少环境变量 ${tokenEnvName}（比对缓存规则需要它，刻意不静默跳过）`);
  }
  const zoneId = await resolveZoneId(token, config.zone);
  const liveRules = await readLiveRules(token, zoneId);
  const issues = checkCacheRule(expected, liveRules);
  if (issues.length === 0) {
    console.log(`${config.zone}: ${config.ruleRef} 一致`);
    return;
  }
  console.error(`${config.zone}: ${issues.length} 个问题`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  console.error("缓存规则与 config/cache-rules.json 不一致；按上面的问题修 Cloudflare zone 规则。");
  process.exitCode = 1;
}

const isMain = process.argv[1]?.endsWith("check-cache-rules.ts") ?? false;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
