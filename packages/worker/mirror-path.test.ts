import { describe, expect, it } from "vitest";

import { parseMirrorTablePath } from "./mirror-path.ts";

describe("parseMirrorTablePath", () => {
  it("keeps plain table ids as view paths", () => {
    expect(parseMirrorTablePath("[host] name")).toEqual({
      tableId: "[host] name",
      edit: false,
    });
    expect(parseMirrorTablePath("edit")).toEqual({ tableId: "edit", edit: false });
  });

  it("strips exactly one trailing /edit segment", () => {
    expect(parseMirrorTablePath("[host] name/edit")).toEqual({
      tableId: "[host] name",
      edit: true,
    });
    expect(parseMirrorTablePath("a/edit/edit")).toEqual({ tableId: "a/edit", edit: true });
  });
});
