# 白喵斯的小屋 — AGENTS.md

## Commands

### Pre-commit（提交时自动执行）

首次 clone 后执行一次 `pre-commit install`（配置了 `default_install_hook_types: [pre-commit, commit-msg]`，会同时安装提交信息检查）。

```bash
pre-commit run --all-files --quiet    # 手动触发全部 hooks
```

Hooks：`pnpm format:check`、`pnpm lint`、`pnpm check`、`pnpm test`、no-confusable-unicode、cn-quotes、config-toml（`config/**` 变更时）、conventional-commit（commit-msg stage 校验提交信息）。

### scripts/ 校验脚本

- `scripts/check-cn-quotes.py` — 中文正文引号规范（GB/T 15834-2011）。跳过 YAML frontmatter、HTML 标签属性、行内代码与围栏代码块，这些位置的引号是语法而非中文文本。
- `scripts/check-config-toml.py` — `config/*.toml` 语法与关键字段校验（url 必须 http(s)、tag 字段类型、replace 的 from/to 非空、未知段报错）。这些文件由 bms-table-fetch 在 CI 中读取，本地校验把反馈从 6 小时缩短到提交时。
- `scripts/check-commit-msg.py` — Conventional Commits 格式校验（见“提交格式”节），pre-commit commit-msg stage 与 CI 的 PR job 共用。
- `scripts/check-site-config.ts` — 离线一致性校验（六条断言：`--target` 合法、wrangler routes ⊆ 配置、工作流无硬编码域名、快照路径三处一致、CORS 覆盖全部目标、版本来源唯一）。`pnpm check:config` 调用它，pre-commit 与 CI 都跑。
- `scripts/check-r2-cors.ts` — 只读比对桶 CORS policy 与配置（需 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`）；不在日常 CI 跑，由 `config-drift.yml` 在配置变更的 PR 与手动触发时调用。
- `scripts/site-config.ts` / `scripts/site-target.ts` — 读取并校验 `config/site.json`、打印某静态目标的站点基址（供工作流把域名从 YAML 里移出）。

### 手动命令

- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm exec wrangler deploy` — 把 `build/` 发布到 Cloudflare Workers（需环境变量 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`）
- `pnpm exec wrangler dev` — 本地 Workers 运行时，含 `/bms/table/mirror/*` 的动态路由（需先 `pnpm build`；这些路由在 `pnpm dev` 下不可用）
- `node scripts/sync-mirror-manifest.ts [--check]` — 比对 R2 清单与仓库快照，仅列表变动时写入（`--check` 只报告不写入）
- `node scripts/gen-static-mirror-pages.ts --target=<目标名> [--site-base=<域名>]` — 生成静态宿主的镜像页与站点清单（需先 `pnpm build`，完全离线；`--site-base` 仅本地演练覆盖）
- `pnpm check:config` — 配置一致性校验（离线，毫秒级）
- `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` — 与线上桶 CORS policy 比对（需 Cloudflare 凭据；只读）

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意，按域分类。

### 项目基础设施

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide i18n 基础设施全局加载但仅 `/demo/paraglide/` 生效** — `hooks.ts` 和 `+layout.svelte` 无条件导入 runtime（SSG 构建无法 tree-shake），但 `reroute` 钩子只对 `/demo/paraglide/` 路径触发。不要将 paraglide 扩展到其他路由。
- **测试只覆盖纯函数层** — vitest 仅覆盖 `src/lib/utils/` 与生成器脚本中的纯函数，测试文件为相邻 `*.test.ts`；组件（需 browser mode）与数据层（需 fs/fetch fixture）刻意不覆盖，避免依赖与 CI 复杂度膨胀。`pnpm test` 与 format/lint/check 同为门槛，pre-commit 与 CI 都会跑，失败阻断提交与部署。给非纯函数层加测试依赖或测试文件前先确认范围。
- **lint 不含 Svelte 模板级 linter** — 曾用 oxvelte（cargo 全局二进制）补 Svelte 模板规则，其上游 2026 年 5 月起停更、且依赖仓库外的 cargo 全局安装不可复现，已移除。现 `lint` 仅 oxlint（查 `.svelte` 的 script 块）加 svelte-check（编译期诊断）。代价是失去 `svelte/button-has-type` 与 `svelte/no-target-blank` 两条 warn。回归路径（跟踪 oxc issue #15761 “SFC Template Support”）：oxlint 支持自定义文件解析器后接 eslint-plugin-svelte 或原生规则。不要因“模板无 lint”而重新引入停更工具。
- **auto-merge 合并的 PR 不触发 push 工作流** — GitHub 对 `GITHUB_TOKEN` 触发的事件有反递归机制：`dependabot-auto-merge.yml` 启用 auto-merge 后，服务端完成合并产生的 push 事件不会触发 CI/Deploy（只留下 dependabot 的 dynamic 事件）。后果是依赖更新合并后不会立即部署与同步：站点部署由 `deploy.yml` 每 6 小时的 schedule 兜底，仓库镜像由 `mirror.yml` 的每日 schedule 兜底，也可手动 dispatch。手动 `gh pr merge` 用个人 token，不受影响，正常触发。
- **数据管线只提交清单快照，且只在列表变动时提交** — `update-tables` 先抓取并双向同步 R2，然后跑 `scripts/sync-mirror-manifest.ts`：比对 R2 清单与 `src/lib/mirror/table-manifest.json` 的投影（`dir_name` 集合 + 展示字段，不含 `date`/`comment`/`state`），**仅列表变动**时提交并以 `MIRROR_SYNC_DEPLOY_KEY`（仓库写权限 deploy key）推送，从而连锁触发 CI/Deploy/Mirror 重建三个目标。表内容更新不产生提交，因此不触发部署。快照位于 `src/lib/mirror/` 下，不命中本工作流的 `config/**` 过滤，不会自触发。用 deploy key 是因为 `GITHUB_TOKEN` 的 push 不会触发后续工作流。
- **分支 ruleset 放行 deploy key 直推 main** — ruleset `main-branch-protection` 禁止直接 push main 并要求 PR + 必过检查（见“分支与工作树”），历史上 update-tables 的生成物提交需要直推 main，现在仍需直推（清单快照），因此该 ruleset 的 bypass actors 包含 DeployKey。不要移除该 bypass，否则列表变动时快照推送会被拒。CI job 增删或改名时，ruleset 的 required_status_checks context 必须同步更新，否则 PR 合并被永久阻塞。
- **ruleset 不得启用 Restrict updates 规则** — 实测 ruleset 的 `update` 类型规则会把 PR 合并一起拦死：它只允许 bypass actor 更新 matching refs，而 PR 合并也是 ref 更新，启用后 PR 的 mergeStateStatus 恒为 BLOCKED（GitHub 报 “base branch policy prohibits the merge”），checks 全绿也无法合并。禁止直接 push main 由 `pull_request` 规则独立承担（已实测其拦直推），不要重新加回 `update` 规则。诊断提示：BLOCKED 且 checks 全绿时，先检查 ruleset 是否含 `update` 规则。
- **`pnpm-workspace.yaml` 的 `allowBuilds` 由 pnpm 11 维护** — 遇到未决的 build script 时 pnpm 会自动写入占位符（值为字面量 `set this to true or false`），带着占位符提交会让 CI 的 install 直接失败。本地需改成明确的 `true`/`false` 再提交。
- **本地 install 可能因 npmmirror 同步延迟失败** — 全局 registry 指向 `registry.npmmirror.com`，其同步有延迟（曾出现 `@inlang/paraglide-js` 2.25.2 缺失导致 `--frozen-lockfile` 报 404）。绕过方式为 `pnpm install --registry=https://registry.npmjs.org`。CI 使用官方源，不受影响。
- **同一事实只允许一个权威点，其余由门槛机械守住** — `config/site.json` 是站点与部署配置的单一来源；不能 import 它的地方（`wrangler.jsonc` 的 routes、工作流 YAML、`update-tables` 的 `git add` 路径、`.oxfmtrc.json` 的忽略项、`.nvmrc` 与 `packageManager`）由 `scripts/check-site-config.ts` 的六条断言守住，进 pre-commit 与 `pnpm check:config`。工作流里**任何位置（含注释）**都不该出现域名：域名通过 `--target=<目标名>` 交给脚本从配置解析。唯一豁免是仓库自身的远程地址（`git@github.com:owner/brightmeows.github.io.git`）—— 其中的 `brightmeows.github.io` 是仓库名。
- **外部状态只把桶 CORS 来源纳入仓库** — 它是唯一“改了仓库但线上没跟上就静默退化”的外部状态（漏放时原生客户端正常、只有浏览器失败）。期望值在 `config/site.json` 的 `r2.corsOrigins`，由 `scripts/check-r2-cors.ts` 只读比对，`.github/workflows/config-drift.yml` 在配置变更的 PR 与手动触发时跑（复用 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`，桶名仍不入库）。其余外部状态（zone 开关、自定义域、ruleset、secrets）维持文档口径。
- **三个部署目标，按目标分区** — Cloudflare Workers（主站 `miyakomeow.site`：静态资源 + Worker，镜像表页面与 `tables.json` 运行时生成，因此 `wrangler deploy` 必须排在生成步骤**之前**）；GitHub Pages（`brightmeows.github.io`）与 Codeberg Pages（`brightmeows.codeberg.page`）：后两者在构建后用 `node scripts/gen-static-mirror-pages.ts --target=<目标名>` 离线生成静态镜像页与自己的 `tables.json` 再发布（域名由脚本从配置解析，工作流里不再出现域名）（Codeberg 侧由 `.forgejo/workflows/deploy.yml` 跑同样流程，触发随镜像推送）。三处页面逐字节一致——Worker 与脚本共用 `src/lib/mirror/manifest.ts` 的注入与序列化函数。生成失败即整步失败，避免用缺页产物覆盖上一版仍可用的静态站点；Cloudflare 已先部署完成，属可接受的失败隔离。

### 构建与配置

- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`config/site.json` 是站点与部署配置的单一来源** — 字段：`origin`（站点规范域）、`targets[]`（部署目标：cloudflare/worker + hosts，两个静态目标的 siteBase）、`r2.base`/`r2.manifestObject`/`r2.snapshot`/`r2.corsOrigins`。能 import 的消费者直接 import（`src/lib/constants/r2.ts`、`src/lib/constants/site.ts`、`worker/index.ts`）；不能 import 的（`wrangler.jsonc` 的 routes、工作流里的域名）由 `scripts/check-site-config.ts` 断言一致。桶名刻意不在配置里（只存在于 Actions secret 与 Cloudflare 侧）。

### BMS

- **`<meta name="bmstable">` 有两个来源** — 自托管表由 `[table]/+page.server.ts` 经 `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>` 注入（`./header.json`）；镜像表由 Worker 运行时（Cloudflare）或构建期脚本（静态宿主）注入到 SPA 外壳的 `<head>`（绝对 R2 地址），两处共用 `injectBmstableMeta`。
- **仓库里只有清单快照，没有页面生成物** — `static/bms/table/mirror/` 已于 2026-09 清空（旧的静态 stub 与 `tables.json` 删除）。现在唯一入库的派生文件是 `src/lib/mirror/table-manifest.json`（R2 原始清单快照，约 230KB，由管线维护；`.oxfmtrc.json` 忽略它的格式，因为它由脚本按固定格式写出）。**R2 仍是唯一权威源**，快照只是构建与变更判定的输入；静态宿主的镜像页与 `tables.json` 都是构建期产物，不入库。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **镜像表单表页由 Worker 动态生成，静态宿主在构建期生成等价页面** — `worker/index.ts` 接管 `/bms/table/mirror/*`：`/bms/table/mirror/<dir_name>/` 取站点 SPA 外壳（构建产物 `404.html`）并把该表的 `<meta name="bmstable">` 注入 `<head>`，beatoraja / BeMusicSeeker 不执行 JS 直接读 meta，浏览器则由 `src/routes/bms/table/mirror/[name]/`（`prerender = false`）客户端路由渲染查看器；`/bms/table/mirror/tables.json` 同理由 R2 清单实时生成，`url` 字段用请求 origin。静态宿主用 `scripts/gen-static-mirror-pages.ts` 在构建期产出同样的文件（同一外壳、同一注入函数，实测逐字节一致），`url` 用 `--site-base` 指定的域名。校验策略：清单不可用返回 503、表不存在返回 404，清单读失败时先回落到 Cache API 快照。注入的 meta 必须独占一行：beatoraja 的 jbmstable-parser 按行扫描再按引号切分取第 4 段。
- **镜像表页面曾经是管线生成的静态 stub** — 2026-09 之前每个表在 `static/bms/table/mirror/<dir_name>/index.html` 有一份**提交物**，携带绝对 R2 header URL 与 JS 跳转；现改为运行时（Worker）与构建期（静态宿主脚本）生成，不再入库。形态也一并换了：导入地址与查看页合并为同一条 URL。
- **镜像表目录名 `dir_name` 来自 bms-table-fetch** — 格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`），与 R2 目录名一致；Worker 的清单校验与站点清单变换直接消费该字段，缺失即失败。不要改为纯数字或 UUID 标识符。
- **难度表数据管线在本仓 Actions 中运行** — `.github/workflows/update-tables.yml` 每 6 小时（或 `config/**` 变更时、手动 dispatch）用 `bms-table-fetch` 抓取难度表，经 rclone 与 Cloudflare R2 双向同步：先拉取 R2 基线保留增量，跑完抓取再推回。输出 `tables/`、`indexes/`、`lists/`、`warnings.log`（均 gitignored，仅存在于 CI 工作区与 R2）。数据源配置在 `config/table.toml`（`[[table]]`/`[[disable]]`/`[[replace]]`）与 `config/list.toml`（`[[source]]`）。R2 凭据以 Actions secrets 注入（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET`）。该管线原为独立的 Codeberg 壳子仓库 bms-table-mirror-r2，2026-09 迁入本仓并归档原仓；`bms-table-fetch` 二进制取自其 GitHub release（版本由工作流内 `BMS_TABLE_FETCH_VERSION` 固定）。R2 同步后，工作流比对清单与仓库快照、并按列表变动提交（见“反直觉决策 / 项目基础设施”里的快照条目）；页面类生成物不再入库。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。
- **浏览器侧取数依赖 R2 桶的 CORS policy** — 镜像表 viewer 与谱面搜索都在客户端直连 R2（`r2TableHeaderUrl()`/`r2TableDataUrl()`、`R2_INDEXES_BASE`）。bucket 未放行站点来源时，浏览器报 `Failed to fetch`（viewer）与“索引加载失败”（搜索），而 beatoraja 等原生客户端不受影响，容易误判为代码缺陷。**期望来源写在 `config/site.json` 的 `r2.corsOrigins`**（三个站点域 + 本地端口），线上值用 `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` 只读比对；policy 位置在 Cloudflare 控制台 R2 → 桶 → Settings → CORS Policy。改域或新增来源时先改配置再同步线上（`config-drift.yml` 会在配置变更的 PR 上拦一次）。验证：`curl -sI -H "Origin: https://miyakomeow.site" <R2 header 地址> | rg -i access-control` 应出现 `access-control-allow-origin`。
- **旧客户端 UA 是否被拦由 zone 级 Browser Integrity Check 决定** — 实测 `Java/1.8.x`、`Python-urllib`、`libwww-perl` 在 r2.dev、R2 自定义域与 workers.dev 上一律 403（Cloudflare error 1010），根因是 Browser Integrity Check，不是 r2.dev 的特有策略。本 zone 已关闭该开关（`browser_check = off`），因此 `bms-table-mirror-r2.miyakomeow.site` 与站点对旧 UA 全部放行；r2.dev 已于 2026-09-19 关闭（API：`PUT /accounts/{id}/r2/buckets/{bucket}/domains/managed`，body `{"enabled":false}`）。开关位置：控制台 zone → Security → Settings，或 `PATCH /zones/{id}/settings/browser_check`。
- **www 目前与 apex 同源返回站点，不是 301** — `run_worker_first` 只覆盖 `/bms/table/mirror/*`，所以 Worker 里的 `www` 判断对其他路径不生效，而边缘 301 需要 zone 上的 Single Redirect 规则（需 token 权限 `Zone > Single Redirect > Edit`）。在补上规则之前，www 会直接返回同一份站点，SEO 靠 layout 里的 canonical 收敛到 apex。
- **难度表导入链接与查看页是同一条 URL** — `/bms/table/mirror/<dir_name>/` 既是 beatoraja / BeMusicSeeker 的导入地址（beatoraja 对不以 `.json` 结尾的 URL 会当 HTML 页解析 `bmstable` meta，对 `.json` 结尾的 URL 直读 header），也是浏览器里的查看页；页面直接展示当前地址作为可导入链接（`BmsTablePage` 从地址栏取，带复制按钮）。`tables.json` 兼作 BeMusicSeeker 的难度表清单（超集字段）。旧的 `/bms/table/mirror/view/?t=…` 形态已于 2026-09 彻底移除：仓库中无对应路由，Worker 与静态产物都不提供，访问该路径得到 404。

### SvelTeX（Markdown 管线）

- **`frontmatter.head: false` 不删** — SvelTeX 默认把 frontmatter 的 title/meta 等注入页面 `<head>`，但本项目在 `+layout.svelte` 统一管理 `<svelte:head>`。保持关闭，否则页面会出现重复 `<title>`。`metadata` 导出不受影响（`+page.ts` 仍靠它读 title/date/order）。
- **`math.css.type: "none"` 不删** — 否则 SvelTeX 会从 CDN 注入 katex 样式表（hybrid 模式默认拉 jsdelivr）。本项目 katex CSS 由 `MarkdownContent.svelte` 本地 import，保证离线构建与版本一致。
- **`remark-gfm` 必须显式挂在 `markdown.remarkPlugins`** — SvelTeX 默认不启用 GFM（表格/任务列表/删除线），不挂就没有表格（已实测证实）。
- **`remark-retext` 是必需的依赖** — SvelTeX 的 unified 后端在 MarkdownHandler 里无条件 `await import('remark-retext')`，即使不用 `retextPlugins`。缺了它首次构建即报 `ERR_MODULE_NOT_FOUND`。
- **`katex` 固定在 `^0.17`** — 见上方挂起项。SvelTeX 的 peer range 不含 0.18。
- **扩展名两处注册** — `.md`/`.svx` 既要写进 SvelTeX 的 `extensions` 配置，也要写进 `svelte.config.ts` 顶层 `extensions`（Svelte 编译器层面）。漏掉任一处文件就不被处理。
- **`frontmatter` 导出为 `metadata` 对象** — 与 mdsvex 摊平成独立命名导出的行为不同，读取方式为 `post.metadata?.title`。类型声明见 `src/sveltex.d.ts`。
- **缩进代码块与自动链接被刻意禁用** — SvelTeX 为与 Svelte 语法共存而禁用这两者（同 MDX 的做法）。文章用围栏代码块和显式链接，不要用四空格缩进或裸 URL。

### 博客系统

- **`content/blog/` 存放博客源文件** — 位于项目根目录而非 `src/` 内，因为 `$blog` 别名路径用作模块 URL（Vite 处理 `import()` 时生成），若放在 `blog/` 则 URL 为 `/blog/xxx.md`，与路由 `/blog/[...slug]` 路径前缀冲突。`content/blog/` 的模块 URL 为 `/content/blog/xxx.md`，不冲突。
- **`loaders/blog.ts` 用 `process.cwd()`** — `BLOG_DIR` 常量值为 `"content/blog"`，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **博客路由 `[...slug]` 处理尾斜杠** — 全局 `trailingSlash="always"` 使 rest parameter 捕获末尾 `/`，在 `load` 中 `params.slug.replace(/\/$/, "")` 清理。
- **`src/sveltex.d.ts` 声明 Markdown 模块类型** — `*.md`/`*.svx` 导出 `default`（Svelte 组件）与 `metadata`（frontmatter 镜像，类型 `Partial<BlogPostMetadata>`）。

## Lint 与校验

- **oxlint 规则集按“零命中”原则扩展** — `correctness` 类别全开（试跑确认 39 条规则当前 0 命中，10 条死 disable 指令已清理），其余类别只显式挑选。以下规则经实测刻意不启用：`unicorn/no-array-sort`（要求 toSorted，超出 browserslist 兼容范围）、`unicorn/require-post-message-target-origin`（官方文档自述在 Worker 场景误报）、`eslint/no-underscore-dangle`（`_nextId` 等刻意私有命名）、`eslint/no-await-in-loop`（batch 搜索有意串行）、`typescript/no-unnecessary-type-conversion`（暴露的是实际数据与声明类型不符，待运行时校验补齐）。不要“顺手”开 suspicious 全类。
- **`lint` 带 `--deny-warnings` 与 `--report-unused-disable-directives`** — warn 同样导致失败；失效的 disable 指令会被检出。
- **`check` 带 `--fail-on-warnings`** — Svelte 编译器与 a11y 警告按错误处理。
- **架构边界由 `no-restricted-imports` 强制** — `$lib/loaders`（构建期 Node 层）只能从 `*.server.ts` 导入，客户端代码引用会在 lint 阶段失败。新增构建时数据入口时走此边界。
- **blog frontmatter 在构建期校验** — `validateFrontmatter` 校验 title/date/order/slug/description/tags，非法值直接让 `pnpm build` 失败。不要降级为警告或静默回退，坏数据会在页面上悄悄变形。

## 架构边界

- **纯 SSG（含一处边缘例外）** — `@sveltejs/adapter-static` + 全局 `prerender = true`，不加 server routes / API endpoints。例外是 Cloudflare Worker（`worker/index.ts`）承担的镜像表动态路由：它只先接管 `/bms/table/mirror/*`（`assets.run_worker_first`），其余请求全部回落静态资源。
- **BMS 数据源分流** — `static/bms/table/` 下只有自托管表（`self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/`）在 git 中；镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数：Cloudflare 由 Worker 生成，静态宿主由构建期脚本从快照生成。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts`、`url.ts` 除外）。任何环境可调用。
- **`src/lib/mirror/`** — 镜像表的零依赖层（URL 构造、清单变换、bmstable meta 渲染），由站点与 Worker（`worker/index.ts`）共用；约束：无 Svelte/DOM 依赖、可擦除语法、相对导入带 `.ts` 扩展名（Worker 由 wrangler/esbuild 打包，直接引用这些 `.ts` 文件）。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件与自托管 BMS 表的目录枚举。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **本地 `pnpm dev` 不提供 mirror 动态路由** — 列表页 `/bms/table/mirror/` 依赖 Worker 生成的 `tables.json`，本地 dev 下会报加载失败；单表页的 meta 注入也只存在于 Worker 运行时。验证 mirror 行为用 `pnpm build && pnpm exec wrangler dev`（`localhost:8787` 已在桶 CORS 放行）；想验静态宿主形态则 `pnpm build && node scripts/gen-static-mirror-pages.ts --site-base=http://127.0.0.1:8787` 后用静态服务器起 `build/`（本地演练用显式 site-base，因为配置里只有生产目标）。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语（barrel export 见 `ui/index.ts`），其余子目录为领域组件。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- SvelTeX 0.5（Markdown 预处理器：unified 后端 + remark-gfm + katex + shiki）（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Vitest 5（纯函数单测，Node 环境）
- Node 版本以 `.nvmrc` 为准（工作流用 `node-version-file: .nvmrc`）；pnpm 版本以 `package.json` 的 `packageManager` 为准（工作流不传 `version`）。两者都由 `pnpm check:config` 断言
- Paraglide JS（i18n，仅 demo 用）

## 依赖升级挂起项

以下升级经评估后刻意挂起，勿随批升级，各等触发条件：

- **typescript 6 到 7** — TS 7 为 Go 原生移植。svelte-check 需 `--tsgo` 旗标且 TS 6/7 双装；SvelteKit 依赖的 `rootDirs` 适配已被官方关闭为 not planned，长期方案是 Kit 3 扁平化配置。触发条件：Kit 3 stable 后一起动。oxlint-tsgolint 7 自带 TS 7 语义的类型检查引擎，与项目 typescript 版本解耦，互不阻塞。
- **katex 0.17 到 0.18** — 0.18.0 对 CSS class 加前缀（`.strut` 变 `.katex-strut` 等），与渲染器输出不匹配会导致公式排版退化；且 SvelTeX 的 peer range 为 `^0.16 || ^0.17`，尚不支持 0.18。触发条件：SvelTeX 放开 peer range 后，升级并目检博客数学页确认 `[&_.katex]` 系选择器仍命中。
- **SvelteKit 3** — RC 中。触发条件：stable 后用 `sv migrate sveltekit-3` 迁移，要点：`$lib` 改 `#lib`、配置扁平化、跨页 form actions 导航行为变更。

## 其他挂起项

- **tsconfig `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`** — 试跑分别命中 18 与 26 处真实未定义状态问题，修完后开启。触发条件：安排专门窗口做类型修复。
- **knip 与 rumdl** — 分别扫描未使用文件/依赖/导出与 markdown lint。评估结论：knip 需为刻意保留项配置豁免、rumdl 对当前 4 个源 md 收益有限，暂不引入。触发条件：代码库规模或 md 数量显著增长。

## 分支与工作树

- **新分支在 `.worktrees/` 隔离开发** — `.worktrees/` 已 gitignore，用 `git worktree add .worktrees/<分支名> -b <分支>` 创建隔离工作树，不在主工作树上直接切分支。
- **变更一律走 PR，以 merge commit 合并** — main 不接受直接 push，一切变更经 PR 合并，代理会话不在 main 上直接提交。合并方式固定为 merge commit（`gh pr merge --merge`），不用 squash/rebase，保留分支拓扑与独立 revert 粒度。该要求由仓库 ruleset `main-branch-protection` 机械强制：禁直推、禁删除、禁 force push，PR 合并仅限 merge method，CI 的 lint/check/test/format/commit-msg 五个 job 必过。
- **分支合并即清理** — 分支经 PR 合并后立即清理现场，不留挂起引用：`git worktree remove .worktrees/<分支名>` 拆工作树，`git branch -d <分支>` 删本地分支，最后 `git fetch --prune` 收掉失效的 remote-tracking ref。远端分支由仓库设置 delete_branch_on_merge（已开启）随合并自动删除，但它不覆盖 PR 关闭未合并（方案否决）的情况，此时需手动 `git push origin --delete <分支>` 收尾。已合并与已关闭分支的 commit 由远端 PR 引用保留，本地不留存档分支，也不以“未合并”为由拖延清理。

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
