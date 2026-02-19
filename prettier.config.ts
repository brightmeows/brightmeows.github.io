import type { Config } from "prettier";

const config: Config = {
  // 基础格式化选项
  singleQuote: false, // 不强制单引号
  semi: true,

  // 插件配置（顺序很重要！）
  plugins: ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],

  // Tailwind CSS v4 配置
  tailwindStylesheet: "./src/routes/layout.css",

  // Svelte 插件配置
  svelteSortOrder: "options-scripts-styles-markup",
  svelteStrictMode: false,

  // 其他选项
  tabWidth: 2,
  useTabs: false,
  trailingComma: "es5",
  printWidth: 100,
};

export default config;
