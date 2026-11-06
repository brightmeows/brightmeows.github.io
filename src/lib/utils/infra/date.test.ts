import { describe, expect, it } from "vitest";

import { EPOCH_DATE, extractDateFromSlug, formatRelativeTime } from "./date.js";

describe("extractDateFromSlug", () => {
  it("识别三种目录日期形态", () => {
    expect(extractDateFromSlug("20251225/xxx")).toBe("2025-12-25");
    expect(extractDateFromSlug("2025-12-25/xxx")).toBe("2025-12-25");
    expect(extractDateFromSlug("2025/12/25/xxx")).toBe("2025-12-25");
  });

  it("无日期形态返回 undefined", () => {
    expect(extractDateFromSlug("no-date/xxx")).toBeUndefined();
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");

  it("按量级选单位输出中文相对时间", () => {
    expect(formatRelativeTime("2026-11-06T11:59:40Z", "zh-cn", now)).toMatch(/秒/);
    expect(formatRelativeTime("2026-11-06T11:30:00Z", "zh-cn", now)).toMatch(/分钟/);
    expect(formatRelativeTime("2026-11-06T09:00:00Z", "zh-cn", now)).toMatch(/小时/);
    expect(formatRelativeTime("2026-11-03T12:00:00Z", "zh-cn", now)).toMatch(/天/);
    expect(formatRelativeTime("2026-10-10T12:00:00Z", "zh-cn", now)).toMatch(/周/);
    expect(formatRelativeTime("2026-01-06T12:00:00Z", "zh-cn", now)).toMatch(/个月|月/);
    expect(formatRelativeTime("2024-11-06T12:00:00Z", "zh-cn", now)).toMatch(/年/);
  });

  it("未来时间按刚刚处理", () => {
    expect(formatRelativeTime("2026-11-07T12:00:00Z", "en", now)).toMatch(/now|moment/);
  });

  it("非法时间戳原样返回", () => {
    expect(formatRelativeTime("not-a-date", "zh-cn", now)).toBe("not-a-date");
  });

  it("英文 locale 输出 ago 形态", () => {
    expect(formatRelativeTime("2026-11-06T11:30:00Z", "en", now)).toMatch(/ago/);
  });
});

describe("EPOCH_DATE", () => {
  it("是常量", () => {
    expect(EPOCH_DATE).toBe("1970-01-01");
  });
});
