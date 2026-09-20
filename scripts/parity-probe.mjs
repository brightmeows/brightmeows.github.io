// oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access
// 临时诊断脚本：对比不同客户端在 CI 环境下抓取同一批表页的结果。
// 用法：node scripts/parity-probe.mjs
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import http2 from "node:http2";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36 bms-table-rs";

const urls = [
  "https://darksabun.club/bceg/event/1998to2020/",
  "https://darksabun.club/bceg/event/29respect/",
  "https://stellabms.xyz/sl/table.html",
];

function summarize(body) {
  const meta = /<meta[^>]*\bname\s*=\s*["']?bmstable/i.test(body);
  const title = /<title[^>]*>([\s\S]{0,60}?)<\/title>/i.exec(body);
  return `meta=${meta} title=${JSON.stringify(title?.[1]?.trim() ?? "")}`;
}

async function probeFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent": UA,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    return `fetch status=${response.status} bytes=${body.length} ${summarize(body)}`;
  } catch (error) {
    return `fetch ERROR ${error.message}`;
  }
}

function probeHttp2(url, extraHeaders) {
  return new Promise((resolve) => {
    try {
      const client = http2.connect(new URL(url).origin);
      client.setTimeout(30_000);
      const request = client.request({
        ":path": new URL(url).pathname + new URL(url).search,
        ":method": "GET",
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...extraHeaders,
      });
      let status = 0;
      let body = "";
      request.on("response", (headers) => {
        status = headers[":status"] ?? 0;
      });
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        client.close();
        resolve(`http2 status=${status} bytes=${body.length} ${summarize(body)}`);
      });
      request.on("error", (error) => {
        client.close();
        resolve(`http2 ERROR ${error.message}`);
      });
      request.end();
    } catch (error) {
      resolve(`http2 ERROR ${error.message}`);
    }
  });
}

async function probeOldBinary(root, tables) {
  const dir = `${root}/old-binary-probe`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(`${dir}/config`, { recursive: true });
  const binary = `${dir}/bms-table-fetch`;
  if (!existsSync(binary)) {
    const archive = `${dir}/tool.tar.xz`;
    const response = await fetch(
      "https://github.com/brightmeows/bms-table-fetch/releases/download/v0.4.2/bms-table-fetch-v0.4.2-linux-amd64.tar.xz"
    );
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    await execFileAsync("tar", ["-xJf", archive, "-C", dir]);
  }
  await writeFile(
    `${dir}/config/table.toml`,
    tables.map((url) => `[[table]]\nurl = "${url}"\n`).join("\n")
  );
  await writeFile(
    `${dir}/config/list.toml`,
    '[[source]]\nname = "probe"\nurl = "http://127.0.0.1:1/offline"\n'
  );
  try {
    const result = await execFileAsync(binary, [], { cwd: dir, maxBuffer: 32 * 1024 * 1024 });
    console.log("  old binary exit=0");
    void result;
  } catch (error) {
    console.log(`  old binary exit!=0 ${error.message}`);
  }
  const tableDirs = await readdir(`${dir}/tables`).catch(() => []);
  for (const name of tableDirs) {
    const header = await readFile(`${dir}/tables/${name}/header.json`, "utf8").catch(() => null);
    const data = await readFile(`${dir}/tables/${name}/data.json`, "utf8").catch(() => null);
    console.log(
      `  old ${name}: header=${header === null ? "缺失" : `${header.length}B`} data=${data === null ? "缺失" : `${data.length}B`}`
    );
  }
  const warnings = await readFile(`${dir}/warnings.log`, "utf8").catch(() => "");
  for (const line of warnings.split("\n").slice(-8)) {
    if (line.trim() !== "") {
      console.log(`  old warn: ${line.slice(0, 200)}`);
    }
  }
}

const darksabun = urls.filter((url) => url.includes("darksabun"));

console.log("=== old binary (同 IP，AWS-LC/rustls 客户端)");
await probeOldBinary("/tmp", darksabun);

for (const url of urls) {
  console.log(`\n=== ${url}`);
  console.log("  a)", await probeFetch(url));
  console.log("  b)", await probeHttp2(url, {}));
  console.log(
    "  c)",
    await probeHttp2(url, {
      "accept-encoding": "gzip, deflate, br, zstd",
      "upgrade-insecure-requests": "1",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "sec-ch-ua": '"Chromium";v="119", "Not?A_Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    })
  );
}
