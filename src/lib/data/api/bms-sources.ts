import { loadSharedTables } from "./shared-api.js";

import { externalDataProxyUrl } from "#lib/constants/external-data.js";
import {
  r2SharedDataUrl,
  r2SharedHeaderUrl,
  r2TableDataUrl,
  r2TableHeaderUrl,
} from "#lib/constants/r2.js";
import { m } from "#lib/paraglide/messages.js";
import { fetchStream } from "#lib/utils/infra/fetch-stream.js";
import { isRecord } from "#lib/utils/infra/object.js";

/** 跨表谱面来源：镜像表或共享表。 */
export interface ChartSource {
  kind: "mirror" | "shared";
  id: string;
  label: string;
}

/** 来源表的条目数据与展示名。 */
export interface ChartSourceData {
  name: string;
  entries: Record<string, unknown>[];
}

/** 跨表来源加载阶段；清单与单表读取共用。 */
export interface ChartSourceProgress {
  phase: "mirror-list" | "shared-list" | "header" | "data";
  loaded: number;
  total: number;
}

/**
 * 汇总镜像与共享来源；任一侧清单失败时保留另一侧，全部失败返回空数组。
 * 与添加抽屉、段位 picker 共用，避免各自复制清单解析。
 */
export async function loadChartSources(
  onProgress?: (progress: ChartSourceProgress) => void
): Promise<ChartSource[]> {
  const list: ChartSource[] = [];
  try {
    const { bytes } = await fetchStream("/bms/table/mirror/tables.json", undefined, (progress) => {
      onProgress?.({ phase: "mirror-list", ...progress });
    });
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!isRecord(item)) continue;
        const dir = typeof item.dir_name === "string" ? item.dir_name : "";
        if (dir === "") continue;
        const name = typeof item.name === "string" && item.name !== "" ? item.name : dir;
        list.push({ kind: "mirror", id: dir, label: `${name}（${dir}）` });
      }
    }
  } catch {
    // 镜像清单不可用：只展示能拿到的共享来源
  }
  try {
    const shared = await loadSharedTables(undefined, {
      onProgress: (progress) => onProgress?.({ phase: "shared-list", ...progress }),
    });
    for (const item of shared) {
      const label = item.name === "" ? item.id : `${item.name}（${item.id}）`;
      list.push({ kind: "shared", id: item.id, label });
    }
  } catch {
    // 共享清单不可用
  }
  return list;
}

/**
 * 读取一张镜像或共享表的 header 与 data；data_url 为相对路径时按 header
 * 地址解析。返回的 entries 已过滤为对象元素，调用方按哈希与标题自行筛选。
 */
export async function loadChartSourceData(
  source: ChartSource,
  onProgress?: (progress: ChartSourceProgress) => void
): Promise<ChartSourceData> {
  const headerUrl =
    source.kind === "mirror" ? r2TableHeaderUrl(source.id) : r2SharedHeaderUrl(source.id);
  const fallbackData =
    source.kind === "mirror" ? r2TableDataUrl(source.id) : r2SharedDataUrl(source.id);
  const { bytes: headerBytes } = await fetchStream(headerUrl, undefined, (progress) => {
    onProgress?.({ phase: "header", ...progress });
  });
  const header: unknown = JSON.parse(new TextDecoder().decode(headerBytes));
  if (!isRecord(header)) throw new Error(m["editor.import.invalid"]());
  const dataUrl =
    typeof header.data_url === "string" && header.data_url !== "" ? header.data_url : fallbackData;
  const resolvedDataUrl = new URL(dataUrl, headerUrl).toString();
  const { bytes: dataBytes } = await fetchStream(
    externalDataProxyUrl(resolvedDataUrl) ?? resolvedDataUrl,
    undefined,
    (progress) => onProgress?.({ phase: "data", ...progress })
  );
  const data: unknown = JSON.parse(new TextDecoder().decode(dataBytes));
  if (!Array.isArray(data)) throw new Error(m["editor.import.invalid"]());
  const entries = data.filter(isRecord);
  const name = typeof header.name === "string" && header.name !== "" ? header.name : source.id;
  return { name, entries };
}
