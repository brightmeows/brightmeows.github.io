---
name: ssa3rd
description: 用于在 Satellite Skill Analyzer 3rd 添加新的 course。
---

# Satellite Skill Analyzer 3rd 添加 Course 流程

## 数据源

根据当前任务确定：

- BMS数据：`D:\Codes\bms-table-mirror\tables\[stellabms.xyz] Satellite\data.json`
- Header配置：`static/bms/table/satellite-skill-analyzer-3rd-preview/header.json`

## 添加步骤

### 1. 获取曲名和难度

从用户提交的信息中提取：

- 曲名（4首）
- 难度等级（sl0, sl1, sl2, sl3 等）
- 后缀名（用户名）

### 2. 搜索MD5

在data.json中搜索曲名（不限制level），找到所有匹配项：

```python
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
data_path = "D:/Codes/bms-table-mirror/tables/[stellabms.xyz] Satellite/data.json"
with open(data_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

songs = ['曲名1', '曲名2', '曲名3', '曲名4']
for song in songs:
    print(f'=== Searching: {song} ===')
    for item in data:
        if song in item.get('title', ''):
            print(f"{item.get('title')}: level={item.get('level')}, md5={item.get('md5')}")
```

根据输出的结果，选择标题/难度最接近的MD5。

### 3. 更新header.json

先读取现有的header.json，了解当前course结构，然后添加新course到**文件末尾**：

```json
[
  {
    "name": "Satellite Skill Analyzer 3rd sl{难度} {后缀}",
    "constraint": ["grade_mirror", "gauge_lr2", "ln"],
    "trophy": [
      { "name": "silvermedal", "missrate": 5.0, "scorerate": 70.0 },
      { "name": "goldmedal", "missrate": 2.5, "scorerate": 85.0 }
    ],
    "md5": ["曲名1的md5", "曲名2的md5", "曲名3的md5", "曲名4的md5"]
  }
]
```

### 4. 注意事项

- 四个曲名的MD5必须按1st → 2nd → 3rd → final的顺序填入
- constraint和trophy与现有部分保持一致
- course名称格式：`Satellite Skill Analyzer 3rd sl{难度} {后缀}`
  - 如果用户提交的是"代案"，名称应为 `Satellite Skill Analyzer 3rd sl{难度} {用户名} 代案`
- **必须追加到文件末尾**，不要插入到开头
- 处理日文字符时需要设置 `sys.stdout.reconfigure(encoding='utf-8')`
- 注意曲名中的特殊符号：〇 是不同的字符
