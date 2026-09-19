/**
 * 外部只读比对：把仓库内 `config/site.json` 的 `r2.corsOrigins` 与 Cloudflare 上
 * 桶的 CORS policy 对比。**只读**，不做任何写入。
 *
 * 为什么需要它：桶的 CORS 来源是「改了仓库但线上没跟上就会静默退化」的唯一一项——
 * 漏放一个来源时 beatoraja 等原生客户端照常工作，只有浏览器侧失败，很难从现象定位。
 *
 * 需要环境变量：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`R2_BUCKET`
 * （桶名刻意不入库，延续「选公开域而非 R2 绑定」的决定）。
 *
 * 用法：`node scripts/check-r2-cors.ts`
 * 退出码：0 一致；1 不一致或读取失败。凭据缺失按失败处理，不静默跳过。
 */

import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

interface CorsPolicy {
  rules?: { allowed?: { origins?: string[] } }[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`缺少环境变量 ${name}（比对桶 CORS 需要它，刻意不静默跳过）`);
  }
  return value;
}

/** 从 policy 里取出全部来源（多规则时取并集）。 */
export function collectLiveOrigins(policy: unknown): string[] {
  const rules = (policy as CorsPolicy).rules ?? [];
  return [...new Set(rules.flatMap((rule) => rule.allowed?.origins ?? []))].sort();
}

/** 比较期望与线上来源，返回面向人的差异描述。 */
export function diffOrigins(expected: string[], live: string[]): string[] {
  const expectedSet = new Set(expected);
  const liveSet = new Set(live);
  const missing = expected.filter((origin) => !liveSet.has(origin));
  const extra = live.filter((origin) => !expectedSet.has(origin));
  const issues: string[] = [];
  if (missing.length > 0) {
    issues.push(`线上缺少这些来源（配置里有、bucket 没有）：${missing.join("、")}`);
  }
  if (extra.length > 0) {
    issues.push(`线上多出这些来源（bucket 有、配置里没有）：${extra.join("、")}`);
  }
  return issues;
}

async function main(): Promise<void> {
  const config = readSiteConfig(CONFIG_PATH);
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const bucket = requireEnv("R2_BUCKET");

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`读取桶 CORS policy 失败：${res.status}（桶 ${bucket}）`);
  }
  const body = (await res.json()) as { result?: unknown };
  const live = collectLiveOrigins(body.result);

  const issues = diffOrigins([...config.r2.corsOrigins].sort(), live);
  console.log(`配置期望来源 ${config.r2.corsOrigins.length} 条，线上 ${live.length} 条`);
  if (issues.length === 0) {
    console.log("桶 CORS policy 与配置一致");
    return;
  }
  console.error("桶 CORS policy 与配置不一致：");
  for (const issue of issues) console.error(`  - ${issue}`);
  console.error("  修法：在 Cloudflare 控制台 R2 → 桶 → Settings → CORS Policy 按配置补齐，");
  console.error("        或直接用配置里的来源列表覆盖（保持与仓库一致）。");
  process.exitCode = 1;
}

const isMain = process.argv[1]?.endsWith("check-r2-cors.ts") ?? false;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
