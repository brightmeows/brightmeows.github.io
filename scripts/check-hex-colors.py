#!/usr/bin/env python3
"""语义色十六进制字面量扫描：src 下 .svelte/.ts 禁止裸写颜色 hex。

语义色与调色板色一律走令牌工具类、var(--color-*) 或 @theme 令牌；
layout.css 是唯一允许出现 hex 的源文件（@theme 变量与主题块集中在那
里），不在受检清单内。本扫描拦字符串与模板中的 #RRGGBB 与 #RRGGBBAA
字面量；三、四位 shorthand 刻意不拦（#feed/#bed 这类全 hex 英文词会撞
锚点串误报，取舍是只守设计常用的六与八位）：

- 行内含 color-literal-ignore 可豁免单行（新增豁免先想能否直接换令牌）。
- #lib 导入别名、#mirror-admin 锚点这类井号后跟非 hex 字符的串不构成
  #RRGGBB 形态，天然不命中。
- packages 的画布段位色板（levelSegmentColor）属领域计算色，不在 src
  受检范围内（范围界定见 package.json 的 check:colors）。

文件列表来自 argv（xargs 传入）或 NUL 分隔的 stdin。
"""

import re
import sys

# 六或八位 hex；负向断言排除锚点 slug 连字符（#facade-pattern 不命中）
HEX = re.compile(r"#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F-])")


def main() -> int:
    paths = sys.argv[1:]
    if not paths:
        paths = [raw.decode() for raw in sys.stdin.buffer.read().split(b"\0") if raw]
    failed: list[str] = []
    for path in paths:
        if not (path.endswith(".svelte") or path.endswith(".ts")):
            continue
        with open(path, encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                if "color-literal-ignore" in line:
                    continue
                if HEX.search(line):
                    failed.append(
                        f"{path}:{lineno}: 语义色十六进制字面量，"
                        "请改用令牌工具类、var(--color-*) 或 @theme"
                    )
    if failed:
        print(
            "发现绕过令牌的十六进制色值（唯一豁免源是 layout.css）：",
            file=sys.stderr,
        )
        for item in failed:
            print(f"  {item}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
