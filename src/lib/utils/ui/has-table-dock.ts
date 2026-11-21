/**
 * 难度表详情页路由判定：TableDock 常驻右下角的三类地址。
 * /bms/table/<table>（自托管表）、/bms/table/mirror/<name>、
 * /bms/table/shared/<id>；总览 /bms/table、镜像列表 /bms/table/mirror
 * 与共享表新建页 /bms/table/shared/new 没有 dock，不算。
 * 回到顶部浮动按钮靠它在 dock 页抬高避让。
 */
export function hasTableDock(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "bms" || segments[1] !== "table") return false;
  if (segments.length === 3) return segments[2] !== "mirror";
  if (segments.length !== 4) return false;
  const kind = segments[2];
  const id = segments[3];
  return (kind === "mirror" || kind === "shared") && id !== "new";
}
