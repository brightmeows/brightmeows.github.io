/**
 * OAuth returnTo 回跳地址校验与同源写校验的纯函数测试。
 *
 * safeReturnTo 是登录跳转的安全边界：放行了站外或协议相对地址就是开放重定向。
 * 全部用例离线可验，不需要 mock fetch 与 env。
 */

import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./handlers/account.ts";
import { checkSameOrigin } from "./http.ts";

describe("safeReturnTo", () => {
  it("接受站内相对路径", () => {
    expect(safeReturnTo("/bms/table/mirror/")).toBe("/bms/table/mirror/");
    expect(safeReturnTo("/blog?x=1#frag")).toBe("/blog?x=1#frag");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("拒绝绝对 URL、协议相对与反斜杠绕过", () => {
    expect(safeReturnTo("https://evil.com/path")).toBeUndefined();
    expect(safeReturnTo("http://evil.com")).toBeUndefined();
    expect(safeReturnTo("https://main.example/")).toBeUndefined();
    expect(safeReturnTo("bms/table")).toBeUndefined();
    expect(safeReturnTo("//evil.com")).toBeUndefined();
    expect(safeReturnTo("/\\evil.com")).toBeUndefined();
  });

  it("拒绝空值", () => {
    expect(safeReturnTo(undefined)).toBeUndefined();
    expect(safeReturnTo(null)).toBeUndefined();
    expect(safeReturnTo("")).toBeUndefined();
  });

  it("拒绝含控制字符的路径", () => {
    expect(safeReturnTo("/ok\r\nX-Injected: 1")).toBeUndefined();
    expect(safeReturnTo("/a\tb")).toBeUndefined();
  });
});

describe("checkSameOrigin", () => {
  const request = (origin: string | null): Request =>
    new Request("https://main.example/api/auth/logout", {
      method: "POST",
      headers: origin === null ? {} : { origin },
    });

  it("同源 Origin 通过", () => {
    expect(checkSameOrigin(request("https://main.example"))).toBe(true);
  });

  it("缺失、跨源或后缀近似拒绝", () => {
    expect(checkSameOrigin(request(null))).toBe(false);
    expect(checkSameOrigin(request("https://evil.com"))).toBe(false);
    expect(checkSameOrigin(request("https://main.example.evil.com"))).toBe(false);
    expect(checkSameOrigin(request("https://gh-pages.main.example"))).toBe(false);
  });
});
