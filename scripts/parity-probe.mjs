// oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access
// 临时诊断脚本：对比不同客户端在 CI 环境下抓取同一批表页的结果。
// 用法：node scripts/parity-probe.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36 bms-table-rs";

const urls = [
  "https://darksabun.club/bceg/event/1998to2020/",
  "https://darksabun.club/bceg/event/29respect/",
  "https://darksabun.club/table/archive/cemetery/",
  "https://ladymade-star.github.io/Stella-Recommend/dp/hc/",
  "http://rattoto10.web.fc2.com/doukon/list_sample.html",
  "https://stellabms.xyz/sl/table.html",
];

function summarize(body) {
  const meta = /<meta[^>]*\bname\s*=\s*["']?bmstable/i.test(body);
  const title = /<title[^>]*>([\s\S]{0,80}?)<\/title>/i.exec(body);
  return `meta=${meta} title=${JSON.stringify(title?.[1]?.trim() ?? "")} head=${JSON.stringify(body.slice(0, 60))}`;
}

async function probeFetch(url, extraHeaders) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent": UA,
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    return `fetch status=${response.status} bytes=${body.length} ${summarize(body)}`;
  } catch (error) {
    return `fetch ERROR ${error.message} ${error.cause?.code ?? ""}`;
  }
}

async function probeCurl(url, args) {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sSL",
        "--max-time",
        "30",
        "-A",
        UA,
        "-H",
        "accept-language: zh-CN,zh;q=0.9,en;q=0.8",
        ...args,
        url,
      ],
      { maxBuffer: 20 * 1024 * 1024 }
    );
    return `curl(${args.join(" ")}) bytes=${stdout.length} ${summarize(stdout)}`;
  } catch (error) {
    return `curl(${args.join(" ")}) ERROR ${error.message}`;
  }
}

for (const url of urls) {
  console.log(`\n=== ${url}`);
  console.log("  a)", await probeFetch(url, {}));
  console.log(
    "  b)",
    await probeFetch(url, {
      "upgrade-insecure-requests": "1",
      connection: "keep-alive",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "accept-encoding": "gzip, deflate, br, zstd",
    })
  );
  console.log("  c)", await probeCurl(url, ["--http1.1"]));
  console.log("  d)", await probeCurl(url, ["--http2"]));
  console.log("  e)", await probeCurl(url, ["--http2", "-H", "upgrade-insecure-requests: 1"]));
}
