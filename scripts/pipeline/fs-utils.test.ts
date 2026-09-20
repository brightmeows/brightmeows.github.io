import { describe, expect, it } from "vitest";

import { identityNormalizer, isChangedContent } from "./fs-utils.ts";
import { normalizeData } from "./normalize.ts";

describe("isChangedContent", () => {
  it("文件不存在视为变更", () => {
    expect(isChangedContent(null, "{}", identityNormalizer)).toBe(true);
  });

  it("字节完全相同时不变更", () => {
    expect(isChangedContent('{"a":1}', '{"a":1}', identityNormalizer)).toBe(false);
  });

  it("键序或数组顺序不同但语义相同时不变更", () => {
    expect(isChangedContent('{"a":1,"b":2}', '{"b":2,"a":1}', identityNormalizer)).toBe(false);
    expect(isChangedContent("[1,2]", "[2,1]", identityNormalizer)).toBe(false);
  });

  it("旧文件损坏或非法时视为变更", () => {
    expect(isChangedContent("not json", "{}", identityNormalizer)).toBe(true);
    expect(isChangedContent('{"a":1}', "not json", identityNormalizer)).toBe(true);
  });

  it("按 normalizer 的口径比较（data.json 忽略额外字段与 level 缺省）", () => {
    expect(isChangedContent('[{"level":"0","md5":"x"}]', '[{"md5":"x"}]', normalizeData)).toBe(
      false
    );
    expect(isChangedContent('[{"md5":"x"}]', '[{"md5":"y"}]', normalizeData)).toBe(true);
  });
});
