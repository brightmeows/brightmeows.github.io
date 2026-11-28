import { describe, expect, it } from "vitest";

import { aggregateDownloadProgress, progressDetail, progressView } from "./progress.js";

import { PROGRESS_DETERMINATE_MIN_BYTES } from "#lib/constants/progress.js";

describe("progressView", () => {
  it("enters determinate mode at the threshold", () => {
    const view = progressView(128 * 1024, PROGRESS_DETERMINATE_MIN_BYTES);
    expect(view.determinate).toBe(true);
    expect(view.percent).toBe(50);
  });

  it("keeps small files indeterminate", () => {
    const view = progressView(32, 65);
    expect(view.determinate).toBe(false);
    expect(view.percent).toBe(0);
    expect(view.total).toBe(65);
  });

  it("keeps missing totals indeterminate", () => {
    const view = progressView(1024, 0);
    expect(view.determinate).toBe(false);
    expect(view.loaded).toBe(1024);
    expect(view.total).toBe(0);
  });

  it("falls back when loaded exceeds the declared total", () => {
    const view = progressView(2 * 1024 * 1024, 1024 * 1024);
    expect(view.determinate).toBe(false);
    expect(view.percent).toBe(0);
  });

  it("clamps a valid percentage to 100", () => {
    const view = progressView(PROGRESS_DETERMINATE_MIN_BYTES, PROGRESS_DETERMINATE_MIN_BYTES);
    expect(view.percent).toBe(100);
  });
});

describe("progressDetail", () => {
  it("shows loaded and total when both are known", () => {
    expect(progressDetail(1024, 2048)).toBe("1.0KB / 2.0KB");
  });

  it("shows only loaded bytes when total is missing", () => {
    expect(progressDetail(1024, 0)).toBe("1.0KB");
  });

  it("shows only loaded bytes when loaded exceeds total", () => {
    expect(progressDetail(2048, 1024)).toBe("2.0KB");
  });
});

describe("aggregateDownloadProgress", () => {
  it("sums loaded, total and declared sizes", () => {
    expect(
      aggregateDownloadProgress([
        { loaded: 10, totalBytes: 20, sizeBytes: 20 },
        { loaded: 5, totalBytes: 10, sizeBytes: 10 },
      ])
    ).toEqual({ loaded: 15, total: 30, sizeBytes: 30 });
  });

  it("makes the aggregate indeterminate if any total is unknown", () => {
    expect(
      aggregateDownloadProgress([
        { loaded: 10, totalBytes: 20, sizeBytes: 20 },
        { loaded: 5, totalBytes: 0, sizeBytes: 10 },
      ])
    ).toEqual({ loaded: 15, total: 0, sizeBytes: 30 });
  });

  it("makes the aggregate indeterminate if any file exceeds its total", () => {
    expect(
      aggregateDownloadProgress([
        { loaded: 30, totalBytes: 20, sizeBytes: 20 },
        { loaded: 5, totalBytes: 10, sizeBytes: 10 },
      ])
    ).toEqual({ loaded: 35, total: 0, sizeBytes: 30 });
  });

  it("returns an unknown total for an empty group", () => {
    expect(aggregateDownloadProgress([])).toEqual({ loaded: 0, total: 0, sizeBytes: 0 });
  });
});
