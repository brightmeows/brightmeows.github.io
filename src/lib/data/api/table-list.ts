/**
 * 同站清单拉取的公共骨架：镜像清单与共享清单（Worker 动态响应）共用的取数、
 * 缓存穿透与形状校验；url 改写等域逻辑由调用方做。
 */

import {
  fetchStream,
  FetchStreamError,
  type StreamProgress,
} from "#lib/utils/infra/fetch-stream.js";

/** 拉取同站清单 JSON 并校验数组形状。 */
export async function fetchSiteTableList<T>(
  path: string,
  messages: {
    loadFailed: (status: number) => string;
    invalid: () => string;
  },
  options: {
    cacheBust?: boolean | undefined;
    onProgress?: ((progress: StreamProgress) => void) | undefined;
  } = {},
  isItem: (item: unknown) => item is T
): Promise<T[]> {
  const url = new URL(path, window.location.origin);
  if (options.cacheBust === true) {
    url.searchParams.set("t", String(Date.now()));
  }

  let bytes: Uint8Array;
  try {
    ({ bytes } = await fetchStream(url.toString(), undefined, options.onProgress));
  } catch (error) {
    if (error instanceof FetchStreamError) {
      throw new Error(messages.loadFailed(error.status), { cause: error });
    }
    throw error;
  }

  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(messages.invalid(), { cause: error });
  }
  const items: unknown[] = Array.isArray(data) ? data : [];
  if (!items.every(isItem)) {
    throw new Error(messages.invalid());
  }
  return items.filter(isItem);
}
