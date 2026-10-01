/**
 * 跨模块共享的通用类型（模块私有的类型就地声明，不进本目录）。
 */

/** 字符串转换器签名（用于 OpenCC 简繁日转换等场景） */
export type StringConverter = (input: string) => string;

/**
 * 异步资源状态的统一词汇：全站各取数点共用的判别联合。
 *
 * - `idle`：尚未发起（水合前或未触发）
 * - `loading`：进行中
 * - `ready`：成功，`data` 为结果
 * - `error`：失败，`message` 已按当前语言翻译
 * - `unavailable`：接口不可用（静态宿主上 `/api/*` 为 404），
 *   页面据此降级为“去主站”引导
 *
 * 不依赖 API 的资源（如同源清单、R2 索引）不会进入 `unavailable`——
 * 类型允许但不强制使用全部变体。页面级域状态机（如共享表编辑页的
 * login/notfound）保持域联合类型，从本词汇派生通用部分即可。
 */
export type AsyncState<T> =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; data: T }
  | { phase: "error"; message: string }
  | { phase: "unavailable" };
