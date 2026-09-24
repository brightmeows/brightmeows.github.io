import type { CurrentUser } from "./mirror-user-api";
import { ApiUnavailableError, fetchCurrentUser, submitLogout } from "./mirror-user-api";

/** 登录态拉取状态。 */
export type AuthStatus =
  /** 尚未拉取（水合前） */
  | "idle"
  /** 拉取中 */
  | "loading"
  /** 已就绪（user 为 null 即未登录） */
  | "ready"
  /** 接口不可用（静态宿主上 /api/* 为 404） */
  | "unavailable";

/**
 * 镜像用户登录态的共享 store（Svelte 5 runes）。
 *
 * 顶栏登录入口与镜像列表页共用同一份状态：任意一处登录、登出或写操作
 * 后刷新，其余消费方立即反映。SSG 页面水合后调用一次 ensureLoaded()。
 */
class AuthStore {
  /** 当前登录用户；null 表示未登录。 */
  user = $state<CurrentUser | null>(null);
  /** 拉取状态。 */
  status = $state<AuthStatus>("idle");

  #loaded = false;

  /** 幂等拉取登录态；重复调用不重复请求。 */
  async ensureLoaded(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    await this.#fetch();
  }

  /** 强制重新拉取登录态（OAuth 回调落地、写操作后使用）。 */
  async refresh(): Promise<void> {
    await this.#fetch();
  }

  /** 登出：清除服务端会话并复位本地状态。 */
  async logout(): Promise<void> {
    try {
      await submitLogout();
    } finally {
      this.user = null;
    }
  }

  async #fetch(): Promise<void> {
    this.status = "loading";
    try {
      this.user = await fetchCurrentUser();
      this.status = "ready";
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        this.status = "unavailable";
      } else {
        // 其他失败（网络抖动等）按未登录呈现，不阻塞页面；
        // 用户再点登录会重新走 OAuth，会话若仍在则无感恢复。
        this.user = null;
        this.status = "ready";
      }
    }
  }
}

export const auth = new AuthStore();
