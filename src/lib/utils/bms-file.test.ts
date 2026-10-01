import { describe, expect, it } from "vitest";

import {
  bmsTextToFields,
  bmsonTextToFields,
  decodeBmsBytes,
  fieldsToEntry,
  isBmsFileName,
} from "./bms-file";

describe("isBmsFileName", () => {
  it("accepts the BMS family extensions case-insensitively", () => {
    for (const name of ["a.bms", "a.BME", "x.bml", "p.pms", "song.BMSON"]) {
      expect(isBmsFileName(name)).toBe(true);
    }
    for (const name of ["a.txt", "a.json", "a.bms.bak", "bmse"]) {
      expect(isBmsFileName(name)).toBe(false);
    }
  });
});

describe("decodeBmsBytes", () => {
  it("detects BOMs", () => {
    const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
    expect(decodeBmsBytes(utf8Bom)).toEqual({ text: "A", encoding: "utf-8" });
    const utf16le = new Uint8Array([0xff, 0xfe, 0x41, 0x00]);
    expect(decodeBmsBytes(utf16le)).toEqual({ text: "A", encoding: "utf-16le" });
    const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x41]);
    expect(decodeBmsBytes(utf16be)).toEqual({ text: "A", encoding: "utf-16be" });
  });

  it("falls back to Shift_JIS for non-UTF-8 bytes", () => {
    // "あ" 在 Shift_JIS 中是 0x82 0xA0（非法 UTF-8）
    const sjis = new Uint8Array([0x82, 0xa0]);
    expect(decodeBmsBytes(sjis)).toEqual({ text: "あ", encoding: "shift_jis" });
    const ascii = new TextEncoder().encode("#TITLE A");
    expect(decodeBmsBytes(ascii)).toEqual({ text: "#TITLE A", encoding: "utf-8" });
  });
});

describe("bmsTextToFields", () => {
  it("reads header commands case-insensitively with tabs and extra spaces", () => {
    const text = [
      "#TITLE First",
      "this is a comment line",
      "#title  Second  ",
      "#SUBTITLE\t[ANOTHER]",
      "#ARTIST  someone ",
      "#PLAYLEVEL 安心",
      "#TOTAL 480.5",
      '#COMMENT "hello world"',
      "%URL http://example.com/chart",
      "#00111:0011",
      "#DIFFICULTY 5",
    ].join("\r\n");
    const fields = bmsTextToFields(text);
    expect(fields.title).toBe("Second");
    expect(fields.subtitle).toBe("[ANOTHER]");
    expect(fields.artist).toBe("someone");
    expect(fields.levelHint).toBe("安心");
    expect(fields.total).toBe("480.5");
    expect(fields.comment).toBe("hello world");
    expect(fields.url).toBe("http://example.com/chart");
  });

  it("returns empty fields when commands are missing", () => {
    const fields = bmsTextToFields("#00111:0011\nplain text");
    expect(fields.title).toBe("");
    expect(fields.levelHint).toBe("");
  });
});

describe("bmsonTextToFields", () => {
  it("reads v1 info", () => {
    const fields = bmsonTextToFields(
      JSON.stringify({
        version: "1.0.0",
        info: { title: "T", artist: "A", level: 12, chart_name: "ANOTHER" },
      })
    );
    expect(fields?.title).toBe("T");
    expect(fields?.artist).toBe("A");
    expect(fields?.levelHint).toBe("12");
    expect(fields?.subtitle).toBe("ANOTHER");
  });

  it("reads v2 song_info and chart_info", () => {
    const fields = bmsonTextToFields(
      JSON.stringify({ song_info: { title: "T2", artist: "A2" }, chart_info: { level: 3 } })
    );
    expect(fields?.title).toBe("T2");
    expect(fields?.artist).toBe("A2");
    expect(fields?.levelHint).toBe("3");
  });

  it("returns null for invalid JSON or non-objects", () => {
    expect(bmsonTextToFields("{oops")).toBeNull();
    expect(bmsonTextToFields("[1,2]")).toBeNull();
  });
});

describe("fieldsToEntry", () => {
  it("merges title and subtitle and maps optional metadata", () => {
    const { entry, levelHint } = fieldsToEntry(
      {
        title: "Song",
        subtitle: "[ANOTHER]",
        artist: "Composer",
        comment: "note",
        url: "http://x",
        levelHint: "12",
        total: "480.5",
      },
      "md5",
      "sha256"
    );
    expect(entry).toEqual({
      md5: "md5",
      sha256: "sha256",
      title: "Song [ANOTHER]",
      artist: "Composer",
      comment: "note",
      url: "http://x",
      total: 480.5,
    });
    expect(levelHint).toBe("12");
  });

  it("keeps the entry minimal when fields are empty and drops non-numeric total", () => {
    const { entry, levelHint } = fieldsToEntry(
      { title: "", subtitle: "", artist: "", comment: "", url: "", levelHint: "", total: "abc" },
      "m",
      "s"
    );
    expect(entry).toEqual({ md5: "m", sha256: "s" });
    expect(levelHint).toBe("");
  });
});
