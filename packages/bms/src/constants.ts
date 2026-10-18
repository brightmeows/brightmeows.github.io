/** 约束值 → 显示文案 */
const CONSTRAINT_LABELS: Record<string, string> = {
  grade_random: "RANDOM 許可",
  grade_mirror: "MIRROR 許可",
  no_speed: "HI-SPEED 禁止",
  no_good: "GOOD 无效",
  no_great: "GREAT 无效",
  ln: "LN 譜面",
  gauge_lr2: "LR2 段位槽",
  gauge_5k: "5K 段位槽",
  gauge_7k: "7K 段位槽",
  gauge_9k: "9K 段位槽",
  gauge_24k: "24K 段位槽",
};

/** 奖牌名 → emoji */
const TROPHY_EMOJIS: Record<string, string> = {
  goldmedal: "🥇",
  silvermedal: "🥈",
  bronzemedal: "🥉",
};

/** 约束标签翻译：已知缩写映射为展示标签，未知原样返回。 */
export function formatConstraint(c: string): string {
  return CONSTRAINT_LABELS[c] ?? c;
}

/** 段位奖牌 emoji：未知名称回落通用奖牌。 */
export function trophyEmoji(name: string): string {
  return TROPHY_EMOJIS[name] ?? "🏅";
}
