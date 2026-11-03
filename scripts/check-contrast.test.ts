import { describe, expect, it } from "vitest";

import {
  composite,
  contrastRatio,
  cssBlocks,
  parseColor,
  parseHex,
  parseRgb,
  parseVariables,
  type Rgba,
} from "./check-contrast.ts";

describe("check-contrast", () => {
  it("parses hex colors with and without alpha", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex("#112233")).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseHex("#11223380")).toEqual({ r: 17, g: 34, b: 51, a: 128 / 255 });
    expect(parseHex("nope")).toBeNull();
  });

  it("parses rgb and rgba syntax", () => {
    expect(parseRgb("rgb(1 2 3 / 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseRgb("rgba(1, 2, 3, 0.25)")).toEqual({ r: 1, g: 2, b: 3, a: 0.25 });
    expect(parseRgb("not-a-color")).toBeNull();
  });

  it("resolves var() chains", () => {
    const variables = parseVariables("--base: #000; --fg: var(--base);");
    expect(parseColor("var(--fg)", variables)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseColor("var(--missing, #fff)", variables)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    });
  });

  it("composites alpha foreground over an opaque background", () => {
    const half: Rgba = { r: 255, g: 0, b: 0, a: 0.5 };
    const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    const mixed = composite(half, white);
    expect(mixed.r).toBeCloseTo(255);
    expect(mixed.g).toBeCloseTo(127.5);
    expect(mixed.b).toBeCloseTo(127.5);
    expect(mixed.a).toBe(1);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio(parseHex("#000")!, parseHex("#fff")!)).toBeCloseTo(21);
    expect(contrastRatio(parseHex("#fff")!, parseHex("#fff")!)).toBeCloseTo(1);
  });

  it("extracts blocks without matching attribute variants", () => {
    const css = ':root { --a: 1; } :root[data-theme="dark"] { --a: 2; }';
    expect(cssBlocks(css, ":root")).toHaveLength(1);
    expect(cssBlocks(css, ':root[data-theme="dark"]')).toHaveLength(1);
  });
});
