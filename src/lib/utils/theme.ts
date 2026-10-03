/**
 * 主题偏好的纯逻辑（无 DOM 依赖，可单测）。
 *
 * 值域注意：`light` 指站点原本的蓝紫星空外观，`dark` 指夜空压到近黑的
 * 深色端；两套主题都是深色界面（`color-scheme: dark`），命名只表达深浅两档，
 * 与白底浅色模式无关。首屏应用见 `src/app.html` 的内联脚本，运行时状态见
 * `src/lib/data/theme-store.svelte.ts`。
 */

/** 主题名。 */
export type ThemeName = "light" | "dark";

/** localStorage 中保存主题偏好的键名（app.html 内联脚本按同一约定读取）。 */
export const THEME_STORAGE_KEY = "theme";

/** 把存储值收窄为主题名；非法或缺失返回 null。 */
export function parseThemeName(value: string | null): ThemeName | null {
  return value === "light" || value === "dark" ? value : null;
}

/** 解析生效主题：有手动选择用手动选择，否则跟随系统偏好。 */
export function resolveTheme(stored: string | null, prefersDark: boolean): ThemeName {
  return parseThemeName(stored) ?? (prefersDark ? "dark" : "light");
}
