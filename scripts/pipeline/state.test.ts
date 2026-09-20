import { describe, expect, it } from "vitest";

import { buildState, parseStateToml, serializeStateToml, sha3_256Hex } from "./state.ts";

const HASHES = { info: "info-hash", header: "header-hash", data: "data-hash" };

describe("sha3_256Hex", () => {
  it("空串的 SHA3-256 向量", () => {
    expect(sha3_256Hex("")).toBe(
      "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"
    );
  });
});

describe("buildState", () => {
  it("哈希一致时保留 last_change，不一致时更新", () => {
    const previous = {
      lastSync: "2026-01-01T00:00:00.000Z",
      tables: new Map([
        [
          "https://a/",
          {
            lastCheck: "2026-01-01T00:00:00.000Z",
            lastChange: "2025-12-01T00:00:00.000Z",
            hashes: HASHES,
          },
        ],
      ]),
    };
    const now = new Date("2026-02-02T00:00:00.000Z");
    const unchanged = buildState(previous, [{ url: "https://a/", hashes: HASHES }], now);
    expect(unchanged.tables.get("https://a/")?.lastChange).toBe("2025-12-01T00:00:00.000Z");
    expect(unchanged.tables.get("https://a/")?.lastCheck).toBe("2026-02-02T00:00:00.000Z");

    const changed = buildState(
      previous,
      [{ url: "https://a/", hashes: { ...HASHES, data: "new" } }],
      now
    );
    expect(changed.tables.get("https://a/")?.lastChange).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("state.toml 序列化与解析", () => {
  it("往返保持内容，URL 作为带引号的键", () => {
    const state = {
      lastSync: "2026-02-02T00:00:00.000Z",
      tables: new Map([
        [
          "https://a/b?x=1",
          {
            lastCheck: "2026-02-02T00:00:00.000Z",
            lastChange: "2026-01-01T00:00:00.000Z",
            hashes: HASHES,
          },
        ],
      ]),
    };
    const text = serializeStateToml(state);
    expect(text).toContain('[tables."https://a/b?x=1"]');
    const parsed = parseStateToml(text);
    expect(parsed).toEqual(state);
  });

  it("坏输入按无历史状态处理", () => {
    expect(parseStateToml("= = =")).toBeNull();
    expect(parseStateToml("[global]\nlast_sync = 1\n")).toBeNull();
    expect(parseStateToml('[global]\nlast_sync = "x"\n')).toEqual({
      lastSync: "x",
      tables: new Map(),
    });
  });
});
