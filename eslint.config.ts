import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import betterTailwindCss from "eslint-plugin-better-tailwindcss";
import importX from "eslint-plugin-import-x";
import { configs as svelteConfigs } from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

import svelteConfig from "./svelte.config.ts";

export default tseslint.config(
  // 忽略清单
  {
    ignores: [
      ".svelte-kit/", // SvelteKit 构建产物
      "build/", // SSG 输出目录
      "**/*.generated.ts", // 代码生成产物
      "node_modules/",
      ".output",
      ".vercel",
      ".netlify",
      ".wrangler", // 平台部署目录
      ".DS_Store",
      "Thumbs.db", // OS 元数据
      ".env",
      ".env.*",
      "!.env.example",
      "!.env.test", // 环境变量（保留模板）
      "vite.config.js.timestamp-*",
      "vite.config.ts.timestamp-*",
      "src/lib/paraglide", // Paraglide JS i18n 生成代码，见 AGENTS.md
      "project.inlang/cache/", // inlang 缓存
      ".vite",
      "/legacy", // 旧版页面归档
      "static/bms/", // BMS 数据（CI 填充 + git 内目录）
    ],
  },

  // 预置推荐配置

  // @eslint/js recommended —— 核心 JS 规则（防止变量未使用/未定义等基本问题）
  js.configs.recommended,

  // typescript-eslint recommended-type-checked —— 依赖类型信息的 TS 规则
  // 包含：no-unsafe-* 系列、no-floating-promises、no-misused-promises 等
  // 覆盖 JS recommended 中与之重复的规则
  ...tseslint.configs.recommendedTypeChecked,

  // typescript-eslint stylistic-type-checked —— 代码风格类 TS 规则（需类型信息）
  // 包含：prefer-nullish-coalescing、prefer-optional-chain、consistent-type-definitions 等
  ...tseslint.configs.stylisticTypeChecked,

  // 全局规则
  {
    languageOptions: {
      parserOptions: {
        projectService: true, // TypeScript 语言服务（比 project 更快、更省内存）
        allowDefaultProject: true, // 允许不在 tsconfig 中的文件使用类型信息
      },
      globals: {
        ...globals.browser, // 浏览器全局（window、document 等）
        ...globals.node, // Node.js 全局（process、Buffer 等——SSG 构建环境）
      },
    },
    plugins: {
      "import-x": importX, // eslint-plugin-import-x：ESM 导入规则
    },
    rules: {
      // --- TypeScript 增强规则 ---

      // 禁用 explicit any。any 会绕过所有类型检查，应优先用 unknown 或具体类型。
      // 设为 warn 而非 error 以允许渐进式迁移。
      "@typescript-eslint/no-explicit-any": "warn",

      // 禁止未处理的 Promise。未 .catch() 且未 await 的 Promise 若 reject 会导致
      // unhandled promise rejection，在 Node.js 未来版本会直接崩溃。
      "@typescript-eslint/no-floating-promises": "error",

      // 禁止在非 Promise 上下文中使用 Promise。例如 if (promise) 永远为真，
      // 应写为 if (await promise)。也覆盖 .catch() 位置等。
      "@typescript-eslint/no-misused-promises": "error",

      // 禁止 require()。项目已全面使用 ESM (import/export)，require() 应避免。
      "@typescript-eslint/no-require-imports": "error",

      // 禁止定义了但未使用的变量。argsIgnorePattern 允许以 _ 开头的参数。
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // 只允许 throw Error 对象（或继承自 Error 的类）。
      // throw 字符串或字面量不会产生 stack trace，调试困难。
      "@typescript-eslint/only-throw-error": "error",

      // --- import-x 规则 ---

      // 禁止同一模块的重复导入。避免冗余 import 语句。
      "import-x/no-duplicates": "error",

      // 强制 import 语句的排序分组：
      // builtin（fs/path）→ external（svelte/react）→ parent（../）→ sibling（./）
      // → index → object → internal。组间空行分隔，组内按字母序。
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "parent", "sibling", "index", "object", "internal"],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
    },
  },

  // Svelte 文件配置

  // eslint-plugin-svelte 推荐规则：涵盖 Svelte 5 最佳实践
  // 含 infinite-reactive-loop、no-dom-manipulating、require-event-dispatcher-types 等
  ...svelteConfigs["flat/recommended"],

  // 关闭与 Prettier 冲突的 Svelte 规则
  svelteConfigs["flat/prettier"],

  {
    files: ["**/*.svelte", "**/*.svx", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser, // Svelte 模板内 <script> 用 TS 解析
        projectService: true,
        extraFileExtensions: [".svelte", ".svx"],
        svelteConfig, // 读取 svelte.config.js 以知晓编译器选项
        svelteFeatures: {
          runes: true, // 显式启用 Svelte 5 runes 模式解析
        },
      },
    },
    rules: {
      // 在 Svelte 文件中，generic constructors（new Map()、new Set() 等）的泛型参数
      // 常被 Svelte 编译器转换影响，导致误报。关闭。
      "@typescript-eslint/consistent-generic-constructors": "off",

      // 按钮应显式声明 type 属性（button/submit/reset）。
      // 默认 type="submit" 可能意外触发表单提交。
      "svelte/button-has-type": "warn",

      // target="_blank" 需配合 rel="noopener noreferrer"，
      // 否则新页面可通过 window.opener 操作原页面。
      "svelte/no-target-blank": "warn",
    },
  },

  // SvelteKit 组件覆写——以下组件使用 <a href> 进行外部导航（非 SvelteKit 路由），
  // 不需要 svelte/no-navigation-without-resolve 校验。
  {
    files: [
      "src/lib/components/bms/BmsTablePage.svelte",
      "src/lib/components/bms/GroupedTablesSection.svelte",
      "src/lib/components/ui/IconButton.svelte",
      "src/lib/components/ui/GradientButton.svelte",
      "src/lib/components/ui/GlassCard.svelte",
      "src/lib/components/ui/GlassButton.svelte",
      "src/lib/components/BreadcrumbNav.svelte",
      "src/lib/components/FloatingToc.svelte",
    ],
    rules: {
      "svelte/no-navigation-without-resolve": "off",
    },
  },

  // Tailwind CSS 规则
  {
    files: ["**/*.{js,jsx,ts,tsx,svelte,svx}"],
    plugins: {
      "better-tailwindcss": betterTailwindCss, // ESLint 插件：格式化与校验
    },
    rules: {
      // 强制 class 属性中 Tailwind 类的顺序一致（基于 Tailwind 规范顺序）
      "better-tailwindcss/enforce-consistent-class-order": "error",
      // 强制 !important 修饰符在 class 字符串中位置一致（推荐放在最前）
      "better-tailwindcss/enforce-consistent-important-position": "error",
    },
  },

  // Prettier 兼容（必须在最后）——关闭所有与 Prettier 冲突的格式化规则
  eslintConfigPrettier
);
