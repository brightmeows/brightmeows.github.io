# BMS 表内容域（packages/bms/）— AGENTS.md

本文件收录 BMS 表内容域纯逻辑的约束与子路径分工；站点侧见 `src/AGENTS.md`，镜像表内核见 `packages/mirror/AGENTS.md`。

## 约定

- **`packages/bms/`（`@brightmeows/bms`）** — BMS 表内容域的纯逻辑（格式模型、文件解码、图表视图变换、编辑器纯逻辑、段位），2026-10 自 `src/lib/utils`、`src/lib/types`、`src/lib/constants` 迁出成包。**单消费方**：只有站点导入（scripts 管线与站点经 R2 数据解耦、零代码共享，镜像契约由 `@brightmeows/mirror` 承担），拆包的收益是 oxlint 之外的类型级边界强制——域逻辑不得反向触碰站点层（`$lib`），由包 tsconfig 的独立类型上下文机械守住。约束沿袭 mirror 口径：只依赖 `@brightmeows/mirror`（`editor` 用 `applyEntryFields`）、无 UI / DOM / Node 依赖、可擦除语法、相对导入带 `.ts` 扩展名、以 TS 源直出（`exports` 指向 `src/*.ts`，零构建）；唯一宿主 API（`TextDecoder`/`TextEncoder`，BMS 文件编码嗅探）在 `src/globals.d.ts` 按最小面声明。
- **子路径与角色** — `format` 表内容格式模型（`ChartData`/`DifficultyGroup`/`HeaderData`，视图交互类型留在站点 `src/lib/types/bms-view.ts`）；`file` BMS 谱面文件解码（编码嗅探、MD5/SHA-256、头部字段提取）；`table` 图表视图变换（分组、统计、等级排序、谱面链接）；`transform` 表内容变换；`editor` 编辑器纯逻辑与载荷类型（`TableEditPayload`、草稿键）；`course` 段位（course）逻辑；`constants` 域常量。
- **类型检查门槛** — `pnpm check:bms`（pre-commit 与 CI 的 check job 均跑），包内测试随文件迁移，vitest 的 `packages/**/*.test.ts` include 天然覆盖。

## 挂起项

- **`shared-table.ts` 迁入** — 共享表域逻辑（id/路径/元数据纯函数）依赖 paraglide 的 `m()`（i18n 生成物不入包），待其改为返回错误码、由调用方翻译后迁入 `shared` 子路径。
