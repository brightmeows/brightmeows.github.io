import { describe, expect, it } from "vitest";

import {
  collectDomains,
  corsCoverageIssues,
  findDomainsInText,
  hardcodedDomainIssues,
  routeHostIssues,
  versionSourceIssues,
  wranglerRouteHosts,
  wranglerVarsIssues,
} from "./check-site-config.ts";
import { parseSiteConfig } from "./site-config.ts";

const config = parseSiteConfig(
  {
    origin: "https://brightmeows.com",
    targets: [
      { name: "cloudflare", kind: "worker", hosts: ["brightmeows.com", "www.brightmeows.com"] },
    ],
    r2: {
      base: "https://r2.example",
      manifestObject: "tables/tables.json",
      corsOrigins: ["https://brightmeows.com", "http://localhost:5173"],
    },
  },
  "test"
);

describe("wranglerRouteHosts", () => {
  it("从带注释与尾逗号的 JSONC 里取出 route 主机", () => {
    const text = `{
      // 注释里有 "pattern" 字样也应被忽略吗？不，这里只取 pattern 键
      "routes": [
        { "pattern": "brightmeows.com", "custom_domain": true },
        { "pattern": "www.brightmeows.com", "custom_domain": true },
        { "pattern": "old.example/*" },
      ],
    }`;
    expect(wranglerRouteHosts(text)).toEqual([
      "brightmeows.com",
      "www.brightmeows.com",
      "old.example",
    ]);
  });
});

describe("routeHostIssues", () => {
  it("routes 主机与 worker.hosts 完全一致时通过", () => {
    expect(routeHostIssues(["brightmeows.com", "www.brightmeows.com"], config)).toEqual([]);
  });

  it("出现额外主机时报错", () => {
    expect(
      routeHostIssues(["brightmeows.com", "www.brightmeows.com", "evil.example"], config)
    ).toEqual([expect.stringContaining("evil.example")]);
  });

  it("缺少配置里的主机时报错", () => {
    expect(routeHostIssues(["brightmeows.com"], config)).toEqual([
      expect.stringContaining("www.brightmeows.com"),
    ]);
  });
});

describe("hardcodedDomainIssues / findDomainsInText", () => {
  it("配置域名全部被识别（含 R2 主机与 worker 的 www）", () => {
    expect(collectDomains(config).sort()).toEqual(
      ["brightmeows.com", "r2.example", "www.brightmeows.com"].sort()
    );
  });

  it("工作流里出现域名即报错，注释里的也不算白名单", () => {
    const files = [
      { path: "a.yml", text: "run: echo ok" },
      { path: "b.yml", text: "run: curl https://brightmeows.com/" },
    ];
    expect(hardcodedDomainIssues(files, config)).toEqual([expect.stringContaining("b.yml")]);
    expect(findDomainsInText("https://r2.example/x", collectDomains(config))).toEqual([
      "r2.example",
    ]);
  });
});

describe("corsCoverageIssues", () => {
  it("覆盖 origin 时通过", () => {
    expect(corsCoverageIssues(config)).toEqual([]);
  });

  it("缺 origin 时报错", () => {
    const partial = parseSiteConfig(
      { ...config, r2: { ...config.r2, corsOrigins: ["https://other.example"] } },
      "test"
    );
    expect(corsCoverageIssues(partial)).toHaveLength(1);
  });
});

describe("versionSourceIssues", () => {
  const pkg = { devEngines: { packageManager: { name: "pnpm", version: ">=11.25.0 <12.0.0" } } };

  it("文件齐全且工作流读文件时通过", () => {
    expect(
      versionSourceIssues({
        nvmrc: "26\n",
        packageJson: pkg,
        workflowFiles: [{ path: "a.yml", text: "node-version-file: .nvmrc" }],
      })
    ).toEqual([]);
  });

  it("允许字面量与 .nvmrc 相同的例外，但不允许不同", () => {
    expect(
      versionSourceIssues({
        nvmrc: "26",
        packageJson: pkg,
        workflowFiles: [{ path: "a.yml", text: "node-version: 26" }],
      })
    ).toEqual([]);
    expect(
      versionSourceIssues({
        nvmrc: "26",
        packageJson: pkg,
        workflowFiles: [{ path: "a.yml", text: "node-version: latest" }],
      })
    ).toEqual([expect.stringContaining("latest")]);
  });

  it("缺 .nvmrc 或 devEngines 时报错", () => {
    const issues = versionSourceIssues({
      nvmrc: null,
      packageJson: {},
      workflowFiles: [{ path: "a.yml", text: "node-version-file: .node-version" }],
    });
    expect(issues).toHaveLength(3);
  });

  it("锁死单点版本时报错", () => {
    const exact = { devEngines: { packageManager: { name: "pnpm", version: "11.25.0" } } };
    expect(versionSourceIssues({ nvmrc: "26", packageJson: exact, workflowFiles: [] })).toEqual([
      expect.stringContaining("锁死"),
    ]);
  });

  it("工作流给 pnpm/action-setup 传 version 时报错", () => {
    const text = "- uses: pnpm/action-setup@v6\n  with:\n    version: 11.25.0\n";
    expect(
      versionSourceIssues({
        nvmrc: "26",
        packageJson: pkg,
        workflowFiles: [{ path: "a.yml", text }],
      })
    ).toEqual([expect.stringContaining("version")]);
  });
});

describe("wranglerVarsIssues", () => {
  const good = `{
    "vars": {
      "R2_BASE": "https://r2.example",
      "R2_MANIFEST_OBJECT": "tables/tables.json",
    },
  }`;

  it("与配置一致且键集受控时通过", () => {
    expect(wranglerVarsIssues({ config, wranglerText: good })).toEqual([]);
  });

  it("值不一致与缺少键时报错", () => {
    const bad = `{ "vars": { "R2_BASE": "https://evil.example" } }`;
    const issues = wranglerVarsIssues({ config, wranglerText: bad });
    expect(issues).toHaveLength(2);
    expect(issues.join()).toContain("R2_MANIFEST_OBJECT");
    expect(issues.join()).toContain("不一致");
  });

  it("出现未受配置管理的键时报错", () => {
    const extra = `{ "vars": { "R2_BASE": "https://r2.example", "R2_MANIFEST_OBJECT": "tables/tables.json", "SURPRISE": "x" } }`;
    expect(wranglerVarsIssues({ config, wranglerText: extra })).toEqual([
      expect.stringContaining("SURPRISE"),
    ]);
  });

  it("找不到 vars 块时报错", () => {
    expect(wranglerVarsIssues({ config, wranglerText: "{}" })).toEqual([
      expect.stringContaining("找不到 vars"),
    ]);
  });
});
