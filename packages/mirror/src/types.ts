/** 值为非数组的 JSON 对象：本包响应窄化与记录解析共用的窄化谓词。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 镜像表源站健康状态。 */
export type MirrorTableHealthStatus = "ok" | "stale";

/** 源站进入 stale 的固定原因码；文案由站点按语言翻译。 */
export type MirrorTableHealthReason =
  | "source_gone"
  | "gas_runtime_retired"
  | "access_denied"
  | "network"
  | "unknown";

/** 站点清单暴露的健康字段；内部字段只留在 R2 health.json。 */
export interface MirrorTableHealth {
  status: MirrorTableHealthStatus;
  last_success?: string;
  reason?: MirrorTableHealthReason;
}

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
  /** 源站健康状态；由 Worker 从 health.json 合并，R2 原始清单没有。 */
  status?: MirrorTableHealthStatus;
  /** 数据最后更新时间；由 Worker 从 health.json 合并。 */
  last_success?: string;
  /** stale 原因码；ok 时不存在。 */
  reason?: MirrorTableHealthReason;
}
