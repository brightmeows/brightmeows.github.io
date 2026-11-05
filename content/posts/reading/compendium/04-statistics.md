---
title: "统计学"
date: "2026-11-05"
order: 4
slug: "compendium/04-statistics"
description: "统计学为描述数据以及量化不确定性提供了工具。本文件涵盖了分布、随机变量、概率质量函数、概率密度函数、累积分布函数、期望值、方差、矩以及中心极限定理——这些概念是所有机器学习评估指标和损失函数的基础。"
tags: []
---

## 统计学基础

_统计学为描述数据以及量化不确定性提供了工具。本文件涵盖了分布、随机变量、概率质量函数、概率密度函数、累积分布函数、期望值、方差、矩以及中心极限定理——这些概念是所有机器学习评估指标和损失函数的基础。_

- 统计学是一门从数据中学习的科学。我们收集观测数据，对其进行分析总结，从而得出结论，而这些结论往往涉及那些无法直接测量的事物。

- 假设你想知道一个国家内所有成年人的平均身高。由于无法测量所有人，因此我们会选取样本，并利用统计学方法来对整个群体的身高进行估算。

- 统计学主要分为两个分支：
- **描述性统计**：用于总结已有的数据（如平均值、图表、表格等）；
- **推断性统计**：利用样本来对更大的群体做出推断。

- 统计学的核心概念是“分布”，它描述了数据值的分布情况。其他一切概念，如平均值、检验结果、预测值等，都建立在对分布的理解之上。

- **频率分布**用于统计数据中每个数值（或数值范围）出现的次数。例如，可以将考试成绩分组，然后统计每组中有多少名学生属于该组，最终得到的就是直方图。

- **概率分布**则用概率来代替具体的计数结果。与其说“有12名学生的成绩在70到80分之间”，不如说“成绩在70到80分之间的概率为0.24”。当数据为连续型时，直方图的柱状图会变成平滑曲线。

![频率分布以直方图形式呈现，而概率分布则以平滑曲线形式呈现](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/distribution_types.svg)

- 左侧的直方图是根据实际收集的数据绘制的，而右侧的平滑曲线则是用来描述数据背后规律的数学模型。前者属于经验性描述，后者则是理论性描述。

- 为了对分布进行数学处理，我们需要一种方式为各种结果分配数值，而这正是**随机变量**的作用。

- 随机变量是一种函数，它将实验中的每种结果映射为一个实数。例如，抛硬币时，结果可能是“正面”或“反面”，而随机变量$X$则将这些结果转换为$X(\text{正面}) = 1$，$X(\text{反面}) = 0$。这样我们就可以进行数学运算了。

![随机变量将实验结果映射到数轴上](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/random_variable.svg)

- **离散型随机变量**的取值是可数的，比如10次抛硬币中正面的次数、骰子掷出的点数、一小时内收到的邮件数量等。

- **连续型随机变量**则可以在某个区间内取任意值，比如一个人的确切身高、下一班公交车到达的时间、中午时的温度等。

- 这种区别很重要，因为它决定了我们计算概率的方式。对于离散型变量，我们使用求和；而对于连续型变量，则需要使用积分（可回顾第3章的内容）。

- 对于离散型随机变量，**概率质量函数**可以给出每个特定值的概率：

$$P(X = x) = p(x), \quad \text{其中 } \sum_{x} p(x) = 1$$

- 对于连续型随机变量，**概率密度函数**则可以给出落在某个区间内的概率。任何单个精确值的概率均为零，只有区间才具有正概率：

$$P(a \le X \le b) = \int_a^b f(x)\, dx, \quad \text{其中 } \int_{-\infty}^{\infty} f(x)\, dx = 1$$

- 现在我们已经可以为各种结果分配数值，那么最自然的问题就是：这些结果的平均值是多少？

- **期望值**就是所有可能值的加权平均值，权重即为相应的概率。可以将其视为分布的“重心”。

- 如果多次掷一个公平的骰子，其平均点数会逐渐接近3.5。这就是期望值，尽管实际上不可能得到3.5这个点数。

- 对于离散型随机变量：

$$E[X] = \sum_{x} x \cdot p(x)$$

- 对于连续型随机变量（使用第3章中的积分公式）：

$$E[X] = \int_{-\infty}^{\infty} x \cdot f(x)\, dx$$

- 举例：一个公平的六面骰子，当$x = 1, 2, 3, 4, 5, 6$时，$p(x) = 1/6$。

$$E[X] = 1 \cdot \tfrac{1}{6} + 2 \cdot \tfrac{1}{6} + 3 \cdot \tfrac{1}{6} + 4 \cdot \tfrac{1}{6} + 5 \cdot \tfrac{1}{6} + 6 \cdot \tfrac{1}{6} = \frac{21}{6} = 3.5$$

- 期望值具有线性性质，即$E[aX + b] = aE[X] + b$。这一性质非常有用，且在机器学习的损失函数中经常出现。

- 期望值能告诉我们数据的中心位置，但无法说明数据的离散程度。要完整描述一个分布的形态，还需要了解**矩**的概念。

- 矩是指$X$的某次幂的期望值。第$k$个**原始矩**为：

$$\mu_k' = E[X^k]$$

- 第一个原始矩（$k = 1$）其实就是均值：$\mu_1' = E[X] = \mu$。

- 原始矩是以0为基准的。通常我们更关心数据与均值的偏差，因此引入了**中心矩**的概念：

$$\mu_k = E[(X - \mu)^k]$$

- 第一个中心矩始终为0（因为高于均值和低于均值的偏差会相互抵消）。第二个中心矩就是**方差**。

- 为了比较不同尺度下的分布，我们可以通过除以标准差$\sigma$的适当次方来进行**标准化**处理：

$$\tilde{\mu}_k = \frac{\mu_k}{\sigma^k}$$

- 每个矩都反映了分布形态的不同特征：

![钟形曲线，标注出各矩所代表的含义：均值（中心）、方差（离散程度）、偏度（不对称性）、峰度（尾部重量）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/moments_shape.svg)

- **第一矩（均值）**：表示分布的中心位置，也就是平衡点。
- **第二矩（方差）**：表示数据围绕均值的离散程度。方差越大，数据的离散程度越高。
- **第三矩（偏度）**：表示分布是向左倾斜还是向右倾斜。偏度为0时表示分布是对称的。
- **第四矩（峰度）**：表示数据的尾部有多重。峰度越高，说明数据中极端值越多。
- 我们以具体数据集$X = \{2, 4, 4, 4, 5, 5, 7, 9\}$来逐一计算这四种统计量。

- **步骤1：均值**（第一原始矩）

$$\mu = \frac{2 + 4 + 4 + 4 + 5 + 5 + 7 + 9}{8} = \frac{40}{8} = 5$$

- **步骤2：方差**（第二中心矩）。用每个数值减去均值，再平方，最后取平均值：

$$\sigma^2 = \frac{(2{-}5)^2 + (4{-}5)^2 + (4{-}5)^2 + (4{-}5)^2 + (5{-}5)^2 + (5{-}5)^2 + (7{-}5)^2 + (9{-}5)^2}{8}$$

$$= \frac{9 + 1 + 1 + 1 + 0 + 0 + 4 + 16}{8} = \frac{32}{8} = 4$$

- **标准差**为$\sigma = \sqrt{4} = 2$。

- **步骤3：偏度**（标准化后的第三中心矩）。将偏差值立方后求平均，再除以$\sigma^3$：

$$\tilde{\mu}_3 = \frac{1}{8} \cdot \frac{(-3)^3 + (-1)^3 + (-1)^3 + (-1)^3 + 0^3 + 0^3 + 2^3 + 4^3}{2^3}$$

$$= \frac{1}{8} \cdot \frac{-27 -1 -1 -1 + 0 + 0 + 8 + 64}{8} = \frac{42}{64} = 0.656$$

- 正偏度意味着数据分布的右尾更长，这是合理的，因为9这个数值远高于均值。

- **步骤4：峰度**（标准化后的第四中心矩）。将偏差值四次方后求平均：

$$\tilde{\mu}_4 = \frac{1}{8} \cdot \frac{(-3)^4 + (-1)^4 + (-1)^4 + (-1)^4 + 0^4 + 0^4 + 2^4 + 4^4}{2^4}$$

$$= \frac{1}{8} \cdot \frac{81 + 1 + 1 + 1 + 0 + 0 + 16 + 256}{16} = \frac{356}{128} = 2.781$$

- 正态分布的峰度为3（称为“中等峰度”）。我们的计算结果2.781与3较为接近，说明数据的尾部大致呈正态分布。峰度大于3表示尾部更重；小于3则表示尾部更轻。有些公式会通过减去3来计算**超额峰度**，因此我们的超额峰度为$-0.219$。

## 编程任务（可使用CoLab或笔记本完成）

1. 计算一个骰子的期望值，其中出现6的概率为0.3，其余各面的概率则平均分配。通过模拟100,000次投掷来验证结果。

```python
import jax
import jax.numpy as jnp

# Loaded die: face 6 has p=0.3, others share 0.7 equally
probs = jnp.array([0.14, 0.14, 0.14, 0.14, 0.14, 0.30])
faces = jnp.array([1, 2, 3, 4, 5, 6])

# Analytical expected value
ev = jnp.sum(faces * probs)
print(f"Expected value (formula): {ev:.4f}")

# Simulation
key = jax.random.PRNGKey(42)
rolls = jax.random.choice(key, faces, shape=(100_000,), p=probs)
print(f"Expected value (simulation): {rolls.mean():.4f}")
```

1. 计算示例数据集中的全部四个统计量（均值、方差、偏度、峰度），然后修改这些数据，观察各个统计量是如何变化的。

```python
import jax.numpy as jnp

x = jnp.array([2, 4, 4, 4, 5, 5, 7, 9], dtype=jnp.float32)

mean = jnp.mean(x)
variance = jnp.mean((x - mean) ** 2)
std = jnp.sqrt(variance)
skewness = jnp.mean(((x - mean) / std) ** 3)
kurtosis = jnp.mean(((x - mean) / std) ** 4)

print(f"Mean:     {mean:.3f}")
print(f"Variance: {variance:.3f}")
print(f"Std Dev:  {std:.3f}")
print(f"Skewness: {skewness:.3f}")
print(f"Kurtosis: {kurtosis:.3f}")
print(f"Excess K: {kurtosis - 3:.3f}")
```

1. 对于一个公平的骰子投掷，将概率密度函数与累积分布函数并列显示出来。试着改变各种概率值，观察它们的形状会如何变化。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

faces = jnp.array([1, 2, 3, 4, 5, 6])
pmf = jnp.ones(6) / 6  # fair die; try changing these!
cdf = jnp.cumsum(pmf)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

ax1.bar(faces, pmf, color="#3498db", alpha=0.8)
ax1.set_title("PMF")
ax1.set_xlabel("Face")
ax1.set_ylabel("P(X = x)")
ax1.set_ylim(0, 0.5)

ax2.step(faces, cdf, where="mid", color="#e74c3c", linewidth=2)
ax2.set_title("CDF")
ax2.set_xlabel("Face")
ax2.set_ylabel("P(X ≤ x)")
ax2.set_ylim(0, 1.1)

plt.tight_layout()
plt.show()
```

## 统计量

统计量能够用单个数值来概括数据的特点，这些数值可以反映数据的离散程度、位置、形状以及变量间的关联关系。本文件介绍了方差、标准差、四分位数、偏度、峰度、协方差、相关系数以及z分数等概念，这些都是用于数据探索分析以及机器学习中特征工程的重要工具。

- 在之前的文件中，我们介绍了作为汇总统计量的各阶矩。在这里，我们将详细探讨由这些矩派生出的各种实用统计量，即用于描述数据的离散程度、位置、形状以及变量间关联关系的指标。

- **离散程度**用来回答这样一个问题：数据的分布有多广？两个班级的平均测试分数可能相同，但数据的离散程度却可能大相径庭。

![两个均值相同但离散程度不同的数据分布](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/variance_spread.svg)

- 离散程度较小的（蓝色）数据分布，其方差较低：大多数数据点都集中在均值附近。而离散程度较大的（红色）数据分布，其方差较高：数据点分布得更分散。

- **方差**是指数据点与均值之间的平均平方距离。之所以要取平方，是为了避免正负偏差相互抵消。

$$\sigma^2 = \frac{1}{N} \sum_{i=1}^{N} (x_i - \mu)^2$$

- 当处理的是样本数据而非整个总体时，应使用 $N - 1$ 而不是 $N$ 作为分母。这种修正方法被称为贝塞尔修正，因为它能弥补样本数据往往低估真实变异性的问题：

$$s^2 = \frac{1}{N-1} \sum_{i=1}^{N} (x_i - \bar{x})^2$$

- **标准差**是方差的平方根：$\sigma = \sqrt{\sigma^2}$。它将统计量的单位还原为原始单位。如果数据是以厘米为单位，那么方差的单位是平方厘米，而标准差则仍以厘米为单位。

- **平均绝对偏差（MAD）**是一种更为简单的替代指标。计算时不需要对偏差值取平方，只需取其绝对值即可：

$$\text{MAD} = \frac{1}{N} \sum_{i=1}^{N} |x_i - \mu|$$

- 由于不通过对较大偏差值取平方来放大它们，因此MAD比方差更能抵抗异常值的影响。不过，从数学角度来看，方差更为方便（在证明和机器学习优化过程中更容易处理）。

- **位置**则用来回答另一个问题：某个特定数值在所有数据中的位置如何？

- **四分位数**将已排序的数据分为四个相等的部分。Q1（第25百分位数）是指有25%的数据小于该值的数值。Q2即为中位数（第50百分位数）。Q3则是第75百分位数。

- **四分位距（IQR）**等于Q3减去Q1。它反映了中间50%数据的离散程度，而不考虑极端值的影响。

![箱线图，显示了Q1、中位数、Q3、IQR、须状线以及异常值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/quartiles_boxplot.svg)

- 箱线图是统计学中最实用的可视化工具之一。箱子部分表示从Q1到Q3的范围，箱子内的直线代表中位数，须状线延伸到最极端的非异常值，而位于须状线之外的点则为异常值。

- **百分位数**是对四分位数的推广。第$p$百分位数是指有$p\%$的观测值小于该值的数值。Q1是第25百分位数，中位数是第50百分位数，Q3则是第75百分位数。

- **z分数**用来表示某个数值与均值之间的标准差数量：

$$z = \frac{x - \mu}{\sigma}$$

- 如果z分数为2，意味着该数值比均值高2个标准差；如果z分数为$-1.5$，则意味着该数值比均值低1.5个标准差。这一过程也被称为**标准化**，在机器学习中被广泛用于特征缩放，因为它可以将任何数据分布转换为均值為0、标准差為1的形式。

- **形状**则用来描述数据分布在其中心点和离散程度之外的几何特性。

- **偏度**（即之前文件中提到的标准化后的第三阶矩）用于衡量数据的不对称性。像正态曲线这样的完全对称数据，其偏度为零。正偏度意味着数据的右尾更长（例如收入分布），而负偏度则意味着数据的左尾更长（例如退休年龄分布）。

$$\text{偏度} = \frac{1}{N} \sum_{i=1}^{N} \left(\frac{x_i - \mu}{\sigma}\right)^3$$

- **峰度**（即标准化后的第四阶矩）用于衡量数据分布的尾部厚度。正态分布的峰度为3。那些尾部更厚、更容易出现异常值的数据分布，其峰度会大于3。

$$\text{峰度} = \frac{1}{N} \sum_{i=1}^{N} \left(\frac{x_i - \mu}{\sigma}\right)^4$$

- **相关系数**用于衡量两个变量之间关系的强度和方向。它回答的问题是：当一个变量上升时，另一个变量是会上升、下降，还是保持不变？

![三个散点图，分别展示了正相关、无相关和负相关的情况](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/correlation_scatter.svg)

- **皮尔逊相关系数**（$r$）用于衡量_线性_关联关系。它的取值范围从$-1$（完全负相关）到$0$（无相关），再到$+1$（完全正相关）。

$$r = \frac{\sum_{i=1}^{N} (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2} \cdot \sqrt{\sum (y_i - \bar{y})^2}}$$

- 如果你还记得第一章中关于点积的内容，那么皮尔逊相关系数实际上就是将$\mathbf{x}$和$\mathbf{y}$以均值为中心后的向量之间的余弦相似度。

- **斯皮尔曼相关系数**（$\rho$）用于衡量_单调_关联关系。它不直接使用原始数据值，而是先对数据值进行排序，然后再基于这些排序后的顺序来计算皮尔逊相关系数。因此，它对异常值具有更好的抵抗力，即使变量之间的关系是非线性的，只要这种关系是持续递增或递减的，它仍然有效。

- 当数据值是相乘关系时，比如增长率，那么几何平均数才是合适的平均数。如果某项投资的增长率分别为10%、20%、30%，那么其平均增长率并不是这三个增长率的算术平均值，而应该是：

$$\bar{x}_{\text{geo}} = \left(\prod_{i=1}^{N} x_i\right)^{1/N}$$

- 对于增长率来说，首先需要将百分比转换为对应的倍数（如1.10、1.20、1.30），然后计算几何平均数，最后再减去1。

- **指数移动平均数（EMA）**会给最近的观测值赋予更大的权重。与简单移动平均数不同，简单移动平均数中窗口内的所有数据点都被赋予相同的权重，而EMA则是以指数方式衰减的：

$$\text{EMA}_t = \alpha \cdot x_t + (1 - \alpha) \cdot \text{EMA}_{t-1}$$

- 平滑因子$\alpha$（取值范围为0到1）决定了旧数据值会多快失去影响力。$\alpha$值越大，模型对最新变化的响应就越快；$\alpha$值越小，数据变化就越平滑。在机器学习中，EMA被用于Adam等优化器以及批量归一化中的统计计算中。

- **异常值检测**用于识别那些与其余数据点相差过大的数据点。有两种常见的方法：
- **IQR方法**：如果某个数据点低于$Q1 - 1.5 \times \text{IQR}$或高于$Q3 + 1.5 \times \text{IQR}$，则该点被视为异常值。
- **Z分数方法**：如果某个数据点的$|z| > 3$（即其值与平均值的偏差超过3个标准差），则该点被视为异常值。

- IQR方法更为稳健，因为它不假设数据服从正态分布。而Z分数方法在数据近似服从正态分布时效果良好，但当数据分布严重偏斜时则可能失效。

## 编程任务（可使用CoLab或笔记本完成）（续1）

1. 计算某数据集的方差、标准差和MAD，并对它们进行比较。再尝试加入一个极端异常值，观察此时各项数值的变化情况。

```python
import jax.numpy as jnp

data = jnp.array([4, 8, 6, 5, 3, 7, 9, 5, 6, 7], dtype=jnp.float32)

mean = jnp.mean(data)
variance = jnp.var(data)
std = jnp.std(data)
mad = jnp.mean(jnp.abs(data - mean))

print("Original data:")
print(f"  Variance: {variance:.3f}, Std: {std:.3f}, MAD: {mad:.3f}")

# Add an outlier and recompute
data_outlier = jnp.append(data, 100.0)
mean2 = jnp.mean(data_outlier)
print(f"\nWith outlier (100):")
print(f"  Variance: {jnp.var(data_outlier):.3f}, Std: {jnp.std(data_outlier):.3f}, MAD: {jnp.mean(jnp.abs(data_outlier - mean2)):.3f}")
```

1. 计算两个变量之间的皮尔逊相关系数和斯皮尔曼相关系数。尝试不同的变量关系。

```python
import jax
import jax.numpy as jnp

# Perfect linear relationship
x = jnp.array([1, 2, 3, 4, 5, 6, 7, 8], dtype=jnp.float32)
y = 2 * x + 1  # try changing this!

def pearson(a, b):
    a_c = a - jnp.mean(a)
    b_c = b - jnp.mean(b)
    return jnp.sum(a_c * b_c) / (jnp.sqrt(jnp.sum(a_c**2)) * jnp.sqrt(jnp.sum(b_c**2)))

def spearman(a, b):
    rank_a = jnp.argsort(jnp.argsort(a)).astype(jnp.float32)
    rank_b = jnp.argsort(jnp.argsort(b)).astype(jnp.float32)
    return pearson(rank_a, rank_b)

print(f"Pearson r:  {pearson(x, y):.4f}")
print(f"Spearman ρ: {spearman(x, y):.4f}")
```

1. 采用IQR法和z分数法进行异常值检测，然后对比这两种方法在偏态数据上的检测结果。

```python
import jax.numpy as jnp

data = jnp.array([2, 3, 3, 4, 5, 5, 5, 6, 6, 7, 50], dtype=jnp.float32)

# IQR method
q1, q3 = jnp.percentile(data, 25), jnp.percentile(data, 75)
iqr = q3 - q1
lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
iqr_outliers = data[(data < lower) | (data > upper)]
print(f"IQR bounds: [{lower:.1f}, {upper:.1f}]")
print(f"IQR outliers: {iqr_outliers}")

# Z-score method
z_scores = (data - jnp.mean(data)) / jnp.std(data)
z_outliers = data[jnp.abs(z_scores) > 3]
print(f"\nZ-scores: {z_scores}")
print(f"Z-score outliers (|z| > 3): {z_outliers}")
```

1. 对含噪声的数据，使用不同的平滑因子计算并绘制指数移动平均线。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Generate noisy data
key = __import__("jax").random.PRNGKey(0)
noise = __import__("jax").random.normal(key, shape=(50,))
signal = jnp.linspace(0, 5, 50) + noise

def ema(data, alpha):
    result = jnp.zeros_like(data)
    result = result.at[0].set(data[0])
    for t in range(1, len(data)):
        result = result.at[t].set(alpha * data[t] + (1 - alpha) * result[t - 1])
    return result

plt.figure(figsize=(10, 4))
plt.plot(signal, "o", alpha=0.3, label="raw data", color="#999")
for alpha, color in [(0.1, "#e74c3c"), (0.3, "#3498db"), (0.7, "#27ae60")]:
    plt.plot(ema(signal, alpha), label=f"α={alpha}", color=color, linewidth=2)
plt.legend()
plt.title("EMA with different smoothing factors")
plt.show()
```

## 抽样

_抽样决定了我们收集数据的方式，同时也直接影响着我们所得出结论的质量。本文件介绍了随机抽样、分层抽样、集群抽样和系统抽样，以及抽样分布、大数定律和自助法——这些都是在机器学习中进行数据集划分与筛选时所必需的方法。_

- 在理想情况下，我们应该对目标群体中的每一个成员都进行测量。但实际上，这几乎是不可能的。我们无法调查所有的选民、检测所有的灯泡或为所有的患者做检查。因此，我们需要选取一个**样本**，通过它来了解整个群体。

- **总体**是指我们想要研究的全部个体或对象。而**样本**则是我们实际观察到的那部分个体。

- **参数**是用来描述总体的数值（例如，一个国家所有成年人的真实平均身高）。

- **统计量**则是根据样本计算得出的数值（例如，你所测量的500人的平均身高）。统计量被用来估算参数。

- 我们所得出结论的质量完全取决于样本的选取方式。如果样本存在偏差，那么无论分析方法多么复杂，得出的结论也会存在偏差。

- **抽样框**是指所有可能被纳入样本的个体的列表。理想情况下，抽样框应与总体完全一致，但实际上总会存在一些差异。

- 例如，如果通过电话进行调查，那些没有手机的人就无法被纳入调查范围。抽样框与总体之间的差异被称为**覆盖误差**。

- **抽样误差**则是样本统计量与总体参数之间不可避免的差异。

- 即使是完全随机的样本，也不可能与总体完全一致。增加样本量可以降低抽样误差。

- 抽样方法大致可分为两类：概率抽样和非概率抽样。

- **概率抽样**意味着总体中的每个成员都有已知的、非零的被选中概率。这种方法有助于量化不确定性并推广研究结果。

- **简单随机抽样**：每个个体被选中的概率相等，且所有大小为$n$的样本出现的概率也相同。可以想象把所有人的名字放进帽子里，然后随机抽取。

- **分层抽样**：根据某些共同特征（如年龄组、地区），将总体划分为若干互不重叠的组，然后从每组中随机抽取样本。这种方法能确保各组都有代表，而且当各组之间存在差异时，还能降低方差。

- **集群抽样**：将总体划分为若干组，随机选择部分组，然后把所选组中的所有人都纳入样本。当总体在地理上分布较广时，这种方法很实用，比如可以选取整个学校作为样本，而非逐个调查学区内的学生。

- **系统抽样**：先选择一个随机起点，然后从列表中每隔$k$个个体选取一个。例如，从第7个人开始，之后每隔10个人选取一个人（7、17、27……）。这种方法实施起来很简单，但如果列表中存在某种规律，就可能会引入偏差。

![三种概率抽样方法并列展示：简单随机抽样、分层抽样和集群抽样](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/sampling_methods.svg)

- **非概率抽样**并不保证每个成员都有已知的被选中概率。因此，其研究结果无法被严格推广，但这类方法的实施速度更快，成本也更低。

- **方便抽样**：选择最容易接触到的对象作为样本。在购物中心进行调查很方便，但却会遗漏那些不在那里购物的人。

- **定额抽样**：与分层抽样类似，但不涉及随机性。研究者通过从每组中挑选合适数量的个体来满足预设的名额要求（例如50名男性和50名女性）。

- **滚雪球抽样**：从少数参与者开始，让他们去招募更多人。这种方法适用于那些难以接触的群体（如研究罕见疾病），但结果往往会有较大偏差，因为只涵盖了那些有联系的人。

- 一旦确定了抽样方法，自然会有一个问题：如果我选择不同的样本，得到的统计量会不同吗？几乎可以肯定会的。**抽样分布**指的是对于相同大小的样本，某个统计量（如样本均值）的所有可能取值的分布情况。

- 想象一下，我们抽取1,000个由30人组成的样本，然后计算每个样本的平均身高。这1,000个平均值就构成了一个分布。其中一些值会略高于总体的真实平均值，一些则略低，而大多数值会集中在真实值附近。

- 这个抽样分布的标准差被称为**标准误差**：

$$SE = \frac{\sigma}{\sqrt{n}}$$

- 可以看出，随着$n$的增加，标准误差会减小。更大的样本能带来更精确的估计。如果样本量增加四倍，标准误差就会减半。

- 统计学中最重要的结果之一就是**中心极限定理（CLT）**。该定理指出：无论总体的形状如何，只要样本量足够大，样本均值的分布就会趋近于正态分布。

![中心极限定理：偏态总体产生的样本均值呈正态分布](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/central_limit_theorem.svg)

- 更准确地说，如果$X_1, X_2, \ldots, X_n$是从均值为$\mu$、方差为$\sigma^2$的任意分布中独立抽取的观测值，那么随着$n$的增大：

$$\bar{X} \approx \text{Normal}\!\left(\mu, \frac{\sigma^2}{n}\right)$$

- 正是中心极限定理使得大多数推断统计方法得以应用。它让我们能够在原始数据并非正态分布的情况下，只要样本量足够大，就可以用正态分布作为近似值。

- 那么，“足够大”的样本量到底是多少呢？一个常见的经验法则是$n \ge 30$，但这取决于总体的偏态程度。对于高度偏态的分布，可能需要更大的样本量；而对于大致对称的总体，$n = 10$可能就已经足够了。
- 中心极限定理有三个关键条件：
- **独立性**：各个观测值之间不能相互影响
- **方差有限**：总体的方差必须存在（排除了某些特殊的分布类型）
- **同分布性**：所有观测值都来自同一分布

## 编程任务（使用CoLab或笔记本）

1. 通过可视化方式展示中心极限定理：从高度偏态的分布中抽取样本，计算样本均值，观察这些均值的直方图逐渐变为钟形。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(0)

# Exponential distribution (very skewed)
population = jax.random.exponential(key, shape=(100_000,))

fig, axes = plt.subplots(1, 4, figsize=(14, 3))
sample_sizes = [1, 5, 30, 100]

for ax, n in zip(axes, sample_sizes):
    keys = jax.random.split(key, 2000)
    means = jnp.array([jax.random.choice(k, population, shape=(n,)).mean() for k in keys])
    ax.hist(means, bins=40, color="#3498db", alpha=0.7, density=True)
    ax.set_title(f"n = {n}")
    ax.set_xlim(0, 4)

fig.suptitle("CLT: sample means become normal as n increases", fontsize=13)
plt.tight_layout()
plt.show()
```

1. 比较简单随机抽样与分层抽样。构建由不同群体构成的总体，并证明分层抽样能降低估计值的方差。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(42)

# Population: two distinct groups
group_a = jax.random.normal(key, shape=(500,)) + 10   # mean ~10
key, subkey = jax.random.split(key)
group_b = jax.random.normal(subkey, shape=(500,)) + 20  # mean ~20
population = jnp.concatenate([group_a, group_b])

# Simple random sampling: 1000 trials, sample size 20
srs_means = []
for i in range(1000):
    key, subkey = jax.random.split(key)
    sample = jax.random.choice(subkey, population, shape=(20,), replace=False)
    srs_means.append(sample.mean())
srs_means = jnp.array(srs_means)

# Stratified sampling: 10 from each group
strat_means = []
for i in range(1000):
    key, k1, k2 = jax.random.split(key, 3)
    s_a = jax.random.choice(k1, group_a, shape=(10,), replace=False)
    s_b = jax.random.choice(k2, group_b, shape=(10,), replace=False)
    strat_means.append(jnp.concatenate([s_a, s_b]).mean())
strat_means = jnp.array(strat_means)

print(f"Simple Random - Mean: {srs_means.mean():.3f}, Std: {srs_means.std():.3f}")
print(f"Stratified    - Mean: {strat_means.mean():.3f}, Std: {strat_means.std():.3f}")
print(f"Stratified sampling reduced variance by {(1 - strat_means.var()/srs_means.var())*100:.1f}%")
```

1. 探索样本大小如何影响标准误差。将标准误差与样本大小绘制成图表，以验证$1/\sqrt{n}$这一关系。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(7)
population = jax.random.normal(key, shape=(50_000,)) * 10 + 50

sample_sizes = [5, 10, 20, 50, 100, 200, 500, 1000]
std_errors = []

for n in sample_sizes:
    means = []
    for _ in range(500):
        key, subkey = jax.random.split(key)
        sample = jax.random.choice(subkey, population, shape=(n,))
        means.append(sample.mean())
    std_errors.append(jnp.array(means).std())

plt.figure(figsize=(8, 4))
plt.plot(sample_sizes, std_errors, "o-", color="#e74c3c", label="Observed SE")
theoretical = population.std() / jnp.sqrt(jnp.array(sample_sizes, dtype=jnp.float32))
plt.plot(sample_sizes, theoretical, "--", color="#3498db", label="σ/√n (theoretical)")
plt.xlabel("Sample size (n)")
plt.ylabel("Standard error")
plt.legend()
plt.title("Standard error shrinks with larger samples")
plt.show()
```

## 假设检验

_假设检验提供了一个严谨的框架，用于判断观察到的效应是真实的还是由偶然因素造成的。本文档涵盖了零假设与备择假设、p值、显著性水平、t检验、卡方检验、方差分析以及第一类/第二类错误；这些逻辑同样应用于A/B测试、模型比较和研究中。_

- 统计学不仅仅是描述数据。很多时候你需要做出决策：新药是否有效？某种算法是否比另一种更快？平均值是否发生了变化？假设检验为你提供了利用数据回答这些问题的结构化框架。

- 其原理很简单：先假设没有任何变化（“零假设”），然后检查数据是否极端到让人难以相信这一假设。

- **零假设**（$H_0$）是默认的陈述，通常是“无效应”或“无差异”的表述。例如：“平均配送时间仍为30分钟”或“新模型并不优于旧模型”。

- **备择假设**（$H_1$或$H_a$）是你认为可能成立的情况：“平均配送时间已经改变”或“新模型更优”。

- 你永远无法直接证明$H_1$为真。相反，你会问：如果$H_0$为真，出现如此极端数据的可能性有多大？如果这种可能性极低，你就拒绝$H_0$而接受$H_1$。

- **检验统计量**是一个数字，用于概括样本结果与$H_0$预测值之间的偏离程度。不同检验使用不同的公式，但逻辑始终相同：衡量观测值与期望值之间的距离。

- **p值**是在$H_0$为真的前提下，观测到至少与你所得统计量一样极端的概率。p值越小，说明在$H_0$下数据越令人惊讶。

- **显著性水平**（$\alpha$）是你在查看数据前设定的阈值。若$p \le \alpha$，则拒绝$H_0$。常用的选择有$\alpha = 0.05$（5%）和$\alpha = 0.01$（1%）。

![带有阴影拒绝区域、标记的检验统计量以及高亮显示的p值区域的正态曲线](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/hypothesis_test.svg)

- 阴影部分即为拒绝区域。如果检验统计量落在该区域内，说明在$H_0$下数据足够令人惊讶，因此拒绝$H_0$。绿色区域显示了特定检验统计量的p值。

- 以下是具体步骤：
- **步骤1**：陈述$H_0$和$H_1$
- **步骤2**：选定显著性水平$\alpha$
- **步骤3**：收集数据并计算检验统计量
- **步骤4**：求出p值（或将检验统计量与临界值比较）
- **步骤5**：若$p \le \alpha$，则拒绝$H_0$；否则不拒绝$H_0$

- **实例演示**：某工厂声称其螺栓的平均长度为10厘米。你测量了36个螺栓，发现样本均值为10.3厘米。已知总体标准差为0.9厘米。是否有证据表明平均值发生了变化？

- $H_0$：$\mu = 10$，$H_1$：$\mu \neq 10$，$\alpha = 0.05$

- 检验统计量（由于$\sigma$已知且$n$较大，采用z检验）：

$$z = \frac{\bar{x} - \mu_0}{\sigma / \sqrt{n}} = \frac{10.3 - 10}{0.9 / \sqrt{36}} = \frac{0.3}{0.15} = 2.0$$

- 在$\alpha = 0.05$的双尾检验中，临界值为$\pm 1.96$。由于$z = 2.0 > 1.96$，因此拒绝$H_0$。p值约为0.046，小于0.05。

- 结论：有统计学意义上的显著证据表明螺栓的平均长度不同于10厘米。

- **单尾检验**用于检验某一特定方向的效应（$H_1$：$\mu > 10$或$\mu < 10$）。全部$\alpha$都分配到一个尾部，这样更容易在该方向拒绝$H_0$，但无法检测到相反方向的效应。

- **双尾检验**用于检验任何差异（$H_1$：$\mu \neq 10$）。$\alpha$被分配到两个尾部（各占$\alpha/2$）。这种方式更为保守，但能捕捉到任意方向的效应。

- 即便流程再完善，错误仍可能发生。共有两种类型的错误：

![展示第一类和第二类错误的2×2表格：现实情况与决策结果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/type_errors.svg)

- **第一类错误**（假阳性）：当$H_0$实际为真时却拒绝了它。其概率为$\alpha$，可通过设定显著性水平来控制。好比没有火灾时火警响起。

- **第二类错误**（假阴性）：当$H_0$实际为假时却没有拒绝它。其概率为$\beta$。好比真有火灾时火警却未响。

- **检验效能**为$1 - \beta$，即正确拒绝错误$H_0$的概率。效能越高，说明你越能检测出真实效应。以下情况会提高检验效能：
- 真实效应大小越大（差异越大越容易被察觉）
- 样本量越大（数据越多，精确度越高）
- 显著性水平$\alpha$越大（但这会增加第一类错误的风险）
- 数据的变异性越低（噪声越少）

- 第一类错误与第二类错误之间存在权衡。降低$\alpha$（对假阳性更谨慎）会增加$\beta$（更多假阴性）。在样本量固定的情况下，无法同时最小化这两种错误。

- **参数检验**假设数据遵循特定分布（通常为正态分布）。当假设成立时，它们的检验效能更高。

- **Z检验**：当$\sigma$已知且$n$较大（$n \ge 30$）时，用于比较样本均值与已知值。检验统计量：

$$z = \frac{\bar{x} - \mu_0}{\sigma / \sqrt{n}}$$

- **T检验**：类似于z检验，但适用于$\sigma$未知（需从样本中估计）或$n$较小的情况。它使用t分布，该分布的尾部比正态分布更厚。较厚的尾部用于反映估计$\sigma$所带来的额外不确定性。

$$t = \frac{\bar{x} - \mu_0}{s / \sqrt{n}}$$

- t分布有一个称为**自由度**的参数（$df = n - 1$）。随着$df$增大，t分布逐渐趋近于正态分布。
- t检验有几种类型：
- **单样本t检验**：样本均值是否与某个特定值存在差异？
- **独立双样本t检验**：两个独立组的均值是否存在差异？
- **配对t检验**：两组相关观测值的均值是否存在差异（例如同一组受试者在治疗前后的数据）？

- **方差分析（ANOVA）**：用于检验三个或更多组的均值是否相等。与进行多次t检验（会增加第一类错误率）不同，ANOVA通过比较组间方差与组内方差来进行单次检验。

$$F = \frac{\text{组间方差}}{\text{组内方差}}$$

- 较大的$F$比值意味着各组之间的差异超出了随机变异所能解释的范围。

- **非参数检验**对数据分布的假设较少。它们基于秩而非原始数值进行分析，因此对异常值和非正态性具有更强的鲁棒性。

- **卡方检验**（$\chi^2$）：用于检验观测频数与期望频数是否一致。适用于分类数据。例如：红色、蓝色和绿色汽车的比例是否与制造商宣称的比例相符？

$$\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i}$$

- **曼-惠特尼U检验**：独立双样本t检验的非参数替代方法。它通过比较秩来检验一组的数值是否倾向于大于另一组。

- **威尔科克森符号秩检验**：配对t检验的非参数替代方法。它通过考察差异的大小和方向来比较配对观测值。

- **克鲁斯卡尔-沃利斯检验**：单因素方差分析的非参数替代方法。它通过比较所有组的秩来检验多个组是否来自同一分布。

- **拟合优度检验**用于判断数据是否符合特定的理论分布。卡方拟合优度检验将观测到的分组频数与被认为分布下的期望频数进行比较。

- **正态性检验**专门用于判断数据是否呈正态分布。常用的方法包括夏皮洛-威尔克检验（对小样本尤为有效）和柯尔莫哥洛夫-斯米尔诺夫检验（将样本的累积分布函数与理论累积分布函数进行比较）。

- 在机器学习中，假设检验常用于比较模型性能。如果模型A的准确率为92%，模型B为91%，这种差异是真实的还是仅仅是噪声所致？通过对交叉验证得分进行配对t检验即可得出答案。

## 编程任务（使用CoLab或笔记本）（续1）

1. 针对文中提到的螺栓工厂案例执行z检验。计算检验统计量、p值并做出决策。

```python
import jax.numpy as jnp

x_bar = 10.3    # sample mean
mu_0 = 10.0     # null hypothesis value
sigma = 0.9     # known population std
n = 36           # sample size
alpha = 0.05

# Test statistic
z = (x_bar - mu_0) / (sigma / jnp.sqrt(n))
print(f"z = {z:.4f}")

# p-value (two-tailed) using the normal CDF approximation
# For |z| = 2.0, p ≈ 0.0456
from jax.scipy.stats import norm
p_value = 2 * (1 - norm.cdf(jnp.abs(z)))
print(f"p-value = {p_value:.4f}")
print(f"Reject H₀? {p_value <= alpha}")
```

1. 模拟第一类错误：当$H_0$为真时，我们错误地拒绝它的频率是多少？进行10,000次实验，验证拒绝率是否与$\alpha$相符。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(0)
mu_0 = 50.0
sigma = 10.0
n = 30
alpha = 0.05
n_experiments = 10_000

rejections = 0
for i in range(n_experiments):
    key, subkey = jax.random.split(key)
    sample = mu_0 + sigma * jax.random.normal(subkey, shape=(n,))
    z = (sample.mean() - mu_0) / (sigma / jnp.sqrt(n))
    p_value = 2 * (1 - __import__("jax").scipy.stats.norm.cdf(jnp.abs(z)))
    if p_value <= alpha:
        rejections += 1

print(f"Rejection rate: {rejections/n_experiments:.4f}")
print(f"Expected (α):   {alpha}")
```

1. 比较两组数据中的t检验和Mann-Whitney U检验。生成一组数据，使其中一组的均值略高，看看哪种检验能检测出这种差异。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(99)
k1, k2 = jax.random.split(key)

group_a = jax.random.normal(k1, shape=(25,)) * 5 + 100
group_b = jax.random.normal(k2, shape=(25,)) * 5 + 103  # slightly higher mean

# Two-sample t-test (equal variance assumed)
n_a, n_b = len(group_a), len(group_b)
mean_a, mean_b = group_a.mean(), group_b.mean()
pooled_var = ((n_a - 1) * group_a.var() + (n_b - 1) * group_b.var()) / (n_a + n_b - 2)
se = jnp.sqrt(pooled_var * (1/n_a + 1/n_b))
t_stat = (mean_a - mean_b) / se
print(f"T-test statistic: {t_stat:.4f}")

# Mann-Whitney: count how often group_a values beat group_b values
u_stat = jnp.sum(group_a[:, None] < group_b[None, :])
print(f"Mann-Whitney U:   {u_stat}")
print(f"\nGroup A mean: {mean_a:.2f}, Group B mean: {mean_b:.2f}")
```

## 统计推断

_统计推断不仅仅是做出“是/否”的判断，它还能在考虑不确定性的前提下估算总体参数。本文件涵盖了置信区间、点估计与区间估计、最大似然估计、矩估计以及回归分析——这些方法是连接原始数据与机器学习中预测模型之间的桥梁。_

- 假设检验只能给出“拒绝”或“不拒绝”的结论。但通常人们希望获得更详细的信息，即所估算参数的可能取值范围。而**置信区间**正是用来提供这种信息的。

- **点估计**是从样本中计算出的一个数值，比如样本均值$\bar{x}$。它是我们对总体参数的最佳估计，但仅凭这一点无法判断该估计的精确程度。

- **置信区间**则是在点估计的基础上加上一个反映不确定性的范围。其表达式为：

$$\text{CI} = \bar{x} \pm \text{ME}$$

- **误差范围（ME）**取决于三个因素：你希望达到的置信水平、数据中的变异程度以及样本大小：

$$\text{ME} = z^\ast \cdot \frac{\sigma}{\sqrt{n}}$$

- 这里$z^\ast$是正态分布中与所需置信水平对应的临界值。对于95%的置信水平，$z^\ast = 1.96$；对于99%的置信水平，$z^\ast = 2.576$。

![置信区间：点估计加上两侧的误差范围](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/confidence_interval.svg)

- **95%置信区间**的含义是：如果你重复进行多次实验并每次都计算出一个置信区间，那么大约95%的区间会包含真实的总体参数。但这并不意味着该参数有95%的概率位于这个特定区间内。实际上参数是固定的，变化的是置信区间。

- **示例**：你测量了50个人的身高，得到样本均值$\bar{x} = 170$厘米，标准差$\sigma = 8$厘米。请构建一个95%的置信区间。

$$\text{ME} = 1.96 \cdot \frac{8}{\sqrt{50}} = 1.96 \cdot 1.131 = 2.22 \text{厘米}$$

$$\text{CI} = [170 - 2.22, \; 170 + 2.22] = [167.78, \; 172.22]$$

- 因此，我们可以以95%的置信度认为，真实的身高均值介于167.78厘米和172.22厘米之间。

- 当标准差$\sigma$未知时（这是常见情况），可以使用样本标准差$s$以及t分布来计算置信区间：

$$\text{CI} = \bar{x} \pm t^\ast_{n-1} \cdot \frac{s}{\sqrt{n}}$$

- 较宽的置信区间能提供更高的置信度，但精确度较低；较窄的置信区间精确度更高，但置信度较低。通过增加样本大小，可以在不降低置信度的前提下缩小置信区间。

- **功效分析**有助于你在实验开始前做好规划。其核心问题是：为了以指定的功效检测出某种效应，我需要多大的样本量？

- 根据之前的内容，功效等于$1 - \beta$，即正确拒绝错误假设$H_0$的概率。通常人们希望的功效水平为80%。

- 对于z检验来说，若要以显著性水平$\alpha$和功效$1-\beta$检测出差异$\delta$，所需的样本量为：

$$n = \left(\frac{(z_{\alpha/2} + z_{\beta}) \cdot \sigma}{\delta}\right)^2$$

- 例如，若要检测身高均值2厘米的差异（$\sigma = 8$厘米），显著性水平为0.05，功效为80%（$z_{0.025} = 1.96$，$z_{0.20} = 0.84$），则：

$$n = \left(\frac{(1.96 + 0.84) \cdot 8}{2}\right)^2 = \left(\frac{22.4}{2}\right)^2 = 11.2^2 \approx 126$$

- 因此，每个组大约需要126人。

- 功效分析可以避免两种常见错误：要么因为样本量过小而无法检测到真实效应，要么因为样本量过大而浪费资源。

- **蒙特卡洛方法**利用随机抽样来解决那些难以或无法通过解析方法解决的问题。其基本思路是：如果无法精确计算某个值，那就多次模拟该过程，然后利用模拟结果作为近似值。

- 这个名称来源于蒙特卡洛赌场，体现了随机性在其中的作用。在机器学习中，这类方法被广泛用于估算积分、评估模型不确定性以及近似复杂分布等任务。

- 蒙特卡洛方法的一般步骤如下：
- 确定可能的输入范围
- 从该范围内生成随机输入
- 对每个输入计算相应的函数值
- 对这些结果进行汇总（如求平均值、计数等）

- 一个经典的例子是估算圆周率$\pi$。想象一个边长为2的正方形，中心位于原点，正方形内部有一个半径为1的圆。正方形的面积为4，而圆的面积为$\pi$。

![带内切圆的正方形，随机点根据位置被标记为内部或外部](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/monte_carlo_pi.svg)

- 在正方形内均匀随机放置点，落在圆内的点所占的比例可近似表示为$\pi/4$：

$$\pi \approx 4 \times \frac{\text{圆内的点数}}{\text{总点数}}$$

- 如果点$(x, y)$满足$x^2 + y^2 \le 1$，则该点位于圆内。投放的点越多，估算出的$\pi$值就越接近真实值。

- 在机器学习中，蒙特卡洛方法被应用于以下领域：
- **蒙特卡洛丢弃法**：通过多次启用丢弃机制进行推理，从而估算预测的不确定性
- **MCMC（马尔可夫链蒙特卡洛）**：在贝叶斯模型中从复杂的后验分布中采样
- **策略梯度方法**：通过采样轨迹来估算强化学习中的梯度值

- **因子分析**是一种用于发现潜在变量的技术，这些潜在变量能够解释观测变量之间的相关性。例如，如果有10个关于人格的调查问题，但实际上可以用3个潜在特质（外向性、宜人性、尽责性）来解释这些问题，因子分析就能找出这3个特质。

- 该模型假设每个观测变量$x_i$都是若干潜在因子$f_j$的线性组合，再加上噪声：

$$x_i = \lambda_{i1} f_1 + \lambda_{i2} f_2 + \ldots + \lambda_{ik} f_k + \epsilon_i$$

- $\lambda$值被称为**因子载荷**，它反映了每个观测变量与各个因子的关联强度。这一概念与第2章中介绍的矩阵分解直接相关；因子分析实际上与特征值分解以及SVD有着密切的联系。

- **实验设计**是一门关于如何安排实验以得出有效结论的学问。糟糕的设计即便拥有庞大的数据集也毫无用处。

- 一个设计良好的实验应包含以下关键要素：
- **自变量（IV）**：即你所操纵的因素（例如药物剂量、模型结构）
- **因变量（DV）**：即你所测量的结果（例如恢复时间、准确率）
- **对照组**：不接受任何处理（或仅接受安慰剂），用于作为比较的基准
- **随机分配**：参与者被随机分配到不同组别中，以此消除那些未被测量的干扰因素

- **常见的实验设计类型**：
- **完全随机设计**：受试者被随机分配到不同的处理组。当各组条件相当时，这种设计简单且有效。
- **随机区组设计**：首先将受试者按某些特征分组（如年龄），然后再在每组内随机分配处理方式。这种方法可以减少区组因素带来的差异，其原理类似于分层抽样。
- **因子设计**：同时测试多个自变量。一个$2 \times 3$的因子设计意味着一个变量有2种水平，另一个变量有3种水平，因此共有6种处理组合。通过这种方式可以检测出**交互效应**，即某个变量的效果会因另一个变量的不同水平而发生变化。
- **交叉设计**：每位受试者依次接受所有处理方式（处理之间设有恢复期）。每位受试者都可以作为自己的对照组，从而降低个体差异带来的影响。

- 在机器学习实验中，这些原则至关重要。在比较不同模型时，需要控制随机种子、数据集划分方式以及硬件条件。交叉验证其实也是一种交叉设计。而逐步移除某个组件的消融研究，则遵循因子设计的逻辑。

## 编程任务（可使用CoLab或笔记本完成）（续2）

1. 为身高数据计算95%的置信区间，然后尝试不同的置信水平及样本量。

```python
import jax.numpy as jnp

x_bar = 170.0    # sample mean
sigma = 8.0      # population std (known)
n = 50           # sample size

# Critical values for common confidence levels
z_stars = {0.90: 1.645, 0.95: 1.960, 0.99: 2.576}

for conf, z_star in z_stars.items():
    me = z_star * (sigma / jnp.sqrt(n))
    lower, upper = x_bar - me, x_bar + me
    print(f"{conf*100:.0f}% CI: [{lower:.2f}, {upper:.2f}]  (ME = {me:.2f})")
```

1. 使用蒙特卡洛模拟来估算π值。绘制出随着样本点数量增加，该估算值如何逐渐收敛的图表。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(42)

# Generate random points in [-1, 1] x [-1, 1]
n_points = 100_000
k1, k2 = jax.random.split(key)
x = jax.random.uniform(k1, shape=(n_points,), minval=-1, maxval=1)
y = jax.random.uniform(k2, shape=(n_points,), minval=-1, maxval=1)

# Check which points are inside the unit circle
inside = (x**2 + y**2) <= 1.0
cumulative_inside = jnp.cumsum(inside)
counts = jnp.arange(1, n_points + 1)
pi_estimates = 4.0 * cumulative_inside / counts

plt.figure(figsize=(10, 4))
plt.plot(pi_estimates, color="#3498db", alpha=0.7, linewidth=0.5)
plt.axhline(y=jnp.pi, color="#e74c3c", linestyle="--", label=f"π = {jnp.pi:.6f}")
plt.xlabel("Number of points")
plt.ylabel("Estimate of π")
plt.title("Monte Carlo estimation of π")
plt.legend()
plt.ylim(2.8, 3.5)
plt.show()

print(f"Final estimate: {pi_estimates[-1]:.6f}")
print(f"True value:     {jnp.pi:.6f}")
print(f"Error:          {abs(pi_estimates[-1] - jnp.pi):.6f}")
```

1. 进行简单的功效分析：对于给定的效应大小和标准差，计算所需的样本量，并通过模拟来验证该数值。

```python
import jax
import jax.numpy as jnp

# Parameters
delta = 2.0      # effect size (difference in means)
sigma = 8.0      # population std
alpha = 0.05
power_target = 0.80

# Analytical sample size
z_alpha = 1.96   # two-tailed, alpha=0.05
z_beta = 0.84    # power=0.80
n_required = ((z_alpha + z_beta) * sigma / delta) ** 2
print(f"Required n per group: {n_required:.0f}")

# Verify by simulation
key = jax.random.PRNGKey(7)
n = int(jnp.ceil(n_required))
n_sims = 5000
rejections = 0

for _ in range(n_sims):
    key, k1, k2 = jax.random.split(key, 3)
    group_a = jax.random.normal(k1, shape=(n,)) * sigma + 50
    group_b = jax.random.normal(k2, shape=(n,)) * sigma + 50 + delta
    pooled_se = jnp.sqrt(2 * sigma**2 / n)
    z = (group_b.mean() - group_a.mean()) / pooled_se
    p = 2 * (1 - __import__("jax").scipy.stats.norm.cdf(jnp.abs(z)))
    if p <= alpha:
        rejections += 1

print(f"Simulated power: {rejections/n_sims:.3f}")
print(f"Target power:    {power_target:.3f}")
```

1. 可视化显示置信区间宽度如何随样本量变化。这有助于理解为何收集更多数据能够得到更精确的估计值。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

sigma = 8.0
z_star = 1.96  # 95% confidence

sample_sizes = jnp.array([10, 20, 30, 50, 100, 200, 500, 1000], dtype=jnp.float32)
margins = z_star * sigma / jnp.sqrt(sample_sizes)

plt.figure(figsize=(8, 4))
plt.bar([str(int(n)) for n in sample_sizes], margins, color="#3498db", alpha=0.7)
plt.xlabel("Sample size")
plt.ylabel("Margin of error (cm)")
plt.title("95% CI margin of error shrinks with larger samples")
plt.show()
```
