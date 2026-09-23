/** 镜像表格项 */
export interface MirrorTableItem {
  name: string;
  symbol?: string;
  url: string;
  url_from?: string;
  comment?: string;
  date?: string;
  state?: string;
  tag1?: string;
  tag2?: string;
  tag_order?: string | number;
  dir_name?: string;
  url_data_json?: string;
  url_header_json?: string;
  /** 删除保护标记：由用户层合成写入，不在 R2 原始清单中。 */
  protected?: boolean;
}
