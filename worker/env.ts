/**
 * Worker 运行时环境与全局常量。
 *
 * 绑定在 wrangler.jsonc（ASSETS 与 MIRROR_BUCKET），密钥经 `wrangler secret put`
 * 注入：OAuth 客户端凭据、会话签名密钥与触发工作流的 fine-grained PAT。
 */

/** Workers 运行时绑定与 secrets。 */
export interface Env {
  ASSETS: Fetcher;
  /** 镜像数据桶：读写用户层与表数据（wrangler.jsonc 的 r2_buckets）。 */
  MIRROR_BUCKET: R2Bucket;
  /** GitHub OAuth App 的客户端 id 与密钥。 */
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  /** 会话 cookie 的 HMAC 签名密钥（任意长随机串）。 */
  SESSION_SECRET: string;
  /** fine-grained PAT（仅 actions:write）：触发 fetch-table 与 deploy 工作流。 */
  GITHUB_DISPATCH_TOKEN: string;
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
