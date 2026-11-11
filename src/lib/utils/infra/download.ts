/**
 * 轻量 DOM 下载工具：把文本内容存成文件（Blob 加临时链接，同 clipboard/url 口径）。
 * 与 shared-table 解耦，供表编辑器与共享表页面共用。
 */

/** 把文本内容存成下载文件（难度表 JSON 产物一律 application/json）。 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
