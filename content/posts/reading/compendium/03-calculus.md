---
title: "微积分"
date: "2026-11-05"
order: 3
slug: "compendium/03-calculus"
description: "微分学用于描述瞬时变化率。本文档涵盖了极限、导数、求导法则、链式法则（反向传播的基础）以及机器学习中常用的导数。"
tags: []
---

## 微分学

_微分学用于描述瞬时变化率。本文档涵盖了极限、导数、求导法则、链式法则（反向传播的基础）以及机器学习中常用的导数。_

- 在前几章中，我们学习了如何将数据表示为向量，以及如何用矩阵对其进行变换。但许多现实世界中的现象并非静止不变。汽车在加速，股票价格在波动，神经网络的损失值会随着权重的更新而变化。**微积分**就是研究变化的数学。

- 微积分提出了两个问题：某事物此刻的变化速度是多少？（微分学）以及它随时间累积了多少？（积分学）。本节主要探讨“变化速度”这一问题。

- 想象一下你正在开车，看了一眼车速表。上面显示的数值是60公里/小时。这个数字并不是你整个行程的平均速度，而是这一瞬间的速度。微分学为我们提供了计算这种瞬时变化率的工具。

- 不过首先，让我们回顾一下直线方程：$y = mx + b$。

- 这是两个量之间最简单的关系。
- $b$ 是**y轴截距**，即直线与y轴相交的点（当$x = 0$时的起始值）。
- $m$ 是**斜率**，也就是变化率：每当$x$增加1个单位时，$y$就会相应地变化$m$个单位。
- 如果$m = 3$，直线会急剧上升；如果$m = 0$，直线是水平的；如果$m = -2$，直线则会下降。

- 斜率的计算公式为 $m = \frac{\Delta y}{\Delta x} = \frac{y_2 - y_1}{x_2 - x_1}$，即“$y$的变化量”与“$x$的变化量”之比。

![直线方程：b为y轴截距，m为斜率（上升量除以水平距离）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/line_equation.svg)

- 一旦确定了$m$和$b$，就可以计算出任意$x$对应的$y$值。

- 例如，若$m = 2$且$b = 3$，则当$x = 5$时：$y = 2(5) + 3 = 13$。

- 这两个参数完全决定了直线，预测任何输出值只需代入即可。

- 对于直线而言，其斜率在所有位置都相同。

- 这一概念可以推广到更一般的情况。任何函数都是将输入映射到输出的规则；一旦知道了它的公式（即参数和形状），就能计算出任意输入对应的输出并绘制出图像。

- $y = x^2$ 形成抛物线，$y = \sin(x)$ 形成波形，$y = e^x$ 则呈现指数增长趋势。每个公式都定义了特定的曲线，能够熟练地将函数理解为图形对于后续学习至关重要。

- 对于直线而言，斜率处处相同。但大多数有趣的函数都是曲线，因此斜率会随点的位置而变化。微积分为我们提供了一种求曲线上任意一点斜率的方法。

- 我们还需要引入**极限**的概念。极限描述的是当函数的输入越来越接近某个目标值时，该函数所趋近的值，而不一定需要恰好等于该值。

$$\lim_{x \to a} f(x) = L$$

- 这句话的意思是：“当$x$趋近于$a$时，$f(x)$趋近于$L$。”函数在$x = a$处并不一定要等于$L$，只需无限接近即可。

- 例如，取$f(x) = \frac{x^2 - 1}{x - 1}$。如果直接代入$x = 1$，会得到$\frac{0}{0}$，这是未定义的。

- 但尝试接近1的值：$f(0.9) = 1.9$，$f(0.99) = 1.99$，$f(1.01) = 2.01$。显然，这些输出值正趋向于2。

- 从代数上看，原因也很明显：将分子因式分解为$(x-1)(x+1)$，消去$(x-1)$项后，可得对所有$x \neq 1$有$f(x) = x + 1$。因此当$x \to 1$时，$f(x) \to 2$。

- 该函数在$x = 1$处存在一个空洞，但极限仍然存在。

- 极限是微积分中所有内容的基础。

- 函数$f(x)$在点$x = a$处的**导数**衡量的是该点的瞬时变化率。从几何角度看，它就是曲线在该点处切线的斜率。

![导数是曲线上某点处切线的斜率](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/tangent_line.svg)

- 为了计算这个斜率，我们先取曲线上的两个点，算出通过这两点的直线（**割线**）的斜率。然后让第二个点逐渐靠近第一个点，观察割线斜率的变化趋势。这就是**差商**：

$$f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$$

![随着$h$趋近于0，割线逐渐逼近切线](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/difference_quotient.svg)

- 分子$f(a+h) - f(a)$表示输出的变化量，分母$h$表示输入的变化量。它们的比值就是在极小区间内的平均变化率。当$h \to 0$时，这个平均值便成为瞬时变化率。

- 例如，设$f(x) = x^2$。在$x = 3$处：

$$f'(3) = \lim_{h \to 0} \frac{(3+h)^2 - 9}{h} = \lim_{h \to 0} \frac{9 + 6h + h^2 - 9}{h} = \lim_{h \to 0} (6 + h) = 6$$

- 因此，在$x = 3$处，函数$x^2$的输出每增加1个单位输入，其值就增加6个单位。

- 如果上述极限存在，则称该函数在该点**可导**。要实现这一点，函数必须是连续的（没有跳跃）、光滑的（没有尖角），并且在该点附近有定义。

- 如果你能不抬笔、无折点地画出该曲线，那么它在该处很可能是可导的。

- 每次都从极限定义出发来计算导数会很繁琐。幸运的是，有几条法则能帮助我们快速求出几乎所有函数的导数。

- **常数法则**：常数的导数为零。若$f(x) = 5$，则$f'(x) = 0$。水平直线的斜率为零。

- **幂法则**：这是求导的核心法则。把指数降下来，再减一：

$$\frac{d}{dx} x^n = n x^{n-1}$$

- 例如：$\frac{d}{dx} x^3 = 3x^2$。三次函数变成了二次函数。该法则适用于任何实数指数，包括负数和分数：$\frac{d}{dx} x^{-1} = -x^{-2}$，$\frac{d}{dx} \sqrt{x} = \frac{d}{dx} x^{1/2} = \frac{1}{2}x^{-1/2}$。

- **和/差法则**：逐项求导。

$$\frac{d}{dx}[f(x) \pm g(x)] = f'(x) \pm g'(x)$$

- **乘积法则**：当两个函数相乘时，其导数并非简单地等于各自导数的乘积。实际上：

$$\frac{d}{dx}[f(x) \cdot g(x)] = f'(x)g(x) + f(x)g'(x)$$

- 可以理解为：“第一个函数的变化率乘以第二个函数，再加上第一个函数乘以第二个函数的变化率。”例如，$\frac{d}{dx}[x^2 \sin x] = 2x \sin x + x^2 \cos x$。

- **商法则**：对于两个函数的比值：

$$\frac{d}{dx}\left[\frac{f(x)}{g(x)}\right] = \frac{f'(x)g(x) - f(x)g'(x)}{[g(x)]^2}$$

- 一个实用的记忆口诀：“分母乘以上面的导数减去分子乘以下面的导数，再除以分母的平方。”

- **链式法则**：机器学习中最重要的法则。当函数相互嵌套时，其导数等于沿链条各处导数的乘积：

$$\frac{d}{dx} f(g(x)) = f'(g(x)) \cdot g'(x)$$

- 可以把它想象成剥洋葱：先对外部函数求导（此时内部函数保持不变），然后再乘以内部函数的导数。

![链式法则：对外部函数求导，再乘以内部函数的导数](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/chain_rule.svg)

- 例如，$\frac{d}{dx} (3x + 1)^5 = 5(3x+1)^4 \cdot 3 = 15(3x+1)^4$。其中外部函数是$(\cdot)^5$，内部函数是$3x+1$。

- 链式法则是神经网络中**反向传播**的数学基础。深度网络是一串相互嵌套的函数链。为了计算损失相对于每个权重的变化情况，我们需要从输出层到输入层反复应用链式法则，每一步都乘以局部导数。

- 以下是你最常遇到的导数形式。虽然它们都可以从极限定义推导出来，但熟记它们能节省时间：

| 函数 | 导数 | 备注 |
| --- || --- || --- ||
| $e^x$ | $e^x$ | 唯一与其导数相等的函数 |
| $a^x$ | $a^x \ln a$ | 指数函数的推广 |
| $\ln x$ | $\frac{1}{x}$ | 自然对数 |
| $\log_a x$ | $\frac{1}{x \ln a}$ | 一般对数函数 |
| $\sin x$ | $\cos x$ | |
| $\cos x$ | $-\sin x$ | 注意负号 |
| $\tan x$ | $\sec^2 x$ | |

- 指数函数$e^x$非常特殊：它是唯一与其导数相等的函数。正因如此，$e$在机器学习中无处不在，从Softmax激活函数到概率分布都能见到它的身影。

- **洛必达法则**用于处理产生不定型极限的情况，如$\frac{0}{0}$或$\frac{\infty}{\infty}$。当直接代入得到这类结果时，可以分别对分子和分母求导后再求极限：

$$\lim_{x \to a} \frac{f(x)}{g(x)} = \lim_{x \to a} \frac{f'(x)}{g'(x)}$$

- 使用条件：$f$和$g$在$a$附近必须可导，且$g'(x) \neq 0$（可能在$a$点除外）。原极限必须是不定型。

- 例如：$\lim_{x \to 0} \frac{\sin x}{x}$。直接代入得到$\frac{0}{0}$。应用洛必达法则：$\lim_{x \to 0} \frac{\cos x}{1} = 1$。这个极限非常重要，它出现在信号处理与傅里叶分析中。

- 如果结果仍是不定型，可以重复使用该法则。比如，$\lim_{x \to 0} \frac{1 - \cos x}{x^2}$得到$\frac{0}{0}$。第一次应用：$\lim_{x \to 0} \frac{\sin x}{2x}$，仍为$\frac{0}{0}$。第二次应用：$\lim_{x \to 0} \frac{\cos x}{2} = \frac{1}{2}$。

- 如果两个函数可导，那么它们的和、差、积、复合以及商（分母不为零）也均可导。正因如此，我们才能放心地对由简单部分构成的复杂表达式进行求导。

## 编程任务（请使用CoLab或笔记本）

1. 可视化常见函数。将$x^2$、$\sin(x)$和$e^x$并排绘制，以直观理解不同公式如何产生不同的图形。尝试改变参数（如$2x^2$、$\sin(2x)$），观察曲线的变化。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

x = jnp.linspace(-3, 3, 300)

fig, axes = plt.subplots(1, 3, figsize=(12, 3))
axes[0].plot(x, x**2, color="#e74c3c")
axes[0].set_title("x²  (parabola)")
axes[1].plot(x, jnp.sin(x), color="#3498db")
axes[1].set_title("sin(x)  (wave)")
axes[2].plot(x, jnp.exp(x), color="#27ae60")
axes[2].set_title("eˣ  (exponential)")
for ax in axes:
    ax.axhline(0, color="gray", linewidth=0.5)
    ax.axvline(0, color="gray", linewidth=0.5)
plt.tight_layout()
plt.show()
```

1. 利用JAX的自动微分功能，计算函数$f(x) = x^3 - 2x + 1$在几个点处的导数。将其与解析导数$f'(x) = 3x^2 - 2$进行比较。

```python
import jax
import jax.numpy as jnp

f = lambda x: x**3 - 2*x + 1
df = jax.grad(f)

for x in [0.0, 1.0, 2.0, -1.0]:
    print(f"x={x:5.1f}  autodiff: {df(x):.4f}  analytical: {3*x**2 - 2:.4f}")
```

1. 通过数值方法验证链式法则。定义 $f(x) = \sin(x^2)$，利用 `jax.grad` 计算其导数，并与解析结果 $2x\cos(x^2)$ 进行比较。

```python
import jax
import jax.numpy as jnp

f = lambda x: jnp.sin(x**2)
df = jax.grad(f)

for x in [0.5, 1.0, 2.0]:
    auto = df(x)
    analytical = 2*x * jnp.cos(x**2)
    print(f"x={x:.1f}  autodiff: {auto:.6f}  analytical: {analytical:.6f}")
```

1. 可视化导数。在同一坐标系中绘制函数 $f(x) = x^3 - 3x$ 及其导数 $f'(x) = 3x^2 - 3$。注意 $f'(x) = 0$ 的点与 $f$ 的极值点之间的对应关系。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

f = lambda x: x**3 - 3*x
# jax.grad works on scalars; jax.vmap vectorises it to operate on an array of inputs at once
df = jax.vmap(jax.grad(f))

x = jnp.linspace(-2.5, 2.5, 200)
plt.plot(x, jax.vmap(f)(x), label="f(x)")
plt.plot(x, df(x), label="f'(x)", linestyle="--")
plt.axhline(0, color="gray", linewidth=0.5)
plt.legend()
plt.title("A function and its derivative")
plt.show()
```

## 积分学

积分学用于在区间上累加量值，将局部变化率还原为总量。本文档涵盖了定积分与不定积分、微积分基本定理、积分技巧，以及它们在机器学习中概率密度和期望值方面的应用。

- 微分告诉我们某一点的变化率；积分则反向操作：它将许多微小的部分累加以计算出总量。

- 如果导数回答的是“变化有多快？”，那么积分回答的就是“总量有多少？”

- 理解积分最简单的方式是将其视为**曲线下的面积**。如果你绘制函数$f(x)$，并将曲线与$x$轴之间从$x = a$到$x = b$的区域涂上阴影，那么积分就给出了该区域的带符号面积。

![积分通过累加细长的矩形来计算曲线下的面积](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/area_under_curve.svg)

- 为何称为“带符号”？$x$轴上方的区域贡献正面积，下方的区域贡献负面积。这在物理上有意义：若$f(x)$表示速度，积分给出的是净位移（前进减去后退），而非总路程。

- 要计算这个面积，可设想将该区域切成$n$个细长的垂直矩形，每个矩形的宽度为$\Delta x$。每个矩形的高度为该区间内某一点的函数值。将它们相加：

$$\text{面积} \approx \sum_{i=1}^{n} f(x_i^\ast) \, \Delta x$$

- 当矩形越来越薄（$n \to \infty$，$\Delta x \to 0$）时，求和结果便趋于精确。这一极限过程定义了**定积分**：

$$\int_a^b f(x)\, dx = \lim_{n \to \infty} \sum_{i=1}^{n} f(x_i^\ast) \, \Delta x$$

- 符号$\int$是字母“S”的变形，代表“求和”；$dx$提醒我们是在沿$x$轴对无穷小的片段进行求和。

- **不定积分**（或称**原函数**）是指其导数为$f(x)$的函数$F(x)$。我们记作：

$$\int f(x)\, dx = F(x) + C$$

- 其中的$+ C$称为**积分常数**。由于任何常数的导数均为零，因此存在无数个仅相差一个常数的原函数。例如，$\int 2x\, dx = x^2 + C$，因为$x^2 + 7$或$x^2 - 3$的导数仍然是$2x$。

- **微积分基本定理**是连接微分与积分的桥梁。它包含两部分：

- **第一部分**：若$F(x)$是$f(x)$的一个原函数，则定积分等于$F$在端点处的差值：

$$\int_a^b f(x)\, dx = F(b) - F(a)$$

- 这非常实用。我们无需计算复杂的极限求和，只需找到一个原函数并在两点处求值即可（通常较为简单）。

- **第二部分**：若定义$F(x) = \int_a^x f(t)\, dt$，则$F'(x) = f(x)$。微分与积分互为逆运算，它们可以相互抵消。

- 例如，要计算$\int_1^3 x^2\, dx$：$x^2$的原函数是$\frac{x^3}{3}$。因此$\int_1^3 x^2\, dx = \frac{27}{3} - \frac{1}{3} = \frac{26}{3} \approx 8.67$。

- 正如微分有相应的法则，积分也有与之对应的逆向法则：

| 函数 | 积分 | 条件 |
| --- || --- || --- ||
| $x^n$ | $\frac{x^{n+1}}{n+1} + C$ | $n \neq -1$ |
| $\frac{1}{x}$ | $\ln\|x\| + C$ | |
| $e^x$ | $e^x + C$ | |
| $a^x$ | $\frac{a^x}{\ln a} + C$ | |
| $\sin x$ | $-\cos x + C$ | |
| $\cos x$ | $\sin x + C$ | |
| $k$（常数） | $kx + C$ | |

- **和/差法则**同样适用：$\int [f(x) \pm g(x)]\, dx = \int f(x)\, dx \pm \int g(x)\, dx$。常数可以提出来：$\int k\, f(x)\, dx = k \int f(x)\, dx$。

- 当函数过于复杂无法直接积分时，我们有一些技巧来简化它。

- **换元法**是链式法则的逆过程。如果你发现复合函数$f(g(x))$乘以$g'(x)$，可令$u = g(x)$，则$du = g'(x)\, dx$，从而简化积分。

- 例如：$\int 2x \cos(x^2)\, dx$。令$u = x^2$，则$du = 2x\, dx$。积分变为$\int \cos(u)\, du = \sin(u) + C = \sin(x^2) + C$。

- **分部积分法**是乘积法则的逆过程。如果被积函数是两个函数的乘积：

$$\int u\, dv = uv - \int v\, du$$

- 需巧妙选择$u$和$dv$，使得剩下的积分$\int v\, du$比原积分更简单。选择$u$时常用的记忆口诀是**LIATE**：对数类、反三角函数类、代数类、三角函数类、指数类（按此顺序选取$u$）。

- 例如：$\int x\, e^x\, dx$。令$u = x$（代数类），$dv = e^x\, dx$。则$du = dx$，$v = e^x$。于是：$\int x\, e^x\, dx = x\, e^x - \int e^x\, dx = x\, e^x - e^x + C = e^x(x - 1) + C$。

- 在机器学习中，积分出现在概率论（通过积分密度函数计算概率）、期望值（连续分布上的加权平均值）以及ROC曲线下面积的计算中。尽管实践中我们很少手动积分，但理解积分的含义有助于解读这些量。

## 编程任务（使用CoLab或笔记本）

1. 使用黎曼和，用逐渐增多的矩形数量来数值近似$\int_0^1 x^2\, dx$。将其与精确值$\frac{1}{3}$进行比较。

```python
import jax.numpy as jnp

for n in [10, 100, 1000, 10000]:
    x = jnp.linspace(0, 1, n, endpoint=False)
    dx = 1.0 / n
    area = jnp.sum(x**2 * dx)
    print(f"n={n:5d}  approx: {area:.6f}  exact: {1/3:.6f}")
```

1. 通过数值方法验证微积分基本定理。定义 $F(x) = \int_0^x t^2\, dt = \frac{x^3}{3}$，并验证其导数（利用 `jax.grad` 计算）是否等于 $x^2$。

```python
import jax
import jax.numpy as jnp

F = lambda x: x**3 / 3
dF = jax.grad(F)

for x in [0.5, 1.0, 2.0, 3.0]:
    print(f"x={x:.1f}  F'(x)={dF(x):.4f}  x^2={x**2:.4f}")
```

1. 可视化函数$f(x) = \sin(x)$在$0$到$\pi$区间下的面积。使用`plt.fill_between`来填充该区域，并通过黎曼和数值计算其面积。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

x = jnp.linspace(0, jnp.pi, 500)
y = jnp.sin(x)

plt.plot(x, y, color="purple", linewidth=2)
plt.fill_between(x, y, alpha=0.2, color="purple")
plt.title(f"Area = {jnp.sum(jnp.sin(x) * (jnp.pi / 500)):.4f}  (exact: 2.0)")
plt.show()
```

## 多变量微积分

_多变量微积分将导数和积分的概念扩展到多变量函数上，这一点非常重要，因为机器学习模型通常包含数百万个参数。本文件介绍了偏导数、梯度、雅可比矩阵、海森矩阵以及多变量链式法则，这些都是实现反向传播所必需的。_

- 到目前为止，我们所处理的函数都是接受一个输入$x$并产生一个输出$f(x)$。但在机器学习中，我们几乎从不只使用一个变量。

- 想象一个包含两个变量的函数，比如$f(x, y) = x^2 + y^2$。它在三维空间中构成一个碗状的曲面。我们想要知道：如果在保持$y$不变的情况下稍微改变$x$的值，那么$f$会如何变化？这就是**偏导数**。

- $f$关于$x$的**偏导数**记作$\frac{\partial f}{\partial x}$，其计算方法是将其他所有变量视为常数，然后仅对$x$进行求导。

- 对于函数$f(x, y) = x^2y + 3x - 2y$：

$$\frac{\partial f}{\partial x} = 2xy + 3 \qquad \frac{\partial f}{\partial y} = x^2 - 2$$

- 在计算$\frac{\partial f}{\partial x}$时，我们将$y$视为常数，因此$x^2y$的导数为$2xy$，$3x$的导数为$3$，而$-2y$的导数为$0$。

- 在计算$\frac{\partial f}{\partial y}$时，我们将$x$视为常数，因此$x^2y$的导数为$x^2$，$3x$的导数为$0$，而$-2y$的导数为$-2$。

- 从几何上来看，对$x$求偏导数就相当于在固定$y$值的情况下，用与$xz$平面平行的平面去切割这个三维曲面，然后找出所得曲线的斜率。

![偏导数：通过固定一个变量来切割曲面](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/partial_derivative.svg)

- **梯度**则将所有的偏导数汇总成一个向量：

$$\nabla f = \left(\frac{\partial f}{\partial x_1}, \frac{\partial f}{\partial x_2}, \ldots, \frac{\partial f}{\partial x_n}\right)$$

- 对于函数$f(x, y) = x^2 + y^2$，有$\nabla f(x, y) = (2x, 2y)$。在点$(1, 2)$处，$\nabla f(1, 2) = (2, 4)$。

- 梯度具有两个重要特性：

- **方向**：它指向函数值上升最快的方向。想象一个在山上的徒步者，他所在位置的梯度就指向正上方，即上升最陡的那条路径。

- **大小**：$\|\nabla f\|$表示沿该上升最快方向的函数值增长速率。梯度越大，说明地形越陡峭；梯度越小，则说明地形较为平坦。

![梯度向量指向正上方，且与等高线垂直](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/gradient_contour.svg)

- 由于梯度指向正上方，因此沿着与梯度相反的方向移动（即$-\nabla f$）就会朝着函数值较低的方向前进。这一简单原理正是**梯度下降法**的基础，我们将在后续章节中详细探讨这种优化技术。目前需要记住的关键点是：梯度能够告诉我们“向上”的方向以及上升的陡峭程度。

- **方向导数**是对偏导数的推广。它不再询问“$f$沿$x$轴方向如何变化”，而是询问“$f$沿任意方向$\mathbf{u}$如何变化”。方向导数的计算方法是梯度与单位向量的点积：

$$D_{\mathbf{u}} f = \nabla f \cdot \mathbf{u}$$

- 对于函数$f(x, y) = x^2 + y^2$，在点$(1, 2)$处，沿方向$\mathbf{v} = (3, 4)$计算方向导数时，首先将$\mathbf{v}$标准化得到单位向量$\mathbf{u} = (3/5, 4/5)$，然后$D_{\mathbf{u}} f = (2, 4) \cdot (3/5, 4/5) = 6/5 + 16/5 = 22/5$。

- 当方向为坐标轴方向时，偏导数其实就是方向导数的特例。如果某个方向上的方向导数为零，那么在该点上函数沿该方向的值是恒定的，即函数在该方向上是平坦的。

- **等高线**则是连接函数值相同的各点的曲线。对于函数$f(x, y) = x^2 + y^2$，其等高线是以原点为圆心的圆：不同$c$值对应的方程为$x^2 + y^2 = c$。

- 等高线永远不会相交（一个点不可能具有两个不同的函数值）。

- 梯度始终与等高线垂直，且指向函数值较高的方向。

- 等高线间距较小时，说明地形较为陡峭；间距较大时，则说明地形较为平缓。

- 到目前为止，我们所处理的函数都只产生一个输出。但实际上，很多函数会产生多个输出。一个函数$\mathbf{F}: \mathbb{R}^n \to \mathbb{R}^m$会接受$n$个输入，并产生$m$个输出。**雅可比矩阵**则用于整理这类向量值函数的所有偏导数：

$$
J = \begin{bmatrix} \frac{\partial f_1}{\partial x_1} & \cdots & \frac{\partial f_1}{\partial x_n} \\ \vdots & \ddots & \vdots \\ \frac{\partial f_m}{\partial x_1} & \cdots & \frac{\partial f_m}{\partial x_n} \end{bmatrix}

$$

- 雅可比矩阵的每一行都对应一个输出量的梯度。对于一个具有3个输入和2个输出的函数，其雅可比矩阵为$2 \times 3$矩阵。

- 雅可比矩阵将导数的概念推广到了向量值函数上。

- 就像标量函数的导数可以表明输出随输入变化1个单位时会发生多大的变化一样，雅可比矩阵则能显示每个输出量随各个输入量变化的情况。

- **雅可比矩阵的行列式**用于衡量变换在局部范围内对空间的拉伸或压缩程度。

- 如果行列式的值为2，那么小区域的面积将会翻倍；如果行列式为0，则该变换会将空间压缩到更低维度（根据矩阵相关知识，行列式为0意味着该变换是奇异的、不可逆的）。

- 当多个变换依次叠加时，整体映射的雅可比矩阵就是各单个雅可比矩阵的乘积。这一概念在后续章节中会起到核心作用。

- 虽然梯度能够反映一阶信息（即斜率），但**海森矩阵**则可以反映二阶信息（即曲率）。

- 对于标量函数$f(x_1, \ldots, x_n)$，海森矩阵是由所有二阶偏导数构成的$n \times n$矩阵：

$$
H = \begin{bmatrix} \frac{\partial^2 f}{\partial x_1^2} & \frac{\partial^2 f}{\partial x_1 \partial x_2} & \cdots \\ \frac{\partial^2 f}{\partial x_2 \partial x_1} & \frac{\partial^2 f}{\partial x_2^2} & \cdots \\ \vdots & \vdots & \ddots \end{bmatrix}

$$

- 对于函数 $f(x, y) = x^3 + 2xy^2 - y^3$，其梯度为 $(3x^2 + 2y^2,\; 4xy - 3y^2)$，而海森矩阵为：

$$
H = \begin{bmatrix} 6x & 4y \\ 4y & 4x - 6y \end{bmatrix}

$$

- 对角线元素（$6x$和$4x - 6y$）表示当在$x$方向上移动时，$x$方向上的斜率如何变化；$y$方向同理。

- 非对角线元素（$4y$）表示当在某个方向上移动时，另一个方向上的斜率如何变化。

- **克莱罗定理**指出，对于具有连续二阶导数的函数，其混合偏导数是相等的：$\frac{\partial^2 f}{\partial x \partial y} = \frac{\partial^2 f}{\partial y \partial x}$。

- 这意味着赫西矩阵是对称的，而根据矩阵章节的内容，对称矩阵必然具有实数特征值和正交特征向量。

- 赫西矩阵可以告诉我们函数在临界点（梯度为零的点）附近的形状：

- 如果$H$是正定的（所有特征值均为正），则该点是**局部最小值点**，函数表面在各个方向上都是向上凸起的，就像一个碗。
- 如果$H$是负定的（所有特征值均为负），则该点是**局部最大值点**，函数表面在各个方向上都是向下凹陷的，就像一个倒置的碗。
- 如果$H$既有正特征值也有负特征值，则该点是**鞍点**，函数表面在某些方向上向上凸起，在其他方向上则向下凹陷，就像山口一样。

- **多变量链式法则**将链式法则扩展到多变量函数。如果$z = f(x, y)$，且$x = g(t)$、$y = h(t)$，那么：

$$\frac{dz}{dt} = \frac{\partial f}{\partial x}\frac{dx}{dt} + \frac{\partial f}{\partial y}\frac{dy}{dt}$$

- 从$t$到$z$的每条路径都会贡献一项：沿着该路径的偏导数乘以中间变量对$t$的导数。

- 例如，若$z = x^2 y + 3x - y^2$，$x = \cos(t)$，$y = \sin(t)$，则：

$$\frac{dz}{dt} = (2xy + 3)(-\sin t) + (x^2 - 2y)(\cos t)$$

- 除了手动计算导数之外，还有三种方法：

- **数值微分**：对于较小的$h$，用$f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}$来近似计算导数。这种方法简单，但结果容易有误差且不够精确。
- **符号微分**：通过代数方法应用微分规则，从而得到精确的公式。不过这种方法得到的表达式可能会变得极其复杂。
- **自动微分**：能够追踪运算过程并高效地计算出精确的导数。JAX、PyTorch和TensorFlow都采用了这种技术。它能够给出精确的数值结果，而不会产生复杂的符号表达式。

## 编程任务（使用CoLab或笔记本）（续1）

1. 使用`jax.grad`计算函数$f(x, y) = x^2 y + 3x - 2y$在点$(1, 2)$处的梯度。由于$f$接受向量作为输入，因此需要使用带有`argnums`参数的`jax.grad`。

```python
import jax
import jax.numpy as jnp

def f(x, y):
    return x**2 * y + 3*x - 2*y

df_dx = jax.grad(f, argnums=0)
df_dy = jax.grad(f, argnums=1)

x, y = 1.0, 2.0
print(f"∂f/∂x = {df_dx(x, y):.4f}  (expected: {2*x*y + 3:.4f})")
print(f"∂f/∂y = {df_dy(x, y):.4f}  (expected: {x**2 - 2:.4f})")
```

1. 使用`jax.jacobian`计算向量值函数的雅可比矩阵，并与手动计算结果进行比较。

```python
import jax
import jax.numpy as jnp

def F(x):
    return jnp.array([x[0]**2 + x[1], x[0] * x[1]**2])

J = jax.jacobian(F)
x = jnp.array([1.0, 2.0])
print(f"Jacobian at (1,2):\n{J(x)}")
# Expected: [[2*x[0], 1], [x[1]**2, 2*x[0]*x[1]]] = [[2, 1], [4, 4]]
```

1. 使用 `jax.hessian` 计算函数 $f(x, y) = x^3 + 2xy^2 - y^3$ 的海森矩阵，并验证该矩阵是对称的。

```python
import jax
import jax.numpy as jnp

def f(xy):
    x, y = xy[0], xy[1]
    return x**3 + 2*x*y**2 - y**3

H = jax.hessian(f)
point = jnp.array([1.0, 2.0])
hess = H(point)
print(f"Hessian:\n{hess}")
print(f"Symmetric: {jnp.allclose(hess, hess.T)}")
# Expected: [[6x, 4y], [4y, 4x-6y]] = [[6, 8], [8, -8]]
```

1. 从零开始构建一个最简单的自动微分引擎。

- 每个`Var`都会记录自身的值，以及如何通过链式法则将梯度反向传播。
- 可以尝试为其添加更多运算功能（除法、幂运算等）。
- 这正是JAX、PyTorch和Numpy设计时的基础理念。

```python
class Var:
    def __init__(self, val, children=(), backward_fn=None):
        self.val = val
        self.grad = 0.0
        self.children = children
        self.backward_fn = backward_fn

    def __add__(self, other):
        out = Var(self.val + other.val, children=(self, other))
        def _backward():
            self.grad += out.grad    # d(a+b)/da = 1
            other.grad += out.grad   # d(a+b)/db = 1
        out.backward_fn = _backward
        return out

    def __mul__(self, other):
        out = Var(self.val * other.val, children=(self, other))
        def _backward():
            self.grad += other.val * out.grad  # d(a*b)/da = b
            other.grad += self.val * out.grad  # d(a*b)/db = a
        out.backward_fn = _backward
        return out

    def backward(self):
        # topological sort then propagate gradients
        # we will go through this in data structures and algorithms
        order, visited = [], set()
        def topo(v):
            if v not in visited:
                visited.add(v)
                for c in v.children:
                    topo(c)
                order.append(v)
        topo(self)
        self.grad = 1.0
        for v in reversed(order):
            if v.backward_fn:
                v.backward_fn()

# f(x, y) = x*x*y + x  at (3, 2)
x = Var(3.0)
y = Var(2.0)
f = x * x * y + x       # = 3*3*2 + 3 = 21

f.backward()
print(f"f = {f.val}")           # 21.0
print(f"df/dx = {x.grad}")     # 2*x*y + 1 = 13.0
print(f"df/dy = {y.grad}")     # x*x = 9.0
```

## 函数逼近

_函数逼近用较简单的函数去替代复杂的函数，只要两者足够接近即可。本文涵盖了线性化、泰勒级数、多项式逼近、傅里叶级数以及通用逼近定理——这些正是神经网络能够学习任意映射的理论基础。_

- 我们遇到的许多函数过于复杂，无法直接处理。比如在纸上计算$e^{0.1}$、预测卫星轨迹等，都涉及没有简单封闭解的函数。

- **函数逼近**就是用在我们关心的区域内“足够接近”的简单函数来替代复杂的函数。

- 最自然的逼近方式是多项式。多项式只是$x$的各次幂与系数的乘积之和，它们易于求值、求导和积分。

- 但为什么多项式能如此出色地作为逼近工具呢？不妨看看$x$的每一次幂所起的作用：

- 常数项$a_0$决定了基准值。
- $a_1 x$项增加了斜率。
- $a_2 x^2$项引入了曲率。
- 更高的幂次则能捕捉函数形状的更细微特征。

![每个多项式项都为逼近结果增添了一层细节](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/polynomial_buildup.svg)

- 通过选择合适的系数，我们可以逐点匹配函数在某一点的取值、斜率、曲率以及更高阶的行为。

- 只要项数足够多，多项式就能模拟几乎任何光滑函数。

- 问题随之而来：如何找到合适的系数呢？

- **线性化**是最简单的逼近方式。在点$x = a$附近，我们用函数的切线来替代它：

$$L(x) = f(a) + f'(a)(x - a)$$

- 这就是一阶**泰勒逼近**。其思路是：从已知值$f(a)$出发，再根据斜率乘以与$a$的距离进行调整。

- 例如，在$x = 0$处对$\sin(x)$进行线性化：$f(0) = 0$，$f'(0) = \cos(0) = 1$，因此$L(x) = x$。在零附近，$\sin(x) \approx x$。试一下：$\sin(0.1) = 0.0998\ldots \approx 0.1$。

- 但线性化仅在非常靠近$a$的区域才有效。一旦偏离较远，逼近效果就会变差。为了获得更好的结果，我们需要加入更高阶的项。

- **泰勒级数**将函数表示为无穷多项多项式之和，每一项都能捕捉函数在点$a$附近的更细微特征：

$$f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x - a)^n = f(a) + f'(a)(x-a) + \frac{f''(a)}{2!}(x-a)^2 + \frac{f'''(a)}{3!}(x-a)^3 + \cdots$$

![泰勒级数：增加更多项能得到更精确的逼近](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/taylor_approximation.svg)

- 每一项都起到修正作用：第一项匹配函数值，第二项匹配斜率，第三项匹配曲率，以此类推。包含的项越多，逼近精确的区域就越大。

- 分母中的$n!$并非随意设定。对$(x - a)^n$求恰好$n$次导数后会得到$n!$，阶乘项正好抵消这一结果，从而确保泰勒多项式的第$n$阶导数在$x = a$处与原函数的第$n$阶导数相等。

- **麦克劳林级数**就是以$a = 0$为中心的泰勒级数：

$$f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(0)}{n!} x^n$$

- 一些著名的麦克劳林级数如下：

$$e^x = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \cdots$$

$$\sin x = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \frac{x^7}{7!} + \cdots$$

$$\cos x = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \frac{x^6}{6!} + \cdots$$

- 注意：$\sin x$只包含奇数次幂（它是奇函数），而$\cos x$只包含偶数次幂（它是偶函数）。交替的符号使得逼近结果在真实值周围振荡，从两侧逐渐收敛。

- 我们用四项来逼近$e^{0.5}$：$1 + 0.5 + \frac{0.25}{2} + \frac{0.125}{6} = 1 + 0.5 + 0.125 + 0.02083 \approx 1.6458$。真实值为$1.6487\ldots$，可见仅四项就给出了三位正确的小数位。

- 并非所有泰勒级数都在各处收敛。**收敛半径**指明了以$a$为中心多大范围内级数才能给出有效结果。在该半径内，通过增加项数可使多项式逼近达到任意所需的精确度；超出该范围，级数便会发散。

- **幂级数**是一般形式：$\sum_{n=0}^{\infty} a_n (x - c)^n$。泰勒级数是一种幂级数，其系数由导数决定；其他幂级数可能依据其他规则定义。**比值判别法**用于判断收敛性：计算$\lim_{n \to \infty} \left|\frac{a_{n+1}}{a_n}\right|$。若该极限为$L$，则收敛半径为$R = 1/L$。

- 当我们只取泰勒级数的前$n$项时，就会产生误差。**拉格朗日余项**可以界定这一误差：

$$R_n(x) = \frac{f^{(n+1)}(c)}{(n+1)!}(x-a)^{n+1}$$

- 这里的$c$是介于$a$与$x$之间的某个未知点。虽然我们无法确切知道$c$的值，但通常可以限定$|f^{(n+1)}(c)|$的范围，从而得到最坏情况下的误差估计。分母中的$(n+1)!$增长极快，因此随着项数增加误差会迅速减小（对于收敛半径内的函数而言）。

- 对于多变量函数，泰勒展开会包含混合偏导数。函数$f(\mathbf{x})$在点$\mathbf{a}$处的二阶逼近为：

$$f(\mathbf{x}) \approx f(\mathbf{a}) + \nabla f(\mathbf{a})^T (\mathbf{x} - \mathbf{a}) + \frac{1}{2} (\mathbf{x} - \mathbf{a})^T H(\mathbf{a}) (\mathbf{x} - \mathbf{a})$$

- 第一项是函数值，第二项利用梯度（向量，如多元微积分中所述），第三项则使用海森矩阵（用于描述曲率）。这将我们的矩阵章节直接与微积分联系起来：海森矩阵是由二阶导数构成的矩阵，用于刻画函数曲面的形状。
- 这种多变量二阶逼近是牛顿法及其他二阶优化技术的基础，我们将在下一个文件中看到相关内容。

- 除了多项式之外，还有其他值得了解的逼近方法：

- **样条插值**：不用一个高次多项式，而是使用多个低次多项式平滑拼接而成。这样可以避免高次多项式可能产生的剧烈振荡。
- **傅里叶级数**：将周期函数近似为正弦和余弦函数的和。在信号处理和音频领域至关重要。
- **神经网络**：通用函数逼近器。只要神经元数量足够多，它们就能以任意精度逼近任何连续函数。这就是深度学习的理论依据。

- 如果一个函数具备使逼近可靠的属性，则称其为“行为良好”：连续性（无跳跃）、可微性（无尖角）、光滑性（各阶导数均存在）以及有界性（输出值保持有限）。

- 多项式、指数函数和三角函数都属于行为良好的函数。函数的行为越良好，进行良好逼近所需的泰勒项数就越少。

## 编程任务（使用CoLab或笔记本）（续2）

1. 使用越来越多的泰勒项来逼近$e^x$，并可视化逼近效果的改善情况。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

x = jnp.linspace(-2, 3, 300)
plt.plot(x, jnp.exp(x), "k-", linewidth=2, label="eˣ (exact)")

colors = ["#e74c3c", "#3498db", "#27ae60", "#9b59b6"]
for n, color in zip([1, 2, 4, 8], colors):
    approx = sum(x**k / jnp.array(float(jnp.prod(jnp.arange(1, k+1)) if k > 0 else 1))
                 for k in range(n+1))
    plt.plot(x, approx, color=color, linestyle="--", label=f"{n} terms")

plt.ylim(-2, 15)
plt.legend()
plt.title("Taylor approximation of eˣ")
plt.show()
```

1. 计算拉格朗日余项，以限定用不同数量的泰勒项近似$\sin(1)$时的误差。

```python
import jax.numpy as jnp

x = 1.0
exact = jnp.sin(x)

taylor = 0.0
for n in range(8):
    sign = (-1)**n
    factorial = float(jnp.prod(jnp.arange(1, 2*n+2)))
    taylor += sign * x**(2*n+1) / factorial
    error = abs(exact - taylor)
    bound = x**(2*n+3) / float(jnp.prod(jnp.arange(1, 2*n+4)))
    print(f"terms={n+1}  approx={taylor:.10f}  error={error:.2e}  bound={bound:.2e}")
```

1. 比较在 $x = 0$ 附近对 $\cos(x)$ 的线性近似与二次泰勒近似。将两种近似结果与真实函数一同绘制出来，观察各自精确的范围。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

x = jnp.linspace(-3, 3, 300)
plt.plot(x, jnp.cos(x), "k-", linewidth=2, label="cos(x)")
plt.plot(x, jnp.ones_like(x), "--", color="#e74c3c", label="linear: 1")
plt.plot(x, 1 - x**2/2, "--", color="#3498db", label="quadratic: 1 - x²/2")
plt.plot(x, 1 - x**2/2 + x**4/24, "--", color="#27ae60", label="4th order")
plt.ylim(-2, 2)
plt.legend()
plt.title("Taylor approximations of cos(x)")
plt.show()
```

## 最优化

_最优化是模型训练的数学核心，其目标是为损失函数找到能够使其值最小的参数。本文件涵盖了临界点、凸性、梯度下降法、牛顿法、利用拉格朗日乘数的约束最优化方法，以及推动现代深度学习发展的各种优化器（如SGD、Adam）。_

- 训练神经网络、拟合回归直线、调整超参数：几乎所有机器学习算法的核心都涉及**最优化**问题。
- 我们有一个函数（损失函数、成本函数或目标函数），希望找到能让该函数值尽可能小（或大）的输入值。
- 在进行最优化之前，我们需要了解函数的**零点**。函数$f(x)$的零点是指使得$f(x) = 0$的$x$值。从图形上看，这些点就是函数的x轴截距。
- 例如，函数$f(x) = x^2 - 3x + 2 = (x-1)(x-2)$的零点为$x = 1$和$x = 2$。在零点之间，函数值为负数（$f(1.5) = -0.25$）；而在零点之外，函数值为正数。零点将数轴划分为函数符号保持不变的区间。
- 零点的**重数**指的是对应因式出现的次数。
- 对于重数为1的简单零点，函数图会穿过x轴；而对于重数为2的双零点，函数图仅与x轴相切而不穿过，因此在这一点上函数图看起来是“平坦”的。
- 找到零点非常重要，因为导数$f'(x)$的零点就是函数$f(x)$的**临界点**，这些点可能是函数的最大值点或最小值点。
- 在最大值点或最小值点处，函数的切线是水平的（斜率为0），因此有$f'(x) = 0$。

![临界点：导数为零的点，函数在此处出现峰值、谷值或鞍点](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/critical_points.svg)

- 但并非所有的临界点都是最大值点或最小值点。当$f'(x) = 0$时，该点也可能是一个**拐点**（比如函数$f(x) = x^3$在$x = 0$处的情况），此时函数图会暂时变平，但不会改变走向。
- **二阶导数检验**可以解决这个问题。对于临界点$x = c$且$f'(c) = 0$的情况：
- 如果$f''(c) > 0$，则曲线呈向上凹的形状（类似碗状），因此$c$是**局部最小值点**。
- 如果$f''(c) < 0$，则曲线呈向下凹的形状（类似山丘），因此$c$是**局部最大值点**。
- 如果$f''(c) = 0$，则该检验无法给出结论，需要使用更高阶的导数或其他方法。
- 例如，函数$f(x) = x^3 - 3x$的导数为$f'(x) = 3x^2 - 3 = 3(x-1)(x+1)$，因此临界点为$x = -1$和$x = 1$。其二阶导数为$f''(x) = 6x$。在$x = -1$处，$f''(-1) = -6 < 0$，故该点是局部最大值点；在$x = 1$处，$f''(1) = 6 > 0$，故该点是局部最小值点。
- 如果函数图像上任意两点之间的线段都位于函数图像之上（或恰好在函数图像上），则该函数为**凸函数**。可以将其想象成碗的形状，到处都是向上的弯曲。从数学上讲，如果对所有$x$都有$f''(x) \geq 0$，则函数$f$是凸函数。

![凸函数具有唯一的全局最小值；非凸函数则可能存在多个局部最小值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/convex_nonconvex.svg)

- 凸函数具有非常重要的性质：它的每一个局部最小值同时也是**全局最小值**。不存在会让人误入歧途的局部谷值。如果把球滚进一个凸形的碗里，球最终一定会到达底部。
- 如果$-f$是凸函数，那么原函数就是**凹函数**（即函数图像向下弯曲）。函数从凹态变为凸态的点称为**拐点**，这类点满足$f''(x) = 0$的条件。
- **牛顿法**利用切线来寻找函数的零点（进而也可找到其导数的临界点）。该方法从初始猜测值$x_0$开始，通过迭代不断优化数值：

$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}$$

![牛顿法：通过切线来更精确地逼近根值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/newtons_method.svg)

- 其原理是：在$x_n$处画出切线，然后找到该切线与x轴的交点，这个交点就是$x_{n+1}$的值。对于那些行为良好的函数，只要初始值选择得当，牛顿法就能非常快速地收敛（收敛速度为二次方级，即每一步正确数字的位数大约翻一番）。
- 例如，要计算$\sqrt{5}$（即函数$f(x) = x^2 - 5$的零点），由于$f'(x) = 2x$，因此有$x_{n+1} = x_n - \frac{x_n^2 - 5}{2x_n}$。以$x_0 = 2$作为初始值，可得到$x_1 = 2.25$，$x_2 = 2.2361\ldots$，这样的精度已经可以达到小数点后四位。
- 如果初始猜测值与真实根值相差很远，或者在根值附近有$f'(x) = 0$的情况，又或者函数附近存在拐点，那么牛顿法就可能失效。此外，该方法还需要计算导数，而这可能是一项代价较高的操作。
- 对于最优化问题（即寻找最小值而非零点），我们可以将牛顿法应用于方程$f'(x) = 0$，此时的更新公式为：

$$x_{n+1} = x_n - \frac{f'(x_n)}{f''(x_n)}$$

- 在多维空间中，该公式变为$\mathbf{x}_{n+1} = \mathbf{x}_n - H^{-1} \nabla f(\mathbf{x}_n)$，其中$H$为海森矩阵。这实际上就是前面文件中提到的二阶泰勒近似方法：将函数近似为二次函数，然后找到该二次函数的最小值，再重复这一过程。
- **拉格朗日乘数法**用于解决**约束最优化**问题：即在约束条件$g(x, y) = c$的前提下，寻找函数$f(x, y)$的最优解。我们不必在整个$\mathbb{R}^n$空间中搜索，而只需在满足约束条件的集合内寻找（该集合可能是一条曲线或一个曲面）。
- 其核心几何原理是：在约束最优解处，函数$f$的梯度必须与约束条件$g$的梯度平行。如果两者不平行，我们就可以沿着约束条件朝某个方向移动，而仍然能使函数$f$的值进一步减小，因此此时还不是最优解。
- 我们引入一个新的变量$\lambda$（即拉格朗日乘数），并定义**拉格朗日函数**：

$$\mathcal{L}(x, y, \lambda) = f(x, y) - \lambda(g(x, y) - c)$$

- 令拉格朗日函数的所有偏导数都等于零，就可以得到一组方程，这些方程的解就是约束最优解：

$$\frac{\partial \mathcal{L}}{\partial x} = 0, \quad \frac{\partial \mathcal{L}}{\partial y} = 0, \quad \frac{\partial \mathcal{L}}{\partial \lambda} = 0$$

![拉格朗日乘数法：在最优解处，f和g的梯度方向相同](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/lagrange_multiplier.svg)

- 例如，在约束条件$x^2 + y^2 = 1$下最大化$f(x,y) = x^2 y$。对应的拉格朗日函数为$\mathcal{L} = x^2 y - \lambda(x^2 + y^2 - 1)$。对各个变量求偏导后可得：

$$2xy - 2\lambda x = 0, \quad x^2 - 2\lambda y = 0, \quad x^2 + y^2 = 1$$

- 从第一个方程出发（假设$x \neq 0$），可得到$\lambda = y$。将其代入第二个方程可得$x^2 = 2y^2$。结合约束条件$x^2 + y^2 = 1$，可解得$y = \frac{1}{\sqrt{3}}$。此时函数的最大值为$f = \frac{2}{3\sqrt{3}}$。

- 对于不等式约束条件（即$g(x,y) \leq c$而非$= c$），则需使用**卡鲁什-库恩-塔克条件**来替代拉格朗日乘数法。此时约束条件要么是活跃的（即需要满足该约束，视为等式处理），要么是不活跃的（即解位于约束条件的内部，该约束无关紧要）。

- 在实际应用中，我们很少手动进行优化计算。以下是常见的优化算法类别：

- **一阶方法**（仅利用梯度信息）：梯度下降法、随机梯度下降法（SGD）、Adam算法。这类方法的每步计算成本较低，但收敛速度可能较慢，尤其是在问题条件不佳的情况下。

- **二阶方法**（同时利用梯度和海森矩阵）：牛顿法收敛速度很快，但由于需要计算并求逆海森矩阵，其计算成本较高（当参数数为$n$时，计算复杂度为$O(n^3)$）。**拟牛顿法**（如BFGS和L-BFGS）则仅利用梯度信息来近似海森矩阵，因此其收敛速度比一阶方法快，又无需承担二阶方法的过高计算成本。

- **共轭梯度法**：适用于大型稀疏系统，只需进行矩阵-向量运算，无需存储完整的海森矩阵，因此效率很高。

- **高斯-牛顿法**和**莱文伯格-马夸特法**：专为最小二乘问题设计（常见于回归分析中），通过雅可比矩阵来近似海森矩阵。

- **自然梯度下降法**：利用费希尔信息矩阵来考虑参数空间的几何结构，对于概率模型而言可能更为有效。

- 选择哪种优化算法取决于具体问题的特点。在深度学习领域，由于参数数量极其庞大（数百万甚至数十亿），海森矩阵的计算几乎不可行，因此一阶方法（尤其是Adam算法）更为常用。而对于那些目标函数较为平滑、规模较小的问题，二阶方法的收敛速度则要快得多。

## 编程任务（可使用CoLab或笔记本完成）

1. 实现牛顿法来求解$\sqrt{7}$（即函数$f(x) = x^2 - 7$的零点）。观察该方法快速的收敛过程。

```python
import jax.numpy as jnp

f = lambda x: x**2 - 7
df = lambda x: 2*x

x = 3.0  # initial guess
for i in range(6):
    x = x - f(x) / df(x)
    print(f"step {i+1}: x = {x:.10f}  (error: {abs(x - jnp.sqrt(7.0)):.2e})")
```

1. 使用梯度下降法最小化函数 $f(x, y) = (x - 3)^2 + (y + 1)^2$。该函数的最低点位于 $(3, -1)$。可以尝试不同的学习率来观察效果。

```python
import jax
import jax.numpy as jnp

def f(params):
    x, y = params
    return (x - 3)**2 + (y + 1)**2

grad_f = jax.grad(f)
params = jnp.array([0.0, 0.0])
lr = 0.1

for i in range(20):
    g = grad_f(params)
    params = params - lr * g
    if i % 5 == 0 or i == 19:
        print(f"step {i:2d}: ({params[0]:.4f}, {params[1]:.4f})  loss={f(params):.6f}")
```

1. 用数值方法求解带约束的最优化问题。在约束条件$x + y = 10$下，最大化函数$f(x,y) = xy$，具体方法是令$y = 10 - x$，进而求出该一元函数的最大值。

```python
import jax
import jax.numpy as jnp

# Substitute constraint: y = 10 - x, so f = x(10 - x) = 10x - x²
f = lambda x: x * (10 - x)
df = jax.grad(f)

# Gradient ascent (we want maximum, so add gradient)
x = 1.0
lr = 0.1
for i in range(20):
    x = x + lr * df(x)
print(f"x={x:.4f}, y={10-x:.4f}, f={f(x):.4f}")  # should be x=5, y=5, f=25
```

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
