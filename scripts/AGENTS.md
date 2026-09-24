# 脚本与数据管线（scripts/）— AGENTS.md

本文件收录 `scripts/` 域：仓库校验脚本、数据管线、抓取工作流与对拍；全局规则见根 `AGENTS.md`。

## Commands

- `node scripts/detect-mirror-change.ts [--out=<路径>]` — 比对 R2 清单与 R2 基线对象（`meta/last-notified.json`）的投影，stdout 只打印 `true`/`false`，变动时可写出新基线供工作流推回
- `node scripts/gen-static-mirror-pages.ts --target=<目标名> [--site-base=<域名>]` — 生成静态宿主的镜像页、站点清单与域配置提交物（`CNAME`/`.domains`，域名从配置解析；需先 `pnpm build`；从主站拉取已合成清单，需网络；`--site-base` 仅本地演练覆盖，此时不生成域配置）
- `node scripts/fetch-tables.ts` — 本地跑数据管线（基线经 rclone 同步自 R2，用户层经站点 Worker 的内部接口读取，需要 `INTERNAL_API_TOKEN`；写 `tables/`、`indexes/`、`warnings.log`；产物已 gitignore）
- `node scripts/fetch-table-once.ts --url=<表源> --request-id=<id> --out-dir=./out` — 单表抓取（复用管线抓取与命名逻辑）：数据目录供 `fetch-table` 工作流上传到 R2，抓取结果与状态经内部接口写进 D1
- `pnpm test:parity` — 手动新旧实现对拍（用公开 R2 基线与归档工具 v0.4.2 的二进制，逐对象比对产物；`PARITY_LIMIT` 可只对拍前 N 张表）
- `R2_BUCKET=<桶名> node scripts/check-r2-cors.ts` — 与线上桶 CORS policy 比对（需 Cloudflare 凭据；只读）

## 校验脚本

- `scripts/check-cn-quotes.py` — 中文文本引号规范（GB/T 15834-2011）。两档策略：Markdown（`.md`/`.svx`）扫直引号、全角无向引号与直角引号，跳过 frontmatter、代码块、行内代码与 HTML 标签（这些位置的引号是语法）；代码与配置类型只扫直角引号与全角无向引号（ASCII 直引号在代码里是字符串与语法，无法与注释引号机械区分，不扫）。`static/` 为数据资产（含日文原文）不扫；行内含 `cn-quotes-ignore` 注释可豁免单行（字符映射表、测试断言等“引号即数据”场景，豁免与原因就近可见）。
- `scripts/check-commit-msg.py` — Conventional Commits 格式校验（见根 `AGENTS.md` 的“提交格式”节），pre-commit commit-msg stage 与 CI 的 PR job 共用。
- `scripts/check-site-config.ts` — 离线一致性校验（八条断言：`--target` 合法、wrangler routes ⊆ 配置、工作流无硬编码域名、CORS 覆盖全部目标、基线文件名与 `r2.baselineObject` 一致、版本来源唯一（devEngines 范围加工作流不传 pnpm 版本）、wrangler vars 与配置一致（含 `SITE_ORIGINS` 白名单与 `COOKIE_DOMAIN`）、静态目标 siteBase 主机与 target 名对齐）。`pnpm check:config` 调用它，pre-commit 与 CI 都跑。
- `scripts/check-r2-cors.ts` — 只读比对桶 CORS policy 与配置（需 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`R2_BUCKET`）；不在日常 CI 跑，由 `config-drift.yml` 在配置变更的 PR 与手动触发时调用。
- `scripts/site-config.ts` / `scripts/site-target.ts` — 读取并校验 `config/site.json`、打印某静态目标的站点基址、平台原域与 git-pages 服务主机名（`--legacy-base` / `--server`；供工作流把域名从 YAML 里移出）。

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意。

- **列表变动的判定与下游触发都不落仓库** — `update-tables` 抓取并双向同步 R2 后跑 `scripts/detect-mirror-change.ts`：比对 R2 清单与基线对象 `meta/last-notified.json` 的投影（`dir_name` 集合加展示字段，不含 `date`/`comment`/`state`）。列表变动时把新基线推回 R2（`meta/` 刻意不在 rclone 的同步白名单内），再用 App token（`APP_ID` / `APP_PRIVATE_KEY`）触发 `deploy` 与 `mirror` 重建两个静态宿主；主站是运行时生成，不需要重建。表内容与上游元数据变化不触发。首次运行（基线对象不存在）判定为变动并建立基线。2026-09 之前这条链路靠“把清单快照提交进仓库、用 git push 的副作用触发”，已随本改动删除。
- **单表抓取是独立工作流（`fetch-table`）** — 用户提交添加后由 Worker 触发，也可手动 dispatch 演练：复用管线的 `fetchTable` 与命名逻辑（`scripts/fetch-table-once.ts`）：`tables/<dir_name>/` 数据写到 `out/` 后经 rclone 上传，抓取结果与状态则经 `POST /api/internal/fetch-result` 写进 D1；**失败只写 failed 状态、不产出数据目录**（半成品目录会被管线当作基线）。抓取脚本退出码恒为 0（除参数错误），结果由 `out/result.json` 表达，前端轮询 `/api/tables/status/<id>` 据此结束。成功后触发一次 `deploy`：用 `actions/create-github-app-token` 换 installation token（仓库 secrets `APP_ID` 与 `APP_PRIVATE_KEY`），不用长期 PAT。输入经 env 传入、不直接插值进 shell 命令。
- **旧配置迁移已完成（2026-09）** — 存档的旧 toml（`scripts/pipeline/fixtures/legacy-table.toml`）已通过一次性脚本转成用户层记录（added 10、禁用 1、替换 2、元数据覆盖 10、空名单），脚本与 `migrate-config` 工作流已在完成后删除。fixture 与 `legacy-config.ts` 保留：对拍（`parity`）仍靠它们驱动旧二进制（它固定找 `config/table.toml`，`prepareBaseline` 会拷过去）。用户层随后在 2026-09 从 R2 对象迁到 D1：迁移由 Worker 首个请求自动完成（幂等、`batch` 原子），完成后 R2 的 `user/` 前缀对象经一次性端点清空；自动迁移分支与清理端点已在随后删除（需要重跑时从 git 历史取回）。
- **难度表数据管线在本仓 Actions 中运行** — `.github/workflows/update-tables.yml` 每 6 小时（或 `scripts/fetch-tables.ts`、`scripts/pipeline/**` 变更时，以及手动 dispatch）跑 `scripts/fetch-tables.ts`（实现位于 `scripts/pipeline/`，与站点同仓演进），经 rclone 与 Cloudflare R2 双向同步：先拉取 R2 基线保留增量，跑完抓取再推回。输出 `tables/`、`indexes/`、`warnings.log`（均 gitignored，仅存在于 CI 工作区与 R2）。活跃表集合 = R2 基线（`info.json`）叠加**用户层**：站长与访客的添加、删除、禁用、替换、授权记录存于 D1（Worker 与单表抓取工作流经内部接口维护，管线经同一接口读取，需要 `INTERNAL_API_TOKEN`），列表源机制与旧 toml 配置已退役删除：旧配置存档在 `scripts/pipeline/fixtures/legacy-table.toml`，只供对拍与一次性迁移（`migrate-config` 工作流）使用。运行时依赖 `parse5` 与 `smol-toml`（devDependencies，因此工作流有 pnpm install 步骤）。R2 凭据以 Actions secrets 注入（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET`）。该管线原为独立的 Codeberg 壳子仓库 bms-table-mirror-r2，2026-09 迁入本仓并归档原仓；抓取工具 bms-table-fetch 同期在本仓重写后归档（release 资产保留，仅作对拍参照）。R2 同步后，工作流比对清单与 R2 上的基线对象、并在变动时用 App token 触发两个静态宿主重建（见本文档的“列表变动的判定与下游触发都不落仓库”条目）；仓库不参与常态更新。
- **抓取实现的硬性约定** — 有界并发 24、单请求 60 秒超时、不重试，失败表保留 R2 基线数据等下一轮自愈；https 默认走 HTTP/2（数据中心 IP 下 Cloudflare 只挑战 HTTP/1.1，实测 darksabun.club 的 77 张表受影响），h2 非 2xx 时用 HTTP/1.1 复核并采用其结果（部分老站点经 h2 网关返回 404 错误页）；`warnings.log` 每轮重写（时间戳加运行汇总，长哈希噪声按表折叠）而不是追加；`state.toml` 与 `_orphaned` 保持旧格式与同步；目录命名规则（`[domain]` 加全角化 sanitize）与对外对象字段顺序是对外约定，改动会打断已分发的 beatoraja 导入链接。header/data 的提取顺序（先 JSON 后 HTML，HTML 侧含 link/a/script/meta/全文扫描的启发式回退链）与旧实现一致，`upl.konjiki.jp` 这类站点依赖该链。
- **rclone 固定版本并校验 SHA256SUMS** — 安装步骤抽为 composite action `.github/actions/install-rclone`（`update-tables` 与 `fetch-table` 共用，版本号只此一处）：从 downloads.rclone.org 下载固定版本（v1.75.1）并校验 SHA256SUMS 后再解压；`rclone sync` 会删除目标端多余文件，工具行为漂移是本管线破坏性最高的一环，升级必须是显式动作（改 action 里的版本号）。两个经本地演练实测的坑：下载时必须保留归档原名（`SHA256SUMS` 按文件名校验，存成 `rclone.zip` 会直接找不到文件）；版本号用 shell 局部变量而非 `RCLONE_*` 环境变量（rclone 把该前缀全部当 CLI 标志解析，`RCLONE_VERSION` 与其 `--version` 冲突会让命令直接失败）。
- **对拍工具是手动入口，不属于默认门槛** — `pnpm test:parity`（独立配置 `vitest.parity.config.ts`，include 只有 `scripts/pipeline/parity.manual.ts`）用公开 R2 基线跑新实现与归档工具 v0.4.2 的二进制（对拍时自动下载到临时工作区），逐对象比对对外产物，不写 R2；`pnpm test` 只收 `src/**`、`scripts/**` 与 `packages/**` 下的 `*.test.ts`，不会带上它（对拍需要网络与旧二进制，不满足离线确定门槛）。也可在 Actions 手动 dispatch `update-tables` 并选 parity=true，只跑对拍、不提交快照。
