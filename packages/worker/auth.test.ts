/**
 * OAuth returnTo 回跳地址校验的纯函数测试。
 *
 * safeReturnTo 是登录跳转的安全边界：放行了站外或协议相对地址就是开放重定向。
 * 全部用例离线可验，不需要 mock fetch 与 env。
 */

import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./auth.ts";
import { allowedOrigins, checkAllowedOrigin } from "./http.ts";

/** 测试用 Origin 白名单：站点三域的替身。 */
const ORIGINS = [
  "https://main.example",
  "https://gh-pages.main.example",
  "https://cb-pages.main.example",
];

describe("safeReturnTo", () => {
  it("接受主站内相对路径", () => {
    expect(safeReturnTo("/bms/table/mirror/", ORIGINS)).toBe("/bms/table/mirror/");
    expect(safeReturnTo("/blog?x=1#frag", ORIGINS)).toBe("/blog?x=1#frag");
    expect(safeReturnTo("/", ORIGINS)).toBe("/");
  });

  it("接受白名单站点上的绝对 URL 并保留原 origin", () => {
    expect(safeReturnTo("https://gh-pages.main.example/bms/table/mirror/", ORIGINS)).toBe(
      "https://gh-pages.main.example/bms/table/mirror/"
    );
    expect(safeReturnTo("https://cb-pages.main.example/?x=1", ORIGINS)).toBe(
      "https://cb-pages.main.example/?x=1"
    );
  });

  it("拒绝空值", () => {
    expect(safeReturnTo(undefined, ORIGINS)).toBeUndefined();
    expect(safeReturnTo(null, ORIGINS)).toBeUndefined();
    expect(safeReturnTo("", ORIGINS)).toBeUndefined();
  });

  it("拒绝白名单外的绝对 URL", () => {
    expect(safeReturnTo("https://evil.com/path", ORIGINS)).toBeUndefined();
    expect(safeReturnTo("http://evil.com", ORIGINS)).toBeUndefined();
    expect(safeReturnTo("https://main.example.evil.com/", ORIGINS)).toBeUndefined();
    expect(safeReturnTo("bms/table", ORIGINS)).toBeUndefined();
  });

  it("拒绝协议相对与反斜杠绕过", () => {
    expect(safeReturnTo("//evil.com", ORIGINS)).toBeUndefined();
    expect(safeReturnTo("/\\evil.com", ORIGINS)).toBeUndefined();
  });

  it("拒绝含控制字符的路径", () => {
    expect(safeReturnTo("/ok\r\nX-Injected: 1", ORIGINS)).toBeUndefined();
    expect(safeReturnTo("/a\tb", ORIGINS)).toBeUndefined();
  });
});

describe("checkAllowedOrigin", () => {
  const request = (origin: string | null): Request =>
    new Request("https://main.example/api/auth/logout", {
      method: "POST",
      headers: origin === null ? {} : { origin },
    });

  it("白名单内的 Origin 通过", () => {
    expect(checkAllowedOrigin(request("https://gh-pages.main.example"), ORIGINS)).toBe(true);
  });

  it("缺失或不在白名单的 Origin 拒绝", () => {
    expect(checkAllowedOrigin(request(null), ORIGINS)).toBe(false);
    expect(checkAllowedOrigin(request("https://evil.com"), ORIGINS)).toBe(false);
    // 不做后缀通配：子域后缀近似的域也不放行
    expect(checkAllowedOrigin(request("https://main.example.evil.com"), ORIGINS)).toBe(false);
  });

  it("allowedOrigins 解析 vars 并忽略空项", () => {
    expect(allowedOrigins({ SITE_ORIGINS: " https://a.example , https://b.example , " })).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
