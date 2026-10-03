/**
 * 边缘语言分发的纯函数测试。
 *
 * detectLocale 是每个请求的第一道分叉（cookie → Accept-Language → en），
 * cleanInternalPath / localizedAssetPath / shellPath 决定内部语言树的选树，
 * pageText 是浏览器直显错误的词表。全部离线可验，不需要 mock。
 */

import { describe, expect, it } from "vitest";

import {
  cleanInternalPath,
  detectLocale,
  localizedAssetPath,
  pageText,
  shellPath,
} from "./i18n.ts";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://main.example/", { headers });
}

describe("detectLocale", () => {
  it("cookie 优先于 Accept-Language", () => {
    expect(
      detectLocale(request({ cookie: "PARAGLIDE_LOCALE=ja", "accept-language": "en-US,en;q=0.9" }))
    ).toBe("ja");
    expect(
      detectLocale(request({ cookie: "PARAGLIDE_LOCALE=zh-cn", "accept-language": "ja" }))
    ).toBe("zh-cn");
    expect(
      detectLocale(
        request({ cookie: "other=1; PARAGLIDE_LOCALE=en; x=2", "accept-language": "ja" })
      )
    ).toBe("en");
  });

  it("非法 cookie 值被忽略并落到 Accept-Language", () => {
    expect(
      detectLocale(request({ cookie: "PARAGLIDE_LOCALE=fr", "accept-language": "ja-JP" }))
    ).toBe("ja");
  });

  it("Accept-Language 按浏览器偏好顺序取首个命中", () => {
    expect(detectLocale(request({ "accept-language": "ja,en-US;q=0.9,en;q=0.8" }))).toBe("ja");
    expect(detectLocale(request({ "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }))).toBe("zh-cn");
    expect(detectLocale(request({ "accept-language": "ko-KR,ja;q=0.9" }))).toBe("ja");
    expect(detectLocale(request({ "accept-language": "fr-FR,en;q=0.5" }))).toBe("en");
  });

  it("无有效偏好时保底 en", () => {
    expect(detectLocale(request())).toBe("en");
    expect(detectLocale(request({ "accept-language": "ko-KR,fr;q=0.8" }))).toBe("en");
  });
});

describe("语言树路径", () => {
  it("localizedAssetPath 只对非 en 且非共享资源的路径加前缀", () => {
    expect(localizedAssetPath("/bms/table/", "en")).toBe("/bms/table/");
    expect(localizedAssetPath("/bms/table/", "zh-cn")).toBe("/_i18n/zh-cn/bms/table/");
    expect(localizedAssetPath("/bms/table/", "ja")).toBe("/_i18n/ja/bms/table/");
    expect(localizedAssetPath("/_app/immutable/x.js", "ja")).toBe("/_app/immutable/x.js");
    expect(localizedAssetPath("/assets/avatar.png", "ja")).toBe("/assets/avatar.png");
  });

  it("shellPath 指向各树的 404 外壳", () => {
    expect(shellPath("en")).toBe("/404.html");
    expect(shellPath("zh-cn")).toBe("/_i18n/zh-cn/404.html");
    expect(shellPath("ja")).toBe("/_i18n/ja/404.html");
  });

  it("cleanInternalPath 整段匹配并剥离前缀", () => {
    expect(cleanInternalPath("/_i18n/ja/bms/")).toBe("/bms/");
    expect(cleanInternalPath("/_i18n/zh-cn")).toBe("/");
    expect(cleanInternalPath("/_i18n/ja")).toBe("/");
    expect(cleanInternalPath("/bms/")).toBeNull();
    expect(cleanInternalPath("/_i18n/zh-cnfoo")).toBeNull();
  });
});

describe("pageText", () => {
  it("按语言取文案并替换占位符", () => {
    expect(pageText("en", "method_not_allowed")).toBe("Only GET / HEAD are supported.");
    expect(pageText("zh-cn", "method_not_allowed")).toBe("仅支持 GET / HEAD。");
    expect(pageText("ja", "method_not_allowed")).toBe("GET / HEAD のみ対応しています。");
    expect(pageText("ja", "manifest_incomplete", { error: "x" })).toBe(
      "マニフェストのデータが不完全です：x"
    );
    expect(pageText("ja", "manifest_incomplete")).toContain("{error}");
  });
});
