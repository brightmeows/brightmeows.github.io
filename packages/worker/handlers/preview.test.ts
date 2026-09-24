/**
 * 预览的 header 地址提取。
 *
 * 这是 worker 里少见的纯函数：给定页面文本与地址，返回可用的 header URL。它此前
 * 没有测试覆盖，借分层重构补上——提取逻辑有四种来源（JSON、两种 meta 写法、
 * header 文件名兜底），任一分支回归都只会在预览时表现为“找不到 header”。
 */

import { describe, expect, it } from "vitest";

import { extractHeaderUrl } from "./preview.ts";

const PAGE = "https://example.com/table/index.html";

describe("extractHeaderUrl", () => {
  it("页面本身就是 header JSON 时返回页面地址", () => {
    const text = JSON.stringify({ data_url: "https://example.com/data.json", name: "表" });
    expect(extractHeaderUrl(text, PAGE)).toBe(PAGE);
  });

  it("识别 bmstable meta（name 在 content 之前）", () => {
    const text = `<html><head><meta name="bmstable" content="head.json"></head></html>`;
    expect(extractHeaderUrl(text, PAGE)).toBe("https://example.com/table/head.json");
  });

  it("识别 bmstable meta（content 在 name 之前）", () => {
    const text = `<html><head><meta content="/tables/head.json" property="bmstable"></head></html>`;
    expect(extractHeaderUrl(text, PAGE)).toBe("https://example.com/tables/head.json");
  });

  it("meta 写法任意大小写都能识别", () => {
    const text = `<meta NAME="Bmstable" CONTENT="Head.json">`;
    expect(extractHeaderUrl(text, PAGE)).toBe("https://example.com/table/Head.json");
  });

  it("回退到页面里出现的 header*.json 字样", () => {
    const text = `<script>const url = "sub/header_insane.json"; fetch(url);</script>`;
    expect(extractHeaderUrl(text, PAGE)).toBe("https://example.com/table/sub/header_insane.json");
  });

  it("以花括号开头但不是 JSON 时继续走 HTML 路径", () => {
    const text = `{ not json } <meta name="bmstable" content="head.json">`;
    expect(extractHeaderUrl(text, PAGE)).toBe("https://example.com/table/head.json");
  });

  it("四种来源都没有时返回 null", () => {
    expect(extractHeaderUrl("<html><body>没有提示</body></html>", PAGE)).toBeNull();
  });

  it("相对地址无法解析时返回 null（不抛异常）", () => {
    expect(extractHeaderUrl(`<meta name="bmstable" content="http://[">`, PAGE)).toBeNull();
  });
});
