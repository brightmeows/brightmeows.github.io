#!/usr/bin/env python3
"""校验 config/ 下 TOML 配置的语法与关键字段。

这些文件由数据管线（scripts/fetch-tables.ts）在 CI 中读取；如果语法或字段错误拖到 CI
才发现，反馈周期是 6 小时。本地与 PR 阶段直接校验，失败即报全部问题。

用法：
    python3 scripts/check-config-toml.py [目录，默认 config]
"""

import sys
import tomllib
from pathlib import Path

_MISSING = object()


def _fmt(value: object) -> str:
    return "<缺失>" if value is _MISSING else repr(value)


def _url_error(where: str, field: str, value: object) -> str:
    return f"{where}: {field} 必须是 http(s) URL，实际为 {_fmt(value)}"


def check_table_toml(path: Path, data: dict) -> list[str]:
    errors: list[str] = []

    known_sections = {"table", "disable", "replace"}
    for key in data:
        if key not in known_sections:
            errors.append(f"{path}: 未知段 [[{key}]]（仅支持 table/disable/replace）")

    for i, item in enumerate(data.get("table", []), 1):
        where = f"{path}: [[table]] #{i}"
        value = item.get("url", _MISSING)
        if not isinstance(value, str) or not value.startswith(("http://", "https://")):
            errors.append(_url_error(where, "url", value))
        for field in ("tag_order", "tag1", "tag2"):
            if field in item and not isinstance(item[field], str):
                errors.append(f"{where}: {field} 必须是字符串，实际为 {item[field]!r}")

    for i, item in enumerate(data.get("disable", []), 1):
        where = f"{path}: [[disable]] #{i}"
        value = item.get("url", _MISSING)
        if not isinstance(value, str) or not value.startswith(("http://", "https://")):
            errors.append(_url_error(where, "url", value))

    for i, item in enumerate(data.get("replace", []), 1):
        where = f"{path}: [[replace]] #{i}"
        for field in ("from", "to"):
            if not isinstance(item.get(field), str) or not item[field]:
                errors.append(f"{where}: {field} 必须是非空字符串，实际为 {_fmt(item.get(field, _MISSING))}")

    return errors


def check_list_toml(path: Path, data: dict) -> list[str]:
    errors: list[str] = []

    known_sections = {"source"}
    for key in data:
        if key not in known_sections:
            errors.append(f"{path}: 未知段 [[{key}]]（仅支持 source）")

    for i, item in enumerate(data.get("source", []), 1):
        where = f"{path}: [[source]] #{i}"
        name = item.get("name")
        if not isinstance(name, str) or not name:
            errors.append(f"{where}: name 必须是非空字符串，实际为 {name!r}")
        value = item.get("url", _MISSING)
        if not isinstance(value, str) or not value.startswith(("http://", "https://")):
            errors.append(_url_error(where, "url", value))

    return errors


def main() -> int:
    config_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("config")
    files = sorted(config_dir.glob("*.toml"))
    if not files:
        print(f"{config_dir}: 未找到 TOML 文件", file=sys.stderr)
        return 1

    errors: list[str] = []
    for path in files:
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as exc:
            errors.append(f"{path}: TOML 语法错误：{exc}")
            continue
        if path.name == "table.toml":
            errors += check_table_toml(path, data)
        elif path.name == "list.toml":
            errors += check_list_toml(path, data)

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print(f"TOML 校验通过：{', '.join(path.name for path in files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
