---
title: "图神经网络"
date: "2026-11-05"
order: 12
slug: "compendium/12-graph-neural-networks"
description: "几何深度学习是一个统一的框架，它揭示了CNN、Transformer和GNN都是同一原理的体现：利用对称性。本文涵盖了对称群、群作用、不变性、等变性、五种几何域以及尺度分离等内容。"
tags: []
---

## 几何深度学习

_几何深度学习是一个统一的框架，它揭示了CNN、Transformer和GNN都是同一原理的体现：利用对称性。本文涵盖了对称群、群作用、不变性、等变性、五种几何域以及尺度分离等内容。_

- 在本书中，我们研究了多种架构：用于图像的CNN（第8章）、用于语言的Transformer（第7章），以及用于序列决策的强化学习策略（第6章）。这些模型看似是为完全不同的问题设计的。但实际上存在更深层的规律。

- **几何深度学习**揭示出，所有这些架构都遵循同一个理念：构建能够尊重数据**对称性**的网络。CNN利用图像中的平移对称性；Transformer利用序列中的排列对称性（注意力机制不依赖于绝对位置）；GNN则利用图中的排列对称性。一旦理解了这一点，各种架构便构成了一个连贯统一的框架。

## 对称性与群

- 一个物体的**对称性**是指使其保持不变的变换。正方形有8种对称性：4种旋转（0°、90°、180°、270°）和4种反射。圆则有无限多种对称性：任何绕其中心的旋转。关键在于，对称性告诉我们哪些因素无关紧要，而了解这一点对机器学习而言具有巨大价值。

- 从机器学习的角度看：如果某个任务具有对称性，那么无论输入呈现何种“版本”，模型都应给出相同的结果。猫检测器无论猫位于图像的左上角还是右下角，都应能正确识别。这就是平移对称性。

- 对称性被形式化为**群**。一个群$G$是一组满足以下四个性质的变换：

- **封闭性**：两个变换的组合仍属于该集合。例如，旋转90°后再旋转90°得到180°，仍在集合中。
- **结合律**：$(g_1 \circ g_2) \circ g_3 = g_1 \circ (g_2 \circ g_3)$。组合顺序不影响结果（可参考第2章中矩阵乘法的结合律）。
- **单位元**：存在一个“什么都不做”的变换$e$，使得$e \circ g = g \circ e = g$。
- **逆元**：每个变换都存在对应的逆变换：$g \circ g^{-1} = e$。

- 这些公理与向量空间（第1章）类似，只是对象从向量换成了变换。二者之间的联系十分深刻：群作用于向量空间，而神经网络必须尊重这种作用。

- 深度学习中常见的重要群包括：

- **平移群**$(\mathbb{R}^n, +)$：用于平移图像或信号。这是CNN所利用的对称性。
- **对称群**$S_n$：对$n$个元素的全部排列。这是GNN和Transformer所利用的对称性（重新排序节点或令牌不应改变结果）。
- **旋转群**$SO(n)$：$n$维空间中的所有旋转。$SO(2)$表示平面内的旋转，$SO(3)$表示三维空间的旋转（对分子建模和3D视觉任务至关重要）。
- **欧几里得群**$E(n)$：所有的旋转、反射和平移。这是物理空间的对称性。
- **特殊欧几里得群**$SE(n)$：旋转和平移（不含反射）。这是刚体运动的对称性。

- **群作用**描述了群如何变换数据。若$G$是一个群，$X$是数据空间，则作用$\rho: G \times X \to X$将每个群元素$g$和数据点$x$映射为变换后的点$\rho(g, x)$。对于图像，平移群通过移动像素坐标来起作用；对于图，对称群通过重新标记节点来起作用。

## 不变性与等变性

- 给定一个对称群，函数可以与之产生两种重要的关系：

- 若函数$f$对群$G$是**不变的**，则输入发生变换时输出保持不变：

$$f(\rho(g, x)) = f(x) \quad \text{对所有 } g \in G$$

- 示例：图像整体亮度在平移后不会改变。图像分类应具备平移不变性：“猫”这一类别无论猫位于何处都应被正确识别。

- 若函数$f$对群$G$是**等变的**，则输入变换会导致输出以相应方式变换：

$$f(\rho_{\text{in}}(g, x)) = \rho_{\text{out}}(g, f(x)) \quad \text{对所有 } g \in G$$

- 示例：若将图像向右平移5个像素，CNN中的特征图也会向右平移5个像素。卷积运算具有平移等变性：它能保持空间关系。物体检测应具备等变性：若猫移动，边界框也应随之移动。

![不变性：无论怎样变换，输出都保持不变；等变性：输出会相应变换](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/invariance_vs_equivariance.svg)

- 这种区别很重要：**中间层**通常应具等变性（为后续层保留结构），而**最终输出**则应具不变性（结果不应依赖于变换）。CNN通过堆叠等变卷积层，最后应用全局池化（具有不变性）来实现这一点。

- 在架构中直接融入等变性远比从数据中学习更高效。采用权重共享的平移等变CNN所需的参数远少于全连接网络——后者必须分别学习“位于(10,10)位置的猫”和“位于(200,150)位置的猫”。对称性约束使假设空间呈指数级缩小。

## 五种几何域

- 几何深度学习识别出**五种基本的数据域**，每种域都有其对应的对称群。所有神经网络架构都可以理解为利用了某一特定域的对称性。

![五种几何域：网格、集合、序列、图和流形，各自拥有不同的对称性和架构](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/five_geometric_domains.svg)

- **1. 网格（欧几里得数据）**：图像、音频频谱图、体数据。其底层结构是具有平移对称性的规则网格。对应的对称群为平移群（可能还包括旋转和反射）。利用这种对称性的架构就是**CNN**：卷积正是与平移等变的运算。在空间位置上共享权重，正是平移等变性的具体体现。

- **2. 集合（无序集合）**：点云、粒子系统。其对称性为排列不变性：元素的顺序无关紧要。相应的架构是**DeepSets**（以及第8章介绍的PointNet）：对每个元素应用相同的函数，再通过排列不变的运算（求和、取均值或取最大值）进行聚合。形式上可表示为：$f(\{x_1, \ldots, x_n\}) = \phi\left(\sum_i \psi(x_i)\right)$。

- **3. 序列（有序数据）**：文本、时间序列。序列可以视为一维网格，但有其特殊性：对称性更为微妙。绝对位置可能重要，也可能不重要。RNN以自回归方式处理序列。带有位置编码的Transformer能够关注任意位置，且其自注意力机制在加入位置编码前具有排列等变性。这正是Transformer泛化能力强的原因：它们从排列等变出发，再添加适量的位置结构。

- **4. 图（关系数据）**：社交网络、分子、知识图谱。其对称性体现在节点的排列上：重新标记节点不应改变图的属性。相应的架构是**GNN**：通过共享的函数在相连节点间传递信息，这些函数不依赖于节点的顺序。这也是本章后续内容的重点。

- **5. 流形与网格**：曲面、三维形状。其对称性包括微分同胚（平滑变形）。相应的架构使用由曲面几何本身定义的内在算子（如拉普拉斯-贝尔特拉米算子），这些算子与曲面在空间的嵌入方式无关。这与微分几何密切相关，适用于形状分析、球面气候建模以及蛋白质表面分析。

- 这一框架的强大之处在于其统一性：CNN实际上是网格图上的GNN；Transformer是全连通图上的GNN；DeepSets则是没有边的GNN。将这些视为同一原理的不同实例，有助于指导新架构的设计：识别数据的对称性，并构建能尊重该对称性的网络。

## 尺度分离与粗粒化

- 现实世界的数据具有多尺度结构。图像包含像素级的细微纹理、局部模式（边缘、角点）、物体部件（车轮、窗户）以及全局结构（整个场景）。分子则具有原子级特征、官能团以及整体分子形状。

- **尺度分离**是指这些细节层次可以分层处理：先捕捉局部结构，再逐步聚合成更粗略的表示。这就是**粗粒化**或**池化**。

- 在CNN中，池化层（最大池化、平均池化）会降低空间分辨率，迫使高层网络捕捉更大尺度的模式。从感受野的角度来看（第8章），深层网络能“看到”更多的图像内容。这就是尺度分离的实际应用。

- 在图中，粗粒化意味着将一组节点聚类为“超节点”，从而生成保留核心结构的小型图。这就是图池化，我们将在第3个文件中详细讨论。它与图像池化的类比很直接：在降低分辨率的同时保留重要特征。

- 在序列中，分层处理（如句子→段落→文档）能捕捉不同时间或语义尺度上的结构。Swin Transformer（第8章）将其思想应用于图像，采用移位窗口层级结构。

- 从数学上看，粗粒化定义了**越来越抽象的表示层次**：

$$x \xrightarrow{\text{局部特征}} h^{(1)} \xrightarrow{\text{粗粒化}} h^{(2)} \xrightarrow{\text{粗粒化}} \cdots \xrightarrow{\text{全局}} y$$

- 在每个层次上，表示都与该层次的对称群保持等变性。最终的全局表示则具有不变性，能够捕捉输入的本质，而不受无关变换的影响。

- 正是这种层次结构使得深度网络在处理结构化数据时优于浅层网络：每一层都增加了一个抽象层次，多个等变层的组合便能从简单的局部特征中构建出复杂的不变特征。

## 编程任务（请使用CoLab或笔记本）

1. 验证卷积的平移等变性。对图像应用卷积，然后平移图像并再次进行卷积。检查两次输出是否为彼此的平移版本。

```python
import jax
import jax.numpy as jnp

# 1D signal and a simple filter
signal = jnp.array([0, 0, 0, 1, 2, 3, 2, 1, 0, 0, 0], dtype=float)
kernel = jnp.array([1, 0, -1], dtype=float)

# Convolve then shift
conv_result = jnp.convolve(signal, kernel, mode="same")
shifted_signal = jnp.roll(signal, 3)
conv_shifted = jnp.convolve(shifted_signal, kernel, mode="same")
shifted_conv = jnp.roll(conv_result, 3)

print(f"Conv then shift:  {shifted_conv}")
print(f"Shift then conv:  {conv_shifted}")
print(f"Equivariant: {jnp.allclose(shifted_conv, conv_shifted, atol=1e-5)}")
```

1. 验证DeepSets式聚合的排列不变性。对集合中的每个元素应用同一个函数，将结果求和，然后检查无论元素顺序如何，输出是否都相同。

```python
import jax
import jax.numpy as jnp

# A "set" of 4 vectors (order should not matter)
x = jnp.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [7.0, 8.0]])

# Simple shared function: element-wise square
psi = lambda v: v ** 2

# Aggregate by sum
def deepsets(points):
    return jnp.sum(jax.vmap(psi)(points), axis=0)

# Original order
result1 = deepsets(x)

# Permuted order
perm = jnp.array([2, 0, 3, 1])
result2 = deepsets(x[perm])

print(f"Original order:  {result1}")
print(f"Permuted order:  {result2}")
print(f"Invariant: {jnp.allclose(result1, result2)}")
```

1. 探究群结构。通过验证封闭性、结合律、单位元和逆元，确认二维旋转矩阵构成一个群。

```python
import jax.numpy as jnp

def rot2d(theta):
    return jnp.array([[jnp.cos(theta), -jnp.sin(theta)],
                       [jnp.sin(theta),  jnp.cos(theta)]])

R1 = rot2d(jnp.pi / 6)
R2 = rot2d(jnp.pi / 4)
R3 = rot2d(jnp.pi / 3)

# Closure: product of two rotations is a rotation
R12 = R1 @ R2
print(f"Closure (det=1, orthogonal): det={jnp.linalg.det(R12):.4f}, "
      f"R^T R = I: {jnp.allclose(R12.T @ R12, jnp.eye(2), atol=1e-5)}")

# Associativity
print(f"Associative: {jnp.allclose((R1 @ R2) @ R3, R1 @ (R2 @ R3), atol=1e-5)}")

# Identity
I = rot2d(0.0)
print(f"Identity: {jnp.allclose(R1 @ I, R1, atol=1e-5)}")

# Inverse
R1_inv = rot2d(-jnp.pi / 6)
print(f"Inverse: {jnp.allclose(R1 @ R1_inv, jnp.eye(2), atol=1e-5)}")
```

## 图论

图论提供了描述实体之间关系的数学语言。本文档涵盖了节点、边、邻接矩阵、图的类型、度与连通性、图拉普拉斯算子、谱图理论以及现实世界中的图应用。我们将在纯计算机科学章节中更深入地探讨图的相关内容。

- 到目前为止，本书中的数据都存在于规则结构中：$\mathbb{R}^n$中的向量（第1章）、作为数字网格的矩阵（第2章）、作为像素网格的图像（第8章）、作为有序列表的序列（第7章）。但许多现实世界的系统都是**不规则的**：社交网络没有网格结构，分子没有从左到右的顺序，道路网络也无法整齐地排列成行和列。

- **图**是表示这些不规则的、具有关系性的结构的数学工具。图描述了**实体**（节点）以及它们之间的**关系**（边）。一旦数据被表示为图，我们就可以运用第1个文档中提到的几何深度学习原理来从中学习。

## 节点、边与邻接关系

- 一个**图** $G = (V, E)$由一组**节点**（或称顶点）$V = \{v_1, v_2, \ldots, v_n\}$以及连接节点对的一组**边**$E \subseteq V \times V$组成。

- 节点代表实体：人、原子、城市、网页、神经元。边代表关系：友谊、化学键、道路、超链接、突触。

- **邻接矩阵**$A$是图的矩阵表示形式。对于一个有$n$个节点的图，$A$是一个$n \times n$的矩阵，其中若从节点$i$到节点$j$存在一条边，则$A_{ij} = 1$；否则$A_{ij} = 0$。

- 例如，一个三角形图（3个节点且全部相连）的邻接矩阵为：

$$
A = \begin{bmatrix} 0 & 1 & 1 \\ 1 & 0 & 1 \\ 1 & 1 & 0 \end{bmatrix}

$$

![三角形图及其邻接矩阵：有边则为1，否则为0](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/graph_adjacency_matrix.svg)

- 对角线上的元素为零，因为节点不会与自身相连（默认没有自环）。邻接矩阵是我们在第2章中学习的布尔矩阵的直接应用：每个条目都表示一种二元关系。

- 邻接矩阵完整地编码了图的结构。对矩阵$A$进行运算可以揭示图的属性：$A^2_{ij}$表示节点$i$和$j$之间长度为2的路径数量（回想一下第2章中的矩阵乘法：每个条目是中间节点上乘积之和）。更一般地，$A^k_{ij}$表示长度为$k$的路径数量。

- 每个节点可以携带一个**特征向量**$\mathbf{x}_i \in \mathbb{R}^d$。在社交网络中，这可能是用户的个人资料信息；在分子中，它则编码了原子类型、电荷及其他属性。所有节点特征的集合构成一个矩阵$X \in \mathbb{R}^{n \times d}$，其中每一行代表一个节点的特征。

- 边也可以携带特征：分子中的键类型、空间图中的距离、知识图谱中的关系类型等。边$(i, j)$的**边特征**是一个向量$\mathbf{e}_{ij} \in \mathbb{R}^{d_e}$。

## 图的类型

- **无向图**的边具有对称性：如果$i$与$j$相连，那么$j$也与$i$相连。其邻接矩阵是对称的：$A = A^T$（即对称矩阵，见第2章）。友谊关系和化学键属于无向图。

- **有向图**（digraph）的边具有方向性：从$i$到$j$的边并不意味着存在从$j$到$i$的边。其邻接矩阵是非对称的。Twitter上的关注关系、网页超链接以及引文网络均是有向图。

- **加权图**为每条边赋予数值权重。其邻接矩阵中的元素为实数而非二进制值：$A_{ij} = w_{ij}$。道路网络中的距离、大脑连接中的相关强度以及社交网络中的互动频率均属于加权图。

- **二分图**包含两组互不相交的节点，边只存在于两组之间（绝不会在同一组内）。用户和产品构成二分图：用户对产品评分，但用户之间不互相评分。二分图的邻接矩阵具有块状结构：

$$
A = \begin{bmatrix} 0 & B \\ B^T & 0 \end{bmatrix}

$$

- 其中，$B$ 是两个节点集之间的二分邻接矩阵。

- **多重图**允许同一对节点之间存在多条边和/或自环。知识图谱通常属于多重图：两个实体之间可以有多种关系（例如，“出生于”、“居住在”、“工作于”）。

- **超图**将边推广为可同时连接两个以上节点。一条**超边**连接一组节点，用以表示更高阶的关系。一篇由五人合著的研究论文，就是连接五个作者节点的超边。

- **完全图**$K_n$中每对节点之间都有一条边。它相当于全连接层的图结构，也是Transformer模型所处理的结构（每个令牌都会关注其他所有令牌）。

## 度、路径与连通性

- 节点的**度**是指与之相连的边的数量。在无向图中，节点$i$的度为$d_i = \sum_j A_{ij}$。度高节点被称为“枢纽”，拥有大量连接。

- **度矩阵**$D$是一个对角矩阵，对角线上的元素为各节点的度：$D_{ii} = d_i$。该矩阵在图论和GNN公式中频繁出现。

- 两个节点之间的**路径**是一系列连接它们的边。**最短路径**（或称测地线）是指边数最少的那条路径（在加权图中则指总权重最小的路径）。**迪杰斯特拉算法**可在$O((|V| + |E|) \log |V|)$时间内找到最短路径。

- 如果图中任意一对节点之间都存在路径，则该图是**连通的**。否则，它就包含多个**连通分量**：彼此之间没有边的孤立子图。

- 图的**直径**是任意一对节点之间最长的最短路径长度。它用于衡量图的“分散程度”。社交网络的直径通常很小（“六度分隔”现象）。

- **环**是指起点和终点相同的路径。没有环的图称为**树**。树是最简单的连通图：$n$个节点且恰好有$n-1$条边。

- **中心性**用于衡量节点的重要性。**度中心性**即节点的度。**介数中心性**统计经过该节点的最短路径数量。**特征向量中心性**根据节点邻居的重要性来分配重要性，从而满足特征向量方程$A\mathbf{x} = \lambda \mathbf{x}$（见第2章）。谷歌的PageRank算法便是针对有向图的特征向量中心性的一种变体。

## 图拉普拉斯矩阵

- **图拉普拉斯矩阵**或许是图论中最重要的矩阵。其定义为：

$$L = D - A$$

- 其中，$D$为度矩阵，$A$为邻接矩阵。以我们的三角形示例为例：

$$
L = \begin{bmatrix} 2 & 0 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & 2 \end{bmatrix} - \begin{bmatrix} 0 & 1 & 1 \\ 1 & 0 & 1 \\ 1 & 1 & 0 \end{bmatrix} = \begin{bmatrix} 2 & -1 & -1 \\ -1 & 2 & -1 \\ -1 & -1 & 2 \end{bmatrix}

$$

- 拉普拉斯矩阵具有显著的性质：

- 它总是**对称**且**半正定**（回顾第2章：所有特征值都$\geq 0$）。对于任意向量$\mathbf{x}$：

$$\mathbf{x}^T L \mathbf{x} = \sum_{(i,j) \in E} (x_i - x_j)^2$$

![图拉普拉斯矩阵衡量信号的平滑度：平滑信号在相连节点上的取值相近，不平滑信号则变化剧烈](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/graph_laplacian_smoothness.svg)

- 这个二次型用于衡量图上信号$\mathbf{x}$沿边的变化程度。如果相邻节点的取值相似，则$\mathbf{x}^T L \mathbf{x}$较小；如果取值差异明显，则该值较大。拉普拉斯矩阵用于衡量图上信号的**平滑度**。

- 最小的特征值始终为0，对应的特征向量为$\mathbf{1} = [1, 1, \ldots, 1]^T$（常数信号的变异为零）。零特征值的个数等于连通分量的数量。

- 第二小的特征值$\lambda_2$称为**代数连通度**（Fiedler值）。它衡量图的连通程度：$\lambda_2 = 0$表示图不连通，而较大的$\lambda_2$意味着图紧密连通。

- **归一化拉普拉斯矩阵**会根据节点度数进行缩放：

$$\hat{L} = D^{-1/2} L D^{-1/2} = I - D^{-1/2} A D^{-1/2}$$

- 这种归一化处理确保了拉普拉斯矩阵的性质不依赖于节点度数的绝对规模。项$D^{-1/2} A D^{-1/2}$被称为**对称归一化邻接矩阵**，它直接出现在GCN公式中（文件3）。

## 谱图理论

- 图拉普拉斯矩阵的特征值和特征向量定义了图的**谱**，它们相当于图上信号的傅里叶变换。

- 在经典信号处理中，傅里叶变换将信号分解为频率分量（正弦和余弦）。在图上，拉普拉斯矩阵的特征向量扮演这些频率基的角色。低特征值对应的特征向量在图上变化缓慢（低频、平滑），而高特征值对应的特征向量变化迅速（高频、振荡）。

- 图上信号$\mathbf{x}$的**图傅里叶变换（GFT）**为：

$$\hat{\mathbf{x}} = U^T \mathbf{x}$$

- 其中$U$是拉普拉斯矩阵特征向量构成的矩阵（回顾第2章的特征值分解：$L = U \Lambda U^T$）。逆变换为$\mathbf{x} = U \hat{\mathbf{x}}$。

- 谱域中的**图卷积**相当于频域中的逐点乘法，正如空间域中的卷积对应傅里叶域中的乘法（第8章的卷积定理）：

$$g_\theta \star \mathbf{x} = U \left( (U^T g_\theta) \odot (U^T \mathbf{x}) \right) = U \, \text{diag}(\hat{g}_\theta) \, U^T \mathbf{x}$$

- 滤波器$\hat{g}_\theta$是关于特征值的可学习函数。这是谱GNN的基础，我们将在第3个文件中将其简化为实用的GCN。

- 计算瓶颈在于$L$的特征值分解，对于包含$n$个节点的图，其计算复杂度为$O(n^3)$。这对大型图（数百万个节点）而言并不现实。多项式近似（切比雪夫多项式）完全避免了特征值分解，这种近似直接导出了GCN。

## 社区发现

- 许多现实世界的图都具有**社区结构**：即节点密集相连的簇，而簇之间的连接稀疏。社交网络中有好友群体，生物网络中有功能模块，引文网络中有研究领域。

- **谱聚类**利用拉普拉斯矩阵的特征向量来发现社区。其思路是：用$L$中$k$个最小的非平凡特征向量对每个节点进行嵌入，然后在该嵌入空间中应用k均值算法（第6章）。属于同一社区的节点在谱嵌入中会彼此靠近。

- 这种方法之所以有效，是因为Fiedler向量（$\lambda_2$对应的特征向量）能自然地将图分为两组：取值为正的节点和取值为负的节点，且分割线穿过最稀疏的连接处。更高的特征向量可进一步细化出更多群组。

- **模块度**$Q$用于衡量社区划分的质量。它比较社区内边的数量与随机图中预期的数量：

$$Q = \frac{1}{2|E|} \sum_{ij} \left( A_{ij} - \frac{d_i d_j}{2|E|} \right) \delta(c_i, c_j)$$

- 其中$c_i$是节点$i$所属的社区，$\delta$在节点属于同一社区时取1。$Q$的取值范围在$-0.5$到$1$之间，数值越大表明社区结构越强。

## 现实世界的图

- **社交网络**：节点是人，边表示友谊或互动关系。Facebook拥有数十亿个节点和数千亿条边。这类图通常较为稀疏（每个人只有数百个好友，而非数十亿），表现出小世界特性（平均路径长度较短），且度数分布呈幂律分布（少数枢纽节点拥有数百万条连接）。

- **分子图**：节点是原子，边表示化学键。每个原子具有特征（元素类型、电荷、杂化方式），每条键也有特征（单键、双键、三键、芳香键）。分子图规模较小（几十到几百个节点），但结构高度有序。根据图结构预测分子性质是GNN的重要应用之一。

- **知识图谱**：节点是实体（人、地点、概念），边表示有类型的关系（“出生于”、“首都是”、“实例为”）。知识图谱支撑着搜索引擎、推荐系统和问答系统。它们通常是带有数百万实体和数十亿关系的有向多重图。

- **引文网络**：节点是论文，边表示引用关系（有向）。通过聚类可揭示研究社区。节点特征包括标题、摘要和发表年份。
- **蛋白质相互作用网络**：节点代表蛋白质，边表示物理相互作用或功能关联。理解这些图有助于确定药物靶点和疾病机制。

- **道路网络与交通**：节点是交叉口，边是具有距离/时间权重的路段。基于这些图的最短路径算法为导航系统提供支持。自动驾驶运动预测（第11章）将智能体间的交互表示为图。

## 编程任务（使用CoLab或笔记本）

1. 构建一个以邻接矩阵形式表示的小型图，并计算其基本属性：每个节点的度、长度为2的路径数量，以及该图是否连通。

```python
import jax.numpy as jnp

# A simple graph: 5 nodes
# 0-1, 0-2, 1-2, 2-3, 3-4
A = jnp.array([[0, 1, 1, 0, 0],
               [1, 0, 1, 0, 0],
               [1, 1, 0, 1, 0],
               [0, 0, 1, 0, 1],
               [0, 0, 0, 1, 0]], dtype=float)

# Degree
degrees = A.sum(axis=1)
print(f"Degrees: {degrees}")

# Paths of length 2
A2 = A @ A
print(f"Paths of length 2 (node 0 to 3): {int(A2[0, 3])}")

# Connected? Check if A^(n-1) has all nonzero entries
An = jnp.linalg.matrix_power(A + jnp.eye(5), 4)  # (A+I)^4 for reachability
connected = jnp.all(An > 0)
print(f"Connected: {connected}")
```

1. 计算图的拉普拉斯矩阵及其特征值。验证最小特征值为0，且对应的特征向量为常数向量。

```python
import jax.numpy as jnp

A = jnp.array([[0, 1, 1, 0, 0],
               [1, 0, 1, 0, 0],
               [1, 1, 0, 1, 0],
               [0, 0, 1, 0, 1],
               [0, 0, 0, 1, 0]], dtype=float)

D = jnp.diag(A.sum(axis=1))
L = D - A

eigenvalues, eigenvectors = jnp.linalg.eigh(L)
print(f"Eigenvalues: {eigenvalues}")
print(f"Smallest eigenvector: {eigenvectors[:, 0]}")
print(f"Fiedler value (algebraic connectivity): {eigenvalues[1]:.4f}")

# Verify: x^T L x measures smoothness
x = jnp.array([1.0, 1.0, 1.0, -1.0, -1.0])  # two groups
smoothness = x @ L @ x
print(f"Smoothness of two-group signal: {smoothness:.2f}")
```

1. 对包含两个社区的图进行谱聚类。利用Fiedler向量对节点进行嵌入，并根据符号将它们分开。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Two communities of 5 nodes each, weakly connected
A = jnp.zeros((10, 10))
# Community 1: nodes 0-4 (dense)
for i in range(5):
    for j in range(i+1, 5):
        A = A.at[i, j].set(1).at[j, i].set(1)
# Community 2: nodes 5-9 (dense)
for i in range(5, 10):
    for j in range(i+1, 10):
        A = A.at[i, j].set(1).at[j, i].set(1)
# One bridge edge
A = A.at[2, 7].set(1).at[7, 2].set(1)

D = jnp.diag(A.sum(axis=1))
L = D - A
eigenvalues, eigenvectors = jnp.linalg.eigh(L)

# Fiedler vector (2nd smallest eigenvalue)
fiedler = eigenvectors[:, 1]
communities = (fiedler > 0).astype(int)

print(f"Fiedler vector: {fiedler}")
print(f"Clusters: {communities}")

plt.bar(range(10), fiedler, color=["#3498db" if c == 0 else "#e74c3c" for c in communities])
plt.xlabel("Node"); plt.ylabel("Fiedler vector value")
plt.title("Spectral Clustering via Fiedler Vector")
plt.show()
```

## 图神经网络

_图神经网络通过在相连节点间传递信息来从图结构数据中学习。本文涵盖了消息传递框架、GCN、GraphSAGE、GIN、过平滑现象、图池化，以及节点/边/图级别的任务；这些核心架构支撑着分子性质预测、社交网络分析和推荐系统。_

- 在之前的文档中，我们奠定了数学基础：几何深度学习（文档1）告诉我们如何利用对称性，而图论（文档2）则为我们提供了关于节点、边和邻接关系的语言。现在我们将构建直接在图上运行的神经网络。

- 核心挑战在于：图数据是**不规则的**。与图像（固定网格）或序列（固定顺序）不同，图的节点数量可变、连接关系可变，且没有规范的节点排序。用于处理图的神经网络必须应对这一切，同时还要具备排列等变性（重新标记节点不应改变输出结果）。

## 消息传递框架

- 几乎所有的GNN都遵循同一种模式，称为**消息传递**（也称邻域聚合）。其思路简单而优雅：每个节点通过收集来自邻居的信息来更新自身的表示。

- 在第$l$层，每个节点$i$会执行三步操作：

1. **消息生成**：节点$i$的每个邻居$j$根据其当前特征计算出一条消息$\mathbf{m}_{j \to i}$。
2. **聚合**：节点$i$收集所有传入的消息，并通过一个排列不变的函数（求和、均值或最大值）将它们合并。
3. **更新**：节点$i$将聚合后的消息与自身特征结合，生成新的表示。

- 公式表达如下：

$$\mathbf{m}_i^{(l)} = \bigoplus_{j \in \mathcal{N}(i)} \phi^{(l)}\left(\mathbf{h}_i^{(l)}, \mathbf{h}_j^{(l)}, \mathbf{e}_{ij}\right)$$

$$\mathbf{h}_i^{(l+1)} = \psi^{(l)}\left(\mathbf{h}_i^{(l)}, \mathbf{m}_i^{(l)}\right)$$

- 其中，$\mathcal{N}(i)$表示节点$i$的邻居集合，$\bigoplus$是一种排列不变的聚合方式（求和、均值或最大值），$\phi$为消息生成函数，$\psi$为更新函数，$\mathbf{e}_{ij}$为可选的边特征。

![消息传递：邻居发送消息，排列不变函数对其进行聚合，节点据此更新其特征](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/message_passing_gnn.svg)

- 聚合操作$\bigoplus$必须是排列不变的（处理邻居的顺序无关紧要），以确保整体函数具备排列等变性。这直接体现了文档1中提到的对称性原则。

- 经过$k$层消息传递后，每个节点的表示就编码了其**$k$跳邻域**的信息：即距离不超过$k$条边的所有节点。第1层能看到直接邻居，第2层能看到邻居的邻居，以此类推。正是通过这种方式，局部信息得以传播并形成全局理解。

- GNN的感受野会随着深度增加而扩大，这与CNN的感受野随层数增加而变化类似（第8章）。但与规则网格上的CNN不同，GNN的感受野形状会因图拓扑结构的不同而因节点而异。

## 图卷积网络（GCN）

- **GCN**（Kipf & Welling, 2017）是基础的GNN架构。它将谱图卷积（文档2中介绍）简化为一个简洁高效的公式。

- 从谱卷积$g_\theta \star \mathbf{x} = U \, \text{diag}(\hat{g}_\theta) \, U^T \mathbf{x}$出发，Kipf和Welling用一阶切比雪夫多项式来近似谱滤波器，从而完全避免了特征分解的计算。简化后，逐层更新公式变为：

$$H^{(l+1)} = \sigma\left(\hat{A} H^{(l)} W^{(l)}\right)$$

- 其中：
- $H^{(l)} \in \mathbb{R}^{n \times d}$是第$l$层的节点特征矩阵；
- $W^{(l)} \in \mathbb{R}^{d \times d'}$是可学习的权重矩阵；
- $\hat{A} = \tilde{D}^{-1/2} \tilde{A} \tilde{D}^{-1/2}$是带有自环的对称归一化邻接矩阵；
- $\tilde{A} = A + I$添加了自环（使每个节点也能接收来自自身的消息）；
- $\tilde{D}$是$\tilde{A}$的度矩阵；
- $\sigma$是非线性激活函数（如第6章中的ReLU）。

- 矩阵乘法$\hat{A} H^{(l)}$即为聚合步骤：对于每个节点，它计算其邻居特征（加上自身特征，通过自环实现）的加权平均值。权重矩阵$W^{(l)}$则是可学习的变换，对所有节点共享。激活函数引入了非线性。

- 这一过程非常简单：不过是矩阵乘法、可学习的线性映射以及激活函数的组合。整个GCN层可以用一行代码表示。通过$\tilde{D}^{-1/2}$进行归一化，可防止拥有较多邻居的节点占据主导地位：度较大的节点的消息会被相应缩小。

- 在消息传递框架中，GCN采用以下方式：
- 消息生成：$\phi(\mathbf{h}_j) = \mathbf{h}_j$（直接发送自身特征）；
- 聚合：按度加权的归一化求和；
- 更新：线性变换 + 激活函数。

## GraphSAGE

- GCN是**归纳式的**：训练时需要完整的图数据，且无法处理新出现的、未曾见过的节点。如果社交网络中新增了一个用户，就必须对整个图重新训练GCN。**GraphSAGE**（Hamilton等人，2017）通过**归纳式**方法解决了这一问题。

- 其核心思想是**邻域采样**：不使用所有邻居，而是抽取固定大小的子集。这使得计算过程不再依赖于完整的图结构，从而能够推广到未见过的节点和图上。

- 节点$i$的GraphSAGE更新公式为：

$$\mathbf{h}_i^{(l+1)} = \sigma\left(W^{(l)} \cdot \text{CONCAT}\left(\mathbf{h}_i^{(l)}, \text{AGG}\left(\{\mathbf{h}_j^{(l)} : j \in \mathcal{S}(i)\}\right)\right)\right)$$

- 其中 $\mathcal{S}(i)$ 是邻居的**采样**子集（例如，从500个邻居中随机选取10个）。CONCAT操作明确地将节点自身特征与聚合后的邻居特征分开，从而使网络能够学习针对“自身”和“邻域”的不同变换。

- GraphSAGE支持多种聚合函数：
- **均值**：$\text{AGG} = \frac{1}{|\mathcal{S}|} \sum_{j \in \mathcal{S}} \mathbf{h}_j$（简单且有效）
- **LSTM**：将采样的邻居输入LSTM进行处理（但这会引入顺序依赖性，某种程度上违背了排列不变性）
- **池化**：$\text{AGG} = \max(\{\sigma(W_{\text{pool}} \mathbf{h}_j + \mathbf{b})\})$（先进行非线性变换，再取最大值）

- 这种采样策略使GraphSAGE能够扩展到非常大的图。训练时使用节点的小批量数据：对于每个目标节点，在第1层采样$k_1$个邻居，然后在第2层为这些邻居再采样$k_2$个邻居。当$k_1 = k_2 = 10$且仅有2层时，无论图的大小如何，每个节点的计算树最多只包含$10 \times 10 = 100$个节点。

## 图同构网络（GIN）

- 不同的GNN架构具有不同的**表达能力**：即它们区分结构不同图的能力。尽管GCN和GraphSAGE在实践中效果显著，但理论上它们在可区分的图结构方面存在局限性。

- 衡量GNN表达能力的理论工具是**Weisfeiler-Lehman（WL）测试**，这是一种用于检测图同构的经典算法（判断两个图是否在结构上完全相同）。WL测试通过将每个节点的标签与其邻居标签的多集一起哈希，从而迭代地细化节点标签。

- **GIN**（Xu等人，2019年）的设计目标是具备与WL测试同等的表达能力，因此它是表达能力最强的消息传递型GNN（在消息传递的理论极限内）。其核心思想是：聚合函数必须对多集具有**单射性**（不同的邻居特征多集必须产生不同的聚合结果）。

- 求和聚合对多集具有单射性（$\{1, 1, 2\}$的和为4，而$\{1, 3\}$的和也是4；但在特征向量维度足够高时，不同多集的和通常各不相同）。均值和最大值则不具备单射性：均值无法区分$\{1, 1\}$与$\{2, 2\}$，最大值也无法区分$\{1, 2, 3\}$与$\{1, 1, 3\}$。

- GIN的更新公式为：

$$\mathbf{h}_i^{(l+1)} = \text{MLP}^{(l)}\left((1 + \epsilon^{(l)}) \cdot \mathbf{h}_i^{(l)} + \sum_{j \in \mathcal{N}(i)} \mathbf{h}_j^{(l)}\right)$$

- 其中$\epsilon$是一个可学习的标量（或固定为0），MLP提供非线性且单射的映射。求和聚合保留了多集结构，而MLP能够学会区分任何两个不同的聚合结果。

## 过度平滑现象

- GNN面临的一个主要挑战是**过度平滑**：随着层数的增加，所有节点的表示会逐渐收敛到同一个值，从而失去区分不同节点的能力。

![过度平滑：第1层中不同的节点特征逐渐融合成深层中的统一特征](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/over_smoothing_gnn.svg)

- 其机制很容易理解。每一层消息传递都会将节点的特征与其邻居的特征进行平均。经过多次平均后，每个节点都会与其所在连通分量中的其他节点混合。最终特征会变成统一的平均值，这类似于图像被反复模糊直至变成单一颜色。

- 从数学上看，归一化邻接矩阵$\hat{A}$的反复应用会收敛为一个秩为1的矩阵（每一行都与图上随机游走的稳态分布成比例）。这与幂迭代法趋于主特征向量的过程类似（见第2章）。

- 过度平滑限制了GNN的深度（通常为2-4层），而CNN和Transformer却能从数十甚至数百层结构中获益。这意味着每个节点只能看到有限的邻域，这对于需要利用远距离信息的任务而言是个问题。

- 缓解方法包括：
- **残差连接**（源自ResNet，见第8章）：$\mathbf{h}_i^{(l+1)} = \mathbf{h}_i^{(l+1)} + \mathbf{h}_i^{(l)}$，从而保留来自前层的信息。
- **跳跃式知识融合**：不仅使用最后一层的表示，还将所有层的表示进行拼接或注意力池化。
- **DropEdge**：在训练期间随机删除边，从而减缓信息传播速度。
- **图Transformer**（见文件4）：通过全局注意力机制绕过局部消息传递的限制。

## 图池化

- 对于**图级任务**（预测整个图的属性，如分子的毒性），我们需要将所有节点表示合并为一个单一的图级向量。这就是**图池化**，相当于CNN中的全局平均池化（见第8章）。

- 最简单的方法是**读出操作**：对所有节点特征集合应用一个排列不变的函数：

$$\mathbf{h}_G = \text{READOUT}(\{\mathbf{h}_i^{(L)} : i \in V\}) = \sum_i \mathbf{h}_i^{(L)} \quad \text{或} \quad \frac{1}{|V|} \sum_i \mathbf{h}_i^{(L)} \quad \text{或} \quad \max_i \mathbf{h}_i^{(L)}$$

- 这是文件1中提到的DeepSets聚合方式，应用于最后的GNN层之后。求和操作保留了图的大小信息（包含100个节点的图其求和结果会比包含10个节点的图更大），而均值则对大小进行了归一化处理。

- **分层池化**逐步对图进行粗粒化，类似于CNN对图像的逐级下采样。在每个层级中，若干节点会被合并成“超节点”：

- **DiffPool**（可微池化）学习一个软分配矩阵$S^{(l)} \in \mathbb{R}^{n_l \times n_{l+1}}$，用于将每个节点分配到某个簇中：

$$X^{(l+1)} = S^{(l)T} H^{(l)}, \quad A^{(l+1)} = S^{(l)T} A^{(l)} S^{(l)}$$

- 分配矩阵由单独的GNN预测，从而使聚类过程可端到端微分。这形成了一个层级结构：原始图 → 节点更少的粗化图 → 更加粗化的图 → 单个节点（图的表示）。

- **TopKPool**采用更简单的方法：为每个节点学习一个标量分数，保留得分最高的$k$个节点，其余节点则被丢弃。这是一种硬性选择（而非软性分配），在计算上比DiffPool更节省资源。

## 异质图

- 迄今为止所有的GNN都假设图是**同质的**：只有一种类型的节点和一种类型的边。但大多数现实世界的图都是**异质的**：包含多种节点类型和多种边类型。知识图谱中有人物节点、组织节点和地点节点，它们通过“任职于”、“出生于”和“位于”等关系相连；推荐系统中有用户节点和物品节点，它们通过“购买”、“浏览”和“评分”等关系相连。

- 异质图具有一个**模式**（也称为元图），用于定义允许的节点类型和边类型。每种边类型将特定的源类型与特定的目标类型连接起来。例如，“任职于”关系将Person节点连接到Organisation节点。

- **关系型GCN（R-GCN）**（Schlichtkrull等人，2018年）通过为每种边类型使用独立的权重矩阵来处理异质边：

$$\mathbf{h}_i^{(l+1)} = \sigma\left(\sum_{r \in \mathcal{R}} \sum_{j \in \mathcal{N}_r(i)} \frac{1}{|\mathcal{N}_r(i)|} W_r^{(l)} \mathbf{h}_j^{(l)} + W_0^{(l)} \mathbf{h}_i^{(l)}\right)$$

- 其中，$\mathcal{R}$表示边类型集合，$\mathcal{N}_r(i)$表示通过关系$r$与节点$i$相连的邻居节点集合，$W_r$则是特定于关系$r$的权重矩阵。自连接项$W_0$负责单独处理节点自身特征。

- 问题在于：当关系类型较多时，参数数量会急剧增加（每种关系对应一个$d \times d$矩阵）。R-GCN通过**基分解**来缓解这一问题：$W_r = \sum_{b=1}^{B} a_{rb} V_b$，其中$V_b$是共享的基矩阵，$a_{rb}$是每种关系对应的标量系数。这类似于低秩分解（第2章）：关系特定的矩阵被限制在低维子空间中。

- **异质图Transformer（HGT）**（Hu等人，2020年）将注意力机制应用于异质图。其核心思想是：注意力应同时取决于节点类型和连接它们的边类型。HGT使用针对特定类型的投影矩阵来计算查询、键和值：

$$\text{Attention}(i, j) = \left(W_{\tau(i)}^Q \mathbf{h}_i\right)^T \cdot \frac{W_{\phi(i,j)}^{\text{ATT}}}{\sqrt{d}} \cdot \left(W_{\tau(j)}^K \mathbf{h}_j\right)$$

- 其中，$\tau(i)$表示节点$i$的类型，$\phi(i,j)$表示它们之间的边类型。这确保了模型对不同关系类型的处理方式不同：一篇论文在关注其作者时使用的注意力权重，应与它关注参考文献时的权重有所不同。

- **基于元路径的方法**通过模式定义有意义的路径（例如，Author → Paper → Author用于表示合著关系），并沿这些路径聚合信息。**HAN**（异质注意力网络）在两个层面应用注意力：在每条元路径内部（哪些邻居重要？）以及跨元路径之间（哪些关系模式重要？）。

## 链接预测与知识图谱补全

- **链接预测**旨在：根据已有的边，判断哪些缺失的边可能存在。这是知识图谱补全（预测缺失的事实）、推荐系统（预测用户可能喜欢的物品）以及社交网络分析（预测未来的好友关系）的核心任务。

- **基于嵌入的方法**为每个实体学习一个向量，为每种关系学习一个变换，再根据实体与关系之间的匹配程度来给潜在边打分：

- **TransE**将关系建模为嵌入空间中的平移：如果$(h, r, t)$是一个有效的三元组（头实体、关系、尾实体），那么$\mathbf{h} + \mathbf{r} \approx \mathbf{t}$。评分函数为$f(h, r, t) = -\|\mathbf{h} + \mathbf{r} - \mathbf{t}\|$。直观地说，关系向量在嵌入空间中将头实体“移动”到尾实体位置。

- **RotatE**将关系建模为复数空间中的旋转：$\mathbf{t} = \mathbf{h} \circ \mathbf{r}$，其中$\circ$表示逐元素复数乘法，且$|\mathbf{r}_i| = 1$（单位复数代表旋转）。这种方法能够建模TransE无法表示的对称性、反对称性、逆关系和组合关系。

- **ComplEx**使用复数值嵌入及厄米特点积，从而能够建模非对称关系（若A是B的上级，则B并非A的上级）。

- 基于GNN的链接预测通过消息传递计算节点嵌入，再利用端点嵌入对边进行打分。这种方法结合了GNN的结构推理能力与嵌入方法的关系建模能力。GNN编码器能够捕捉单嵌入方法所忽略的多跳邻域结构。

## 任务类型

- GNN解决三类任务：

- **节点级任务**：预测每个节点的属性。例如：对社交网络中的用户进行分类（机器人或人类）、预测交互网络中每种蛋白质的功能、半监督节点分类（标记少量节点，预测其余节点）。输出是将节点嵌入$\mathbf{h}_i^{(L)}$送入分类器得到的结果。

- **边级任务**：预测每条边的属性或判断边是否存在。例如：链接预测（这两个用户会成为好友吗？）、知识图谱补全（这些实体之间是否存在这种关系？）、药物间相互作用预测。输出通常利用两个端点节点的嵌入：$\hat{y}_{ij} = f(\mathbf{h}_i, \mathbf{h}_j)$，其中$f$可以是点积、拼接后接MLP或其他组合方式。
- **图级任务**：预测整个图的属性。示例：分子属性预测（该分子是否有毒性？）、图分类（该社交网络是否为僵尸网络？）、图生成（设计具有所需属性的分子）。输出通过图池化操作得到$\mathbf{h}_G$，随后对其进行分类或回归。

## 编程任务（使用CoLab或笔记本）（续1）

1. 利用归一化邻接矩阵从零实现一个GCN层。将其应用于一个小图上，观察节点特征是如何被平滑处理的。

```python
import jax
import jax.numpy as jnp

# Graph: 5 nodes, simple chain with a branch
A = jnp.array([[0, 1, 0, 0, 0],
               [1, 0, 1, 0, 0],
               [0, 1, 0, 1, 1],
               [0, 0, 1, 0, 0],
               [0, 0, 1, 0, 0]], dtype=float)

# Add self-loops
A_hat = A + jnp.eye(5)
D_hat = jnp.diag(A_hat.sum(axis=1))
D_inv_sqrt = jnp.diag(1.0 / jnp.sqrt(A_hat.sum(axis=1)))
A_norm = D_inv_sqrt @ A_hat @ D_inv_sqrt

# Node features: one-hot identity
H = jnp.eye(5)

# Weight matrix (random initialisation)
rng = jax.random.PRNGKey(0)
W = jax.random.normal(rng, (5, 3)) * 0.5

# GCN layer: H' = ReLU(A_norm @ H @ W)
H_new = jax.nn.relu(A_norm @ H @ W)

print("Original features (one-hot):")
print(H)
print("\nAfter GCN layer:")
print(jnp.round(H_new, 3))
print("\nNotice: connected nodes now have similar representations")
```

1. 实现采用求和聚合的消息传递机制（GIN风格），并与均值聚合（GCN风格）进行比较。证明求和聚合能够区分均值聚合无法区分的多重集。

```python
import jax.numpy as jnp

# Two different neighbourhood multisets that have the same mean
# Node A: neighbours have features [1, 1, 1, 1]  (four neighbours, all 1)
# Node B: neighbours have features [2, 2]          (two neighbours, all 2)

neighbours_A = jnp.array([[1.0], [1.0], [1.0], [1.0]])
neighbours_B = jnp.array([[2.0], [2.0]])

# Mean aggregation
mean_A = neighbours_A.mean(axis=0)
mean_B = neighbours_B.mean(axis=0)
print(f"Mean A: {mean_A}, Mean B: {mean_B}, Same: {jnp.allclose(mean_A, mean_B)}")

# Sum aggregation
sum_A = neighbours_A.sum(axis=0)
sum_B = neighbours_B.sum(axis=0)
print(f"Sum A:  {sum_A},  Sum B:  {sum_B},  Same: {jnp.allclose(sum_A, sum_B)}")
print("\nSum distinguishes these multisets; mean does not!")
```

1. 演示过平滑现象。反复应用归一化邻接矩阵，观察节点特征如何趋于一致。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Random graph
A = jnp.array([[0,1,1,0,0,0],
               [1,0,1,0,0,0],
               [1,1,0,1,0,0],
               [0,0,1,0,1,1],
               [0,0,0,1,0,1],
               [0,0,0,1,1,0]], dtype=float)

A_hat = A + jnp.eye(6)
D_inv_sqrt = jnp.diag(1.0 / jnp.sqrt(A_hat.sum(axis=1)))
A_norm = D_inv_sqrt @ A_hat @ D_inv_sqrt

# Initial features: distinct per node
H = jnp.array([[1,0], [0,1], [1,1], [-1,0], [0,-1], [-1,-1]], dtype=float)

distances = []
for k in range(20):
    H = A_norm @ H
    # Measure how distinct the features are (std across nodes)
    spread = jnp.std(H, axis=0).mean()
    distances.append(float(spread))

plt.plot(distances, "o-")
plt.xlabel("Number of message-passing rounds")
plt.ylabel("Feature spread (std across nodes)")
plt.title("Over-Smoothing: Features Converge with Depth")
plt.show()
```

## 图注意力网络

_图注意力网络用可学习的、依赖数据的权重来取代统一的邻居聚合方式。本文涵盖了GAT、多头图注意力、GATv2、图Transformer、位置与结构编码以及可扩展性等内容。_

- 在GCN（文档3）中，每个节点使用由图结构决定的固定权重来聚合其邻居的特征（归一化邻接矩阵）。拥有三个邻居的节点会给每个邻居赋予大致相等的权重（≈1/3）。但并非所有邻居都同等重要：来自亲密合作者的信息应比来自疏远熟人的信息更重要。

- **图注意力网络**通过学习**应关注哪些邻居**来解决这一问题，其采用的注意力机制与Transformer（第7章）中的机制相同。每个节点不再使用基于结构的固定权重，而是计算针对其邻居的动态、基于内容的注意力分数。

## GAT：图注意力网络

- **GAT**（Veličković等人，2018年）计算每个节点与其邻居之间的注意力系数。对于节点$i$和邻居$j$：

$$e_{ij} = \text{LeakyReLU}\left(\mathbf{a}^T \left[W\mathbf{h}_i \| W\mathbf{h}_j\right]\right)$$

- 其中，$W \in \mathbb{R}^{d' \times d}$是共享的线性变换，$\|$表示拼接，$\mathbf{a} \in \mathbb{R}^{2d'}$是可学习的注意力向量。分数$e_{ij}$衡量了节点$j$的特征对节点$i$的重要性。

- 原始分数通过softmax在所有邻居间进行归一化：

$$\alpha_{ij} = \text{softmax}_j(e_{ij}) = \frac{\exp(e_{ij})}{\sum_{k \in \mathcal{N}(i)} \exp(e_{ik})}$$

- 这样可确保每个节点邻域内的注意力权重之和为1，这与Transformer中的注意力机制类似（第7章）。节点更新后的特征为：

$$\mathbf{h}_i' = \sigma\left(\sum_{j \in \mathcal{N}(i)} \alpha_{ij} W\mathbf{h}_j\right)$$

![GCN为所有邻居赋予固定的相等权重；GAT则学习依赖数据的注意力权重](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/gat_attention_weights.svg)

- 与GCN的关键区别在于：权重$\alpha_{ij}$是**从数据中学习得到的**，而非由图结构固定决定。节点可以学会专注于最具信息量的邻居，同时忽略噪声或无关紧要的邻居。

- 注意，注意力仅在边上进行计算（节点$i$仅关注其邻居$\mathcal{N}(i)$），而非所有节点对之间。这使得计算量与边数成正比，而非节点数的平方。

## 多头图注意力

- 正如Transformer中一样（第7章），**多头注意力**会并行运行$K$个独立的注意力机制，每个机制拥有自己的参数$W^k$和$\mathbf{a}^k$。结果会在中间层进行拼接，或在最终层取平均值：

$$\mathbf{h}_i' = \Big\|_{k=1}^{K} \sigma\left(\sum_{j \in \mathcal{N}(i)} \alpha_{ij}^k W^k \mathbf{h}_j\right)$$

- 每个头可以关注邻域的不同方面：一个头可能侧重于结构特征，另一个头则关注语义相似性。这与Transformer中的多头注意力动机相同：不同头能捕捉不同类型的关系。

- 当有$K$个头且每个头的输出维度为$d'$时，拼接后的输出维度为$K \times d'$。最终层通常采用平均而非拼接操作，以生成固定大小的输出。

## GATv2：修正静态注意力

- 原始的GAT存在一个细微的局限性：其注意力函数是**静态的**（也称为基于排名的）。注意力分数依赖于拼接$[W\mathbf{h}_i \| W\mathbf{h}_j]$，但由于注意力向量$\mathbf{a}$是在拼接之后才应用的，因此可将其分解为两个独立部分：$\mathbf{a}^T [W\mathbf{h}_i \| W\mathbf{h}_j] = \mathbf{a}_1^T W\mathbf{h}_i + \mathbf{a}_2^T W\mathbf{h}_j$。

- 这意味着给定节点$i$的邻居排序完全由邻居的特征$\mathbf{h}_j$决定（项$\mathbf{a}_1^T W\mathbf{h}_i$对$i$的所有邻居而言都是常数）。注意力排序实际上并不依赖于查询节点的特征。节点$i$和节点$k$会对同一组邻居给出相同的排序，这限制了模型的表达能力。

- **GATv2**（Brody等人，2022年）通过在应用注意力向量前引入非线性函数来修正这一问题：

$$e_{ij} = \mathbf{a}^T \text{LeakyReLU}\left(W \left[\mathbf{h}_i \| \mathbf{h}_j\right]\right)$$

- 将LeakyReLU移入计算过程意味着注意力分数是联合特征的非线性函数，无法再分解为独立项。这使得注意力变得**动态**：邻居的排序现在取决于具体的查询节点。GATv2在无需增加额外计算成本的前提下，表达能力明显强于GAT。

## 图Transformer

- 标准的消息传递式GNN受限于图拓扑结构：节点只能关注其直接邻居。经过$k$层后，来自$k$跳邻居的信息经过多次聚合而失去细节。这种局部性瓶颈（结合过平滑现象，见文档3）限制了模型捕捉长距离依赖的能力。

- **图Transformer**通过对所有节点对应用**全局自注意力**来打破这一瓶颈，无论它们之间是否存在边。每个节点都可以在单层内关注其他所有节点，这与标准Transformer类似（第7章）。

- 基本思路是：将所有节点视为令牌并应用Transformer自注意力机制：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

- 其中，$Q = XW_Q$、$K = XW_K$、$V = XW_V$分别是节点特征$X$的查询、键和值投影（与第7章完全一致）。这相当于在一个全连接图（完全图$K_n$，见文档2）上运行的GNN。

- 问题在于：全连接图忽略了实际的图结构。边的信息（哪些节点实际相连）被丢失了。有两种方法可以恢复这一信息：
- **Graphormer**（Ying等人，2021年）通过注意力分数中的**偏置项**将图结构注入到Transformer中：

$$A_{ij} = \frac{(\mathbf{h}_i W_Q)(W_K^T \mathbf{h}_j^T)}{\sqrt{d_k}} + b_{\text{spatial}}(i, j) + b_{\text{edge}}(i, j)$$

- 空间偏置$b_{\text{spatial}}$编码了节点$i$和$j$之间的最短路径距离；边偏置$b_{\text{edge}}$则编码了最短路径上的边特征。此外，Graphormer还采用了**中心性编码**，即将节点的度添加到其输入嵌入中，从而让模型获取每个节点在结构中的作用信息。

- **GPS**（通用、强大且可扩展的图Transformer，Rampášek等人，2022年）在每一层中结合了局部消息传递与全局注意力机制：

$$\mathbf{h}_i' = \text{MLP}\left(\mathbf{h}_i^{\text{MPNN}} + \mathbf{h}_i^{\text{Attention}}\right)$$

- 每一层会同时应用标准的GNN（用于捕捉局部结构）和Transformer（用于捕捉全局上下文），再将结果合并。这种方式兼顾了两者的优势：既利用消息传递获取局部结构信息，又借助注意力机制捕捉长距离依赖关系。

## 位置与结构编码

- 序列上的Transformer使用位置编码（第7章）来注入顺序信息。由于图没有固定的排序方式，因此需要针对图特有的编码方法。

- **拉普拉斯特征向量编码**利用图拉普拉斯矩阵的特征向量作为位置特征。最小的$k$个非平凡特征向量构成了图的谱嵌入：图中“相邻”的节点具有相似的特征向量值。这些特征向量会与节点特征拼接在一起。

- 需要注意的是：拉普拉斯特征向量存在符号歧义（若$\mathbf{u}$是特征向量，则$-\mathbf{u}$也是）。模型必须对这种符号变化保持不变性。解决方案包括在训练期间使用随机符号翻转作为数据增强，或学习符号不变的变换方式。

- **随机游走编码**计算从节点$i$出发的随机游走在$k$步后返回节点$i$的概率，其中$k = 1, 2, \ldots, K$。这些概率编码了局部结构信息：密集簇中的节点返回概率较高，而稀疏区域中的节点返回概率较低。着陆概率$p_{ii}^{(k)} = (A_{\text{rw}}^k)_{ii}$，其中$A_{\text{rw}} = D^{-1}A$为随机游走转移矩阵。

- **度编码** simply将节点度作为特征加入。这种方法出奇地有效，因为度是一种重要的结构信号：叶子节点（度为1）、桥接节点和枢纽节点的行为各不相同。

- 这些编码提供了普通Transformer所缺乏的结构信息，使得图Transformer在需要长距离推理的任务中能够超越传统的消息传递型GNN。

## 可扩展性

- GNN面临的根本性可扩展挑战在于：图可能包含数百万个节点和数十亿条边。在完整图上训练GNN需要将所有节点特征和整个邻接矩阵存入内存，这往往难以实现。

- GNN的**小批量训练**比图像或序列的训练更为复杂，因为节点之间存在相互连接。简单地采样一批节点时，还需要考虑它们的邻居（第1层）、邻居的邻居（第2层）等等。这种**邻域爆炸**现象意味着，一批1000个目标节点可能需要数百万个节点参与计算图。

- **邻域采样**（采用GraphSAGE风格，文件3）通过每层为每个节点采样固定数量的邻居来限制这种爆炸现象。若设置2层和每层15个样本，则每个目标节点的子图最多只包含$15^2 = 225$个节点，无论完整图的大小如何。

- **Cluster-GCN**（Chiang等人，2019年）利用图聚类算法（如METIS）将图划分为多个簇，然后逐个簇进行训练。簇内边较为密集（大多数邻居位于同一簇中），因此子图能够捕捉到相关的结构信息；跨簇边则通过偶尔纳入簇间边来处理。

- 图Transformer的可扩展性更具挑战性，因为其全局注意力的复杂度为$O(n^2)$。对于包含数百万个节点的图而言，全注意力机制并不可行。解决方案包括：
- 稀疏注意力模式（仅关注图中距离最近的$k$个节点）
- 线性注意力近似
- 结合局部消息传递（成本低，复杂度为$O(|E|)$）与在简化图上的全局注意力（节点数更少）

## 时序与动态图

- 我们迄今为止研究的图都是**静态的**：节点、边和特征均固定不变。但许多现实世界的图会**随时间演化**：新用户加入社交网络、金融交易产生新边、交通模式随昼夜变化，分子间的相互作用也会波动。

- **时序图**为每条边附加时间戳：$(i, j, t)$表示节点$i$在时间$t$与节点$j$发生了交互。难点在于如何学习既能捕捉图结构又能反映时序动态的表征。

- 主要有两种范式：

- **离散时间动态图（DTDG）**：将图表示为一系列快照$G_1, G_2, \ldots, G_T$，每个时间步对应一个快照。GNN处理每个快照，再用RNN或时序注意力机制捕捉快照之间的演变过程。这种方法简单，但会丢失精细的时间信息（快照之间的事件被忽略），且需选定合适的快照频率。

- **连续时间动态图（CTDG）**：将事件建模为带时间戳的交互流。每个事件$(i, j, t)$会在发生时刻更新节点$i$和$j$的表征。这种方式能保留所有时序信息。

- **时序图网络（TGN）**（Rossi等人，2020年）是领先的CTDG架构。每个节点维护一个**记忆状态**$\mathbf{s}_i(t)$，每当该节点参与交互时，该状态就会更新：

$$\mathbf{s}_i(t^+) = \text{GRU}\left(\mathbf{s}_i(t^-), \; \mathbf{m}_i(t)\right)$$

- 其中 $\mathbf{m}_i(t)$ 是从交互中计算出的消息（结合了两个节点的特征、边特征以及时间编码）。GRU（第6章）能够有选择地保留或遗忘过往信息，使模型既能捕捉长期模式，又能适应近期事件。

- **时间编码**将自上次交互以来的时间间隔表示为一个特征向量，类似于Transformer中的位置编码（第7章）。常用的方法是使用可学习的傅里叶特征：

$$\Phi(t) = \left[\cos(\omega_1 t), \sin(\omega_1 t), \ldots, \cos(\omega_d t), \sin(\omega_d t)\right]$$

- 这样能让模型对时间间隔有更丰富的表征：“该用户最后一次活跃是在5分钟前”与“3个月前”会被嵌入为不同的表示。

- **时序图注意力（TGAT）**在节点的时间邻域上应用自注意力机制：即最近的交互集合，每个交互的权重由特征相关性（类似GAT）和时间新近性共同决定。来自遥远过去的交互自然会被赋予较低的权重。

- 应用场景包括欺诈检测（金融图中的异常交易模式）、交通预测（根据历史流量模式预测拥堵情况）、社交网络动态分析（预测病毒式内容的传播）以及随时间变化的药物相互作用预测。

## 编程任务（请使用CoLab或笔记本）（续1）

1. 从零实现一个GAT注意力头。计算节点与其邻居之间的注意力权重，并验证它们之和为1。

```python
import jax
import jax.numpy as jnp

rng = jax.random.PRNGKey(0)
k1, k2, k3 = jax.random.split(rng, 3)

n_nodes, d_in, d_out = 5, 4, 3

# Random node features
H = jax.random.normal(k1, (n_nodes, d_in))

# Learnable parameters
W = jax.random.normal(k2, (d_in, d_out)) * 0.5
a = jax.random.normal(k3, (2 * d_out,)) * 0.5

# Adjacency (node 0 connects to 1, 2, 3)
neighbours_of_0 = [1, 2, 3]

# Transform features
Wh = H @ W  # (n_nodes, d_out)

# Compute attention scores for node 0
h_i = Wh[0]
scores = []
for j in neighbours_of_0:
    h_j = Wh[j]
    e_ij = jnp.dot(a, jnp.concatenate([h_i, h_j]))
    e_ij = jax.nn.leaky_relu(e_ij, negative_slope=0.2)
    scores.append(float(e_ij))

scores = jnp.array(scores)
alpha = jax.nn.softmax(scores)

print(f"Raw scores: {scores}")
print(f"Attention weights: {alpha}")
print(f"Sum of weights: {alpha.sum():.4f}")

# Weighted aggregation
h_new = sum(alpha[k] * Wh[neighbours_of_0[k]] for k in range(len(neighbours_of_0)))
print(f"Updated node 0 features: {h_new}")
```

1. 比较GCN（固定权重）与GAT（可学习权重）的聚合方式。说明GAT能够为邻居节点分配不同的权重，而GCN则对它们一视同仁。

```python
import jax
import jax.numpy as jnp

# 4 nodes: node 0 connects to 1, 2, 3
A = jnp.array([[0,1,1,1],
               [1,0,0,0],
               [1,0,0,0],
               [1,0,0,0]], dtype=float)

# Features: node 1 is very relevant, node 2 is noise, node 3 is moderate
H = jnp.array([[0.0, 0.0],   # node 0
               [1.0, 0.0],   # node 1 (signal)
               [0.0, 0.0],   # node 2 (noise)
               [0.5, 0.0]])  # node 3 (moderate)

# GCN: normalised adjacency weights
A_hat = A + jnp.eye(4)
D_inv = jnp.diag(1.0 / A_hat.sum(axis=1))
gcn_weights = (D_inv @ A_hat)[0]  # weights for node 0
print(f"GCN weights for node 0: {gcn_weights}")
print("  → All neighbours get roughly equal weight")

# GAT: learned attention (simulated)
# Suppose the attention mechanism learns to focus on node 1
gat_weights = jnp.array([0.1, 0.7, 0.05, 0.15])  # learned
print(f"\nGAT weights for node 0: {gat_weights}")
print("  → Node 1 (informative) gets most attention")

gcn_output = gcn_weights @ H
gat_output = gat_weights @ H
print(f"\nGCN output: {gcn_output}  (diluted by noise)")
print(f"GAT output: {gat_output}  (focused on signal)")
```

1. 展示位置编码的优势。计算图的拉普拉斯特征向量编码，并证明结构相似的节点会获得相似的编码。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Barbell graph: two cliques connected by a bridge
n = 10
A = jnp.zeros((n, n))
# Clique 1: nodes 0-4
for i in range(5):
    for j in range(i+1, 5):
        A = A.at[i,j].set(1).at[j,i].set(1)
# Clique 2: nodes 5-9
for i in range(5, 10):
    for j in range(i+1, 10):
        A = A.at[i,j].set(1).at[j,i].set(1)
# Bridge
A = A.at[4,5].set(1).at[5,4].set(1)

D = jnp.diag(A.sum(axis=1))
L = D - A
eigenvalues, eigenvectors = jnp.linalg.eigh(L)

# Use first 3 non-trivial eigenvectors as positional encoding
pe = eigenvectors[:, 1:4]

print("Laplacian Positional Encodings:")
for i in range(n):
    group = "Clique 1" if i < 5 else "Clique 2"
    bridge = " (bridge)" if i in [4, 5] else ""
    print(f"  Node {i} ({group}{bridge}): {pe[i]}")

plt.scatter(pe[:5, 0], pe[:5, 1], c="#3498db", s=80, label="Clique 1")
plt.scatter(pe[5:, 0], pe[5:, 1], c="#e74c3c", s=80, label="Clique 2")
plt.scatter(pe[[4,5], 0], pe[[4,5], 1], c="black", s=120, marker="*",
            label="Bridge nodes", zorder=5)
plt.legend(); plt.grid(True)
plt.title("Laplacian Eigenvector Positional Encodings")
plt.xlabel("Eigenvector 1"); plt.ylabel("Eigenvector 2")
plt.show()
```

## 3D图网络

_3D图网络将GNN技术扩展到具有空间几何结构的数据上，在这类数据中必须正确处理旋转和平移操作。本文件介绍了几何图、SE(3)/E(n)等变性、SchNet、DimeNet、EGNN、张量场网络，以及这些技术在分子性质预测、蛋白质结构分析、材料科学和药物发现领域的应用——这些都是从三维物理世界中学习信息的架构。_

- 文件3和4中的GNN是在抽象图上运行的：节点拥有特征，边则表示节点间的连接关系，但不存在三维空间的概念。社交网络图就没有几何结构。不过，GNN许多最具影响力的应用场景涉及存在于**物理三维空间**中的数据，比如分子、蛋白质、晶体、点云。对于这类数据而言，节点的空间位置包含着至关重要的信息，而抽象GNN则无法捕捉到这些信息。

- 挑战在于，三维数据具有**几何对称性**（文件1）：旋转分子或平移分子都不会改变其性质。因此，3D GNN必须尊重这些对称性。如果旋转分子后能量预测值发生变化，那这个预测结果就是错误的。

## 几何图

- **几何图**是一种嵌入在三维空间中的图。每个节点$i$除了拥有特征向量$\mathbf{h}_i$外，还有位置$\mathbf{r}_i \in \mathbb{R}^3$。边的定义可以是基于空间距离（连接距离在$r_{\text{cut}}$范围内的节点），而非基于具体的化学键。

- 对于分子来说，几何图的节点为原子（具有元素类型、电荷等特征），边则为化学键。节点的3D位置$\mathbf{r}_i$即原子的坐标，这些坐标可以通过量子力学或实验方法（如X射线晶体学、冷冻电镜）确定。

- 对于来自LiDAR或3D扫描仪的点云数据（见第8章和第11章），每个点都是一个节点，拥有位置信息以及可选的特征（如颜色、强度）。相邻点之间通过边相连，从而形成**k最近邻图**或半径图。

- 在消息传递过程中，关键的几何量包括：

- **原子间距离**：$d_{ij} = \|\mathbf{r}_i - \mathbf{r}_j\|$。该距离不受旋转和平移的影响。如果两个分子的原子间距离相同，那么无论它们的方向如何，其形状都是一样的。

- **键角**：即节点$i$处向量$\mathbf{r}_j - \mathbf{r}_i$与$\mathbf{r}_k - \mathbf{r}_i$之间的夹角$\theta_{ijk}$。键角能够反映超出简单距离关系的局部几何结构。

- **二面角（扭转角）**：即由$(i, j, k)$和$(j, k, l)$所确定的平面之间的夹角$\phi_{ijkl}$。二面角能够体现结构在三维空间中的扭曲程度，对于蛋白质主链的几何结构分析非常重要。

- **相对位置向量**：$\mathbf{r}_{ij} = \mathbf{r}_j - \mathbf{r}_i$。这类向量不受平移影响，但会随旋转而变化。因此，使用它们时需要采用具有等变性的架构，而不仅仅是具有不变性的架构。

## SE(3)与E(n)等变性

- 三维物理数据的对称群是**欧几里得群**$E(3)$，它包含了所有的旋转、反射和平移操作。其子群**$SE(3)$**（特殊欧几里得群）包含旋转和平移操作，但不包括反射操作。

- 3D GNN应当具备以下特性：
- 对于标量输出（如能量、结合亲和力），应当具有**平移不变性**：将所有原子同时平移相同的向量，预测结果不应发生变化。
- 对于标量输出，还应当具有**旋转不变性**：旋转分子后，其能量值不应改变。
- 对于向量/张量输出（如力、偶极矩），应当具有**旋转等变性**：旋转分子时，预测出的力向量也应随之进行相同的旋转。

![SE(3)等变性：旋转分子不会改变标量预测值（如能量），但会使向量预测值（如力）发生相应变化](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/se3_equivariance.svg)

- 从形式上来看，对于标量预测$f$和旋转操作$R \in SO(3)$，有：

$$f(R\mathbf{r}_1, R\mathbf{r}_2, \ldots) = f(\mathbf{r}_1, \mathbf{r}_2, \ldots) \quad \text{(不变性)}$$

- 对于向量预测$\mathbf{F}$，则有：

$$\mathbf{F}(R\mathbf{r}_1, R\mathbf{r}_2, \ldots) = R \cdot \mathbf{F}(\mathbf{r}_1, \mathbf{r}_2, \ldots) \quad \text{(等变性)}$$

- 这些约束条件实际上与文件1中提到的不变性/等变性框架相对应，只不过这里是将该框架具体应用于三维空间的旋转和平移操作上。

- 有两种设计思路：

1. **不变性架构**：仅使用不变的几何特征（如距离、角度）作为消息传递的输入。网络的内部表示为标量形式（具有不变性）。这种架构简单高效，但若要生成向量输出，则必须破坏对称性。
2. **等变性架构**：在整个网络中保持向量（以及更高阶的张量）形式的表示，确保每一层都具有等变性。这种架构的表达能力更强，能够自然地生成向量和张量，但结构更为复杂。

## SchNet：基于距离的消息传递

- **SchNet**（由Schütt等人于2017年提出）是一种基础的3D不变性GNN。它的核心创新在于**连续滤波器卷积**：与分子GNN中使用固定的边类型不同，SchNet直接根据原子间距离来生成消息滤波器。

- 首先，利用**径向基函数**将原子间距离$d_{ij}$转换为特征向量：

$$\text{RBF}(d_{ij}) = \left[\exp\left(-\gamma_1 (d_{ij} - \mu_1)^2\right), \ldots, \exp\left(-\gamma_K (d_{ij} - \mu_K)^2\right)\right]$$

- 每个径向基函数都是以$\mu_k$为中心、宽度为$\gamma_k$的高斯函数。这相当于一种可学习的距离位置编码：连续的距离被映射到高维特征空间中，网络便可以在此空间中学习与距离相关的相互作用。通常，这些中心点$\mu_k$是从0开始均匀分布到截止半径处的。

- 节点$j$向节点$i$发送的SchNet消息为：

$$\mathbf{m}_{j \to i} = \mathbf{h}_j \odot W_{\text{filter}}(\text{RBF}(d_{ij}))$$

- 其中$W_{\text{filter}}$是一个多层感知器，用于将RBF展开结果映射为滤波向量，而$\odot$表示逐元素相乘（即哈达玛积，见第2章）。该滤波器会随距离变化，因此相邻原子之间的相互作用方式与远处原子不同。逐元素相乘的作用类似于一种门控机制（见第6章）：基于距离的滤波器决定了各个特征维度中有多少信息能够传递过去。

- 由于SchNet仅使用距离这一不变量，整个模型天然具备旋转和平移不变性。除了这一设计选择之外，无需对对称性进行特殊处理。

## DimeNet与SphereNet：角度与二面角

- 单纯的距离无法完全描述3D结构。两种不同的分子构象可能具有相同的成对距离，但键角却不同（这就是“距离几何歧义”问题）。**DimeNet**（Gasteiger等人，2020年）在消息传递过程中加入了**键角**信息。

- DimeNet采用**有向消息传递**方式：消息沿着有向边传递，边$(j \to i)$上的消息会受到边$(k \to j)$与边$(j \to i)$之间夹角的影响：

$$\mathbf{m}_{kj \to ji} = f\left(\mathbf{m}_{kj}, d_{ji}, \theta_{kji}\right)$$

- 夹角$\theta_{kji}$是通过球贝塞尔函数和球谐函数来表示的（这些函数是描述球面上角度信息的自然工具，类似于用于描述距离的RBF函数）。这样一来，模型既能获取方向信息，又能保持结构不变性。

- **SphereNet**（Liu等人，2022年）则更进一步，引入了**二面角**$\phi_{lkji}$，从而能够完整地描述3D扭转结构。其层次结构如下：
- 距离——描述原子间的接近程度；
- 角度——描述局部几何结构（弯曲还是直线）；
- 二面角——描述3D扭转结构（对蛋白质主链及药物结合而言非常重要）。

- 每增加一个层次，就能提升几何分辨率，但相应的计算复杂度也会上升（距离的计算复杂度为$O(|E|)$，角度为$O(|E| \cdot k)$，二面角则为$O(|E| \cdot k^2)$，其中$k$为平均度数）。

## E(n)等变图神经网络（EGNN）

- **EGNN**（Satorras等人，2021年）采用了等变方法：它不仅使用不变特征，还在每一层同时更新节点特征和节点位置，从而始终保持结构的等变性。

- 对于节点$i$，EGNN的更新公式如下：

$$\mathbf{m}_{ij} = \phi_e\left(\mathbf{h}_i, \mathbf{h}_j, d_{ij}^2, a_{ij}\right)$$

$$\mathbf{r}_i' = \mathbf{r}_i + C \sum_{j \neq i} (\mathbf{r}_i - \mathbf{r}_j) \cdot \phi_r(\mathbf{m}_{ij})$$

$$\mathbf{h}_i' = \phi_h\left(\mathbf{h}_i, \sum_j \mathbf{m}_{ij}\right)$$

- 关键在于节点位置的更新：节点位置是通过相对位置向量$(\mathbf{r}_i - \mathbf{r}_j)$的加权和来调整的。这些权重来自消息函数$\phi_r$，而该函数仅依赖于不变量（即特征和距离）。这种设计是**可证明具有等变性的**：如果所有输入节点的位置都绕某点旋转$R$角度，那么所有输出节点的位置也会以相同的$R$角度旋转。

- EGNN的优点在于它无需显式使用球谐函数或不可约表示即可实现等变性。相对位置向量承载着方向信息，而不变的消息函数则控制着这些方向信息的使用方式。

- 不过，这种简洁性也带来了一定的代价：EGNN仅能使用一阶向量表示。若要表示四极矩或应力张量这类高阶张量，就需要对其进行扩展。

## 张量场网络与高阶表示

- **张量场网络**（Thomas等人，2018年）及其后续发展成果（如**SE(3)-Transformers**、**MACE**、**Equiformer**）利用旋转群不可约表示的全部理论，构建出具有等变性的层结构。

- 在表示论中（与第2章的线性代数相关），3D空间中的旋转可以分解为具有整数阶数$\ell$的不可约分量：
- $\ell = 0$：标量（1个分量，具有不变性）。例如能量、电荷。
- $\ell = 1$：向量（3个分量，其旋转方式与位置向量相同）。例如力、偶极矩。
- $\ell = 2$：二阶对称无迹张量（5个分量）。例如四极矩、应力张量。
- 更高的$\ell$值则可以描述更为复杂的角度结构。

- 这些被称为**球张量**，它们在旋转$R$作用下会通过**维格纳-迪矩阵**$D^\ell(R)$发生变换：标量保持不变，向量会按照$R$矩阵旋转，而二阶张量则会通过更复杂的矩阵进行旋转。

- 基于球张量的**等变消息传递**利用**克莱布什-戈尔丹张量积**来组合不同阶数的特征：

$$(\mathbf{f}^{\ell_1} \otimes \mathbf{f}^{\ell_2})^{\ell_{\text{out}}} = \sum_{m_1, m_2} C^{\ell_{\text{out}}, m_{\text{out}}}_{\ell_1, m_1, \ell_2, m_2} \cdot f^{\ell_1}_{m_1} \cdot f^{\ell_2}_{m_2}$$

- 克莱布什-戈尔丹系数$C$是固定的数学常数，它们确保了张量积具有等变性。这相当于矩阵乘法在SO(3)群下的等变版本。

- **MACE**（Batatia等人，2022年）通过使用高阶消息（多个邻居节点特征的乘积），在较少的消息传递层数下就能获得较高的精度。通过构建按原子间距离、角度以及张量积等方式定义的相互作用，MACE能够高效地描述复杂的原子间相互作用。

- **Equiformer**（Liao & Smidt，2023年）则将等变的球张量特征与Transformer的注意力机制相结合，从而形成了SE(3)等变的图Transformer。注意力分数是基于不变特征计算得出的，而数值聚合则是在等变张量特征上进行的。

## 应用领域

- **分子性质预测**：给定分子的3D结构后，可预测其能量、力、偶极矩、HOMO-LUMO能隙、毒性及溶解度等性质。这是3D GNN最成熟的应用领域。在量子化学数据集（QM9、OC20）上训练的模型能够在多种性质预测上达到与实验值相当的水平，从而实现数百万种候选分子的虚拟筛选。

- **分子动力学加速**：利用量子力学方法（密度泛函理论DFT）来计算原子间的作用力成本极高（当电子数为$n$时，计算复杂度为$O(n^3)$）。经过训练可用于预测力的3D GNN可以替代DFT用于分子动力学模拟，不仅能让计算速度提升$10^3$至$10^6$倍，还能保持与DFT相近的精度。这使得人们能够对更大规模、更长时间尺度的系统进行模拟，进而发现传统方法无法观察到的现象。

- **蛋白质结构**：蛋白质是由氨基酸链构成的，它们会折叠成复杂的3D结构。蛋白质的主链可视为一种几何图，其中节点代表氨基酸残基，边则连接空间上彼此接近的残基。3D GNN被用于预测蛋白质的功能、识别结合位点以及进行蛋白质设计（逆向折叠：给定目标结构，反推相应的氨基酸序列）。**AlphaFold**就是利用几何与图论方法，根据氨基酸序列来预测蛋白质结构。

- **材料科学与催化**：晶体材料具有周期性的3D结构。GNN可以用来描述这些重复的单元结构，并预测材料的各种性质，如能带隙、形成能以及机械强度。Open Catalyst项目（OC20/OC22）通过基准测试评估了GNN在预测催化剂表面吸附能方面的性能，从而加速了可再生能源用新型催化剂的研发进程。

- **药物发现**：3D GNN能够预测药物分子如何与目标蛋白质结合。结合亲和力取决于药物分子与蛋白质结合口袋之间的3D形状匹配程度以及化学相互作用。像**DiffDock**这样的模型则结合了等变GNN与扩散模型（第8章），用于预测药物在蛋白质结合口袋中的3D姿态。

## 图的生成

- 上述所有架构都用于**分析**现有的图结构。而**图生成**则是创建新的图结构：设计具有特定性质的分子、生成用于测试的合成社交网络，或是提出新的蛋白质结构。这可以说是图级预测的生成式对应方法。

- 其面临的挑战在于：图是离散的、大小可变的，且具有组合性。要生成一个图，就需要决定要创建多少个节点、这些节点具备什么特征，以及哪些节点之间应该建立连接。随着节点数量的增加，可能的图结构数量会以超指数的速度增长。

- **自回归生成**方法是逐个节点（或逐条边）来构建图结构。**GraphRNN**（You等人，2018年）采用顺序生成的方式：RNN会维护一个状态，在每一步中生成一个新的节点，并决定将该节点与哪些现有节点相连。虽然这种生成顺序为原本无序的图结构赋予了人为的顺序，但BFS排序方式有助于保留最近生成的节点的相关性。

- **基于VAE的生成**方法是将图结构编码到连续的潜在空间中（通过GNN编码器），然后再从采样的潜在向量中解码出新的图结构。**GraphVAE**能够一次性生成一个概率性的邻接矩阵$\hat{A} \in [0, 1]^{n \times n}$，但其计算复杂度为$O(n^2)$，且生成的输出为密集型数据，需要经过阈值处理。潜在空间使得平滑插值成为可能：在两个分子嵌入向量之间过渡时，可以生成在化学上合理的中间结构。

- **基于扩散的生成**方法则是将扩散框架（第8章）应用于图结构。在正向过程中，逐步向节点特征和边结构中添加噪声；而在反向过程中，则通过学习去噪技术，从含噪声的数据中生成有效的图结构。**DiGress**（Vignac等人，2023年）对节点和边两种类型都应用了离散扩散机制，从而自然地处理了图数据的分类特性。

- 对于**分子生成**而言，关键约束条件是**化学合理性**：生成的分子必须遵循价键规则（例如碳原子形成4个键，氧原子形成2个键等）。像**Junction Tree VAE (JT-VAE)**这样的方法会将分子分解为有效的子结构（环、链、官能团），再通过组合这些子结构来生成分子，从而从结构上保证其化学合理性。

- **目标导向的生成**方法则是针对特定性质进行优化：比如生成与目标蛋白质具有高结合亲和力、低毒性且溶解性良好的分子。这种方法将图生成与性质预测相结合（使用3D GNN作为性质评估工具），通过“生成→评估→优化”的循环不断改进分子结构。强化学习（第6章）或贝叶斯优化技术则可用于引导在化学空间中的搜索过程。

- **DiffDock**（Corso等人，2023年）采用了SE(3)-等变扩散模型来预测药物分子如何与蛋白质结合口袋结合。该模型通过从随机位置去噪的方式，生成药物在蛋白质中的3D结合姿态（即药物相对于蛋白质的位置和方向），同时结合了该模型中的3D等变网络与第8章中的扩散框架。

## 编程任务（可使用CoLab或笔记本完成）

1. 利用原子间距离构建一个简单的、具有不变性的3D消息传递层。将该层应用于一个小分子（水：H-O-H），并验证其输出结果是否具有旋转不变性。

```python
import jax
import jax.numpy as jnp

# Water molecule: O at origin, two H atoms
positions = jnp.array([[0.0, 0.0, 0.0],     # O
                        [0.96, 0.0, 0.0],    # H1
                        [-0.24, 0.93, 0.0]])  # H2

# Node features: [atomic number]
features = jnp.array([[8.0], [1.0], [1.0]])

# Compute pairwise distances (invariant)
def pairwise_distances(pos):
    diff = pos[:, None, :] - pos[None, :, :]
    return jnp.sqrt(jnp.sum(diff**2, axis=-1) + 1e-8)

# Simple distance-based message passing
def invariant_message_pass(features, positions):
    dists = pairwise_distances(positions)
    # RBF expansion with 4 centres
    centres = jnp.array([0.5, 1.0, 1.5, 2.0])
    rbf = jnp.exp(-5.0 * (dists[:, :, None] - centres[None, None, :]) ** 2)

    # Message: features weighted by distance-dependent filter
    messages = jnp.einsum("ij,jd->id", rbf.sum(axis=-1), features)
    return messages

output1 = invariant_message_pass(features, positions)

# Rotate the molecule by 90 degrees around z-axis
R = jnp.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]], dtype=float)
rotated_positions = (R @ positions.T).T

output2 = invariant_message_pass(features, rotated_positions)

print(f"Original output:\n{output1}")
print(f"\nRotated output:\n{output2}")
print(f"\nInvariant: {jnp.allclose(output1, output2, atol=1e-5)}")
```

1. 计算三个原子之间的键角，并验证其具有旋转不变性。

```python
import jax.numpy as jnp

def bond_angle(r_i, r_j, r_k):
    """Angle at node j between edges j->i and j->k."""
    v1 = r_i - r_j
    v2 = r_k - r_j
    cos_angle = jnp.dot(v1, v2) / (jnp.linalg.norm(v1) * jnp.linalg.norm(v2))
    return jnp.arccos(jnp.clip(cos_angle, -1, 1))

# Three atoms
r1 = jnp.array([1.0, 0.0, 0.0])
r2 = jnp.array([0.0, 0.0, 0.0])
r3 = jnp.array([0.0, 1.0, 0.0])

angle_original = bond_angle(r1, r2, r3)
print(f"Original angle: {jnp.degrees(angle_original):.1f}°")

# Apply random rotation
R = jnp.array([[0.36, 0.48, -0.80],
               [-0.80, 0.60, 0.00],
               [0.48, 0.64, 0.60]])
r1_rot, r2_rot, r3_rot = R @ r1, R @ r2, R @ r3

angle_rotated = bond_angle(r1_rot, r2_rot, r3_rot)
print(f"Rotated angle:  {jnp.degrees(angle_rotated):.1f}°")
print(f"Invariant: {jnp.allclose(angle_original, angle_rotated, atol=1e-4)}")
```

1. 展示等变位置更新机制（EGNN风格）。利用基于距离加权的相对向量来更新节点位置，并验证其等变性。

```python
import jax
import jax.numpy as jnp

def egnn_position_update(positions, features):
    """Simple EGNN-style equivariant position update."""
    n = positions.shape[0]
    new_positions = jnp.zeros_like(positions)

    for i in range(n):
        shift = jnp.zeros(3)
        for j in range(n):
            if i != j:
                r_ij = positions[i] - positions[j]
                d_ij = jnp.linalg.norm(r_ij)
                # Weight based on distance (simple: inverse distance)
                weight = 1.0 / (d_ij + 1.0)
                # Scale by feature similarity
                feat_sim = jnp.dot(features[i], features[j])
                shift = shift + weight * feat_sim * r_ij
        new_positions = new_positions.at[i].set(positions[i] + 0.1 * shift)

    return new_positions

# 3 atoms
pos = jnp.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
feat = jnp.array([[1.0, 0.5], [0.5, 1.0], [0.8, 0.3]])

# Update positions
pos_new = egnn_position_update(pos, feat)

# Now rotate input, update, and check if output is rotated consistently
R = jnp.array([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])
pos_rot = (R @ pos.T).T
pos_new_from_rot = egnn_position_update(pos_rot, feat)

# Should be the same as rotating the original output
pos_new_then_rot = (R @ pos_new.T).T

print(f"Update then rotate:\n{jnp.round(pos_new_then_rot, 4)}")
print(f"\nRotate then update:\n{jnp.round(pos_new_from_rot, 4)}")
print(f"\nEquivariant: {jnp.allclose(pos_new_then_rot, pos_new_from_rot, atol=1e-4)}")
```
