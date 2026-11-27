import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchStream, FetchStreamError, readResponseBytes } from "./fetch-stream.js";

function streamResponse(chunks: string[], total?: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  const headers = new Headers();
  if (total !== undefined) headers.set("Content-Length", String(total));
  return new Response(body, { status: 200, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchStream", () => {
  it("reports chunk progress and returns the declared total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(["abc", "de"], 5)));
    const progress: { loaded: number; total: number }[] = [];

    const result = await fetchStream("https://example.test/data.json", undefined, (p) =>
      progress.push(p)
    );

    expect(new TextDecoder().decode(result.bytes)).toBe("abcde");
    expect(result.total).toBe(5);
    expect(progress).toEqual([
      { loaded: 3, total: 5 },
      { loaded: 5, total: 5 },
    ]);
  });

  it("returns total 0 when Content-Length is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(["data"])));
    const result = await fetchStream("https://example.test/data.json");
    expect(result.total).toBe(0);
  });

  it("throws a status-carrying error on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("missing", { status: 404, statusText: "Not Found" }))
    );

    await expect(fetchStream("https://example.test/missing.json")).rejects.toMatchObject({
      name: "FetchStreamError",
      status: 404,
    });
  });

  it("exposes the HTTP error type", async () => {
    await expect(
      readResponseBytes(new Response("data", { headers: { "Content-Length": "4" } }))
    ).resolves.toMatchObject({ total: 4 });
    expect(new FetchStreamError(500, "Server Error").status).toBe(500);
  });
});
