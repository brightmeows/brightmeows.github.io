import { describe, expect, it } from "vitest";

import {
  assertSafeFetchTarget,
  isPrivateOrReservedAddress,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  parseIpv6,
  UnsafeFetchTargetError,
} from "./net-guard.ts";

describe("isPrivateOrReservedIpv4", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.127.255.255",
    "127.0.0.1",
    "127.255.255.255",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
  ])("拦截 %s", (ip) => {
    expect(isPrivateOrReservedIpv4(ip)).toBe(true);
  });

  it.each([
    "1.1.1.1",
    "8.8.8.8",
    "9.255.255.255",
    "11.0.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "192.0.1.1",
    "223.255.255.255",
  ])("放行 %s", (ip) => {
    expect(isPrivateOrReservedIpv4(ip)).toBe(false);
  });

  it("非法输入返回 false", () => {
    expect(isPrivateOrReservedIpv4("not-an-ip")).toBe(false);
    expect(isPrivateOrReservedIpv4("300.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIpv4("10.0.0")).toBe(false);
  });
});

describe("parseIpv6", () => {
  it("解析 :: 与 ::1", () => {
    const zero = parseIpv6("::");
    expect(zero).not.toBeNull();
    expect([...(zero ?? [])]).toEqual(Array.from({ length: 16 }, () => 0));
    const loopback = parseIpv6("::1");
    expect(loopback?.[15]).toBe(1);
  });

  it("解析压缩与内嵌 IPv4", () => {
    const mapped = parseIpv6("::ffff:127.0.0.1");
    expect([...(mapped ?? [])].slice(10)).toEqual([0xff, 0xff, 127, 0, 0, 1]);
    const full = parseIpv6("2001:4860:4860::8888");
    expect(full?.[0]).toBe(0x20);
    expect(full?.[15]).toBe(0x88);
  });

  it("解析 zone id", () => {
    expect(parseIpv6("fe80::1%eth0")?.[0]).toBe(0xfe);
  });

  it("非法输入返回 null", () => {
    expect(parseIpv6("12345::1")).toBeNull();
    expect(parseIpv6("::1::2")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7")).toBeNull();
    expect(parseIpv6("")).toBeNull();
  });
});

describe("isPrivateOrReservedIpv6", () => {
  it.each([
    "::",
    "::1",
    "fe80::1",
    "fe80::1%eth0",
    "fc00::1",
    "fd12:3456:789a::1",
    "ff02::1",
    "2001:db8::1",
    "2001::1",
    "2002:0a00:0001::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
  ])("拦截 %s", (ip) => {
    expect(isPrivateOrReservedIpv6(ip)).toBe(true);
  });

  it.each([
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "2404:6800:4004:800::200e",
  ])("放行 %s", (ip) => {
    expect(isPrivateOrReservedIpv6(ip)).toBe(false);
  });
});

describe("isPrivateOrReservedAddress", () => {
  it("支持 IPv4 与 IPv6 字面量", () => {
    expect(isPrivateOrReservedAddress("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedAddress("fe80::1")).toBe(true);
    expect(isPrivateOrReservedAddress("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedAddress("2001:4860:4860::8888")).toBe(false);
  });
});

describe("assertSafeFetchTarget", () => {
  const publicResolver = (): Promise<string[]> => Promise.resolve(["93.184.216.34"]);
  const privateResolver = (): Promise<string[]> => Promise.resolve(["10.1.2.3"]);
  const mixedResolver = (): Promise<string[]> => Promise.resolve(["93.184.216.34", "192.168.1.1"]);
  const emptyResolver = (): Promise<string[]> => Promise.resolve([]);

  it("拒绝非 http(s) 协议", async () => {
    await expect(assertSafeFetchTarget("ftp://example.com/")).rejects.toBeInstanceOf(
      UnsafeFetchTargetError
    );
    await expect(assertSafeFetchTarget("file:///etc/passwd")).rejects.toBeInstanceOf(
      UnsafeFetchTargetError
    );
  });

  it("拒绝私网与保留 IP 字面量（含云元数据与 IPv6）", async () => {
    await expect(
      assertSafeFetchTarget("http://169.254.169.254/latest/meta-data/")
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
    await expect(assertSafeFetchTarget("http://127.0.0.1:8080/")).rejects.toBeInstanceOf(
      UnsafeFetchTargetError
    );
    await expect(assertSafeFetchTarget("http://[::1]/")).rejects.toBeInstanceOf(
      UnsafeFetchTargetError
    );
    await expect(assertSafeFetchTarget("http://[fe80::1]/")).rejects.toBeInstanceOf(
      UnsafeFetchTargetError
    );
  });

  it("拒绝解析到私网的域名（含混合结果）", async () => {
    await expect(
      assertSafeFetchTarget("https://example.com/", privateResolver)
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
    await expect(
      assertSafeFetchTarget("https://example.com/", mixedResolver)
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
  });

  it("放行公网字面量与公网解析结果", async () => {
    await expect(assertSafeFetchTarget("http://8.8.8.8/")).resolves.toBeUndefined();
    await expect(
      assertSafeFetchTarget("https://example.com/table.html", publicResolver)
    ).resolves.toBeUndefined();
  });

  it("解析为空或失败时拒绝", async () => {
    await expect(
      assertSafeFetchTarget("https://example.com/", emptyResolver)
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
    await expect(
      assertSafeFetchTarget("https://example.com/", () => Promise.reject(new Error("ENOTFOUND")))
    ).rejects.toBeInstanceOf(UnsafeFetchTargetError);
  });
});
