import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { findRedirectTarget, readSiteConfig, parseSiteConfig } from "./site-config.ts";

const valid = {
  origin: "https://brightmeows.com",
  targets: [
    { name: "cloudflare", kind: "worker", hosts: ["brightmeows.com", "www.brightmeows.com"] },
    {
      name: "github-pages",
      kind: "redirect",
      siteBase: "https://github-pages.brightmeows.com",
      legacyHosts: ["brightmeows.github.io"],
      pagesServer: "codeberg.page",
    },
  ],
  r2: {
    base: "https://r2.example/",
    manifestObject: "tables/tables.json",
    corsOrigins: ["https://brightmeows.com"],
  },
};

describe("parseSiteConfig", () => {
  it("解析合法配置并去掉 r2.base 尾部斜杠", () => {
    const config = parseSiteConfig(valid, "test");
    expect(config.origin).toBe("https://brightmeows.com");
    expect(config.r2.base).toBe("https://r2.example");
    expect(config.targets).toHaveLength(2);
    expect(findRedirectTarget(config, "github-pages").pagesServer).toBe("codeberg.page");
  });

  it.each([
    ["origin 缺失", { ...valid, origin: undefined }, /origin/],
    ["origin 带路径", { ...valid, origin: "https://brightmeows.com/x" }, /纯来源/],
    ["targets 为空", { ...valid, targets: [] }, /targets/],
    ["target 名重复", { ...valid, targets: [valid.targets[1], valid.targets[1]] }, /唯一/],
    [
      "worker 目标缺 hosts",
      { ...valid, targets: [{ name: "cf", kind: "worker", hosts: [] }] },
      /hosts/,
    ],
    [
      "跳转目标 siteBase 非法",
      {
        ...valid,
        targets: [
          {
            name: "gh",
            kind: "redirect",
            siteBase: "github-pages.brightmeows.com",
            legacyHosts: ["brightmeows.github.io"],
          },
        ],
      },
      /siteBase/,
    ],
    [
      "跳转目标缺 legacyHosts",
      {
        ...valid,
        targets: [
          { name: "gh", kind: "redirect", siteBase: "https://github-pages.brightmeows.com" },
        ],
      },
      /legacyHosts/,
    ],
    [
      "跳转目标 pagesServer 非法",
      {
        ...valid,
        targets: [
          {
            name: "gh",
            kind: "redirect",
            siteBase: "https://github-pages.brightmeows.com",
            legacyHosts: ["brightmeows.github.io"],
            pagesServer: "https://codeberg.page/x",
          },
        ],
      },
      /pagesServer/,
    ],
    ["kind 非法", { ...valid, targets: [{ name: "x", kind: "ftp" }] }, /kind/],
    ["r2 段缺失", { ...valid, r2: undefined }, /r2/],
    [
      "manifestObject 以斜杠开头",
      { ...valid, r2: { ...valid.r2, manifestObject: "/tables/tables.json" } },
      /manifestObject/,
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

describe("readSiteConfig / findRedirectTarget", () => {
  it("从磁盘读取并取跳转目标", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "site-config-")), "site.json");
    writeFileSync(file, JSON.stringify(valid));
    const config = readSiteConfig(file);
    expect(findRedirectTarget(config, "github-pages").siteBase).toBe(
      "https://github-pages.brightmeows.com"
    );
  });

  it("目标不存在或不是跳转目标时报错", () => {
    const config = parseSiteConfig(valid, "test");
    expect(() => findRedirectTarget(config, "nope")).toThrow(/没有目标/);
    expect(() => findRedirectTarget(config, "cloudflare")).toThrow(/不是跳转目标/);
  });
});
