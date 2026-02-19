---
title: "Markdown 元素测试页"
date: "2025-12-26"
order: 1
---

# Markdown 元素测试页

这是一篇用于测试 Markdown 渲染能力的博文，尽量覆盖常见语法（包含数学公式）。

## 标题层级

## 二级标题（H2）

### 三级标题（H3）

#### 四级标题（H4）

##### 五级标题（H5）

###### 六级标题（H6）

## 基础排版

普通段落。支持 **加粗**、_斜体_、~~删除线~~、以及 `行内代码`。

换行测试：这一行结尾有两个空格。 下一行应该换行而不是另起段落。

转义字符：\*这段文字不应该变成斜体\*，\`也不应该变成代码\`。

## 引用（Blockquote）

> 这是一段引用。
>
> > 这是嵌套引用。

## 列表

无序列表：

- 项目 A
- 项目 B
  - 子项目 B-1
  - 子项目 B-2
- 项目 C

有序列表：

1. 第一步
2. 第二步
3. 第三步

任务列表（GFM）：

- [x] 已完成任务
- [ ] 未完成任务

## 链接

行内链接：[Svelte](https://svelte.dev/)。

引用式链接：[mdsvex][mdsvex] 与 [KaTeX][katex]。

[mdsvex]: https://mdsvex.com/
[katex]: https://katex.org/

## 图片

远程图片（用于测试 img 渲染与 alt 文本）：

![MiyakoMeow avatar](https://github.com/MiyakoMeow.png)

## 表格（GFM）

| 左对齐 | 居中 | 右对齐 |
| :----- | :--: | -----: |
| a      |  b   |      c |
| 1      |  2   |      3 |
| 长文本 |  ✅  |  12345 |

## 代码块

```ts
type User = {
  id: number;
  name: string;
};

export function greet(user: User): string {
  return `Hello, ${user.name}`;
}
```

```rust
fn main() {
    let xs = [1, 2, 3];
    let sum: i32 = xs.iter().sum();
    println!("{sum}");
}
```

```bash
echo "hello"
```

## 分隔线

---

## 内联 HTML

<details>
  <summary>点我展开（details/summary）</summary>
  <p>这里是 details 内容，用于测试 HTML 块的渲染。</p>
</details>

<kbd>Ctrl</kbd> + <kbd>S</kbd>

## 自定义容器（基于 class）

<div class="info">
  <strong>信息：</strong>这是一个 info 容器，用于测试样式。
</div>

<div class="warning">
  <strong>警告：</strong>这是一个 warning 容器，用于测试样式。
</div>

<div class="tip">
  <strong>提示：</strong>这是一个 tip 容器，用于测试样式。
</div>

## 数学公式

行内公式：$E=mc^2$，以及 $a^2+b^2=c^2$。

块级公式：

$$
\int_0^1 x^2 \, dx = 1/3
$$
