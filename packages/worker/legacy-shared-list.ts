/**
 * 共享表列表页并入 /bms/table 的遗留地址 301（2026-11 合并）。
 *
 * `/bms/table/shared`（含无尾斜杠形态）301 到 `/bms/table`（透传 query）；
 * `new/`、`[id]/`、`tables.json` 等子路径不在此管——index.ts 的既有分支
 * 在本映射之前分流。
 */
export function legacySharedListRedirect(
  path: string,
  origin: string,
  search: string
): Response | null {
  if (path !== "/bms/table/shared" && path !== "/bms/table/shared/") return null;
  return Response.redirect(new URL(`/bms/table${search}`, origin).toString(), 301);
}
