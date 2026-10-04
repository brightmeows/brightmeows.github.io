import {
  parseThemeName,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeName,
  type ThemePreference,
} from "$lib/utils/theme";

/**
 * 主题偏好的共享 store（Svelte 5 runes）。
 *
 * 值域见 `$lib/utils/theme`：light 是蓝紫星空端，dark 是近黑端，两者都是
 * 深色界面。首屏由 `app.html` 的内联脚本按同一约定先行写入
 * `<html data-theme>`；本 store 水合后接管：读取 localStorage 偏好，
 * 选浅色/深色写入并固定，选跟随系统清除键、随系统偏好实时变化，
 * 无存储值等同跟随系统。
 *
 * SSG 首帧 `preference` 保持 "system"（预渲染无法得知存储）；
 * 菜单在水合后才可能展开，init() 同步存储偏好，无水合错位。
 */
class ThemeStore {
  /** 用户主题偏好；init() 后与 localStorage 同步。 */
  preference = $state<ThemePreference>("system");

  #initialized = false;
  #media: MediaQueryList | null = null;

  /** 幂等初始化：同步主题并订阅系统偏好变化；返回解绑函数（无可解绑时为空）。 */
  init(): (() => void) | undefined {
    if (typeof window === "undefined" || this.#initialized) return undefined;
    this.#initialized = true;
    const stored = this.#readStored();
    this.preference = parseThemeName(stored) ?? "system";
    this.#media = window.matchMedia("(prefers-color-scheme: dark)");
    this.#apply(resolveTheme(stored, this.#media.matches));
    const onMediaChange = (event: MediaQueryListEvent): void => {
      if (this.preference === "system") this.#apply(event.matches ? "dark" : "light");
    };
    this.#media.addEventListener("change", onMediaChange);
    return () => this.#media?.removeEventListener("change", onMediaChange);
  }

  /** 设置主题偏好并持久化；“跟随系统”清除存储键，此后随系统偏好实时变化。 */
  setPreference(preference: ThemePreference): void {
    this.preference = preference;
    if (preference === "system") {
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {
        // localStorage 不可用（隐私模式等）时仅本次会话生效
      }
      this.#apply(this.#systemTheme());
      return;
    }
    this.#apply(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
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

  #systemTheme(): ThemeName {
    const media = this.#media ?? window.matchMedia("(prefers-color-scheme: dark)");
    return media.matches ? "dark" : "light";
  }

  #apply(next: ThemeName): void {
    document.documentElement.dataset.theme = next;
  }
}

export const theme = new ThemeStore();
