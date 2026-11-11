# 镜像表内核（packages/mirror/）— AGENTS.md

本文件收录镜像表内核的约束与镜像数据纪律；站点侧见 `src/AGENTS.md`，Worker 侧见 `packages/worker/AGENTS.md`。

## 约定

- **`packages/mirror/`（`@brightmeows/mirror`）** — 镜像表内核（URL 构造、清单变换、bmstable meta 渲染、API 契约），由站点、Worker 与脚本经 exports 子路径（`manifest`/`user-layer`/`urls`/`types`/`shared`/`api`）导入。
  - 约束：无任何 dependencies（无 Svelte/DOM/Node 依赖）、可擦除语法、相对导入带 `.ts` 扩展名；以 TS 源直出（`exports` 指向 `src/*.ts`，零构建），包 tsconfig 的 `erasableSyntaxOnly` 与 `verbatimModuleSyntax` 机械守住可擦除与显式 `import type` 两条。
  - 三种运行时共有的宿主 API（目前只有 `URL`）在 `src/globals.d.ts` 按最小面声明，不引入 DOM / Node / Workers 任一侧的全局类型。
  - Node 直接执行脚本时经 pnpm 的符号链接解析到 `node_modules` 之外的真实路径才能剥离类型——`--preserve-symlinks` 或把包实体复制进 `node_modules` 的布局会打破这条路径。
- **API 契约在 `src/api.ts`（`./api` 子路径）** — `/api/*` 端点的响应类型、窄化函数（含字段级兜底）、错误封套与错误码常量表（`API_ERROR_CODES`）。
  - 消费方三方：Worker handlers（响应构造以 `json<契约类型>` 标注、报错引用常量）、站点客户端（`src/lib/data` 的端点函数用窄化兜底）、脚本内部客户端。
  - 窄化失败返回 null 或兜底值、不做 i18n（文案由调用方翻译，内核无消息依赖）；admin 端点窄化自 2026-10 起与其他端点同规（此前客户端是类型断言、无运行时校验）。
  - 兜底语义由 `api.test.ts` 锁定——非 admin 端点与 2026-10 之前的客户端实现逐字段一致，admin 端点语义见各函数注释；改兜底前先确认不是在改对外行为。
- **`<meta name="bmstable">` 有两个来源** — 自托管表由 `[table]/+page.server.ts` 经 `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>` 注入（`./header.json`）。
  - 镜像表由 Worker 运行时注入到 SPA 外壳的 `<head>`（绝对 R2 地址），两处共用 `injectBmstableMeta`。
- **仓库里没有任何派生数据** — `static/bms/table/mirror/` 已于 2026-09 清空（旧的静态 stub 与 `tables.json` 删除）；同月又删掉最后一份派生文件 `src/lib/mirror/table-manifest.json`（清单快照，约 230KB）。
  - **R2 是唯一权威源**；静态宿主已退役，镜像页与 `tables.json` 全部由 Worker 运行时应答。
- **用户层匹配口径在 `src/user-layer.ts`** — URL 匹配统一走 `tableUrlKey` 宽松键
  （`normalizeTableUrl` 后折叠尾斜杠），目录名兜底走 `dirNameSet`，撤销索引由
  `buildRevocationIndex` 构建；读取侧合并器（`mergeTableList`）、抓取侧合并器
  （管线 `mergeActiveSet`）与添加准入（Worker `handleAdd`）三处消费同一套谓词，
  撤销优先级统一为“删除与禁用先于添加”。改匹配语义只改这里。
- **镜像表目录名 `dir_name` 由数据管线生成** — 格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`），与 R2 目录名一致；Worker 的清单校验与站点清单变换直接消费该字段，缺失即失败。不要改为纯数字或 UUID 标识符。
- **共享表内核在 `src/shared.ts`（`./shared` 子路径）** — 服务端与前端必须共用同一套（错译键即不一致）。
  - id 规则（NFC 归一 + ASCII 大小写折叠 + `[a-z0-9-]` 与中日韩字符集 + 保留词 `new`/`edit`，`.` 不入字符集故天然挡掉 `tables.json`）、三档上限（header 1MB / data 10MB / 条目 10000）、载荷校验与导出改写（下载时 `data_url` → `./data.json`）全在这里。
  - R2 对象键用原始 id（`sharedObjectPrefix`），公开 URL 才经 `encodeTableId` 百分号编码。
  - `shared/` 是与 `tables/` 平行的独立命名空间，镜像管线的 rclone 白名单不含它——**共享表永远不要并入 `tables/` 或镜像清单**，否则会被管线当镜像表重抓、并混进 BeMusicSeeker 清单。

## 反直觉决策

以下行为在代码中看似冗余，但均为故意。

- **共享表 JSON 序列化给 trophy 数值补写小数点** — `serializeSharedJson`（`src/shared.ts`）对 `missrate`/`scorerate` 的整数值输出 `5.0` 而非 `5`。
  - 原因：難易度表规范把这两处定义为 Float，beatoraja 内置的 2018 年版 jbmstable-parser 对其做 `(double)` 原始类型强转，`JSON.stringify` 的整数形式会让已装机用户（0.8.9 在内）导入即抛 ClassCastException。
  - 覆盖面：Worker 写 R2 与客户端导出的共享表产物都经它序列化，不要“简化”回裸 `JSON.stringify`；镜像表不经它——字节透传是保真约定，源站的整数 trophy 属源站问题。
