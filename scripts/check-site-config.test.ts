import { describe, expect, it } from "vitest";

import {
  baselineFileNameIssues,
  collectDomains,
  collectTargetFlags,
  corsCoverageIssues,
  findDomainsInText,
  hardcodedDomainIssues,
  routeHostIssues,
  targetFlagIssues,
  versionSourceIssues,
  wranglerRouteHosts,
  wranglerVarsIssues,
} from "./check-site-config.ts";
import { parseSiteConfig } from "./site-config.ts";

const config = parseSiteConfig(
  {
    origin: "https://miyakomeow.site",
    targets: [
      { name: "cloudflare", kind: "worker", hosts: ["miyakomeow.site", "www.miyakomeow.site"] },
      { name: "github-pages", kind: "static", siteBase: "https://brightmeows.github.io" },
      { name: "codeberg-pages", kind: "static", siteBase: "https://brightmeows.codeberg.page" },
    ],
    r2: {
      base: "https://r2.example",
      manifestObject: "tables/tables.json",
      baselineObject: "meta/last-notified.json",
      corsOrigins: [
        "https://miyakomeow.site",
        "https://brightmeows.github.io",
        "https://brightmeows.codeberg.page",
        "http://localhost:5173",
      ],
    },
  },
  "test"
);

describe("collectTargetFlags", () => {
  it("抓出所有 --target= 名称", () => {
    expect(
      collectTargetFlags("run: node x.ts --target=github-pages\nnode y.ts --target=codeberg-pages")
    ).toEqual(["github-pages", "codeberg-pages"]);
  });
});

describe("wranglerRouteHosts", () => {
  it("从带注释与尾逗号的 JSONC 里取出 route 主机", () => {
    const text = `{
      // 注释里有 "pattern" 字样也应被忽略吗？不，这里只取 pattern 键
      "routes": [
        { "pattern": "miyakomeow.site", "custom_domain": true },
        { "pattern": "www.miyakomeow.site", "custom_domain": true },
        { "pattern": "old.example/*" },
      ],
    }`;
    expect(wranglerRouteHosts(text)).toEqual([
      "miyakomeow.site",
      "www.miyakomeow.site",
      "old.example",
    ]);
  });
});

describe("targetFlagIssues", () => {
  it("合法目标名通过，非法目标名报错", () => {
    expect(targetFlagIssues(["github-pages", "codeberg-pages"], config)).toEqual([]);
    expect(targetFlagIssues(["cloudflare"], config)).toEqual([
      expect.stringContaining("--target=cloudflare"),
    ]);
    expect(targetFlagIssues(["nope"], config)).toHaveLength(1);
  });
});

describe("routeHostIssues", () => {
  it("routes 主机都在 worker.hosts 里时通过", () => {
    expect(routeHostIssues(["miyakomeow.site", "www.miyakomeow.site"], config)).toEqual([]);
  });

  it("出现额外主机时报错", () => {
    expect(routeHostIssues(["miyakomeow.site", "evil.example"], config)).toEqual([
      expect.stringContaining("evil.example"),
    ]);
  });
});

describe("hardcodedDomainIssues / findDomainsInText", () => {
  it("配置域名全部被识别（含 R2 主机与 worker 的 www）", () => {
    expect(collectDomains(config).sort()).toEqual(
      [
        "brightmeows.codeberg.page",
        "brightmeows.github.io",
        "miyakomeow.site",
        "r2.example",
        "www.miyakomeow.site",
      ].sort()
    );
  });

  it("工作流里出现域名即报错，注释里的也不算白名单", () => {
    const files = [
      { path: "a.yml", text: "run: node x.ts --target=github-pages" },
      { path: "b.yml", text: "run: curl https://miyakomeow.site/" },
    ];
    expect(hardcodedDomainIssues(files, config)).toEqual([expect.stringContaining("b.yml")]);
    expect(findDomainsInText("https://r2.example/x", collectDomains(config))).toEqual([
      "r2.example",
    ]);
  });
});

describe("baselineFileNameIssues", () => {
  it("文件名与配置的 basename 一致时通过", () => {
    expect(
      baselineFileNameIssues({
        config,
        updateTablesText:
          "changed=$(node scripts/detect-mirror-change.ts --out=./last-notified.json)",
      })
    ).toEqual([]);
  });

  it("文件名不一致时报错", () => {
    const issues = baselineFileNameIssues({ config, updateTablesText: "--out=./baseline.json" });
    expect(issues).toHaveLength(1);
    expect(issues.join()).toContain("last-notified.json");
  });

  it("找不到 --out 时报错", () => {
    expect(baselineFileNameIssues({ config, updateTablesText: "echo hi" })).toEqual([
      expect.stringContaining("找不到"),
    ]);
  });
});

describe("corsCoverageIssues", () => {
  it("覆盖齐全时通过", () => {
    expect(corsCoverageIssues(config)).toEqual([]);
  });

  it("缺静态目标来源时报错", () => {
    const partial = parseSiteConfig(
      { ...config, r2: { ...config.r2, corsOrigins: ["https://miyakomeow.site"] } },
      "test"
    );
    expect(corsCoverageIssues(partial)).toHaveLength(2);
  });
});

describe("versionSourceIssues", () => {
  const pkg = { packageManager: "pnpm@11.3.0" };

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

  it("缺 .nvmrc 或 packageManager 时报错", () => {
    const issues = versionSourceIssues({
      nvmrc: null,
      packageJson: {},
      workflowFiles: [{ path: "a.yml", text: "node-version-file: .node-version" }],
    });
    expect(issues).toHaveLength(3);
  });
});

describe("wranglerVarsIssues", () => {
  const good = `{
    "vars": { "R2_BASE": "https://r2.example", "R2_MANIFEST_OBJECT": "tables/tables.json" },
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
