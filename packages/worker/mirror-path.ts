/**
 * 镜像表路径解析：把 `/bms/table/mirror/<dir_name>/` 与
 * `/bms/table/mirror/<dir_name>/edit/` 归一到表标识与编辑标记。
 * 纯函数（不含正则锚点与查询串处理），供路由分派与单测使用。
 */

export interface MirrorTablePath {
  /** 表标识（dir_name，可能含 `/` 以外的任意字符）。 */
  tableId: string;
  /** 是否为编辑路径（尾部一段为 `edit`）。 */
  edit: boolean;
}

/** 解析 `<dir_name>` 或 `<dir_name>/edit` 形态的路径段。 */
export function parseMirrorTablePath(segment: string): MirrorTablePath {
  const edit = segment.endsWith("/edit");
  return {
    tableId: edit ? segment.slice(0, -"/edit".length) : segment,
    edit,
  };
}
