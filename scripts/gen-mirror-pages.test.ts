import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { MirrorTableItem } from "../src/lib/types/bms";

import {
  GENERATED_MARKER,
  planStubCleanup,
  readMirrorConfig,
  renderStub,
  runGeneration,
  serializeTableList,
  transformTableList,
} from "./gen-mirror-pages";

const tableA: MirrorTableItem = {
  name: "Alpha",
  symbol: "A",
  dir_name: "[a.example.com] Alpha",
  url: "http://a.example.com/table.html",
  tag1: "SP",
};
const tableB: MirrorTableItem = {
  name: "Beta",
  symbol: "B",
  dir_name: "[b.example.com] Beta",
  url: "http://b.example.com/table.html",
};

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "gen-mirror-pages-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("transformTableList", () => {
  it("保留原字段，写入 url_from 与镜像页绝对 URL", () => {
    const [item] = transformTableList([tableA], "https://site.test");
    expect(item.url_from).toBe("http://a.example.com/table.html");
    expect(item.dir_name).toBe("[a.example.com] Alpha");
    expect(item.url).toBe("https://site.test/bms/table/mirror/%5Ba.example.com%5D%20Alpha/");
    expect(item.tag1).toBe("SP");
  });

  it("缺少 dir_name 时失败", () => {
    expect(() => transformTableList([{ name: "no-dir", url: "u" }], "https://site.test")).toThrow(
      /dir_name/
    );
  });
});

describe("renderStub", () => {
  const headerUrl = "https://r2.test/tables/%5Ba.example.com%5D%20Alpha/header.json";

  it("包含 bmstable meta、生成标记与 viewer 跳转", () => {
    const stub = renderStub(tableA.dir_name!, headerUrl);
    expect(stub).toContain(`<meta name="bmstable" content="${headerUrl}" />`);
    expect(stub).toContain(GENERATED_MARKER);
    expect(stub).toContain(
      'location.replace("/bms/table/mirror/view/?t=%5Ba.example.com%5D%20Alpha");'
    );
  });

  it("相同输入产生相同字节", () => {
    const first = renderStub(tableA.dir_name!, headerUrl);
    const second = renderStub(tableA.dir_name!, headerUrl);
    expect(first).toBe(second);
  });

  it("表 ID 中的脚本结束序列被百分号编码，无法中断脚本上下文", () => {
    const stub = renderStub("x</script><script>alert(1)</script>", headerUrl);
    expect(stub).not.toContain("x</script>");
    expect(stub).toContain("x%3C%2Fscript%3E");
  });
});

describe("planStubCleanup", () => {
  it("只清理带生成标记的过期目录", () => {
    const result = planStubCleanup(
      [
        { name: "keep", generated: true },
        { name: "stale", generated: true },
        { name: "manual", generated: false },
      ],
      ["keep"]
    );
    expect(result.stale).toEqual(["stale"]);
    expect(result.skipped).toEqual(["manual"]);
  });
});

describe("readMirrorConfig", () => {
  it("读取并去除基址尾部斜杠", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "mirror.json");
    writeFileSync(
      configPath,
      JSON.stringify({ r2Base: "https://r2.test/", siteBase: "https://site.test/" })
    );
    expect(readMirrorConfig(configPath)).toEqual({
      r2Base: "https://r2.test",
      siteBase: "https://site.test",
    });
  });

  it("非法基址失败", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "mirror.json");
    writeFileSync(configPath, JSON.stringify({ r2Base: "ftp://r2.test", siteBase: "https://s" }));
    expect(() => readMirrorConfig(configPath)).toThrow(/r2Base/);
  });
});

describe("runGeneration", () => {
  function fixture(list: MirrorTableItem[]): {
    inputPath: string;
    mirrorDir: string;
    run: (options?: { check?: boolean }) => ReturnType<typeof runGeneration>;
  } {
    const root = makeTempDir();
    const inputPath = path.join(root, "tables.json");
    const mirrorDir = path.join(root, "mirror");
    writeFileSync(inputPath, JSON.stringify(list));
    return {
      inputPath,
      mirrorDir,
      run: (options) =>
        runGeneration({
          inputPath,
          mirrorDir,
          r2Base: "https://r2.test",
          siteBase: "https://site.test",
          check: options?.check,
        }),
    };
  }

  it("首次生成 stub 与站点清单，重复运行无变更", () => {
    const { mirrorDir, run } = fixture([tableA, tableB]);
    const first = run();
    expect(first.changed).toEqual([
      "[a.example.com] Alpha/index.html",
      "[b.example.com] Beta/index.html",
      "tables.json",
    ]);
    const stub = readFileSync(path.join(mirrorDir, "[a.example.com] Alpha", "index.html"), "utf8");
    expect(stub).toContain("https://r2.test/tables/%5Ba.example.com%5D%20Alpha/header.json");
    const second = run();
    expect(second.changed).toEqual([]);
  });

  it("清理过期 stub 并保留非生成目录", () => {
    const { mirrorDir, inputPath, run } = fixture([tableA, tableB]);
    run();
    mkdirSync(path.join(mirrorDir, "manual-dir"));
    writeFileSync(path.join(mirrorDir, "manual-dir", "index.html"), "<html></html>");
    writeFileSync(inputPath, JSON.stringify([tableA]));
    const result = run();
    expect(result.changed).toEqual(["[b.example.com] Beta/", "tables.json"]);
    expect(result.skipped).toEqual(["manual-dir"]);
    expect(readFileSync(path.join(mirrorDir, "manual-dir", "index.html"), "utf8")).toBe(
      "<html></html>"
    );
    expect(() =>
      readFileSync(path.join(mirrorDir, "[b.example.com] Beta", "index.html"))
    ).toThrow();
  });

  it("检查模式不写入且报告待应用变更", () => {
    const { mirrorDir, run } = fixture([tableA]);
    const result = run({ check: true });
    expect(result.changed).toContain("tables.json");
    expect(() => readFileSync(path.join(mirrorDir, "tables.json"), "utf8")).toThrow();
  });

  it("站点清单稳定序列化", () => {
    const list = transformTableList([tableA, tableB], "https://site.test");
    expect(serializeTableList(list)).toBe(`${JSON.stringify(list, null, 2)}\n`);
    expect(serializeTableList(list)).toBe(serializeTableList(list));
  });
});
