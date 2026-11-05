---
title: "数据结构与算法"
date: "2026-11-05"
order: 14
slug: "compendium/14-data-structures-and-algorithms"
description: "数组和哈希表是编程中最基础的两类数据结构。本文件将介绍它们的工作原理，随后通过逐步增加难度的示例，讲解几种关键的解题思路——双指针法、滑动窗口法、前缀和法以及基于哈希的查找法，同时指出每一步中可能出现的常见陷阱。"
tags: []
---

## 基础知识：大O记号、递归、回溯与动态规划

在深入学习数据结构和算法之前，你需要掌握四个基础概念：用于衡量效率的大O记号、用于将问题拆解为子问题的递归、用于带剪枝的穷举搜索的回溯，以及用于避免重复计算的动态规划。本文档将从基本原理出发讲解每一个概念。

- 本章后续文档假设你已经熟悉这四个概念。如果你跳过本文档，后续文档中出现的$O(n \log n)$标注、递归树遍历、回溯模板以及动态规划状态转移等内容，对你而言就会像魔法一般难以理解，而非工程上的必然结果。

## 为何要掌握模式而非死记硬背

- LeetCode、NeetCode和HackerRank上有成千上万的编程题目。没人能记住所有题目，试图这么做也是徒劳。面试官不会从固定列表中挑选题目，他们会修改、组合或伪装题目。如果只记住了“两数之和”的解法，当面试官提出一个你从未见过的变体时，这个解法便无济于事。

- 好消息是：核心模式只有大约**15–20种**（双指针、滑动窗口、BFS/DFS、动态规划、回溯等）。无论表面上看题目多么新颖，它们最终都能归结为其中一种或几种模式的组合。面试考察的不是你是否见过完全相同的题目，而是能否**剥离上下文、具体描述、数据类型及边界条件**，从而识别出背后的模式。

- 请看下面三个题目：
- “在数组中找出两个数，使它们的和等于目标值。”
- “找出两个分子，使它们的结合能之和达到阈值。”
- “给定一组账户余额，找出两个账户，使它们的总值等于某笔债务。”

- 它们看起来各不相同，但本质都是同一个问题：**两数之和**。上下文（数字、分子、账户）并不重要，其结构都是：在集合中查找补数 → 通过哈希表进行查找。

- 正因如此，本章通过直觉来传授**模式**，而非通过重复记忆解法。对于每种模式，我们都会说明：
- 问题的哪种**结构特征**表明该模式适用（有序输入 → 双指针；子数组约束 → 滑动窗口；最优子结构且存在重叠子问题 → 动态规划）。
- 该模式为何有效——基于数学或逻辑层面的推理，而不仅仅是“它能得出正确答案”。
- 如何灵活应用——通过展示简单、中等和复杂的变体，说明同一核心思想在不同场景下的应用方式。

- 当你深刻理解滑动窗口为何有效（因为约束条件的单调性决定了只需扩展或收缩即可），就能将其应用于任何具有类似结构的问题，哪怕是你从未见过的题目。而若你只是记住了“无重复字符的最长子串”的代码，一旦题目稍作变化，你就无从下手。

- 实用的策略如下：

1. **学习模式**（本章内容）。
2. **练习在伪装后的题目中识别它**（每篇文档末尾的NeetCode课后题）。
3. **在时间压力下练习实现它**。
4. 面试时：阅读题目 → 剥离上下文 → 识别模式 → 实现解法。

---

## 大O记号

- 当我们说某个算法“快”或“慢”时，需要一种精确的方式来衡量。**大O记号**描述了随着输入规模$n$增大，算法的运行时间（或空间占用）的增长情况，同时忽略常数因子和低阶项。

- 正式定义：$f(n) = O(g(n))$意味着存在常数$c > 0$和$n_0$，使得对所有$n \geq n_0$都有$f(n) \leq c \cdot g(n)$。通俗地说：对于大规模输入，$f$的增长速度不会超过$g$。

- 为何忽略常数？因为$2n$算法和$5n$算法都属于$O(n)$：它们的增长方式相同。在更快的计算机上，常数会发生变化，但增长趋势不变。大O记号捕捉的是问题本身的**内在难度**，与硬件无关。

### 增长率层级

- 从最快到最慢依次为：

| 大O记号 | 名称 | 示例 | $n = 10^6$时的操作次数 |
| --------- || ------ || ------ || ---------------------- ||
| $O(1)$ | 常数时间 | 数组访问、哈希查找 | 1 |
| $O(\log n)$ | 对数时间 | 二分查找 | 20 |
| $O(n)$ | 线性时间 | 线性扫描、单层循环 | $10^6$ |
| $O(n \log n)$ | 线性对数时间 | 归并排序、高效排序 | $2 \times 10^7$ |
| $O(n^2)$ | 平方时间 | 嵌套循环、暴力枚举配对 | $10^{12}$（太慢） |
| $O(n^3)$ | 立方时间 | 三重嵌套循环、矩阵乘法 | $10^{18}$（极其缓慢） |
| $O(2^n)$ | 指数时间 | 所有子集枚举、暴力回溯 | $10^{301030}$（不可能实现） |
| $O(n!)$ | 阶乘时间 | 所有排列组合 | 多到无法想象 |

- **经验法则**：现代计算机每秒可执行约$10^8$–$10^9$次简单操作。在1秒的时间限制下：
- $O(n)$适用于$n \leq 10^8$
- $O(n \log n)$适用于$n \leq 10^7$
- $O(n^2)$适用于$n \leq 10^4$
- $O(2^n)$适用于$n \leq 25$

- 这张表能帮你立刻判断自己的解法是否足够高效。如果$n = 10^5$且解法为$O(n^2)$，则操作次数将达到$10^{10}$——显然太慢。此时你需要更优的算法。

### 如何分析大O记号

- 对$n$个元素进行**单层循环**：$O(n)$。

```python
total = 0
for x in arr:   # n iterations
    total += x   # O(1) per iteration
# Total: O(n)
```

- **嵌套循环**：将迭代次数相乘。

```python
for i in range(n):       # n iterations
    for j in range(n):   # n iterations each
        process(i, j)    # O(1)
# Total: O(n^2)
```

- **二分循环**：$O(\log n)$。每次迭代将问题规模减半，因此需要 $\log_2 n$ 次迭代。

```python
i = n
while i > 0:
    process(i)
    i //= 2
# Total: O(log n)
```

- **嵌套循环：内层循环依赖于外层循环**：

```python
for i in range(n):
    for j in range(i):   # j goes from 0 to i-1
        process(i, j)
# Total: 0 + 1 + 2 + ... + (n-1) = n(n-1)/2 = O(n^2)
```

- **递归**：写出递推关系式并求解（第13章介绍了主定理）。例如，归并排序：$T(n) = 2T(n/2) + O(n) = O(n \log n)$。

### 常见陷阱

- **隐藏的循环**：在Python中，`x in list`的时间复杂度为$O(n)$（线性扫描），而`x in set`的时间复杂度为$O(1)$。在循环中对列表使用`in`操作会导致$O(n^2)$的时间复杂度，而非$O(n)$。

```python
# BAD: O(n^2) — "in" on a list is O(n)
for x in arr:
    if x in another_list:
        process(x)

# GOOD: O(n) — convert to set first
another_set = set(another_list)
for x in arr:
    if x in another_set:
        process(x)
```

- **字符串拼接**：在Python中，`s += c`每次都会复制整个字符串。在$n$次迭代的循环中：时间复杂度为$O(1 + 2 + \cdots + n) = O(n^2)$。

- **排序的主导性**：如果算法先进行排序（$O(n \log n)$），再进行线性扫描（$O(n)$），总时间复杂度仍为$O(n \log n)$——排序步骤起主导作用。

- **摊还复杂度**：某些操作偶尔代价较高，但平均而言成本较低。动态数组的追加操作摊还复杂度为$O(1)$，因为罕见的$O(n)$规模调整操作会被分散到多次廉价的追加操作中。切勿将摊还复杂度为$O(1)$与最坏情况下的$O(1)$混淆。

### 空间复杂度

- 空间复杂度遵循相同的大O规则，只是应用于内存占用而非时间。

- **原地算法**仅使用$O(1)$的额外空间（不包括输入数据）。快速排序的空间复杂度为$O(\log n)$（递归栈深度）。归并排序的空间复杂度为$O(n)$（用于合并的临时数组）。

- **递归栈**：每次递归调用都会占用栈空间。深度为$n$的递归会占用$O(n)$的空间，即便每次调用并未分配额外内存。因此，对包含$n$个节点的图进行递归DFS时，空间复杂度为$O(n)$。

- 面试时，务必同时说明时间复杂度和空间复杂度。$O(n)$时间、$O(n)$空间的解决方案通常可接受，但$O(n)$时间、$O(1)$空间的解法则更佳。面试官可能会要求你优化其中之一。

---

## 递归

- **递归**是指函数通过调用自身来解决同一问题的更小实例。对于具有递归结构的问题——如树、嵌套结构、分治问题以及数学序列——递归是最自然的解法。

- 每个递归函数都包含两部分：

1. **基准情况**：可以直接求解的最小实例（无需递归）。它是终止递归的条件。
2. **递归情况**：将问题拆分成更小的子问题，递归求解后再合并结果。

### 示例：阶乘

```python
def factorial(n):
    if n <= 1:        # base case
        return 1
    return n * factorial(n - 1)  # recursive case
```

- `factorial(4)`的执行过程：
- `factorial(4)`调用`factorial(3)`
- `factorial(3)`调用`factorial(2)`
- `factorial(2)`调用`factorial(1)`
- `factorial(1)`返回`1`（基准情况）
- `factorial(2)`返回`2 * 1 = 2`
- `factorial(3)`返回`3 * 2 = 6`
- `factorial(4)`返回`4 * 6 = 24`

- 每次调用都会被压入**调用栈**中。调用栈会不断增长，直到遇到基准情况，随后随着每次调用的返回而逐步展开。如果递归层次过深（例如Python中的`factorial(1000000)`），就会导致栈溢出（`RecursionError`）。Python默认的递归深度限制为1000。

### 如何运用递归思维

- 关键的思维转变：**信任递归**。在编写递归函数时，要假定递归调用能为较小的子问题给出正确答案。你的任务仅仅是：

1. 处理基准情况。
2. 将问题拆分成更小的部分。
3. 合并结果。

- 你无需在脑海中追踪每一次递归调用。这就像试图通过手动执行每一次迭代来理解一个循环一样。相反，只需验证：“如果递归调用对较小的输入能给出正确答案，那么我的合并步骤是否能为完整输入得出正确答案？”

### 示例：链表的递归操作

- 递归地反转链表：

```python
def reverse(head):
    if not head or not head.next:   # base case: 0 or 1 nodes
        return head

    new_head = reverse(head.next)   # reverse the rest
    head.next.next = head           # point the next node back to me
    head.next = None                # I am now the tail
    return new_head
```

- **相信递归**：`reverse(head.next)` 能正确反转列表的其余部分并返回新的头节点。我们只需将当前节点附加到末尾即可。

### 示例：树上的递归

- 计算二叉树的高度：

```python
def height(root):
    if not root:           # base case: empty tree has height 0
        return 0
    left_h = height(root.left)    # height of left subtree
    right_h = height(root.right)  # height of right subtree
    return 1 + max(left_h, right_h)  # this node adds 1 level
```

- 这种模式——“先递归处理左子树，再递归处理右子树，最后合并结果”——能解决绝大多数树相关问题（参见文件03）。

### 递归与迭代

- 任何递归算法都可以转换为迭代算法（使用显式栈或循环）。迭代可以避免调用栈的开销以及栈溢出的风险。

- **何时选择递归**：当问题本身具有自然的递归结构时（如树、嵌套数据、分治问题）。递归解法更简洁，也更容易理解。

- **何时选择迭代**：当递归深度可能非常大时（例如处理包含 $10^6$ 个节点的链表）。迭代解法可避免栈溢出。

- **尾递归**：如果递归调用是函数中的最后一个操作（递归调用返回后不再执行其他操作），则称为尾递归。某些语言（如 Scheme、Scala）会对尾递归进行优化，使其占用常数级的栈空间。Python 并不优化尾递归，因此 Python 中的尾递归仍会占用 $O(n)$ 的栈空间。

### 常见陷阱（续1）

| 陷阱 | 示例 | 解决方法 |
| ------ || ------ || ---------- ||
| 缺少基准情况 | 无限递归导致栈溢出 | 务必明确终止条件 |
| 基准情况错误 | 递归分解时出现偏移错误 | 用最小的输入值（0、1、2）进行测试 |
| 未缩小问题规模 | `f(n)` 调用 `f(n)` 而非 `f(n-1)` | 确保子问题规模严格更小 |
| 冗余计算 | 斐波那契数列：`f(n) = f(n-1) + f(n-2)` 会产生指数级重复计算 | 使用记忆化技术（即动态规划） |
| Python 递归限制 | `factorial(10000)` 会导致程序崩溃 | 使用 `sys.setrecursionlimit` 或改用迭代方式 |

---

## 回溯法

- **回溯法**是一种系统地探索所有可行解的方法：它逐步构建解决方案，并放弃那些不可能产生有效答案的部分解。

- 可以将其想象成在迷宫中导航：在每个岔路口选择一个路径；如果遇到死路，就回到上一个岔路口尝试另一条路径。你不会从头开始，而是**回溯**到最近的决定点。

### 三个步骤

所有回溯算法都遵循相同的模式：

1. **选择**：挑选一个候选元素来扩展当前的部分解。
1. **探索**：递归地尝试从该候选元素出发构造完整解。
1. **撤销选择**：取消该选择（回溯），并尝试下一个候选元素。

```python
def backtrack(state, choices, result):
    if is_complete(state):
        result.append(state.copy())
        return

    for choice in choices:
        if is_valid(choice, state):
            state.add(choice)           # 1. choose
            backtrack(state, choices, result)  # 2. explore
            state.remove(choice)        # 3. unchoose (backtrack)
```

- **撤销选择**步骤是回溯算法与普通递归的区别所在。没有它，状态会累积所有选择，从而无法探索其他路径。

### 何时使用回溯算法

- 问题要求**枚举所有有效配置**：所有排列、所有子集、所有有效布局（如N皇后问题）。
- 问题要求**找到任意一个有效配置**：数独求解、迷宫路径查找。
- 搜索空间很大但可以被**剪枝**：大多数部分解可以在不彻底探索的情况下被提前排除。

### 剪枝如何提升效率

- 没有剪枝时，回溯算法会探索每一种可能的组合——时间复杂度为指数级。**剪枝**能提前剔除无效分支：

```python
for choice in choices:
    if not is_valid(choice, state):
        continue  # PRUNE: skip this entire subtree

    state.add(choice)
    backtrack(state, choices, result)
    state.remove(choice)
```

在N皇后问题（文件05）中，放置皇后前先检查列和对角线冲突，可将搜索树中的候选解数量从$n^n$缩减到大约$n!$个。当$n=8$时，候选解数量便从1600万减少到4万。良好的剪枝技术使得指数级算法在中等规模的$n$下也能实用。

### 生成所有子集（最简单的回溯法）

```python
def subsets(nums):
    result = []

    def backtrack(start, path):
        result.append(path[:])  # every partial solution is a valid subset

        for i in range(start, len(nums)):
            path.append(nums[i])        # choose
            backtrack(i + 1, path)       # explore (i+1: no reuse)
            path.pop()                   # unchoose

    backtrack(0, [])
    return result
```

- 对于 `[1, 2, 3]`，递归树如下：
- `[]` → `[1]` → `[1,2]` → `[1,2,3]`（回溯）→ `[1,3]`（回溯）→ `[2]` → `[2,3]`（回溯）→ `[3]`

- 树中的每个节点对应一次对 `backtrack` 的调用。每个叶子节点（以及中间节点）都会生成一个子集。子集总数：$2^n$。

### 生成所有排列

```python
def permutations(nums):
    result = []

    def backtrack(path, remaining):
        if not remaining:
            result.append(path[:])
            return

        for i in range(len(remaining)):
            path.append(remaining[i])                    # choose
            backtrack(path, remaining[:i] + remaining[i+1:])  # explore
            path.pop()                                   # unchoose

    backtrack([], nums)
    return result
```

- 总排列数：$n!$。构造`remaining`需要$O(n)$的时间，因此总时间为$O(n \cdot n!)$。

### 常见陷阱（续2）

| 陷阱 | 示例 | 解决方法 |
| ------ || ------ || ---------- ||
| 忘记复制路径 | `result.append(path)`——所有条目共享同一个列表 | `result.append(path[:])`或`path.copy()` |
| 没有回溯（撤销选择） | 状态不断累积，后续候选解看到的是陈旧的状态 | 递归调用后务必执行`path.pop()`或`state.remove()` |
| 循环起始值错误 | 出现重复子集，或排列中出现不必要的重复使用 | 使用`start`参数以避免重新访问之前的索引 |
| 忽略剪枝 | 探索明显无效的分支 | 在递归调用前添加`if not is_valid: continue` |

---

## 动态规划

- **动态规划（DP）**是一种针对重复求解相同子问题进行的优化技术。它不会重新计算，而是每个子问题只求解一次并将结果存储起来。

- 当问题具备以下两个特性时，可应用动态规划：

1. **最优子结构**：最优解可以由子问题的最优解构建而成。
2. **重叠子问题**：递归过程中会多次出现相同的子问题。

### 斐波那契数列的启示

- 朴素的递归版斐波那契算法：

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

- 对于`fib(5)`，递归树如下：
- `fib(5)`调用`fib(4)`和`fib(3)`
- `fib(4)`调用`fib(3)`和`fib(2)`
- `fib(3)`被计算**两次**，`fib(2)`被计算**三次**

- 其时间复杂度为$O(2^n)$，因为每一层都会产生分支，且大多数分支会重复计算相同的值。对于`fib(50)`，需要超过$10^{15}$次运算——这是不可行的。

- 使用**记忆化**（自顶向下的动态规划）：

```python
def fib_memo(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]
```

- 现在，`fib(3)`仅计算一次并存储起来，后续调用时直接查找。总时间复杂度：$O(n)$，空间复杂度：$O(n)$。

- 采用**表格法**（自底向上的动态规划）：

```python
def fib_tab(n):
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
```

- 时间复杂度同样为$O(n)$，但采用自底向上的方式构建解决方案，无需递归。由于每个值仅依赖于前两个值，因此可进一步优化至$O(1)$的空间复杂度。

### 动态规划解题步骤

对于任何动态规划问题，请遵循以下步骤：

1. **定义状态**：`dp[i]`（或`dp[i][j]`）代表什么？这是最困难的一步。状态必须包含足够的信息才能做出最优决策。

1. **写出递推关系**：`dp[i]`与更小的子问题之间有何关联？这就是转移公式。

1. **确定基准情况**：哪些是最简单的、可以直接求解的子问题？

1. **确定迭代顺序**：哪些子问题必须在其他子问题之前求解？自底向上：按能确保依赖关系被满足的顺序迭代；自顶向下：递归会自动处理这一顺序。

1. **优化空间**（可选）：如果`dp[i]`仅依赖于前一行或前几个元素，就无需使用完整的表格。

### 示例：解题思路

**问题**：给定一个正整数数组，求其中不相邻元素的最大和（小偷抢劫问题）。

**步骤1 — 定义状态**：`dp[i]`表示考虑元素`nums[0..i]`时的最大和。

**步骤2 — 写出递推关系**：对于第$i$个元素，有两种选择：

- 跳过它：`dp[i] = dp[i-1]`（不包含元素$i$时的最佳和）。
- 选取它：`dp[i] = dp[i-2] + nums[i]`（必须跳过元素$i-1$，再加上元素$i$）。

因此：`dp[i] = max(dp[i-1], dp[i-2] + nums[i])`。

**步骤3 — 基准情况**：`dp[0] = nums[0]`，`dp[1] = max(nums[0], nums[1])`。

**步骤4 — 迭代顺序**：从左到右（每个状态都依赖于前两个状态）。

**步骤5 — 空间优化**：只需保存最后两个值即可。

```python
def rob(nums):
    if len(nums) == 1:
        return nums[0]

    prev2, prev1 = nums[0], max(nums[0], nums[1])

    for i in range(2, len(nums)):
        curr = max(prev1, prev2 + nums[i])
        prev2, prev1 = prev1, curr

    return prev1
```

### 如何识别动态规划问题

- 题目要求求解**最优解**（最小成本、最大利润、最长序列）或**计数**（方案数）。
- 问题在每一步都存在**选择**（取/不取、向左/向右走、使用或不使用某枚硬币），且整体最优解取决于子问题的最优解。
- 绘制递归树后会发现**重复的子问题**。
- 暴力解法的时间复杂度是指数级的，但**不同状态的数量**远少于递归调用次数。

### 动态规划的类别

- **一维动态规划**：状态仅依赖于一个索引。示例：爬楼梯、打家劫舍、最大子数组和。
- **二维动态规划**：状态依赖于两个索引。示例：最长公共子序列（`dp[i][j]`表示字符串1的前$i$个字符与字符串2的前$j$个字符）、编辑距离、网格路径问题。
- **区间动态规划**：状态是一个区间，`dp[i][j]`表示数组`arr[i..j]`上的子问题。示例：矩阵链乘法、戳气球。
- **背包动态规划**：状态包含物品索引和容量。示例：0/1背包、零钱兑换、子集和。
- **位运算动态规划**：状态包含一个位掩码，用于记录哪些元素已被选用。示例：旅行商问题、指派问题。状态空间为$O(2^n \cdot n)$，适用于$n \leq 20$的情况。

### 自顶向下 vs 自底向上

|              | 自顶向下（记忆化搜索）             | 自底向上（表格法）       |
| ------------ | ---------------------------------- | ------------------------ |
| 实现方式     | 递归 + 缓存                        | 迭代 + 表格              |
| 计算范围     | 仅计算实际需要的子问题             | 计算直至目标的所有子问题 |
| 栈溢出风险   | 有（递归层次过深）                 | 无                       |
| 空间优化难度 | 较难                               | 较容易（使用滚动数组）   |
| 编码难易度   | 通常更自然（写递归代码，加上缓存） | 需考虑迭代顺序           |

- 面试中，自顶向下的写法往往编码更快；在生产环境中，出于性能考虑通常优先选择自底向上的方法（无递归开销，缓存利用率更高）。

### 常见误区

| 误区 | 示例 | 解决方法 |
| --------- || --------- || ----- ||
| 状态定义错误 | `dp[i]`无法提供足够信息来做出决策 | 增加维度（如将`dp[i]`改为`dp[i][j]`） |
| 缺少基准情况 | `dp[0]`的值错误 → 后续所有值均错误 | 手动验证基准情况 |
| 迭代顺序错误 | 在计算`dp[i]`时其依赖项尚未算出 | 画出依赖关系图并按相应顺序迭代 |
| 未正确初始化`dp` | 本应设为无穷大却用了0（针对求最小值的问题） | 求最小值时用`float('inf')`，求最大值时用`float('-inf')` |
| 忽略“不取”选项 | 总是选取当前元素 | 递归式通常为`max(取, 不取)` |
| 可变默认参数 | `def f(memo={})`会导致多次调用共享同一缓存 | 改为`def f(memo=None): if memo is None: memo = {}` |
| 二维动态规划中的索引偏移错误 | 当`dp`是1索引时仍访问`text1[i]` | `dp`的大小为`(m+1) x (n+1)`，应访问`text1[i-1]` |

---

## 综合应用

- 这四个概念构成了一个递进关系：

1. **大O记号**用于判断某种解法是否足够高效。
2. **递归**用于将问题拆分成子问题。
3. **回溯**是递归 + 选择 + 撤销，用于穷举搜索。
4. **动态规划**是递归 + 缓存，用于解决具有重叠子问题的最优化解题。

- 遇到新问题时：
- 先估算输入规模$n$，确定可接受的大O复杂度。
- 如果暴力解法是指数级的，且题目要求枚举或查找所有配置：采用**回溯**（配合剪枝以提高效率）。
- 如果暴力解法是指数级的，且题目要求求解最优解或计数，同时发现存在重叠子问题：采用**动态规划**。
- 如果问题结构能将搜索空间减半：采用**二分查找**或**分治算法**。
- 如果问题涉及序列且对子数组有约束：采用**滑动窗口**或**双指针**技术。
- 如果需要快速查找：采用**哈希表**。

- 本章的其余文档会将这些思路应用到特定的数据结构和模式中。

## 数组与哈希

_数组和哈希表是编程中最基础的两类数据结构。本文件将介绍它们的工作原理，随后通过逐步增加难度的示例，讲解几种关键的解题思路——双指针法、滑动窗口法、前缀和法以及基于哈希的查找法，同时指出每一步中可能出现的常见陷阱。_

- 如果你深入理解了数组和哈希表，就能解决大约40%的编程面试题。这两种数据结构之所以被广泛使用，是因为它们具备了算法最需要的两种功能：**快速的按索引访问**（数组）以及**通过键快速查找**（哈希表）。

- 本文件侧重于教授解题思路而非具体解决方案。其目的是让读者在遇到新问题时，能够判断应使用哪种解题思路及其原因，而不是试图回忆已记住的答案。

## 数组

- **数组**是一块连续的内存区域，其中的元素按照固定的偏移量存储。要访问第$i$个元素，时间复杂度为$O(1)$，因为其地址可直接通过`base + i * element_size`计算得出。这是最快的数据访问方式，也是数组成为默认数据结构的原因。

- **动态数组**（Python中的`list`、Java中的`ArrayList`、C++中的`vector`）在容量耗尽时会自动扩展。其扩展策略为**摊还双倍大小法**：当数组满时，会分配一个容量为原来两倍的新数组，然后将所有元素复制过去。虽然元素复制的时间复杂度为$O(n)$，但由于这种操作发生的频率很低（每插入$n$个元素才发生一次），因此每次插入的摊还时间复杂度仍为$O(1)$。

- **缓存局部性**是数组在实践中能保持高速访问速度的原因，而不仅仅是在理论上如此。由于元素是连续存储的，访问某个元素时，附近的元素也会被加载到CPU缓存中（详见第13章）。遍历数组时可以利用缓存优势，而遍历链表则无法做到这一点。在实际应用中，这种差异可能导致性能相差10到100倍。

| 操作 | 数组 | 动态数组 |
| ------ || ------ || ---------- ||
| 按索引访问 | $O(1)$ | $O(1)$ |
| 追加元素 | 不适用 | 摊还后为$O(1)$ |
| 在位置$i$处插入元素 | $O(n)$ | $O(n)$ |
| 在位置$i$处删除元素 | $O(n)$ | $O(n)$ |
| 查找元素（未排序） | $O(n)$ | $O(n)$ |

- **常见陷阱**：在数组中间插入或删除元素时，时间复杂度为$O(n)$，因为所有后续元素都需要随之移动。如果需要频繁在数组中间插入元素，可以考虑使用链表或采用其他数据结构。

## 字符串

- **字符串**实际上就是字符的数组。在Python中，字符串是不可变的：每次字符串拼接都会创建一个新的字符串。如果通过循环逐个字符构建字符串，时间复杂度将为$O(n^2)$，因为每次拼接都需要复制整个字符串。

```python
# BAD: O(n^2) string concatenation
s = ""
for c in characters:
    s += c  # copies entire string each time

# GOOD: O(n) using a list then join
parts = []
for c in characters:
    parts.append(c)
s = "".join(parts)
```

- **常见陷阱**：在Python中，循环中使用`s += c`是导致性能问题的最常见原因之一。应先将数据收集到列表中，再使用`.join()`方法进行处理。

- **编码方式**：ASCII编码使用7位，可表示128个字符。而**UTF-8**则是变长编码：ASCII字符占用1字节，带重音的字符占用2字节，中文/日文字符占用3字节，表情符号则占用4字节。当题目要求处理“小写英文字母”时，由于英文字母共有26个，因此可以使用固定大小的数组来替代哈希表。

## 哈希表

- 哈希表能够以$O(1)$的时间复杂度实现键到值的映射、插入和删除操作。其工作原理是通过计算**哈希函数**$h(key)$，将键转换为数组中的索引。

- 哈希函数必须具备以下特性：**确定性**（相同的键始终会产生相同的哈希值）、**均匀性**（能将键均匀地分配到各个桶中），以及**计算速度快**。

- 当两个不同的键被映射到同一个索引时，就会发生**冲突**。解决冲突的两种主要方法如下：

- **链式存储**：每个桶都存储一个键值对链表。遇到冲突时，只需将新键值对添加到该链表末尾。在最坏情况下（所有键都映射到同一个桶），时间复杂度为$O(n)$；而使用良好的哈希函数时，平均时间复杂度为$O(1)$。

- **开放寻址法**：遇到冲突时，会依次检查下一个空闲位置。**线性探测**就是依次检查下一个位置，再下一个位置，以此类推。这种方法对缓存友好，但容易出现**数据聚集**现象（即连续多个位置都被占用）。**罗宾汉哈希法**则通过调整那些“更接近当前位置”的元素，来降低这种聚集现象。

- **负载因子**$\alpha = n / m$（元素数量/桶的数量）决定了哈希表的性能。当$\alpha$超过某个阈值（通常为0.75）时，就需要对哈希表进行**重新哈希**：即分配一个更大的哈希表，然后将所有元素重新插入其中。这一操作的时间复杂度为$O(n)$，但发生的频率较低。

- **哈希映射结构**（Python中的`dict`，Java中的`HashMap`）用于存储键值对。而**哈希集合结构**（Python中的`set`，Java中的`HashSet`）则仅存储键，可用于快速判断某个元素是否存在。

| 操作 | 平均时间复杂度 | 最坏时间复杂度 |
| ------- || -------------- || -------------- ||
| 查找 | $O(1)$ | $O(n)$ |
| 插入 | $O(1)$ | $O(n)$ |
| 删除 | $O(1)$ | $O(n)$ |

- **布隆过滤器**是一种节省空间的概率型数据结构。它能够判断某个元素“肯定不在集合中”，或者“很可能在集合中”（并且可以调整误报率）。它使用$k$个哈希函数和一个位数组来实现功能。布隆过滤器被广泛应用于数据库（避免为不存在的键读取磁盘数据）、网页缓存以及拼写检查器中。

- **何时使用哈希表**：每当需要以$O(1)$的时间复杂度回答“我之前见过这个元素吗？”或“与这个键对应的计数/索引/值是什么？”这样的问题时，就可以考虑使用哈希表。如果需要反复进行线性扫描来查找元素，那么使用哈希表肯定能提升效率。

---

## 常见模式：利用哈希表进行查找

- 最基本的模式就是利用哈希表，将原本需要$O(n)$时间的扫描操作替换为$O(1)$时间的查找操作。

### 简单案例：两数之和问题

- **问题描述**：给定一个整数数组和一个目标值，找出数组中两个数，使得它们的和等于目标值，并返回这两个数的索引。

- **暴力解法**的时间复杂度为$O(n^2)$，需要逐一检查所有数对。

- **高效解法思路**：对于数组中的每个数`num`，我们只需要找到另一个数`target - num`。与其再次遍历整个数组来寻找这个数，不如将之前已经见过的数存储在哈希表中，这样就可以快速找到所需的数了。

```python
def two_sum(nums, target):
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
```

- **原理**：只需遍历数组一次。对于数组中的每个元素，通过哈希表查找的时间复杂度为$O(1)$。因此，总时间复杂度为$O(n)$，空间复杂度也为$O(n)$。

- **注意事项**：在检查是否存在互补元素之前，不要先将当前元素加入哈希表，否则可能会导致某个元素与自身被匹配到一起。上述代码中的操作顺序是正确的：先进行查询，然后再插入元素。

### 中等难度：将同字母异序词分组

- **问题**：给定一组字符串，将其中的同字母异序词分到同一组中。例如，“eat”、“tea”、“ate”属于同一组。

- **解题思路**：同字母异序词的字符组成相同，只是顺序不同。如果对每个字符串进行排序，那么这些同字母异序词就会得到相同的排序后的键值。可以将这个排序后的键值作为哈希表的键。

```python
from collections import defaultdict

def group_anagrams(strs):
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))  # or use character count tuple
        groups[key].append(s)
    return list(groups.values())
```

- **优化方法**：对每个字符串进行排序的复杂度为$O(k \log k)$，其中$k$为字符串的长度。为了获得更高效的键值结构，可以统计字符出现的频率，并以这些频率值构成的元组作为键：

```python
def group_anagrams_fast(strs):
    groups = defaultdict(list)
    for s in strs:
        count = [0] * 26
        for c in s:
            count[ord(c) - ord('a')] += 1
        groups[tuple(count)].append(s)
    return list(groups.values())
```

- 每个字符串的处理时间复杂度为$O(k)$，而非$O(k \log k)$。字符计数元组是一种**规范形式**：对于某个集合中的所有元素来说，其表示方式都是相同的。

- **注意点**：在Python中，列表是不可哈希的（不能用作字典的键）。因此必须将列表转换为元组。当人们尝试使用`groups[count].append(s)`时，往往就会遇到这个问题。

### 难题：最长的连续序列

- **问题**：给定一个无序数组，找出其中最长的连续序列的长度。例如，[100, 4, 200, 1, 3, 2]的最长连续序列长度为4，因为[1, 2, 3, 4]就是这样的序列。

- **暴力解法**的时间复杂度为$O(n \log n)$：先对数组进行排序，然后再查找连续的数字序列。

- **高效解法思路**：将所有数字放入哈希集合中，这样就可以以$O(1)$的时间复杂度查询某个数字是否存在。对于每个数字，检查它是否为某个序列的起始点（即`num - 1`不在该集合中）。如果是，则继续统计该序列的延伸长度。

```python
def longest_consecutive(nums):
    num_set = set(nums)
    best = 0

    for num in num_set:
        # only start counting from the beginning of a sequence
        if num - 1 not in num_set:
            length = 1
            while num + length in num_set:
                length += 1
            best = max(best, length)

    return best
```

- **为何为$O(n)$**：在所有迭代过程中，内部的`while`循环最多会执行$n$次（每个数字最多被访问两次：一次在外层循环中，一次在`while`循环中）。`if num - 1 not in num_set`这一条件确保了计数是从序列的起始位置开始的。

- **潜在问题**：如果没有这个检查，那么就会从每个元素开始计数，最坏情况下时间复杂度将为$O(n^2)$（例如，对于[1, 2, 3, ..., n]这样的序列，就需要从每个起始点开始逐一扫描）。

---

## 模式：双指针法

- **双指针法**利用两个指针来遍历数组，这两个指针通常从数组的两端开始移动，或者从同一点开始但以不同的速度移动。这种方法适用于数组已排序的情况，或者需要比较数组中各对元素的情况。

- **适用场景**：当问题涉及元素对、子数组或分组操作，且数组已经排序（或可以排序而不丢失所需信息）时，就可以使用这种算法。

### 简单案例：判断是否为回文串

- **问题**：判断一个字符串是否为回文串，只考虑字母和数字字符，并忽略大小写。

- **实现方法**：一个指针位于字符串开头，另一个指针位于结尾，然后让两个指针向中间移动，同时比较对应的字符。

```python
def is_palindrome(s):
    left, right = 0, len(s) - 1

    while left < right:
        # skip non-alphanumeric characters
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1

        if s[left].lower() != s[right].lower():
            return False

        left += 1
        right -= 1

    return True
```

- **常见错误**：在内部while循环中忘记检查“left < right”这一条件。如果没有这个检查，对于像“!!!”这样的仅包含非字母数字字符的字符串，指针就可能会越界。

### 中等难度：三数之和

- **问题**：找出数组中所有和为零的独特三元组。

- **解题思路**：先对数组进行排序。固定其中一个元素，然后使用两个指针在剩余元素中寻找两个数，使得它们的和等于该固定元素的相反数。

```python
def three_sum(nums):
    nums.sort()
    result = []

    for i in range(len(nums) - 2):
        # skip duplicate fixed elements
        if i > 0 and nums[i] == nums[i - 1]:
            continue

        left, right = i + 1, len(nums) - 1
        target = -nums[i]

        while left < right:
            total = nums[left] + nums[right]
            if total < target:
                left += 1
            elif total > target:
                right -= 1
            else:
                result.append([nums[i], nums[left], nums[right]])
                # skip duplicates
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1

    return result
```

- **为何这种方法有效**：排序操作的复杂度为$O(n \log n)$。对于每个固定元素，使用双指针法进行扫描的复杂度为$O(n)$。因此总复杂度为$O(n^2)$，这是解决该问题的最优复杂度（因为必须考虑所有元素对）。

- **需要注意的要点**：处理重复元素是最大的难点。如果没有用于跳过重复元素的逻辑——无论是对固定元素还是双指针扫描的结果而言——那么就会得到重复的三数组合。`if i > 0 and nums[i] == nums[i-1]: continue`这行代码非常重要。

### 困难级：截雨量计算

- **问题**：给定一个海拔图（由非负整数构成的数组），计算下雨后能够截留多少水量。

- **解题思路**：对于每个位置，其处的水位由该位置左侧的最大高度与右侧的最大高度中的较小值减去当前高度来确定。可以通过从两端向中间移动的双指针来动态获取这些最大高度值。

```python
def trap(height):
    left, right = 0, len(height) - 1
    left_max, right_max = 0, 0
    water = 0

    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                water += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                water += right_max - height[right]
            right -= 1

    return water
```

- **原理**：关键在于，如果 `height[left] < height[right]`，那么位置 `left` 处的水位上限就是 `left_max`（因为右侧有更高的柱子，所以右侧不可能是瓶颈）。我们先处理较矮的一侧，因为可以确定另一侧有更高的柱子。

- **常见错误**：很多人试图先预计算 `left_max[i]` 和 `right_max[i]` 这两个数组（虽然可行，但会占用 $O(n)$ 的空间）。而双指针方法仅需 $O(1)$ 的空间。此外，在更新最大值时若将 `>=` 与 `>` 搞混，会导致水位计算出现误差。

---

## 模式：滑动窗口

- **滑动窗口**模式通过维护一个窗口（连续的子数组），并在迭代过程中不断扩展或收缩该窗口。它适用于那些需要找出满足某种条件的子数组或子串的问题。

- **适用场景**：当问题要求找出满足特定约束的最长/最短子数组或子串，并且窗口的扩展/收缩过程是单调的时（即添加元素只会让约束更难或更容易满足，而不会同时出现两种情况）。

- **模板**：

```python
def sliding_window(arr):
    left = 0
    state = ...  # window state (counts, sum, etc.)
    best = ...

    for right in range(len(arr)):
        # expand: add arr[right] to the window state
        update_state(state, arr[right])

        # contract: shrink from the left while constraint is violated
        while constraint_violated(state):
            remove_from_state(state, arr[left])
            left += 1

        # update answer
        best = max(best, right - left + 1)  # or min, depending on problem

    return best
```

### 简单题：买卖股票的最佳时机

- **问题**：给定每天的股票价格，求通过一次买入和一次卖出所能获得的最大利润（买入必须在卖出之前）。

- **解题思路**：记录到目前为止出现的最低价格（即窗口的左边界），并计算每天的利润。

```python
def max_profit(prices):
    min_price = float('inf')
    max_profit = 0

    for price in prices:
        min_price = min(min_price, price)
        max_profit = max(max_profit, price - min_price)

    return max_profit
```

- 这是一种特殊形式的滑动窗口：只有当找到新的最小值时，左指针（即最小价格）才会向右移动。时间复杂度为$O(n)$，空间复杂度为$O(1)$。

### 中等难度：最长无重复字符子串

- **问题**：找出没有重复字符的最长子串的长度。

- **解决思路**：通过移动右指针来扩展子串范围；一旦发现重复字符，就从左边开始收缩子串，直到该重复字符被移除为止。

```python
def length_of_longest_substring(s):
    char_index = {}  # character -> its most recent index
    left = 0
    best = 0

    for right, char in enumerate(s):
        if char in char_index and char_index[char] >= left:
            left = char_index[char] + 1  # jump past the duplicate

        char_index[char] = right
        best = max(best, right - left + 1)

    return best
```

- **为何要使用 `char_index[char] >= left` 这一条件**：该字符可能早在当前窗口形成之前就已经存在于映射表中了。如果不进行此检查，对于那些实际上并不在当前窗口中的字符，也会错误地缩小窗口范围。

- **需要注意的陷阱**：虽然使用集合并逐个从左侧删除字符也是可行的方法，但效率较低；而哈希表的方法则可以直接定位到正确的位置。

### 困难级：最小窗口子串

- **问题**：给定字符串 `s` 和 `t`，找出 `s` 中包含 `t` 中所有字符的最小窗口。

- **解决思路**：先扩大窗口以包含所有必需的字符，然后再从左侧开始收缩窗口，从而找到最小的有效窗口。

```python
from collections import Counter

def min_window(s, t):
    if not t or not s:
        return ""

    need = Counter(t)       # characters we need and their counts
    have = 0                # how many unique characters we have in sufficient quantity
    required = len(need)    # how many unique characters we need

    left = 0
    best = (float('inf'), 0, 0)  # (length, left, right)

    window_counts = {}

    for right in range(len(s)):
        char = s[right]
        window_counts[char] = window_counts.get(char, 0) + 1

        # check if this character's count now meets the requirement
        if char in need and window_counts[char] == need[char]:
            have += 1

        # contract from the left while the window is valid
        while have == required:
            # update best
            if (right - left + 1) < best[0]:
                best = (right - left + 1, left, right)

            # remove leftmost character
            left_char = s[left]
            window_counts[left_char] -= 1
            if left_char in need and window_counts[left_char] < need[left_char]:
                have -= 1
            left += 1

    length, start, end = best
    return s[start:end + 1] if length != float('inf') else ""
```

- **常见陷阱**：`have`计数器是至关重要的优化手段。如果没有它，就必须在每一步中将整个`window_counts`字典与`need`进行比较，这样的操作时间复杂度为$O(|\text{唯一字符数}|)$。而`have`计数器使得有效性检查的时间复杂度降为$O(1)$。

- **常见陷阱**：应使用`window_counts[char] == need[char]`（而非`>=`）来确保每个字符只会被计数一次。如果使用`>=`，则会导致计数过多。

---

## 模式：前缀和

- **前缀和**数组用于存储累积和：`prefix[i] = sum(arr[0:i])`。一旦以$O(n)$的时间构建完成，就可以在$O(1)$的时间内计算出任意子数组的和：`sum(arr[l:r]) = prefix[r] - prefix[l]`。

```python
def build_prefix(arr):
    prefix = [0] * (len(arr) + 1)
    for i in range(len(arr)):
        prefix[i + 1] = prefix[i] + arr[i]
    return prefix

# sum of arr[l:r] (inclusive l, exclusive r)
def range_sum(prefix, l, r):
    return prefix[r] - prefix[l]
```

- **适用场景**：问题涉及多次子数组求和查询，或需要找出和为特定值的子数组。

### 简单题：区间求和查询

- **问题**：给定一个数组，回答多个“从索引$l$到$r$的区间和是多少？”的查询。

- 不使用前缀和时，每次查询的复杂度为$O(n)$；使用前缀和后，可先进行$O(n)$的时间预处理，之后每次查询的复杂度为$O(1)$。

### 中等题：子数组和等于K

- **问题**：统计和为$k$的连续子数组的数量。

- **解题思路**：从索引$l$到$r$的子数组之和等于`prefix[r+1] - prefix[l]`。要使该值等于$k$，则需满足`prefix[l] = prefix[r+1] - k`。对于每个位置，可以使用哈希表来统计有多少个之前的前缀和等于`current_prefix - k`。

```python
def subarray_sum(nums, k):
    count = 0
    prefix = 0
    prefix_counts = {0: 1}  # empty prefix sum

    for num in nums:
        prefix += num
        # how many earlier prefix sums equal prefix - k?
        count += prefix_counts.get(prefix - k, 0)
        prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1

    return count
```

- 这种方法结合了前缀和与哈希表查询：时间复杂度为$O(n)$，空间复杂度也为$O(n)$。

- **常见错误**：忘记初始化`prefix_counts = {0: 1}`。在数组开头的位置，其前缀和应为0。如果不做这个初始化，就无法处理从索引0开始的子数组。

### 困难题：数组中除自身外所有元素的乘积

- **问题**：给定一个数组，返回另一个数组，其中每个元素表示原数组中其余所有元素的乘积。不允许使用除法。

- **解法思路**：从左到右计算前缀乘积，从右到左计算后缀乘积，然后每个位置的答案即为前缀乘积与后缀乘积的乘积。

```python
def product_except_self(nums):
    n = len(nums)
    result = [1] * n

    # left pass: result[i] = product of nums[0..i-1]
    prefix = 1
    for i in range(n):
        result[i] = prefix
        prefix *= nums[i]

    # right pass: multiply by product of nums[i+1..n-1]
    suffix = 1
    for i in range(n - 1, -1, -1):
        result[i] *= suffix
        suffix *= nums[i]

    return result
```

- 时间复杂度为$O(n)$，额外空间复杂度为$O(1)$（输出数组不计入在内）。该方法利用输出数组本身来存储中间前缀乘积，然后在第二遍中计算后缀乘积并相乘。

- **注意事项**：如果数组中包含零，则基于除法的方法将无法正常工作。而这种前缀/后缀方法可以正确处理零值，因为它不会进行除法运算。

---

## 常见问题总结

| 问题类型 | 示例 | 解决方法 |
| --------- || --------- || ---------- ||
| 窗口大小计算错误 | 使用`right - left`而非`right - left + 1` | 通过两元素示例来说明问题 |
| Python中默认参数可变 | `def f(seen={})`会导致多次调用之间共享状态 | 使用`def f(seen=None)` |
| 循环中的字符串拼接 | 在Python中`s += c`的复杂度为$O(n^2)$ | 使用`list.append`再加`"".join()` |
| 忘记初始化前缀和中的`{0: 1}` | 会导致从索引0开始的子数组被忽略 | 始终用空前缀和进行初始化 |
| 在检查之前就使用哈希表 | “两数之和”问题中，在检查补数之前就加入了当前数字 | 先进行检查，然后再将数字插入哈希表 |
| 未处理重复元素 | “三数之和”问题会返回重复的解 | 跳过连续的相同数值 |
| 整数溢出 | 在C++/Java中计算大型数组的和时可能发生溢出 | 使用`long`类型或检查数值范围 |

---

## 练习题（NeetCode）

请按顺序练习这些题目。每道题都会帮助你巩固本文档中介绍的各种解题思路。

### 哈希表查询

- [是否存在重复元素](https://neetcode.io/problems/contains-duplicate) —— 热身题：使用哈希集记录已出现过的元素
- [两数之和](https://neetcode.io/problems/two-sum) —— 查找补数
- [将变位词分组](https://neetcode.io/problems/anagram-groups) —— 以标准形式作为键
- [列表中出现频率最高的K个元素](https://neetcode.io/problems/top-k-elements-in-list) —— 哈希表+桶排序
- [最长的连续序列](https://neetcode.io/problems/longest-consecutive-sequence) —— 使用哈希集并利用序列起始点的技巧
- [字符串的编码与解码](https://neetcode.io/problems/string-encode-and-decode) —— 设计一种序列化方案

### 双指针法

- [判断是否为回文串](https://neetcode.io/problems/is-palindrome) —— 使用向内移动的指针
- [两数之和II（已排序数组）](https://neetcode.io/problems/two-integer-sum-ii) —— 在已排序数组上使用双指针
- [三数之和](https://neetcode.io/problems/three-integer-sum) —— 先修正数值 + 双指针法 + 去重
- [能装最多水的容器](https://neetcode.io/problems/max-water-container) —— 贪心双指针法
- [截获雨水](https://neetcode.io/problems/trapping-rain-water) —— 使用双指针并维护最大值

### 滑动窗口法

- [买卖股票的最佳时机](https://neetcode.io/problems/buy-and-sell-crypto) —— 特殊情况的滑动窗口
- [不含重复字符的最长子串](https://neetcode.io/problems/longest-substring-without-duplicates) —— 使用哈希表来扩展/收缩窗口
- [需要替换字符的最长重复子串](https://neetcode.io/problems/longest-repeating-substring-with-replacement) —— 滑动窗口+最大出现频率技巧
- [包含特定字符的最小长度子串](https://neetcode.io/problems/minimum-window-with-characters) —— 不断扩展窗口直到满足条件，再收缩以得到最小长度

### 前缀和

- [数组中所有元素的乘积（不包括自身）](https://neetcode.io/problems/products-of-array-discluding-self) —— 前缀/后缀乘积法

## 链表、栈和队列

_链表、栈和队列是更复杂数据结构的基石。本文先介绍它们的基本原理，然后通过难度逐步增加的问题来讲解关键模式：快慢指针、单调栈以及基于堆的优先队列，同时指出每一步中常见的陷阱。_

- 数组能提供快速的随机访问，但插入操作代价高昂。**链表**则能实现快速插入，但不支持随机访问。**栈**和**队列**限制了对一端或两端的访问，正是这种限制赋予了它们强大的功能：通过限制可进行的操作，它们简化了需要思考的问题。

## 链表

- **单链表**是由节点构成的链条。每个节点存储一个值以及一个指向下一个节点的指针。最后一个节点指向`null`。

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
```

- **相较于数组的优势**：在已知位置插入或删除元素的时间复杂度为$O(1)$（只需重新调整指针即可），无需移动其他元素。

- **缺点**：访问第$i$个元素需要遍历$O(i)$个节点（无法随机访问）；缓存局部性较差（节点分散在内存中）。

- **双向链表**增加了`prev`指针，支持反向遍历。它常用于LRU缓存（可在常数时间内删除任意节点）以及浏览器历史记录（实现后退/前进功能）。

| 操作 | 单向链表 | 双向链表 |
| ----------- || -------- || -------- ||
| 按索引访问 | $O(n)$ | $O(n)$ |
| 在头部插入 | $O(1)$ | $O(1)$ |
| 在尾部插入 | $O(n)$ 或 $O(1)$* | $O(1)$ |
| 删除指定节点 | $O(n)$** | $O(1)$ |
| 查找 | $O(n)$ | $O(n)$ |

*前提是存在尾指针。**需要找到前驱节点，因此需进行遍历。

- **哨兵节点**（虚拟头/尾节点）可简化边界情况的处理。没有虚拟头节点时，在头部插入或删除头部节点需要特殊的代码逻辑；有了哨兵节点后，每个真实节点都有前驱节点。

```python
# Without dummy: special case for head deletion
def delete_head(head):
    if not head:
        return None
    return head.next

# With dummy: uniform logic
dummy = ListNode(0)
dummy.next = head
# now every deletion is: prev.next = prev.next.next
```

- **陷阱**：忘记处理空链表（`head为None`）或单元素链表的情况。务必测试这些边界情况。

---

## 模式：快慢指针（弗洛伊德算法）

- 使用两个以不同速度移动的指针来检测链表的特性。**慢**指针每次移动一步；**快**指针每次移动两步。

### 简单题：链表中的环

- **问题**：判断一个链表是否存在环。

- **模式**：如果存在环，快指针最终会追上慢指针（两者相遇）。如果不存在环，快指针会到达`null`。

```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False
```

- **原理**：如果循环的长度为$c$，则快指针每步能缩短1个节点的差距。它们必定会在慢指针进入循环后的$c$步内相遇。

- **陷阱**：要检查`fast and fast.next`（而不仅仅是`fast.next`）。如果`fast`为`None`，调用`fast.next`会导致程序崩溃。

### 中等难度：查找链表的中间节点

- **问题**：返回链表的中间节点。

- **规律**：当快指针到达链表末尾时，慢指针正好位于中间。

```python
def find_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow  # slow is at the middle (or second middle if even length)
```

### 中等难度：链表中的环 II（寻找环的起始节点）

- **问题**：返回环开始的节点。

- **解法**：当快慢指针相遇后，将其中一个指针重置为头节点。然后让两个指针以相同速度移动，它们会在环的起始处相遇。

```python
def detect_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            # reset one pointer to head
            slow = head
            while slow != fast:
                slow = slow.next
                fast = fast.next
            return slow
    return None
```

- **原理说明**：设从链表头到环起点的距离为$a$，从环起点到相遇点的距离为$b$。慢指针移动了$a + b$步，快指针则移动了$2(a + b)$步。两者之差正好是一个完整的环长：$a + b = c$（环的长度）。因此$a = c - b$：从链表头到环起点的距离等于从相遇点沿环向前到环起点的距离。

### 难题：将链表按K个节点一组反转

- **问题描述**：将链表中每$k$个连续节点进行反转。

```python
def reverse_k_group(head, k):
    # check if we have k nodes left
    node = head
    for _ in range(k):
        if not node:
            return head
        node = node.next

    # reverse k nodes
    prev, curr = None, head
    for _ in range(k):
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt

    # head is now the tail of the reversed group
    # recursively process the rest
    head.next = reverse_k_group(curr, k)
    return prev  # prev is the new head of this group
```

- **常见陷阱**：原地反转模式（`prev, curr, nxt`）值得牢记。画出来看看：每一步中，将 `curr.next` 指向 `prev`，然后移动这三个指针。顺序出错会导致链表损坏。

---

## 栈

- **栈**是一种后进先出（LIFO）的数据结构：最后加入的元素会最先被移除。可以想象成一叠盘子。

- 操作：`push(x)` 将元素添加到栈顶，`pop()` 从栈顶移除元素，`peek()` 查看栈顶元素但不移除。所有操作的时间复杂度均为 $O(1)$。

- 栈是**递归**（调用栈）、**表达式求值**（将中缀表达式转换为后缀表达式）以及**撤销操作**（每个操作被压入栈中，撤销时弹出最后一个操作）背后的隐式数据结构。

### 简单题：有效的括号

- **问题描述**：给定一个由括号 `()[]{}` 组成的字符串，判断这些括号是否匹配。

- **解题模式**：将左括号压入栈中。遇到右括号时，检查栈顶是否为对应的左括号。

```python
def is_valid(s):
    stack = []
    matching = {')': '(', ']': '[', '}': '{'}

    for char in s:
        if char in matching:
            if not stack or stack[-1] != matching[char]:
                return False
            stack.pop()
        else:
            stack.append(char)

    return len(stack) == 0
```

- **常见错误**：忘记在最后检查 `len(stack) == 0`。字符串“(((“没有不匹配的情况，但由于存在未闭合的括号，它并不合法。

---

## 模式：单调栈

- **单调栈**会保持元素按有序排列（递增或递减）。当新元素违反该顺序时，就弹出元素直至顺序恢复。

- **适用场景**：题目要求“对每个元素，找到下一个/前一个更大/更小的元素”。由于每个元素最多被压入和弹出一次，因此时间复杂度为 $O(n)$。

### 中等难度：每日温度

- **问题描述**：给定每日气温，对每一天计算需要等待多少天才能遇到更高温度。

- **解题模式**：使用索引栈。当当前气温高于栈顶索引对应的气温时，弹出该索引并记录天数差。

```python
def daily_temperatures(temperatures):
    n = len(temperatures)
    result = [0] * n
    stack = []  # stack of indices, temperatures in decreasing order

    for i in range(n):
        while stack and temperatures[i] > temperatures[stack[-1]]:
            prev = stack.pop()
            result[prev] = i - prev
        stack.append(i)

    return result
```

- 每个元素被压入一次，最多弹出一次：总时间为$O(n)$。

- **陷阱**：在栈中存储索引而非值。你需要利用索引来计算距离。

### 难题：直方图中的最大矩形

- **问题**：给定一个柱状图的高度数组，求其中最大矩形的面积。

- **模式**：对于每一根柱子，找出它能向左和向右延伸的距离（即两侧最近的较矮柱子）。使用单调递增栈可以高效地实现这一点。

```python
def largest_rectangle(heights):
    stack = []  # stack of indices, heights in increasing order
    max_area = 0
    heights.append(0)  # sentinel to flush the stack at the end

    for i, h in enumerate(heights):
        start = i
        while stack and stack[-1][1] > h:
            idx, height = stack.pop()
            max_area = max(max_area, height * (i - idx))
            start = idx  # this bar can extend back to where the popped bar started
        stack.append((start, h))

    heights.pop()  # remove sentinel
    return max_area
```

- **陷阱**：`start = idx` 这一行很微妙。当我们弹出一个比当前柱子更高的柱子时，当前柱子可能会向后延伸至被弹出柱子的起始位置（因为两者之间的所有柱子高度都至少等于被弹出柱子）。遗漏这一行会导致计算出的面积不正确。

- **陷阱**：哨兵值 `heights.append(0)` 的作用是确保栈中剩余的柱子都能被处理。如果没有它，那些右侧没有遇到更矮柱子的柱子就会被忽略。

---

## 队列

- **队列**遵循 FIFO（先进先出）原则：元素从队尾加入，从队首移除。可以想象成商店里的排队现象。

- **双端队列**支持在两端进行 $O(1)$ 时间复杂度的插入和删除操作。Python 中的 `collections.deque` 就是标准的实现方式。

- 队列是 **BFS**（广度优先搜索，第14章文件4）、**任务调度**以及**消息传递**背后的数据结构。

### 简单题：用栈实现队列

- **问题**：仅使用两个栈来实现一个队列。

- **模式**：用一个栈用于入队，另一个用于出队。当出队栈为空时，将入队栈中的所有元素转移过去（从而反转顺序）。

```python
class MyQueue:
    def __init__(self):
        self.push_stack = []
        self.pop_stack = []

    def push(self, x):
        self.push_stack.append(x)

    def pop(self):
        if not self.pop_stack:
            while self.push_stack:
                self.pop_stack.append(self.push_stack.pop())
        return self.pop_stack.pop()

    def peek(self):
        if not self.pop_stack:
            while self.push_stack:
                self.pop_stack.append(self.push_stack.pop())
        return self.pop_stack[-1]

    def empty(self):
        return not self.push_stack and not self.pop_stack
```

- 每次操作的平均时间复杂度为$O(1)$：每个元素最多只在栈之间移动一次。

---

## 优先队列与堆

- **优先队列**会优先返回最小（或最大）的元素，而不考虑插入顺序。其标准实现是**二叉堆**。

- **最小堆**是一种完全二叉树，其中每个父节点的值都小于其子节点。最小值始终位于根节点。它以数组形式存储：节点$i$的子节点位于位置$2i + 1$和$2i + 2$。

| 操作 | 时间复杂度 |
| ----------- || ------------ ||
| 插入 | $O(\log n)$ |
| 获取最小值 | $O(1)$ |
| 取出最小值 | $O(\log n)$ |
| 从数组构建堆 | $O(n)$ |

- Python的`heapq`模块提供了最小堆功能。若需使用最大堆，只需将数值取反即可。

```python
import heapq

# Min-heap
h = []
heapq.heappush(h, 5)
heapq.heappush(h, 2)
heapq.heappush(h, 8)
print(heapq.heappop(h))  # 2 (smallest)

# Max-heap trick: negate values
heapq.heappush(h, -10)
print(-heapq.heappop(h))  # 10 (largest)
```

### 中等难度：数组中的第K大元素

- **问题**：找出第k大的元素。

- **解法**：维护一个大小为$k$的最小堆。堆的根节点即为第k大的元素。当堆中已有$k$个元素且新元素大于根节点时，则替换根节点。

```python
import heapq

def find_kth_largest(nums, k):
    heap = nums[:k]
    heapq.heapify(heap)  # O(k)

    for num in nums[k:]:
        if num > heap[0]:
            heapq.heapreplace(heap, num)  # pop min, push num: O(log k)

    return heap[0]
```

- 时间复杂度为$O(n \log k)$，空间复杂度为$O(k)$。当$k \ll n$时，其效率远优于排序算法（$O(n \log n)$）。

- **注意事项**：使用大小为$n$的最大堆并弹出$k$次也能实现相同功能，但速度更慢：时间复杂度为$O(n + k \log n)$。大小为$k$的最小堆才是最优解法。

### 难题：合并K个有序链表

- **问题描述**：将$k$个有序链表合并成一个有序链表。

- **解决思路**：使用一个包含每个链表头节点的最小堆。取出最小的节点，将其加入结果列表，再将其下一个节点推入堆中。

```python
import heapq

def merge_k_lists(lists):
    heap = []
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst.val, i, lst))

    dummy = ListNode(0)
    curr = dummy

    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))

    return dummy.next
```

- 时间复杂度为$O(n \log k)$，其中$n$为节点总数。堆中最多只包含$k$个元素。

- **易错点**：堆元组中的索引`i`用于解决键值相等时的排序问题。如果没有这个索引，当节点值相等时，Python会尝试比较`ListNode`对象，但由于`ListNode`不支持`<`运算，程序会崩溃。该索引确保了比较操作的有效性。

---

## 常见易错点总结

| 易错点 | 示例 | 解决方法 |
| --------- || --------- || ----- ||
| `fast.next`为空指针 | 使用`while fast.next`检测环 | 改为检查`fast and fast.next` |
| 未处理空列表情况 | 对空链表进行反转 | 添加`if not head`判断 |
| 栈下溢 | 从空栈中弹出元素 | 检查`len(stack) > 0`或`if stack` |
| 忘记设置哨兵节点 | 直方图计算时遗漏最后一段 | 追加0以清空栈中剩余元素 |
| 堆中缺少排序依据 | 比较无法比较的对象 | 在堆元组中加入索引 |
| 遍历过程中修改列表 | 遍历时删除节点 | 采用前驱/当前节点模式或引入虚拟头节点 |

---

## 课后练习（NeetCode）

### 链表（续1）

- [反转链表](https://neetcode.io/problems/reverse-a-linked-list) —— 基本的原地反转操作
- [合并两个有序链表](https://neetcode.io/problems/merge-two-sorted-linked-lists) —— 双指针合并算法
- [链表中的环](https://neetcode.io/problems/linked-list-cycle-detection) —— 快慢指针法检测环
- [重新排序链表](https://neetcode.io/problems/reorder-linked-list) —— 找到中点、反转后半部分并合并
- [删除链表中倒数第N个节点](https://neetcode.io/problems/remove-node-from-end-of-linked-list) —— 利用间距为$n$的双指针技术
- [LRU缓存](https://neetcode.io/problems/lru-cache) —— 哈希表与双向链表的结合应用

### 栈（续1）

- [有效的括号](https://neetcode.io/problems/validate-parentheses) —— 括号匹配问题
- [最小栈](https://neetcode.io/problems/minimum-stack) —— 实时记录栈中的最小值
- [逆波兰表达式求值](https://neetcode.io/problems/evaluate-reverse-polish-notation) —— 基于栈的运算求值
- [每日温度](https://neetcode.io/problems/daily-temperatures) —— 使用单调递减栈求解
- [直方图中最大的矩形](https://neetcode.io/problems/largest-rectangle-in-histogram) —— 利用单调递增栈求解
- [汽车队列](https://neetcode.io/problems/car-fleet) —— 结合到达时间的栈处理

### 堆/优先队列

- [流中第K大的元素](https://neetcode.io/problems/kth-largest-integer-in-a-stream) —— 大小为$k$的最小堆
- [最后一块石头的重量](https://neetcode.io/problems/last-stone-weight) —— 通过最大堆模拟运算
- [距离原点最近的K个点](https://neetcode.io/problems/k-closest-points-to-origin) —— 按距离排序的最小堆
- [任务调度器](https://neetcode.io/problems/task-scheduler) —— 结合冷却时间的贪心算法与最大堆
- [从数据流中查找中位数](https://neetcode.io/problems/find-median-in-a-data-stream) —— 使用两个堆：最大堆存下半部分，最小堆存上半部分

## 树

_树是文件系统、数据库、编译器以及无数面试题背后的层次化数据结构。本文涵盖了二叉树、二叉搜索树、平衡树、字典树、线段树、树状数组以及并查集，同时介绍了遍历模式、递归思维以及难度逐步增加的问题。_

- **树**是一种连通且无环的图（第13章）。其中最重要的变体是**二叉树**：每个节点最多有两个子节点（左子节点和右子节点）。树无处不在：编译器中的语法树、浏览器中的DOM树、机器学习中的决策树，以及数据库中的B树。

- 解决树类问题的关键思路：**大多数树类问题都可以通过递归来解决**。树的结构本身是递归的（一棵树由一个根节点及其两棵子树构成），因此解决方案也应当是递归的。掌握“先解决左子树，再解决右子树，最后合并结果”的模式，就能解决大部分树类问题。

## 二叉树遍历

- 有四种标准方式来访问每个节点：

- **中序遍历**（左子树 → 根节点 → 右子树）：对于二叉搜索树而言，该遍历方式能按排序顺序访问节点。
- **前序遍历**（根节点 → 左子树 → 右子树）：适用于树的序列化与复制。
- **后序遍历**（左子树 → 右子树 → 根节点）：适用于删除节点以及计算节点数量。
- **层序遍历**（广度优先搜索）：利用队列逐层访问节点。

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder(root):
    if not root:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)

def preorder(root):
    if not root:
        return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def postorder(root):
    if not root:
        return []
    return postorder(root.left) + postorder(root.right) + [root.val]

from collections import deque

def level_order(root):
    if not root:
        return []
    result, queue = [], deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result
```

- **陷阱**：上述递归遍历在每一步都会创建新列表（由于使用了`+`进行拼接），其时间复杂度为$O(n^2)$。为提高效率，应传入一个结果列表并在其中就地追加元素：

```python
def inorder_efficient(root, result=None):
    if result is None:
        result = []
    if root:
        inorder_efficient(root.left, result)
        result.append(root.val)
        inorder_efficient(root.right, result)
    return result
```

### 简单：二叉树的最大深度

```python
def max_depth(root):
    if not root:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
```

- **递归模式**：基准情况（空节点 → 0），对子节点进行递归，合并结果（1 + 最大值）。同样的模式适用于数十种树相关问题。

### 简单：翻转二叉树

```python
def invert_tree(root):
    if not root:
        return None
    root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root
```

### 中等难度：最近公共祖先

- **问题**：找到同时是节点$p$和$q$的祖先的最低节点。

- **规律**：如果$p$和$q$都在左子树中，那么最近公共祖先也在左子树中；如果它们都在右子树中，则最近公共祖先在右子树中；如果它们分别位于左右子树中，那么当前节点就是最近公共祖先。

```python
def lowest_common_ancestor(root, p, q):
    if not root or root == p or root == q:
        return root

    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)

    if left and right:
        return root  # p and q are in different subtrees
    return left if left else right
```

- **陷阱**：此解法假设树中存在节点$p$和$q$。如果它们可能不存在，则需要额外的检查。

### 难题：二叉树最大路径和

- **问题描述**：找出任意两个节点之间的最大路径和（该路径无需经过根节点）。

```python
def max_path_sum(root):
    best = [float('-inf')]

    def dfs(node):
        if not node:
            return 0
        left = max(dfs(node.left), 0)   # ignore negative paths
        right = max(dfs(node.right), 0)

        # path through this node (possibly as the "bend")
        best[0] = max(best[0], node.val + left + right)

        # return the max gain this node can contribute to its parent
        return node.val + max(left, right)

    dfs(root)
    return best[0]
```

- **关键要点**：在每个节点处有两个问题：(1) 经过该节点的最佳路径是什么（左子树 + 节点 + 右子树）？(2) 该节点能为其父节点贡献的最佳路径是什么（节点 + max(左子树, 右子树)，因为一条路径不能在两个层级上分叉）？混淆这两者是最常见的错误。

## 二叉搜索树（BST）

- **二叉搜索树**满足：对于每个节点，其左子树中的所有值都小于该节点的值，右子树中的所有值都大于该节点的值。这使得在树平衡时，查找、插入和删除操作的时间复杂度为 $O(\log n)$。

```python
def search_bst(root, target):
    if not root:
        return None
    if target < root.val:
        return search_bst(root.left, target)
    elif target > root.val:
        return search_bst(root.right, target)
    else:
        return root

def insert_bst(root, val):
    if not root:
        return TreeNode(val)
    if val < root.val:
        root.left = insert_bst(root.left, val)
    else:
        root.right = insert_bst(root.right, val)
    return root
```

- **陷阱**：只有当树是平衡的时，二叉搜索树的操作才具有$O(\log n)$的时间复杂度。若通过有序数据插入构建的二叉搜索树会退化为链表：此时每次操作的时间复杂度为$O(n)$。这正是平衡二叉搜索树（AVL树、红黑树）存在的原因。

### 中等难度：验证二叉搜索树

```python
def is_valid_bst(root, lo=float('-inf'), hi=float('inf')):
    if not root:
        return True
    if root.val <= lo or root.val >= hi:
        return False
    return (is_valid_bst(root.left, lo, root.val) and
            is_valid_bst(root.right, root.val, hi))
```

- **陷阱**：仅检查 `left.val < root.val < right.val` 是错误的。约束条件是左子树中的_所有_节点值都更小，而不仅仅是直接子节点。`lo`/`hi` 边界会将这一约束向下传递。

### 中等难度：二叉搜索树中的第 K 小元素

- **模式**：对二叉搜索树进行中序遍历时，节点会按排序顺序被访问。第 $k$ 个被访问的节点即为答案。

```python
def kth_smallest(root, k):
    count = [0]
    result = [None]

    def inorder(node):
        if not node or result[0] is not None:
            return
        inorder(node.left)
        count[0] += 1
        if count[0] == k:
            result[0] = node.val
            return
        inorder(node.right)

    inorder(root)
    return result[0]
```

## 字典树（前缀树）

- **字典树**以树形结构逐个字符地存储字符串。每条边代表一个字符，从根节点到标记节点的路径则对应已存储的字符串。无论存储了多少个字符串，字典树都能实现 $O(L)$ 的查找时间复杂度，其中 $L$ 为字符串长度。

```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_end = True

    def search(self, word):
        node = self.root
        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]
        return node.is_end

    def starts_with(self, prefix):
        node = self.root
        for char in prefix:
            if char not in node.children:
                return False
            node = node.children[char]
        return True
```

- **适用场景**：自动补全、拼写检查、文字游戏、IP路由表。凡是需要基于前缀进行操作的情况均可使用。

### 难题：单词搜索 II

- **问题描述**：给定一个字符矩阵以及一组单词，找出所有能通过遍历相邻单元格形成的单词。

- **解决思路**：从单词列表中构建一棵字典树，然后从每个单元格出发进行深度优先搜索，利用字典树提前剪枝（如果当前前缀没有对应的单词，则停止搜索）。

- **常见误区**：如果不使用字典树，就需要对每个单词分别进行深度优先搜索，时间复杂度为 $O(w \cdot m \cdot n \cdot 4^L)$。而字典树可以共享单词间的前缀计算结果，从而大幅减少计算量。

## 并查集（Disjoint Set Union）

- **并查集**用于维护一组不相交的集合。它包含两个操作：`find(x)`返回元素$x$所在集合的代表元，`union(x, y)`则合并包含$x$和$y$的两个集合。

```python
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.count = n  # number of connected components

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False  # already connected
        # union by rank
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        self.count -= 1
        return True
```

- 通过路径压缩和按秩合并，两种操作的平均时间复杂度均为 $O(\alpha(n)) \approx O(1)$（逆阿克曼函数，实际上可视为常数）。

- **适用场景**：连通分量、无向图中的环检测、Kruskal最小生成树算法、对等价项进行分组。

### 中等难度：连通分量的数量

```python
def count_components(n, edges):
    uf = UnionFind(n)
    for u, v in edges:
        uf.union(u, v)
    return uf.count
```

### 中等难度：冗余连接

- **问题**：找出那条删除后能使图变为树的边（即导致环形成的边）。

- **模式**：逐个处理边。当某条边的两个端点已经属于同一连通分量时，该边就会形成环。

```python
def find_redundant(edges):
    uf = UnionFind(len(edges) + 1)
    for u, v in edges:
        if not uf.union(u, v):
            return [u, v]  # already connected → this edge creates a cycle
```

## 线段树与树状数组

- **线段树**可以回答区间查询（如子数组的和、最小值、最大值），并支持点更新操作，时间复杂度均为$O(\log n)$。

- **树状数组**（二叉索引树）是前缀和查询与点更新的更简单且更快的替代方案。它利用巧妙的位运算技巧：每个位置存储的部分和所覆盖的区间由该位置的最低有效位决定。

```python
class FenwickTree:
    def __init__(self, n):
        self.n = n
        self.tree = [0] * (n + 1)

    def update(self, i, delta):
        i += 1  # 1-indexed
        while i <= self.n:
            self.tree[i] += delta
            i += i & (-i)  # add lowest set bit

    def prefix_sum(self, i):
        i += 1
        total = 0
        while i > 0:
            total += self.tree[i]
            i -= i & (-i)  # remove lowest set bit
        return total

    def range_sum(self, l, r):
        return self.prefix_sum(r) - (self.prefix_sum(l - 1) if l > 0 else 0)
```

- **适用场景**：需要频繁进行带更新的区间查询的问题。如果只需前缀和，优先使用树状数组；如果需要对任意区间进行操作（如求最小值、最大值或最大公约数），则使用线段树。

---

## 常见陷阱总结

| 陷阱 | 示例 | 解决方法 |
| ------ || ------ || ---------- ||
| 判断二叉搜索树时仅检查直接子节点 | `left.val < root.val` 无法发现更深层的违规情况 | 传入 `lo`/`hi` 边界值进行判断 |
| 递归中采用 $O(n^2)$ 的列表拼接方式 | `inorder(left) + [val] + inorder(right)` | 将结果追加到共享列表中 |
| 忘记设置递归终止条件 | 空树导致无限递归 | 添加 `if not root: return` |
| 混淆经过某节点的路径与到父节点的路径 | 最大路径和问题中在两层出现分叉 | 向父节点返回单分支结果，同时单独记录双分支信息 |
| 树状数组的1索引与0索引混淆 | 数组下标偏移错误 | 在入口处始终执行 `i += 1` |
| 并查集未采用路径压缩优化 | 最坏情况下每次查找耗时 $O(n)$ | 使用 `self.parent[x] = self.find(self.parent[x])` 进行优化 |

---

## 课后练习题目（NeetCode）

### 二叉树模式

- [翻转二叉树](https://neetcode.io/problems/invert-a-binary-tree) —— 基础递归
- [二叉树的最大深度](https://neetcode.io/problems/depth-of-binary-tree) —— 递归计算深度
- [判断两棵二叉树是否相同](https://neetcode.io/problems/same-binary-tree) —— 同步遍历比较
- [判断一棵二叉树是否为另一棵树的子树](https://neetcode.io/problems/subtree-of-a-binary-tree) —— 嵌套递归
- [二叉树的层序遍历](https://neetcode.io/problems/level-order-traversal-of-binary-tree) —— 利用BFS并按层级处理
- [二叉树中的最大路径和](https://neetcode.io/problems/binary-tree-maximum-path-sum) —— 通过DFS维护全局最优解
- [二叉树的序列化与反序列化](https://neetcode.io/problems/serialize-and-deserialize-binary-tree) —— 先序遍历并标记空节点

### 二叉搜索树模式

- [验证二叉搜索树](https://neetcode.io/problems/valid-binary-search-tree) —— 利用边界值传播进行判断
- [二叉搜索树中的第 K 小元素](https://neetcode.io/problems/kth-smallest-integer-in-bst) —— 中序遍历
- [二叉搜索树的最近公共祖先](https://neetcode.io/problems/lowest-common-ancestor-in-binary-search-tree) —— 利用二叉搜索树的排序特性

### 字典树

- [实现字典树](https://neetcode.io/problems/implement-prefix-tree) —— 基本的字典树操作
- [设计单词搜索数据结构](https://neetcode.io/problems/design-word-search-data-structure) —— 字典树结合带通配符的DFS
- [单词搜索 II](https://neetcode.io/problems/search-for-word-ii) —— 借助字典树进行回溯搜索

### 并查集

- [统计连通分量个数](https://neetcode.io/problems/count-connected-components) —— 基础的并查集应用
- [冗余连接](https://neetcode.io/problems/redundant-connection) —— 利用并查集检测环

## 图

_图用于建模各种关系与连接，从社交网络到道路地图，再到依赖链。本文涵盖了图的表示方法、广度优先搜索、深度优先搜索、最短路径、拓扑排序以及连通分量，同时介绍了在图相关面试题目中常见的遍历与路径查找模式。_

- 我们在第12章（邻接矩阵、拉普拉斯矩阵、谱性质）和第13章（树、平面性、着色）中介绍了图论知识。此处我们重点讨论**算法模式**：如何在代码中对图进行遍历、搜索和优化。

- 两种最基本的图算法是**广度优先搜索**和**深度优先搜索**。几乎所有的图问题都可以归结为这两种算法，或许会稍作修改。掌握它们，就能解决绝大多数图问题。

## 图的表示方法

- **邻接表**：为每个节点存储其邻居节点的列表。空间复杂度：$O(|V| + |E|)$。最适合稀疏图（大多数现实世界的图都属于此类）。

```python
# Undirected graph
graph = {
    0: [1, 2],
    1: [0, 3],
    2: [0, 3],
    3: [1, 2]
}

# From edge list
def build_graph(n, edges):
    graph = {i: [] for i in range(n)}
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)  # omit for directed
    return graph
```

- **邻接矩阵**：一个 $n \times n$ 的矩阵，若边 $(i, j)$ 存在，则 $A[i][j] = 1$。空间复杂度：$O(|V|^2)$。适用于稠密图或需要 $O(1)$ 时间复杂度来查询边是否存在的情况。

- **何时使用哪种结构**：几乎所有情况下都使用邻接表。只有当图非常稠密（$|E| \approx |V|^2$）或需要常数时间判断边是否存在时，才使用邻接矩阵。

## 模式：广度优先搜索（BFS）

- BFS利用队列按**层级**依次遍历节点。它是以下问题的首选算法：
- **无权图**中的最短路径
- 层次遍历
- 查找连通分量
- 任何要求计算“最少步数”的问题

```python
from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])

    while queue:
        node = queue.popleft()
        for neighbour in graph[node]:
            if neighbour not in visited:
                visited.add(neighbour)
                queue.append(neighbour)
```

- **关键点**：在**入队时**将节点加入`visited`，而非出队时。如果在出队时才标记为已访问，同一个节点可能会从不同前驱节点处被多次入队，从而浪费时间并可能导致错误结果。

### 简单题：岛屿数量

- **问题描述**：给定一个由‘1’（陆地）和‘0’（水域）组成的二维网格，统计岛屿的数量。

- **解题模式**：遍历网格。当发现一个‘1’时，使用BFS/DFS将所有相连的陆地单元格标记为已访问。每次启动BFS即对应一个岛屿。

```python
from collections import deque

def num_islands(grid):
    if not grid:
        return 0

    rows, cols = len(grid), len(grid[0])
    count = 0

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                # BFS to mark entire island
                queue = deque([(r, c)])
                grid[r][c] = '0'  # mark visited
                while queue:
                    cr, cc = queue.popleft()
                    for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)]:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == '1':
                            grid[nr][nc] = '0'
                            queue.append((nr, nc))

    return count
```

- **易错点**：在几乎所有网格问题中，都会用到表示4连通邻居的 `directions = [(0,1),(0,-1),(1,0),(-1,0)]` 模式。请记住它。对于8连通情况，只需加上对角线方向即可。

- **易错点**：直接修改输入网格（`grid[r][c] = '0'`）可以省去单独的 `visited` 集合。这种做法在面试中是可以接受的，但需明确说明其代价（即会修改输入数据）。

### 中等难度：腐烂的橘子

- **问题描述**：如果新鲜橘子与腐烂的橘子相邻，它就会腐烂。求所有橘子全部腐烂所需的最短时间；若无法全部腐烂，则返回 -1。

- **解题模式**：多源广度优先搜索。将初始状态下所有腐烂的橘子同时加入队列。每个BFS层级对应一个时间步。

```python
from collections import deque

def oranges_rotting(grid):
    rows, cols = len(grid), len(grid[0])
    queue = deque()
    fresh = 0

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1

    if fresh == 0:
        return 0

    time = 0
    while queue and fresh > 0:
        time += 1
        for _ in range(len(queue)):
            cr, cc = queue.popleft()
            for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)]:
                nr, nc = cr + dr, cc + dc
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    queue.append((nr, nc))

    return time if fresh == 0 else -1
```

- **关键见解**：多源广度优先搜索会同时处理所有源节点。这样就能得到从_任意_源节点出发的最短距离，而这正是“最后一个新鲜橙子腐烂所需的时间”。

## 模式：深度优先搜索

- 深度优先搜索在回溯之前会尽可能深入地探索。它使用栈结构（显式的栈或通过递归调用的调用栈）。深度优先搜索适用于以下场景：
- 环检测
- 拓扑排序
- 连通分量
- 回溯/穷举搜索
- 带约束条件的路径查找

```python
def dfs(graph, node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for neighbour in graph[node]:
        if neighbour not in visited:
            dfs(graph, neighbour, visited)
```

### 中等难度：课程安排（环检测）

- **问题**：给定$n$门课程及其先修要求，判断是否能完成所有课程（即不存在循环依赖）。

- **模式**：在有向图中检测环。使用带有三种状态的深度优先搜索：未访问、正在访问（处于当前DFS路径上）、已访问。

```python
def can_finish(num_courses, prerequisites):
    graph = {i: [] for i in range(num_courses)}
    for course, prereq in prerequisites:
        graph[course].append(prereq)

    # 0 = unvisited, 1 = in-progress, 2 = completed
    state = [0] * num_courses

    def has_cycle(node):
        if state[node] == 1:
            return True   # back edge → cycle
        if state[node] == 2:
            return False  # already fully explored

        state[node] = 1  # mark in-progress
        for neighbour in graph[node]:
            if has_cycle(neighbour):
                return True
        state[node] = 2  # mark completed
        return False

    for course in range(num_courses):
        if has_cycle(course):
            return False
    return True
```

- **为何需要三种状态**：两种状态（已访问/未访问）无法区分“我正在探索这个节点”和“我已探索完这个节点”。找到一个正在被探索的节点（状态=1）意味着我们发现了环；而找到已完全探索的节点（状态=2）只是交叉边，并非环。

### 中等难度：课程安排 II（拓扑排序）

- **问题**：返回一个有效的课程顺序（拓扑排序）。

- **解法（Kahn算法——基于BFS）**：从没有入边的节点（入度为0）开始处理，减少其邻居节点的入度。重复此过程。

```python
from collections import deque

def find_order(num_courses, prerequisites):
    graph = {i: [] for i in range(num_courses)}
    indegree = [0] * num_courses

    for course, prereq in prerequisites:
        graph[prereq].append(course)
        indegree[course] += 1

    queue = deque([i for i in range(num_courses) if indegree[i] == 0])
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbour in graph[node]:
            indegree[neighbour] -= 1
            if indegree[neighbour] == 0:
                queue.append(neighbour)

    return order if len(order) == num_courses else []  # empty = cycle exists
```

- **陷阱**：如果结果中的节点数少于图的节点数，则说明存在环（某些节点的入度从未变为0）。

## 最短路径

### 迪杰斯特拉算法

- 在**非负权重**图中，从源点出发寻找到所有其他节点的最短路径。该算法使用优先队列（最小堆）。

```python
import heapq

def dijkstra(graph, start):
    # graph: {node: [(neighbour, weight), ...]}
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    heap = [(0, start)]

    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue  # stale entry

        for neighbour, weight in graph[node]:
            new_dist = d + weight
            if new_dist < dist[neighbour]:
                dist[neighbour] = new_dist
                heapq.heappush(heap, (new_dist, neighbour))

    return dist
```

- 时间复杂度：使用二叉堆时为 $O((|V| + |E|) \log |V|)$。

- **陷阱**：`if d > dist[node]: continue` 这一行至关重要。缺少它会导致处理过期的堆条目，时间复杂度可能退化为 $O(|V|^2)$。

- **陷阱**：Dijkstra算法不适用于负权边。如果某条边具有负权重，那么“一旦节点被确定，其距离即为最优”这一贪心假设便不再成立。此时应使用Bellman-Ford算法。

### 难题：网络延迟时间

- **问题描述**：给定 $n$ 个节点及带权有向边，求信号从源点到达所有节点所需的时间。若并非所有节点都可达，则返回 -1。

```python
def network_delay(times, n, k):
    graph = {i: [] for i in range(1, n + 1)}
    for u, v, w in times:
        graph[u].append((v, w))

    dist = dijkstra(graph, k)
    max_time = max(dist.values())
    return max_time if max_time < float('inf') else -1
```

## 强连通分量

- 在有向图中，**强连通分量（SCC）**是指一个最大的节点集合，其中任意两个节点都能互相到达。

- **Kosaraju算法**：(1) 在原图上执行深度优先搜索，记录节点的完成顺序。(2) 将图进行转置（反转所有边）。(3) 按照相反的完成顺序在转置后的图上执行深度优先搜索。第3步中生成的每一棵DFS树就是一个强连通分量。

- **适用场景**：用于查找循环依赖、解决2-SAT问题，以及将有向图压缩为由强连通分量构成的DAG。

---

## 常见陷阱总结（续1）

| 陷阱 | 示例 | 解决方法 |
| ------ || ------ || ---------- ||
| 出队时标记已访问 | 同一节点被多次入队 | 入队时即标记为已访问 |
| 有向图中的双状态标记 | 无法区分回边与交叉边 | 使用三种状态：未访问/正在访问/已访问 |
| 带负权重的Dijkstra算法 | 计算出错误的最短路径 | 改用Bellman-Ford算法 |
| 忘记判断 `if d > dist[node]: continue` | 处理了过期的堆元素 | 若当前距离更差，则直接跳过 |
| 网格边界检查遗漏 | 出现数组越界错误 | 使用条件 `0 <= nr < rows && 0 <= nc < cols` |
| 未考虑时间=0的特殊情况 | 腐烂橘子问题中没有新鲜橘子 | 在BFS前先检查 `fresh == 0` |
| 把有向图误作成无向图 | 前置条件关系方向错误 | 仅在一个方向上添加边 |

---

## 课后练习（NeetCode）（续1）

### BFS模式

- [岛屿数量](https://neetcode.io/problems/count-number-of-islands) —— 网格上的BFS/DFS
- [腐烂的橘子](https://neetcode.io/problems/rotting-fruit) —— 多源BFS
- [克隆图](https://neetcode.io/problems/clone-graph) —— BFS结合哈希表进行克隆
- [太平洋大西洋水流问题](https://neetcode.io/problems/pacific-atlantic-water-flow) —— 从两个大洋出发的BFS
- [单词接龙](https://neetcode.io/problems/word-ladder) —— 在隐式图上应用BFS

### DFS模式

- [岛屿最大面积](https://neetcode.io/problems/max-area-of-island) —— 带面积计算的DFS
- [课程安排](https://neetcode.io/problems/course-schedule) —— 检测有向图中的环
- [课程安排 II](https://neetcode.io/problems/course-schedule-ii) —— 拓扑排序
- [连通分量数量](https://neetcode.io/problems/count-connected-components) —— DFS或并查集
- [有效树判定](https://neetcode.io/problems/valid-tree) —— 连通且无环

### 最短路径（续1）

- [网络延迟时间](https://neetcode.io/problems/network-delay-time) —— Dijkstra算法
- [最多K次中转的最便宜航班](https://neetcode.io/problems/cheapest-flight-path) —— 带约束条件的改良版BFS/Bellman-Ford算法
- [上涨的水中游泳](https://neetcode.io/problems/swim-in-rising-water) —— 二分查找 + BFS或Dijkstra算法在网格上的应用

### 进阶题目

- [外星词典](https://neetcode.io/problems/foreign-dictionary) —— 根据字符顺序进行拓扑排序

## 排序、查找与算法设计

_排序和查找是最基本的算法操作。本文档涵盖了排序算法、二分查找模式、分治算法、贪心算法、动态规划和回溯算法。_

- 每种数据结构都支撑着算法，而每种算法也依赖于数据结构。本文档介绍了**设计范式**：即解决问题的宏观策略。一旦确定了适用的范式，实现起来便水到渠成。

## 排序算法

- 排序是计算机科学中研究最深入的问题。理解这些算法有助于培养对递归、分治以及复杂度分析的直觉。

| 算法 | 最佳情况 | 平均情况 | 最坏情况 | 空间复杂度 | 是否稳定 |
| ----------- || ---------- || ---------- || ---------- || ------------ || ---------- ||
| 冒泡排序 | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | 是 |
| 插入排序 | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | 是 |
| 归并排序 | $O(n \log n)$ | $O(n \log n)$ | $O(n \log n)$ | $O(n)$ | 是 |
| 快速排序 | $O(n \log n)$ | $O(n \log n)$ | $O(n^2)$ | $O(\log n)$ | 否 |
| 堆排序 | $O(n \log n)$ | $O(n \log n)$ | $O(n \log n)$ | $O(1)$ | 否 |
| 计数排序 | $O(n + k)$ | $O(n + k)$ | $O(n + k)$ | $O(k)$ | 是 |
| 基数排序 | $O(d(n + k))$ | $O(d(n + k))$ | $O(d(n + k))$ | $O(n + k)$ | 是 |

- **稳定性**指的是相等元素能保持原有的相对顺序。这在按多个键进行排序时尤为重要。

- 基于比较的排序算法的**下界**为 $\Omega(n \log n)$。其证明用到了决策树（第13章）：任何比较排序算法都必须区分所有的 $n!$ 种排列，因此至少需要 $\log_2(n!) = \Omega(n \log n)$ 次比较。计数排序和基数排序由于不进行比较，因此突破了这一限制。

### 归并排序

- 将数组一分为二，递归地对每一半进行排序，然后合并已排序的两部分。时间复杂度始终为 $O(n \log n)$，需要 $O(n)$ 的额外空间。

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:  # <= for stability
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
```

- **陷阱**：在合并时使用 `<` 而非 `<=` 会破坏稳定性（来自右半部分的元素会排在来自左半部分的元素之前）。

### 快速排序

- 选择一个**基准值**，将元素划分为“小于基准值”和“大于基准值”两组，然后递归地对每组进行排序。平均时间复杂度为 $O(n \log n)$，最坏情况下为 $O(n^2)$（当基准值总是最小或最大元素时）。

```python
def quicksort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo >= hi:
        return

    pivot_idx = partition(arr, lo, hi)
    quicksort(arr, lo, pivot_idx - 1)
    quicksort(arr, pivot_idx + 1, hi)

def partition(arr, lo, hi):
    pivot = arr[hi]  # Lomuto: pivot is last element
    i = lo
    for j in range(lo, hi):
        if arr[j] < pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[hi] = arr[hi], arr[i]
    return i
```

- **基准选择策略**：选取最后一个元素作为基准（简单但适用于已排序数据效果较差）；随机选取基准（期望时间复杂度为$O(n \log n)$）；三数取中法（实用的选择）。面试中应始终优先选择随机基准，以避免讨论最坏情况。

- **陷阱**：快速排序的最坏情况时间复杂度为$O(n^2)$，通常发生在已排序数组且选取第一个或最后一个元素作为基准时。实际上，使用随机基准或三数取中法即可避免这种情况。

### 计数排序

- 当数值为已知范围$[0, k)$内的整数时，只需统计各数值的出现次数并重新构造序列：时间复杂度为$O(n + k)$。由于它不属于基于比较的排序算法，因此有可能优于$O(n \log n)$的时间复杂度。

```python
def counting_sort(arr, k):
    count = [0] * k
    for x in arr:
        count[x] += 1
    result = []
    for val in range(k):
        result.extend([val] * count[val])
    return result
```

- **适用场景**：范围$k$不会比$n$大太多。如果$k = O(n)$，时间复杂度为$O(n)$。若$k \gg n$（例如对范围$[0, 10^9]$内的10个数字进行排序），计数排序会浪费内存。

---

## 模式：二分查找

- 二分查找通过在有序数组中反复将搜索区间对半分割，从而在$O(\log n)$时间内找到目标值。但二分查找的意义远不止“在有序数组中找一个数”。其通用模式是：**基于单调条件进行搜索**。

- **模板**（可避免越界错误）：

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2  # avoids overflow in other languages
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1  # not found
```

- **下界**（第一个 $\geq$ 目标值的元素）：

```python
def lower_bound(arr, target):
    lo, hi = 0, len(arr)
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

- **常见误区**：`lo <= hi` 与 `lo < hi` 的区别，以及 `hi = mid` 与 `hi = mid - 1` 的区别，决定了你找到的是精确匹配还是边界值。可以用一个包含2个元素的数组来画图验证。

### 简单：二分查找

- 经典问题。使用上述模板即可。

### 中等：在旋转排序数组中查找

- **问题描述**：一个已排序的数组在某个枢轴位置发生了旋转。找出目标值。

- **解题模式**：每一步中，总有一半是有序的。先判断哪一半是有序的，再检查目标值是否在该半部分中。

```python
def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1

    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid

        # left half is sorted
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        # right half is sorted
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1

    return -1
```

- **陷阱**：`nums[lo] <= nums[mid]`中的`<=`（而非`<`）至关重要。当`lo == mid`（只剩两个元素时），我们必须能正确识别出已排序的那一半。

### 难题：两个有序数组的中位数

- **问题**：在$O(\log(m + n))$时间内找出两个有序数组的中位数。

- **模式**：对较小数组的分割点进行二分查找。该分割点将两个数组合并后，使得左侧的所有元素都小于右侧的所有元素。

```python
def find_median(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1  # ensure nums1 is shorter

    m, n = len(nums1), len(nums2)
    lo, hi = 0, m
    half = (m + n + 1) // 2

    while lo <= hi:
        i = (lo + hi) // 2          # partition point in nums1
        j = half - i                 # partition point in nums2

        left1 = nums1[i - 1] if i > 0 else float('-inf')
        right1 = nums1[i] if i < m else float('inf')
        left2 = nums2[j - 1] if j > 0 else float('-inf')
        right2 = nums2[j] if j < n else float('inf')

        if left1 <= right2 and left2 <= right1:
            # correct partition
            if (m + n) % 2 == 1:
                return max(left1, left2)
            return (max(left1, left2) + min(right1, right2)) / 2
        elif left1 > right2:
            hi = i - 1
        else:
            lo = i + 1
```

- 这是最难的二分查找问题之一。关键在于：你并非在寻找某个值，而是在寻找满足特定条件的**分割点**。

### 元模式：对答案进行二分查找

- 许多看似与二分查找无关的问题，其实可以通过对答案进行二分查找来解决。如果答案是一个数值，且你能写出一个单调的函数 `is_feasible(x)`（当 $x \geq$ 最优值时返回 True，否则返回 False），那么就可以对 $x$ 进行二分查找。

- **示例**：“要在 $d$ 天内送达所有包裹，船只的最小容量是多少？”此时可对容量进行二分查找。对于每个候选容量，贪心地判断是否能在 $d$ 天内送完所有包裹。

```python
def ship_within_days(weights, days):
    lo, hi = max(weights), sum(weights)

    while lo < hi:
        mid = (lo + hi) // 2
        # can we ship with capacity mid in <= days?
        current_load, num_days = 0, 1
        for w in weights:
            if current_load + w > mid:
                num_days += 1
                current_load = 0
            current_load += w

        if num_days <= days:
            hi = mid
        else:
            lo = mid + 1

    return lo
```

---

## 模式：贪心算法

- **贪心**算法在每一步都做出局部最优选择，期望这样能得出全局最优解。当问题具备**贪心选择性质**（局部最优导致全局最优）和**最优子结构**（最优解包含子问题的最优解）时，贪心算法才有效。

### 中等难度：跳跃游戏

- **问题描述**：给定一个数组，其中 `nums[i]` 表示在位置 $i$ 所能跳跃的最大长度，判断是否能到达最后一个索引。

```python
def can_jump(nums):
    max_reach = 0
    for i, jump in enumerate(nums):
        if i > max_reach:
            return False  # cannot reach this position
        max_reach = max(max_reach, i + jump)
    return True
```

- **为什么贪心算法有效**：我们只需知道最远可达位置。如果当前位置超出了最远可达范围，我们就无法继续前进；否则，我们更新最远可达位置。

### 中等难度：合并区间

- **问题**：合并重叠的区间。

```python
def merge_intervals(intervals):
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]

    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    return merged
```

- **模式**：按开始时间排序，然后贪心合并。如果当前区间与最后一个已合并的区间重叠，则扩展它；否则，开始一个新的合并区间。

- **陷阱**：使用 `merged[-1][1] = end` 而非 `merged[-1][1] = max(merged[-1][1], end)`。一个区间可能完全包含在另一个区间内（例如 [1, 10] 和 [2, 5]）。

---

## 模式：动态规划

- **动态规划（DP）**通过将问题分解为重叠的子问题，对每个子问题求解一次并存储结果来解决问题。当问题具备**最优子结构**和**重叠子问题**时，动态规划才适用。

- **两种方法**：
- **自顶向下（记忆化）**：编写自然的递归解法，然后将结果缓存到字典中。
- **自底向上（表格法）**：从最小的子问题开始构建表格。

- **如何识别动态规划**：题目要求求最优解（最小值/最大值）、计数或存在性判断，且当前决策依赖于之前的决策。如果画出递归树后发现有重复的子问题，那就是动态规划。

### 简单题：爬楼梯

- **问题描述**：$n$ 级台阶，每次可以爬 1 级或 2 级。共有多少种不同的爬法？

- 这是斐波那契数列：$f(n) = f(n-1) + f(n-2)$。

```python
def climb_stairs(n):
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b
```

- 时间复杂度：$O(n)$，空间复杂度：$O(1)$。由于每个状态仅依赖于前两个状态，因此无需完整的记忆化表。

### 中等难度：零钱兑换

- **问题**：给定硬币面额和目标金额，求凑出该金额所需的最少硬币数量。
- **状态**：`dp[amount]` = 凑出`amount`所需的最少硬币数。
- **转移方程**：对于每个硬币，`dp[amount] = min(dp[amount - coin] + 1)`。
- **基准情况**：`dp[0] = 0`。

```python
def coin_change(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a and dp[a - coin] + 1 < dp[a]:
                dp[a] = dp[a - coin] + 1

    return dp[amount] if dp[amount] != float('inf') else -1
```

- **常见错误**：初始化时使用 `float('inf')`（而非 0 或 -1）。只有当不可达状态被设为无穷大时，最小值比较才能生效。

### 中等难度：最长公共子序列

- **问题描述**：给定两个字符串，求它们的最长公共子序列的长度。

- **状态定义**：`dp[i][j]` 表示 `text1[:i]` 和 `text2[:j]` 的最长公共子序列长度。
- **状态转移**：如果 `text1[i-1] == text2[j-1]`，则 `dp[i][j] = dp[i-1][j-1] + 1`；否则，`dp[i][j] = max(dp[i-1][j], dp[i][j-1])`。

```python
def longest_common_subsequence(text1, text2):
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i - 1] == text2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    return dp[m][n]
```

### 难题：0/1背包问题

- **问题描述**：给定具有重量和价值的物品，以及容量限制$W$，要求在不超过$W$的前提下最大化总价值。

- **状态定义**：`dp[i][w]`表示使用前$i$个物品且容量为$w$时的最大价值。
- **状态转移**：`dp[i][w] = max(dp[i-1][w], dp[i-1][w - weight[i]] + value[i])`（即选择不取或取物品$i$）。

```python
def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for w in range(capacity + 1):
            dp[i][w] = dp[i - 1][w]  # skip item i
            if weights[i - 1] <= w:
                dp[i][w] = max(dp[i][w],
                               dp[i - 1][w - weights[i - 1]] + values[i - 1])

    return dp[n][capacity]
```

- **空间优化**：由于每一行仅依赖于前一行，可使用一维数组，并从右向左遍历$w$：

```python
def knapsack_optimised(weights, values, capacity):
    dp = [0] * (capacity + 1)
    for i in range(len(weights)):
        for w in range(capacity, weights[i] - 1, -1):  # right to left!
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])
    return dp[capacity]
```

- **陷阱**：在一维版本中从左到右迭代时，可以多次使用物品$i$（无界背包问题）。从右到左迭代则能确保每个物品最多被使用一次。

---

## 模式：回溯法

- **回溯法**是一种带有剪枝的穷举搜索。它逐步构建解决方案，一旦当前的部分解不可能发展成有效的完整解，就立即放弃并回溯。

- **模板**：

```python
def backtrack(candidates, path, result):
    if is_solution(path):
        result.append(path[:])  # copy!
        return

    for candidate in get_candidates(path):
        if is_valid(candidate, path):
            path.append(candidate)     # choose
            backtrack(candidates, path, result)  # explore
            path.pop()                 # unchoose (backtrack)
```

### 中等难度：子集

```python
def subsets(nums):
    result = []
    def backtrack(start, path):
        result.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()
    backtrack(0, [])
    return result
```

### 中等难度：组合求和

- **问题**：找出所有和为目标值的唯一组合（元素可重复使用）。

```python
def combination_sum(candidates, target):
    result = []
    def backtrack(start, path, remaining):
        if remaining == 0:
            result.append(path[:])
            return
        for i in range(start, len(candidates)):
            if candidates[i] > remaining:
                break  # prune: sorted, so all further candidates are too large
            path.append(candidates[i])
            backtrack(i, path, remaining - candidates[i])  # i, not i+1: reuse allowed
            path.pop()

    candidates.sort()  # sort for pruning
    backtrack(0, [], target)
    return result
```

- **陷阱**：`backtrack(i, ...)`允许重复使用同一个元素。`backtrack(i + 1, ...)`则会跳到下一个元素（不会重复使用）。这一点理解错误是最常见的回溯算法错误。

### 难题：N皇后问题

- **问题描述**：在一个 $n \times n$ 的棋盘上放置 $n$ 个皇后，使得任意两个皇后都无法互相攻击。

```python
def solve_n_queens(n):
    result = []
    cols = set()
    pos_diag = set()  # (row + col) is constant on / diagonals
    neg_diag = set()  # (row - col) is constant on \ diagonals

    board = [['.' ] * n for _ in range(n)]

    def backtrack(row):
        if row == n:
            result.append([''.join(r) for r in board])
            return

        for col in range(n):
            if col in cols or (row + col) in pos_diag or (row - col) in neg_diag:
                continue

            cols.add(col)
            pos_diag.add(row + col)
            neg_diag.add(row - col)
            board[row][col] = 'Q'

            backtrack(row + 1)

            cols.remove(col)
            pos_diag.remove(row + col)
            neg_diag.remove(row - col)
            board[row][col] = '.'

    backtrack(0)
    return result
```

- **关键见解**：对角线编码。对于“/”对角线，`row + col` 为常数；对于“\”对角线，`row - col` 为常数。使用集合来跟踪列和对角线信息，可使有效性检查的时间复杂度降至 $O(1)$。

---

## 常见陷阱总结（续2）

| 陷阱 | 示例 | 解决方法 |
| ------ || ------ || ---------- ||
| 二分查找中 `lo <= hi` 与 `lo < hi` 的区别 | 边界条件出错导致偏移 | 根据 `hi` 是包含还是排除来选择合适的条件 |
| 从左到右的一维背包问题 | 物品被重复使用 | 对于 0/1 背包问题，应反向遍历 |
| 回溯时未复制路径 | `result.append(path)` —— 所有条目指向同一个列表 | 使用 `result.append(path[:])` 或 `path.copy()` |
| `backtrack(i)` 与 `backtrack(i+1)` | 元素是否可重复使用 | 需与题目描述保持一致 |
| 排序后的回溯中缺少 `break` | 探索了过大的候选值 | 先排序，当候选值超过剩余限制时即中断 |
| 动态规划初始化错误 | `dp[0]` 定义错误 → 后续所有值均错误 | 仔细定义基准情况 |
| 未经证明的贪心算法 | 贪心策略并不总是有效 | 需验证贪心选择性质是否成立 |
| 多关键字排序不稳定 | 相等元素的相对顺序丢失 | 使用稳定排序（归并排序、Python 的 `sorted`） |

---

## 课后习题（NeetCode）

### 二分查找

- [二分查找](https://neetcode.io/problems/binary-search) —— 标准模板
- [搜索二维矩阵](https://neetcode.io/problems/search-2d-matrix) —— 对展平后的矩阵进行二分查找
- [吃香蕉问题](https://neetcode.io/problems/eating-bananas) —— 对答案进行二分查找
- [在旋转排序数组中查找目标值](https://neetcode.io/problems/find-target-in-rotated-sorted-array) —— 确定有序的一半
- [在旋转排序数组中找到最小值](https://neetcode.io/problems/find-minimum-in-rotated-sorted-array) —— 通过二分查找找到拐点
- [两个有序数组的中位数](https://neetcode.io/problems/median-of-two-sorted-arrays) —— 基于分区的二分查找

### 贪心算法

- [跳跃游戏](https://neetcode.io/problems/jump-game) —— 追踪最大可达范围
- [跳跃游戏 II](https://neetcode.io/problems/jump-game-ii) —— 类似 BFS 的层级追踪
- [合并区间](https://neetcode.io/problems/merge-intervals) —— 排序后合并
- [插入区间](https://neetcode.io/problems/insert-new-interval) —— 找出重叠区域
- [不重叠区间](https://neetcode.io/problems/non-overlapping-intervals) —— 按结束时间排序

### 动态规划（续1）

- [爬楼梯](https://neetcode.io/problems/climbing-stairs) —— 斐波那契数列 DP
- [打家劫舍](https://neetcode.io/problems/house-robber) —— 取或不取 DP
- [打家劫舍 II](https://neetcode.io/problems/house-robber-ii) —— 环形结构：运行两次
- [零钱兑换](https://neetcode.io/problems/coin-change) —— 无界背包问题
- [最长公共子序列](https://neetcode.io/problems/longest-common-subsequence) —— 针对两个字符串的二维 DP
- [单词拆分](https://neetcode.io/problems/word-break) —— 结合集合查询的 DP
- [最长递增子序列](https://neetcode.io/problems/longest-increasing-subsequence) —— $O(n^2)$ DP 或利用二分查找的 $O(n \log n)$ 解法
- [编辑距离](https://neetcode.io/problems/edit-distance) —— 经典的二维 DP
- [分割等和子集](https://neetcode.io/problems/partition-equal-subset-sum) —— 0/1 背包问题的变体

### 回溯算法

- [子集](https://neetcode.io/problems/subsets) —— 枚举所有子集
- [组合总和](https://neetcode.io/problems/combination-target-sum) —— 允许重复使用的回溯
- [排列](https://neetcode.io/problems/permutations) —— 使用已使用集合进行回溯
- [子集 II](https://neetcode.io/problems/subsets-ii) —— 跳过重复元素
- [单词搜索](https://neetcode.io/problems/search-for-word) —— 网格中的回溯
- [回文分割](https://neetcode.io/problems/palindrome-partitioning) —— 回溯 + 回文判断
- [N 皇后问题](https://neetcode.io/problems/n-queens) —— 约束传播

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
