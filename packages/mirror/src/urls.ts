/**
 * 镜像表 URL 构造的单一来源：站点代码与数据管线生成器共用。
 * 本模块必须保持零依赖，生成器脚本会被 Node 直接执行。
 */

/** 去掉基址尾部斜杠，避免拼接出双斜杠。 */
export function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/** 编码镜像表 ID（形如 `[host] table name`）。 */
export function encodeTableId(tableId: string): string {
  return encodeURIComponent(tableId);
}

/** R2 上镜像表数据目录的基址。 */
export function r2TablesBase(r2Base: string): string {
  return `${normalizeBase(r2Base)}/tables`;
}

/** R2 上指定镜像表的 header.json 完整 URL。 */
export function r2TableHeaderUrl(r2Base: string, tableId: string): string {
  return `${r2TablesBase(r2Base)}/${encodeTableId(tableId)}/header.json`;
}

/** R2 上指定镜像表的 data.json 完整 URL。 */
export function r2TableDataUrl(r2Base: string, tableId: string): string {
  return `${r2TablesBase(r2Base)}/${encodeTableId(tableId)}/data.json`;
}

/** 站点内镜像表页面（客户端注册用 stub）的根相对路径。 */
export function mirrorTablePath(tableId: string): string {
  return `/bms/table/mirror/${encodeTableId(tableId)}/`;
}
