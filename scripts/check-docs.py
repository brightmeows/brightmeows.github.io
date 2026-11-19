#!/usr/bin/env python3
"""AGENTS.md 反引号引用存在性校验：路径、pnpm 命令、符号名三类断链拦截。

文档复述环境可查的内容会随环境过期（见根 AGENTS.md 文档约定的维护
规则），反引号里写下的引用则必须真实存在。本扫描拦三类断链：

- 路径：行内反引号中含 ``/`` 的串按仓库根相对路径解析，文件或目录
  必须存在；解析失败再按文档所在目录解析一次（包内文档的相对路径
  惯例）；`#lib/*`、`#posts/*` 按根 package.json 的 imports、`$lib/*`
  按 SvelteKit 默认别名映射后解析。刻意排除：``/`` 开头（站内路由
  与 URL）、``./``（模块说明符）、``.`` 开头的环境与约定目录（除
  `.github/`）、``node_modules/``、``<`` ``>`` ``[`` ``]``（模板占位
  与路由目录名）、``*``（glob）、``{`` ``}``（brace 展开形态）、
  空格、冒号与引号（命令、URL 与常量值形态）、``--`` 开头（flag 与 CSS 变量）、
  ``@`` 开头（workspace 包导出，属接口语义）、``#`` 开头的锚点与消
  息 key、外部命名空间名（linter 规则、GitHub Actions，见
  EXTERNAL_NS）。
- pnpm 命令：`pnpm <name>` 的 name 必须是根 package.json 的 script
  或 pnpm 内置命令。
- 符号：UPPER_SNAKE_CASE（至少含一段下划线，全大写数字）必须在
  src/、packages/、scripts/、config/ 中以固定串搜到；纯大写无下划线
  的通用缩写（JSON、SSG 等）不是符号名，不检。

围栏代码块内不检。行内含 check-docs-ignore 豁免单行（新增豁免先想
能否直接修正引用）。文件列表来自 argv（xargs 传入）或 NUL 分隔的
stdin；受检范围（AGENTS.md）在 package.json 的 check:docs。
"""

import json
import os
import re
import subprocess
import sys

INLINE_CODE = re.compile(r"`([^`]+)`")
FENCES = re.compile(r"```.*?```", re.DOTALL)
SYMBOL = re.compile(r"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+")

EXTERNAL_NS = {
    "svelte", "unicorn", "eslint", "typescript", "import", "security",
    "node", "promise", "react", "oxc", "oxlint", "pnpm", "actions", "jsdoc",
}

ALIAS_LIB = {"#lib/": "src/lib/", "#posts/": "content/posts/", "$lib/": "src/lib/"}

SYMBOL_DIRS = ("src", "packages", "scripts", "config", ".github")


def is_pathlike(span: str) -> bool:
    """含 ``/`` 且形态是仓库内路径的串；外部命名与环境约定目录不算。"""
    if "/" not in span:
        return False
    if span.startswith(("/", "./", "node_modules/")):
        return False
    if span.startswith(".") and not span.startswith(".github/"):
        return False
    if any(ch in span for ch in "<>*{}=?&:[] \t\"'"):
        return False
    if span.startswith(("--", "@", "#")):
        return False
    return span.split("/", 1)[0] not in EXTERNAL_NS

PNPM_BUILTINS = {
    "add", "audit", "ci", "create", "dedupe", "dlx", "exec", "import",
    "init", "install", "link", "list", "outdated", "pack", "patches",
    "prune", "publish", "rebuild", "recursive", "remove", "restart",
    "root", "run", "store", "test", "unlink", "update", "upgrade",
    "why", "workspaces",
}

def load_scripts(repo_root: str) -> set[str]:
    with open(os.path.join(repo_root, "package.json"), encoding="utf-8") as fp:
        return set(json.load(fp).get("scripts", {}))


def resolve_span(span: str) -> str | None:
    """反引号串按别名映射解析为仓库根相对路径；非路径形态返回 None。"""
    if not is_pathlike(span):
        return None
    for prefix, base in ALIAS_LIB.items():
        if span.startswith(prefix):
            return base + span[len(prefix):]
    return span


def symbol_exists(name: str, repo_root: str) -> bool:
    result = subprocess.run(
        ["rg", "--hidden", "-g", "!*.md", "-F", "-l", name, *SYMBOL_DIRS],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def check_file(path: str, repo_root: str, scripts: set[str]) -> list[str]:
    with open(path, encoding="utf-8") as fp:
        content = fp.read()
    content = FENCES.sub("", content)
    failed: list[str] = []
    for line_number, line in enumerate(content.splitlines(), 1):
        if "check-docs-ignore" in line:
            continue
        for span in INLINE_CODE.findall(line):
            resolved = resolve_span(span)
            if resolved is not None:
                candidates = (
                    os.path.join(repo_root, resolved),
                    # 包内文档的相对路径按文档所在目录再解析一次
                    os.path.join(repo_root, os.path.dirname(path), resolved),
                )
                if not any(os.path.exists(candidate) for candidate in candidates):
                    failed.append(f"{path}:{line_number} 路径不存在: `{span}`")
                continue
            if span.startswith("pnpm "):
                name = span.split()[1]
                if name not in scripts and name not in PNPM_BUILTINS:
                    failed.append(f"{path}:{line_number} 未知 pnpm 命令: `{span}`")
                continue
            for match in SYMBOL.findall(span):
                if not symbol_exists(match, repo_root):
                    failed.append(f"{path}:{line_number} 符号不存在: `{match}`")
    return failed


def read_files() -> list[str]:
    data = sys.stdin.buffer.read() if sys.stdin.isatty() is False else b""
    if not data and len(sys.argv) > 1:
        return sys.argv[1:]
    if not data:
        return []
    return [item for item in data.decode("utf-8").split("\0") if item]


def main() -> int:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scripts = load_scripts(repo_root)
    paths = read_files()
    failed: list[str] = []
    for path in paths:
        failed.extend(check_file(path, repo_root, scripts))
    if failed:
        print(
            "AGENTS.md 存在断链引用（路径/pnpm 命令/符号），请修正或下沉：",
            file=sys.stderr,
        )
        for item in failed:
            print(f"  {item}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
