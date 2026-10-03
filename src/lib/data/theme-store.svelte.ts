import { parseThemeName, resolveTheme, THEME_STORAGE_KEY, type ThemeName } from "$lib/utils/theme";

/**
 * 浅色与深色主题的共享 store（Svelte 5 runes）。
 *
 * 值域见 `$lib/utils/theme`：light 是蓝紫星空端，dark 是近黑端，两者都是
 * 深色界面。首屏由 `app.html` 的内联脚本按同一约定先行写入
 * `<html data-theme>`；本 store 水合后接管：读取 localStorage 偏好，未手动
 * 选择时跟随系统偏好，手动切换后固定并持久化。
 *
 * SSG 首帧的 `current` 保持 "light"，与预渲染产物一致，避免水合错位。
 */
class ThemeStore {
  /** 当前生效主题；init() 后与首屏脚本写入的值同步。 */
  current = $state<ThemeName>("light");

  #initialized = false;
  #manual = false;
  #media: MediaQueryList | null = null;

  /** 幂等初始化：同步首屏主题并订阅系统偏好变化；返回解绑函数（无可解绑时为空）。 */
  init(): (() => void) | undefined {
    if (typeof window === "undefined" || this.#initialized) return undefined;
    this.#initialized = true;
    const stored = this.#readStored();
    this.#manual = parseThemeName(stored) !== null;
    this.#media = window.matchMedia("(prefers-color-scheme: dark)");
    this.#apply(resolveTheme(stored, this.#media.matches));
    const onMediaChange = (event: MediaQueryListEvent): void => {
      if (!this.#manual) this.#apply(event.matches ? "dark" : "light");
    };
    this.#media.addEventListener("change", onMediaChange);
    return () => this.#media?.removeEventListener("change", onMediaChange);
  }

  /** 手动切换并持久化；此后不再跟随系统偏好。 */
  toggle(): void {
    this.#manual = true;
    const next: ThemeName = this.current === "dark" ? "light" : "dark";
    this.#apply(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage 不可用（隐私模式等）时仅本次会话生效
    }
  }

  #readStored(): string | null {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  #apply(next: ThemeName): void {
    this.current = next;
    document.documentElement.dataset.theme = next;
  }
}

export const theme = new ThemeStore();
