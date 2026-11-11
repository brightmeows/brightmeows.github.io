#!/usr/bin/env python3
"""按钮与链接令牌纪律扫描：src 下 .svelte 的交互控件不得写裸样式指纹。

按钮、筛选 chip 一律用 ui-classes 令牌（src/lib/constants/ui-classes.ts），
行内主链接用 linkInline、正文强调链用 layout.css 的 link-accent。本扫描只
拦“绕过令牌手写皮肤”的指纹，不拦令牌引用（花括号插值）与纯布局工具类：

- button/label 元素：class 串里 cursor-pointer 配圆角工具类（rounded-md、
  rounded-lg、rounded-xl、rounded-2xl、rounded-glass-*；rounded-full 圆形
  形态豁免），或同时出现 border-white-* 与 bg-white-*/bg-black-*（chip 皮）。
- a 元素：class 串裸用 text-accent（含 hover: 前缀）——accent 链接只有
  linkInline 令牌与 link-accent 全局类两个入口。

豁免：src/lib/components/ui/ 下的原语组件（视觉形态定义本体）、行内含
ui-tokens-ignore（新增豁免先想能否直接换令牌）。文件列表来自 argv（xargs
传入）或 NUL 分隔的 stdin；受检范围（仅 .svelte）在 package.json 的 check:ui。
"""

import os
import re
import sys

OPENERS = re.compile(r"<(button|label|a)\b")
CLASS_ATTRS = re.compile(r'class="([^"]*)"')

RADIUS_FRAGMENTS = (
    "rounded-md",
    "rounded-lg",
    "rounded-xl",
    "rounded-2xl",
    "rounded-glass-",
)


def strip_line_numbers(content: str, offset: int) -> int:
    return content.count("\n", 0, offset) + 1


def enclosing_element(content: str, position: int) -> str | None:
    """返回包住该 class 属性的元素名；开标签与属性之间不得跨越“>”。"""
    best: str | None = None
    for match in OPENERS.finditer(content, 0, position):
        between = content[match.end() : position]
        if ">" in between or "<" in between:
            continue
        best = match.group(1)
    return best


def check_file(path: str) -> list[str]:
    with open(path, encoding="utf-8") as fh:
        content = fh.read()
    failed: list[str] = []
    for match in CLASS_ATTRS.finditer(content):
        segment = content[match.start() - 60 : match.start() + 20]
        if "ui-tokens-ignore" in segment or "ui-tokens-ignore" in match.group(1):
            continue
        element = enclosing_element(content, match.start())
        if element is None:
            continue
        cls = match.group(1)
        lineno = strip_line_numbers(content, match.start())
        if element in ("button", "label") and "cursor-pointer" in cls:
            radius = any(fragment in cls for fragment in RADIUS_FRAGMENTS)
            surface = "border-white-" in cls and ("bg-white-" in cls or "bg-black-" in cls)
            if radius or surface:
                failed.append(
                    f"{path}:{lineno}: button/label 手写皮肤指纹，请改用 ui-classes 令牌"
                )
        elif element == "a" and "text-accent" in cls:
            failed.append(
                f"{path}:{lineno}: a 元素裸用 text-accent，行内主链接用 linkInline、正文强调链用 link-accent"
            )
    return failed


def main() -> int:
    paths = sys.argv[1:]
    if not paths:
        paths = [raw.decode() for raw in sys.stdin.buffer.read().split(b"\0") if raw]
    failed: list[str] = []
    for path in paths:
        if not path.endswith(".svelte"):
            continue
        normalized = path.replace(os.sep, "/")
        if "/components/ui/" in normalized:
            continue
        failed.extend(check_file(path))
    if failed:
        print(
            "UI 模板发现绕过令牌的按钮/链接样式，请改用 ui-classes 令牌：",
            file=sys.stderr,
        )
        for item in failed:
            print(f"  {item}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
