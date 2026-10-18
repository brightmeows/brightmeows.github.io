/**
 * 导出函数 JSDoc 覆盖校验：把“导出契约没有文档”挡在提交之外。
 *
 * 范围：`src/`、`packages/`、`scripts/` 下的非测试 `.ts`。`.svelte` 组件
 * 脚本豁免（props 接口与模板自解释）；`*.test.ts` 豁免（测试名即文档）；
 * `*.d.ts` 与 paraglide 生成物（`src/lib/paraglide/`）不参与。
 *
 * 检查的声明形态（顶层导出）：
 * - `export [async] function[*] <name>`
 * - `export const <name>[: T] = [async] function / (…) =>`
 *
 * 判定：声明节点的前导文本里存在最近的 `/** *\/` 块，且剥掉装饰星号与
 * tag 行（`@param` 等）后有非空描述——只查存在会让空注释合规，文档必须
 * 真的写了一句话。
 *
 * 核心为纯函数（输入为源码文本），便于单测。纯读、不联网、毫秒级，
 * 进 pre-commit 与 CI。用法：`node scripts/check-jsdoc.ts`
 * oxlint 原生实现 `jsdoc/require-jsdoc` 后退役换规则
 * （触发条件见根 `AGENTS.md` 的“依赖升级挂起项”）。
 */

import { readFileSync, readdirSync } from "node:fs";

import ts from "typescript";

const ROOTS = ["src", "packages", "scripts"];
/** 生成物与依赖目录，不参与扫描。 */
const SKIPPED_DIRS = new Set(["node_modules", ".svelte-kit", "dist", "build", "paraglide"]);
const SKIPPED_FILES = /\.test\.ts$|\.d\.ts$/;

export interface MissingDoc {
  file: string;
  name: string;
  line: number;
}

/** 取前导文本里最近的 JSDoc 块的可读描述（无 JSDoc 或只有 tag 则 null）。 */
export function docSummary(fullText: string): string | null {
  const match = /\/\*\*([\s\S]*?)\*\/\s*$/.exec(fullText);
  const body = match?.[1];
  if (body === undefined) return null;
  const lines = body
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("@"));
  return lines[0] ?? null;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** 声明节点的纯前导文本（JSDoc 与其他 trivia；getFullText 含节点自身，需按 getStart 切）。 */
function leadingText(node: ts.Node, sf: ts.SourceFile): string {
  return node.getFullText(sf).slice(0, node.getStart(sf) - node.getFullStart());
}

function missingDoc(file: string, sf: ts.SourceFile, name: string, node: ts.Node): MissingDoc {
  return {
    file,
    name,
    line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
  };
}

/** 单文件缺失清单。文件名仅用于诊断输出，解析不触盘。 */
export function findMissingDocs(file: string, source: string): MissingDoc[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const missing: MissingDoc[] = [];
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (!hasExportModifier(statement) || !statement.name) continue;
      if (docSummary(leadingText(statement, sf)) === null) {
        missing.push(missingDoc(file, sf, statement.name.text, statement));
      }
      continue;
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      // JSDoc 附着在语句级，多个声明共享同一份文档；decl 自身的前导不含它
      const documented = docSummary(leadingText(statement, sf)) !== null;
      if (documented) continue;
      for (const decl of statement.declarationList.declarations) {
        const init = decl.initializer;
        if (!init) continue;
        if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;
        missing.push(missingDoc(file, sf, decl.name.getText(), decl));
      }
    }
  }
  return missing;
}

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      yield* walkFiles(rel);
    } else if (entry.isFile() && rel.endsWith(".ts") && !SKIPPED_FILES.test(rel)) {
      yield rel;
    }
  }
}

function main(): void {
  const files = ROOTS.flatMap((root) => [...walkFiles(root)]);
  const issues = files.flatMap((file) => findMissingDocs(file, readFileSync(file, "utf8")));
  if (issues.length > 0) {
    console.error(`导出函数 JSDoc 覆盖校验失败（${issues.length} 处）：`);
    for (const issue of issues) {
      console.error(`  ${issue.file}:${issue.line}  缺少 JSDoc：${issue.name}`);
    }
    process.exit(1);
  }
  console.log(`导出函数 JSDoc 覆盖校验通过（扫描 ${files.length} 个文件）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
