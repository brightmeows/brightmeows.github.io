/**
 * 离线 token 对比度校验：把 `layout.css` 里的语义 token 按 WCAG 2.1 计算，
 * 低于门槛直接失败。
 *
 * 解析的是 CSS 变量而不是组件类名：`@theme` 提供默认值（星夜），
 * `:root[data-theme="dark"]` 覆盖为深夜；玻璃、surface、border 等半透明
 * token 按“最坏背景”合成后再算。最坏背景取亮端渐变中段 `#302b63`，
 * 暗端取 `#0a0a14`；背景渐变是刻意保持不变的不变量，改渐变时要同步这里。
 *
 * 纯离线、毫秒级。用法：`node scripts/check-contrast.ts`
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 颜色值：sRGB 分量 0 到 255，alpha 0 到 1。 */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 对比度检查项：前景 token、背景 token、最低比值。 */
export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  minimum: number;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = path.join(ROOT, "src/routes/layout.css");

/** 取选择器对应块的内容；同名块会依次合并，后者覆盖前者。 */
export function cssBlocks(text: string, selector: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(selector, from);
    if (start === -1) return blocks;
    const afterSelector = text.slice(start + selector.length).trimStart();
    if (!afterSelector.startsWith("{")) {
      from = start + selector.length;
      continue;
    }
    const open = text.indexOf("{", start + selector.length);
    if (open === -1) return blocks;
    let depth = 0;
    for (let index = open; index < text.length; index += 1) {
      const char = text[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(text.slice(open + 1, index));
          from = index + 1;
          break;
        }
      }
    }
    if (from <= start) return blocks;
  }
}

/** 从 CSS 文本提取 `--name: value;` 声明。 */
export function parseVariables(text: string): Map<string, string> {
  const variables = new Map<string, string>();
  for (const match of text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) variables.set(`--${name}`, value.trim());
  }
  return variables;
}

/** 解析 #rgb、#rrggbb、#rrggbbaa。 */
export function parseHex(value: string): Rgba | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[\da-f]+$/i.test(hex)) return null;
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0]! + hex[0]!, 16),
      g: Number.parseInt(hex[1]! + hex[1]!, 16),
      b: Number.parseInt(hex[2]! + hex[2]!, 16),
      a: 1,
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  return null;
}

/** 解析 `rgb()` / `rgba()` 的逗号或空格语法。 */
export function parseRgb(value: string): Rgba | null {
  const match =
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(
      value.trim()
    );
  if (!match) return null;
  const alphaRaw = match[4];
  const alpha = alphaRaw?.endsWith("%")
    ? Number.parseFloat(alphaRaw) / 100
    : alphaRaw === undefined
      ? 1
      : Number.parseFloat(alphaRaw);
  return {
    r: Number.parseFloat(match[1]!),
    g: Number.parseFloat(match[2]!),
    b: Number.parseFloat(match[3]!),
    a: alpha,
  };
}

/** 解析单个颜色值；`var()` 递归解析，未知函数返回 null。 */
export function parseColor(value: string, variables: Map<string, string>): Rgba | null {
  const trimmed = value.trim();
  if (trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (trimmed.startsWith("#")) return parseHex(trimmed);
  if (/^rgba?\(/i.test(trimmed)) return parseRgb(trimmed);
  if (trimmed.startsWith("var(")) {
    const inner = trimmed.slice(4, -1);
    const comma = inner.indexOf(",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
    const variable = variables.get(name);
    if (variable !== undefined) return parseColor(variable, variables);
    return fallback === null ? null : parseColor(fallback, variables);
  }
  return null;
}

/** 把带 alpha 的前景合成到背景上。 */
export function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha,
  };
}

/** WCAG 相对亮度。 */
export function relativeLuminance(color: Rgba): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG 对比度，返回 1 到 21。 */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 取两个变量名并合成背景；alpha 背景合成到 base 上。 */
function resolvePair(
  variables: Map<string, string>,
  foregroundName: string,
  backgroundName: string,
  base: Rgba
): { foreground: Rgba; background: Rgba } | null {
  const foreground = parseColor(variables.get(foregroundName) ?? "", variables);
  const background = parseColor(variables.get(backgroundName) ?? "", variables);
  if (!foreground || !background) return null;
  return { foreground, background: composite(background, base) };
}

/** 语义 pair：文字与语义色在纯背景、玻璃、surface 上的检查。 */
const TEXT_PAIRS: ContrastPair[] = [
  { name: "text", foreground: "--color-text", background: "--color-background", minimum: 4.5 },
  {
    name: "text-secondary",
    foreground: "--color-text-secondary",
    background: "--color-background",
    minimum: 4.5,
  },
  {
    name: "text-tertiary (large)",
    foreground: "--color-text-tertiary",
    background: "--color-background",
    minimum: 3,
  },
  { name: "link", foreground: "--color-link", background: "--color-background", minimum: 4.5 },
  {
    name: "link-hover",
    foreground: "--color-link-hover",
    background: "--color-background",
    minimum: 4.5,
  },
  {
    name: "success",
    foreground: "--color-success",
    background: "--color-background",
    minimum: 4.5,
  },
  {
    name: "warning",
    foreground: "--color-warning",
    background: "--color-background",
    minimum: 4.5,
  },
  { name: "error", foreground: "--color-error", background: "--color-background", minimum: 4.5 },
  {
    name: "error-strong",
    foreground: "--color-error-strong",
    background: "--color-background",
    minimum: 4.5,
  },
];

/** 玻璃与结构色：合成到最坏背景后再检查。 */
const GLASS_PAIRS: ContrastPair[] = [
  { name: "text / glass", foreground: "--color-text", background: "--color-glass", minimum: 4.5 },
  {
    name: "text-secondary / glass",
    foreground: "--color-text-secondary",
    background: "--color-glass",
    minimum: 4.5,
  },
  {
    name: "text-tertiary / glass (large)",
    foreground: "--color-text-tertiary",
    background: "--color-glass",
    minimum: 3,
  },
  {
    name: "link / glass",
    foreground: "--color-link",
    background: "--color-glass",
    minimum: 4.5,
  },
  {
    name: "success / glass",
    foreground: "--color-success",
    background: "--color-glass",
    minimum: 4.5,
  },
  {
    name: "warning / glass",
    foreground: "--color-warning",
    background: "--color-glass",
    minimum: 4.5,
  },
  {
    name: "error / glass",
    foreground: "--color-error",
    background: "--color-glass",
    minimum: 4.5,
  },
  {
    name: "border-control / glass",
    foreground: "--color-border-control",
    background: "--color-glass",
    minimum: 3,
  },
  {
    name: "focus / glass",
    foreground: "--color-focus",
    background: "--color-glass",
    minimum: 3,
  },
];

/** 渐变端点上的深色文字。 */
const GRADIENT_PAIRS: ContrastPair[] = [
  "primary",
  "brand",
  "success",
  "warning",
  "danger",
  "mocha",
  "minir",
].flatMap((group) => [
  {
    name: `${group} from / on-accent`,
    foreground: "--color-on-accent",
    background: `--color-${group}-from`,
    minimum: 4.5,
  },
  {
    name: `${group} to / on-accent`,
    foreground: "--color-on-accent",
    background: `--color-${group}-to`,
    minimum: 4.5,
  },
]);

/** 每个主题的 CSS 变量表；dark 覆盖星夜默认值。 */
function themeVariables(css: string, theme: "light" | "dark"): Map<string, string> {
  const variables = new Map<string, string>();
  for (const block of cssBlocks(css, "@theme")) {
    for (const [name, value] of parseVariables(block)) variables.set(name, value);
  }
  for (const block of cssBlocks(css, ":root")) {
    for (const [name, value] of parseVariables(block)) variables.set(name, value);
  }
  if (theme === "dark") {
    for (const block of cssBlocks(css, ':root[data-theme="dark"]')) {
      for (const [name, value] of parseVariables(block)) variables.set(name, value);
    }
  }
  return variables;
}

/** 跑一个主题的全部检查，返回失败项。 */
function checkTheme(
  variables: Map<string, string>,
  worstBackground: string
): { failures: string[]; checked: number } {
  const base = parseHex(worstBackground);
  if (!base) throw new Error(`无法解析最坏背景 ${worstBackground}`);
  const failures: string[] = [];
  let checked = 0;

  const check = (pair: ContrastPair): void => {
    const resolved = resolvePair(variables, pair.foreground, pair.background, base);
    if (!resolved) {
      failures.push(`${pair.name}：无法解析 ${pair.foreground} 或 ${pair.background}`);
      return;
    }
    const ratio = contrastRatio(resolved.foreground, resolved.background);
    checked += 1;
    if (ratio + 1e-6 < pair.minimum) {
      failures.push(`${pair.name}：${ratio.toFixed(2)}:1，低于 ${pair.minimum}:1`);
    }
  };

  for (const pair of TEXT_PAIRS) check(pair);
  for (const pair of GLASS_PAIRS) check(pair);
  for (const pair of GRADIENT_PAIRS) check(pair);

  const onAccent = resolvePair(variables, "--color-on-accent", "--color-accent", base);
  if (!onAccent) {
    failures.push("on-accent / accent：无法解析");
  } else {
    const ratio = contrastRatio(onAccent.foreground, onAccent.background);
    checked += 1;
    if (ratio < 4.5) failures.push(`on-accent / accent：${ratio.toFixed(2)}:1，低于 4.5:1`);
  }

  return { failures, checked };
}

/** 入口：读 `layout.css`，检查两个主题。 */
function main(): void {
  const css = readFileSync(CSS_PATH, "utf8");
  const themes = [
    { name: "星夜 / Macchiato", variables: themeVariables(css, "light"), worst: "#302b63" },
    { name: "深夜 / Mocha", variables: themeVariables(css, "dark"), worst: "#0a0a14" },
  ];
  let failed = false;
  for (const theme of themes) {
    const result = checkTheme(theme.variables, theme.worst);
    if (result.failures.length === 0) {
      console.log(`${theme.name}：${result.checked} 组通过`);
      continue;
    }
    failed = true;
    console.error(`${theme.name}：${result.failures.length} 组失败`);
    for (const failure of result.failures) console.error(`  ${failure}`);
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
