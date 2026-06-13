/**
 * 精选难度表列表（手动维护）
 *
 * 填入原始 URL（url_from），用于镜像列表页的"精选难度表"筛选。
 * 匹配时优先比对 `url_from`，若不存在则比对 `url`。
 *
 * ⚠️ 数组顺序即筛选激活时的组内排序顺序（见 GroupedTablesSection.svelte sortedItems）。
 *    新增条目请按展示优先级依次添加。
 */
export const FEATURED_TABLES: string[] = [
  // 通常難易度表
  "https://darksabun.club/table/archive/normal1/",
  // 発狂BMS難易度表
  "https://darksabun.club/table/archive/insane1/",
  // NEW GENERATION 通常難易度表
  "http://rattoto10.jounin.jp/table.html",
  // NEW GENERATION 発狂難易度表
  "http://rattoto10.jounin.jp/table_insane.html",
  // 第三期Overjoy
  "http://rattoto10.jounin.jp/table_overjoy.html",
  // Starlight
  "https://stellabms.xyz/sr/table.html",
  // Satellite
  "https://stellabms.xyz/sl/table.html",
  // Solar
  "https://stellabms.xyz/so/table.html",
  // Stella
  "https://stellabms.xyz/st/table.html",
  // Supernova
  "https://stellabms.xyz/sn/table.html",
  // 皿難易度表(3rd)
  "http://minddnim.web.fc2.com/sara/3rd_hard/bms_sara_3rd_hard.html",
  // Scramble難易度表
  "https://egret9.github.io/Scramble/",
  // LN難易度
  "http://flowermaster.web.fc2.com/lrnanido/gla/LN.html",
  // Luminous
  "https://ladymade-star.github.io/luminous/table.html",
  // 連打難易度表
  "https://darksabun.club/table/archive/renda/",
  // Stardust
  "https://mqppppp.neocities.org/StardustTable.html",
  // 癖譜面ライブラリー
  "https://rattoto10.web.fc2.com/kuse_library/table.html",
  // δ難易度表
  "https://deltabms.yaruki0.net/table/data/dpdelta_head.json",
  // 発狂DP難易度表
  "https://deltabms.yaruki0.net/table/data/insane_head.json",
  // DP Satellite
  "https://stellabms.xyz/dp/table.html",
  // DP Stella
  "https://stellabms.xyz/dpst/table.html",
  // DP Overjoy（limite 版）
  "https://bms.limiteknj.net/dpoverjoy/",
  // DPBMSと諸感
  "https://yaruki0.net/DPlibrary/",
  // 発狂DPBMSごった煮難易度表
  "http://yuyuyu.soudesune.net/DPgottani/insane2.html",
  // 発狂14keyBMS闇鍋難易度表
  "https://kenpel.github.io/objeCraft/table14/",
  // DPBMS白難易度表(通常)
  "http://dpbmschart.web.fc2.com/normal-chart/normal_chart.html",
  // DPBMS黒難易度表(発狂)
  "http://dpbmschart.web.fc2.com/insane-chart/insane_chart.html",
  // PMS通常難易度表
  "http://hiiiii.web.fc2.com/pms/Table.htm",
  // 発狂PMS難易度表
  "http://stellawingroad.web.fc2.com/new/pms.html",
  // PMSデータベース(Lv1~45)
  "https://pmsdifficulty.xxxxxxxx.jp/PMSdifficulty.html",
  // 発狂PMSデータベース(lv46～)
  "https://pmsdifficulty.xxxxxxxx.jp/insane_PMSdifficulty.html",
];
