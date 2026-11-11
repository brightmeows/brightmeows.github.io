#!/usr/bin/env python3
"""UI 模板图标纪律扫描：src 下 .svelte 不得用 emoji 与文本符号当图标。

图标一律走 @lucide/svelte 组件（stroke 线性画法）。禁用字符集为
emoji 主区（U+1F300 至 U+1FAFF）与历史上作为图标使用过的符号
（⏳ ⚠ ✓ ✕ ✗ ▶ ▼ ○）；文案层的排版箭头（→，U+2192）不在禁用集，
代码注释同样不受约束（本检查只扫 .svelte）。行内含 ui-icons-ignore
可豁免单行，新增豁免先想能否直接换 lucide。
"""

import sys

SINGLES = "⏳⚠✓✕✗▶▼○"


def is_banned(ch: str) -> bool:
    cp = ord(ch)
    if 0x1F300 <= cp <= 0x1FAFF:
        return True
    return ch in SINGLES


def main() -> int:
    failed: list[str] = []
    for raw in sys.stdin.buffer.read().split(b"\0"):
        if not raw:
            continue
        path = raw.decode()
        if not path.endswith(".svelte"):
            continue
        with open(path, encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                if "ui-icons-ignore" in line:
                    continue
                hits = sorted({ch for ch in line if is_banned(ch)})
                if hits:
                    shown = " ".join(f"{ch}(U+{ord(ch):04X})" for ch in hits)
                    failed.append(f"{path}:{lineno}: {shown}")
    if failed:
        print(
            "UI 模板发现 emoji/符号图标，请改用 @lucide/svelte 组件：",
            file=sys.stderr,
        )
        for item in failed:
            print(f"  {item}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
