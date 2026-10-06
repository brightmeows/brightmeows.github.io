/**
 * BMS / BMSON 本地文件的纯函数解析：文件名后缀判定、编码嗅探、头部字段提取
 * 与条目映射。BMS 文本为“#命令 值”行格式（命令不区分大小写，重复命令以后者
 * 为准；值可为空）；BMSON 直接读 JSON 的 info（v1）或 song_info + chart_info（v2）。
 */

export const BMS_FILE_EXTENSIONS: readonly string[] = [".bms", ".bme", ".bml", ".pms", ".bmson"];

export function isBmsFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return BMS_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export interface DecodedBmsText {
  text: string;
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "shift_jis";
}

/**
 * 字节到文本：BOM 优先（UTF-8/UTF-16LE/UTF-16BE），无 BOM 时先按 UTF-8 严格解码，
 * 失败再退 Shift_JIS（日文 BMS 的主流编码；纯 ASCII 两种解码等价）。
 */
export function decodeBmsBytes(bytes: Uint8Array): DecodedBmsText {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "shift_jis" };
  }
}

export interface ImportedBmsFields {
  title: string;
  subtitle: string;
  artist: string;
  comment: string;
  url: string;
  /** 文件内等级建议（BMS 的 #PLAYLEVEL 或 BMSON 的 level），空串表示没有。 */
  levelHint: string;
  /** #TOTAL 原始文本（BMS 专用，可空）。 */
  total: string;
}

function emptyFields(): ImportedBmsFields {
  return { title: "", subtitle: "", artist: "", comment: "", url: "", levelHint: "", total: "" };
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/** 解析 BMS 文本的头部命令；通道行与其他内容忽略。 */
export function bmsTextToFields(text: string): ImportedBmsFields {
  const fields = emptyFields();
  for (const rawLine of text.split(/\r\n|\r|\n/u)) {
    const line = rawLine.replace(/^\s+/u, "");
    if (line.startsWith("#")) {
      const separator = line.search(/\s/u);
      const command = (separator === -1 ? line.slice(1) : line.slice(1, separator)).toUpperCase();
      const value = separator === -1 ? "" : line.slice(separator + 1).trim();
      switch (command) {
        case "TITLE":
          fields.title = value;
          break;
        case "SUBTITLE":
          fields.subtitle = value;
          break;
        case "ARTIST":
          fields.artist = value;
          break;
        case "GENRE":
        case "GENLE":
          break;
        case "PLAYLEVEL":
          fields.levelHint = value;
          break;
        case "TOTAL":
          fields.total = value;
          break;
        case "COMMENT":
          fields.comment = unquote(value);
          break;
      }
    } else if (line.startsWith("%")) {
      const separator = line.search(/\s/u);
      const command = (separator === -1 ? line.slice(1) : line.slice(1, separator)).toUpperCase();
      const value = separator === -1 ? "" : line.slice(separator + 1).trim();
      if (command === "URL") fields.url = value;
    }
  }
  return fields;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** 解析 BMSON 文本（v1 的 info 与 v2 的 song_info/chart_info 都接受）；非 JSON 返回 null。 */
export function bmsonTextToFields(text: string): ImportedBmsFields | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainObject(raw)) return null;
  const info = isPlainObject(raw.info) ? raw.info : {};
  const song = isPlainObject(raw.song_info) ? raw.song_info : {};
  const chart = isPlainObject(raw.chart_info) ? raw.chart_info : {};
  const fields = emptyFields();
  fields.title = textOf(song.title) || textOf(info.title);
  fields.subtitle =
    textOf(chart.subtitle) ||
    textOf(info.subtitle) ||
    textOf(chart.chart_name) ||
    textOf(info.chart_name);
  fields.artist = textOf(song.artist) || textOf(info.artist);
  fields.levelHint = textOf(chart.level) || textOf(info.level);
  return fields;
}

export interface ImportedBmsEntry {
  entry: Record<string, unknown>;
  /** 用于“按文件等级指派”的等级建议；空串表示没有建议。 */
  levelHint: string;
}

/**
 * 字段到表条目的映射：标题合并副标题；comment / url / total（数值）按需带上；
 * 等级一律留空（文件等级只是建议，不写入条目）。
 */
export function fieldsToEntry(
  fields: ImportedBmsFields,
  md5Hex: string,
  sha256Hex: string
): ImportedBmsEntry {
  const entry: Record<string, unknown> = { md5: md5Hex, sha256: sha256Hex };
  const title =
    fields.subtitle.trim() === ""
      ? fields.title.trim()
      : `${fields.title.trim()} ${fields.subtitle.trim()}`.trim();
  if (title !== "") entry.title = title;
  if (fields.artist !== "") entry.artist = fields.artist;
  if (fields.comment !== "") entry.comment = fields.comment;
  if (fields.url !== "") entry.url = fields.url;
  const total = Number(fields.total);
  if (fields.total.trim() !== "" && Number.isFinite(total)) entry.total = total;
  return { entry, levelHint: fields.levelHint.trim() };
}
