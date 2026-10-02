/**
 * 抓取目标的安全校验：拒绝非 http(s) scheme 与私网/保留地址。
 *
 * 表源 URL 由用户提交并进入抓取（单表抓取工作流可被任意登录用户触发），
 * 不做校验即构成 SSRF 面：runner 可被用来探测内网（云元数据、链路本地、
 * 同网段服务）或借 runner 的 IP 发起请求。HTTP/2 与 HTTP/1.1 两条抓取
 * 路径都对每一跳重定向的目标调用本模块。
 *
 * 残余风险：校验基于 DNS 解析结果，解析到连接之间的 rebinding 仍有理论
 * 窗口；目标是消除数量级上的攻击面，而不是构建完整的出口代理。
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** 两条抓取路径共用的最大重定向跳数。 */
export const MAX_REDIRECTS = 5;

/** 抓取目标不被允许（非 http(s)、私网/保留段或解析失败）。 */
export class UnsafeFetchTargetError extends Error {}

/** DNS 解析函数签名（测试注入用）。 */
export type ResolveHostname = (hostname: string) => Promise<string[]>;

/** 默认解析：取全部 A/AAAA 记录。 */
export const resolveHostname: ResolveHostname = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

/** IPv4 点分四段转 32 位整数；非法返回 null。 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value;
}

/** 私有与保留段（[起始地址的 32 位整数, 前缀长度]，含 TEST-NET 与组播）。 */
const RESERVED_IPV4: readonly (readonly [number, number])[] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10（CGNAT）
  [0x7f000000, 8], // 127.0.0.0/8
  [0xa9fe0000, 16], // 169.254.0.0/16（链路本地，含云元数据）
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0000000, 24], // 192.0.0.0/24
  [0xc0000200, 24], // 192.0.2.0/24（TEST-NET-1）
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xc6120000, 15], // 198.18.0.0/15
  [0xc6336400, 24], // 198.51.100.0/24（TEST-NET-2）
  [0xcb007100, 24], // 203.0.113.0/24（TEST-NET-3）
  [0xe0000000, 4], // 224.0.0.0/4（组播）
  [0xf0000000, 4], // 240.0.0.0/4（保留）
];

/** IPv4 地址是否落在私有或保留段。 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) {
    return false;
  }
  for (const [base, bits] of RESERVED_IPV4) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if (((value ^ base) & mask) === 0) {
      return true;
    }
  }
  return false;
}

/** 解析 IPv6 文本为 16 字节；非法返回 null（支持 :: 压缩、zone id 与内嵌 IPv4）。 */
export function parseIpv6(ip: string): Uint8Array | null {
  const withoutZone = ip.split("%")[0] ?? ip;
  if (withoutZone === "") {
    return null;
  }
  const halves = withoutZone.split("::");
  if (halves.length > 2) {
    return null;
  }

  const parseGroups = (text: string): number[] | null => {
    if (text === "") {
      return [];
    }
    const groups: number[] = [];
    const parts = text.split(":");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      if (part.includes(".")) {
        // 内嵌 IPv4 只允许出现在最后一段
        if (index !== parts.length - 1) {
          return null;
        }
        const embedded = ipv4ToInt(part);
        if (embedded === null) {
          return null;
        }
        groups.push((embedded >>> 16) & 0xffff, embedded & 0xffff);
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
        return null;
      }
      groups.push(Number.parseInt(part, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0] ?? "");
  const tail = halves.length === 2 ? parseGroups(halves[1] ?? "") : [];
  if (head === null || tail === null) {
    return null;
  }
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) {
      return null;
    }
    groups = [...head, ...Array.from({ length: fill }, () => 0), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) {
    return null;
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < 8; index += 1) {
    const group = groups[index] ?? 0;
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  }
  return bytes;
}

/** IPv6 地址是否落在私有或保留段（含 IPv4 映射/兼容/6to4 形式的封装地址）。 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  const bytes = parseIpv6(ip);
  if (bytes === null) {
    return false;
  }
  const b = (index: number): number => bytes[index] ?? 0;
  const embeddedIpv4 = `${b(12)}.${b(13)}.${b(14)}.${b(15)}`;

  // :: 与 ::1
  const headFifteenZero = bytes.slice(0, 15).every((byte) => byte === 0);
  if (headFifteenZero && (b(15) === 0 || b(15) === 1)) {
    return true;
  }
  // ::ffff:a.b.c.d（IPv4 映射）与 ::a.b.c.d（IPv4 兼容）
  const firstTenZero = bytes.slice(0, 10).every((byte) => byte === 0);
  if (firstTenZero && b(10) === 0xff && b(11) === 0xff) {
    return isPrivateOrReservedIpv4(embeddedIpv4);
  }
  if (firstTenZero && b(10) === 0 && b(11) === 0) {
    return isPrivateOrReservedIpv4(embeddedIpv4);
  }
  // fc00::/7（唯一本地）
  if ((b(0) & 0xfe) === 0xfc) {
    return true;
  }
  // fe80::/10（链路本地）
  if (b(0) === 0xfe && (b(1) & 0xc0) === 0x80) {
    return true;
  }
  // ff00::/8（组播）
  if (b(0) === 0xff) {
    return true;
  }
  // 2001:db8::/32（文档示例）
  if (b(0) === 0x20 && b(1) === 0x01 && b(2) === 0x0d && b(3) === 0xb8) {
    return true;
  }
  // 2001::/32（Teredo 隧道）
  if (b(0) === 0x20 && b(1) === 0x01 && b(2) === 0x00 && b(3) === 0x00) {
    return true;
  }
  // 2002::/16（6to4，内嵌 IPv4 在后续四字节）
  if (b(0) === 0x20 && b(1) === 0x02) {
    return isPrivateOrReservedIpv4(`${b(2)}.${b(3)}.${b(4)}.${b(5)}`);
  }
  return false;
}

/** 判断一个 IP 字面量是否落在私有或保留段（IPv4/IPv6 自动分流）。 */
export function isPrivateOrReservedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  if (version === 6) {
    return isPrivateOrReservedIpv6(ip);
  }
  return false;
}

/**
 * 校验一个抓取目标：scheme 限 http(s)，hostname 的解析结果不得落在私网或
 * 保留段（IP 字面量直接判断，域名解析全部 A/AAAA 记录）。不安全或无法解析
 * 时抛出 UnsafeFetchTargetError，由抓取层按网络失败处理。
 */
export async function assertSafeFetchTarget(
  rawUrl: string,
  resolver: ResolveHostname | undefined = resolveHostname
): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeFetchTargetError(`不是合法 URL：${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeFetchTargetError(`仅支持 http(s) 协议：${rawUrl}`);
  }
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  if (hostname === "") {
    throw new UnsafeFetchTargetError(`缺少主机名：${rawUrl}`);
  }
  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedAddress(hostname)) {
      throw new UnsafeFetchTargetError(`目标地址落在私网或保留段：${hostname}`);
    }
    return;
  }
  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch (error) {
    throw new UnsafeFetchTargetError(`域名解析失败：${hostname}`, { cause: error });
  }
  if (addresses.length === 0) {
    throw new UnsafeFetchTargetError(`域名无解析结果：${hostname}`);
  }
  for (const address of addresses) {
    if (isPrivateOrReservedAddress(address)) {
      throw new UnsafeFetchTargetError(`域名解析到私网或保留段：${hostname} -> ${address}`);
    }
  }
}
