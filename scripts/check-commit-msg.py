#!/usr/bin/env python3
"""校验提交信息符合 Conventional Commits（约定见 AGENTS.md「提交格式」）。

pre-commit 以 commit-msg stage 调用，参数为提交信息文件路径；
CI 对 PR 中的每个提交调用同一脚本。

用法：
    python3 scripts/check-commit-msg.py .git/COMMIT_EDITMSG
"""

import re
import sys

_TYPES = "build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test"
_PATTERN = re.compile(rf"^({_TYPES})(\([a-z0-9][a-z0-9-]*\))?!?: .+")
_SKIP = re.compile(r"^(Merge |Revert |fixup! |squash! )")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    with open(sys.argv[1], encoding="utf-8") as fh:
        message = fh.read()

    subject = ""
    for line in message.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        subject = stripped
        break

    if not subject:
        print("提交信息为空", file=sys.stderr)
        return 1
    if _SKIP.match(subject):
        return 0
    if not _PATTERN.match(subject):
        print("提交信息不符合 Conventional Commits 格式：", file=sys.stderr)
        print(f"  {subject}", file=sys.stderr)
        print(file=sys.stderr)
        print("期望：type(scope)!: subject", file=sys.stderr)
        print(f"type 取值：{_TYPES.replace('|', ' ')}", file=sys.stderr)
        print("scope 为小写 kebab-case（可省略），! 表示破坏性变更，subject 用祈使句", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
