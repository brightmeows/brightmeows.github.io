import { describe, expect, it } from "vitest";

import {
  buildCacheExpression,
  buildCacheRule,
  checkCacheRule,
  normalizeExpression,
  normalizeLiveRule,
  normalizeLiveRules,
  parseCacheRuleConfig,
  readCacheRuleConfig,
  type CacheRule,
  type CacheRuleConfig,
  type LiveCacheRule,
} from "./cache-rules.ts";
import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

const R2_HOST = "bms-table-mirror-r2.brightmeows.com";

function liveRule(rule: CacheRule, overrides: Partial<LiveCacheRule> = {}): LiveCacheRule {
  return {
    ref: rule.ref,
    description: rule.description,
    expression: rule.expression,
    action: rule.action,
    enabled: true,
    cache: true,
    edgeTtlMode: "override_origin",
    edgeTtlDefault: rule.action_parameters.edge_ttl.default,
    browserTtlMode: "override_origin",
    browserTtlDefault: rule.action_parameters.browser_ttl.default,
    hasCacheKey: false,
    unexpectedActionParameters: [],
    ...overrides,
  };
}

describe("parseCacheRuleConfig", () => {
  it("接受仓库里的 config/cache-rules.json", () => {
    const config = readCacheRuleConfig();
    expect(config.ruleRef).toBe("r2-json-cache");
    expect(config.tableFiles).toEqual(["header.json", "data.json"]);
    expect(config.indexFiles).toEqual([
      "manifest.json",
      "title.json",
      "artist.json",
      "md5.json",
      "sha256.json",
    ]);
  });

  it("zone 与 config/site.json 的 origin 一致", () => {
    const site = readSiteConfig(CONFIG_PATH);
    const config = readCacheRuleConfig();
    expect(config.zone).toBe(new URL(site.origin).hostname);
  });

  it("拒绝非对象", () => {
    expect(() => parseCacheRuleConfig(null)).toThrow(/配置不是对象/);
  });

  it("拒绝不是主机的 zone", () => {
    expect(() =>
      parseCacheRuleConfig({ ...readCacheRuleConfig(), zone: "https://example.com" })
    ).toThrow(/主机名/);
  });

  it("拒绝空 tableFiles", () => {
    expect(() => parseCacheRuleConfig({ ...readCacheRuleConfig(), tableFiles: [] })).toThrow(
      /tableFiles/
    );
  });

  it("拒绝重复的 tableFiles", () => {
    expect(() =>
      parseCacheRuleConfig({
        ...readCacheRuleConfig(),
        tableFiles: ["header.json", "header.json"],
      })
    ).toThrow(/不能重复/);
  });

  it("拒绝带路径的文件名", () => {
    expect(() =>
      parseCacheRuleConfig({
        ...readCacheRuleConfig(),
        indexFiles: ["../manifest.json"],
      })
    ).toThrow(/单层 JSON/);
  });

  it("拒绝非正整数 TTL", () => {
    expect(() => parseCacheRuleConfig({ ...readCacheRuleConfig(), edgeTtl: 0 })).toThrow(/edgeTtl/);
    expect(() => parseCacheRuleConfig({ ...readCacheRuleConfig(), browserTtl: 1.5 })).toThrow(
      /browserTtl/
    );
  });
});

describe("buildCacheExpression", () => {
  const config = readCacheRuleConfig();

  it("构造 Free 兼容的表数据与 v2 索引表达式", () => {
    expect(buildCacheExpression(config, R2_HOST)).toBe(
      '(http.host eq "bms-table-mirror-r2.brightmeows.com" and ((starts_with(http.request.uri.path, "/tables/") and (ends_with(http.request.uri.path, "/header.json") or ends_with(http.request.uri.path, "/data.json"))) or http.request.uri.path in {"/indexes/v2/manifest.json" "/indexes/v2/title.json" "/indexes/v2/artist.json" "/indexes/v2/md5.json" "/indexes/v2/sha256.json"}))'
    );
  });

  it("不使用 Free 不支持的 matches", () => {
    expect(buildCacheExpression(config, R2_HOST)).not.toMatch(/\bmatches\b/u);
  });
});

describe("buildCacheRule", () => {
  it("规则动作与 TTL 固定", () => {
    const config = readCacheRuleConfig();
    const rule = buildCacheRule(config, R2_HOST);
    expect(rule.ref).toBe("r2-json-cache");
    expect(rule.description).toBe("R2 JSON cache");
    expect(rule.action).toBe("set_cache_settings");
    expect(rule.action_parameters.cache).toBe(true);
    expect(rule.action_parameters.edge_ttl).toEqual({ mode: "override_origin", default: 600 });
    expect(rule.action_parameters.browser_ttl).toEqual({ mode: "override_origin", default: 600 });
    expect(rule.enabled).toBe(true);
  });
});

describe("normalizeExpression", () => {
  it("压缩字符串外的空白，保留字符串内空白", () => {
    expect(normalizeExpression('(http.host eq "a  b"  and\tfoo)')).toBe(
      '(http.host eq "a  b" and foo)'
    );
  });

  it("去掉首尾空白", () => {
    expect(normalizeExpression("  a  ")).toBe("a");
  });
});

describe("normalizeLiveRules", () => {
  it("取出 entrypoint 的 rules", () => {
    const expected = buildCacheRule(readCacheRuleConfig(), R2_HOST);
    const [live] = normalizeLiveRules({
      rules: [
        {
          ref: expected.ref,
          description: expected.description,
          expression: expected.expression,
          action: expected.action,
          enabled: true,
          action_parameters: expected.action_parameters,
        },
      ],
    });
    expect(live?.ref).toBe(expected.ref);
    expect(live?.edgeTtlDefault).toBe(600);
    expect(live?.browserTtlDefault).toBe(600);
    expect(live?.hasCacheKey).toBe(false);
  });

  it("没有 rules 时返回空数组", () => {
    expect(normalizeLiveRules(null)).toEqual([]);
    expect(normalizeLiveRules({})).toEqual([]);
  });

  it("识别 cache_key 与未预期动作字段", () => {
    const live = normalizeLiveRule({
      action_parameters: {
        cache: true,
        edge_ttl: { mode: "override_origin", default: 600 },
        browser_ttl: { mode: "override_origin", default: 600 },
        cache_key: { custom_key: {} },
        serve_stale: true,
      },
    });
    expect(live?.hasCacheKey).toBe(true);
    expect(live?.unexpectedActionParameters).toEqual(["serve_stale"]);
  });
});

describe("checkCacheRule", () => {
  const config: CacheRuleConfig = readCacheRuleConfig();
  const expected = buildCacheRule(config, R2_HOST);

  it("完全一致时没有 issue", () => {
    expect(checkCacheRule(expected, [liveRule(expected)])).toEqual([]);
  });

  it("缺少缓存规则", () => {
    expect(checkCacheRule(expected, [])).toEqual(["缺少缓存规则 r2-json-cache"]);
  });

  it("规则不在第一位", () => {
    const issues = checkCacheRule(expected, [
      liveRule(expected, { ref: "other-rule", description: "other-rule" }),
      liveRule(expected),
    ]);
    expect(issues).toContain("缓存规则 r2-json-cache 不在第一位（前面有 1 条规则）");
  });

  it("重复规则", () => {
    const issues = checkCacheRule(expected, [liveRule(expected), liveRule(expected)]);
    expect(issues).toContain("缓存规则 r2-json-cache 出现 2 次");
  });

  it("表达式漂移", () => {
    const issues = checkCacheRule(expected, [
      liveRule(expected, { expression: '(http.host eq "example.com")' }),
    ]);
    expect(issues.some((issue) => issue.startsWith("表达式不一致"))).toBe(true);
  });

  it("禁用与关闭缓存", () => {
    const issues = checkCacheRule(expected, [liveRule(expected, { enabled: false, cache: false })]);
    expect(issues).toContain("缓存规则未启用（enabled 不为 true）");
    expect(issues).toContain("action_parameters.cache 不是 true");
  });

  it("TTL 漂移", () => {
    const issues = checkCacheRule(expected, [
      liveRule(expected, {
        edgeTtlMode: "override_origin",
        edgeTtlDefault: 300,
        browserTtlMode: "override_origin",
        browserTtlDefault: 300,
      }),
    ]);
    expect(issues).toContain("edge_ttl.default 不是 600：线上 300");
    expect(issues).toContain("browser_ttl.default 不是 600：线上 300");
  });

  it("cache_key 与未预期动作字段都会被报出", () => {
    const issues = checkCacheRule(expected, [
      liveRule(expected, { hasCacheKey: true, unexpectedActionParameters: ["serve_stale"] }),
    ]);
    expect(issues).toContain("action_parameters.cache_key 不应存在（默认缓存键已包含 Origin）");
    expect(issues).toContain("action_parameters 出现未预期字段：serve_stale");
  });

  it("描述、action 与 TTL mode 都要一致", () => {
    const issues = checkCacheRule(expected, [
      liveRule(expected, {
        description: "old",
        action: "compress_response",
        edgeTtlMode: "respect_origin",
        browserTtlMode: "respect_origin",
      }),
    ]);
    expect(issues.some((issue) => issue.startsWith("规则描述不一致"))).toBe(true);
    expect(issues.some((issue) => issue.startsWith("action 不一致"))).toBe(true);
    expect(issues.some((issue) => issue.startsWith("edge_ttl.mode 不是 override_origin"))).toBe(
      true
    );
    expect(issues.some((issue) => issue.startsWith("browser_ttl.mode 不是 override_origin"))).toBe(
      true
    );
  });
});
