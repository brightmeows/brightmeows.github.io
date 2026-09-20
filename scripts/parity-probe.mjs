// 临时诊断脚本：在 CI 环境下验证新实现的 HTTP/2 路径能拿到 darksabun.club 的页面。
import { fetchTable, fetchText } from "./pipeline/fetch.ts";
import { extractBmstableUrlHint } from "./pipeline/meta.ts";

const urls = [
  "https://darksabun.club/bceg/event/1998to2020/",
  "https://darksabun.club/bceg/event/29respect/",
  "https://darksabun.club/table/archive/cemetery/",
  "https://stellabms.xyz/sl/table.html",
];

for (const url of urls) {
  try {
    const response = await fetchText(url);
    const hint = extractBmstableUrlHint(response.text);
    console.log(
      `fetchText ${url} bytes=${response.text.length} hint=${hint === null ? "无" : hint.slice(0, 60)}`
    );
    const table = await fetchTable({ name: "", symbol: "", url, extra: {} });
    console.log(`  fetchTable charts=${table.data.length} header=${String(table.header.name)}`);
  } catch (error) {
    console.log(`fetchText ${url} ERROR ${error.message}`);
  }
}
