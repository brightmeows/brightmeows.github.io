// 此代码部署在Google Apps Script中
/**
 * 处理函数定义 (必须在 CONFIG 外部)
 * @param {*} val - 等级值
 * @returns {string} 去除 sr 前缀后的等级值
 */
function processLv(val) {
  return String(val).replace(/^sr/i, "");
}

/**
 * 全局配置对象 (使用 var 而非 const)
 * sr1-4 Recommendation 表配置
 */
var CONFIG = {
  // 电子表格ID
  spreadsheetId: "1WJVQnOfS5Yb-7zx_KDBBlpdFLlsw1ylAdz4_9nEP0Gk",
  // 工作表名称
  sheetName: "sr1-4 Recommendation",

  // 字段映射：将表格列名转换为JSON键名
  fieldMap: {
    Title: "title",
    Artist: "artist",
    "Lv.": "level",
    Recommender: "recommender",
    MD5: "md5",
    SHA256: "sha256",
    URL: "url",
    "URL Diff": "url_diff",
  },

  // 字段处理器：对特定字段进行转换处理
  processors: {
    "Lv.": processLv,
  },
};

/**
 * Migration 表配置
 * 用于处理从旧表迁移过来的数据
 * 相比 sr1-4 Recommendation 表多了 Genre 和 Comment 列
 */
var MIGRATION_CONFIG = {
  // 电子表格ID
  spreadsheetId: "1WJVQnOfS5Yb-7zx_KDBBlpdFLlsw1ylAdz4_9nEP0Gk",
  // 工作表名称
  sheetName: "Migration",

  // A-F 列索引（用于提取 level 值，0-5 对应 A-F 列）
  levelColumnIndices: [0, 1, 2, 3, 4, 5],

  // 字段映射：将表格列名转换为JSON键名
  fieldMap: {
    Title: "title",
    Artist: "artist",
    "Original Level": "original_level",
    Genre: "genre",
    Comment: "comment",
    Recommender: "recommender",
    MD5: "md5",
    SHA256: "sha256",
    URL: "url",
    "URL Diff": "url_diff",
  },

  // 字段处理器
  processors: {},
};

/**
 * 从指定列索引中提取包含 sr 前缀的值
 * 用于 Migration 表：从 A-F 列中提取第一个有 sr 前缀的值作为 level
 * 如果 A-F 列中没有 sr 前缀则返回 null
 * @param {Array} row - 数据行
 * @param {Array} columnIndices - 需要检查的列索引数组（A-F 列 = 0-5）
 * @returns {string|null} - 提取的 level 值（去除 sr 前缀），如果没有则返回 null
 */
function extractSrLevel(row, columnIndices) {
  for (var i = 0; i < columnIndices.length; i++) {
    var idx = columnIndices[i];
    var val = String(row[idx] || "");
    if (/^sr/i.test(val)) {
      return val.replace(/^sr/i, "");
    }
  }
  return null;
}

/**
 * 核心处理器函数
 * @param {Object} config - 配置对象（CONFIG 或 MIGRATION_CONFIG）
 * @param {Object} options - 可选参数
 * @param {Function} options.levelExtractor - level 提取函数，接受 (row) 参数，返回 level 值
 * @returns {Object} - JSON 响应对象
 */
function createJsonHandler(config, options) {
  options = options || {};
  var levelExtractor = options.levelExtractor;

  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) {
    return responseJson({ error: "Sheet not found: " + config.sheetName }, 404);
  }

  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return responseJson([], 200);
  }

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var isEmpty = true;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== "" && row[k] !== null) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) continue;

    var record = {};

    // 如果配置了 levelExtractor，优先使用它提取 level 值
    // 如果返回 null，说明 A-F 列中没有 sr 前缀，跳过该行
    if (levelExtractor) {
      var extractedLevel = levelExtractor(row);
      if (extractedLevel === null) {
        continue;
      }
      record.level = extractedLevel;
    }

    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var rawValue = row[j];

      // 如果 level 已被提取，跳过 fieldMap 中对 level 的映射
      if (header === "Lv." && record.level !== undefined) {
        continue;
      }
      if (header === "Original Level" && record.level !== undefined) {
        continue;
      }

      var key = config.fieldMap[header] || header;
      var value = rawValue;

      if (config.processors[header] && typeof config.processors[header] === "function") {
        value = config.processors[header](rawValue);
      }

      record[key] = value;
    }

    result.push(record);
  }

  return responseJson(result, 200);
}

/**
 * 辅助函数：JSON 响应
 * @param {*} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @returns {Object} - ContentService TextOutput 对象
 */
function responseJson(data, status) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 入口函数
 * 处理 HTTP GET 请求，返回合并后的 JSON 数据
 * 默认返回 sr1-4 Recommendation 和 Migration 两个表的数据
 * @param {Object} e - Apps Script 事件对象
 * @returns {Object} - JSON 或 JSONP 响应
 */
function doGet(e) {
  var callback = e && e.parameter ? e.parameter.callback : "";
  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return responseJson({ error: "Invalid callback" }, 400);
  }

  var result = [];

  var srResult = createJsonHandler(CONFIG);
  result = result.concat(JSON.parse(srResult.getContent()));

  var migrationResult = createJsonHandler(MIGRATION_CONFIG, {
    // 从 A-F 列（索引 0-5）提取第一个有 sr 前缀的值作为 level
    // 如果返回 null 则跳过该行
    levelExtractor: function (row) {
      return extractSrLevel(row, MIGRATION_CONFIG.levelColumnIndices);
    },
  });
  result = result.concat(JSON.parse(migrationResult.getContent()));

  var output = responseJson(result, 200);

  if (callback) {
    var textOutput = ContentService.createTextOutput(callback + "(" + output.getContent() + ")");
    textOutput.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return textOutput;
  }

  return output;
}
