---
title: "概率"
date: "2026-11-05"
order: 5
slug: "compendium/05-probability"
description: "计数是计算概率的先决条件——在为各种结果赋予概率值之前，必须先知道存在多少种可能的结果。本文件介绍了乘法法则、加法法则、阶乘、排列、组合以及二项式系数等组合数学工具，这些工具是机器学习中抽样、哈希处理和概率分析的基础。"
tags: []
---

## 计数

_计数是计算概率的先决条件——在为各种结果赋予概率值之前，必须先知道存在多少种可能的结果。本文件介绍了乘法法则、加法法则、阶乘、排列、组合以及二项式系数等组合数学工具，这些工具是机器学习中抽样、哈希处理和概率分析的基础。_

- 在计算概率之前，我们首先需要统计各种可能的结果。如果你想知道在扑克游戏中拿到胜出牌组的概率，就必须先知道有多少种可能的牌组，其中又有多少种是胜出牌组。计数正是让概率值具有精确性的关键。

- 最简单的计数原则就是**乘法法则**。如果一个决策有$m$种选择，另一个独立的决策有$n$种选择，那么所有可能的组合总数就是$m \times n$。

- 想象一下早上穿衣服的场景：你有3件衬衫和4条裤子，每件衬衫都可以与每条裤子搭配，因此共有$3 \times 4 = 12$种不同的穿着组合。

![树状图显示3件衬衫搭配4条裤子可得到12种组合](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/counting_outfits.svg)

- 乘法法则适用于任意数量的选择。如果你还有2双鞋子，那么总的穿着组合数就变成了$3 \times 4 \times 2 = 24$。每一个新的独立选择都会使组合数增加。

- **加法法则**用于处理“或”的情况。如果事件A有$m$种发生方式，事件B有$n$种发生方式，且这两个事件不能同时发生（即相互排斥），那么总的发生活动方式数为$m + n$。

- 假设你可以从城市X开车到城市Y（有3条路线），或者乘火车前往（有2条路线）。由于不能同时使用两种交通方式，所以总的路线数为$3 + 2 = 5$。

- 当某些事件会同时发生时，就需要减去那些被重复计算的结果。如果事件A和事件B可以同时发生，那么其发生活动方式数为$|A \cup B| = |A| + |B| - |A \cap B|$。这就是包含排除原理，我们在讨论概率的加法法则时还会再次用到它。

- 非负整数$n$的**阶乘**是指从1到$n$的所有正整数的乘积：

$$n! = n \times (n-1) \times (n-2) \times \cdots \times 2 \times 1$$

- 可以把阶乘理解为：将$n$个不同的物品排成一列，有多少种排列方式？书架上的3本书可以有$3! = 3 \times 2 \times 1 = 6$种排列方式。按照惯例，$0! = 1$。

- 阶乘的增长速度极快。$10! = 3{,}628{,}800$，而$20!$则已超过$2.4 \times 10^{18}$。正是由于这种惊人的增长速度，所以在处理组合问题时，暴力搜索方法已经不再实用。

- **排列**指的是物品的有序排列。当你从$n$个不同的物品中选出$r$个，并且顺序很重要时，排列的数量为：

$$P(n, r) = \frac{n!}{(n - r)!}$$

- 想象从一个由10人组成的团体中选出主席、副主席和财务主管。第一个职位有10名候选人，第二个职位有9名候选人，第三个职位有8名候选人。因此，排列数为$P(10, 3) = 10 \times 9 \times 8 = 720$。公式也验证了这一点：$\frac{10!}{7!} = 720$。

- **组合**则是指无序的选择。当你从$n$个物品中选出$r$个，且顺序无关紧要时，就需要去掉那些重复的排列方式：

$$C(n, r) = \binom{n}{r} = \frac{n!}{r!(n - r)!}$$

- 符号$\binom{n}{r}$读作“n选r”。关键在于，每个组合实际上对应着$r!$种排列方式（选出的$r$个物品可以有$r!$种不同的排序方式），因此我们需要用排列数除以$r!$。

![并列对比图：排列考虑所有顺序，组合则合并相同的组合](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/permutation_vs_combination.svg)

- 例如：从10个人中选出3人组成一个委员会，由于顺序无关紧要（没有主席或副主席，只有成员），所以我们使用组合公式：

$$\binom{10}{3} = \frac{10!}{3! \cdot 7!} = \frac{10 \times 9 \times 8}{3 \times 2 \times 1} = 120$$

- 同样的10个人可以产生720种排列方式，但只有120种组合方式，因为每组3人内部有$3! = 6$种排序方式。

- 组合在概率论中起着核心作用。二项式系数$\binom{n}{r}$用于计算在$n$次试验中恰好获得$r$次成功的组合数，这也是二项分布的核心内容（详见文件03）。

- 让我们通过一个典型的委员会组建问题来运用多种计数方法。

- **问题**：一个俱乐部有8名男性和6名女性，那么有多少种方法可以选出5人组成的委员会，且该委员会恰好包含3名男性和2名女性？

- **步骤1**：从8名男性中选出3名。

$$\binom{8}{3} = \frac{8!}{3! \cdot 5!} = \frac{8 \times 7 \times 6}{3 \times 2 \times 1} = 56$$

- **步骤2**：从6名女性中选出2名。

$$\binom{6}{2} = \frac{6!}{2! \cdot 4!} = \frac{6 \times 5}{2 \times 1} = 15$$

- **步骤3**：应用乘法法则。每一组选出的男性可以与每一组选出的女性搭配，因此总共有：

$$56 \times 15 = 840 \text{种委员会组合}$$

- 这种将复杂的计数问题分解为多个独立的子问题，再通过相乘来求解的方法，是组合数学中的标准做法。

- 还存在**允许重复的排列**。当物品可以重复选取时，从$n$种类型中选出$r$个物品，共有$n^r$种结果。使用0-9这10个数字组成的4位密码，共有$10^4 = 10{,}000$种可能。每个位置都有10种选择，其余部分则由乘法法则处理。

- **允许重复的组合**（也称为“星号与竖线法”）用于计算在允许重复且顺序无关紧要的情况下，从$n$种类型中选出$r$个物品的方法数：

$$\binom{n + r - 1}{r} = \frac{(n + r - 1)!}{r!(n - 1)!}$$

- 例如：从4种口味的冰淇淋中选出3份（允许重复），则共有$\binom{4 + 3 - 1}{3} = \binom{6}{3} = 20$种选择。

- 总结一下各种计数方法的公式：

| 场景 | 公式 |
| --- || --- ||
| 有序且不允许重复（排列） | $P(n,r) = \frac{n!}{(n-r)!}$ |
| 无序且不允许重复（组合） | $\binom{n}{r} = \frac{n!}{r!(n-r)!}$ |
| 有序且允许重复 | $n^r$ |
| 无序且允许重复 | $\binom{n+r-1}{r}$ |

- 所有涉及等可能结果的概率计算都使用公式 $P(\text{事件}) = \frac{\text{有利结果数}}{\text{总结果数}}$。通过计数，我们可以得到这两个数值。有了这个基础，我们就可以在下一个文件中正式定义概率的概念了。

## 编程任务（可使用CoLab或笔记本）

1. 使用阶乘公式和直接计算方法分别求出 $P(10, 3)$ 和 $\binom{10}{3}$ 的值。并验证排列数的值始终是组合数值的 $r!$ 倍。

```python
import jax.numpy as jnp
from math import factorial

n, r = 10, 3

perm = factorial(n) // factorial(n - r)
comb = factorial(n) // (factorial(r) * factorial(n - r))

print(f"P({n},{r}) = {perm}")
print(f"C({n},{r}) = {comb}")
print(f"P / C = {perm // comb} (should equal {r}! = {factorial(r)})")
```

1. 通过编程方法解决委员会组建问题（从8人中选3名男性，从6人中选2名女性），并通过列出所有可行的委员会组合来验证结果。

```python
from itertools import combinations
from math import factorial

def comb_count(n, r):
    return factorial(n) // (factorial(r) * factorial(n - r))

# Formula approach
men_ways = comb_count(8, 3)
women_ways = comb_count(6, 2)
print(f"Formula: {men_ways} × {women_ways} = {men_ways * women_ways}")

# Enumeration approach
men = [f"M{i}" for i in range(1, 9)]
women = [f"W{i}" for i in range(1, 7)]
count = sum(1 for _ in combinations(men, 3) for _ in combinations(women, 2))
print(f"Enumeration: {count}")
```

1. 计算使用26个小写字母可以生成多少个4位密码（允许重复使用字母）。然后再计算其中不含重复字母的密码有多少个。

```python
from math import factorial

n = 26
r = 4

with_rep = n ** r
without_rep = factorial(n) // factorial(n - r)

print(f"With repetition:    {with_rep:>10,}")
print(f"Without repetition: {without_rep:>10,}")
print(f"Fraction with repeats: {1 - without_rep/with_rep:.2%}")
```

1. 模拟生日问题：在由$k$个人组成的群体中，至少有两个人生日相同的概率是多少？请绘制$k$从1到60时的概率曲线，并找出概率达到50%的点。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def birthday_prob_exact(k):
    """Probability of at least one shared birthday in group of k."""
    p_no_match = 1.0
    for i in range(k):
        p_no_match *= (365 - i) / 365
    return 1 - p_no_match

ks = list(range(1, 61))
probs = [birthday_prob_exact(k) for k in ks]

plt.figure(figsize=(8, 4))
plt.plot(ks, probs, color="#3498db", linewidth=2)
plt.axhline(y=0.5, color="#e74c3c", linestyle="--", alpha=0.7, label="50%")
cross = next(k for k, p in zip(ks, probs) if p >= 0.5)
plt.axvline(x=cross, color="#e74c3c", linestyle="--", alpha=0.7)
plt.xlabel("Group size (k)")
plt.ylabel("P(at least one shared birthday)")
plt.title(f"Birthday Problem (crosses 50% at k={cross})")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

## 概率概念

_概率论将不确定性形式化，并提供了在此基础上的推理规则。本文档涵盖了样本空间、事件、概率公理、条件概率、独立性、贝叶斯定理以及频率主义与贝叶斯主义的解释；这些也是机器学习中各类生成模型与判别模型背后的数学框架。_

- 概率为一个事件赋予0到1之间的数值，用以衡量该事件发生的可能性。

- 概率为0表示不可能发生，为1表示必然发生，0.5则对应抛硬币的情况。

- 主要有两种解释。**频率主义**认为概率是长期相对频率：抛掷一枚公平硬币10,000次，出现正面的次数约占50%。

- **贝叶斯主义**认为概率是信念的程度：即便明天只会发生一次，你仍可能说明天下雨的概率为70%。

- 两种解释使用相同的数学规则。差异在于哲学层面，但在机器学习中却很重要：频率主义方法给出点估计，而贝叶斯方法则给出参数的完整分布。

- **样本空间** $S$ 是指实验所有可能结果的集合。抛硬币时：$S = \{H, T\}$；掷骰子时：$S = \{1, 2, 3, 4, 5, 6\}$。

- **事件**是样本空间的任意子集。“掷出偶数”这一事件是 $A = \{2, 4, 6\}$，它是 $S$ 的子集。

- 当所有结果出现的可能性相等时，事件的概率可通过计数得出（参见文件01）：

$$P(A) = \frac{|A|}{|S|} = \frac{\text{有利结果数}}{\text{总结果数}}$$

- 以掷出偶数为例：$P(\text{偶数}) = \frac{3}{6} = 0.5$。

![展示样本空间S内事件A和B及其交集与补集的维恩图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/venn_diagram.svg)

- 事件 $A$ 的**补集**，记作 $A'$ 或 $A^c$，是指 $S$ 中不属于 $A$ 的所有元素。由于每个结果要么属于 $A$，要么不属于 $A$：

$$P(A') = 1 - P(A)$$

- 利用补集往往更简便。例如，不必去数5次抛硬币中至少出现一次正面的所有情况，只需计算全为反面的情况，再用1减去即可：$P(\text{至少一次正面}) = 1 - P(\text{全为反面}) = 1 - (0.5)^5 = 0.969$。

- 如果两个事件不能同时发生，则称它们为**互斥事件**（不相交事件）：$A \cap B = \emptyset$。单次掷骰子时出现2点和5点就是互斥事件。

- **互斥事件的加法规则**很简单：

$$P(A \cup B) = P(A) + P(B) \quad \text{（若 } A \cap B = \emptyset\text{）}$$

- 当事件可以重叠时，需使用**一般加法规则**以避免重复计算交集：

$$P(A \cup B) = P(A) + P(B) - P(A \cap B)$$

- 这与计数中的容斥原理类似。上面的维恩图说明了原因：紫色区域（交集）在 $P(A)$ 和 $P(B)$ 中各被计算一次，因此需减去一次。

- **联合概率** $P(A \cap B)$ 是指事件 $A$ 与 $B$ 同时发生的概率。在一副牌中，$P(\text{红色} \cap \text{国王}) = \frac{2}{52}$，因为有2张红色国王牌。

- **边缘概率**是指不考虑其他事件时单个事件的概率。$P(\text{红色}) = \frac{26}{52} = 0.5$ 就是一个边缘概率。若有两个变量的联合分布，通过对另一个变量求和（或积分）即可得到边缘概率。

- **条件概率**回答的是：已知 $B$ 已经发生，那么 $A$ 发生的概率是多少？此时样本空间从 $S$ 缩小为 $B$，再求 $B$ 中属于 $A$ 的部分所占比例：

$$P(A | B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0$$

![条件概率表现为将样本空间从S缩小为B](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/conditional_probability.svg)

- 示例：你抽了一张牌，有人告诉你它是红色的。那么它是国王的概率是多少？共有26张红牌，其中2张是国王，因此 $P(\text{国王} | \text{红色}) = \frac{2}{26} = \frac{1}{13}$。用公式验证：$P(\text{国王} \cap \text{红色}) / P(\text{红色}) = \frac{2/52}{26/52} = \frac{1}{13}$。

- 如果知道其中一个事件的发生对另一个事件毫无影响，则称这两个事件为**独立事件**。正式表述为：

$$P(A \cap B) = P(A) \cdot P(B)$$

- 等价地，$P(A | B) = P(A)$。抛掷两枚独立的硬币属于独立事件；无放回抽取两张牌则不是独立事件（第一次抽取会影响剩余牌的情况）。

- 独立性大大简化了计算。对于独立事件，联合概率可分解为乘积形式，从而使计算变得可行。许多机器学习模型（如朴素贝叶斯）正是基于这种简化而假设特征之间相互独立。

- 任意两个事件的**乘法规则**可由条件概率公式推导得出：

$$P(A \cap B) = P(A | B) \cdot P(B) = P(B | A) \cdot P(A)$$

- 对于独立事件，由于条件概率等于边缘概率，该式简化为 $P(A \cap B) = P(A) \cdot P(B)$。

- **贝叶斯定理**是概率论中最重要的结论之一，也是贝叶斯机器学习的基础。它允许我们反转条件概率的方向：

$$P(A | B) = \frac{P(B | A) \cdot P(A)}{P(B)}$$

- 该定理可直接由 $P(A \cap B)$ 的两种表达方式推导得出：$P(B|A) \cdot P(A) = P(A|B) \cdot P(B)$，再解出 $P(A|B)$。

![贝叶斯定理各组成部分：后验概率、似然度、先验概率及证据](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bayes_components.svg)

- 每个组成部分都有特定名称：
- **先验概率** $P(A)$：看到证据之前的初始信念；
- **似然度** $P(B|A)$：在假设 $A$ 为真的前提下，证据出现的概率；
- **证据** $P(B)$：观察到该证据的总概率，起到归一化作用；
- **后验概率** $P(A|B)$：看到证据后的更新信念。
- 让我们来探讨经典的医学诊断案例。假设某种疾病影响了1%的人口。针对该疾病的检测准确率为95%：它能正确识别出95%的患者（灵敏度），也能正确识别出90%的健康人（特异性）。

- 如果你的检测结果为阳性，那么你实际患病的概率是多少呢？

- 设 $D$ = 患有该疾病，$+$ = 检测呈阳性。
- 先验概率：$P(D) = 0.01$
- 似然度：$P(+ | D) = 0.95$
- 假阳性率：$P(+ | D') = 0.10$

- 我们需要计算 $P(+)$。根据全概率公式：

$$P(+) = P(+ | D) \cdot P(D) + P(+ | D') \cdot P(D')$$
$$= 0.95 \times 0.01 + 0.10 \times 0.99 = 0.0095 + 0.099 = 0.1085$$

- 现在应用贝叶斯定理：

$$P(D | +) = \frac{P(+ | D) \cdot P(D)}{P(+)} = \frac{0.95 \times 0.01}{0.1085} \approx 0.088$$

- 尽管该检测“准确率高达95%”，但阳性结果仅意味着你患病的几率约为8.8%。先验概率的影响极为重要。由于该疾病较为罕见，大多数阳性结果其实属于假阳性。这对于机器学习中的任何分类问题而言都是至关重要的启示：当类别不平衡时，仅凭准确率来判断会具有误导性。

- **全概率公式**将样本空间划分为互斥且完备的事件 $B_1, B_2, \ldots, B_n$，并将任意事件 $A$ 表示为：

$$P(A) = \sum_{i=1}^{n} P(A | B_i) \cdot P(B_i)$$

- 这正是我们在医学案例中用来计算 $P(+)$ 的方法：我们将人群分为“患病”和“未患病”两类。

- **概率链式法则**将乘法规则推广到任意数量的事件：

$$P(A_1 \cap A_2 \cap \cdots \cap A_n) = P(A_1) \cdot P(A_2 | A_1) \cdot P(A_3 | A_1 \cap A_2) \cdots P(A_n | A_1 \cap \cdots \cap A_{n-1})$$

- 每个因子都是以之前所有事件为条件的。这正是自回归语言模型的基础：一个句子的概率等于每个词在给定前面所有词条件下的概率之积。

- **条件独立**指的是在给定第三个事件的情况下，两个事件相互独立。如果满足以下条件，则 $A$ 和 $B$ 在给定 $C$ 的条件下是独立的：

$$P(A \cap B | C) = P(A | C) \cdot P(B | C)$$

- 事件之间可能在边缘上相关但在条件上独立，反之亦然。例如，两名学生的考试成绩可能相关（都受考试难度的影响），但给定考试难度后，他们的成绩就是独立的。

- 条件独立是贝叶斯网络等图模型背后的关键假设。它使得复杂的联合分布可以被分解为易于处理的部分，从而让推断在计算上变得可行。

## 编程任务（请使用CoLab或笔记本）

1. 模拟医学诊断问题。生成包含10万人的群体，应用疾病患病率及检测准确率，验证贝叶斯定理能否给出正确的后验概率。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(42)
n = 100_000

# Generate population
k1, k2 = jax.random.split(key)
has_disease = jax.random.bernoulli(k1, p=0.01, shape=(n,))

# Generate test results
k3, k4 = jax.random.split(k2)
# Sensitivity: P(+|D) = 0.95, Specificity: P(-|D') = 0.90
test_positive = jnp.where(
    has_disease,
    jax.random.bernoulli(k3, p=0.95, shape=(n,)),
    jax.random.bernoulli(k4, p=0.10, shape=(n,))
)

# Among those who tested positive, what fraction actually has the disease?
positives = test_positive.astype(bool)
true_positives = (has_disease & positives).sum()
total_positives = positives.sum()

print(f"Total positive tests: {total_positives}")
print(f"True positives: {true_positives}")
print(f"P(Disease | Positive) = {true_positives / total_positives:.4f}")
print(f"Bayes' formula:         {0.95 * 0.01 / 0.1085:.4f}")
```

1. 通过模拟验证加法法则。生成具有已知概率和重叠关系的随机事件A和B，然后验证是否满足 $P(A \cup B) = P(A) + P(B) - P(A \cap B)$。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(0)
n = 200_000
k1, k2 = jax.random.split(key)

# Events: A = value < 0.4, B = value < 0.6 (overlap at < 0.4)
vals_a = jax.random.uniform(k1, shape=(n,))
vals_b = jax.random.uniform(k2, shape=(n,))

A = vals_a < 0.4
B = vals_b < 0.6

p_a = A.mean()
p_b = B.mean()
p_a_and_b = (A & B).mean()
p_a_or_b = (A | B).mean()

print(f"P(A) = {p_a:.4f}")
print(f"P(B) = {p_b:.4f}")
print(f"P(A ∩ B) = {p_a_and_b:.4f}")
print(f"P(A ∪ B) simulated = {p_a_or_b:.4f}")
print(f"P(A) + P(B) - P(A∩B) = {p_a + p_b - p_a_and_b:.4f}")
```

1. 证明条件概率会随着证据的变化而改变。模拟掷两颗骰子的过程，计算$P(\text{点数之和}=7)$，再计算$P(\text{点数之和}=7 | \text{第一颗骰子}=3)$。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(1)
n = 500_000
k1, k2 = jax.random.split(key)

d1 = jax.random.randint(k1, shape=(n,), minval=1, maxval=7)
d2 = jax.random.randint(k2, shape=(n,), minval=1, maxval=7)
total = d1 + d2

# Unconditional
p_sum7 = (total == 7).mean()
print(f"P(sum=7) = {p_sum7:.4f} (exact: {6/36:.4f})")

# Conditional on first die = 3
mask = d1 == 3
p_sum7_given_d1_3 = (total[mask] == 7).mean()
print(f"P(sum=7 | d1=3) = {p_sum7_given_d1_3:.4f} (exact: {1/6:.4f})")
```

1. 将贝叶斯定理实现为一个函数，并用它来迭代更新信念。以硬币偏差的均匀先验开始，在观察到每次抛掷结果后更新该先验。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

def bayes_update(prior, likelihood):
    """Multiply prior by likelihood and normalise."""
    posterior = prior * likelihood
    return posterior / posterior.sum()

# Discretise possible bias values
theta = jnp.linspace(0, 1, 200)
prior = jnp.ones_like(theta)  # uniform prior
prior = prior / prior.sum()

# Observed flips: 1=heads, 0=tails
flips = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1]

plt.figure(figsize=(10, 5))
plt.plot(theta, prior, "--", color="#999", label="prior")

for i, flip in enumerate(flips):
    likelihood = theta if flip == 1 else (1 - theta)
    prior = bayes_update(prior, likelihood)
    if i in [0, 2, 4, 9]:
        plt.plot(theta, prior, label=f"after {i+1} flips", linewidth=2)

plt.xlabel("Coin bias θ")
plt.ylabel("Belief (normalised)")
plt.title("Bayesian updating: belief about coin bias")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

## 概率分布

_概率分布用于描述随机结果在各个可能值上的分布情况。本文件列出了常见的离散型和连续型概率分布，包括伯努利分布、二项分布、泊松分布、高斯分布、指数分布、贝塔分布等，并为每种分布提供了公式、直观解释以及在机器学习中的应用场景（如损失函数、先验分布、噪声模型）。_

- 在第4章中，我们介绍了随机变量、概率质量函数、概率密度函数以及累积分布函数。在这里，我们汇总了在机器学习和统计学中最为重要的概率分布，给出了每种分布的直观解释、公式、均值和方差。

- 以下是三种核心函数的简要回顾（完整定义见第4章）：
- **概率质量函数** $P(X = x)$：表示每个离散结果的概率。在条形图中，它对应着条形的高度。
- **概率密度函数** $f(x)$：表示连续变量在某一点的密度。曲线在两点之间的面积即为该点的概率。
- **累积分布函数** $F(x) = P(X \le x)$：表示截至$x$点的累积概率。其值始终在0到1之间，且不会下降。

- 某种分布的**支撑集**是指概率质量函数或概率密度函数取正值的那些数值集合。对于掷骰子而言，其支撑集为$\{1,2,3,4,5,6\}$；而对于正态分布，其支撑集则是所有实数$(-\infty, \infty)$。

- 概率分布可分为两大类：离散型分布（结果可计数，使用概率质量函数）和连续型分布（结果不可计数，使用概率密度函数）。

- **伯努利分布**：最简单的概率分布。它描述的是一次只有两种结果的试验：以概率$p$出现成功结果（记为1），以概率$1-p$出现失败结果（记为0）。

$$P(X = x) = p^x (1 - p)^{1-x}, \quad x \in \{0, 1\}$$

- 均值：$E[X] = p$。方差：$\text{Var}(X) = p(1-p)$。

- 每次抛硬币、每次“是/否”判断、每一个二元结果都属于伯努利试验。在机器学习中，Sigmoid函数的输出值恰好就是伯努利分布中的参数$p$。

- **二项分布**：用于统计在$n$次独立伯努利试验中成功的次数，每次试验成功的概率均为$p$。

$$P(X = k) = \binom{n}{k} p^k (1-p)^{n-k}, \quad k = 0, 1, \ldots, n$$

- 文件01中提到的二项系数$\binom{n}{k}$表示在$n$次试验中选择$k$次成功的组合方式数。

- 均值：$E[X] = np$。方差：$\text{Var}(X) = np(1-p)$。

![伯努利分布用单个条形图表示，而二项分布则用计数分布的形式表示](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bernoulli_binomial.svg)

- 示例：用一枚有偏硬币（$p = 0.7$）抛8次。恰好出现6次正面的概率为$\binom{8}{6}(0.7)^6(0.3)^2 = 28 \times 0.1176 \times 0.09 \approx 0.296$。

- **泊松分布**：用于统计在固定时间或空间间隔内发生的事件数量，前提是这些事件的平均发生率为$\lambda$。当事件较为罕见且相互独立时，该分布非常适用。

$$P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}, \quad k = 0, 1, 2, \ldots$$

- 均值：$E[X] = \lambda$。方差：$\text{Var}(X) = \lambda$。均值与方差相等，这是泊松分布的典型特征。

- 示例：每小时收到的邮件数量（$\lambda = 5$）、每页中的拼写错误数量、每秒的服务器请求次数。在机器学习中，泊松回归模型可用于处理那些线性模型无法给出非负预测值的计数数据。

- 当$n \to \infty$且$p \to 0$，同时保持$np = \lambda$不变时，二项分布$(n,p)$会趋近于泊松分布$(\lambda)$。这就是为什么泊松分布适用于大规模群体中罕见的事件。

- **几何分布**：用于统计直到首次出现成功为止所需的试验次数。即“我需要抛多少次硬币才能得到第一次正面？”

$$P(X = k) = (1-p)^{k-1} p, \quad k = 1, 2, 3, \ldots$$

- 均值：$E[X] = 1/p$。方差：$\text{Var}(X) = (1-p)/p^2$。

- 几何分布具有**无记忆性**：即再等待$k$次试验才出现成功的概率，与之前已经等待的试验次数无关。这一特性使得它在离散型分布中十分特殊。

- **负二项分布**：是对几何分布的推广，用于统计直到第$r$次成功为止所需的试验次数（几何分布是$r=1$的特殊情况）。

$$P(X = k) = \binom{k-1}{r-1} p^r (1-p)^{k-r}, \quad k = r, r+1, r+2, \ldots$$

- 均值：$E[X] = r/p$。方差：$\text{Var}(X) = r(1-p)/p^2$。

- 负二项分布在实际应用中也用于建模方差大于均值的过度离散计数数据，而泊松分布则无法处理这类数据。

- 现在我们来介绍连续型分布。

- **均匀分布**：在区间$[a, b]$内的所有数值出现的可能性相等。其概率密度函数为常数矩形形状。

$$f(x) = \frac{1}{b - a}, \quad a \le x \le b$$

- 均值：$E[X] = \frac{a+b}{2}$。方差：$\text{Var}(X) = \frac{(b-a)^2}{12}$。

- 随机数生成器通常以均匀分布(0,1)的样本作为起点，其他分布则是通过变换这些均匀样本得到的。

- **正态分布（高斯分布）**：是统计学中最重要的分布。根据中心极限定理（见第4章），许多独立随机变量的平均值会趋近于正态分布，无论这些随机变量的原始分布为何。

$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} \exp\!\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)$$

- 均值：$E[X] = \mu$。方差：$\text{Var}(X) = \sigma^2$。

- **标准正态分布**的均值$\mu = 0$，标准差$\sigma = 1$。任何正态变量$X$都可以通过公式$Z = (X - \mu)/\sigma$转换为标准正态变量$Z$。

![带有68-95-99.7经验法则区域的钟形曲线](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/normal_empirical.svg)

- **经验法则**（68-95-99.7规则）指出：
- 大约68%的数据落在均值$\pm 1\sigma$范围内；
- 大约95%的数据落在均值$\pm 2\sigma$范围内；
- 大约99.7%的数据落在均值$\pm 3\sigma$范围内。

- 在机器学习中，正态分布随处可见：权重初始化、数据增强中的噪声处理、MSE损失函数背后的假设（该函数隐含地假设误差服从高斯分布），以及变分自编码器中的重参数化技巧。
- **指数分布**：用于描述泊松过程中事件发生之间的时间间隔。如果事件以速率$\lambda$出现，那么它们之间的等待时间就服从指数分布$(\lambda)$。

$$f(x) = \lambda e^{-\lambda x}, \quad x \ge 0$$

- 均值：$E[X] = 1/\lambda$。方差：$\text{Var}(X) = 1/\lambda^2$。

- 与离散变量下的几何分布类似，指数分布也是**无记忆性**的：$P(X > s + t | X > s) = P(X > t)$。再等待$t$时间的概率与之前已经等待的时间无关。

- **伽马分布**：是对指数分布的推广。它用于描述泊松过程中第$\alpha$个事件发生之前的时间（当$\alpha = 1$时即为指数分布）。

$$f(x) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x}, \quad x > 0$$

- 这里，参数$\alpha$决定分布的形状，而参数$\beta$决定分布的尺度。$\Gamma(\alpha)$是伽马函数，它将阶乘的概念扩展到实数范围：对于正整数，有$\Gamma(n) = (n-1)!$。

- 均值：$E[X] = \alpha/\beta$。方差：$\text{Var}(X) = \alpha/\beta^2$。

- **贝塔分布**：定义在区间$[0, 1]$上，因此非常适合用来描述概率、比例和比率等数值。

$$f(x) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{B(\alpha, \beta)}, \quad 0 \le x \le 1$$

- 分母$B(\alpha, \beta) = \frac{\Gamma(\alpha)\Gamma(\beta)}{\Gamma(\alpha + \beta)}$称为贝塔函数，是一个归一化常数。

- 均值：$E[X] = \frac{\alpha}{\alpha + \beta}$。方差：$\text{Var}(X) = \frac{\alpha\beta}{(\alpha+\beta)^2(\alpha+\beta+1)}$。

- 贝塔分布是伯努利分布和二项式分布的共轭先验分布。这意味着，如果你的先验分布是贝塔分布，而数据服从伯努利分布，那么后验分布也仍是贝塔分布，这使得贝叶斯更新可以在解析层面进行计算。我们将在文件04中使用这一性质。

![四种常见的分布形态：均匀分布、指数分布、贝塔分布、泊松分布](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/common_distributions.svg)

- **卡方分布**（$\chi^2$）：如果你取$k$个独立的标准正态随机变量，并将它们的平方相加，得到的结果就服从自由度为$k$的卡方分布。

$$f(x) = \frac{1}{2^{k/2}\Gamma(k/2)} x^{k/2 - 1} e^{-x/2}, \quad x > 0$$

- 均值：$E[X] = k$。方差：$\text{Var}(X) = 2k$。

- 实际上，卡方分布是伽马分布的一种特例，此时$\alpha = k/2$且$\beta = 1/2$。它被用于假设检验（如第4章中的卡方检验）、拟合优度检验，以及计算方差的置信区间。

- **学生t分布**：其形态类似于正态分布，但尾部更重。当使用小样本来估计正态分布总体的均值，且总体方差未知时，就会出现这种分布。

$$f(x) = \frac{\Gamma\!\left(\frac{\nu+1}{2}\right)}{\sqrt{\nu\pi}\,\Gamma\!\left(\frac{\nu}{2}\right)} \left(1 + \frac{x^2}{\nu}\right)^{-(\nu+1)/2}$$

- 参数$\nu$表示自由度。当$\nu \to \infty$时，t分布会趋近于标准正态分布。而当$\nu$较小时，较重的尾部会导致极端值的出现概率增加，这反映了小样本所带来的额外不确定性。

- 均值：$E[X] = 0$（当$\nu > 1$时）。方差：$\text{Var}(X) = \frac{\nu}{\nu - 2}$（当$\nu > 2$时）。

- t分布被用于t检验（第4章），在贝叶斯推断中，则作为对未知方差进行积分后的边缘分布出现。

- 下表总结了各种主要分布的特点：

| 分布类型 | 类型 | 定义域 | 均值 | 方差 |
| --- || --- || --- || --- || --- ||
| 伯努利$(p)$ | 离散型 | $\{0,1\}$ | $p$ | $p(1-p)$ |
| 二项式$(n,p)$ | 离散型 | $\{0,\ldots,n\}$ | $np$ | $np(1-p)$ |
| 泊松$(\lambda)$ | 离散型 | $\{0,1,2,\ldots\}$ | $\lambda$ | $\lambda$ |
| 几何$(p)$ | 离散型 | $\{1,2,3,\ldots\}$ | $1/p$ | $(1-p)/p^2$ |
| 均匀$(a,b)$ | 连续型 | $[a,b]$ | $(a+b)/2$ | $(b-a)^2/12$ |
| 正态$(\mu,\sigma^2)$ | 连续型 | $(-\infty,\infty)$ | $\mu$ | $\sigma^2$ |
| 指数$(\lambda)$ | 连续型 | $[0,\infty)$ | $1/\lambda$ | $1/\lambda^2$ |
| 伽马$(\alpha,\beta)$ | 连续型 | $(0,\infty)$ | $\alpha/\beta$ | $\alpha/\beta^2$ |
| 贝塔$(\alpha,\beta)$ | 连续型 | $[0,1]$ | $\alpha/(\alpha+\beta)$ | 见上表 |
| 卡方$(k)$ | 连续型 | $(0,\infty)$ | $k$ | $2k$ |
| 学生t$(\nu)$ | 连续型 | $(-\infty,\infty)$ | $0$ | $\nu/(\nu-2)$ |

## 编程任务（可使用CoLab或笔记本完成）

1. 对于$n=20$的情况，分别取不同的$p$值，绘制二项分布的概率质量函数图。观察其形态是如何从左偏态变为对称态，再变为右偏态的。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
from math import comb

n = 20
ks = jnp.arange(0, n + 1)

fig, axes = plt.subplots(1, 3, figsize=(12, 4), sharey=True)
for ax, p, color in zip(axes, [0.2, 0.5, 0.8], ["#e74c3c", "#3498db", "#27ae60"]):
    pmf = jnp.array([comb(n, int(k)) * p**k * (1-p)**(n-k) for k in ks])
    ax.bar(ks, pmf, color=color, alpha=0.7)
    ax.set_title(f"Binomial(n={n}, p={p})")
    ax.set_xlabel("k")
axes[0].set_ylabel("P(X = k)")
plt.tight_layout()
plt.show()
```

1. 验证二项分布可以用泊松分布来近似。取$n = 1000$，$p = 0.003$，然后比较二项分布$(n, p)$与泊松分布$(\lambda = np)$的结果。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
from math import comb, factorial, exp

n, p = 1000, 0.003
lam = n * p
ks = jnp.arange(0, 15)

binom_pmf = jnp.array([comb(n, int(k)) * p**k * (1-p)**(n-k) for k in ks])
poisson_pmf = jnp.array([lam**k * exp(-lam) / factorial(int(k)) for k in ks])

plt.figure(figsize=(8, 4))
plt.bar(ks - 0.15, binom_pmf, width=0.3, color="#3498db", alpha=0.7, label=f"Binomial({n},{p})")
plt.bar(ks + 0.15, poisson_pmf, width=0.3, color="#e74c3c", alpha=0.7, label=f"Poisson({lam})")
plt.xlabel("k")
plt.ylabel("P(X = k)")
plt.title("Poisson approximation to Binomial")
plt.legend()
plt.show()
```

1. 从正态分布中抽取样本，并验证经验法则。统计落在1个、2个以及3个标准差范围内的样本所占的比例。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(42)
mu, sigma = 5.0, 2.0
samples = mu + sigma * jax.random.normal(key, shape=(100_000,))

for k in [1, 2, 3]:
    within = jnp.abs(samples - mu) <= k * sigma
    print(f"Within {k}σ: {within.mean():.4f} (expected: {[0.6827, 0.9545, 0.9973][k-1]:.4f})")
```

1. 通过改变$\alpha$和$\beta$的值来探究贝塔分布。绘制出不同的分布曲线，观察该分布是如何从均匀分布变为偏态分布，再变为集中分布的。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

x = jnp.linspace(0.01, 0.99, 200)

def beta_pdf(x, a, b):
    # Unnormalised for shape comparison
    return x**(a-1) * (1-x)**(b-1)

plt.figure(figsize=(10, 5))
params = [(1,1,"Uniform"), (2,5,"Left skew"), (5,2,"Right skew"),
          (5,5,"Symmetric"), (0.5,0.5,"U-shape")]
colors = ["#999", "#e74c3c", "#3498db", "#27ae60", "#9b59b6"]

for (a, b, label), color in zip(params, colors):
    y = beta_pdf(x, a, b)
    y = y / jnp.trapezoid(y, x)  # normalise
    plt.plot(x, y, label=f"α={a}, β={b} ({label})", color=color, linewidth=2)

plt.xlabel("x")
plt.ylabel("Density")
plt.title("Beta distribution shapes")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

## 贝叶斯方法与序列模型

贝叶斯方法将先验信念与观测数据相结合，以得出模型参数的后验分布。本文涵盖了最大似然估计、MAP估计、共轭先验、贝叶斯推断、隐马尔可夫模型以及EM算法——这些技术被广泛应用于垃圾邮件过滤、语言模型和不确定性感知的机器学习中。

- 到目前为止，我们描述了概率分布以及如何计算概率。现在我们来探讨机器学习的核心问题：给定观测数据，如何找到模型的最佳参数？

- **最大似然估计（MLE）**直接回答了这个问题：选择使观测数据出现概率最大的参数值。

- 形式上，给定数据 $D = \{x_1, x_2, \ldots, x_n\}$ 以及参数为 $\theta$ 的模型，其**似然函数**为：

$$L(\theta | D) = P(D | \theta) = \prod_{i=1}^{n} P(x_i | \theta)$$

- 该公式假设数据点之间相互独立且服从相同分布（i.i.d.）。MLE估计值为：

$$\hat{\theta}_{\text{MLE}} = \arg\max_\theta L(\theta | D)$$

- 实际应用中，我们通常会最大化**对数似然**，因为对数能将乘积转化为求和，从而避免数值下溢：

$$\ell(\theta) = \log L(\theta | D) = \sum_{i=1}^{n} \log P(x_i | \theta)$$

- 由于对数函数单调递增，使 $\ell(\theta)$ 取得最大值的 $\theta$ 同样能使 $L(\theta)$ 取得最大值。

- **抛硬币示例**：你抛硬币10次，得到7次正面。硬币出现正面的概率 $p$ 的MLE估计值是多少？

- 每次抛掷服从伯努利分布（$Bernoulli(p)$），因此10次中出现7次正面的似然函数为：

$$L(p) = \binom{10}{7} p^7 (1-p)^3$$

- 取对数并求导：$\frac{d\ell}{dp} = \frac{7}{p} - \frac{3}{1-p} = 0$，解得 $\hat{p}_{\text{MLE}} = 7/10 = 0.7$。

- MLE直观且简单。如果10次抛掷中有7次正面，那么最可能的偏差就是0.7。但请注意其中的问题：如果10次全部是正面，MLE会给出 $\hat{p} = 1$，即认为硬币永远会出现正面。仅基于10次观测就得出如此肯定的结论似乎过于自信。

- **最大后验概率（MAP）**估计通过引入先验信念解决了这一问题。MAP并非仅最大化似然函数，而是最大化后验概率：

$$\hat{\theta}_{\text{MAP}} = \arg\max_\theta P(\theta | D) = \arg\max_\theta P(D | \theta) \cdot P(\theta)$$

- 我们省略了分母中的 $P(D)$，因为它不依赖于 $\theta$，不会影响取最大值的结果。

- 先验 $P(\theta)$ 反映了我们在看到数据前对 $\theta$ 的认知。如果我们对硬币偏差使用Beta(2, 2)先验（表示我们倾向于认为硬币大致公平），那么MAP估计值就不再仅仅是正面的比例，而是会被拉向0.5。

![MLE找到似然函数的峰值；MAP找到似然函数与先验乘积的峰值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mle_vs_map.svg)

- 若使用Beta($\alpha$, $\beta$)先验，且观察到 $h$ 次正面、$t$ 次反面，则后验分布为Beta($\alpha + h$, $\beta + t$)，对应的MAP估计值为：

$$\hat{p}_{\text{MAP}} = \frac{\alpha + h - 1}{\alpha + \beta + h + t - 2}$$

- 在Beta(2,2)先验、7次正面、3次反面的例子中，$\hat{p}_{\text{MAP}} = \frac{2 + 7 - 1}{2 + 2 + 10 - 2} = \frac{8}{12} = 0.667$。

- 可以看出，MAP估计值（0.667）相比MLE（0.7）更靠近0.5。先验起到了正则化的作用。在机器学习中，L2正则化（权重衰减）本质上等同于对权重采用高斯先验时的MAP估计。

- **完整的贝叶斯推断**比MAP更进一步。它并不只寻找一个最佳的 $\theta$，而是保留整个后验分布 $P(\theta | D)$。这样不仅能得到点估计，还能获得不确定性的度量。

- 对于具有Beta(2,2)先验、7次正面、3次反面的有偏硬币模型，其完整后验分布为Beta(9, 5)。该分布的均值为 $9/14 \approx 0.643$，其离散程度反映了我们的置信度。随着数据量增加，后验分布会逐渐变窄。

- 这三种方法构成了一个谱系：
- **MLE**：不使用先验，仅依赖数据。计算速度快，但数据较少时容易过拟合。
- **MAP**：结合先验正则化的点估计。增强了模型的鲁棒性。
- **完整贝叶斯推断**：提供完整的后验分布。信息量最丰富，但计算成本通常较高。

- **马尔可夫链**用于描述这样一种序列：下一个状态仅取决于当前状态，而与历史无关。这种“无记忆性”被称为**马尔可夫性质**：

$$P(X_{t+1} | X_t, X_{t-1}, \ldots, X_1) = P(X_{t+1} | X_t)$$

- 以天气为例：明天的天气取决于今天的天气，而与上周的天气无关（虽然这是一种简化，但 surprisingly 实用）。

- 马尔可夫链包含有限的**状态集**以及一个**转移矩阵** $T$，其中元素 $T_{ij}$ 表示从状态 $i$ 转移到状态 $j$ 的概率。每一行的和均为1。

![天气马尔可夫链，包含雨天、晴天、多云等状态及转移概率](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/markov_chain.svg)

- 以上述天气为例，其转移矩阵为：

$$
T = \begin{pmatrix} 0.3 & 0.4 & 0.3 \\ 0.2 & 0.5 & 0.3 \\ 0.4 & 0.3 & 0.3 \end{pmatrix}

$$

- 如果今天是雨天（状态向量 $\mathbf{s}_0 = [1, 0, 0]$），则明天天气的概率分布为 $\mathbf{s}_1 = \mathbf{s}_0 T = [0.3, 0.4, 0.3]$。两天后的情况为：$\mathbf{s}_2 = \mathbf{s}_0 T^2$。这里用到了第1章介绍的矩阵乘法。

- 许多马尔可夫链会收敛到一个**平稳分布** $\pi$，满足 $\pi T = \pi$。无论初始状态如何，经过足够多的步数后，链都会稳定在 $\pi$ 上。这一性质是MCMC（马尔可夫链蒙特卡洛方法）的基础，该方法在贝叶斯机器学习中被广泛用作采样技术。

- **隐马尔可夫模型（HMM）**通过增加一层间接性来扩展马尔可夫链。真实状态是隐藏的（无法观测），每个时间步中隐藏状态会生成一个可观测的信号。

![HMM结构：上方的隐藏状态通过转移连接，下方的观测值通过发射连接](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/hmm_structure.svg)

- HMM包含三个组成部分：
- **转移概率** $P(z_t | z_{t-1})$：描述隐藏状态的演变过程（即马尔可夫链）
- **发射概率** $P(x_t | z_t)$：表示每个隐藏状态产生的可观测输出
- **初始分布** $P(z_1)$：描述起始时刻隐藏状态的概率

- **雨伞示例**：假设你无法直接看到天气情况，但能观察到朋友是否携带雨伞。隐藏状态为`{雨天, 晴天}`，观测值为`{带伞, 没带伞}`。

- 转移概率：$P(\text{雨天}|\text{雨天}) = 0.7$，$P(\text{晴天}|\text{雨天}) = 0.3$，$P(\text{雨天}|\text{晴天}) = 0.4$，$P(\text{晴天}|\text{晴天}) = 0.6$。

- 发射概率：$P(\text{带伞}|\text{雨天}) = 0.9$，$P(\text{没带伞}|\text{雨天}) = 0.1$，$P(\text{带伞}|\text{晴天}) = 0.2$，$P(\text{没带伞}|\text{晴天}) = 0.8$。

- HMM的关键问题包括：
- **解码**：给定观测序列，最可能的隐藏状态序列是什么？可通过**维特比算法**求解。
- **评估**：某个观测序列出现的概率是多少？可通过**前向算法**求解。
- **学习**：给定观测数据，最佳的模型参数有哪些？可通过**鲍姆-韦尔奇算法**（期望最大化算法的一种）求解。

- **维特比算法详解**：假设观测序列为[带伞, 带伞, 没带伞]，需要找出最可能的天气序列。

- 从初始概率开始。设 $P(R) = 0.5$，$P(S) = 0.5$。

- **第一天**（观测到带伞）：
- $V_1(R) = P(R) \cdot P(\text{带伞}|R) = 0.5 \times 0.9 = 0.45$
- $V_1(S) = P(S) \cdot P(\text{带伞}|S) = 0.5 \times 0.2 = 0.10$

- **第二天**（观测到带伞）：
- $V_2(R) = \max(V_1(R) \cdot P(R|R), V_1(S) \cdot P(R|S)) \cdot P(\text{带伞}|R)$
- $= \max(0.45 \times 0.7, 0.10 \times 0.4) \times 0.9 = \max(0.315, 0.04) \times 0.9 = 0.2835$
- $V_2(S) = \max(V_1(R) \cdot P(S|R), V_1(S) \cdot P(S|S)) \cdot P(\text{带伞}|S)$
- $= \max(0.45 \times 0.3, 0.10 \times 0.6) \times 0.2 = \max(0.135, 0.06) \times 0.2 = 0.027$

- **第三天**（观测到没带伞）：
- $V_3(R) = \max(0.2835 \times 0.7, 0.027 \times 0.4) \times 0.1 = 0.1985 \times 0.1 = 0.01985$
- $V_3(S) = \max(0.2835 \times 0.3, 0.027 \times 0.6) \times 0.8 = 0.08505 \times 0.8 = 0.06804$

- 第三天的最大值出现在晴天。回溯可知：第三天=晴天（来自雨天），第二天=雨天（来自雨天），第一天=雨天。最可能的序列为：**雨天, 雨天, 晴天**。

- **前向-后向算法**用于计算给定整个观测序列时，每个时间步中处于各隐藏状态的概率。前向过程计算 $P(z_t, x_{1:t})$，后向过程计算 $P(x_{t+1:T} | z_t)$。将两者相乘即可得到平滑后的状态概率。

- **鲍姆-韦尔奇算法**用于在隐藏状态不可观测时从数据中学习HMM参数。它属于期望最大化（EM）算法：E步利用前向-后向算法估计生成观测值的隐藏状态，M步则更新转移概率和发射概率。

- 历史上，HMM在语音识别（隐藏的音素状态产生声学信号）和生物信息学（隐藏的基因状态产生DNA碱基对）领域占据主导地位。尽管深度学习在这些领域已很大程度上取代了HMM，但隐藏状态、发射机制以及序列推断的思想仍是序列模型的核心。

- **条件随机场（CRF）**通过取消对发射过程的独立性假设来改进HMM。在HMM中，时间$t$的观测值仅依赖于时间$t$的隐藏状态；而CRF允许位置$t$的标签依赖于整个输入序列。

- 线性链CRF描述了给定输入序列$\mathbf{x}$时标签序列$\mathbf{y}$的条件概率：

$$P(\mathbf{y} | \mathbf{x}) = \frac{1}{Z(\mathbf{x})} \exp\!\left(\sum_t \left[\sum_k \lambda_k f_k(y_t, y_{t-1}, \mathbf{x}, t)\right]\right)$$

- 其中$f_k$为特征函数（可考察输入的任何部分），$\lambda_k$为学习得到的权重，$Z(\mathbf{x})$为归一化常数。

- CRF属于判别模型（直接建模$P(\mathbf{y}|\mathbf{x})$），而HMM属于生成模型（建模$P(\mathbf{x}, \mathbf{y})$）。这种区别类似于逻辑回归（判别模型）与朴素贝叶斯（生成模型）的区别。

- 在现代自然语言处理中，CRF层常被添加到神经网络之上（如BiLSTM-CRF、BERT-CRF），用于命名实体识别和词性标注等需要捕捉标签依赖关系的任务。

## 编程任务（请使用CoLab或笔记本）（续1）

1. 实现抛硬币实验中的最大似然估计和最大后验估计。观察在不同先验和不同数据量下，最大后验估计的变化情况。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Data: observed coin flips
heads, tails = 7, 3

# MLE
p_mle = heads / (heads + tails)
print(f"MLE: {p_mle:.4f}")

# MAP with Beta prior
for alpha, beta in [(1,1), (2,2), (5,5), (10,10)]:
    p_map = (alpha + heads - 1) / (alpha + beta + heads + tails - 2)
    print(f"MAP (Beta({alpha},{beta})): {p_map:.4f}")

# Visualise posterior for Beta(2,2) prior
theta = jnp.linspace(0.01, 0.99, 200)
# Posterior is Beta(alpha+heads, beta+tails)
a_post, b_post = 2 + heads, 2 + tails
posterior = theta**(a_post-1) * (1-theta)**(b_post-1)
posterior = posterior / jnp.trapezoid(posterior, theta)

plt.figure(figsize=(8, 4))
plt.plot(theta, posterior, color="#e74c3c", linewidth=2, label=f"Posterior Beta({a_post},{b_post})")
plt.axvline(p_mle, color="#3498db", linestyle="--", label=f"MLE = {p_mle:.2f}")
plt.axvline((a_post-1)/(a_post+b_post-2), color="#e74c3c", linestyle="--", label=f"MAP = {(a_post-1)/(a_post+b_post-2):.3f}")
plt.xlabel("θ (coin bias)")
plt.ylabel("Density")
plt.title("Posterior distribution after 7H, 3T with Beta(2,2) prior")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

1. 为天气模型构建一个马尔可夫链并进行模拟。通过模拟以及求解 $\pi T = \pi$ 来计算平稳分布。

```python
import jax
import jax.numpy as jnp

# Transition matrix: R, S, C
T = jnp.array([
    [0.3, 0.4, 0.3],
    [0.2, 0.5, 0.3],
    [0.4, 0.3, 0.3]
])
states = ["Rainy", "Sunny", "Cloudy"]

# Simulate 100,000 steps
key = jax.random.PRNGKey(42)
n_steps = 100_000
state = 0  # start rainy
counts = jnp.zeros(3)

for i in range(n_steps):
    key, subkey = jax.random.split(key)
    state = jax.random.choice(subkey, 3, p=T[state])
    counts = counts.at[state].add(1)

sim_stationary = counts / n_steps
print("Simulated stationary distribution:")
for s, p in zip(states, sim_stationary):
    print(f"  {s}: {p:.4f}")

# Analytical: find left eigenvector with eigenvalue 1
eigenvalues, eigenvectors = jnp.linalg.eig(T.T)
idx = jnp.argmin(jnp.abs(eigenvalues - 1.0))
pi = jnp.real(eigenvectors[:, idx])
pi = pi / pi.sum()
print("\nAnalytical stationary distribution:")
for s, p in zip(states, pi):
    print(f"  {s}: {p:.4f}")
```

1. 为雨伞隐马尔可夫模型实现Viterbi算法，并对观测序列进行解码。

```python
import jax.numpy as jnp

# HMM parameters
states = ["Rainy", "Sunny"]
obs_names = ["Umbrella", "No umbrella"]

trans = jnp.array([[0.7, 0.3],   # R->R, R->S
                    [0.4, 0.6]])  # S->R, S->S

emit = jnp.array([[0.9, 0.1],    # R->U, R->noU
                   [0.2, 0.8]])   # S->U, S->noU

init = jnp.array([0.5, 0.5])

# Observations: U=0, noU=1
observations = [0, 0, 1]  # Umbrella, Umbrella, No umbrella

def viterbi(obs, init, trans, emit):
    n_states = len(init)
    T = len(obs)
    V = jnp.zeros((T, n_states))
    path = jnp.zeros((T, n_states), dtype=int)

    # Initialisation
    V = V.at[0].set(init * emit[:, obs[0]])

    # Recursion
    for t in range(1, T):
        for j in range(n_states):
            probs = V[t-1] * trans[:, j]
            V = V.at[t, j].set(jnp.max(probs) * emit[j, obs[t]])
            path = path.at[t, j].set(jnp.argmax(probs))

    # Backtrack
    best = [int(jnp.argmax(V[-1]))]
    for t in range(T-1, 0, -1):
        best.insert(0, int(path[t, best[0]]))
    return best, V

decoded, scores = viterbi(observations, init, trans, emit)
print("Observations:", [obs_names[o] for o in observations])
print("Decoded:     ", [states[s] for s in decoded])
```

1. 可视化随着观察到的硬币投掷次数增加，后验分布是如何演变的。从Beta(1,1)先验（均匀分布）开始，并在每次投掷后进行更新。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

theta = jnp.linspace(0.01, 0.99, 300)
key = jax.random.PRNGKey(7)

# True bias = 0.65
flips = jax.random.bernoulli(key, p=0.65, shape=(50,))

plt.figure(figsize=(10, 5))
a, b = 1, 1  # Beta(1,1) = uniform

for n_obs in [0, 1, 5, 10, 25, 50]:
    h = int(flips[:n_obs].sum())
    t = n_obs - h
    a_post = a + h
    b_post = b + t
    y = theta**(a_post-1) * (1-theta)**(b_post-1)
    y = y / jnp.trapezoid(y, theta)
    plt.plot(theta, y, linewidth=2, label=f"n={n_obs} (h={h})")

plt.axvline(0.65, color="black", linestyle=":", alpha=0.5, label="true p=0.65")
plt.xlabel("θ")
plt.ylabel("Density")
plt.title("Bayesian updating: posterior narrows with more data")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

## 信息论

_信息论量化了信息、惊喜以及概率分布之间的差异。本文涵盖了熵、交叉熵、KL散度、互信息和惊喜度——这些概念构成了所有分类损失函数、VAE目标函数以及机器学习中数据压缩方案的基础。_

- 信息论由克劳德·香农于1948年创立，为我们提供了量化信息的数学框架。它回答了诸如：某个事件应让你有多惊讶？一条消息携带了多少信息？两个概率分布有多不同？

- 这些问题听起来抽象，但它们却是机器学习损失函数、数据压缩和通信系统的基础。分类任务中最常用的交叉熵损失直接源自信息论。

- 从最简单的问题开始：单个事件携带多少信息？

- **惊喜度**（也称自信息）衡量一个事件的惊讶程度。如果某件事极有可能发生，你几乎学不到什么新信息；如果某事很少发生，你就能获得大量信息。

- 如果你住在沙漠中，有人告诉你今天是晴天，这并不具有太多信息量；如果他们说正在下雪，那就极具信息量。惊喜度将这种直觉形式化：

$$I(x) = \log_2 \frac{1}{p(x)} = -\log_2 p(x)$$

- 当我们使用$\log_2$时，单位为**比特**。一枚公平硬币的翻转带来的惊喜度为$-\log_2(0.5) = 1$比特；概率为$1/8$的事件带来的惊喜度为$\log_2(8) = 3$比特。

- 为什么用对数而不是简单的$1/p$？原因有三：
- 必然发生的事件（$p = 1$）应提供零信息：$\log(1) = 0$，而$1/1 = 1$。
- 独立事件的信息量应可相加：$\log(1/p_1 p_2) = \log(1/p_1) + \log(1/p_2)$。
- 我们希望得到一个平滑且性质良好的函数。$1/p$会急剧增大，而$\log(1/p)$则增长平缓。

- **熵**是期望惊喜度，即从某一分布中采样时每次事件所平均获得的信息量。它衡量了该分布的不确定性或“不可预测性”：

$$H(X) = E[I(X)] = -\sum_{x} p(x) \log_2 p(x)$$

![柱状图显示高概率事件的惊喜度低，反之亦然；熵是加权平均值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/surprisal_entropy.svg)

- 一枚公平硬币的熵为$H = -0.5\log_2(0.5) - 0.5\log_2(0.5) = 1$比特，代表最大不确定性。

- 一枚偏斜硬币，其中$p = 0.9$，其熵为$H = -0.9\log_2(0.9) - 0.1\log_2(0.1) \approx 0.469$比特。不确定性较低，因此熵也较小。

- 确定性事件（$p = 1$）的熵为$H = 0$，完全没有不确定性。

- 当所有结果出现的概率相等时，熵达到最大值。对于$n$个等概率的结果，有$H = \log_2 n$。一枚公平骰子的熵为$\log_2 6 \approx 2.585$比特。

- 熵的实际意义在于**压缩**。香农的源编码定理指出，若不丢失信息，就无法将数据的压缩率低于其熵率。每个像素取值概率均等的图像（熵最大）无法被压缩；而大部分为白色的图像（熵较低）则易于压缩。

- 为了有个直观的概念：一个灰度像素（256种取值）的最大熵为8比特。一张1080p的灰度图像最多包含$1920 \times 1080 \times 8 \approx 1660$万比特。真实图像的熵要低得多，因为相邻像素之间存在相关性，这正是JPEG压缩能起作用的原因。

- 对于连续随机变量，离散求和变为积分。**微分熵**定义为：

$$h(X) = -\int_{-\infty}^{\infty} f(x) \log f(x)\, dx$$

- 方差为$\sigma^2$的高斯分布的微分熵为$h = \frac{1}{2}\log_2(2\pi e \sigma^2)$。在方差相同的所有分布中，高斯分布具有最大的熵。这也是高斯分布在建模中如此常见的原因之一：它在给定均值和方差之外所做的假设最少。

- **互信息**衡量了解一个变量对另一个变量的了解程度。它是观察到$Y$后关于$X$的不确定性减少量：

$$I(X; Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)$$

- 等价地：

$$I(X; Y) = \sum_{x,y} p(x,y) \log_2 \frac{p(x,y)}{p(x) p(y)}$$

- 如果$X$和$Y$相互独立，则$p(x,y) = p(x)p(y)$，互信息为零；它们的相关性越强，互信息就越高。

- 在机器学习中，互信息用于特征选择（选取与目标变量互信息高的特征）、信息瓶颈方法以及评估聚类质量。

- **交叉熵**衡量的是用针对分布$q$优化的编码来编码分布$p$中的事件所需的平均比特数：

$$H(p, q) = -\sum_{x} p(x) \log_2 q(x)$$

- 如果$q$与$p$完全一致，交叉熵就等于熵：$H(p, p) = H(p)$。如果$q$的近似效果较差，交叉熵就会更大。“额外的”比特数源于这种不匹配。

- 这正是交叉熵成为机器学习中分类任务标准损失函数的原因。真实标签定义了$p$（一种独热分布），模型预测的概率则定义了$q$。最小化交叉熵会使$q$趋近于$p$：

$$\mathcal{L} = -\sum_{c} y_c \log \hat{y}_c$$

- 对于一个真实类别为$c$的单一样本，该式简化为$\mathcal{L} = -\log \hat{y}_c$。损失值就是模型预测下真实类别的惊喜度。如果模型给正确类别分配了较高概率，损失就较小。

- **KL散度**（库尔贝克-莱布勒散度，也称相对熵）衡量一个分布与另一个分布之间的差异：

$$D_{\text{KL}}(p \| q) = \sum_{x} p(x) \log \frac{p(x)}{q(x)} = H(p, q) - H(p)$$

- KL散度是使用分布$q$而非真实分布$p$所带来的“额外成本”。它始终非负（$D_{\text{KL}} \ge 0$），且仅当$p = q$时为零。

![两个分布$p$和$q$，它们之间的差距代表了KL散度](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/kl_divergence.svg)

- KL散度不具备对称性：$D_{\text{KL}}(p \| q) \ne D_{\text{KL}}(q \| p)$。这种不对称性很重要。$D_{\text{KL}}(p \| q)$会惩罚那些在$p$概率较高的区域赋予较低概率的$q$（因为$\log(p/q)$会趋于无穷大）。$D_{\text{KL}}(q \| p)$则惩罚相反的情况。

- 这种不对称性导致了两种近似方式：
- 最小化$D_{\text{KL}}(p \| q)$会产生**矩匹配**行为：$q$能够覆盖$p$的所有模式，但可能过于分散。
- 最小化$D_{\text{KL}}(q \| p)$会产生**模式搜索**行为：$q$会集中于$p$的某个模式上，但可能会忽略其他模式。变分推断正是采用这种方式。

- 由于$H(p)$相对于模型而言是常数，因此最小化交叉熵$H(p, q)$等价于最小化$D_{\text{KL}}(p \| q)$。这就是为什么我们可以使用交叉熵损失，并确信同时也在最小化真实分布与预测分布之间的KL散度。

- KL散度在**贝叶斯更新**中起着核心作用。后验分布$P(\theta | D)$是在KL散度意义上最接近先验分布$P(\theta)$且与观测数据一致的分布。每一次新的观测都会更新后验分布，从而降低对$\theta$的不确定性。

- 在变分自编码器（VAE）中，损失函数包含两项：重构损失（交叉熵）以及用于约束潜空间使其接近标准正态分布的KL散度项。

- 综上所述：熵反映了分布本身的内在不确定性，交叉熵衡量模型对现实的拟合程度，而KL散度则揭示了两者之间的差距。这三个量构成了现代机器学习优化的基石。

## 编程任务（请使用CoLab或笔记本）（续2）

1. 计算各种分布的熵，并验证在给定结果数量下均匀分布具有最大的熵。

```python
import jax.numpy as jnp

def entropy(p):
    """Compute entropy in bits. Filter out zero-probability events."""
    p = p[p > 0]
    return -jnp.sum(p * jnp.log2(p))

# Fair die
fair = jnp.ones(6) / 6
print(f"Fair die entropy:   {entropy(fair):.4f} bits (max = log2(6) = {jnp.log2(6.):.4f})")

# Loaded die
loaded = jnp.array([0.1, 0.1, 0.1, 0.1, 0.1, 0.5])
print(f"Loaded die entropy: {entropy(loaded):.4f} bits")

# Deterministic
det = jnp.array([0.0, 0.0, 0.0, 0.0, 0.0, 1.0])
print(f"Deterministic:      {entropy(det):.4f} bits")

# Fair coin
coin = jnp.array([0.5, 0.5])
print(f"Fair coin entropy:  {entropy(coin):.4f} bits")
```

1. 计算真实分布与几种近似分布之间的交叉熵和KL散度。验证$D_{\text{KL}}(p \| q) = H(p, q) - H(p)$。

```python
import jax.numpy as jnp

def cross_entropy(p, q):
    return -jnp.sum(p * jnp.log2(jnp.clip(q, 1e-10, 1.0)))

def kl_divergence(p, q):
    mask = p > 0
    return jnp.sum(jnp.where(mask, p * jnp.log2(p / jnp.clip(q, 1e-10, 1.0)), 0.0))

def entropy(p):
    p = p[p > 0]
    return -jnp.sum(p * jnp.log2(p))

p = jnp.array([0.4, 0.3, 0.2, 0.1])  # true distribution

for name, q in [("perfect match", p),
                ("slight mismatch", jnp.array([0.35, 0.30, 0.25, 0.10])),
                ("big mismatch", jnp.array([0.1, 0.1, 0.1, 0.7]))]:
    h_p = entropy(p)
    h_pq = cross_entropy(p, q)
    kl = kl_divergence(p, q)
    print(f"{name:20s}: H(p)={h_p:.4f}, H(p,q)={h_pq:.4f}, "
          f"KL={kl:.4f}, H(p,q)-H(p)={h_pq-h_p:.4f}")
```

1. 通过计算两个不同分布的$D_{\text{KL}}(p \| q)$和$D_{\text{KL}}(q \| p)$，来证明KL散度不具备对称性。

```python
import jax.numpy as jnp

def kl_div(p, q):
    mask = p > 0
    return float(jnp.sum(jnp.where(mask, p * jnp.log2(p / jnp.clip(q, 1e-10, 1.0)), 0.0)))

p = jnp.array([0.9, 0.1])
q = jnp.array([0.5, 0.5])

print(f"D_KL(p || q) = {kl_div(p, q):.4f}")
print(f"D_KL(q || p) = {kl_div(q, p):.4f}")
print(f"Not the same! KL divergence is asymmetric.")
```

1. 在训练过程中模拟交叉熵损失。创建一个“真实”的独热标签，并展示随着模型预测概率的提升，损失是如何减小的。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# True label: class 2 out of 4
true_label = jnp.array([0, 0, 1, 0])

# Simulate improving predictions
steps = []
losses = []
for confidence in jnp.linspace(0.25, 0.99, 50):
    # Model becomes more confident in class 2
    remaining = (1 - confidence) / 3
    pred = jnp.array([remaining, remaining, confidence, remaining])
    loss = -jnp.sum(true_label * jnp.log(jnp.clip(pred, 1e-10, 1.0)))
    steps.append(float(confidence))
    losses.append(float(loss))

plt.figure(figsize=(8, 4))
plt.plot(steps, losses, color="#e74c3c", linewidth=2)
plt.xlabel("Model confidence in true class")
plt.ylabel("Cross-entropy loss")
plt.title("Cross-entropy loss decreases as predictions improve")
plt.grid(alpha=0.3)
plt.show()
```

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
