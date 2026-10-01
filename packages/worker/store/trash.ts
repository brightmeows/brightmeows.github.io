/**
 * 回收站（R2 对象级移动）：镜像表（tables/）与共享表（shared/）共用，
 * 布局统一为 `trash/<时间戳>/<名字>/`，过期清理由管线的 rclone delete --min-age
 * 一并覆盖。
 */

import type { Env } from "../env.ts";

/** 把表目录整体移入回收站（复制后删除原对象），返回回收站前缀。 */
export async function moveTableToTrash(env: Env, dirName: string, stamp: string): Promise<string> {
  return movePrefixToTrash(env, `tables/${dirName}/`, dirName, stamp);
}

/** 从回收站恢复表目录，返回恢复的对象数。 */
export async function restoreTableFromTrash(
  env: Env,
  trashPrefix: string,
  dirName: string
): Promise<number> {
  return restorePrefixFromTrash(env, trashPrefix, `tables/${dirName}/`);
}

/**
 * 把任意前缀下的对象整体移入回收站（复制后删除原对象），返回回收站前缀。
 * 镜像表（tables/）与共享表（shared/）共用：前缀作为参数传入，回收站布局
 * 统一为 `trash/<时间戳>/<名字>/`，过期清理由管线的 `rclone delete --min-age`
 * 一并覆盖。
 */
export async function movePrefixToTrash(
  env: Env,
  sourcePrefix: string,
  trashName: string,
  stamp: string
): Promise<string> {
  const source = sourcePrefix.endsWith("/") ? sourcePrefix : `${sourcePrefix}/`;
  const trashPrefix = `trash/${stamp}/${trashName}`;
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix: source,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      const body = await env.MIRROR_BUCKET.get(object.key);
      if (body === null) {
        continue;
      }
      const relative = object.key.slice(source.length);
      await env.MIRROR_BUCKET.put(`${trashPrefix}/${relative}`, await body.arrayBuffer());
      await env.MIRROR_BUCKET.delete(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return trashPrefix;
}

/** 从回收站恢复任意前缀下的对象，返回恢复的对象数。 */
export async function restorePrefixFromTrash(
  env: Env,
  trashPrefix: string,
  targetPrefix: string
): Promise<number> {
  const prefix = `${trashPrefix.replace(/\/+$/u, "")}/`;
  const target = targetPrefix.endsWith("/") ? targetPrefix : `${targetPrefix}/`;
  let restored = 0;
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      const body = await env.MIRROR_BUCKET.get(object.key);
      if (body === null) {
        continue;
      }
      const relative = object.key.slice(prefix.length);
      await env.MIRROR_BUCKET.put(`${target}${relative}`, await body.arrayBuffer());
      await env.MIRROR_BUCKET.delete(object.key);
      restored += 1;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return restored;
}
