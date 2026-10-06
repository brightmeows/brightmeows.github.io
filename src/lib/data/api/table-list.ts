/**
 * 同站清单拉取的公共骨架：镜像清单与共享清单（Worker 动态响应或静态宿主
 * 构建期产物）共用的取数、缓存穿透与形状校验；url 改写等域逻辑由调用方做。
 */

/** 拉取同站清单 JSON 并校验数组形状。 */
export async function fetchSiteTableList<T>(
  path: string,
  messages: {
    loadFailed: (status: number) => string;
    invalid: () => string;
  },
  options: { cacheBust?: boolean | undefined } = {}
): Promise<T[]> {
  const url = new URL(path, window.location.origin);
  if (options.cacheBust === true) {
    url.searchParams.set("t", String(Date.now()));
  }
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) {
    throw new Error(messages.loadFailed(res.status));
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(messages.invalid());
  }
  return data as T[];
}
