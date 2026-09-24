#!/usr/bin/env python3
"""检查中文文本的引号规范（GB/T 15834-2011）。

两档策略，按文件类型区分：

- Markdown（.md/.svx）：扫描直引号、全角无向引号与直角引号；frontmatter、
  围栏代码块、行内代码与 HTML 标签中的引号是语法，跳过。
- 代码与配置（其余受检类型）：只扫描直角引号与全角无向引号——它们在代码里
  几乎不可能是语法；ASCII 直引号在代码里是字符串与语法引号，不扫。
  （注释里的 ASCII 直引号无法与语法机械区分，留给人工约定。）

豁免：行内含 `cn-quotes-ignore` 的行跳过（用于字符映射表、测试断言等
“引号即数据”的场景），豁免与原因就近可见。

用法：
    python3 scripts/check-cn-quotes.py 文件 [更多文件 ...]
"""

import re
import sys

# Markdown 违规字符：直引号 U+0022/U+0027、全角无向引号 U+FF02、直角引号 U+300C-300F
_MD_BAD_QUOTES = re.compile("[\u0022\u0027\uFF02\u300C\u300D\u300E\u300F]")
# 代码与配置违规字符：只收全角无向引号与直角引号（ASCII 直引号是语法）
_CODE_BAD_QUOTES = re.compile("[\uFF02\u300C\u300D\u300E\u300F]")
_HTML_TAG = re.compile(r"<[^>]*>")
_INLINE_CODE = re.compile(r"`[^`]*`")
_IGNORE_MARKER = "cn-quotes-ignore"
_MARKDOWN_SUFFIXES = (".md", ".svx")


def check_file(path: str) -> int:
    markdown = path.endswith(_MARKDOWN_SUFFIXES)
    bad_quotes = _MD_BAD_QUOTES if markdown else _CODE_BAD_QUOTES
    in_code = False
    in_frontmatter = False
    violations = 0
    with open(path, encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            if _IGNORE_MARKER in line:
                continue
            if markdown:
                if in_frontmatter:
                    if line.rstrip("\n") == "---":
                        in_frontmatter = False
                    continue
                if i == 1 and line.rstrip("\n") == "---":
                    in_frontmatter = True
                    continue
                if re.match(r"^(```|~~~)", line):
                    in_code = not in_code
                    continue
                if in_code:
                    continue
                text = _INLINE_CODE.sub("", line)
                text = _HTML_TAG.sub("", text)
            else:
                text = line
            if bad_quotes.search(text):
                print(f"{path}:{i}: {line.rstrip()}")
                violations += 1
    return violations


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    total = sum(check_file(path) for path in sys.argv[1:])
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
