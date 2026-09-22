/**
 * Worker 运行时环境与全局常量。
 *
 * 绑定在 wrangler.jsonc（ASSETS、MIRROR_BUCKET 与 MIRROR_DB），密钥经
 * `wrangler secret put` 注入：GitHub App 的用户授权凭据与私钥（登录与触发
 * 工作流共用同一个 App）、会话签名密钥，以及供 Actions 调内部接口的共享 token。
 */

/** Workers 运行时绑定与 secrets。 */
export interface Env {
  ASSETS: Fetcher;
  /** 镜像数据桶：读写表数据与备份快照（wrangler.jsonc 的 r2_buckets）。 */
  MIRROR_BUCKET: R2Bucket;
  /** 用户层数据库：增删改、审计、限次与抓取状态（wrangler.jsonc 的 d1_databases）。 */
  MIRROR_DB: D1Database;
  /** GitHub App 的用户授权凭据（登录用；App 与 OAuth App 共用同一套 OAuth 流程）。 */
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  /** 会话 cookie 的 HMAC 签名密钥（任意长随机串）。 */
  SESSION_SECRET: string;
  /** GitHub App 的 App ID、私钥（PEM 文本）与安装 ID：用于签发 installation token。 */
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_APP_INSTALLATION_ID: string;
  /** 内部接口的共享 token：仅 GitHub Actions 的管线与抓取工作流使用。 */
  INTERNAL_API_TOKEN: string;
}

/** 触发工作流的仓库，与 git remote 一致。 */
export const REPOSITORY = "brightmeows/brightmeows.github.io";

/** 站点管理员 GitHub 登录名：只有该账号能访问后台与停用接口。 */
export const ADMIN_LOGIN = "brightmeows";

/** 会话有效期（秒）。 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 会话 cookie 名。 */
export const SESSION_COOKIE = "mm_session";

/** OAuth state cookie 名（短有效期，仅用于回调校验）。 */
export const OAUTH_STATE_COOKIE = "mm_oauth_state";

/** OAuth 回调路径；GitHub OAuth App 的回调地址以此结尾。 */
export const OAUTH_CALLBACK_PATH = "/api/auth/callback";

/** 预览抓取的单请求超时（毫秒）。 */
export const PREVIEW_TIMEOUT_MS = 15_000;

/** 预览抓取的响应体上限（字节），防止把大文件读进内存。 */
export const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/** 预览抓取使用的 UA（与管线一致的浏览器仿真，降低被 403 的概率）。 */
export const PREVIEW_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36 bms-table-rs";
