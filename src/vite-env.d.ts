/**
 * Vite 环境变量类型声明
 */
interface ImportMetaEnv {
  SSR?: boolean;
  BASE_URL?: string;
  MODE?: string;
  DEV?: boolean;
  PROD?: boolean;
}

interface ImportMeta {
  env?: ImportMetaEnv;
}

/** 构建期注入的站点语言（见 vite.config.ts define）。 */
declare const __SITE_LOCALE__: "en" | "zh-cn" | "ja";
