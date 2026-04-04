// 此代码部署在Google Apps Script中

/**
 * ============================================
 * 常量定义
 * ============================================
 */

var CONSTANTS = {
  DEFAULT_MD5: "ffffffffffffffffffffffffffffffff",
  DEFAULT_SHA256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  LEVEL_PATTERN: /^sr(\d+)$/i,
  MD5_PATTERN: /^[a-f0-9]{32}$/,
  SHA256_PATTERN: /^[a-f0-9]{64}$/,
  CALLBACK_PATTERN: /^[A-Za-z_$][0-9A-Za-z_$\.]*$/,
  SPREADSHEET_ID: "1WJVQnOfS5Yb-7zx_KDBBlpdFLlsw1ylAdz4_9nEP0Gk",
};

/**
 * ============================================
 * 验证器模块
 * ============================================
 */

var Validators = {
  /**
   * 验证并提取 level 值，严格匹配 sr + 数字格式
   * @param {*} val - 等级值
   * @returns {string|null} 去除 sr 前缀后的数字，格式无效返回 null
   */
  processLevel: function (val) {
    var match = String(val || "")
      .trim()
      .match(CONSTANTS.LEVEL_PATTERN);
    return match ? match[1] : null;
  },

  /**
   * 校验并处理 MD5 值
   * @param {*} val - 原始值
   * @returns {string} 有效的 MD5 值或默认值
   */
  processMd5: function (val) {
    var str = String(val || "")
      .toLowerCase()
      .trim();
    return CONSTANTS.MD5_PATTERN.test(str) ? str : CONSTANTS.DEFAULT_MD5;
  },

  /**
   * 校验并处理 SHA256 值
   * @param {*} val - 原始值
   * @returns {string} 有效的 SHA256 值或默认值
   */
  processSha256: function (val) {
    var str = String(val || "")
      .toLowerCase()
      .trim();
    return CONSTANTS.SHA256_PATTERN.test(str) ? str : CONSTANTS.DEFAULT_SHA256;
  },
};

/**
 * ============================================
 * 配置管理
 * ============================================
 */

var ConfigManager = {
  // 基础字段映射（共享）
  _baseFieldMap: {
    Title: "title",
    Artist: "artist",
    Recommender: "recommender",
    MD5: "md5",
    SHA256: "sha256",
    URL: "url",
    "URL Diff": "url_diff",
  },

  // 基础处理器（共享）
  _baseProcessors: {
    MD5: Validators.processMd5,
    SHA256: Validators.processSha256,
  },

  /**
   * 创建 sr1-4 Recommendation 表配置
   */
  createSrConfig: function () {
    return {
      spreadsheetId: CONSTANTS.SPREADSHEET_ID,
      sheetName: "sr1-4 Recommendation",
      fieldMap: Object.assign({}, this._baseFieldMap, {
        "Lv.": "level",
      }),
      processors: Object.assign({}, this._baseProcessors),
      levelColumn: "Lv.",
    };
  },

  /**
   * 创建 Migration 表配置
   */
  createMigrationConfig: function () {
    return {
      spreadsheetId: CONSTANTS.SPREADSHEET_ID,
      sheetName: "Migration",
      fieldMap: Object.assign({}, this._baseFieldMap, {
        "Original Level": "original_level",
        Genre: "genre",
        Comment: "comment",
      }),
      processors: Object.assign({}, this._baseProcessors),
      levelColumnIndices: [0, 1, 2, 3, 4, 5],
    };
  },
};

/**
 * ============================================
 * 数据处理工具
 * ============================================
 */

var DataUtils = {
  /**
   * 从指定列索引中提取 level 值
   * @param {Array} row - 数据行
   * @param {Array} columnIndices - 需要检查的列索引数组
   * @returns {string|null} - 提取的 level 值，如果没有有效值则返回 null
   */
  extractSrLevel: function (row, columnIndices) {
    for (var i = 0; i < columnIndices.length; i++) {
      var val = String(row[columnIndices[i]] || "").trim();
      var match = val.match(CONSTANTS.LEVEL_PATTERN);
      if (match) return match[1];
    }
    return null;
  },

  /**
   * 修剪行数据（去除空白字符）
   * @param {Array} row - 原始数据行
   * @returns {Array} - 修剪后的行
   */
  trimRow: function (row) {
    return row.map(function (val) {
      return val !== "" && val !== null ? String(val).trim() : val;
    });
  },

  /**
   * 检查行是否为空
   * @param {Array} row - 数据行
   * @returns {boolean}
   */
  isEmptyRow: function (row) {
    return row.every(function (val) {
      return val === "" || val === null;
    });
  },

  /**
   * 构建列名到索引的映射
   * @param {Array} headers - 表头数组
   * @returns {Object} - 映射对象
   */
  buildHeaderMap: function (headers) {
    var map = {};
    headers.forEach(function (header, index) {
      map[header] = index;
    });
    return map;
  },
};

/**
 * ============================================
 * 响应工具
 * ============================================
 */

var ResponseUtils = {
  /**
   * 创建 JSON 响应
   * @param {*} data - 响应数据
   * @param {number} status - HTTP 状态码（目前仅用于记录，GAS始终返回200）
   * @returns {Object} - ContentService TextOutput 对象
   */
  json: function (data, status) {
    var output = ContentService.createTextOutput(JSON.stringify(data));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  },

  /**
   * 创建 JSONP 响应
   * @param {string} callback - 回调函数名
   * @param {Object} jsonOutput - JSON 响应对象
   * @returns {Object} - ContentService TextOutput 对象
   */
  jsonp: function (callback, jsonOutput) {
    var textOutput = ContentService.createTextOutput(
      callback + "(" + jsonOutput.getContent() + ")"
    );
    textOutput.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return textOutput;
  },

  /**
   * 验证回调函数名是否合法
   * @param {string} callback - 回调函数名
   * @returns {boolean}
   */
  isValidCallback: function (callback) {
    return callback && CONSTANTS.CALLBACK_PATTERN.test(callback);
  },
};

/**
 * ============================================
 * 核心处理器
 * ============================================
 */

var JsonHandler = {
  /**
   * 处理单个工作表，生成 JSON 数据
   * @param {Object} config - 配置对象
   * @param {Object} options - 可选参数
   * @param {Function} options.levelExtractor - level 提取函数
   * @returns {Array} - 处理后的数据数组
   */
  processSheet: function (config, options) {
    options = options || {};
    var ss = SpreadsheetApp.openById(config.spreadsheetId);
    var sheet = ss.getSheetByName(config.sheetName);

    if (!sheet) {
      throw new Error("Sheet not found: " + config.sheetName);
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0];
    var headerIndexMap = DataUtils.buildHeaderMap(headers);
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var trimmedRow = DataUtils.trimRow(data[i]);
      if (DataUtils.isEmptyRow(trimmedRow)) continue;

      var record = {};

      // 提取 level 值
      if (options.levelExtractor) {
        var extractedLevel = options.levelExtractor(trimmedRow, headerIndexMap);
        if (extractedLevel === null) continue;
        record.level = extractedLevel;
      }

      // 处理其他字段
      this._processFields(record, headers, trimmedRow, config, headerIndexMap);
      result.push(record);
    }

    return result;
  },

  /**
   * 处理记录字段
   * @private
   */
  _processFields: function (record, headers, row, config, headerIndexMap) {
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var rawValue = row[j];

      // 跳过已处理的 level 字段
      if (this._isLevelField(header, record)) continue;

      var key = config.fieldMap[header] || header;
      var value = config.processors[header] ? config.processors[header](rawValue) : rawValue;

      record[key] = value;
    }
  },

  /**
   * 检查是否为已处理的 level 字段
   * @private
   */
  _isLevelField: function (header, record) {
    return (header === "Lv." || header === "Original Level") && record.level !== undefined;
  },
};

/**
 * ============================================
 * 入口函数
 * ============================================
 */

/**
 * 处理 HTTP GET 请求，返回合并后的 JSON 数据
 * @param {Object} e - Apps Script 事件对象
 * @returns {Object} - JSON 或 JSONP 响应
 */
function doGet(e) {
  try {
    var callback = e && e.parameter ? e.parameter.callback : "";
    if (callback && !ResponseUtils.isValidCallback(callback)) {
      return ResponseUtils.json({ error: "Invalid callback" }, 400);
    }

    var result = [];

    // 处理 sr1-4 Recommendation 表
    var srConfig = ConfigManager.createSrConfig();
    var srData = JsonHandler.processSheet(srConfig, {
      levelExtractor: function (row, headerIndexMap) {
        var lvIndex = headerIndexMap[srConfig.levelColumn];
        return lvIndex !== undefined ? Validators.processLevel(row[lvIndex]) : null;
      },
    });
    result = result.concat(srData);

    // 处理 Migration 表
    var migrationConfig = ConfigManager.createMigrationConfig();
    var migrationData = JsonHandler.processSheet(migrationConfig, {
      levelExtractor: function (row) {
        return DataUtils.extractSrLevel(row, migrationConfig.levelColumnIndices);
      },
    });
    result = result.concat(migrationData);

    var output = ResponseUtils.json(result, 200);
    return callback ? ResponseUtils.jsonp(callback, output) : output;
  } catch (error) {
    return ResponseUtils.json({ error: error.message }, 500);
  }
}
