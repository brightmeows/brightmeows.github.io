/**
 * i18n 覆盖校验：把“漏译 / 漏抽 / 死 key”机械挡在提交之外。
 *
 * 六条断言，前五条的核心均为纯函数（输入为文本），便于单测：
 * 1. `messages/en.json` 与 `messages/zh-cn.json` 的 key 集合对称
 * 2. 同一 key 的占位符集合（`{name}`）两语一致
 * 3. 源码引用的消息 key（src 下 `m["key"]`，Worker 下 `code: "key"`）
 *    必须存在于两份 messages；Worker 的 code 必须落在 `api.` 命名空间
 * 4. 声明了却无人引用的 key 视为死 key（改名后旧条目不清理会漏出来）
 * 5. src 下用户可见文本不得残留中日韩字符——注释、测试、console 输出、
 *    豁免清单（见 `EXEMPT_FILES` 与行级规则）除外
 * 6. `messages/en.json` 的值不得含中日韩字符（漏翻的中文值在这里落网）
 *
 * 豁免口径（与“注释/测试非内容、领域术语照搬、博客正文不翻”的决策一致）：
 * - `src/lib/constants/bms.ts`：LR2 领域约束标签（日文原词，数据级术语）
 * - `src/lib/loaders/blog-metadata.ts`：构建期 frontmatter 诊断（仅开发者可见）
 * - `src/routes/bms/index.zh.md`：按 locale 选用的中文版双份源
 * - 行内含 `i18n-exempt` 标记：临时豁免逃生口
 *
 * 纯读、不联网、毫秒级，进 pre-commit 与 CI。用法：`node scripts/check-i18n-coverage.ts`
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** 中日韩字符（表意文字 + 假名 + 谚文 + CJK 符号区）。
 *  必须带 `u` 标志：无 `u` 时按 UTF-16 码元匹配，范围端点比较会误伤 emoji。 */
const CJK_PATTERN = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/u;
/** 消息 key 引用：`m["key"]` 与 breadcrumbs 的 `m[mapped as "key"]`。 */
const MESSAGE_REF_PATTERN = /m\[\s*(?:mapped as\s*)?"([a-z][a-z0-9_.]*)"\s*\]/g;
/** 占位符：`{name}`。 */
const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_]*)\}/g;
/** Worker 错误码：`code: "api.xxx"`。 */
const WORKER_CODE_PATTERN = /code:\s*"([a-z][a-z0-9_.]*)"/g;

/** 按路径（正则）整体豁免 CJK 扫描的文件。 */
const EXEMPT_FILES: RegExp[] = [
  /^src\/lib\/constants\/bms\.ts$/,
  /^src\/lib\/loaders\/blog-metadata\.ts$/,
  /^src\/routes\/bms\/index\.zh\.md$/,
  // 仓库文档与测试本就是中文/数据现场，非访客可见内容
  /(^|\/)AGENTS\.md$/,
  /\.test\.(ts|js|svelte)$/,
];
/** 参与 CJK 扫描的扩展名。 */
const SCANNED_EXTENSIONS = new Set([".ts", ".svelte", ".js", ".md"]);

export type Messages = Record<string, string>;

export function parseMessages(text: string): Messages {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("messages JSON 必须是对象");
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") throw new Error(`消息 ${key} 的值必须是字符串`);
  }
  return data as Messages;
}

/** 断言 1：两语 key 集合对称。 */
export function keyParityIssues(en: Messages, zh: Messages): string[] {
  const enKeys = new Set(Object.keys(en));
  const zhKeys = new Set(Object.keys(zh));
  const issues: string[] = [];
  for (const key of zhKeys) {
    if (!enKeys.has(key)) issues.push(`en.json 缺少 key：${key}`);
  }
  for (const key of enKeys) {
    if (!zhKeys.has(key)) issues.push(`zh-cn.json 缺少 key：${key}`);
  }
  return issues;
}

export function placeholders(message: string): Set<string> {
  return new Set([...message.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] ?? ""));
}

/** 断言 2：同一 key 的占位符两语一致。 */
export function placeholderIssues(en: Messages, zh: Messages): string[] {
  const issues: string[] = [];
  for (const [key, enValue] of Object.entries(en)) {
    const zhValue = zh[key];
    if (zhValue === undefined) continue;
    const enSet = placeholders(enValue);
    const zhSet = placeholders(zhValue);
    const missing = [...zhSet].filter((name) => !enSet.has(name));
    const extra = [...enSet].filter((name) => !zhSet.has(name));
    if (missing.length > 0 || extra.length > 0) {
      issues.push(`占位符不一致 ${key}：en={${[...enSet].join(",")}} zh={${[...zhSet].join(",")}}`);
    }
  }
  return issues;
}

/** 从源码文本收集 `m["key"]` 引用。 */
export function collectMessageRefs(text: string): string[] {
  return [...text.matchAll(MESSAGE_REF_PATTERN)].map((match) => match[1] ?? "");
}

/** 从 Worker 源码收集 `code: "key"`。 */
export function collectWorkerCodes(text: string): string[] {
  return [...text.matchAll(WORKER_CODE_PATTERN)].map((match) => match[1] ?? "");
}

/** 断言 3：引用的 key 存在；Worker code 落在 api. 命名空间。 */
export function refIssues(refs: string[], messages: Messages): string[] {
  return refs
    .filter((key) => !(key in messages))
    .map((key) => `源码引用了 messages 中不存在的 key：${key}`);
}

export function workerCodeIssues(codes: string[], messages: Messages): string[] {
  const issues: string[] = [];
  for (const code of codes) {
    if (!code.startsWith("api.")) {
      issues.push(`Worker 错误码不在 api. 命名空间：${code}`);
      continue;
    }
    if (!(code in messages)) {
      issues.push(`Worker 错误码缺少消息条目：${code}`);
    }
  }
  return issues;
}

/** 断言 4：声明却无人引用的死 key。 */
export function deadKeyIssues(messages: Messages, refs: string[]): string[] {
  const used = new Set(refs);
  return Object.keys(messages)
    .filter((key) => !used.has(key))
    .map((key) => `messages 中声明但源码未引用（死 key）：${key}`);
}

/** 行级豁免：注释（整行与行内）、console 输出、i18n-exempt 标记。 */
export function isExemptLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return true;
  if (trimmed.startsWith("<!--")) return true;
  if (trimmed.includes("console.")) return true;
  if (trimmed.includes("i18n-exempt")) return true;
  return false;
}

/** 剥离行内 `//` 注释（要求前置空白，避免命中 URL 的 `//`）。 */
export function stripLineComment(line: string): string {
  const index = line.search(/\s\/\//);
  return index === -1 ? line : line.slice(0, index);
}

/** 断言 5：文本中的 CJK 残留（带行号）。 */
export function cjkLineIssues(relPath: string, text: string): string[] {
  if (EXEMPT_FILES.some((pattern) => pattern.test(relPath))) return [];
  const issues: string[] = [];
  text.split("\n").forEach((line, index) => {
    if (isExemptLine(line)) return;
    if (CJK_PATTERN.test(stripLineComment(line))) {
      issues.push(`${relPath}:${index + 1} 用户可见文本残留中日韩字符：${line.trim()}`);
    }
  });
  return issues;
}

/** 断言 6：英文值不含中日韩字符（漏翻值落网）。 */
export function enValueIssues(en: Messages): string[] {
  return Object.entries(en)
    .filter(([, value]) => CJK_PATTERN.test(value))
    .map(([key]) => `en.json 值残留中日韩字符（未翻译？）：${key}`);
}

/** 递归收集待扫描文件（路径相对仓库根）。 */
export function walkFiles(repoRoot: string, scanDir: string, extensions: Set<string>): string[] {
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".svelte-kit" || entry === "paraglide") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (extensions.has(path.extname(entry))) {
        results.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(scanDir);
  return results.sort();
}

function main(): void {
  const root = process.cwd();
  const en = parseMessages(readFileSync(path.join(root, "messages/en.json"), "utf8"));
  const zh = parseMessages(readFileSync(path.join(root, "messages/zh-cn.json"), "utf8"));

  const srcFiles = walkFiles(root, path.join(root, "src"), SCANNED_EXTENSIONS);
  const workerFiles = walkFiles(root, path.join(root, "packages/worker"), new Set([".ts"]));

  const srcTexts = srcFiles.map(
    (rel) => [rel, readFileSync(path.join(root, rel), "utf8")] as const
  );
  const workerTexts = workerFiles.map(
    (rel) => [rel, readFileSync(path.join(root, rel), "utf8")] as const
  );

  const refs = srcTexts.flatMap(([, text]) => collectMessageRefs(text));
  const workerCodes = workerTexts.flatMap(([, text]) => collectWorkerCodes(text));

  const issues = [
    ...keyParityIssues(en, zh),
    ...placeholderIssues(en, zh),
    ...refIssues(refs, en),
    ...refIssues([...refs, ...workerCodes], zh),
    ...workerCodeIssues(workerCodes, en),
    ...deadKeyIssues(en, [...refs, ...workerCodes]),
    ...srcTexts.flatMap(([rel, text]) => cjkLineIssues(rel, text)),
    ...enValueIssues(en),
  ];

  if (issues.length > 0) {
    console.error(`i18n 覆盖校验失败（${issues.length} 处）：`);
    for (const issue of issues) console.error(`  ${issue}`);
    process.exit(1);
  }
  console.log(
    `i18n 覆盖校验通过（${Object.keys(en).length} 个 key，扫描 ${srcFiles.length} 个源文件）`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
