// 此代码部署在Google Apps Script中
/**
 * 处理函数定义 (必须在 CONFIG 外部)
 */
function processLv(val) {
  return String(val).replace(/^sr/i, "");
}

/**
 * 全局配置对象 (使用 var 而非 const)
 */
var CONFIG = {
  spreadsheetId: "1WJVQnOfS5Yb-7zx_KDBBlpdFLlsw1ylAdz4_9nEP0Gk",
  sheetName: "sr1-4 Recommendation",

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

  processors: {
    "Lv.": processLv,
  },
};

/**
 * 核心处理器函数
 */
function createJsonHandler(config) {
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

    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var rawValue = row[j];

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
 */
function responseJson(data, status) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 入口函数
 */
function doGet(e) {
  var callback = e && e.parameter ? e.parameter.callback : "";
  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return responseJson({ error: "Invalid callback" }, 400);
  }
  var result = createJsonHandler(CONFIG);

  if (callback) {
    var output = ContentService.createTextOutput(callback + "(" + result.getContent() + ")");
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  }

  return result;
}
