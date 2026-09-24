import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { findStaticTarget, readSiteConfig, parseSiteConfig } from "./site-config.ts";

const valid = {
  origin: "https://miyakomeow.site",
  targets: [
    { name: "cloudflare", kind: "worker", hosts: ["miyakomeow.site", "www.miyakomeow.site"] },
    {
      name: "github-pages",
      kind: "static",
      siteBase: "https://github-pages.miyakomeow.site",
      legacyHosts: ["brightmeows.github.io"],
    },
  ],
  r2: {
    base: "https://r2.example/",
    manifestObject: "tables/tables.json",
    baselineObject: "meta/last-notified.json",
    corsOrigins: ["https://miyakomeow.site"],
  },
};

describe("parseSiteConfig", () => {
  it("解析合法配置并去掉 r2.base 尾部斜杠", () => {
    const config = parseSiteConfig(valid, "test");
    expect(config.origin).toBe("https://miyakomeow.site");
    expect(config.r2.base).toBe("https://r2.example");
    expect(config.targets).toHaveLength(2);
  });

  it.each([
    ["origin 缺失", { ...valid, origin: undefined }, /origin/],
    ["origin 带路径", { ...valid, origin: "https://miyakomeow.site/x" }, /纯来源/],
    ["targets 为空", { ...valid, targets: [] }, /targets/],
    ["target 名重复", { ...valid, targets: [valid.targets[1], valid.targets[1]] }, /唯一/],
    [
      "worker 目标缺 hosts",
      { ...valid, targets: [{ name: "cf", kind: "worker", hosts: [] }] },
      /hosts/,
    ],
    [
      "静态目标 siteBase 非法",
      {
        ...valid,
        targets: [
          {
            name: "gh",
            kind: "static",
            siteBase: "github-pages.miyakomeow.site",
            legacyHosts: ["brightmeows.github.io"],
          },
        ],
      },
      /siteBase/,
    ],
    [
      "静态目标缺 legacyHosts",
      {
        ...valid,
        targets: [{ name: "gh", kind: "static", siteBase: "https://github-pages.miyakomeow.site" }],
      },
      /legacyHosts/,
    ],
    ["kind 非法", { ...valid, targets: [{ name: "x", kind: "ftp" }] }, /kind/],
    ["r2 段缺失", { ...valid, r2: undefined }, /r2/],
    [
      "manifestObject 以斜杠开头",
      { ...valid, r2: { ...valid.r2, manifestObject: "/tables/tables.json" } },
      /manifestObject/,
    ],
    [
      "baselineObject 以斜杠开头",
      { ...valid, r2: { ...valid.r2, baselineObject: "/meta/x.json" } },
      /baselineObject/,
    ],
    ["corsOrigins 为空", { ...valid, r2: { ...valid.r2, corsOrigins: [] } }, /corsOrigins/],
    [
      "corsOrigins 含路径",
      { ...valid, r2: { ...valid.r2, corsOrigins: ["https://a.example/x"] } },
      /纯来源/,
    ],
  ])("拒绝 %s", (_name, value, pattern) => {
    expect(() => parseSiteConfig(value, "test")).toThrow(pattern);
  });
});

describe("readSiteConfig / findStaticTarget", () => {
  it("从磁盘读取并取静态目标", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "site-config-")), "site.json");
    writeFileSync(file, JSON.stringify(valid));
    const config = readSiteConfig(file);
    expect(findStaticTarget(config, "github-pages").siteBase).toBe(
      "https://github-pages.miyakomeow.site"
    );
  });

  it("目标不存在或不是静态宿主时报错", () => {
    const config = parseSiteConfig(valid, "test");
    expect(() => findStaticTarget(config, "nope")).toThrow(/没有目标/);
    expect(() => findStaticTarget(config, "cloudflare")).toThrow(/不是静态宿主/);
  });
});
