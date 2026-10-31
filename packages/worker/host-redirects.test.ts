import { describe, expect, it } from "vitest";

import { redirectForHost } from "./host-redirects.ts";

describe("redirectForHost", () => {
  it("www 与旧域跳到 brightmeows.com", () => {
    expect(redirectForHost(new URL("https://www.brightmeows.com/a?b=1"))?.toString()).toBe(
      "https://brightmeows.com/a?b=1"
    );
    expect(redirectForHost(new URL("https://miyakomeow.site/blog/"))?.toString()).toBe(
      "https://brightmeows.com/blog/"
    );
  });

  it(".cn、旧静态子域与跳转宿主子域跳到主站", () => {
    expect(redirectForHost(new URL("https://brightmeows.cn/"))?.toString()).toBe(
      "https://brightmeows.com/"
    );
    expect(redirectForHost(new URL("https://www.brightmeows.cn/x"))?.toString()).toBe(
      "https://brightmeows.com/x"
    );
    expect(redirectForHost(new URL("https://github-pages.miyakomeow.site/"))?.toString()).toBe(
      "https://brightmeows.com/"
    );
    expect(redirectForHost(new URL("https://github-pages.brightmeows.com/"))?.toString()).toBe(
      "https://brightmeows.com/"
    );
    expect(redirectForHost(new URL("https://codeberg-pages.brightmeows.com/"))?.toString()).toBe(
      "https://brightmeows.com/"
    );
  });

  it("主站与 R2 域不重定向", () => {
    expect(redirectForHost(new URL("https://brightmeows.com/"))).toBeNull();
    expect(redirectForHost(new URL("https://bms-table-mirror-r2.brightmeows.com/"))).toBeNull();
  });
});
