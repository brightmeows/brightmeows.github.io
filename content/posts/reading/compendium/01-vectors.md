---
title: "向量"
date: "2026-11-05"
order: 1
slug: "compendium/01-vectors"
description: "向量空间是机器学习赖以存在的数学舞台。本文涵盖了向量加法、标量乘法、封闭性公理、子空间等内容，并解释了为何人工智能中的几乎所有内容都以向量形式表示。"
tags: []
---

## 向量空间

_向量空间是机器学习赖以存在的数学舞台。本文涵盖了向量加法、标量乘法、封闭性公理、子空间等内容，并解释了为何人工智能中的几乎所有内容都以向量形式表示。_

- 可以把向量空间想象成一种特殊的“游乐场”，其中存放着各种数学对象，每个对象被称为**向量**。

- 向量空间被正式定义为一组可以进行相加和缩放运算且结果仍属于该空间的向量集合。

- 一个有用的反例：整数集 $\mathbb{Z}$ 并非实数域上的向量空间，因为将 $3$ 乘以 $0.5$ 得到 $1.5$，它不在该集合中。定义中“不离开该空间”这一条件至关重要。

- 在机器学习的几何直观理解中，我们总是把向量视为欧几里得空间中的一个点，由其坐标来表示。

- 向量 $\mathbf{a}$（数学上用粗体小写字母表示）有 $n$ 个坐标，每个坐标代表沿某一轴的位置。

$$\mathbf{a} = [a_1, a_2, a_3]$$

![向量 $a = (3, 2, 4)$ 在三维空间中以 x、y、z 轴表示](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vector_3d.svg)

- 向量空间中的向量遵循一套非常具体且不可违背的规则：

- **向量加法（合并）**：

  你可以任意选取两个向量并将它们合并成一个新向量。
  可以把向量理解为运动指令。
  如果向量 A 表示“向前走 3 步”，向量 B 表示“向右走 2 步”，
  那么将它们相加（A + B）就会得到一条新的指令：“向前走 3 步，再向右走 2 步。”

- **标量乘法（缩放）**：

  你可以用一个普通的数（“标量”）来缩放任意向量。
  可以拉伸它、缩小它或反转它。
  如果向量 A 是“向前走 3 步”，将其缩放 2 倍后就变成“向前走 6 步”。
  将其缩放 $-1$ 倍则会完全反向，即“向后走 3 步”。

- 向量空间的**维数**是指其中包含的独立方向的数量。$\mathbb{R}^2$ 是二维的（需要 2 个坐标），而上面的向量 $\mathbf{a}$ 则位于 $\mathbb{R}^3$ 中。

- 例如，我们可以用向量来表示任何物体，比如一个人，其中 $h_1$ 表示身高（厘米），$h_2$ 表示体重（千克），$h_3$ 表示年龄。

$$\mathbf{h} = [185, 75, 30]$$

- 现在我们就创建了一个以表示人的向量为基础的向量空间。

- 我们可以表示多个人，并观察他们之间的相似程度或距离！

![三个人用向量表示：爱丽丝与卡罗尔很接近，爱丽丝与鲍勃相距较远](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/human_vectors.svg)

- 我们还可以添加更多特征，从而构建出丰富的人体表示，这在机器学习中常被称为特征向量。

- 特征越独特、越有意义，特征向量就越能准确描述对象，这一点值得牢记。

- 超过三维后，向量就难以直观地观察了，这催生了一门名为**线性代数**的数学分支。

- 线性代数是研究向量、向量空间以及向量之间映射的学科。

- 我们在人工智能/机器学习中几乎把所有事物都表示为向量，因此线性代数成了该领域的基石。

- 向量加法可以通过将一个向量的尾部与另一个向量的头部相连，再从原点画到终点来直观表示。

![向量加法：向量 a（红色）加向量 b（蓝色）得到结果向量 a + b（绿色虚线）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vector_addition.svg)

- 对于两个向量 $\mathbf{a} = (a_1, a_2)$ 和 $\mathbf{b} = (b_1, b_2)$，有：$\mathbf{a} + \mathbf{b} = (a_1 + b_1, a_2 + b_2)$

- 向量也可以相减，所有加法规则同样适用。

- 用标量乘以向量会按该比例在同一方向上缩放向量。

![标量乘法：向量 v（红色），2v（蓝色，放大一倍），-v（紫色，反向）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/scalar_multiplication.svg)

- 对于标量 $c$ 和向量 $\mathbf{v} = (v_1, v_2)$，有：$c\mathbf{v} = (cv_1, cv_2)$

- **加法封闭性**：如果将向量空间中的任意两个向量相加，结果仍是该空间中的向量：若 $\mathbf{u} \in V$ 且 $\mathbf{v} \in V$，则 $\mathbf{u} + \mathbf{v} \in V$

- **标量乘法封闭性**：如果将向量空间中的任意向量乘以一个标量，结果仍是该空间中的向量：若 $\mathbf{v} \in V$ 且 $c \in F$，则 $c\mathbf{v} \in V$

- **加法交换律**：对于任意两个向量 $\mathbf{u}$ 和 $\mathbf{v}$，有：$\mathbf{u} + \mathbf{v} = \mathbf{v} + \mathbf{u}$

![平行四边形法则：两条路径（先 u 后 v，或先 v 后 u）到达同一点](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/commutativity.svg)

- 通过平行四边形的两条路径都会到达同一点。

- **零向量**：存在一个向量 $\mathbf{0}$，使得对于任意向量 $\mathbf{v}$，都有：$\mathbf{v} + \mathbf{0} = \mathbf{v}$

![零向量：v + 0 = v](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/zero_vector.svg)

- **加法逆元**：对于每个向量 $\mathbf{v}$，都存在向量 $-\mathbf{v}$，使得：$\mathbf{v} + (-\mathbf{v}) = \mathbf{0}$

![加法逆元：向量 v（红色）与 -v（蓝色）相互抵消为零](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/additive_inverse.svg)

- **分配律 1**：对于任意标量 $c$ 和向量 $\mathbf{u}$、$\mathbf{v}$，有：$c(\mathbf{u} + \mathbf{v}) = c\mathbf{u} + c\mathbf{v}$

![分配律：对求和结果进行缩放（金色）等于先缩放各向量再求和](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/distributivity.svg)

- 对求和结果进行缩放（金色）与先缩放各向量再求和的结果相同。

- **分配律 2**：对于任意标量 $c$、$d$ 和向量 $\mathbf{v}$，有：$(c + d)\mathbf{v} = c\mathbf{v} + d\mathbf{v}$

- **结合律**：对于任意标量 $c$、$d$ 和向量 $\mathbf{v}$，有：$(cd)\mathbf{v} = c(d\mathbf{v})$

- **单位元**：对于任意向量 $\mathbf{v}$，有：$1\mathbf{v} = \mathbf{v}$，其中 $1$ 是标量域中的乘法单位元。

- 一些向量空间的例子：
- **$\mathbb{R}^n$（n维空间）**：指n维空间中的所有实数，例如向量[1,4,3000…第n个元素]。将两个点相加或对其中一个进行缩放后，结果仍会落在该空间中。

- **灰度图像**：一张$28 \times 28$的图像实际上由784个像素强度组成，即属于$\mathbb{R}^{784}$中的向量。将两幅图像相加（混合）或对其中一幅进行缩放（变亮）后，会得到另一幅大小相同的图像。

- **音频信号**：一段以44.1kHz采样率采集的1秒音频，可表示为包含44,100个元素的向量。将两段音频混合，本质上就是向量相加。

- **多项式**：将两个多项式相加或对其中一个乘以一个数后，得到的仍是多项式，因此它们也构成向量空间。向量并不一定非得表现为箭头形式！

- **子空间**只是更大空间中的一个较小区域。可以把三维空间想象成一个房间；穿过房间中心的一张平面纸是一个子空间，穿过中心的单根直线也是一个子空间。

- 关键要求是子空间必须经过原点。如果把那张纸移到偏离中心的位置，它就不再是子空间了，因为零向量不再位于其上。

![子空间：三维空间中经过原点的直线和平面](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/subspaces.svg)

- 向量空间中的所有规则（加法、缩放、封闭性）在子空间内同样适用。在子空间内对向量进行加法或缩放操作时，结果永远不会“超出”该子空间而进入更大的空间。

- 经过原点的直线是一维子空间，经过原点的平面是二维子空间，而整个空间本身也是自身的子空间。

- 在机器学习中，子空间自然存在。高维数据往往具有存在于低维子空间中的结构。像PCA这样的技术就能找到那个子空间，从而让我们更高效地处理数据。

## 编程任务（请使用CoLab或笔记本）

1. 运行代码以验证分配律，然后修改并尝试其他规则！

```python
import jax.numpy as jnp

u = jnp.array([1, 2])
v = jnp.array([3, 0])
c = 2

lhs = c * (u + v)
rhs = c*u + c*v

print(f"LHS: {lhs}")
print(f"RHS: {rhs}")
```

1. 运行代码以可视化不同的向量，然后修改各坐标的值，从而了解每个轴对位置的影响。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Try changing these vectors!
a = jnp.array([3, 2, 4])
b = jnp.array([1, 4, 2])
c = jnp.array([4, 1, 3])

fig = plt.figure()
ax = fig.add_subplot(111, projection="3d")

for vec, name, color in [(a, "a", "red"), (b, "b", "blue"), (c, "c", "green")]:
    ax.quiver(0, 0, 0, *vec, color=color, arrow_length_ratio=0.1, linewidth=2, label=name)

lim = int(jnp.abs(jnp.stack([a, b, c])).max()) + 1
ax.set_xlim([0, lim]); ax.set_ylim([0, lim]); ax.set_zlim([0, lim])
ax.set_xlabel("X"); ax.set_ylabel("Y"); ax.set_zlabel("Z")
ax.legend()
plt.show()
```

## 附加内容（需了解的一些数学符号）

| 符号 | 含义 | 示例 |
| --- || --- || --- ||
| ∈ | 属于 | x ∈ A：x属于集合A |
| ∉ | 不属于 | x ∉ A |
| ⊂ | 是真子集 | A ⊂ B |
| ⊆ | 是子集或相等 | A ⊆ B |
| ∪ | 并集 | A ∪ B：属于A或B的元素 |
| ∩ | 交集 | A ∩ B：同时属于A和B的元素 |
| ∅ | 空集 | A = ∅ |
| ℝ | 实数 | x ∈ ℝ |
| ℤ | 整数 | -2, -1, 0, 1, 2 |
| ℕ | 自然数 | 1, 2, 3, … |
| ℚ | 有理数 | 如1/2这样的分数 |
| ⇒ | 蕴含 | x > 2 ⇒ x > 1 |
| ⇔ | 当且仅当 | x = 2 ⇔ x² = 4，需满足额外条件 |
| ∀ | 对所有 | ∀x ∈ ℝ |
| ∃ | 存在 | ∃x使得x² = 4 |
| ¬ | 非 | ¬P：非P |
| ∧ | 且 | P ∧ Q |
| ∨ | 或 | P ∨ Q |
| ∴ | 因此 | x = 2，∴ x² = 4 |

## 向量属性

_向量属性描述了定义向量行为的几何与代数特征。本文档涵盖了向量的大小、方向、单位向量、相等性、平行性、正交性以及线性独立性，这些是构建所有机器学习特征空间的基础。_

- 向量的**大小**（或长度）表示它延伸的距离。可以将其想象成箭头的长短。对于向量 $\mathbf{a} = (a_1, a_2, a_3)$，其大小为：

$$\|\mathbf{a}\| = \sqrt{a_1^2 + a_2^2 + a_3^2}$$

- 这实际上是勾股定理在更高维度的扩展，用于衡量从原点到该点的直线距离。

- 向量的**方向**指明了它指向的位置；可以简单地将其理解为从原点到坐标点的直线。

- 当未明确指定原点时，我们通常默认其为 $(0,0,...0)$，即中心点，至少在进行可视化时是如此。

- 位置并不重要，关键只在于位移：从原点出发的向量 $(3, 2)$ 与从其他点出发的同一向量 $(3, 2)$ 仍然是相等的。

![向量相等：从两个不同起点画出的相同向量 $(3,2)$](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vector_equality.svg)

- 两个向量可能长度相同但方向完全不同，或者方向相同但长度不同。

![方向相同、大小不同（$v$ 和 $2v$）vs 大小相同、方向不同](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/magnitude_direction.svg)

- 当且仅当两个向量的所有对应分量都相等时，它们才**相等**；即长度相同、方向相同，完全等同于同一箭头。

$$\mathbf{a} = \mathbf{b} \iff a_i = b_i \text{ 对所有 } i \text{ 成立}$$

- 如果一个向量是另一个向量的标量倍数，则这两个向量**平行**。它们沿同一条直线排列，方向可以相同也可以相反。

$$\mathbf{a} \parallel \mathbf{b} \iff \mathbf{a} = k\mathbf{b} \text{，其中某个标量 } k \neq 0$$

![平行向量：$a$ 和 $b$ 方向相同，$a$ 和 $-b$ 方向相反](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/parallel_vectors.svg)

- 若 $k > 0$，则它们方向相同；若 $k < 0$，则它们方向相反。无论哪种情况，它们都位于通过原点的同一条直线上。

- 直观上讲，平行向量不携带“新的”方向信息。其中一个只是另一个的拉伸或翻转版本。

- 如果两个向量指向完全独立的方向，则它们**正交**（垂直）。沿着一个方向移动时，在另一个方向上不会有任何进展。

![正交向量：$u$ 和 $v$ 呈直角相交](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/orthogonal_vectors.svg)

- 可以想象向北走再向东走，这些就是正交方向；无论向北走多远都无法让你向东移动。我们在机器学习中会频繁遇到正交性。

- 正交性在机器学习中至关重要：正交的特征携带完全独立的信息，非常适合用于数据表示。

- 更一般地，任意两个向量之间都存在角度 $\theta$，范围从 $0°$ 到 $180°$。

- 这个角度反映了两个方向之间的全部关系：$0°$ 表示平行（方向相同），$180°$ 表示平行（方向相反），$90°$ 表示正交。介于其间的情况则是两者的混合。

- 机器学习中的大多数向量关系都落在这个范围内。稍后我们将看到计算该角度的具体工具（点积、余弦相似度）。

- 如果一组向量中至少有一个可以通过对其他向量进行缩放和相加来构造，那么这组向量就是**线性相关的**。它不会为集合带来新信息。

- 例如，若 $\mathbf{c} = 2\mathbf{a} + 3\mathbf{b}$，则 $\mathbf{c}$ 是多余的，因为通过 $\mathbf{a}$ 和 $\mathbf{b}$ 已经能获取 $\mathbf{c}$ 所包含的一切信息。

- 平行向量总是线性相关的，因为一个只是另一个的缩放副本。任何包含零向量的集合也是线性相关的。

- 如果一组向量中没有任何一个能由其他向量构造而成，则它们**线性无关**。每个向量都贡献了一个真正新的方向。正交向量总是线性无关的。

- 直观理解：如果你想研究不同的人并将其表示为向量，线性相关的向量（人）会使观测结果偏向于被过度采样的数据点，这是设计用于训练人工智能的数据集时的一个重要因素。

- 在二维空间中，两个线性无关的向量可以覆盖平面上的任意点；在三维空间中则需要三个。这种“需要多少个独立向量”的概念直接与维度相关。

- 当向量的大部分分量为零时，该向量被称为**稀疏向量**；反之，大部分分量非零则称为**稠密向量**。

$$\mathbf{s} = [0, 0, 3, 0, 0, 0, 1, 0, 0, 0]$$

- 稀疏性很重要，因为它会影响存储和计算效率。只需跟踪非零项，就能更高效地处理和存储稀疏向量。

- **单位向量**是指大小恰好为 1 的向量。它仅表示方向，不含长度信息。通过将任意向量除以其大小，可得到单位向量：

$$\hat{\mathbf{a}} = \frac{\mathbf{a}}{\|\mathbf{a}\|}$$

- 这一过程称为**归一化**。它去除了“距离”信息，仅保留“方向”信息，这在机器学习中是一个重要因素。

- 标准单位向量分别沿各坐标轴指向：$\hat{\mathbf{i}} = (1, 0, 0)$，$\hat{\mathbf{j}} = (0, 1, 0)$，$\hat{\mathbf{k}} = (0, 0, 1)$。任何向量都可以表示为它们的线性组合，例如 $(3, 2, 4) = 3\hat{\mathbf{i}} + 2\hat{\mathbf{j}} + 4\hat{\mathbf{k}}$。

## 编程任务（使用 CoLab 或笔记本）

1. 计算一个向量的大小，并验证其是否符合勾股定理；然后修改代码以计算单位向量。

```python
import jax.numpy as jnp

a = jnp.array([3.0, 4.0])

magnitude = jnp.sqrt(jnp.sum(a ** 2))
print(f"Magnitude of a: {magnitude}")
```

1. 通过检验一个向量是否为另一个向量的标量倍数，来判断两个向量是否平行。

```python
import jax.numpy as jnp

a = jnp.array([2, 4, 6])
b = jnp.array([1, 2, 3])

ratios = a / b
print(f"Ratios: {ratios}")
print(f"Parallel: {jnp.allclose(ratios, ratios[0])}")
```

## 度量与范数

_范数用于衡量向量的大小；度量则用于衡量两个向量之间的距离。本文介绍了L1、L2和L-无穷范数，以及欧几里得距离和余弦距离，并解释了为何在机器学习中的kNN、聚类和检索任务中选择正确的距离函数至关重要。_

- 我们知道向量具有大小和方向。但究竟如何衡量单个向量的“大小”，或两个向量之间的“距离”呢？这就是**范数**和**度量**的作用。

- 对于标量而言，我们知道10 > 5，因为它们的数值可以量化比较；但如何量化一个向量呢？这就是**范数**，它用于衡量单个向量的大小。

- 最常见的范数是**欧几里得范数**（L2），也就是我们熟知的向量大小公式：

$$\|\mathbf{v}\|_2 = \sqrt{v_1^2 + v_2^2 + \cdots + v_n^2}$$

- 不过还有其他衡量大小的方式。想象你身处一个有网格状街道的城市，你不能穿墙斜着走，因此你的行程“长度”就是沿各条街道行走的街区总数。这就是**曼哈顿范数**（L1）：

$$\|\mathbf{v}\|_1 = |v_1| + |v_2| + \cdots + |v_n|$$

- 或者你可能只关心最大的那个分量，而忽略其余部分。这就是**最大范数**（L-无穷）：

$$\|\mathbf{v}\|_\infty = \max(|v_1|, |v_2|, \ldots, |v_n|)$$

- 这三种范数都是**广义Lp范数**的特殊情况：

$$\|\mathbf{v}\|_p = (|v_1|^p + |v_2|^p + \cdots + |v_n|^p)^{1/p}$$

- 当$p = 2$时得到欧几里得范数，$p = 1$时得到曼哈顿范数；当$p \to \infty$时则得到最大范数。随着$p$的增大，最大的分量所占比重越来越大，最终只有它起决定作用。

- 所有范数都必须遵循三条规则：

- **非负性**：$\|\mathbf{v}\| \geq 0$，且只有当$\mathbf{v} = \mathbf{0}$时才有$\|\mathbf{v}\| = 0$。大小绝不会为负，只有零向量的大小为零。

- **齐次性**： $\|c\mathbf{v}\| = |c| \cdot \|\mathbf{v}\|$。将向量缩放两倍，其大小也会相应变为两倍。

- **三角不等式**：$\|\mathbf{u} + \mathbf{v}\| \leq \|\mathbf{u}\| + \|\mathbf{v}\|$。走捷径的距离绝不会超过绕远路的距离。

- 现在，**度量**用于衡量两个向量之间的距离。可以把它理解为询问：“这两点相距多远？”

- 获得度量的最简单方式是对差值应用范数：$d(\mathbf{u}, \mathbf{v}) = \|\mathbf{u} - \mathbf{v}\|$。先求出两个向量的差，再衡量该差的大小。

- 使用欧几里得范数可得到熟悉的**欧几里得距离**：

$$d(\mathbf{u}, \mathbf{v}) = \sqrt{(u_1 - v_1)^2 + (u_2 - v_2)^2 + \cdots + (u_n - v_n)^2}$$

- 使用曼哈顿范数则得到**曼哈顿距离**，即各轴上差异的绝对值之和，类似于计算两个地点之间的街区数。

- 所有度量都必须遵循四条规则：

- **非负性**：$d(\mathbf{u}, \mathbf{v}) \geq 0$。距离绝不会为负。

- **同一性**：当且仅当$\mathbf{u} = \mathbf{v}$时，才有$d(\mathbf{u}, \mathbf{v}) = 0$。距离为零意味着两点重合。

- **对称性**：$d(\mathbf{u}, \mathbf{v}) = d(\mathbf{v}, \mathbf{u})$。从A到B的距离与从B到A的距离相同。

- **三角不等式**：$d(\mathbf{u}, \mathbf{w}) \leq d(\mathbf{u}, \mathbf{v}) + d(\mathbf{v}, \mathbf{w})$。直接路径的长度绝不会超过绕行路径的长度。

- 那么两者之间的关系是什么呢？范数用于衡量单个向量，度量用于衡量两个向量之间的差距。每个范数都能自然生成一个度量（通过测量差值），但并非所有度量都源自范数。

- 例如，**汉明距离**用于统计两个向量在不同位置上取值不同的个数。它是一种有效的度量，但并不来源于任何范数。

- 在机器学习中，选择合适的范数或度量至关重要。

- L2距离在求和前会对每个差值进行平方处理，因此单个较大的差值会对结果产生主导影响。

- L1距离则对绝对差值求和，各差值被平等对待。与L2相比，单个较大差值的影响较小。

## 编程任务（请使用CoLab或笔记本）（续1）

1. 计算同一个向量的L1范数和L2范数。尝试改变向量中的数值，观察哪种范数对较大的分量更敏感，对多个小分量又如何反应。接着尝试计算不同$p$值下的Lp范数（如1、2、5、10、50、100），观察它如何趋近于L-无穷范数的值。

```python
import jax.numpy as jnp

v = jnp.array([3.0, -4.0, 1.0])

l1 = jnp.sum(jnp.abs(v))
l2 = jnp.sqrt(jnp.sum(v ** 2))

print(f"L1: {l1}, L2: {l2:.2f}")
```

1. 计算两个向量之间的欧几里得距离和曼哈顿距离。试着将向量移近或远离，观察每种距离的不同变化。

```python
import jax.numpy as jnp

u = jnp.array([1.0, 2.0, 3.0])
v = jnp.array([4.0, 0.0, 1.0])

euclidean = jnp.sqrt(jnp.sum((u - v) ** 2))
manhattan = jnp.sum(jnp.abs(u - v))

print(f"Euclidean: {euclidean:.2f}, Manhattan: {manhattan}")
```

## 向量积

_向量积是用于衡量相似度以及计算投影的基本运算。本文件介绍了内积、点积、余弦相似度、叉积以及外积，这些运算在人工智能中的注意力机制、嵌入模型以及几何推理中发挥着重要作用。_

- 我们已经了解了如何对向量进行加法和缩放操作。那么，能否将两个向量相乘呢？实际上，实现向量相乘的方法不止一种，每种方法适用于不同的场景。

- **内积**是一种通用的概念：它是一个能够接收两个向量并输出一个数值（标量）的函数。可以说，它是“向量相乘”的抽象表示形式。

- 任何内积都必须满足以下三个规则：

- **正定性**：$\langle \mathbf{v}, \mathbf{v} \rangle \geq 0$，且仅当向量为零向量时该值才为0。将一个向量与自身相乘的结果始终是非负数。

- **对称性**：$\langle \mathbf{u}, \mathbf{v} \rangle = \langle \mathbf{v}, \mathbf{u} \rangle$。向量的顺序不影响结果。

- **线性性**：$\langle a\mathbf{u} + b\mathbf{v}, \mathbf{w} \rangle = a\langle \mathbf{u}, \mathbf{w} \rangle + b\langle \mathbf{v}, \mathbf{w} \rangle$。内积具有结合律，即对加法和数乘运算满足分配律。

- **点积**是最常见的内积形式，也是我们在几乎所有场景中都会用到的具体实现方式。对于两个向量$\mathbf{a} = (a_1, a_2, \ldots, a_n)$和$\mathbf{b} = (b_1, b_2, \ldots, b_n)$，其计算公式为：

$$\mathbf{a} \cdot \mathbf{b} = a_1 b_1 + a_2 b_2 + \cdots + a_n b_n$$

- 只需将对应分量相乘，再将所有结果相加即可。

- 那么，这个数值究竟代表什么意义呢？点积其实有着优美的几何意义：

$$\mathbf{a} \cdot \mathbf{b} = \|\mathbf{a}\| \, \|\mathbf{b}\| \cos(\theta)$$

![点积示意图：向量a投影到向量b上，夹角为θ，图中显示了投影结果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/dot_product.svg)

- 这个公式将点积与两个向量之间的夹角$\theta$直接联系起来。该数值反映了两个向量在方向上的相似程度。

- 如果两个向量指向同一方向（$\theta = 0°$），则$\cos(\theta) = 1$，此时点积取得最大值。

- 如果两个向量相互垂直（$\theta = 90°$），则$\cos(\theta) = 0$，点积恰好为零。这一特性为我们提供了判断向量是否垂直的精确方法。

- 如果两个向量指向相反方向（$\theta = 180°$），则$\cos(\theta) = -1$，点积为负值。

- 一个向量与自身相点积的结果是其模长的平方：$\mathbf{a} \cdot \mathbf{a} = \|\mathbf{a}\|^2$。

- 点积还可以用来计算**投影**，即一个向量在另一个向量方向上的投影。向量$\mathbf{a}$在向量$\mathbf{b}$方向上的投影为：

$$\text{proj}_{\mathbf{b}}(\mathbf{a}) = \frac{\mathbf{a} \cdot \mathbf{b}}{\|\mathbf{b}\|^2} \, \mathbf{b}$$

- 可以把点积想象成将光线垂直照射到向量$\mathbf{b}$上，此时向量$\mathbf{a}$在该直线上的投影就是其投影值。该值反映了向量$\mathbf{a}$中有多少部分位于向量$\mathbf{b}$的方向上。

- **余弦相似度**则是通过同时除以两个向量的模长来对点积进行标准化处理：

$$\cos(\theta) = \frac{\mathbf{a} \cdot \mathbf{b}}{\|\mathbf{a}\| \, \|\mathbf{b}\|}$$

- 该值的范围在$-1$到$1$之间，用于衡量两个向量在方向上的对齐程度，而不受向量长度的影响。在机器学习中，它被广泛用于比较文档、嵌入向量以及用户偏好等信息。

- 点积的作用是将两个向量转换为一个标量值，而**叉积**则恰恰相反，它将两个向量转换为一个新的向量。

- 叉积$\mathbf{a} \times \mathbf{b}$的结果是一个同时垂直于向量$\mathbf{a}$和向量$\mathbf{b}$的向量，其计算公式为：

$$\mathbf{a} \times \mathbf{b} = (a_2 b_3 - a_3 b_2, \; a_3 b_1 - a_1 b_3, \; a_1 b_2 - a_2 b_1)$$

- 叉积仅适用于三维空间。虽然点积可以在任意维度下使用，但叉积是专门为三维空间设计的。

- 叉积的模长等于由这两个向量所构成的平行四边形的面积：

$$\|\mathbf{a} \times \mathbf{b}\| = \|\mathbf{a}\| \, \|\mathbf{b}\| \sin(\theta)$$

- 可以发现规律：点积中使用的是$\cos(\theta)$，而叉积中使用的是$\sin(\theta)$。点积衡量的是两个向量在方向上的对齐程度，而叉积则衡量的是它们在方向上的差异程度。

- 叉积结果的方向遵循**右手定则**：用右手的四指从向量$\mathbf{a}$指向向量$\mathbf{b}$，此时大拇指所指的方向就是向量$\mathbf{a} \times \mathbf{b}$的方向。

- 与点积不同，叉积**不满足交换律**：$\mathbf{a} \times \mathbf{b} = -(\mathbf{b} \times \mathbf{a})$。交换向量的顺序会导致结果方向改变。

- 如果两个向量平行，那么它们的叉积为零向量（因为$\sin(0°) = 0$）。此时不存在平行四边形，也就没有垂直方向。

- 那么，如果同时使用这两种运算来处理三个向量会怎样呢？这就引出了**三重积**的概念。

- **标量三重积**$\mathbf{a} \cdot (\mathbf{b} \times \mathbf{c})$首先计算两个向量的叉积，然后将得到的结果与第三个向量点积。最终得到的数值相当于由这三个向量所构成的平行六面体（一种斜向的三维盒子）的体积。

- 如果标量三重积的值为零，说明这三个向量**共面**，它们都位于同一个平面上，因此不会形成任何体积。

- 三重积的运算顺序可以互换，而结果不变：$\mathbf{a} \cdot (\mathbf{b} \times \mathbf{c}) = \mathbf{b} \cdot (\mathbf{c} \times \mathbf{a}) = \mathbf{c} \cdot (\mathbf{a} \times \mathbf{b})$。

- **向量三重积**$\mathbf{a} \times (\mathbf{b} \times \mathbf{c})$则是两次应用叉积运算，最终得到一个向量。利用以下恒等式，我们可以简化其表达式：

$$\mathbf{a} \times (\mathbf{b} \times \mathbf{c}) = (\mathbf{a} \cdot \mathbf{c})\mathbf{b} - (\mathbf{a} \cdot \mathbf{b})\mathbf{c}$$

- 计算结果始终位于由$\mathbf{b}$和$\mathbf{c}$所张成的平面内。需要注意的是，向量叉积**不满足结合律**：$\mathbf{a} \times (\mathbf{b} \times \mathbf{c}) \neq (\mathbf{a} \times \mathbf{b}) \times \mathbf{c}$。

## 编程任务（可使用CoLab或笔记本）

1. 计算两个向量的点积，并利用该值来确定它们之间的夹角。尝试让这两个向量互相垂直、平行或反向，观察夹角的变化情况。

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, -1.0, 2.0])

dot = jnp.dot(a, b)
angle = jnp.arccos(dot / (jnp.linalg.norm(a) * jnp.linalg.norm(b)))

print(f"Dot product: {dot}")
print(f"Angle: {jnp.degrees(angle):.1f}°")
```

1. 计算两个三维向量的叉积，然后通过检查该叉积与每个原始向量的点积是否为零，来确认其确实与这两个向量都垂直。

```python
import jax.numpy as jnp

a = jnp.array([1.0, 0.0, 0.0])
b = jnp.array([0.0, 1.0, 0.0])

cross = jnp.cross(a, b)

print(f"a x b = {cross}")
print(f"Perpendicular to a: {jnp.dot(cross, a) == 0}")
print(f"Perpendicular to b: {jnp.dot(cross, b) == 0}")
```

## 基与对偶

_基决定了向量空间的坐标系，而对偶则揭示了线性函数如何作用于向量。本文件涵盖了线性无关性、生成集、基的变换、对偶空间以及协向量等概念，这些也是机器学习中PCA、特征变换和注意力机制背后的理论基础。_

- 我们已经知道向量存在于具有特定维数的空间中。但究竟是什么定义了这些维度呢？这就是**基向量**的作用所在。

- **基**是一组向量，通过缩放和相加（线性组合）可以生成空间中的所有其他向量，且不存在冗余元素。它们构成了该空间的基本构成单元。

- 一个基必须满足两个条件：

- **线性无关**：没有任何一个基向量可以由其他向量表示出来。每个基向量都代表着一个全新的方向。

- **生成性**：空间中的每一个向量都可以表示为这些基向量的组合，没有遗漏任何向量。

- 基中所包含的向量数量等于该空间的**维数**。在$\mathbb{R}^2$中需要2个向量，在$\mathbb{R}^3$中需要3个向量，以此类推。

- 最自然的基就是**标准基**，即沿各轴方向的单位向量：

- 在$\mathbb{R}^2$中：$\hat{\mathbf{i}} = (1, 0)$，$\hat{\mathbf{j}} = (0, 1)$
- 在$\mathbb{R}^3$中：$\hat{\mathbf{i}} = (1, 0, 0)$，$\hat{\mathbf{j}} = (0, 1, 0)$，$\hat{\mathbf{k}} = (0, 0, 1)$

- 任何一个向量都可以表示为这些基向量的加权之和。向量$(3, 2)$实际上就是$3\hat{\mathbf{i}} + 2\hat{\mathbf{j}}$。这里的权重3和2就是该向量在该基下的**坐标**。

- 不过，标准基并非唯一的有效基。在$\mathbb{R}^2$中，向量$(1, 1)$和$(-1, 1)$也构成一个基。它们是线性无关的，能够表示平面上的任意一点。只是在这个新的基下，同一个向量的坐标会有所不同而已。

- **基的变换**是指用不同的基来重新表示同一个向量。向量本身并没有移动，我们只是从不同的视角来描述它。

- 这是通过乘以一个**基变换矩阵**$P$来实现的，该矩阵的列就是用旧坐标表示的新基向量。若要换回原来的表示方式，则需乘以$P^{-1}$。

- 可以把这种情况想象成两个朋友在为同一家咖啡馆指路。你按照街道方向导航：$(3, 2)$的意思是“向东走3个街区，再向北走2个街区”。而你的朋友则按照对角线方向导航：他们的方向向量分别是$\mathbf{b}_1 = (1, 1)$（东北方向）和$\mathbf{b}_2 = (-1, 1)$（西北方向），也就是之前提到的新基。同样的咖啡馆，只是用了两种不同的方式来描述如何到达那里。

- 你的朋友说咖啡馆位于$(2.5, -0.5)$：“沿着我的东北对角线走2.5步，然后再沿着我的西北对角线倒退0.5步”。要将其转换成你熟悉的街道坐标，只需按照他的方法计算：

$$2.5 \begin{bmatrix} 1 \\ 1 \end{bmatrix} - 0.5 \begin{bmatrix} -1 \\ 1 \end{bmatrix} = \begin{bmatrix} 3 \\ 2 \end{bmatrix}$$

- 这其实就是你之前用的$(3, 2)$坐标！

- 那个“按照公式计算”的步骤，其实就是乘以$P$的操作。把朋友给出的基向量作为矩阵的列，然后乘以一个包含其坐标的向量，就会得到第一个分量取2.5倍，第二个分量取-0.5倍，这其实就是那个公式的简洁表达形式：

$$P = \begin{bmatrix} 1 & -1 \\ 1 & 1 \end{bmatrix}, \qquad P \begin{bmatrix} 2.5 \\ -0.5 \end{bmatrix} = \begin{bmatrix} 3 \\ 2 \end{bmatrix}$$

- 反之，要将你的$(3, 2)$坐标转换成朋友使用的坐标，就需要“撤销”这个操作，而$P^{-1}$的作用正是实现这一点：

$$P^{-1} \begin{bmatrix} 3 \\ 2 \end{bmatrix} = \begin{bmatrix} 2.5 \\ -0.5 \end{bmatrix}$$

- 实际上向量并没有移动。$(3, 2)$和$(2.5, -0.5)$只是对同一点的不同描述方式，而$P$则起到了在两者之间进行转换的“词典”作用。

- 在机器学习中，基的变换非常常见。例如，PCA就会寻找一个新的基（即主成分），使得数据更易于理解，因为此时坐标轴会与变化最大的方向对齐。

- 接下来的那些概念比较抽象，目前可能较难理解，不过在后续章节中我们会实际应用这些概念，到时候就会明白其意义了，敬请耐心等待。

- 其实这里还隐藏着一个更深层的原理。当我们写出$\mathbf{v} = (3, 2)$时，3和2这两个坐标实际上就是沿着各个基方向对$\mathbf{v}$进行“测量”后得到的结果。第一个坐标表示“$\mathbf{v}$中包含多少$\hat{\mathbf{i}}$的成分？”，第二个坐标则表示“包含多少$\hat{\mathbf{j}}$的成分？”。

- 在咖啡馆的例子中，这些测量其实就是朋友提出的问题：“你沿着我的东北对角线走了多远？”以及“沿着我的西北对角线走了多远？”。每个基都对应着一组这样的问题，每个方向一个问题。

- 每一个问题都是一种**线性泛函**：即一种输入一个向量并返回一个数值的函数，这个数值就是测量结果。

- “线性”这个词的意思是，这种泛函遵循向量空间中的两种运算规则。如果对多个向量求和，那么测量结果也会相应求和；如果将某个向量放大，其测量结果也会随之放大：

$$f(\mathbf{u} + \mathbf{v}) = f(\mathbf{u}) + f(\mathbf{v}), \qquad f(c\mathbf{v}) = c\,f(\mathbf{v})$$

- 换句话说，线性泛函就像“诚实的尺子”。向量是待测量的对象，线性泛函则是用来测量它们的工具，而所有可能的线性泛函则构成了**对偶空间**$V^\ast$。

- 对于每一个基$\{\mathbf{e}_1, \mathbf{e}_2, \ldots, \mathbf{e}_n\}$，都存在一组与之对应的“尺子”，即**对偶基**$\{\mathbf{e}_1^\ast, \mathbf{e}_2^\ast, \ldots, \mathbf{e}_n^\ast\}$。其中，$\mathbf{e}_i^\ast$的作用就是回答一个问题：“$\mathbf{e}_i$的成分有多少？”。一个经过正确校准的“尺子”，在测量自身的基向量时会给出1的值，而完全忽略其他向量。这一概念可以用**克罗内克德尔塔符号**$\delta_{ij}$来简洁地表示：

$$
\mathbf{e}_i^\ast(\mathbf{e}_j) = \delta_{ij} = \begin{cases} 1 & \text{if } i = j \\ 0 & \text{if } i \neq j \end{cases}

$$

- 那条小小的校准规则就是尺子所需要的一切，因为线性性质会处理其余部分。观察$\mathbf{e}_1^\ast$如何读取向量$\mathbf{v} = 3\mathbf{e}_1 + 2\mathbf{e}_2$的第一个坐标：

$$\mathbf{e}_1^\ast(3\mathbf{e}_1 + 2\mathbf{e}_2) = 3\,\mathbf{e}_1^\ast(\mathbf{e}_1) + 2\,\mathbf{e}_1^\ast(\mathbf{e}_2) = 3 \cdot 1 + 2 \cdot 0 = 3$$

- 这把“尺子”会忽略除自身方向之外的所有方向，然后给出对应的坐标值。这些坐标值其实就是对偶基的读数。

- 那么，具体来说，这样的“尺子”长什么样呢？在$\mathbb{R}^n$中，每一个线性泛函其实都只是一行数字，通过点积来运用。而对于我们已经构建好的基，其实早已有了这样的“尺子”：将$(3, 2)$转换成该基下的坐标，只需乘以$P^{-1}$，而$P^{-1}$的每一行就对应一个坐标值。**$P^{-1}$的各行就是对偶基**：

$$P^{-1} = \frac{1}{2}\begin{bmatrix} 1 & 1 \\ -1 & 1 \end{bmatrix} \quad\Rightarrow\quad \mathbf{b}_1^\ast = (0.5,\ 0.5), \qquad \mathbf{b}_2^\ast = (-0.5,\ 0.5)$$

- 用这个结果来验证一下：$\mathbf{b}_1^\ast \cdot (3, 2) = 0.5 \cdot 3 + 0.5 \cdot 2 = 2.5$，这正好就是该基下的第一个坐标值。这里的关键思想是：基的变换会改变构成元素，而对偶基则是一组用于读取新坐标的“尺子”。

- 那条校准规则其实也显而易见：$P^{-1}P = I$这一式子表明，对于某个基向量$i$，尺子$i$的读数是1，而对于其他基向量则读数为0。单位矩阵实际上就是以表格形式呈现的克罗内克德尔塔函数。

- 需要注意的是：人们很容易误以为$\mathbf{b}_1$对应的“尺子”就是$\mathbf{b}_1$本身，也就是直接用$(1, 1)$与向量做点积。但实际上$(1, 1) \cdot (3, 2) = 5$，这是真实坐标2.5的两倍。只有当基是**正交归一**的（即各向量互相垂直且长度均为1，比如标准基）时，用基向量与向量做点积才能得到该向量的坐标值。这也是为什么$\mathbf{e}_1^\ast$看起来与$\mathbf{e}_1$相同的缘故。对于其他任何基，这样的“尺子”都存在于$P^{-1}$的各行中。

- 这也解释了点积的双重作用。每一个向量$\mathbf{u}$实际上都定义了一种“尺子”（通过计算$\mathbf{u} \cdot \mathbf{v}$来测量向量$\mathbf{v}$），而每一个“尺子”其实都是某个向量与另一个向量的点积。在有限维空间中，对偶空间本质上就是原空间的镜像。

- 虽然对偶概念现在看来可能比较抽象，但它实际上支撑着许多实际应用：坐标值就是对偶基的评估结果，点积则是对偶配对的一种体现；而在神经网络中的注意力机制之类的变换，也是通过让一组向量“查询”另一组向量来实现的，这其实就是对偶原理的体现。

## 编程任务（可使用CoLab或笔记本完成）

1. 将一个向量用两种不同的基表示出来，然后验证它们表示的是同一个点。试着自己创建一个基，看看该向量在这个基下的坐标是多少。

```python
import jax.numpy as jnp

v = jnp.array([3.0, 2.0])

# Standard basis: coordinates are just the components
print(f"Standard basis coords: {v}")

# New basis: (1,1) and (-1,1)
P = jnp.array([[1.0, -1.0],
               [1.0,  1.0]])
new_coords = jnp.linalg.solve(P, v)
print(f"New basis coords: {new_coords}")

# Verify: reconstruct from new coords
reconstructed = new_coords[0] * P[:, 0] + new_coords[1] * P[:, 1]
print(f"Reconstructed: {reconstructed}")
```

1. 根据任务1中的结果，为该基构造对偶基（即P⁻¹的各行），并确认每个坐标值确实只出现一次。进而理解为何只有正交标准基才能与基向量进行点积运算。

```python
import jax.numpy as jnp

v = jnp.array([3.0, 2.0])

# The friend's basis (1,1) and (-1,1), stacked as columns
P = jnp.array([[1.0, -1.0],
               [1.0,  1.0]])

# The dual basis: the rows of P^{-1}
P_inv = jnp.linalg.inv(P)
b1_star, b2_star = P_inv[0], P_inv[1]
print(f"b1* = {b1_star}, b2* = {b2_star}")

# Each ruler reads one coordinate in the friend's basis (matches task 1!)
print(f"b1*(v) = {jnp.dot(b1_star, v)}")  # 2.5
print(f"b2*(v) = {jnp.dot(b2_star, v)}")  # -0.5

# Calibration: 1 on its own basis vector, 0 on the other
print(f"b1*(b1) = {jnp.dot(b1_star, P[:, 0])}, b1*(b2) = {jnp.dot(b1_star, P[:, 1])}")

# The trap: dotting with b1 itself does NOT give the coordinate
print(f"b1 . v = {jnp.dot(P[:, 0], v)}  (5.0, not 2.5 -- b1 is not orthonormal)")

# The standard basis IS orthonormal, so there the shortcut works
e1 = jnp.array([1.0, 0.0])
print(f"e1 . v = {jnp.dot(e1, v)}  (3.0, the first standard coordinate)")
```

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
