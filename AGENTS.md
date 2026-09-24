# 白喵斯的小屋 — AGENTS.md

本文件收录全局规则与文档地图；域内细节见子文档。

## 文档地图

- `src/AGENTS.md` — 站点域：SvelteKit 应用、Markdown 管线（SvelTeX）、博客、组件与数据层。
- `packages/mirror/AGENTS.md` — 镜像表内核：URL 构造、清单变换、用户层类型与镜像数据纪律。
- `packages/worker/AGENTS.md` — Cloudflare Worker：镜像路由、写接口、D1、部署与 Cloudflare 外部状态。
- `scripts/AGENTS.md` — 仓库校验脚本、数据管线、抓取工作流与对拍。

同一事实只在所属子文档维护，本文件只留指针；跨域基础设施约定留在本文件（归属存疑时按此判断）。

## Commands

### Pre-commit（提交时自动执行）

首次 clone 后执行一次 `pre-commit install`（配置了 `default_install_hook_types: [pre-commit, commit-msg]`，会同时安装提交信息检查）。

```bash
pre-commit run --all-files --quiet    # 手动触发全部 hooks
```

Hooks：`pnpm format:check`、`pnpm lint`、`pnpm check`、`pnpm check:mirror`、`pnpm check:worker`、`pnpm test`、no-confusable-unicode、cn-quotes、conventional-commit（commit-msg stage 校验提交信息）。

### 手动命令

- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm check:config` — 配置一致性校验（离线，毫秒级）

域内命令见子文档：部署与 wrangler 相关在 `packages/worker/AGENTS.md`；管线、抓取、对拍与校验脚本在 `scripts/AGENTS.md`。

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意；本文件收录跨域基础设施条目，域内条目见子文档。

- **测试只覆盖纯函数层** — vitest 覆盖 `src/lib/utils/`、生成器脚本、`packages/mirror` 与 `packages/worker` 里的纯函数（`include` 含 `packages/**/*.test.ts`；`packages/worker/tsconfig.json` 把 `*.test.ts` 排除在 Worker 类型上下文外，那里没有 vitest 与 Node 的类型；`packages/mirror/tsconfig.json` 则连同测试一起检查，vitest 经根 `node_modules` 解析），测试文件为相邻 `*.test.ts`；组件（需 browser mode）与数据层（需 fs/fetch fixture）刻意不覆盖，避免依赖与 CI 复杂度膨胀。`pnpm test` 与 format/lint/check 同为门槛，pre-commit 与 CI 都会跑，失败阻断提交与部署。给非纯函数层加测试依赖或测试文件前先确认范围。
- **auto-merge 合并的 PR 不触发 push 工作流** — GitHub 对 `GITHUB_TOKEN` 触发的事件有反递归机制：`dependabot-auto-merge.yml` 启用 auto-merge 后，服务端完成合并产生的 push 事件不会触发 CI/Deploy（只留下 dependabot 的 dynamic 事件）。后果是依赖更新合并后不会立即部署与同步：站点部署由 `deploy.yml` 每 6 小时的 schedule 兜底，仓库镜像由 `mirror.yml` 的每日 schedule 兜底，也可手动 dispatch。手动 `gh pr merge` 用个人 token，不受影响，正常触发。
- **分支 ruleset 不放行任何直推** — ruleset `main-branch-protection` 禁止直接 push main 并要求 PR + 必过检查（见“分支与工作树”）。2026-09 之前 update-tables 需要直推清单快照，bypass actors 里因此有 DeployKey；列表变动改由 App token 触发下游后这条直推已删除，**bypass actors 应为空**。若发现其中仍有 DeployKey 条目，属于遗留配置，应移除。CI job 增删或改名时，ruleset 的 required_status_checks context 必须同步更新，否则 PR 合并被永久阻塞。
- **ruleset 不得启用 Restrict updates 规则** — 实测 ruleset 的 `update` 类型规则会把 PR 合并一起拦死：它只允许 bypass actor 更新 matching refs，而 PR 合并也是 ref 更新，启用后 PR 的 mergeStateStatus 恒为 BLOCKED（GitHub 报 “base branch policy prohibits the merge”），checks 全绿也无法合并。禁止直接 push main 由 `pull_request` 规则独立承担（已实测其拦直推），不要重新加回 `update` 规则。诊断提示：BLOCKED 且 checks 全绿时，先检查 ruleset 是否含 `update` 规则。
- **`pnpm-workspace.yaml` 的 `allowBuilds` 由 pnpm 11 维护** — 遇到未决的 build script 时 pnpm 会自动写入占位符（值为字面量 `set this to true or false`），带着占位符提交会让 CI 的 install 直接失败。本地需改成明确的 `true`/`false` 再提交。
- **pnpm 设置只在 `pnpm-workspace.yaml`** — pnpm 11 起 `.npmrc` 只读 registry/auth 设置，`engineStrict: true`（依赖 engines 与当前 Node 不匹配即安装失败）与工作区 `packages` 都在此文件；旧 `.npmrc` 里的 `engine-strict` 被 pnpm 11 静默忽略，2026-09 迁入并启用，`.npmrc` 已删除。
- **本地 install 可能因 npmmirror 同步延迟失败** — 全局 registry 指向 `registry.npmmirror.com`，其同步有延迟（曾出现 `@inlang/paraglide-js` 2.25.2 缺失导致 `--frozen-lockfile` 报 404）。另一类症状是 npmmirror 缺 `@lix-js/sdk-*` 平台包的 manifest（tarball 可下、元数据 404），pnpm 的 lockfile 供应链校验（`minimumReleaseAge`）会因此报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。两种都可用 `pnpm install --registry=https://registry.npmjs.org` 绕过；报策略错时包其实已装好，脚本可继续用。CI 使用官方源，不受影响。
- **同一事实只允许一个权威点，其余由门槛机械守住** — `config/site.json` 是站点与部署配置的单一来源；不能 import 它的地方（`wrangler.jsonc` 的 routes 与 vars、工作流 YAML、`.nvmrc` 与 `devEngines.packageManager`）由 `scripts/check-site-config.ts` 的八条断言守住，进 pre-commit 与 `pnpm check:config`。工作流里**任何位置（含注释）**都不该出现域名：域名通过 `--target=<目标名>` 交给脚本从配置解析。唯一豁免是仓库自身的远程地址（`git@github.com:owner/brightmeows.github.io.git`）—— 其中的 `brightmeows.github.io` 是仓库名。
- **`config/site.json` 是站点与部署配置的单一来源** — 字段：`origin`（站点规范域）、`targets[]`（部署目标：cloudflare/worker + hosts；两个静态目标的 `siteBase` 为与 target 名对齐的子域、`legacyHosts` 为平台原域）、`r2.base`/`r2.manifestObject`/`r2.baselineObject`/`r2.corsOrigins`。能 import 的消费者直接 import（`src/lib/constants/r2.ts`、`src/lib/constants/site.ts` 同时导出 `apiBase()` 与 `LEGACY_ORIGIN_REDIRECTS`）；不能 import 的（Worker 的 `vars`、`wrangler.jsonc` 的 routes、工作流里的域名）由 `scripts/check-site-config.ts` 断言一致（含“静态 siteBase 主机必须等于 `<target 名>.<主站 host>`”）。桶名不入该配置：它只出现在 `wrangler.jsonc` 的 R2 binding（部署期配置，无法用 secret 注入）与 Actions secret（管线 S3 凭据）里，凭据本身不入库。
- **外部状态只把桶 CORS 来源纳入仓库** — 它是唯一“改了仓库但线上没跟上就静默退化”的外部状态（漏放时原生客户端正常、只有浏览器失败）。期望值在 `config/site.json` 的 `r2.corsOrigins`，由 `scripts/check-r2-cors.ts` 只读比对，`.github/workflows/config-drift.yml` 在配置变更的 PR 与手动触发时跑（复用 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`，桶名见 `packages/worker/AGENTS.md` 的绑定说明）。其余外部状态（zone 开关、DNS 记录、Pages 域绑定与 git-pages 的 TXT 授权、ruleset、secrets）维持文档口径——其中 DNS 与 Pages 域是发布链路的硬前提：静态子域的灰云 CNAME、GitHub Pages 的自定义域绑定与 HTTPS 强制、Codeberg 的 `_git-pages-forge-allowlist` TXT 授权；需要 DNS 编辑权限的凭据（wrangler 的 OAuth scope 不含 DNS，只能控制台或临时令牌）。
- **浏览器侧取数依赖 R2 桶的 CORS policy** — 镜像表 viewer 与谱面搜索都在客户端直连 R2（`r2TableHeaderUrl()`/`r2TableDataUrl()`、`R2_INDEXES_BASE`）。bucket 未放行站点来源时，浏览器报 `Failed to fetch`（viewer）与“索引加载失败”（搜索），而 beatoraja 等原生客户端不受影响，容易误判为代码缺陷。**期望来源写在 `config/site.json` 的 `r2.corsOrigins`**（三个站点域 + 本地端口），线上值用 `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` 只读比对；policy 位置在 Cloudflare 控制台 R2 → 桶 → Settings → CORS Policy。改域或新增来源时先改配置再同步线上（`config-drift.yml` 会在配置变更的 PR 上拦一次）。验证：`curl -sI -H "Origin: https://miyakomeow.site" <R2 header 地址> | rg -i access-control` 应出现 `access-control-allow-origin`。
- **旧客户端 UA 是否被拦由 zone 级 Browser Integrity Check 决定** — 实测 `Java/1.8.x`、`Python-urllib`、`libwww-perl` 在 r2.dev、R2 自定义域与 workers.dev 上一律 403（Cloudflare error 1010），根因是 Browser Integrity Check，不是 r2.dev 的特有策略。本 zone 已关闭该开关（`browser_check = off`），因此 `bms-table-mirror-r2.miyakomeow.site` 与站点对旧 UA 全部放行；r2.dev 已于 2026-09-19 关闭（API：`PUT /accounts/{id}/r2/buckets/{bucket}/domains/managed`，body `{"enabled":false}`）。开关位置：控制台 zone → Security → Settings，或 `PATCH /zones/{id}/settings/browser_check`。
- **CI 与 Deploy 的检查分工** — CI 的 lint/test/format 不依赖 build 产物（把 `build/` 移走后全部通过），因此只有 check job 跑一次 `pnpm build`，作为 CI 里唯一的构建验证点（frontmatter 校验、构建期数据加载与打包错误都在这里暴露）；Deploy 只做 build、部署与镜像页生成，不重复 lint/check/test——main 的每次提交已由 PR 必过门槛与 push 触发的 CI 覆盖，所有变更都经 PR——列表变动改由 App token 触发下游，不再产生直推。各工作流持有独立 concurrency group：CI 与 Codeberg 取消被取代的旧运行，Deploy 排队串行（避免旧提交的部署最后完成、覆盖新版本）；各作业均设超时（CI/Deploy 15 分钟、config-drift 10 分钟、update-tables 30 分钟、fetch-table 15 分钟、Codeberg 20 分钟），防挂起占满 runner。
- **pnpm 缓存只配置一处** — `pnpm/action-setup` 的 `cache: true` 与 `actions/setup-node` 的 `cache: "pnpm"` 缓存的是同一个 pnpm store（实测两份缓存哈希相同、每个 job 各恢复约 312MB）。统一只保留 setup-node 的 `cache: "pnpm"`，不要再给 pnpm/action-setup 加缓存输入。

## Lint 与校验

- **lint 不含 Svelte 模板级 linter** — 曾用 oxvelte（cargo 全局二进制）补 Svelte 模板规则，其上游 2026 年 5 月起停更、且依赖仓库外的 cargo 全局安装不可复现，已移除。现 `lint` 仅 oxlint（查 `.svelte` 的 script 块）加 svelte-check（编译期诊断）。代价是失去 `svelte/button-has-type` 与 `svelte/no-target-blank` 两条 warn。回归路径（跟踪 oxc issue #15761 “SFC Template Support”）：oxlint 支持自定义文件解析器后接 eslint-plugin-svelte 或原生规则。不要因“模板无 lint”而重新引入停更工具。
- **oxlint 规则集按“零命中”原则扩展** — `correctness` 类别全开（试跑确认 39 条规则当前 0 命中，10 条死 disable 指令已清理），其余类别只显式挑选。以下规则经实测刻意不启用：`unicorn/no-array-sort`（要求 toSorted，超出 browserslist 兼容范围）、`unicorn/require-post-message-target-origin`（官方文档自述在 Worker 场景误报）、`eslint/no-underscore-dangle`（`_nextId` 等刻意私有命名）、`eslint/no-await-in-loop`（batch 搜索有意串行）、`typescript/no-unnecessary-type-conversion`（暴露的是实际数据与声明类型不符，待运行时校验补齐）。不要“顺手”开 suspicious 全类。
- **`lint` 带 `--deny-warnings` 与 `--report-unused-disable-directives`** — warn 同样导致失败；失效的 disable 指令会被检出。
- **`check` 带 `--fail-on-warnings`** — Svelte 编译器与 a11y 警告按错误处理。
- **架构边界由 `no-restricted-imports` 强制** — `$lib/loaders`（构建期 Node 层）只能从 `*.server.ts` 导入，客户端代码引用会在 lint 阶段失败。新增构建时数据入口时走此边界。
- **blog frontmatter 在构建期校验** — `validateFrontmatter` 校验 title/date/order/slug/description/tags，非法值直接让 `pnpm build` 失败。不要降级为警告或静默回退，坏数据会在页面上悄悄变形。

## 架构边界

- **纯 SSG（含一处边缘例外）** — `@sveltejs/adapter-static` + 全局 `prerender = true`，不加 server routes / API endpoints。例外是 Cloudflare Worker（`packages/worker/index.ts`）承担的镜像表动态路由与写接口：它先接管 `/bms/table/mirror/*` 与 `/api/*`（`assets.run_worker_first`），其余请求全部回落静态资源。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- SvelTeX 0.5（Markdown 预处理器：unified 后端 + remark-gfm + katex + shiki）（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- tsconfig 已开启 `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`（2026-09）—— 两者分别修复 45 处与 27 处真实未定义状态问题后开启。批量修法：`exactOptionalPropertyTypes` 要求给类型定义的可选属性显式写 `| undefined`（项目里确实存在“显式传 undefined”的语义，如调用方把 `string | undefined` 直接放进字面量）；`noUncheckedIndexedAccess` 优先真修（用 `entries()` 遍历消除索引访问、用解构加逐项检查替代 `some` 加 `as` 断言），确证安全处（循环内已保证边界、测试里已有前置断言）用 `!`。开启后 oxlint 的 `prefer-nullish-coalescing` 会多报几处，属预期。
- Vitest 5（纯函数单测，Node 环境）
- Node 版本以 `.nvmrc` 为准（工作流用 `node-version-file: .nvmrc`）；pnpm 版本以 `package.json` 的 `devEngines.packageManager` 范围为准（工作流不传 `version`，解析结果记入 lockfile）。两者都由 `pnpm check:config` 断言
- Paraglide JS（i18n，仅 demo 用）

## 依赖升级挂起项

以下升级经评估后刻意挂起，勿随批升级，各等触发条件：

- **typescript 6 到 7** — TS 7 为 Go 原生移植。svelte-check 需 `--tsgo` 旗标且 TS 6/7 双装；SvelteKit 依赖的 `rootDirs` 适配已被官方关闭为 not planned，长期方案是 Kit 3 扁平化配置。触发条件：Kit 3 stable 后一起动。oxlint-tsgolint 7 自带 TS 7 语义的类型检查引擎，与项目 typescript 版本解耦，互不阻塞。
- **katex 0.17 到 0.18** — 0.18.0 对 CSS class 加前缀（`.strut` 变 `.katex-strut` 等），与渲染器输出不匹配会导致公式排版退化；且 SvelTeX 的 peer range 为 `^0.16 || ^0.17`，尚不支持 0.18。触发条件：SvelTeX 放开 peer range 后，升级并目检博客数学页确认 `[&_.katex]` 系选择器仍命中。
- **SvelteKit 3** — RC 中。触发条件：stable 后用 `sv migrate sveltekit-3` 迁移，要点：`$lib` 改 `#lib`、配置扁平化、跨页 form actions 导航行为变更。

## 其他挂起项

- **knip 与 rumdl** — 分别扫描未使用文件/依赖/导出与 markdown lint。评估结论：knip 需为刻意保留项配置豁免、rumdl 对当前 4 个源 md 收益有限，暂不引入。2026-09 复跑过一次 knip：5 个“未使用文件”全是 SvelteKit 特殊文件与动态 import 的误报，9 个“未使用 devDependencies”是 SvelteX 的动态导入依赖（见上文），唯一真实发现（barrel 冗余导出）已通过移除 barrel 解决——维持不引入的结论。触发条件：代码库规模或 md 数量显著增长。

## 分支与工作树

- **新分支在 `.worktrees/` 隔离开发** — `.worktrees/` 已 gitignore，用 `git worktree add .worktrees/<分支名> -b <分支>` 创建隔离工作树，不在主工作树上直接切分支。
- **变更一律走 PR，以 merge commit 合并** — main 不接受直接 push，一切变更经 PR 合并，代理会话不在 main 上直接提交。合并方式固定为 merge commit（`gh pr merge --merge`），不用 squash/rebase，保留分支拓扑与独立 revert 粒度。该要求由仓库 ruleset `main-branch-protection` 机械强制：禁直推、禁删除、禁 force push，PR 合并仅限 merge method，CI 的 lint/check/test/format/commit-msg 五个 job 必过。
- **分支合并即清理** — 分支经 PR 合并后立即清理现场，不留挂起引用：`git worktree remove .worktrees/<分支名>` 拆工作树，`git branch -d <分支>` 删本地分支，最后 `git fetch --prune` 收掉失效的 remote-tracking ref。远端分支由仓库设置 delete_branch_on_merge（已开启）随合并自动删除，但它不覆盖 PR 关闭未合并（方案否决）的情况，此时需手动 `git push origin --delete <分支>` 收尾。已合并与已关闭分支的 commit 由远端 PR 引用保留，本地不留存档分支，也不以“未合并”为由拖延清理。

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
