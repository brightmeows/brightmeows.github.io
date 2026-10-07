/**
 * 头部编辑态的拆分助手：原始 header 与编辑器可编辑字段之间的映射。
 * 独立成子模块以避免 editor（拆字段）与 course（course 解析，反向依赖
 * editor 的 moveItem）之间形成循环导入。
 */

import { parseCourse, type CourseModel } from "./course.ts";
import { levelOrderOf, splitEditorHeader } from "./editor.ts";

/** 头部编辑态：由原始 header 拆出的可编辑字段。 */
export interface EditorHeaderState {
  name: string;
  symbol: string;
  tag: string;
  mode: string;
  levels: string[];
  courseModel: CourseModel;
  /** 未在表单中编辑的头部字段（原样保留）。 */
  extra: Record<string, unknown>;
}

/** 拆分原始 header 为编辑态字段（未知字段原样保留在 extra）。 */
export function editorHeaderState(header: Record<string, unknown>): EditorHeaderState {
  const split = splitEditorHeader(header);
  return {
    name: split.core.name,
    symbol: split.core.symbol,
    tag: split.core.tag,
    mode: split.core.mode,
    levels: levelOrderOf(header),
    courseModel: parseCourse(header.course),
    extra: split.extra,
  };
}
