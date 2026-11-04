import { sharedTablePath } from "@brightmeows/mirror/urls";

/**
 * 自托管个人表迁入共享表的遗留地址 301（2026-11 迁移）。
 *
 * 旧地址 `/bms/table/<旧名>/`（含无尾斜杠形态）映射到共享表 id，301 到
 * 共享表页；beatoraja 与 BeMusicSeeker 跟随同协议 https 301 后从注入的
 * bmstable meta 取 R2 header。旧 JSON 子路径直链（header/data/level-ref）
 * 不在此管：没有对外分发场景，落静态层 404。
 *
 * 若映射目标日后经改名变更 id，必须同步更新本表指向最终 id——
 * shared_alias 只覆盖 `/bms/table/shared/` 根下的旧 id，管不到这里的旧路径，
 * 不同步会叠成两跳 301。
 */
const LEGACY_SELF_TABLES: Readonly<Record<string, string | undefined>> = {
  "self-sp": "meow-sp",
  "self-dp": "meow-dp",
};

/** 命中遗留地址时返回 301（透传 query）；其余返回 null 交后续分支。 */
export function legacySelfTableRedirect(
  path: string,
  origin: string,
  search: string
): Response | null {
  const match = /^\/bms\/table\/([^/]+)(\/)?$/.exec(path);
  if (match === null) return null;
  const target = LEGACY_SELF_TABLES[match[1]];
  if (target === undefined) return null;
  return Response.redirect(new URL(`${sharedTablePath(target)}${search}`, origin).toString(), 301);
}
