import { describe, expect, it } from "vitest";

import {
  buildRedirectRule,
  buildRuleExpression,
  checkZoneRules,
  normalizeLiveRules,
  parseRedirectConfig,
  readRedirectConfig,
  type LiveRule,
  type RedirectRule,
  type RedirectZone,
} from "./redirect-rules.ts";
import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

const COM_ZONE: RedirectZone = {
  name: "brightmeows.com",
  ruleRef: "legacy-redirect-brightmeows-com",
  matchApex: false,
  excludeHosts: ["bms-table-mirror-r2.brightmeows.com"],
};

const CN_ZONE: RedirectZone = {
  name: "brightmeows.cn",
  ruleRef: "legacy-redirect-brightmeows-cn",
  matchApex: true,
  excludeHosts: [],
};

const MIYAKO_ZONE: RedirectZone = {
  name: "miyakomeow.site",
  ruleRef: "legacy-redirect-miyakomeow-site",
  matchApex: true,
  excludeHosts: ["bms-table-mirror-r2.miyakomeow.site"],
};

function liveRule(rule: RedirectRule, overrides: Partial<LiveRule> = {}): LiveRule {
  return {
    ref: rule.ref,
    description: rule.description,
    expression: rule.expression,
    action: rule.action,
    enabled: true,
    statusCode: rule.action_parameters.from_value.status_code,
    preserveQueryString: rule.action_parameters.from_value.preserve_query_string,
    targetExpression: rule.action_parameters.from_value.target_url.expression,
    targetValue: undefined,
    ...overrides,
  };
}

describe("parseRedirectConfig", () => {
  it("接受仓库里的 config/redirects.json", () => {
    const config = readRedirectConfig();
    expect(config.zones.map((zone) => zone.name)).toEqual([
      "brightmeows.com",
      "brightmeows.cn",
      "miyakomeow.site",
    ]);
  });

  it("目标主机在 zone 列表里", () => {
    const site = readSiteConfig(CONFIG_PATH);
    const config = readRedirectConfig();
    expect(config.zones.map((zone) => zone.name)).toContain(new URL(site.origin).host);
  });

  it("两个 R2 自定义域都被排除", () => {
    const config = readRedirectConfig();
    const excluded = new Set(config.zones.flatMap((zone) => zone.excludeHosts));
    expect(excluded).toEqual(
      new Set([
        "bms-table-mirror-r2.brightmeows.com",
        "bms-table-mirror-r2.miyakomeow.site",
        "private-dsh.brightmeows.com",
      ])
    );
  });

  it("拒绝空 zones", () => {
    expect(() => parseRedirectConfig({ zones: [] })).toThrow(/zones/);
  });

  it("拒绝重复的 zone", () => {
    expect(() =>
      parseRedirectConfig({
        zones: [
          { name: "example.com", ruleRef: "legacy-redirect-a", matchApex: false, excludeHosts: [] },
          { name: "example.com", ruleRef: "legacy-redirect-b", matchApex: false, excludeHosts: [] },
        ],
      })
    ).toThrow(/唯一/);
  });

  it("拒绝不在 zone 下的排除主机", () => {
    expect(() =>
      parseRedirectConfig({
        zones: [
          {
            name: "example.com",
            ruleRef: "legacy-redirect-a",
            matchApex: false,
            excludeHosts: ["r2.example.net"],
          },
        ],
      })
    ).toThrow(/不在/);
  });

  it("拒绝没有托管前缀的 ref", () => {
    expect(() =>
      parseRedirectConfig({
        zones: [{ name: "example.com", ruleRef: "other", matchApex: false, excludeHosts: [] }],
      })
    ).toThrow(/legacy-redirect-/);
  });
});

describe("buildRuleExpression", () => {
  it("构造 .com 的 wildcard 与 R2 排除", () => {
    expect(buildRuleExpression(COM_ZONE)).toBe(
      'http.host wildcard "*.brightmeows.com" and not http.host eq "bms-table-mirror-r2.brightmeows.com"'
    );
  });

  it("构造 apex 加 wildcard", () => {
    expect(buildRuleExpression(CN_ZONE)).toBe(
      '(http.host eq "brightmeows.cn" or http.host wildcard "*.brightmeows.cn")'
    );
  });

  it("构造 apex 加 wildcard 与旧 R2 排除", () => {
    expect(buildRuleExpression(MIYAKO_ZONE)).toBe(
      '(http.host eq "miyakomeow.site" or http.host wildcard "*.miyakomeow.site") and not http.host eq "bms-table-mirror-r2.miyakomeow.site"'
    );
  });
});

describe("buildRedirectRule", () => {
  it("目标固定为主站 origin 加原路径，301 并保留 query", () => {
    const rule = buildRedirectRule(COM_ZONE, "https://brightmeows.com/");
    expect(rule.ref).toBe(COM_ZONE.ruleRef);
    expect(rule.description).toBe(COM_ZONE.ruleRef);
    expect(rule.action_parameters.from_value.target_url.expression).toBe(
      'concat("https://brightmeows.com", http.request.uri.path)'
    );
    expect(rule.action_parameters.from_value.status_code).toBe(301);
    expect(rule.action_parameters.from_value.preserve_query_string).toBe(true);
  });
});

describe("normalizeLiveRules", () => {
  it("取出 entrypoint 的 rules", () => {
    const rule = buildRedirectRule(COM_ZONE, "https://brightmeows.com");
    const payload = {
      rules: [
        {
          ref: rule.ref,
          description: rule.description,
          expression: rule.expression,
          action: rule.action,
          enabled: true,
          action_parameters: rule.action_parameters,
        },
      ],
    };
    const [live] = normalizeLiveRules(payload);
    expect(live?.ref).toBe(rule.ref);
    expect(live?.description).toBe(rule.description);
    expect(live?.statusCode).toBe(301);
    expect(live?.preserveQueryString).toBe(true);
  });

  it("没有 rules 时返回空数组", () => {
    expect(normalizeLiveRules(null)).toEqual([]);
    expect(normalizeLiveRules({})).toEqual([]);
  });
});

describe("checkZoneRules", () => {
  const origin = "https://brightmeows.com";
  const expected = buildRedirectRule(COM_ZONE, origin);

  it("完全一致时没有 issue", () => {
    expect(checkZoneRules(COM_ZONE, origin, [liveRule(expected)])).toEqual([]);
  });

  it("缺少托管规则", () => {
    expect(checkZoneRules(COM_ZONE, origin, [])).toEqual([
      "缺少托管规则 legacy-redirect-brightmeows-com",
    ]);
  });

  it("托管规则不在第一位", () => {
    const issues = checkZoneRules(COM_ZONE, origin, [
      liveRule(expected, { ref: "other-rule", description: "other-rule" }),
      liveRule(expected),
    ]);
    expect(issues).toContain(
      "托管规则 legacy-redirect-brightmeows-com 不在第一位（前面有 1 条规则）"
    );
  });

  it("表达式、状态码、query 与 target 都要一致", () => {
    const issues = checkZoneRules(COM_ZONE, origin, [
      liveRule(expected, {
        expression: 'http.host wildcard "*.example.com"',
        statusCode: 302,
        preserveQueryString: false,
        targetExpression: 'concat("https://example.com", http.request.uri.path)',
      }),
    ]);
    expect(issues.some((issue) => issue.startsWith("表达式不一致"))).toBe(true);
    expect(issues.some((issue) => issue.startsWith("状态码不是 301"))).toBe(true);
    expect(issues).toContain("preserve_query_string 不是 true");
    expect(issues.some((issue) => issue.startsWith("target expression 不一致"))).toBe(true);
  });

  it("静态 target value 会被拒绝", () => {
    const issues = checkZoneRules(COM_ZONE, origin, [
      liveRule(expected, { targetValue: "https://brightmeows.com/" }),
    ]);
    expect(issues.some((issue) => issue.startsWith("使用了静态 target value"))).toBe(true);
  });

  it("多余托管规则与禁用规则都会被报出", () => {
    const issues = checkZoneRules(COM_ZONE, origin, [
      liveRule(expected, { enabled: false }),
      liveRule(expected, { ref: "legacy-redirect-old", description: "legacy-redirect-old" }),
    ]);
    expect(issues).toContain("托管规则未启用（enabled 不为 true）");
    expect(issues.some((issue) => issue.startsWith("存在多余的托管规则"))).toBe(true);
  });

  it("控制台创建的规则用 description 识别", () => {
    const issues = checkZoneRules(COM_ZONE, origin, [
      liveRule(expected, { ref: "dashboard-generated-ref" }),
    ]);
    expect(issues).toEqual([]);
  });
});
