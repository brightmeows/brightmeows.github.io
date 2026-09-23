# 白喵斯的小屋 — AGENTS.md

## Commands

### Pre-commit（提交时自动执行）

首次 clone 后执行一次 `pre-commit install`（配置了 `default_install_hook_types: [pre-commit, commit-msg]`，会同时安装提交信息检查）。

```bash
pre-commit run --all-files --quiet    # 手动触发全部 hooks
```

Hooks：`pnpm format:check`、`pnpm lint`、`pnpm check`、`pnpm test`、no-confusable-unicode、cn-quotes、conventional-commit（commit-msg stage 校验提交信息）。

### scripts/ 校验脚本

- `scripts/check-cn-quotes.py` — 中文正文引号规范（GB/T 15834-2011）。跳过 YAML frontmatter、HTML 标签属性、行内代码与围栏代码块，这些位置的引号是语法而非中文文本。
- `scripts/check-commit-msg.py` — Conventional Commits 格式校验（见“提交格式”节），pre-commit commit-msg stage 与 CI 的 PR job 共用。
- `scripts/check-site-config.ts` — 离线一致性校验（五条断言：`--target` 合法、wrangler routes ⊆ 配置、工作流无硬编码域名、CORS 覆盖全部目标、版本来源唯一）。`pnpm check:config` 调用它，pre-commit 与 CI 都跑。
- `scripts/check-r2-cors.ts` — 只读比对桶 CORS policy 与配置（需 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`）；不在日常 CI 跑，由 `config-drift.yml` 在配置变更的 PR 与手动触发时调用。
- `scripts/site-config.ts` / `scripts/site-target.ts` — 读取并校验 `config/site.json`、打印某静态目标的站点基址（供工作流把域名从 YAML 里移出）。

### 手动命令

- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm exec wrangler deploy` — 把 `build/` 发布到 Cloudflare Workers（需环境变量 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`）
- `pnpm exec wrangler dev` — 本地 Workers 运行时，含 `/bms/table/mirror/*` 的动态路由（需先 `pnpm build`；这些路由在 `pnpm dev` 下不可用）
- `node scripts/detect-mirror-change.ts [--out=<路径>]` — 比对 R2 清单与 R2 基线对象（`meta/last-notified.json`）的投影，stdout 只打印 `true`/`false`，变动时可写出新基线供工作流推回
- `node scripts/gen-static-mirror-pages.ts --target=<目标名> [--site-base=<域名>]` — 生成静态宿主的镜像页与站点清单（需先 `pnpm build`；从主站拉取已合成清单，需网络；`--site-base` 仅本地演练覆盖）
- `pnpm check:config` — 配置一致性校验（离线，毫秒级）
- `node scripts/fetch-tables.ts` — 本地跑数据管线（基线经 rclone 同步自 R2，用户层经站点 Worker 的内部接口读取，需要 `INTERNAL_API_TOKEN`；写 `tables/`、`indexes/`、`warnings.log`；产物已 gitignore）
- `node scripts/fetch-table-once.ts --url=<表源> --request-id=<id> --out-dir=./out` — 单表抓取（复用管线抓取与命名逻辑）：数据目录供 `fetch-table` 工作流上传到 R2，抓取结果与状态经内部接口写进 D1
- `pnpm exec wrangler d1 execute miyakomeow-user --remote --json --command "SELECT ..."` — 只读查询线上用户层（需已 `wrangler login`）
- `node scripts/restore-user-layer.ts --file=<快照> [--out=<sql>]` — 从备份快照生成用户层恢复 SQL（人工 review 后用 `wrangler d1 execute --file` 导入）
- `pnpm test:parity` — 手动新旧实现对拍（用公开 R2 基线与归档工具 v0.4.2 的二进制，逐对象比对产物；`PARITY_LIMIT` 可只对拍前 N 张表）
- `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` — 与线上桶 CORS policy 比对（需 Cloudflare 凭据；只读）

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意，按域分类。

### 项目基础设施

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide i18n 基础设施全局加载但仅 `/demo/paraglide/` 生效** — `hooks.ts` 和 `+layout.svelte` 无条件导入 runtime（SSG 构建无法 tree-shake），但 `reroute` 钩子只对 `/demo/paraglide/` 路径触发。不要将 paraglide 扩展到其他路由。
- **测试只覆盖纯函数层** — vitest 覆盖 `src/lib/utils/`、生成器脚本与 `worker/` 里的纯函数（`include` 含 `worker/**/*.test.ts`；`worker/tsconfig.json` 把 `*.test.ts` 排除在 Worker 类型上下文外，那里没有 vitest 与 Node 的类型），测试文件为相邻 `*.test.ts`；组件（需 browser mode）与数据层（需 fs/fetch fixture）刻意不覆盖，避免依赖与 CI 复杂度膨胀。`pnpm test` 与 format/lint/check 同为门槛，pre-commit 与 CI 都会跑，失败阻断提交与部署。给非纯函数层加测试依赖或测试文件前先确认范围。
- **lint 不含 Svelte 模板级 linter** — 曾用 oxvelte（cargo 全局二进制）补 Svelte 模板规则，其上游 2026 年 5 月起停更、且依赖仓库外的 cargo 全局安装不可复现，已移除。现 `lint` 仅 oxlint（查 `.svelte` 的 script 块）加 svelte-check（编译期诊断）。代价是失去 `svelte/button-has-type` 与 `svelte/no-target-blank` 两条 warn。回归路径（跟踪 oxc issue #15761 “SFC Template Support”）：oxlint 支持自定义文件解析器后接 eslint-plugin-svelte 或原生规则。不要因“模板无 lint”而重新引入停更工具。
- **auto-merge 合并的 PR 不触发 push 工作流** — GitHub 对 `GITHUB_TOKEN` 触发的事件有反递归机制：`dependabot-auto-merge.yml` 启用 auto-merge 后，服务端完成合并产生的 push 事件不会触发 CI/Deploy（只留下 dependabot 的 dynamic 事件）。后果是依赖更新合并后不会立即部署与同步：站点部署由 `deploy.yml` 每 6 小时的 schedule 兜底，仓库镜像由 `mirror.yml` 的每日 schedule 兜底，也可手动 dispatch。手动 `gh pr merge` 用个人 token，不受影响，正常触发。
- **列表变动的判定与下游触发都不落仓库** — `update-tables` 抓取并双向同步 R2 后跑 `scripts/detect-mirror-change.ts`：比对 R2 清单与基线对象 `meta/last-notified.json` 的投影（`dir_name` 集合加展示字段，不含 `date`/`comment`/`state`）。列表变动时把新基线推回 R2（`meta/` 刻意不在 rclone 的同步白名单内），再用 App token（`APP_ID` / `APP_PRIVATE_KEY`）触发 `deploy` 与 `mirror` 重建两个静态宿主；主站是运行时生成，不需要重建。表内容与上游元数据变化不触发。首次运行（基线对象不存在）判定为变动并建立基线。2026-09 之前这条链路靠“把清单快照提交进仓库、用 git push 的副作用触发”，已随本改动删除。
- **分支 ruleset 不放行任何直推** — ruleset `main-branch-protection` 禁止直接 push main 并要求 PR + 必过检查（见“分支与工作树”）。2026-09 之前 update-tables 需要直推清单快照，bypass actors 里因此有 DeployKey；列表变动改由 App token 触发下游后这条直推已删除，**bypass actors 应为空**。若发现其中仍有 DeployKey 条目，属于遗留配置，应移除。CI job 增删或改名时，ruleset 的 required_status_checks context 必须同步更新，否则 PR 合并被永久阻塞。
- **ruleset 不得启用 Restrict updates 规则** — 实测 ruleset 的 `update` 类型规则会把 PR 合并一起拦死：它只允许 bypass actor 更新 matching refs，而 PR 合并也是 ref 更新，启用后 PR 的 mergeStateStatus 恒为 BLOCKED（GitHub 报 “base branch policy prohibits the merge”），checks 全绿也无法合并。禁止直接 push main 由 `pull_request` 规则独立承担（已实测其拦直推），不要重新加回 `update` 规则。诊断提示：BLOCKED 且 checks 全绿时，先检查 ruleset 是否含 `update` 规则。
- **`pnpm-workspace.yaml` 的 `allowBuilds` 由 pnpm 11 维护** — 遇到未决的 build script 时 pnpm 会自动写入占位符（值为字面量 `set this to true or false`），带着占位符提交会让 CI 的 install 直接失败。本地需改成明确的 `true`/`false` 再提交。
- **本地 install 可能因 npmmirror 同步延迟失败** — 全局 registry 指向 `registry.npmmirror.com`，其同步有延迟（曾出现 `@inlang/paraglide-js` 2.25.2 缺失导致 `--frozen-lockfile` 报 404）。绕过方式为 `pnpm install --registry=https://registry.npmjs.org`。CI 使用官方源，不受影响。
- **同一事实只允许一个权威点，其余由门槛机械守住** — `config/site.json` 是站点与部署配置的单一来源；不能 import 它的地方（`wrangler.jsonc` 的 routes、工作流 YAML、`.nvmrc` 与 `packageManager`）由 `scripts/check-site-config.ts` 的五条断言守住，进 pre-commit 与 `pnpm check:config`。工作流里**任何位置（含注释）**都不该出现域名：域名通过 `--target=<目标名>` 交给脚本从配置解析。唯一豁免是仓库自身的远程地址（`git@github.com:owner/brightmeows.github.io.git`）—— 其中的 `brightmeows.github.io` 是仓库名。
- **外部状态只把桶 CORS 来源纳入仓库** — 它是唯一“改了仓库但线上没跟上就静默退化”的外部状态（漏放时原生客户端正常、只有浏览器失败）。期望值在 `config/site.json` 的 `r2.corsOrigins`，由 `scripts/check-r2-cors.ts` 只读比对，`.github/workflows/config-drift.yml` 在配置变更的 PR 与手动触发时跑（复用 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`，桶名见 BMS 节的绑定说明）。其余外部状态（zone 开关、自定义域、ruleset、secrets）维持文档口径。
- **Cloudflare 凭据一律用账户级令牌（`cfat_` 前缀）** — CI 的 `CLOUDFLARE_API_TOKEN` 必须在 **Manage Account → Account API Tokens** 创建（服务主体），不能用 **My Profile → API Tokens** 的用户级令牌（`cfut_` 前缀）。用户级令牌与个人账号耦合：个人令牌列表里的清理动作会直接打断部署——实测一次临时 purge 令牌的撤销误删了部署令牌，`Deploy Site` 立刻报 `Invalid access token [code 9109]`，而且这条报错看起来像代码问题，容易误判。所需权限四项：`Workers / Individual Workers Editor`（**资源级**，scoped 到 `miyakomeow-site`，2026-09-15 起可用，替代 legacy 的 `Account / Workers Scripts / Write`；实测足以完成 `wrangler deploy` 与 triggers 同步）、`Account / Workers R2 Storage / Read`（**必须账户级**：`config-drift` 读的桶 CORS policy 属桶配置，桶级权限（`Workers R2 Storage Bucket Item Read`）只覆盖对象，资源级在本用途实测报 `Authentication error`）、`Zone / Workers Routes / Write`（scoped 到 `miyakomeow.site`，`wrangler.jsonc` 里 `custom_domain` 的绑定，见下条）、`Account / Account Settings / Read`（wrangler 读账户信息）；界面入口见 `workers/ci-cd/external-cicd/github-actions` 文档的 “Permission policies → Edit Cloudflare Workers”。一次性运维动作（如清边缘缓存）另用临时令牌或控制台操作，不要复用部署令牌。R2 的 S3 凭据（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`）来自 R2 页面的独立令牌（2026-09 核实为桶级的 `Workers R2 Storage Bucket Item Write`，已限定 `bms-table-mirror` 单桶，不能建删桶；rclone 的双向同步含删除目标端多余对象，在这套权限下长期正常），与部署令牌无关。
- **`Workers Routes Write` 是部署的必需权限** — wrangler **每次部署都会同步 `wrangler.jsonc` 声明的 routes**，因此即使 `custom_domain` 早已配置正确，缺 Zone 级的 `Workers Routes Write` 仍会让部署在 `/zones/{id}/workers/routes` 上失败（实测报 `No access to the specified resource`），而且失败发生在 Worker 上传成功之后——线上代码已更新、站点正常，只有 CI 报红，容易误判为令牌整体失效。Cloudflare 博客称 “路由已配置时部署新版本不需要 zone 权限”，那只适用于成员角色，不适用于 wrangler 的实现，不要据此省掉这条权限。补权限用编辑令牌即可（编辑不改密钥，无需更新 Secret）。
- **三个部署目标，按目标分区** — Cloudflare Workers（主站 `miyakomeow.site`：静态资源 + Worker，镜像表页面与 `tables.json` 运行时生成，因此 `wrangler deploy` 必须排在生成步骤**之前**）；GitHub Pages（`brightmeows.github.io`）与 Codeberg Pages（`brightmeows.codeberg.page`）：后两者在构建后用 `node scripts/gen-static-mirror-pages.ts --target=<目标名>` 拉取主站已合成清单，再生成静态镜像页与自己的 `tables.json` 发布（域名由脚本从配置解析，工作流里不再出现域名）（Codeberg 侧由 `.forgejo/workflows/deploy.yml` 跑同样流程，触发随镜像推送）。三处页面逐字节一致——Worker 与脚本共用 `src/lib/mirror/manifest.ts` 的注入与序列化函数。生成失败即整步失败，避免用缺页产物覆盖上一版仍可用的静态站点；Cloudflare 已先部署完成，属可接受的失败隔离。
- **CI 与 Deploy 的检查分工** — CI 的 lint/test/format 不依赖 build 产物（把 `build/` 移走后全部通过），因此只有 check job 跑一次 `pnpm build`，作为 CI 里唯一的构建验证点（frontmatter 校验、构建期数据加载与打包错误都在这里暴露）；Deploy 只做 build、部署与镜像页生成，不重复 lint/check/test——main 的每次提交已由 PR 必过门槛与 push 触发的 CI 覆盖，所有变更都经 PR——列表变动改由 App token 触发下游，不再产生直推。各工作流持有独立 concurrency group：CI 与 Codeberg 取消被取代的旧运行，Deploy 排队串行（避免旧提交的部署最后完成、覆盖新版本）；各作业均设超时（CI/Deploy 15 分钟、config-drift 10 分钟、update-tables 30 分钟、fetch-table 15 分钟、Codeberg 20 分钟），防挂起占满 runner。
- **pnpm 缓存只配置一处** — `pnpm/action-setup` 的 `cache: true` 与 `actions/setup-node` 的 `cache: "pnpm"` 缓存的是同一个 pnpm store（实测两份缓存哈希相同、每个 job 各恢复约 312MB）。统一只保留 setup-node 的 `cache: "pnpm"`，不要再给 pnpm/action-setup 加缓存输入。

### 构建与配置

- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`static/_headers` 只对 Cloudflare 生效** — `/_app/immutable/*` 是 hash 命名的构建产物，设一年 `immutable` 缓存；`/*` 只加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: strict-origin-when-cross-origin`（刻意不含 HSTS 与 X-Frame-Options：前者有浏览器记忆期、后者会拦掉跨站嵌入场景）。两条注意：不要在 `/*` 上设 Cache-Control（会与 immutable 规则叠加出冲突值）；GitHub Pages 与 Codeberg 不解析该文件，它只会作为无害文本出现在这两个站点根。
- **`config/site.json` 是站点与部署配置的单一来源** — 字段：`origin`（站点规范域）、`targets[]`（部署目标：cloudflare/worker + hosts，两个静态目标的 siteBase）、`r2.base`/`r2.manifestObject`/`r2.baselineObject`/`r2.corsOrigins`。能 import 的消费者直接 import（`src/lib/constants/r2.ts`、`src/lib/constants/site.ts`、`worker/index.ts`）；不能 import 的（`wrangler.jsonc` 的 routes、工作流里的域名）由 `scripts/check-site-config.ts` 断言一致。桶名不入该配置：它只出现在 `wrangler.jsonc` 的 R2 binding（部署期配置，无法用 secret 注入）与 Actions secret（管线 S3 凭据）里，凭据本身不入库。

### BMS

- **`<meta name="bmstable">` 有两个来源** — 自托管表由 `[table]/+page.server.ts` 经 `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>` 注入（`./header.json`）；镜像表由 Worker 运行时（Cloudflare）或构建期脚本（静态宿主）注入到 SPA 外壳的 `<head>`（绝对 R2 地址），两处共用 `injectBmstableMeta`。
- **仓库里没有任何派生数据** — `static/bms/table/mirror/` 已于 2026-09 清空（旧的静态 stub 与 `tables.json` 删除）；同月又删掉最后一份派生文件 `src/lib/mirror/table-manifest.json`（清单快照，约 230KB，原先用于列表变动判定与触发）——现在判定与基线都放在 R2 的 `meta/last-notified.json`。**R2 是唯一权威源**；静态宿主的镜像页与 `tables.json` 都是构建期产物，不入库。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **镜像表单表页由 Worker 动态生成，静态宿主在构建期生成等价页面** — `worker/index.ts` 接管 `/bms/table/mirror/*`：`/bms/table/mirror/<dir_name>/` 取站点 SPA 外壳（构建产物 `404.html`）并把该表的 `<meta name="bmstable">` 注入 `<head>`，beatoraja / BeMusicSeeker 不执行 JS 直接读 meta，浏览器则由 `src/routes/bms/table/mirror/[name]/`（`prerender = false`）客户端路由渲染查看器；`/bms/table/mirror/tables.json` 同理由 R2 清单叠加用户层后合成，`url` 字段用请求 origin。静态宿主用 `scripts/gen-static-mirror-pages.ts` 在构建期拉取主站已合成清单（需网络）并产出同样的文件（同一外壳、同一注入函数，实测逐字节一致），`url` 用 `--site-base` 指定的域名。校验策略：清单不可用返回 503、表不存在返回 404，清单读失败时先回落到独立命名空间里的最近快照（见下条）。注入的 meta 必须独占一行：beatoraja 的 jbmstable-parser 按行扫描再按引号切分取第 4 段。
- **清单兜底快照写在独立 Cache API 命名空间** — Cloudflare 的 `caches.default` 就是 `fetch(..., {cf:{cacheEverything:true}})` 使用的同一份缓存。把快照（7 天 TTL）写进同一个 URL 键后，后续 fetch 会一直命中该快照、并在每次读取时把它续期，清单被冻结在快照时刻（实测新增的表在主站 404 超过一小时，R2、仓库快照与两个静态宿主都是 444 张而主站停在 443 张）。因此快照必须走 `caches.open("mirror-manifest-snapshot")`，只在 `cf-cache-status` 非 `HIT`（真正回源）时刷新，写入失败静默忽略：快照是降级手段，不应反向影响主路径的返回结果。
- **镜像表页面曾经是管线生成的静态 stub** — 2026-09 之前每个表在 `static/bms/table/mirror/<dir_name>/index.html` 有一份**提交物**，携带绝对 R2 header URL 与 JS 跳转；现改为运行时（Worker）与构建期（静态宿主脚本）生成，不再入库。形态也一并换了：导入地址与查看页合并为同一条 URL。
- **清单在主站读取侧合成，用户层存于 D1** — Worker（`worker/index.ts`）把管线清单（R2 `tables/tables.json`，含快照兜底）与用户层（添加、删除、禁用、替换、授权、元数据覆盖）合并后响应：`protected` 标记随条目输出，单表页校验也用合成清单。用户层自 2026-09 从 R2 对象迁到 D1（表结构见 `worker/schema.ts`，读写见 `worker/store.ts`），经 `MIRROR_DB` 绑定访问，同 isolate 内 60 秒内存缓存；用户层不可用时退化为纯管线清单——清单可用优先于增删可见。**静态宿主不再读仓库快照**，改为拉主站 `tables.json`（见 Commands 的生成器）：合成逻辑只存在于 Worker 一处，代价是静态构建需要网络。桶名与 D1 库名因此在 `wrangler.jsonc` 的绑定里入库（凭据仍不入库）；R2 上的 `user/` 前缀已于 2026-09 清空，旧对象不再被任何路径读取。
- **单表抓取是独立工作流（`fetch-table`）** — 用户提交添加后由 Worker 触发，也可手动 dispatch 演练：复用管线的 `fetchTable` 与命名逻辑（`scripts/fetch-table-once.ts`）：`tables/<dir_name>/` 数据写到 `out/` 后经 rclone 上传，抓取结果与状态则经 `POST /api/internal/fetch-result` 写进 D1；**失败只写 failed 状态、不产出数据目录**（半成品目录会被管线当作基线）。抓取脚本退出码恒为 0（除参数错误），结果由 `out/result.json` 表达，前端轮询 `/api/tables/status/<id>` 据此结束。成功后触发一次 `deploy`：用 `actions/create-github-app-token` 换 installation token（仓库 secrets `APP_ID` 与 `APP_PRIVATE_KEY`），不用长期 PAT。输入经 env 传入、不直接插值进 shell 命令。
- **写接口在 `/api/*`，登录走 GitHub OAuth** — 会话是 HMAC 签名 cookie（30 天，HttpOnly/Secure/SameSite=Lax）；写操作另做同源 Origin 校验，并消耗每日配额（每账号 10 次，按 UTC 日）。删除先写黑名单（可见性优先）再移入 `trash/<时间戳>/<dir_name>/`，作者可在 30 天内自助恢复（`TRASH_RETENTION_DAYS` 与工作流清理窗口同源）；用户层写入是 D1 的行级 upsert 与 delete（不再需要 ETag 乐观锁重试）；审计每次操作一行、限次按账号与日期一行，可直接查询聚合；增删后触发部署（10 分钟节流）。清单合成缓存（同 isolate 60 秒）在写操作后主动失效。Worker secrets：`GITHUB_OAUTH_CLIENT_ID` 与 `GITHUB_OAUTH_CLIENT_SECRET`（GitHub App 的用户授权凭据，登录用）、`SESSION_SECRET`、`GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_INSTALLATION_ID`（换 installation token 触发工作流）、`INTERNAL_API_TOKEN`（内部接口共享 token，与仓库 Actions secret 同名同值）。
- **触发工作流用 GitHub App，不用长期 PAT** — `worker/dispatch.ts` 用 App 私钥签 RS256 JWT（有效期 10 分钟，GitHub 上限）、换 installation token（一小时有效，缓存到过期前 5 分钟），再调 `workflow_dispatch`。选择 App 而不是 fine-grained PAT 的原因：PAT 最长一年后静默失效（表现为“提交添加后没有反应”，排查成本高），且绑定个人账户；App 的令牌自动轮换、身份独立、操作可审计。同一个 App 也承担登录（用户授权走同一套 OAuth 流程，`scope` 参数对 App 无效但无害）。
- **GitHub 下载的私钥是 PKCS#1，Web Crypto 只吃 PKCS#8** — `pkcs1ToPkcs8` 用 DER 重包一层（版本号加 rsaEncryption 的 AlgorithmIdentifier），站长不必额外跑 openssl 转换；这层包装由 `worker/dispatch.test.ts` 用“Web Crypto 生成密钥、反向拆包、再包回去应与原 DER 逐字节一致”验证（不依赖 node:crypto，与 Workers 运行环境同一套 API）。
- **内部接口在 `/api/internal/*`，只给 GitHub Actions 与运维用** — 端点：`GET user-layer`（返回原始用户层的 6 类索引加 fetched，形状与旧 R2 对象一致，供管线算活跃表集合）、`POST fetch-result`（单表抓取回写结果与状态）、`POST backup-now`（立即执行一次用户层备份）。迁移期用过的 `POST migrate` 与 `POST purge-legacy-user` 已在 2026-09 收尾后删除。鉴权是 `Authorization: Bearer <INTERNAL_API_TOKEN>`（恒定时间比较）；未配置 token 时拒绝一切内部调用。之所以不让 Actions 直连 Cloudflare API：那需要把账户级数据库权限交给 GitHub，而这组端点只暴露固定能力。管线与抓取脚本共用 `scripts/internal-api.ts` 客户端（基址默认站点 origin，可用 `INTERNAL_API_BASE` 覆盖——本地指向 `wrangler dev` 时用得上）。
- **用户层每天备份到 R2，恢复靠生成 SQL 人工执行** — `wrangler.jsonc` 的 `triggers.crons`（`30 18 * * *`，UTC）触发 Worker 的 `scheduled`，把用户层与最近 500 条审计导出成 `backup/user-layer-<日期>.json`，只保留最近 14 份（`worker/backup.ts`）。D1 免费版的 Time Travel 只回溯 7 天，这份快照是更长期的退路。恢复流程：从 R2 取快照、`node scripts/restore-user-layer.ts --file=<快照> --out=restore.sql`、review SQL、`wrangler d1 execute miyakomeow-user --remote --file=restore.sql`；快照里的审计段只作存档，恢复脚本不导入。恢复脚本的列名与 `worker/schema.ts` 建表语句的一致性由 `scripts/restore-user-layer.test.ts` 机械校验。需要立即备份时调 `POST /api/internal/backup-now`。
- **`wrangler dev` 的 `__scheduled` 端点在本项目不可用** — Worker 带 `assets` 配置，请求先被静态资源接管（返回站点的 404 页），`--test-scheduled` 拦不到。验证定时任务要走 `POST /api/internal/backup-now`（本地与线上都可用）。
- **D1 的 schema 由 Worker 自持，不走 wrangler migrations** — `worker/schema.ts` 用 `sql()` 把建表语句拼成单行、按 `SCHEMA_VERSION` 分步，经 `batch()` 原子执行（D1 的 `exec()` 按换行切分语句，跨行 SQL 会报 incomplete input）。首个请求前经 `ensureSchemaOnce` 初始化（isolate 内只跑一次，失败可重试）。这样 CI 的部署流程不需要 D1 权限，本地 `wrangler dev` 也能零配置建库；代价是加列要自己写升级步骤（追加到 `MIGRATION_STEPS` 并递增 `SCHEMA_VERSION`）。
- **D1 数据库需人工创建一次** — `wrangler d1 create miyakomeow-user --location apac` 生成 `database_id` 并写进 `wrangler.jsonc`；Worker 无法自建库（binding 是部署期配置）。
- **预览用轻量提取，刻意不引入 parse5** — `/api/tables/preview` 只做三步提取（JSON 页面、bmstable meta、header 文件名扫描）：完整回退链（管线的 `extractBmstableUrlHint`）在免费计划 10ms CPU 预算下解析大 HTML 有超限风险。预览失败不影响正式抓取（工作流用完整逻辑）。
- **列表页的用户操作区与“已授权”筛选** — 列表页顶部是登录状态与添加表单（预览后提交、轮询抓取状态、显示剩余次数），登录后每行出现删除按钮（受保护表显示“已授权”标签且不给删除按钮），“我删除的表”可自助恢复；勾选框由原来的“精选难度表”改为“已授权（受保护）”筛选（`FEATURED_TABLES` 常量与配套排序已随精选概念一并删除）。静态宿主上 `/api/*` 返回 404，界面切换为只读并引导到主站（`SITE_ORIGIN`）。注意：写操作后清单在浏览器侧仍可能命中 60 秒边缘缓存（`MANIFEST_MAX_AGE`），列表刷新有最长一分钟的延迟属预期。
- **站长后台在 `/bms/table/mirror/admin/`** — 纯客户端页面（`prerender = false`），数据来自 `/api/admin/*`（仅 `ADMIN_LOGIN` 可访问）：选一张表后加入/移出授权名单、禁用/启用、编辑元数据覆盖，另可维护替换规则、查看回收站（不限作者恢复）与最近 50 条审计。清单条目的 `url` 在客户端被重写为站内镜像路径，后台提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。写操作同样写审计并触发部署（10 分钟节流）。
- **旧配置迁移已完成（2026-09）** — 存档的旧 toml（`scripts/pipeline/fixtures/legacy-table.toml`）已通过一次性脚本转成用户层记录（added 10、禁用 1、替换 2、元数据覆盖 10、空名单），脚本与 `migrate-config` 工作流已在完成后删除。fixture 与 `legacy-config.ts` 保留：对拍（`parity`）仍靠它们驱动旧二进制（它固定找 `config/table.toml`，`prepareBaseline` 会拷过去）。用户层随后在 2026-09 从 R2 对象迁到 D1：迁移由 Worker 首个请求自动完成（幂等、`batch` 原子），完成后 R2 的 `user/` 前缀对象经一次性端点清空；自动迁移分支与清理端点已在随后删除（需要重跑时从 git 历史取回）。
- **镜像表目录名 `dir_name` 由数据管线生成** — 格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`），与 R2 目录名一致；Worker 的清单校验与站点清单变换直接消费该字段，缺失即失败。不要改为纯数字或 UUID 标识符。
- **难度表数据管线在本仓 Actions 中运行** — `.github/workflows/update-tables.yml` 每 6 小时（或 `scripts/fetch-tables.ts`、`scripts/pipeline/**` 变更时，以及手动 dispatch）跑 `scripts/fetch-tables.ts`（实现位于 `scripts/pipeline/`，与站点同仓演进），经 rclone 与 Cloudflare R2 双向同步：先拉取 R2 基线保留增量，跑完抓取再推回。输出 `tables/`、`indexes/`、`warnings.log`（均 gitignored，仅存在于 CI 工作区与 R2）。活跃表集合 = R2 基线（`info.json`）叠加**用户层**：站长与访客的添加、删除、禁用、替换、授权记录存于 D1（Worker 与单表抓取工作流经内部接口维护，管线经同一接口读取，需要 `INTERNAL_API_TOKEN`），列表源机制与旧 toml 配置已退役删除：旧配置存档在 `scripts/pipeline/fixtures/legacy-table.toml`，只供对拍与一次性迁移（`migrate-config` 工作流）使用。运行时依赖 `parse5` 与 `smol-toml`（devDependencies，因此工作流有 pnpm install 步骤）。R2 凭据以 Actions secrets 注入（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET`）。该管线原为独立的 Codeberg 壳子仓库 bms-table-mirror-r2，2026-09 迁入本仓并归档原仓；抓取工具 bms-table-fetch 同期在本仓重写后归档（release 资产保留，仅作对拍参照）。R2 同步后，工作流比对清单与 R2 上的基线对象、并在变动时用 App token 触发两个静态宿主重建（见“反直觉决策 / 项目基础设施”里的条目）；仓库不参与常态更新。
- **抓取实现的硬性约定** — 有界并发 24、单请求 60 秒超时、不重试，失败表保留 R2 基线数据等下一轮自愈；https 默认走 HTTP/2（数据中心 IP 下 Cloudflare 只挑战 HTTP/1.1，实测 darksabun.club 的 77 张表受影响），h2 非 2xx 时用 HTTP/1.1 复核并采用其结果（部分老站点经 h2 网关返回 404 错误页）；`warnings.log` 每轮重写（时间戳加运行汇总，长哈希噪声按表折叠）而不是追加；`state.toml` 与 `_orphaned` 保持旧格式与同步；目录命名规则（`[domain]` 加全角化 sanitize）与对外对象字段顺序是对外约定，改动会打断已分发的 beatoraja 导入链接。header/data 的提取顺序（先 JSON 后 HTML，HTML 侧含 link/a/script/meta/全文扫描的启发式回退链）与旧实现一致，`upl.konjiki.jp` 这类站点依赖该链。
- **rclone 固定版本并校验 SHA256SUMS** — 安装步骤抽为 composite action `.github/actions/install-rclone`（`update-tables` 与 `fetch-table` 共用，版本号只此一处）：从 downloads.rclone.org 下载固定版本（v1.75.1）并校验 SHA256SUMS 后再解压；`rclone sync` 会删除目标端多余文件，工具行为漂移是本管线破坏性最高的一环，升级必须是显式动作（改 action 里的版本号）。两个经本地演练实测的坑：下载时必须保留归档原名（`SHA256SUMS` 按文件名校验，存成 `rclone.zip` 会直接找不到文件）；版本号用 shell 局部变量而非 `RCLONE_*` 环境变量（rclone 把该前缀全部当 CLI 标志解析，`RCLONE_VERSION` 与其 `--version` 冲突会让命令直接失败）。
- **对拍工具是手动入口，不属于默认门槛** — `pnpm test:parity`（独立配置 `vitest.parity.config.ts`，include 只有 `scripts/pipeline/parity.manual.ts`）用公开 R2 基线跑新实现与归档工具 v0.4.2 的二进制（对拍时自动下载到临时工作区），逐对象比对对外产物，不写 R2；`pnpm test` 只收 `src/**/*.test.ts` 与 `scripts/**/*.test.ts`，不会带上它（对拍需要网络与旧二进制，不满足离线确定门槛）。也可在 Actions 手动 dispatch `update-tables` 并选 parity=true，只跑对拍、不提交快照。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。
- **浏览器侧取数依赖 R2 桶的 CORS policy** — 镜像表 viewer 与谱面搜索都在客户端直连 R2（`r2TableHeaderUrl()`/`r2TableDataUrl()`、`R2_INDEXES_BASE`）。bucket 未放行站点来源时，浏览器报 `Failed to fetch`（viewer）与“索引加载失败”（搜索），而 beatoraja 等原生客户端不受影响，容易误判为代码缺陷。**期望来源写在 `config/site.json` 的 `r2.corsOrigins`**（三个站点域 + 本地端口），线上值用 `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` 只读比对；policy 位置在 Cloudflare 控制台 R2 → 桶 → Settings → CORS Policy。改域或新增来源时先改配置再同步线上（`config-drift.yml` 会在配置变更的 PR 上拦一次）。验证：`curl -sI -H "Origin: https://miyakomeow.site" <R2 header 地址> | rg -i access-control` 应出现 `access-control-allow-origin`。
- **旧客户端 UA 是否被拦由 zone 级 Browser Integrity Check 决定** — 实测 `Java/1.8.x`、`Python-urllib`、`libwww-perl` 在 r2.dev、R2 自定义域与 workers.dev 上一律 403（Cloudflare error 1010），根因是 Browser Integrity Check，不是 r2.dev 的特有策略。本 zone 已关闭该开关（`browser_check = off`），因此 `bms-table-mirror-r2.miyakomeow.site` 与站点对旧 UA 全部放行；r2.dev 已于 2026-09-19 关闭（API：`PUT /accounts/{id}/r2/buckets/{bucket}/domains/managed`，body `{"enabled":false}`）。开关位置：控制台 zone → Security → Settings，或 `PATCH /zones/{id}/settings/browser_check`。
- **www 由 zone 上的 Single Redirect 规则 301 到 apex** — 条件 `starts_with(http.host, "www.")`，目标 `concat("https://", substring(http.host, 4), http.request.uri.path)`，保留查询串。两个实测要点：`substring` 是 **0 基**（写 5 会重定向到 `iyakomeow.site`，少一个字符）；`regex_replace` 需要 Business 计划，Free 上不可用。规则里**不写死域名**，因此没有需要同步的副本。Worker 里的 `www` 分支保留作兜底——它只对 `/bms/table/mirror/*` 生效，这正是当初“表页跳转、其他路径不跳”的原因。
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

- **纯 SSG（含一处边缘例外）** — `@sveltejs/adapter-static` + 全局 `prerender = true`，不加 server routes / API endpoints。例外是 Cloudflare Worker（`worker/index.ts`）承担的镜像表动态路由与写接口：它先接管 `/bms/table/mirror/*` 与 `/api/*`（`assets.run_worker_first`），其余请求全部回落静态资源。
- **BMS 数据源分流** — `static/bms/table/` 下只有自托管表（`self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/`）在 git 中；镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数：Cloudflare 由 Worker 生成，静态宿主由构建期脚本从快照生成。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts`、`url.ts` 除外）。任何环境可调用。
- **`src/lib/mirror/`** — 镜像表的零依赖层（URL 构造、清单变换、bmstable meta 渲染），由站点与 Worker（`worker/index.ts`）共用；约束：无 Svelte/DOM 依赖、可擦除语法、相对导入带 `.ts` 扩展名（Worker 由 wrangler/esbuild 打包，直接引用这些 `.ts` 文件）。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件与自托管 BMS 表的目录枚举。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **本地 `pnpm dev` 不提供 mirror 动态路由** — 列表页 `/bms/table/mirror/` 依赖 Worker 生成的 `tables.json`，本地 dev 下会报加载失败；单表页的 meta 注入也只存在于 Worker 运行时。验证 mirror 行为用 `pnpm build && pnpm exec wrangler dev`（`localhost:8787` 已在桶 CORS 放行）；想验静态宿主形态则 `pnpm build && node scripts/gen-static-mirror-pages.ts --site-base=http://127.0.0.1:8787` 后用静态服务器起 `build/`（本地演练用显式 site-base，因为配置里只有生产目标）。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语，其余子目录为领域组件。**组件导入一律用直接路径**（`$lib/components/<域>/<组件>.svelte`）：2026-09 移除了五个 barrel 文件（`ui`/`bms`/`layout`/`content`/`pages` 下的 `index.ts`），原因是它们与实际使用漂移——knip 报出一批只被直接路径引用、在 barrel 里却仍挂着导出的冗余项。直接路径无维护面、语义无歧义，不要再新增 barrel。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- SvelTeX 0.5（Markdown 预处理器：unified 后端 + remark-gfm + katex + shiki）（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- tsconfig 已开启 `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`（2026-09）—— 两者分别修复 45 处与 27 处真实未定义状态问题后开启。批量修法：`exactOptionalPropertyTypes` 要求给类型定义的可选属性显式写 `| undefined`（项目里确实存在“显式传 undefined”的语义，如调用方把 `string | undefined` 直接放进字面量）；`noUncheckedIndexedAccess` 优先真修（用 `entries()` 遍历消除索引访问、用解构加逐项检查替代 `some` 加 `as` 断言），确证安全处（循环内已保证边界、测试里已有前置断言）用 `!`。开启后 oxlint 的 `prefer-nullish-coalescing` 会多报几处，属预期。
- Vitest 5（纯函数单测，Node 环境）
- Node 版本以 `.nvmrc` 为准（工作流用 `node-version-file: .nvmrc`）；pnpm 版本以 `package.json` 的 `packageManager` 为准（工作流不传 `version`）。两者都由 `pnpm check:config` 断言
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
