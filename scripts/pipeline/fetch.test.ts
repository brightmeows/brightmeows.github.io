import { describe, expect, it } from "vitest";

import { fetchTable, fetchText } from "./fetch.ts";
import { MAX_REDIRECTS, UnsafeFetchTargetError } from "./net-guard.ts";

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

describe("fetchText 的状态码", () => {
  it("保留最终响应状态", async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response("missing", { status: 404, headers: { "content-type": "text/plain" } })
      );
    const result = await fetchText("http://example.com/missing", {
      fetchImpl,
      resolveHostnameImpl: publicResolver,
    });
    expect(result.status).toBe(404);
  });
});

function tableInfo(url: string) {
  return { name: "", symbol: "", url, extra: {} };
}

describe("fetchTable 的失败分类", () => {
  it("页面 404 归为 source_gone", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(htmlResponse("Not Found", 404));
    await expect(
      fetchTable(tableInfo("http://example.com/table.html"), {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toMatchObject({ reason: "source_gone" });
  });

  it("Rhino 错误页归为 gas_runtime_retired", async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        htmlResponse("エラー Rhino ランタイムは非推奨となり、サポートが終了しました")
      );
    await expect(
      fetchTable(tableInfo("http://example.com/table.html"), {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toMatchObject({ reason: "gas_runtime_retired" });
  });

  it("Drive 文件不存在归为 source_gone", async () => {
    const fetchImpl: typeof fetch = (input) => {
      const url = inputUrl(input);
      if (url.endsWith("header.json")) {
        return Promise.resolve(jsonResponse({ name: "x", symbol: "x", data_url: "./data.json" }));
      }
      if (url.endsWith("data.json")) {
        return Promise.resolve(htmlResponse("ページが見つかりません"));
      }
      return Promise.resolve(htmlResponse('<meta name="bmstable" content="header.json" />'));
    };
    await expect(
      fetchTable(tableInfo("http://example.com/table.html"), {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toMatchObject({ reason: "source_gone" });
  });

  it("403 归为 access_denied", async () => {
    const fetchImpl: typeof fetch = (input) => {
      const url = inputUrl(input);
      if (url.endsWith("header.json")) {
        return Promise.resolve(jsonResponse({ name: "x", symbol: "x", data_url: "./data.json" }));
      }
      if (url.endsWith("data.json")) {
        return Promise.resolve(htmlResponse("Access denied", 403));
      }
      return Promise.resolve(htmlResponse('<meta name="bmstable" content="header.json" />'));
    };
    await expect(
      fetchTable(tableInfo("http://example.com/table.html"), {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toMatchObject({ reason: "access_denied" });
  });

  it("没有 bmstable 的普通页面归为 unknown", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(htmlResponse("hello"));
    await expect(
      fetchTable(tableInfo("http://example.com/table.html"), {
        fetchImpl,
        resolveHostnameImpl: publicResolver,
      })
    ).rejects.toMatchObject({ reason: "unknown" });
  });
});
