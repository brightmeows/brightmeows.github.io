import { describe, expect, it } from "vitest";

import { fetchText } from "./fetch.ts";
import { MAX_REDIRECTS, UnsafeFetchTargetError } from "./net-guard.ts";

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
}

/** 从 fetch 的 input 取 URL（input 也可能是 Request 或 URL）。 */
function inputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

const publicResolver = (): Promise<string[]> => Promise.resolve(["93.184.216.34"]);

describe("fetchText 的手动重定向", () => {
  it("跟随公网重定向到最终响应", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = (input) => {
      const url = inputUrl(input);
      calls.push(url);
      if (url === "http://example.com/start") {
        return Promise.resolve(redirectResponse("http://example.com/final"));
      }
      return Promise.resolve(okResponse("hello"));
    };
    const result = await fetchText("http://example.com/start", {
      fetchImpl,
      resolveHostnameImpl: publicResolver,
    });
    expect(result.text).toBe("hello");
    expect(calls).toEqual(["http://example.com/start", "http://example.com/final"]);
  });

  it("拒绝重定向到私网地址", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = (input) => {
      calls += 1;
      const url = inputUrl(input);
      if (url === "http://example.com/start") {
        return Promise.resolve(redirectResponse("http://10.0.0.5/secret"));
      }
      return Promise.resolve(okResponse("should-not-reach"));
    };
    await expect(
      fetchText("http://example.com/start", {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
    expect(calls).toBe(1);
  });

  it("超过跳数上限时报错", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = () => {
      calls += 1;
      return Promise.resolve(redirectResponse(`http://example.com/hop-${calls}`));
    };
    await expect(
      fetchText("http://example.com/start", {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toThrow(/重定向次数超过上限/);
    expect(calls).toBe(MAX_REDIRECTS + 1);
  });

  it("第一跳是私网字面量时直接拒绝", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(okResponse("should-not-reach"));
    await expect(
      fetchText("http://169.254.169.254/latest/meta-data/", {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
  });
});
