---
title: "机器学习"
date: "2026-11-05"
order: 6
slug: "compendium/06-machine-learning"
description: "经典机器学习算法无需通过显式编程即可从数据中学习模式，它们使用解析解或启发式搜索方法，而非梯度下降法。本文件介绍了朴素贝叶斯、k-近邻、决策树、随机森林、支持向量机、k均值聚类以及主成分分析等算法。"
tags: []
---

## 经典机器学习

_经典机器学习算法无需通过显式编程即可从数据中学习模式，它们使用解析解或启发式搜索方法，而非梯度下降法。本文件介绍了朴素贝叶斯、k-近邻、决策树、随机森林、支持向量机、k均值聚类以及主成分分析等算法。_

- 机器学习研究的是那些能够通过从数据中学习来提升自身在某项任务上性能的算法，而非依靠预先编写的规则来运行。与其手动编写“如果收入大于5万美元且年龄小于30岁，则批准贷款”这样的规则，不如将数千条过去的贷款审批记录交给算法，让算法自行找出其中的规律。

- 机器学习大致可分为三种范式。**监督学习**使用带有标签的数据，即每个输入数据都对应一个已知的正确输出，算法的任务就是学习输入与输出之间的映射关系。**无监督学习**则处理没有标签的数据，试图发现其中隐藏的结构，比如数据簇或更简洁的表示形式。**强化学习**则是通过试错来学习，根据在特定环境中的行为获得奖励或惩罚（相关内容见文件04）。

- 在监督学习中，**分类任务**用于预测离散的类别（如垃圾邮件与否、猫还是狗），而**回归任务**则用于预测连续数值（如房价、明天的温度）。不过这两者之间的界限并不总是很清晰：逻辑回归虽然被归类为回归算法，但实际上却用于分类任务。

- 在概率模型中，另一个重要的区别在于**生成模型**与**判别模型**。生成模型会学习联合分布$P(x, y)$，也就是理解数据是如何生成的，因此它能够生成新的样本。而判别模型则直接学习$P(y \mid x)$，只关注不同类别之间的边界。朴素贝叶斯属于生成模型；逻辑回归（见文件02）则属于判别模型。生成模型更具灵活性，但训练起来更为困难；而当数据足够充足时，判别模型往往能实现更高的分类精度。

- **朴素贝叶斯**是最简单且最有效的分类器之一。它直接应用了贝叶斯定理（详见第05章）：

$$P(C_k \mid x) = \frac{P(x \mid C_k) \, P(C_k)}{P(x)}$$

- “朴素”这一名称源于该模型所做出的一个强独立性假设：它认为在给定类别的情况下，各个特征之间是相互独立的。例如，在对邮件进行垃圾邮件分类时，朴素贝叶斯认为，一旦确定某封邮件是垃圾邮件，那么其中是否包含“免费”这个词就与是否包含“获胜者”这个词无关。实际上这种情况几乎从未成立，但该分类器的效果仍然出奇地好。

- 由于所有类别的$P(x)$值都是相同的，因此分类过程可以简化为选择使分子值最大的类别：

$$\hat{y} = \arg\max_{k} \; P(C_k) \prod_{i=1}^{n} P(x_i \mid C_k)$$

- 先验概率$P(C_k)$其实就是各类别在训练数据中所占的比例。似然概率$P(x_i \mid C_k)$则取决于所使用的特征类型，因此也就产生了三种常见的变体。

- **多项式朴素贝叶斯**适用于计数数据，比如文档中单词出现的频率。每个特征$x_i$表示单词$i$出现的次数，其似然概率遵循多项式分布。这是文本分类、情感分析以及垃圾邮件过滤任务中的标准选择。

- **高斯朴素贝叶斯**则假设每个特征在每个类别内都服从正态分布。我们需要从训练数据中估算出类别$k$下特征$i$的均值$\mu_{ik}$和方差$\sigma_{ik}^2$，然后计算如下公式：

$$P(x_i \mid C_k) = \frac{1}{\sqrt{2\pi\sigma_{ik}^2}} \exp\!\left(-\frac{(x_i - \mu_{ik})^2}{2\sigma_{ik}^2}\right)$$

- 当特征为连续数值时，比如身高、体重或传感器读数，这就是最合适的模型。

![两个重叠的高斯条件分布，以及两者交叉处的决策边界](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/naive_bayes_classify.svg)

- **伯努利朴素贝叶斯**用于处理二元特征：每个特征要么存在（值为1），要么不存在（值为0）。它不需要统计某个单词出现的次数，只需判断该单词是否存在即可。这种方法非常适合处理短文本或二元特征向量。

- 但在实际应用中，如果某个特征在训练数据中从未出现在某个特定类别中，那么该特征的似然概率就会变为零，由于所有概率值都是相乘的，整个后验概率也会变为零。**拉普拉斯平滑**可以通过为每组特征-类别组合添加一个小的常数（通常为1）来解决这个问题：

$$P(x_i \mid C_k) = \frac{\text{count}(x_i, C_k) + \alpha}{\text{count}(C_k) + \alpha \cdot V}$$

- 这里$\alpha$是平滑参数（通常为1），$V$则是该特征可能取值的数量。这样就能确保没有任何概率值恰好为零。

- **决策树**则采用完全不同的方法。它不计算概率，而是通过一系列“是/否”问题来划分特征空间。可以将其想象成“二十个问题”游戏：在每一步中，都会提出一个能够最大程度缩小可能性范围的问题。

- 决策树从包含所有训练样本的根节点开始。在每个内部节点，它会选择一个特征以及一个阈值来进行划分（例如“年龄是否小于30岁？”）。根据回答，样本会被导向左侧或右侧。这个过程会递归地进行，直到到达叶子节点，此时就会得到预测结果：对于分类任务，就是多数类别；对于回归任务，则是平均值。

![具有两层特征划分结构的决策树，包含“是/否”分支，以及显示类别预测结果的彩色叶子节点](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/decision_tree_split.svg)

- 关键问题在于：应该选择哪个特征来进行划分呢？理想情况下，划分后的子节点应尽可能“纯净”，即大多数样本都属于同一类别。衡量数据纯度的两种常见指标是**基尼不纯度**和**熵**。

- **基尼不纯度**用于衡量：如果按照该节点中的分布来给随机选取的样本打标签，那么该样本被错误分类的概率是多少。

$$\text{Gini}(S) = 1 - \sum_{k=1}^{K} p_k^2$$

- 如果一个节点完全属于某一类别，那么吉尼系数为0。如果各类别的分布相当均衡（比如两个类别各占50%），则吉尼系数达到最大值0.5。

- **熵**（源自第05章的信息论部分）用于衡量平均惊讶程度：

$$H(S) = -\sum_{k=1}^{K} p_k \log_2 p_k$$

- 纯节点的熵为0。而完全均衡的二分类节点的熵为1比特。实际上，吉尼系数和熵所对应的决策树效果非常相似；由于不需要计算对数，吉尼系数的计算速度稍快一些。

- **信息增益**表示通过某种分割方式后，数据的不纯度降低了多少。对于将集合$S$分割为子集$S_L$和$S_R$的分割操作，其信息增益为：

$$\text{IG}(S, \text{split}) = H(S) - \frac{|S_L|}{|S|} H(S_L) - \frac{|S_R|}{|S|} H(S_R)$$

- 该算法会在每个节点上选择信息增益最高的那种分割方式。这是一种局部最优策略，并非全局最优，但在实际应用中效果不错。

- **回归树**的工作原理类似，只不过其叶节点会预测连续数值（即到达该叶节点的所有样本的平均值），且分割标准是方差降低，而非吉尼系数或熵。

- 如果不加以控制，决策树会不断进行分割，直到所有叶节点都属于同一类别，这实际上相当于把训练数据完整地记住了。这种情况属于严重的过拟合现象。**剪枝**技术可以解决这一问题：预剪枝会在树结构生长之前设定一些限制，如最大深度、每片叶节点的最小样本数，或是进行分割所需的最小信息增益。而后剪枝则是先让树完全生长出来，再删除那些无法提升验证集性能的枝条。

- 单个决策树虽然易于理解，但往往不够稳定：数据的微小变化就可能导致树结构发生很大变化。**集成方法**则通过结合多个模型，从而获得比单个模型更好的预测结果。

- 这类方法的核心理念就是“众智”。如果你让100个性能一般的分类器各自做出判断后再取多数意见，只要这些分类器犯错的概率相互独立，那么整体性能就会非常好。

- **装袋法**（Bootstrap聚合）是在不同的随机数据子集上训练多个模型，这些子集是通过有放回抽样得到的。每个模型大约只能看到原始数据的63%。在预测时，要么对各个模型的输出结果取平均值（用于回归任务），要么进行多数投票（用于分类任务）。由于每个模型处理的数据不同，它们犯错的类型也不同，因此取平均值可以大大减少误差的波动。

- **随机森林**其实就是将装袋法应用于决策树，不过它还有一个额外的特点：在每次分割时，树只会考虑一组随机特征（通常是总共$d$个特征中的$\sqrt{d}$个）。这一做法进一步降低了各棵树之间的相关性，使得集成模型的性能更加出色。随机森林是机器学习领域中最可靠、最常用的预置分类器之一。

![并列对比图：装袋法同时训练多个模型并取平均值，而提升法则是依次训练模型以纠正之前的错误](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/ensemble_methods.svg)

- **提升法**则采用完全相反的思路。它不是独立训练模型，而是依次训练模型，每一个新的模型都会专注于那些被前序模型误判的样本。

- **AdaBoost**（自适应提升）会为每个训练样本分配一个权重。最初所有样本的权重都是相等的。在训练出一个性能较弱的模型之后（通常是一个非常简单的决策树，称为“桩模型”），那些被误分类的样本会获得更高的权重，这样下一个模型就会更加关注这些样本。最终的结果就是所有模型预测结果的加权平均，其中性能较好的模型会有更大的影响力：

$$H(x) = \text{sign}\!\left(\sum_{t=1}^{T} \alpha_t \, h_t(x)\right)$$

- 第$t$个模型的权重$\alpha_t$取决于它的错误率$\epsilon_t$：

$$\alpha_t = \frac{1}{2} \ln\!\left(\frac{1 - \epsilon_t}{\epsilon_t}\right)$$

- 错误率较低的模型会获得较大的正权重；而那些错误率与随机水平相当的模型（$\epsilon = 0.5$）则权重为0。

- **梯度提升法**是对这一理念的进一步拓展。它不是重新调整样本的权重，而是让每个新模型去预测当前整个集成模型所产生的残差误差（即损失函数的负梯度）。对于平方误差损失来说，残差其实就是预测值与真实值之间的差异。基于决策树的梯度提升法（GBDT）是许多结构化数据竞赛中获胜方案的底层技术，常见的实现包括XGBoost、LightGBM和CatBoost。

- 两者的核心区别在于：装袋法旨在降低**方差**（即消除噪声），而提升法则旨在降低**偏差**（即纠正系统性错误）。当单个模型出现过拟合时，装袋法效果更好；而当模型欠拟合时，提升法则更为有效。

- 转到无监督学习领域，**K-均值聚类**是最简单且应用最广泛的聚类算法。给定$n$个数据点以及目标聚类数$K$，该算法通过最小化每个数据点到其所在聚类中心的总距离，将每个数据点分配到$K$个聚类中的一个。

- 该算法包含两个步骤：首先，将每个数据点分配到距离它最近的聚类中心；然后，将每个聚类中心的坐标更新为所有属于该中心的数据点的平均值。重复这个过程，直到数据点的分配不再发生变化。由于每一步中各聚类内的总距离都在减小或保持不变，因此该算法必然会收敛。

![包含三个聚类的2D散点图，图中标出了聚类中心以及虚线构成的聚类边界](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/kmeans_clustering.svg)

- 从数学上讲，K-均值算法旨在最小化聚类内的平方和，这一数值被称为**惯性**：

$$J = \sum_{k=1}^{K} \sum_{x \in C_k} \|x - \mu_k\|^2$$

其中$\mu_k$是聚类$C_k$的聚类中心。

- K-均值算法对初始参数非常敏感。如果初始的聚类中心设置不当，就可能会导致算法陷入较差的局部最小值。**K-均值++**初始化策略则是先随机选择一个聚类中心，然后再按照每个候选中心到最近已选定中心的距离的平方作为概率来选择下一个聚类中心。这种做法能够使初始聚类中心更加分散，几乎总能得到更好的聚类结果。
- 如何选择$K$值？有两种常用方法。**肘部法则**通过绘制惯性值与$K$值的关系图，找出“肘点”——即再增加簇数也无法带来显著改善的点。**轮廓系数**则用于衡量一个点与其所在簇的相似程度，以及它与最近其他簇的差异程度，其取值范围为-1（属于错误簇）到+1（属于理想簇）。所有点的平均轮廓系数可用来评估簇的整体质量。

- K-Means算法存在局限性：它假设簇为大小大致相同的球形结构，并且要求每个点只能属于一个簇。**高斯混合模型（GMM）**则放宽了这些限制。

- GMM将数据视为由$K$个高斯分布混合而成的整体，每个高斯分布都有各自的均值$\mu_k$、协方差$\Sigma_k$以及混合权重$\pi_k$（这些权重之和为1）：

$$P(x) = \sum_{k=1}^{K} \pi_k \, \mathcal{N}(x \mid \mu_k, \Sigma_k)$$

- 与强制分配不同，GMM为每个点赋予**软分配**——即该点属于各个簇的概率（称为“责任度”）。位于两个高斯分布边界附近的点，可能有60%的概率属于簇A，40%的概率属于簇B。

- GMM是通过**期望最大化（EM）算法**来拟合的，该算法与K-Means类似，也是分两步进行。**E步骤**用于计算责任度：即每个点属于各个高斯分布的概率是多少。**M步骤**则用于更新参数：根据这些责任度，确定最佳的均值、协方差和混合权重。EM算法在每次迭代中都能提升数据匹配度，并最终收敛到局部最大值。

- 实际上，K-Means就是GMM在特定情况下的应用：此时高斯分布为球形，且协方差相等，同时采用硬分配方式（0/1）。

- **支持向量机（SVM）**从几何角度来进行分类。对于两个线性可分的类别，存在无数条能够将它们分开的超平面。SVM会寻找**最大间隔**对应的超平面，也就是超平面与各类别中最接近的数据点之间的最大距离。

- 那些位于间隔边界上的数据点被称为**支持向量**。只有这些点对定义分类边界至关重要；即使去掉其他所有训练点，也能得到相同的超平面。

![由最大间隔超平面分隔的两个类别，以及标注出的间隔带和支撑向量](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/svm_margin.svg)

- 对于线性分类器$f(x) = w \cdot x + b$，寻找最大间隔等价于解决以下问题：

$$\min_{w, b} \; \frac{1}{2}\|w\|^2 \quad \text{subject to} \quad y_i(w \cdot x_i + b) \geq 1 \; \text{for all } i$$

- 这是一个凸二次规划问题，因此存在唯一的全局解（无需担心局部最小值的问题）。

- 现实数据很少能做到完全线性可分。**软间隔SVM**通过引入非负松弛变量$\xi_i$，允许某些点稍微超出间隔范围：

$$\min_{w, b, \xi} \; \frac{1}{2}\|w\|^2 + C \sum_{i=1}^{n} \xi_i \quad \text{subject to} \quad y_i(w \cdot x_i + b) \geq 1 - \xi_i$$

- 参数$C$用于控制平衡：较大的$C$值会对误分类行为施加更严厉的惩罚（模型拟合更紧密，但存在过拟合风险）；较小的$C$值则允许更多的点超出间隔范围（间隔更大，模型更具有泛化能力）。

- SVM最强大的特性就是**核技巧**。许多在原始特征空间中无法线性分离的数据集，在映射到更高维空间后就可以被分离。核技巧使得我们无需显式计算数据变换，就能在该高维空间中计算点积。

- 核函数$K(x_i, x_j) = \phi(x_i) \cdot \phi(x_j)$可以替代SVM优化中的所有点积运算。最常用的核函数是**径向基函数（RBF）核**：

$$K(x_i, x_j) = \exp\!\left(-\gamma \|x_i - x_j\|^2\right)$$

- RBF核实际上是将数据隐式映射到无限维空间中。参数$\gamma$决定了单个训练点的影响范围：较大的$\gamma$意味着每个点只影响其周围的邻近点（容易过拟合）；较小的$\gamma$则能使分类边界更加平滑。

- 其他常见的核函数还包括多项式核$K(x_i, x_j) = (x_i \cdot x_j + c)^d$以及线性核$K(x_i, x_j) = x_i \cdot x_j$（后者实际上就是没有经过任何变换的标准SVM）。

- 在深度学习兴起之前，带有RBF核的SVM一直是主流的分类算法。即使在特征数量远大于样本数量的中小型数据集上，它们依然表现良好。

- SVM与第02章（矩阵）的内容有着密切联系。其优化问题通常以对偶形式来解决，而解法仅依赖于训练样本之间的点积运算，这正是核技巧能够实现的基础。整个算法都是基于内积和线性代数来运行的。

- 总结一下经典机器学习工具箱中的各种算法：

| 算法 | 类型 | 主要优点 | 主要缺点 |
| --- | --- | --- | --- |
| 朴素贝叶斯 | 监督学习（生成模型） | 计算速度快，适用于数据量较少的情况 | 假设特征之间相互独立 |
| 决策树 | 监督学习 | 结果易于理解 | 容易过拟合 |
| 随机森林 | 监督学习（集成模型） | 稳定性强，需要调整的参数较少 | 可解释性较差 |
| 梯度提升 | 监督学习（集成模型） | 在表格数据上表现优异 | 计算速度较慢，需要更多调优 |
| K-Means | 无监督学习（聚类算法） | 实现简单，可扩展性高 | 假设簇为球形 |
| 高斯混合模型 | 无监督学习（聚类算法） | 支持软分配，簇形状灵活 | 对初始参数敏感 |
| 支持向量机 | 监督学习 | 在高维数据中效果良好 | 处理大规模数据时速度较慢 |

## 编程任务（可使用CoLab或笔记本完成）

1. 从零实现高斯朴素贝叶斯算法。使用包含两个类别的二维合成数据对其进行训练，并可视化决策边界。再将结果与scikit-learn中的实现进行比较。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
from sklearn.datasets import make_classification

# Generate synthetic data
X, y = make_classification(n_samples=300, n_features=2, n_redundant=0,
                           n_informative=2, n_clusters_per_class=1, random_state=42)
X, y = jnp.array(X), jnp.array(y)

# Fit Gaussian Naive Bayes from scratch
classes = jnp.unique(y)
params = {}
for c in classes:
    c = int(c)
    mask = y == c
    X_c = X[mask]
    params[c] = {
        'mean': jnp.mean(X_c, axis=0),
        'var': jnp.var(X_c, axis=0),
        'prior': jnp.sum(mask) / len(y)
    }

def gaussian_log_likelihood(x, mean, var):
    return -0.5 * jnp.sum(jnp.log(2 * jnp.pi * var) + (x - mean)**2 / var)

def predict(X):
    preds = []
    for x in X:
        log_posts = []
        for c in [0, 1]:
            log_post = jnp.log(params[c]['prior']) + gaussian_log_likelihood(
                x, params[c]['mean'], params[c]['var'])
            log_posts.append(log_post)
        preds.append(jnp.argmax(jnp.array(log_posts)))
    return jnp.array(preds)

# Decision boundary visualisation
xx, yy = jnp.meshgrid(jnp.linspace(X[:,0].min()-1, X[:,0].max()+1, 200),
                       jnp.linspace(X[:,1].min()-1, X[:,1].max()+1, 200))
grid = jnp.column_stack([xx.ravel(), yy.ravel()])
zz = predict(grid).reshape(xx.shape)

plt.figure(figsize=(8, 6))
plt.contourf(xx, yy, zz, alpha=0.3, cmap='coolwarm')
plt.scatter(X[y==0, 0], X[y==0, 1], c='#3498db', label='Class 0', edgecolors='k', s=20)
plt.scatter(X[y==1, 0], X[y==1, 1], c='#e74c3c', label='Class 1', edgecolors='k', s=20)
plt.title("Gaussian Naive Bayes Decision Boundary")
plt.legend()
plt.grid(alpha=0.3)
plt.show()

accuracy = jnp.mean(predict(X) == y)
print(f"Training accuracy: {accuracy:.2%}")
```

1. 构建一种基于吉尼不纯度进行节点划分的决策树。实现单个节点的划分逻辑，并展示信息增益是如何帮助选择最佳特征和阈值的。

```python
import jax.numpy as jnp

def gini_impurity(y):
    """Gini impurity of a label array."""
    classes, counts = jnp.unique(y, return_counts=True)
    probs = counts / len(y)
    return 1.0 - jnp.sum(probs ** 2)

def information_gain(y, left_mask):
    """IG from splitting y into left/right by boolean mask."""
    parent_gini = gini_impurity(y)
    left_y, right_y = y[left_mask], y[~left_mask]
    n = len(y)
    if len(left_y) == 0 or len(right_y) == 0:
        return 0.0
    child_gini = (len(left_y)/n) * gini_impurity(left_y) + \
                 (len(right_y)/n) * gini_impurity(right_y)
    return float(parent_gini - child_gini)

def best_split(X, y):
    """Find the feature and threshold that maximise information gain."""
    best_ig, best_feat, best_thresh = -1, None, None
    for feat in range(X.shape[1]):
        thresholds = jnp.unique(X[:, feat])
        for thresh in thresholds:
            mask = X[:, feat] <= float(thresh)
            ig = information_gain(y, mask)
            if ig > best_ig:
                best_ig, best_feat, best_thresh = ig, feat, float(thresh)
    return best_feat, best_thresh, best_ig

# Example: synthetic data
from sklearn.datasets import make_classification
X, y = make_classification(n_samples=100, n_features=4, n_redundant=0, random_state=0)
X, y = jnp.array(X), jnp.array(y)

feat, thresh, ig = best_split(X, y)
print(f"Best split: feature {feat}, threshold {thresh:.3f}, info gain {ig:.4f}")
print(f"Parent Gini: {gini_impurity(y):.4f}")
mask = X[:, feat] <= thresh
print(f"Left Gini:   {gini_impurity(y[mask]):.4f} ({int(jnp.sum(mask))} samples)")
print(f"Right Gini:  {gini_impurity(y[~mask]):.4f} ({int(jnp.sum(~mask))} samples)")
```

1. 从零实现K-Means算法，并使用K-Means++算法进行初始聚类。对一个合成数据集进行聚类处理，并在每次迭代后可视化各个聚类结果。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt
from sklearn.datasets import make_blobs

# Generate synthetic clusters
X, y_true = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=42)
X = jnp.array(X)

def kmeans_plus_plus_init(X, K, key):
    """K-Means++ initialisation."""
    n = X.shape[0]
    idx = jax.random.randint(key, (), 0, n)
    centroids = [X[idx]]
    for _ in range(1, K):
        dists = jnp.min(jnp.stack([jnp.sum((X - c)**2, axis=1) for c in centroids]), axis=0)
        probs = dists / jnp.sum(dists)
        key, subkey = jax.random.split(key)
        idx = jax.random.choice(subkey, n, p=probs)
        centroids.append(X[idx])
    return jnp.stack(centroids)

def kmeans(X, K, max_iters=20, key=jax.random.PRNGKey(0)):
    centroids = kmeans_plus_plus_init(X, K, key)
    history = [centroids]
    for _ in range(max_iters):
        # Assign step
        dists = jnp.stack([jnp.sum((X - c)**2, axis=1) for c in centroids])
        labels = jnp.argmin(dists, axis=0)
        # Update step
        new_centroids = jnp.stack([
            jnp.mean(X[labels == k], axis=0) for k in range(K)
        ])
        history.append(new_centroids)
        if jnp.allclose(centroids, new_centroids):
            break
        centroids = new_centroids
    return labels, centroids, history

K = 4
labels, centroids, history = kmeans(X, K)

# Plot final result
colors = ['#3498db', '#e74c3c', '#27ae60', '#9b59b6']
plt.figure(figsize=(8, 6))
for k in range(K):
    mask = labels == k
    plt.scatter(X[mask, 0], X[mask, 1], c=colors[k], s=20, alpha=0.6)
    plt.scatter(centroids[k, 0], centroids[k, 1], c=colors[k], marker='X',
                s=200, edgecolors='k', linewidths=1.5)
plt.title(f"K-Means Clustering (K={K}, {len(history)-1} iterations)")
plt.grid(alpha=0.3)
plt.show()

# Compute inertia
inertia = sum(jnp.sum((X[labels == k] - centroids[k])**2) for k in range(K))
print(f"Final inertia: {inertia:.2f}")
```

1. 演示核技巧。通过将RBF核对应的核矩阵与多项式核对应的显式特征映射进行比较，说明RBF核是如何在高维空间中计算点积的。

```python
import jax.numpy as jnp

# Simple 2D data
X = jnp.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])

# Polynomial kernel: K(x,y) = (x·y + 1)^2
def poly_kernel(X, degree=2, c=1.0):
    return (X @ X.T + c) ** degree

# Explicit degree-2 feature map for 2D: (1, sqrt(2)*x1, sqrt(2)*x2, x1^2, x2^2, sqrt(2)*x1*x2)
def poly_features(X):
    x1, x2 = X[:, 0], X[:, 1]
    return jnp.column_stack([
        jnp.ones(len(X)),
        jnp.sqrt(2) * x1,
        jnp.sqrt(2) * x2,
        x1 ** 2,
        x2 ** 2,
        jnp.sqrt(2) * x1 * x2
    ])

K_trick = poly_kernel(X)
phi = poly_features(X)
K_explicit = phi @ phi.T

print("Kernel trick (polynomial degree 2):")
print(K_trick)
print("\nExplicit feature map dot products:")
print(K_explicit)
print(f"\nMatrices match: {jnp.allclose(K_trick, K_explicit)}")

# RBF kernel: no finite explicit map exists
def rbf_kernel(X, gamma=0.5):
    sq_dists = jnp.sum(X**2, axis=1, keepdims=True) + \
               jnp.sum(X**2, axis=1) - 2 * X @ X.T
    return jnp.exp(-gamma * sq_dists)

K_rbf = rbf_kernel(X)
print("\nRBF kernel matrix:")
print(K_rbf)
print("Diagonal is always 1 (a point is identical to itself)")
print("Off-diagonal entries decay with distance")
```

## 梯度机器学习

_基于梯度的学习方法通过不断沿着损失函数的斜率来优化模型参数。本文件涵盖了线性回归、逻辑回归、softmax分类、各种梯度下降算法、正则化处理（L1/L2）以及偏差-方差权衡问题。_

- 文件01中介绍的经典方法依赖于巧妙的启发式策略或封闭形式的解法。而本文件则介绍那些通过跟随梯度来学习的算法——这些算法会在损失函数上逐步向下移动，直到找到合适的参数。从线性回归到最复杂的神经网络，所有这类模型都依赖于梯度学习机制。

- **线性回归**是最简单的基于梯度的模型，而且它还存在封闭形式的解法，因此非常适合作为入门模型。该模型的形式为一条直线（在更高维度中则为一个超平面）：

$$\hat{y} = w \cdot x + b = \sum_{i=1}^{d} w_i x_i + b$$

- 用矩阵表示的话（如第02章所述），如果将所有训练数据作为矩阵$X$的行，再将偏置项纳入$w$中，即通过添加一列全1的向量，那么公式可写为$\hat{y} = Xw$。

- 我们的目标是最小化**均方误差（MSE）**，也就是预测值与实际值之间的平均平方差：

$$\mathcal{L}(w) = \frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2 = \frac{1}{n} \|y - Xw\|^2$$

- 为什么要使用平方误差呢？这背后有概率学上的原因：假设目标值是由$y = Xw + \epsilon$生成的，其中$\epsilon \sim \mathcal{N}(0, \sigma^2)$，那么最大化数据的高斯似然函数（见第05章）就等同于最小化均方误差。此外，平方误差还会对较大的错误给予更重的惩罚，而这通常是人们所希望的。

![数据点的散点图，上面有一条最佳拟合线，还有虚线表示误差](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/linear_regression_fit.svg)

- 由于均方误差是$w$的二次函数，因此它存在唯一的全局最小值，我们可以通过解析方法找到它。通过对函数求导并令其等于零，就可以得到**正规方程**：

$$w^{*} = (X^T X)^{-1} X^T y$$

- 这里直接运用了第02章中介绍的矩阵求逆方法。$X^T X$是一个$d \times d$矩阵（$d$为特征数量），而$X^T y$则是一个$d$维向量。正规方程能够一次性给出最优权重。

- 那么，什么时候正规方程会失效呢？当$X^T X$不可逆时，即当特征之间存在线性相关性，或者特征数量大于样本数量时（$d > n$）。在这种情况下，就需要采用正则化方法（后面会介绍）或梯度下降法。

- **逻辑回归**则是将线性模型用于二元分类任务。我们不再需要预测连续数值，而是希望得到一个介于0和1之间的概率值。**Sigmoid函数**可以将任意实数映射到这个范围内：

$$\sigma(z) = \frac{1}{1 + e^{-z}}$$

- 该模型首先计算$z = w \cdot x + b$（这是一个线性得分，与线性回归类似），然后再将其输入Sigmoid函数：$\hat{y} = \sigma(w \cdot x + b)$。输出值$\hat{y}$可以被理解为$P(y = 1 \mid x)$。

![标有0.5阈值的Sigmoid曲线，用于划分预测为0和预测为1的区域](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/sigmoid_logistic.svg)

- Sigmoid函数具有一些很好的性质：$\sigma(0) = 0.5$，当$z \to \infty$时$\sigma(z) \to 1$，而当$z \to -\infty$时$\sigma(z) \to 0$。此外，它的导数具有简洁的形式：$\sigma'(z) = \sigma(z)(1 - \sigma(z))$。

- 逻辑回归的损失函数是**二元交叉熵（BCE）**，它直接来源于伯努利似然函数（见第05章）：

$$\mathcal{L} = -\frac{1}{n} \sum_{i=1}^{n} \left[ y_i \log(\hat{y}_i) + (1 - y_i) \log(1 - \hat{y}_i) \right]$$

- 当真实标签为1时，只有第一项起作用，它会惩罚那些预测值过低的情形；而当真实标签为0时，只有第二项起作用，此时会惩罚预测值过高的情况。对数函数使得对于那些过于确定的错误预测，其惩罚力度非常大：当真实标签为1时却预测出0.01，其惩罚程度远远高于预测出0.4的情况。

- 与线性回归中的均方误差不同，对于最小化BCE的损失函数，并不存在封闭形式的解法。因此我们需要采用迭代方法——即**梯度下降法**。

- 梯度下降法的原理很简单：想象你站在一片被雾气笼罩的丘陵地带（即损失函数表面）。你看不见全局最小值，但可以感觉到脚下的坡度。你向前迈一步，再次感知坡度，然后重复这个过程。最终你会到达一个山谷。

$$w \leftarrow w - \eta \frac{\partial \mathcal{L}}{\partial w}$$

- 学习率$\eta$决定了每一步的步长。如果学习率过大，就会越过山谷，无法收敛；如果学习率过小，则进步极其缓慢，甚至可能陷入局部最小值。

![1D损失曲线，图中有三个球体：学习率过大时会超出范围，合适的学习率则能实现收敛，学习率过小则会陷入局部最小值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/gradient_descent_landscape.svg)

- 梯度$\frac{\partial \mathcal{L}}{\partial w}$是一个指向上升最陡方向的向量。因为我们想要往下降，所以要减去这个梯度。这实际上就是第03章中介绍的链式法则在损失函数中的应用。

- **批量梯度下降法**在每一步都会使用整个训练集来计算梯度。虽然这样能得到精确的梯度，但当样本数量$n$很大时，计算成本会非常高。

- **随机梯度下降法（SGD）**则是在每一步只使用一个随机样本。虽然这样得到的梯度带有噪声（因为它只是根据一个样本来估计真实梯度），但每一步的运算速度都非常快。此外，这种噪声还有助于帮助模型摆脱浅层的局部最小值。

- **小批量梯度下降法**则折中了两者之间的优点：在每一步中使用$B$个样本（通常为32、64或256个）。这种方法既提升了计算效率（可以对批量数据进行向量化操作），又保证了梯度的质量。几乎所有的深度学习模型都采用小批量梯度下降法。
- **反向传播**是我们在具有众多参数的模型中计算梯度的方法，比如神经网络。它实际上就是第03章中介绍的链式法则，通过计算图被系统地应用起来。

- 任何模型都可以表示为一个由操作构成的有向无环图：输入数据进入该图后，会与权重相乘、再求和，随后经过非线性函数处理，最终得到损失值。**前向传播**则是让数据沿着这个图从输入端流向输出端，从而计算出输出值及损失值。

- **反向传播**则是以相反的方向传递梯度。从损失值开始，利用链式法则在每个节点上计算损失值随各中间值的变化情况。如果$L$取决于$z$，而$z$又取决于$w$，那么：

$$\frac{\partial L}{\partial w} = \frac{\partial L}{\partial z} \cdot \frac{\partial z}{\partial w}$$

- 每个节点只需知道自身的局部导数以及从上方传来的梯度即可。这使得反向传播具有模块化特性且效率较高：其计算成本大约是前向传播的两倍（一次前向传播，一次反向传播）。

- 基本的随机梯度下降法存在一个问题：在曲率较大的方向上它会不断振荡，而在平坦方向上的进展则很缓慢。**优化器**通过根据梯度历史来调整步长，从而改善了这一状况。

- **带动量的随机梯度下降法**会保持过去梯度的滑动平均值（即第04章中提到的指数移动平均）。这样可以减少振荡，并加快在稳定方向上的进展：

$$v_t = \beta v_{t-1} + (1 - \beta) \nabla \mathcal{L}$$
$$w \leftarrow w - \eta \, v_t$$

- 可以把其想象成一个滚下山坡的球：动量让它能够在同一方向上持续加速，同时减少横向的抖动。通常的动量系数值为$\beta = 0.9$。

- **Nesterov加速梯度法**是一种简单但巧妙的改进方法：它不在当前位置计算梯度，而是在“预看位置”$w - \eta \beta v_{t-1}$处计算梯度。这样的修正步骤可以减少超调现象：

$$v_t = \beta \, v_{t-1} + \nabla \mathcal{L}(w - \eta \beta \, v_{t-1})$$
$$w \leftarrow w - \eta \, v_t$$

- **Adagrad**会为每个参数单独调整学习率。那些获得较大梯度的参数会使用较小的学习率，反之亦然。它还会累积梯度的平方值：

$$G_t = G_{t-1} + g_t^2, \quad w \leftarrow w - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

- 问题在于：$G_t$只会不断增大，因此有效学习率会持续下降，最终变得太小而无法继续学习。

- **RMSprop**通过使用梯度平方的指数移动平均而非简单求和来解决这个问题，这样最近计算的梯度会比旧梯度更重要：

$$s_t = \beta \, s_{t-1} + (1 - \beta) g_t^2, \quad w \leftarrow w - \frac{\eta}{\sqrt{s_t + \epsilon}} g_t$$

- **Adam**（自适应动量估计）结合了动量法和RMSprop的优点。它既保留了动量法中的第一矩估计（即梯度的均值），也采用了RMSprop中的第二矩估计（即梯度平方的均值）：

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2$$

- 由于$m_t$和$v_t$初始值均为零，因此在训练初期它们会偏向于零值。偏置校正可以解决这个问题：

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

$$w \leftarrow w - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

![2D轮廓图显示：随机梯度下降法呈之字形路径，动量法路径更为平滑，而Adam法则能以最直接的路径到达最小值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/optimizer_trajectories.svg)

- 默认的超参数（$\beta_1 = 0.9$，$\beta_2 = 0.999$，$\epsilon = 10^{-8}$）在多种问题上都能表现出良好效果，这也是为什么Adam成为大多数深度学习任务中的默认优化器。

- **AdamW**将权重衰减与梯度更新分开处理。对于随机梯度下降法来说，标准的L2正则化和权重衰减是等价的，但对于Adam则不然。AdamW直接对参数应用权重衰减，而不是在梯度上加上$\lambda w$项。这种方式能提升模型的泛化能力，目前已成为Transformer模型训练中的标准方法：

$$w \leftarrow w - \eta \left( \frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon} + \lambda \, w \right)$$

- **LION**（进化型符号动量）是一种通过程序搜索发现的新型优化器。它只利用动量更新的符号值（而非其大小），因此每次更新的幅度都是相同的。LION所需的内存比Adam更少（不需要存储第二矩信息），并且在许多任务上的表现可与Adam相媲美甚至更优：

$$w \leftarrow w - \eta \cdot \text{sign}(\beta_1 \, m_{t-1} + (1 - \beta_1) \, g_t)$$
$$m_t = \beta_2 \, m_{t-1} + (1 - \beta_2) \, g_t$$

- **Muon**（动量+正交化）首先应用Nesterov动量，然后通过牛顿-舒尔茨迭代对更新矩阵进行正交化处理，这种迭代方式可近似实现极分解。这样一来，每次更新的向量都位于Stiefel流形上，所有方向的更新幅度大致相同，从而避免了某个方向占据主导地位的情况。这种方法无需像Adam那样进行自适应的第二矩估计，因此能减少内存占用。Muon在Transformer模型训练中取得了优异的效果，其收敛速度往往与AdamW相当，尤其是在处理注意力机制和MLP权重矩阵时。嵌入层和输出层通常仍由AdamW来处理。

$$G_t = \text{NesterovMomentum}(\nabla \mathcal{L})$$
$$U_t = \text{NewtonSchulz}(G_t) \approx G_t (G_t^T G_t)^{-1/2}$$
$$W \leftarrow W - \eta \, U_t$$

- 牛顿-舒尔茨迭代通过重复执行$X_{k+1} = \frac{1}{2} X_k (3I - X_k^T X_k)$若干次（通常为5-10次），来计算正交因子。这样既避免了完整SVD计算的高成本，又能得到不错的近似结果。

![Muon正交化过程：动量更新会导致奇异值出现偏差，牛顿-舒尔茨迭代则使这些奇异值趋于一致，从而使所有方向的更新幅度相同](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/optimizer_muon.svg)
![优化器内存对比：各优化器为每个参数存储的内容](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/optimizer_memory.svg)

- 除了MSE和BCE之外，还有多种其他常用的**损失函数**。

- **平均绝对误差（MAE）**，或称L1损失，是通过计算绝对差值的平均值来得到的：$\frac{1}{n}\sum|y_i - \hat{y}_i|$。与MSE相比，它对异常值更具鲁棒性，因为不会对较大的误差进行平方处理。

- **Huber损失**结合了两种方法的优点：对于较小的误差，它的表现类似于MSE（平滑且易于优化）；而对于较大的误差，则表现为MAE的风格（对异常值有较强的抵抗力）。该损失函数有一个阈值$\delta$，用于控制这种转换的发生。

- **分类交叉熵（CCE）**是将BCE扩展到多类别场景下的形式。如果$\hat{y}_k$是类别$k$的预测概率，而真实类别为$c$，则：

$$\mathcal{L} = -\log(\hat{y}_c)$$

- 这实际上就是正确类别的负对数概率。最小化交叉熵等同于最大化似然值，这一概念与第05章中的信息论相关——交叉熵衡量的是使用预测分布而非真实分布时需要额外多少比特信息。

- **Hinge损失**被SVM所使用：$\mathcal{L} = \max(0, 1 - y \cdot f(x))$。它只会对那些位于决策边界错误一侧或处于边界内的预测结果施加惩罚。一旦某个样本被以足够高的置信度正确分类，其对应的损失值即为零。

- **正则化**通过为复杂的模型添加惩罚项来防止过拟合。经过正则化后的损失函数为：

$$\mathcal{L}_{\text{reg}} = \mathcal{L}_{\text{data}} + \lambda \, R(w)$$

- **L2正则化**（岭回归、权重衰减）会对权重平方的和进行惩罚：$R(w) = \|w\|^2 = \sum w_i^2$。这种方式可以避免某个权重变得过大，从而让所有权重都向零靠拢，不过很少会让它们完全变为零。

- **L1正则化**（Lasso）则会对权重的绝对值之和进行惩罚：$R(w) = \|w\|_1 = \sum |w_i|$。它有助于实现特征的稀疏性，使得许多权重变为零，进而实现自动特征选择功能。

- **弹性网**则结合了这两种正则化方式：$R(w) = \alpha \|w\|_1 + (1 - \alpha) \|w\|^2$，从而在特征稀疏性和权重缩小之间取得平衡。

- 从第05章的内容来看，L2正则化可以被理解为在权重上施加高斯先验，然后求出最大后验估计值；而L1正则化则对应于拉普拉斯先验。正则化强度$\lambda$决定了你在多大程度上信任先验信息而非数据本身。

- **评估指标**可用于判断模型是否真正有效。在回归任务中，MSE和MAE是常用的评估指标；而在分类任务中，评估方式则更为复杂。

- 对于二分类问题，**混淆矩阵**是一个包含四组统计数据的表格：
- 真正例（TP）：预测为正类，实际也为正类
- 错误正例（FP）：预测为正类，实际为负类
- 真负例（TN）：预测为负类，实际也为负类
- 错误负例（FN）：预测为负类，实际为正类

- **准确率** = $\frac{TP + TN}{TP + TN + FP + FN}$。当类别分布不均衡时，这一指标可能会产生误导。例如，如果99%的邮件都不是垃圾邮件，那么一个总是预测“非垃圾邮件”的模型虽然准确率为99%，但实际上毫无用处。

- **精确率** = $\frac{TP}{TP + FP}$，它回答的是：在所有被预测为正类的样本中，实际为正类的有多少？较高的精确率意味着误报较少。

- **召回率**（灵敏度）= $\frac{TP}{TP + FN}$，它回答的是：在所有实际为正类的样本中，模型能识别出来的有多少？较高的召回率意味着漏检的情况较少。

- **F1分数** = $\frac{2 \cdot \text{精确率} \cdot \text{召回率}}{\text{精确率} + \text{召回率}}$，它是精确率和召回率的调和平均值，能够同时兼顾两者。

- **ROC曲线**通过绘制在不同分类阈值下，真正例率（召回率）与错误正例率（$\frac{FP}{FP + TN}$）的关系图，来展示模型的性能。完美的分类器会位于曲线的左上角。**AUC**（ROC曲线下面积）则可以用一个数值来概括模型的整体性能：1.0表示完美性能，0.5则表示随机猜测水平。

- **交叉验证**能够提供更可靠的模型泛化能力评估结果。在$k$折交叉验证中，数据会被分成$k$份，用其中的$k-1$份进行训练，剩余的一份用于测试，之后再重复这个过程。所有$k$次测试结果的平均值即为模型的泛化性能估计值。这种方法允许在训练和测试过程中使用全部数据，只是不会同时使用，因此在数据量较少的情况下尤为有用。

- **偏差-方差权衡**（来自第04章）是机器学习中的核心问题。模型的预期误差可以分解为：

$$\text{误差} = \text{偏差}^2 + \text{方差} + \text{不可减少的噪声}$$

- **偏差**是由于错误假设而产生的系统性误差（例如，试图用直线来拟合曲线形数据）。**方差**则是指模型对训练数据波动的敏感程度（例如，用20次方的多项式来拟合噪声数据）。简单模型的偏差较大但方差较小；而复杂模型的偏差较小但方差较大。理想的模型应能使总误差降至最低。

- **学习率调度**指的是在训练过程中调整参数$\eta$的值。常见的策略包括：
- 逐步衰减：每经过$N$个训练周期，将$\eta$乘以一个系数（如0.1）
- 余弦退火：让$\eta$按照余弦曲线从初始值逐渐下降到接近零的值
- 预热阶段：首先使用非常小的$\eta$值，然后在最初的几千步内逐步增加该值，之后再让其衰减。这样做可以避免初始时较大的梯度值破坏训练过程的稳定性
- 单周期策略：先按照余弦曲线上升，然后再下降，这种方式有助于更快地使模型收敛
- **超参数调优**是指为学习率、批量大小、正则化强度等那些无法通过梯度下降法自动确定的参数寻找最优值的流程。常见的方法包括：
- 网格搜索：在预定义的网格中尝试所有组合（虽然全面但效率较低）；
- 随机搜索：随机选取组合，由于并非所有超参数都同等重要，因此这种方法通常更高效；
- 贝叶斯优化：构建目标函数的模型，智能地选择下一步要测试的超参数；
- **ASHA**（异步逐次减半算法）：同时进行大量低成本的试验，然后将最有潜力的试验升级为更高成本的试验，而提前终止其他试验。该方法结合了提前停止机制与大规模并行处理的优势——无需进行100次完整的训练，只需以低成本启动所有试验，每轮保留表现最好的25%的试验，最终只让少数试验完成训练。这也是现代大规模调优框架如Ray Tune的底层原理。

- **无调度学习**则完全不需要学习率调度机制。它不会按照固定曲线让学习率逐渐减小，而是维护两个序列：一个表示迭代值$z_t$的缓慢变化平均值（该值会逐渐趋近于最优解），另一个则表示用于计算梯度的快速探索性迭代值$y_t$。最终的结果就是这两个序列的平均值，经验证，其收敛速度与最佳调度方案下的收敛速度相当。这样一来，调度参数就不再需要被单独设置——只需设定基础学习率，其余工作由优化器处理即可。研究表明，SGD和Adam的无调度版本在性能上能够与经过调度优化的版本相媲美，甚至更优。

## 编程任务（可使用CoLab或笔记本）

1. 使用正规方程法和梯度下降法实现线性回归。比较两种方法的求解结果，并绘制梯度下降法下损失值随迭代次数的变化曲线。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Generate synthetic data: y = 3x + 2 + noise
key = jax.random.PRNGKey(42)
n = 100
X = jax.random.uniform(key, (n, 1), minval=0, maxval=10)
y = 3 * X[:, 0] + 2 + jax.random.normal(key, (n,)) * 1.5

# Add bias column
X_b = jnp.column_stack([X, jnp.ones(n)])

# Normal equation
w_exact = jnp.linalg.solve(X_b.T @ X_b, X_b.T @ y)
print(f"Normal equation: w={w_exact[0]:.4f}, b={w_exact[1]:.4f}")

# Gradient descent
w_gd = jnp.zeros(2)
lr = 0.005
losses = []
for step in range(500):
    pred = X_b @ w_gd
    error = pred - y
    loss = jnp.mean(error ** 2)
    losses.append(float(loss))
    grad = (2 / n) * X_b.T @ error
    w_gd = w_gd - lr * grad

print(f"Gradient descent: w={w_gd[0]:.4f}, b={w_gd[1]:.4f}")

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].scatter(X[:, 0], y, s=15, alpha=0.5, color='#3498db')
axes[0].plot([0, 10], [w_exact[1], w_exact[0]*10 + w_exact[1]], color='#e74c3c', linewidth=2)
axes[0].set_title("Linear Regression Fit")
axes[0].set_xlabel("x"); axes[0].set_ylabel("y")

axes[1].plot(losses, color='#27ae60', linewidth=1.5)
axes[1].set_title("GD Loss Convergence")
axes[1].set_xlabel("Step"); axes[1].set_ylabel("MSE")
axes[1].set_yscale('log')
plt.tight_layout()
plt.show()
```

1. 使用梯度下降法从零实现逻辑回归。在二维数据集上进行训练，并可视化所学到的决策边界。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons

# Generate data
X, y = make_moons(n_samples=300, noise=0.2, random_state=42)
X, y = jnp.array(X), jnp.array(y, dtype=jnp.float32)

def sigmoid(z):
    return 1 / (1 + jnp.exp(-z))

# Add bias column
X_b = jnp.column_stack([X, jnp.ones(len(X))])
w = jnp.zeros(3)
lr = 0.5
losses = []

for step in range(2000):
    z = X_b @ w
    pred = sigmoid(z)
    # BCE loss
    loss = -jnp.mean(y * jnp.log(pred + 1e-8) + (1 - y) * jnp.log(1 - pred + 1e-8))
    losses.append(float(loss))
    # Gradient
    grad = X_b.T @ (pred - y) / len(y)
    w = w - lr * grad

# Decision boundary
xx, yy = jnp.meshgrid(jnp.linspace(-2, 3, 200), jnp.linspace(-1.5, 2, 200))
grid = jnp.column_stack([xx.ravel(), yy.ravel(), jnp.ones(xx.size)])
zz = sigmoid(grid @ w).reshape(xx.shape)

plt.figure(figsize=(8, 6))
plt.contourf(xx, yy, zz, levels=[0, 0.5, 1], alpha=0.3, colors=['#e74c3c', '#3498db'])
plt.contour(xx, yy, zz, levels=[0.5], colors='#9b59b6', linewidths=2)
plt.scatter(X[y==0, 0], X[y==0, 1], c='#e74c3c', s=15, label='Class 0')
plt.scatter(X[y==1, 0], X[y==1, 1], c='#3498db', s=15, label='Class 1')
plt.title("Logistic Regression Decision Boundary")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
```

1. 在二维二次曲面上比较优化器的轨迹。从同一起始点运行SGD、SGD+动量算法以及Adam算法，并绘制出它们的路径。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Elongated quadratic: L(w1, w2) = 0.5*w1^2 + 10*w2^2
def loss_fn(w):
    return 0.5 * w[0]**2 + 10 * w[1]**2

grad_fn = jax.grad(loss_fn)

def run_sgd(w0, lr=0.05, steps=80):
    w = w0.copy()
    path = [w.copy()]
    for _ in range(steps):
        g = grad_fn(w)
        w = w - lr * g
        path.append(w.copy())
    return jnp.stack(path)

def run_momentum(w0, lr=0.05, beta=0.9, steps=80):
    w, v = w0.copy(), jnp.zeros(2)
    path = [w.copy()]
    for _ in range(steps):
        g = grad_fn(w)
        v = beta * v + (1 - beta) * g
        w = w - lr * v
        path.append(w.copy())
    return jnp.stack(path)

def run_adam(w0, lr=0.05, b1=0.9, b2=0.999, eps=1e-8, steps=80):
    w, m, v = w0.copy(), jnp.zeros(2), jnp.zeros(2)
    path = [w.copy()]
    for t in range(1, steps + 1):
        g = grad_fn(w)
        m = b1 * m + (1 - b1) * g
        v = b2 * v + (1 - b2) * g**2
        m_hat = m / (1 - b1**t)
        v_hat = v / (1 - b2**t)
        w = w - lr * m_hat / (jnp.sqrt(v_hat) + eps)
        path.append(w.copy())
    return jnp.stack(path)

w0 = jnp.array([8.0, 3.0])
sgd_path = run_sgd(w0)
mom_path = run_momentum(w0)
adam_path = run_adam(w0)

# Plot
fig, ax = plt.subplots(figsize=(8, 6))
w1 = jnp.linspace(-10, 10, 100)
w2 = jnp.linspace(-4, 4, 100)
W1, W2 = jnp.meshgrid(w1, w2)
L = 0.5 * W1**2 + 10 * W2**2
ax.contour(W1, W2, L, levels=20, cmap='Greys', alpha=0.4)
ax.plot(sgd_path[:,0], sgd_path[:,1], 'o-', color='#3498db', markersize=2, linewidth=1, label='SGD')
ax.plot(mom_path[:,0], mom_path[:,1], 'o-', color='#27ae60', markersize=2, linewidth=1, label='Momentum')
ax.plot(adam_path[:,0], adam_path[:,1], 'o-', color='#e74c3c', markersize=2, linewidth=1, label='Adam')
ax.plot(0, 0, 'k*', markersize=15, label='Minimum')
ax.set_xlabel('w₁'); ax.set_ylabel('w₂')
ax.set_title("Optimizer Trajectories on Elongated Quadratic")
ax.legend()
plt.grid(alpha=0.3)
plt.show()
```

1. 展示L1正则化与L2正则化对权重稀疏性的影响。使用这两种正则化方式分别训练线性回归模型，并比较得到的权重向量。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Synthetic data: only first 3 of 20 features are relevant
key = jax.random.PRNGKey(0)
n, d = 200, 20
w_true = jnp.zeros(d).at[:3].set(jnp.array([3.0, -2.0, 1.5]))
X = jax.random.normal(key, (n, d))
y = X @ w_true + 0.5 * jax.random.normal(key, (n,))

def train_ridge(X, y, lam=1.0, lr=0.01, steps=2000):
    """L2 regularised linear regression via GD."""
    w = jnp.zeros(X.shape[1])
    for _ in range(steps):
        pred = X @ w
        grad = (2/len(y)) * X.T @ (pred - y) + 2 * lam * w
        w = w - lr * grad
    return w

def train_lasso(X, y, lam=1.0, lr=0.01, steps=2000):
    """L1 regularised linear regression via proximal GD."""
    w = jnp.zeros(X.shape[1])
    for _ in range(steps):
        pred = X @ w
        grad = (2/len(y)) * X.T @ (pred - y)
        w = w - lr * grad
        # Soft thresholding (proximal operator for L1)
        w = jnp.sign(w) * jnp.maximum(jnp.abs(w) - lr * lam, 0)
    return w

w_l2 = train_ridge(X, y, lam=0.1)
w_l1 = train_lasso(X, y, lam=0.1)

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
axes[0].bar(range(d), w_true, color='#333', alpha=0.7)
axes[0].set_title("True Weights"); axes[0].set_xlabel("Feature")
axes[1].bar(range(d), w_l2, color='#3498db', alpha=0.7)
axes[1].set_title("L2 (Ridge): shrinks all"); axes[1].set_xlabel("Feature")
axes[2].bar(range(d), w_l1, color='#e74c3c', alpha=0.7)
axes[2].set_title("L1 (Lasso): zeros out irrelevant"); axes[2].set_xlabel("Feature")
plt.tight_layout()
plt.show()

print(f"L2 non-zero weights: {int(jnp.sum(jnp.abs(w_l2) > 0.01))}/{d}")
print(f"L1 non-zero weights: {int(jnp.sum(jnp.abs(w_l1) > 0.01))}/{d}")
```

## 深度学习

深度学习通过堆叠非线性层来构建分层表示，从而自动将原始输入转化为有用的特征。本文涵盖了多层感知机、激活函数、反向传播、卷积神经网络、循环神经网络、长短期记忆网络、注意力机制、Transformer、生成对抗网络、变分自编码器、扩散模型以及归一化技术。

- 什么使一个网络成为“深度”网络？浅层网络只有一个隐藏层；深度网络则拥有多个隐藏层。深度使得网络能够构建分层表示：早期层学习简单的特征（如边缘、色调），后续层则将这些特征组合成复杂的概念（如人脸、句子）。这种组合性正是深度学习的强大之处。

- 最简单的深度网络是**多层感知机（MLP）**，也称为全连接网络或密集网络。每一层的计算方式为：

$$h = \sigma(Wx + b)$$

其中，$W$ 是权重矩阵（见第02章），$b$ 是偏置向量，$\sigma$ 是非线性激活函数。一层的输出会成为下一层的输入。如果没有非线性激活函数，堆叠层就毫无意义：$W_2(W_1 x) = (W_2 W_1)x$，这只不过是一种线性变换而已。这正是第02章中讨论的矩阵乘法简化现象。

- **激活函数**引入了使深度具有意义的非线性特性。

- **ReLU**（修正线性单元）：$\text{ReLU}(x) = \max(0, x)$。它是最常用的激活函数。其计算速度快，对正输入不会饱和，且能产生稀疏激活（许多神经元的输出为零）。缺点是：输入为负值的神经元始终输出零；一旦它们永久停留在该状态，就会“死亡”并停止学习。

- **Sigmoid**：$\sigma(x) = \frac{1}{1+e^{-x}}$，将输入压缩到$(0, 1)$区间。它适用于二分类问题的输出层，但在隐藏层中存在问题：当输入远离零时梯度会消失（曲线几乎呈水平状）。

- **Tanh**：$\tanh(x) = \frac{e^x - e^{-x}}{e^x + e^{-x}}$，将输入压缩到$(-1, 1)$区间。与Sigmoid不同，它以零为中心，有助于梯度的传播，但在极端值处仍会出现梯度消失现象。

- **GELU**（高斯误差线性单元）：$\text{GELU}(x) = x \cdot \Phi(x)$，其中$\Phi$是标准正态分布的累积分布函数。它是ReLU的平滑近似，允许较小的负值通过。GELU是GPT和BERT中的默认激活函数。

- **Swish**：$\text{Swish}(x) = x \cdot \sigma(x)$，也是一种平滑的激活函数。在实际应用中与GELU类似。

![ReLU、Sigmoid、Tanh和GELU的对比图及其关键特性](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/activation_functions.svg)

- 一个具有$d_{\text{in}}$个输入和$d_{\text{out}}$个输出的密集层，共有$d_{\text{in}} \times d_{\text{out}} + d_{\text{out}}$个参数（权重加偏置）。矩阵乘法$Wx$就是第02章中介绍的矩阵-向量乘法。在批量处理中，输入是一个形状为$(B, d_{\text{in}})$的矩阵$X$，输出则是形状为$(B, d_{\text{out}})$的$XW^T + b$。

- **通用近似定理**指出：只要隐藏层中的神经元数量足够多，单个隐藏层就能以任意精度逼近定义在紧凑域上的任何连续函数。这听起来似乎深度并不重要，但关键在于“足够多的神经元”。实际上，深度网络可以用比浅层网络少得多的参数来表示相同的函数。深度带来的不仅是表达能力的提升，还有效率的提高。

- 随着网络深度的增加，会出现两种梯度问题。**梯度消失**：当梯度通过多层传递时（依据链式法则，见第03章），它们会被多个因子相乘。如果这些因子始终小于1（如Sigmoid和Tanh在饱和状态下的情况），梯度就会呈指数级趋近于零，导致早期层几乎无法学习。**梯度爆炸**：如果这些因子始终大于1，梯度就会呈指数级增长，从而引发数值溢出和训练不稳定。

- 解决梯度消失/爆炸的方法：
- 使用ReLU或GELU激活函数（对正输入梯度为1，不会饱和）
- 谨慎地初始化权重
- 使用归一化层
- 采用残差连接（跳跃连接）
- 梯度裁剪（针对梯度爆炸）：将梯度范数限制在一个最大值以内

- **权重初始化**至关重要，因为它决定了训练开始时激活值和梯度的规模。如果权重过大，激活值会爆炸；过小则会导致激活值消失。

- **Xavier（Glorot）初始化**从方差为$\frac{2}{d_{\text{in}} + d_{\text{out}}}$的分布中选取权重。在假设使用线性或Tanh激活函数的情况下，这种方法能保持各层激活值的方差大致一致。

- **He（Kaiming）初始化**使用的方差为$\frac{2}{d_{\text{in}}}$，这是针对ReLU激活函数调整的（由于ReLU会使一半的激活值为零，因此需要双倍方差来补偿）。

- **归一化层**通过确保每层输入具有一致的统计特性（均值接近零、方差为单位值）来稳定训练过程。

- **批量归一化（BatchNorm）**在批次维度上进行归一化：对每个通道/特征，计算小批量中所有样本的均值和方差，然后进行归一化处理。它还加入了可学习的缩放参数（$\gamma$）和平移参数（$\beta$），以便网络在必要时撤销归一化：

$$\hat{x} = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y = \gamma \hat{x} + \beta$$

BatchNorm存在一个问题：它依赖于批次大小。当批次很小时，统计信息会变得不稳定。在推理阶段，会使用运行平均值而非批次统计信息，这会导致训练与测试之间的差异。

- **层归一化（LayerNorm）**针对每个样本在特征维度上进行归一化。它不依赖于批次中的其他样本，因此成为Transformer和循环神经网络的标准选择。
- **实例归一化**针对每个样本和每个通道在空间维度上进行归一化处理。它在风格迁移中应用广泛。

- **组归一化**将通道分组，并在每组内进行归一化。它是层归一化和实例归一化之间的折中方案。

![展示BatchNorm、LayerNorm和InstanceNorm各自归一化维度的3D张量图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/normalization_types.svg)

- **Dropout**是一种正则化技术，在训练期间随机将一部分神经元的值置为零，比例记为$p$。这迫使网络不依赖任何单个神经元，从而鼓励网络学习冗余的表示方式。在测试时，所有神经元均处于激活状态。**倒置Dropout**在训练期间将激活值乘以$\frac{1}{1-p}$，这样测试时就无需再进行缩放处理。这是标准的实现方式。

- **卷积神经网络（CNN）**利用数据的空间结构。与全连接层不同，卷积层会用一个小型滤波器在输入数据上滑动，并在每个位置计算点积。同一组滤波器权重在所有位置上共享，这不仅大幅减少了参数数量，还赋予了模型平移不变性。

- 对于大小为$k \times k$的滤波器$K$，二维输入的**卷积运算**如下：

$$(\text{input} * K)[i,j] = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} \text{input}[i+m, j+n] \cdot K[m, n]$$

![显示3x3滤波器在输入网格上滑动，并在每个位置生成输出特征图的示意图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/cnn_convolution.svg)

- 输出大小取决于三个超参数。**步长**控制滤波器在两个位置之间移动的像素数（步长为2时，空间维度会减半）。**填充**是在输入边界周围添加零值：“相同”填充可保持空间尺寸不变，“有效”填充则不会。输出大小公式为：$\text{out} = \lfloor (\text{in} - k + 2p) / s \rfloor + 1$。

- **池化层**用于对特征图进行下采样。最大池化取每个窗口中的最大值；平均池化则取平均值。池化操作在降低空间维度的同时保留了最重要的信息。

- **空洞卷积**在滤波器元素之间插入间隙，从而在不增加参数数量的情况下扩大感受野。当空洞率为2时，3x3的滤波器实际上能覆盖5x5的区域。

- **1x1卷积**是指使用1x1大小滤波器的卷积操作。它并不关注空间上的邻近像素，而是混合不同通道间的信息。可以将其理解为在每个空间位置应用一个全连接层。1x1卷积常用于低成本地改变通道数。

- **跳跃连接**（残差连接）允许输入直接跳过一个或多个层：$\text{输出} = F(x) + x$。此时，网络只需学习残差项$F(x) = \text{输出} - x$，当最优变换接近恒等变换时，这种学习方式更为容易。ResNet（残差网络）利用这一技巧堆叠了超过100层，成功解决了深层网络性能反而低于浅层网络的问题。

- CNN构建了**特征层次结构**。早期层用于检测边缘和纹理；中间层将这些特征组合成部件（如眼睛、车轮）；后期层则用于识别整个物体。随着网络深度的增加，每一层的感受野（即它能“看到”的输入区域）也会逐渐扩大。

- **词嵌入**将离散的令牌（单词、字符、物品ID）映射为稠密向量。词嵌入层本质上就是一个查找表：一个形状为（词汇表大小，嵌入维度）的矩阵$E$。查找令牌$i$就是选取$E$的第$i$行。这相当于与一个独热向量相乘，属于矩阵-向量乘法的特例（参见第02章）。词嵌入在训练过程中被学习，因此语义相似的令牌会得到相似的向量。

- **分词**是将原始文本转换为令牌序列的过程。基于单词的分词方式以空格为分隔符，但无法处理未见过的单词。**子词分词**（如BPE、WordPiece、SentencePiece）将文本拆分为常见的子词单元，从而在词汇表大小和覆盖范围之间取得平衡。例如，单词“unhappiness”可能被拆分为`["un", "happiness"]`或`["un", "happ", "iness"]`。

- **循环神经网络（RNN）**逐个处理序列中的元素，并维持一个携带信息的隐藏状态：

$$h_t = \tanh(W_h h_{t-1} + W_x x_t + b)$$

- 隐藏状态$h_t$是对网络到时间$t$为止所见到内容的压缩摘要。与CNN共享空间权重类似，RNN在所有时间步中共享相同的权重$W_h$和$W_x$。

- 普通RNN在处理长序列时存在梯度消失问题：从时间步$t$传到$t-k$的梯度信号要经过$k$次$W_h$的乘法，从而导致梯度呈指数级缩小（或爆炸）。

- **LSTM**（长短期记忆网络）通过引入一个独立的状态$c_t$来解决这一问题，$c_t$在时间上传递时受到的干扰极小。三个门控机制分别控制信息的进入、退出和持久化：

- **遗忘门**决定从细胞状态中删除哪些信息：$f_t = \sigma(W_f [h_{t-1}, x_t] + b_f)$
- **输入门**决定写入哪些新信息：$i_t = \sigma(W_i [h_{t-1}, x_t] + b_i)$，候选值为$\tilde{c}_t = \tanh(W_c [h_{t-1}, x_t] + b_c)$
- 细胞状态更新：$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$
- **输出门**决定输出什么内容：$o_t = \sigma(W_o [h_{t-1}, x_t] + b_o)$，最终隐藏状态为$h_t = o_t \odot \tanh(c_t)$

![展示LSTM单元中遗忘门、输入门、输出门、细胞状态以及数据流向的示意图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/rnn_lstm_cell.svg)

- 细胞状态就像一条传送带：信息可以在多个时间步中保持不变（此时遗忘门的值接近1），从而解决了长程依赖关系中的梯度消失问题。
- **GRU**（门控循环单元）通过将细胞状态和隐藏状态合并为一个，并使用两个门而非三个门来简化LSTM：更新门（结合了遗忘门和输入门）以及重置门。GRU的参数更少，其性能往往与LSTM相当。

- RNN（包括LSTM）的根本局限在于顺序处理：必须先处理第1个令牌，才能处理第2个令牌，进而处理第3个令牌。这阻碍了并行计算，并造成了信息瓶颈，因为所有上下文信息都必须通过固定大小的隐藏状态来传递。

- **注意力机制**解决了这两个问题。它并不将整个输入压缩成一个固定向量，而是让模型回顾所有输入位置，并决定哪些位置对当前输出而言是相关的。

- 现代注意力机制采用**查询、键和值（Q、K、V）**的形式。可以将其类比为图书馆检索：你有查询词（你要找的内容）、键（每本书上的标签）以及值（书的实际内容）。你将查询词与所有键进行比较，以确定需要提取哪些值。

- **缩放点积注意力**：

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right) V$$

- $QK^T$计算了每个查询与每个键之间的相似度。这是一种矩阵乘法（见第02章），其中的元素为点积，用于衡量余弦相似度（见第01章）。除以$\sqrt{d_k}$可防止点积数值过大（否则会导致softmax函数饱和，产生接近独热分布且梯度消失的情况）。softmax将相似度转换为概率分布。再乘以$V$，便得到值的加权组合。

- **多头注意力**会并行执行$h$次注意力运算，每次运算中Q、K、V的投影各不相同。这使得模型能够同时关注来自不同表示子空间的信息。一个头可能关注句法关系，另一个头则关注语义关系。各头的输出会被拼接后再进行投影：

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) W^O$$

- **Transformer**架构（Vaswani等人，2017年）完全由注意力机制和前馈层构成，不含循环结构。编码器模块依次包含：多头自注意力、加法与层归一化、前馈网络、加法与层归一化。解码器模块则增加了掩码自注意力（防止模型看到未来的令牌）以及交叉注意力层，用于关注编码器的输出。

![Transformer编码器模块：多头注意力、加法与层归一化、前馈网络、加法与层归一化，带有残差连接](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/transformer_block.svg)

- **位置编码**是必要的，因为注意力机制具有排列等变性，即它将输入视为集合而非序列。如果没有位置信息，“猫坐在垫子上”和“垫子坐在猫上”会被视为相同。原始的Transformer使用正弦位置编码：

$$PE_{(pos, 2i)} = \sin\!\left(\frac{pos}{10000^{2i/d}}\right), \quad PE_{(pos, 2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d}}\right)$$

- 每个位置都会获得一个独特的向量，供模型用来区分不同位置。现代模型通常使用学习到的位置嵌入或相对位置编码（如RoPE、ALiBi）。

- Transformer可以并行处理所有令牌（自注意力矩阵$QK^T$通过一次矩阵乘法即可算出），因此在现代硬件上训练速度远快于RNN。不过代价是自注意力的计算复杂度随序列长度呈$O(n^2)$增长（每个令牌都要与其他令牌交互），而RNN仅为$O(n)$。这就是为什么长上下文模型需要特殊的注意力变体（稀疏注意力、线性注意力、Flash Attention）。

- **视觉Transformer（ViT）**通过将图像分割成固定大小的块（如16×16），把每块展平为向量，并将这些块视为令牌序列，从而将Transformer应用于图像。模型会在序列开头添加一个可学习的[CLS]令牌，其最终表示用于分类。尽管ViT没有卷积操作的归纳偏置，但在足够数据量下训练时，其性能可与CNN相媲美甚至超越CNN。

- **MLP-Mixer**是一种更简单的架构，它用多层感知机取代了注意力机制和卷积操作。该架构交替使用“令牌混合”多层感知机（作用于空间位置之间）和“通道混合”多层感知机（作用于特征维度之间）。其性能颇具竞争力，这表明现代架构的关键并非注意力机制本身，而是高效地在令牌和特征之间混合信息。

- **自编码器**通过训练网络来重构其输入，从而学习压缩表示。编码器将输入映射到低维的瓶颈（潜码），解码器再将其还原：

$$z = f_{\text{enc}}(x), \quad \hat{x} = f_{\text{dec}}(z), \quad \mathcal{L} = \|x - \hat{x}\|^2$$

- 这种瓶颈结构迫使网络学习最重要的特征。自编码器可用于降维、去噪（用含噪声的输入训练，重构出干净的输出）以及异常检测（高重构误差表明输入异常）。

- **变分自编码器（VAE）**引入了概率化的处理方式。编码器不再输出单个点$z$，而是输出一个分布的参数（高斯分布的均值$\mu$和方差$\sigma^2$）。潜码从该分布中采样得出：$z = \mu + \sigma \odot \epsilon$，其中$\epsilon \sim \mathcal{N}(0, I)$。这种**重参数化技巧**使得采样过程可微，从而允许梯度反向传播。

- VAE的损失函数包含两项：

$$\mathcal{L} = \underbrace{\|x - \hat{x}\|^2}_{\text{重构误差}} + \underbrace{D_{\text{KL}}(q(z|x) \| p(z))}_{\text{正则化项}}$$

- KL散度项（来自第05章）促使学习到的后验分布$q(z|x)$趋近于先验分布$p(z) = \mathcal{N}(0, I)$，从而确保潜在空间平滑且结构良好。随后便可以从先验分布中采样并解码以生成新数据。这正是VAE作为生成模型的原因。

## 编程任务（使用CoLab或笔记本）

1. 用JAX从头构建一个简单的多层感知机。在二维分类问题（如同心圆）上训练它，并可视化决策边界。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt
from sklearn.datasets import make_circles

# Data
X, y = make_circles(n_samples=500, noise=0.1, factor=0.5, random_state=42)
X, y = jnp.array(X), jnp.array(y, dtype=jnp.float32)

# Initialise a 2-layer MLP: 2 -> 16 -> 16 -> 1
def init_params(key):
    k1, k2, k3 = jax.random.split(key, 3)
    return {
        'W1': jax.random.normal(k1, (2, 16)) * 0.5,
        'b1': jnp.zeros(16),
        'W2': jax.random.normal(k2, (16, 16)) * 0.5,
        'b2': jnp.zeros(16),
        'W3': jax.random.normal(k3, (16, 1)) * 0.5,
        'b3': jnp.zeros(1),
    }

def forward(params, x):
    h = jnp.maximum(0, x @ params['W1'] + params['b1'])  # ReLU
    h = jnp.maximum(0, h @ params['W2'] + params['b2'])   # ReLU
    logit = (h @ params['W3'] + params['b3']).squeeze()
    return jax.nn.sigmoid(logit)

def loss_fn(params, X, y):
    pred = forward(params, X)
    return -jnp.mean(y * jnp.log(pred + 1e-7) + (1 - y) * jnp.log(1 - pred + 1e-7))

grad_fn = jax.jit(jax.grad(loss_fn))
params = init_params(jax.random.PRNGKey(0))
lr = 0.1

for step in range(2000):
    grads = grad_fn(params, X, y)
    params = {k: params[k] - lr * grads[k] for k in params}

# Plot decision boundary
xx, yy = jnp.meshgrid(jnp.linspace(-2, 2, 200), jnp.linspace(-2, 2, 200))
grid = jnp.column_stack([xx.ravel(), yy.ravel()])
zz = forward(params, grid).reshape(xx.shape)

plt.figure(figsize=(7, 6))
plt.contourf(xx, yy, zz, levels=[0, 0.5, 1], alpha=0.3, colors=['#e74c3c', '#3498db'])
plt.scatter(X[y==0,0], X[y==0,1], c='#e74c3c', s=10, label='Class 0')
plt.scatter(X[y==1,0], X[y==1,1], c='#3498db', s=10, label='Class 1')
plt.title("MLP Decision Boundary on Concentric Circles")
plt.legend(); plt.grid(alpha=0.3); plt.show()

acc = jnp.mean((forward(params, X) > 0.5) == y)
print(f"Accuracy: {acc:.2%}")
```

1. 从零实现一维卷积。将简单的边缘检测滤波器应用于信号，并与内置的`jnp.convolve`进行比较。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

def conv1d(signal, kernel):
    """1D convolution (valid mode) from scratch."""
    n, k = len(signal), len(kernel)
    output = jnp.zeros(n - k + 1)
    for i in range(n - k + 1):
        output = output.at[i].set(jnp.sum(signal[i:i+k] * kernel))
    return output

# Create a signal with a step function
t = jnp.linspace(0, 4, 200)
signal = jnp.where(t < 1, 0.0, jnp.where(t < 2, 1.0, jnp.where(t < 3, 0.5, 1.5)))

# Edge detection kernel
edge_kernel = jnp.array([-1.0, 0.0, 1.0])

# Our implementation vs built-in
our_output = conv1d(signal, edge_kernel)
jnp_output = jnp.convolve(signal, edge_kernel, mode='valid')

fig, axes = plt.subplots(3, 1, figsize=(10, 6), sharex=True)
axes[0].plot(t, signal, color='#3498db', linewidth=1.5)
axes[0].set_title("Original Signal"); axes[0].set_ylabel("Value")

axes[1].plot(t[:len(our_output)], our_output, color='#e74c3c', linewidth=1.5)
axes[1].set_title("After Edge Detection (our conv1d)"); axes[1].set_ylabel("Value")

axes[2].plot(t[:len(jnp_output)], jnp_output, color='#27ae60', linewidth=1.5, linestyle='--')
axes[2].set_title("After Edge Detection (jnp.convolve)"); axes[2].set_ylabel("Value")
axes[2].set_xlabel("t")

plt.tight_layout(); plt.show()
print(f"Outputs match: {jnp.allclose(our_output, jnp_output)}")
```

1. 从零开始实现缩放点积注意力机制。针对一个小示例计算注意力权重，并将注意力矩阵以热图形式可视化。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def scaled_dot_product_attention(Q, K, V):
    """Scaled dot-product attention."""
    d_k = Q.shape[-1]
    scores = Q @ K.T / jnp.sqrt(d_k)
    weights = jax.nn.softmax(scores, axis=-1)
    output = weights @ V
    return output, weights

# Example: 4 tokens, embedding dim 8
key = jax.random.PRNGKey(42)
k1, k2, k3 = jax.random.split(key, 3)
seq_len, d_model = 4, 8

Q = jax.random.normal(k1, (seq_len, d_model))
K = jax.random.normal(k2, (seq_len, d_model))
V = jax.random.normal(k3, (seq_len, d_model))

output, weights = scaled_dot_product_attention(Q, K, V)

print(f"Q shape: {Q.shape}")
print(f"Attention weights shape: {weights.shape}")
print(f"Output shape: {output.shape}")
print(f"\nAttention weights (rows sum to 1):")
print(weights)
print(f"Row sums: {weights.sum(axis=-1)}")

# Visualise attention
fig, ax = plt.subplots(figsize=(5, 4))
im = ax.imshow(weights, cmap='Blues', vmin=0, vmax=1)
ax.set_xlabel("Key position"); ax.set_ylabel("Query position")
ax.set_title("Attention Weights")
tokens = ['tok 0', 'tok 1', 'tok 2', 'tok 3']
ax.set_xticks(range(4)); ax.set_xticklabels(tokens)
ax.set_yticks(range(4)); ax.set_yticklabels(tokens)
for i in range(4):
    for j in range(4):
        ax.text(j, i, f"{weights[i,j]:.2f}", ha='center', va='center', fontsize=10)
plt.colorbar(im); plt.tight_layout(); plt.show()
```

1. 构建一个简单的自编码器，通过一维瓶颈对二维数据进行压缩并重建。可视化潜在空间和重建结果。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons

# Data
X, _ = make_moons(n_samples=500, noise=0.05, random_state=42)
X = jnp.array(X)

# Autoencoder: 2 -> 8 -> 1 -> 8 -> 2
def init_ae(key):
    k1, k2, k3, k4 = jax.random.split(key, 4)
    return {
        'enc_W1': jax.random.normal(k1, (2, 8)) * 0.5, 'enc_b1': jnp.zeros(8),
        'enc_W2': jax.random.normal(k2, (8, 1)) * 0.5, 'enc_b2': jnp.zeros(1),
        'dec_W1': jax.random.normal(k3, (1, 8)) * 0.5, 'dec_b1': jnp.zeros(8),
        'dec_W2': jax.random.normal(k4, (8, 2)) * 0.5, 'dec_b2': jnp.zeros(2),
    }

def encode(p, x):
    h = jnp.tanh(x @ p['enc_W1'] + p['enc_b1'])
    return h @ p['enc_W2'] + p['enc_b2']

def decode(p, z):
    h = jnp.tanh(z @ p['dec_W1'] + p['dec_b1'])
    return h @ p['dec_W2'] + p['dec_b2']

def ae_loss(p, X):
    z = encode(p, X)
    X_hat = decode(p, z)
    return jnp.mean((X - X_hat) ** 2)

grad_fn = jax.jit(jax.grad(ae_loss))
params = init_ae(jax.random.PRNGKey(0))
lr = 0.01

for step in range(3000):
    grads = grad_fn(params, X)
    params = {k: params[k] - lr * grads[k] for k in params}

z = encode(params, X)
X_hat = decode(params, z)

fig, axes = plt.subplots(1, 2, figsize=(12, 5))
axes[0].scatter(X[:,0], X[:,1], c=z.squeeze(), cmap='viridis', s=10)
axes[0].set_title("Original Data (coloured by latent code)")
axes[1].scatter(X_hat[:,0], X_hat[:,1], c=z.squeeze(), cmap='viridis', s=10)
axes[1].set_title("Reconstruction from 1D bottleneck")
for ax in axes:
    ax.set_aspect('equal'); ax.grid(alpha=0.3)
plt.tight_layout(); plt.show()

print(f"Reconstruction MSE: {ae_loss(params, X):.4f}")
```

## 强化学习

强化学习通过让智能体在试错过程中最大化累积奖励，从而学会如何做出连续决策。本文件涵盖了马尔可夫决策过程、价值函数、贝尔曼方程、Q学习、策略梯度法、演员-评论家方法、PPO以及用于实现游戏智能体和语言模型对齐的RLHF框架。

- 监督学习需要带有标签的数据，而无监督学习则是在无标签数据中寻找模式。**强化学习**则与两者都不同：智能体是通过与环境互动、采取行动并获取奖励来学习的，不存在正确的标签，智能体必须通过试错来发现最佳行为方式。

- 可以把这想象成教狗新技巧的过程。你不会给它展示正确行为的示例，而是让它自己尝试，对于正确的行为给予奖励，如此一来它就能逐渐明白你的要求。强化学习就是将这一过程形式化。

- 强化学习系统由五个核心组成部分构成。**智能体**是学习者和决策者；**环境**则是智能体所交互的所有外部事物。在每个时间步中，智能体会观察当前状态$s_t$，选择某个动作$a_t$，获得相应奖励$r_t$，然后进入新的状态$s_{t+1}$。智能体的目标就是最大化其长期累积的奖励总量。

![智能体-环境循环：智能体观察状态、采取动作、获得奖励，环境则进入新状态](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mdp_agent_loop.svg)

- **策略**$\pi$是智能体的行动方案，即从状态到动作的映射关系。确定性策略会为每个状态指定一个具体的动作：$a = \pi(s)$；而随机策略则会给出各动作的概率分布：$\pi(a \mid s)$。强化学习的目标就是找到最优策略，也就是那种能最大化预期累积奖励的策略。

- 强化学习的数学框架是**马尔可夫决策过程（MDP）**，它由一组参数定义：状态集$S$、动作集$A$、状态转移概率$P(s' \mid s, a)$、奖励函数$R(s, a)$以及折扣因子$\gamma$。

- **马尔可夫性**（见第05章）指出，未来状态仅取决于当前状态，而与到达该状态的历史过程无关：$P(s_{t+1} \mid s_t, a_t, s_{t-1}, \ldots) = P(s_{t+1} \mid s_t, a_t)$。这意味着状态本身就包含了做出决策所需的所有信息。

- **折扣因子**$\gamma \in [0, 1)$决定了智能体对未来奖励和即时奖励的重视程度。从时间$t$开始的折现回报值为：

$$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \cdots = \sum_{k=0}^{\infty} \gamma^k r_{t+k}$$

- 当$\gamma = 0$时，智能体完全只关注眼前的奖励；而当$\gamma$接近1时，智能体则更注重长远利益。折扣因子还能确保级数收敛（前提是奖励值有上限），这对于保证数学上的合理性非常重要。

- **价值函数**用于评估处于某一状态（或在该状态下采取某项动作）的好坏程度。**状态价值函数**$V^\pi(s)$表示从状态$s$出发，按照策略$\pi$行进时的预期回报值：

$$V^\pi(s) = \mathbb{E}_\pi \left[ G_t \mid s_t = s \right]$$

- **动作价值函数**$Q^\pi(s, a)$则表示从状态$s$出发，采取动作$a$后，再按照策略$\pi$行进时的预期回报值：

$$Q^\pi(s, a) = \mathbb{E}_\pi \left[ G_t \mid s_t = s, a_t = a \right]$$

- 两者之间存在如下关系：$V^\pi(s) = \sum_a \pi(a \mid s) \, Q^\pi(s, a)$。状态价值实际上是各动作价值按策略权重后的平均值。

- **贝尔曼方程**描述了一种递归关系：一个状态的价值等于其即时奖励加上下一个状态的折现价值。对于状态价值函数而言，其表达式为：

$$V^\pi(s) = \sum_a \pi(a \mid s) \sum_{s'} P(s' \mid s, a) \left[ R(s, a) + \gamma \, V^\pi(s') \right]$$

- 对于最优价值函数$V^{*}(s)$，智能体总会选择最优的动作：

$$V^{*}(s) = \max_a \sum_{s'} P(s' \mid s, a) \left[ R(s, a) + \gamma \, V^{*}(s') \right]$$

- 同理，$Q^{*}$的最优性贝尔曼方程为：

$$Q^{*}(s, a) = \sum_{s'} P(s' \mid s, a) \left[ R(s, a) + \gamma \max_{a'} Q^{*}(s', a') \right]$$

- 一旦得到了$Q^{*}$，最优策略就很容易确定：只需始终选择Q值最高的动作即可：$\pi^{*}(s) = \arg\max_a Q^{*}(s, a)$。

- 当已知状态转移概率和奖励值（即完整的模型）时，可以使用**动态规划**方法来解决马尔可夫决策问题。**策略评估**则是通过反复应用贝尔曼方程，直到收敛，从而计算出给定策略对应的$V^\pi$值。**策略改进**则利用价值函数，通过贪婪策略来构建更好的策略：$\pi'(s) = \arg\max_a \sum_{s'} P(s' \mid s, a)[R(s,a) + \gamma V^\pi(s')]$。

- **策略迭代**方法是在评估与改进之间交替进行，直到策略不再发生变化。这种方法能够保证最终得到最优策略。

- **价值迭代**则将这两个步骤合二为一：它不断应用贝尔曼最优性方程，直到$V^{*}$收敛，然后再从中得出最优策略。

$$V(s) \leftarrow \max_a \sum_{s'} P(s' \mid s, a) \left[ R(s, a) + \gamma \, V(s') \right]$$

- 动态规划方法要求知道$P(s' \mid s, a)$，而这往往并不现实。在大多数实际问题中，智能体并不知道环境的运行规则，它只能与环境进行交互。这时就需要**无模型**方法了。

- **时差学习**无需了解模型，就能从经验中学习。其核心思想是**自举法**：不必等到一个任务结束才计算实际的回报值$G_t$，而是可以利用当前的价值函数来估算它：

$$V(s_t) \leftarrow V(s_t) + \alpha \left[ r_t + \gamma \, V(s_{t+1}) - V(s_t) \right]$$

- 括号中的术语是**TD误差**：即**TD目标值**（$r_t + \gamma V(s_{t+1})$）与当前估计值$V(s_t)$之间的差值。如果TD误差为正，说明该状态的表现优于预期，因此需要提高其数值；若为负，则需降低该数值。

![展示TD目标的状态转换图：当前值、奖励以及根据更新公式得出的下一个状态的估计值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/td_update.svg)

- TD学习会在每一步之后进行更新（而非在完整训练周期结束后），这使其比蒙特卡洛方法更高效。此外，它也适用于连续型环境。

- **SARSA**（状态-动作-奖励-状态-动作）是一种将TD学习应用于Q值的算法。智能体在状态$s$下选择动作$a$，获得奖励$r$并进入下一个状态$s'$，随后根据策略选择下一个动作$a'$：

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \, Q(s', a') - Q(s, a) \right]$$

- SARSA属于**在线学习**类型：它依据智能体实际采取的动作来进行更新，其中也包括探索行为。这使得SARSA更为保守，因为它学习的策略会考虑到自身的探索噪声。

- **Q学习**是最著名的强化学习算法。它与SARSA类似，不同之处在于：Q学习不是使用智能体实际采取的动作，而是使用最优动作：

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \max_{a'} Q(s', a') - Q(s, a) \right]$$

- Q学习属于**离线学习**类型：它无论智能体遵循何种策略，都能学习到最优的Q值。智能体可以在探索的同时继续学习最优动作值。这使得Q学习更具攻击性，收敛速度也更快，但有时也会高估数值。

- **探索与利用**是一个核心难题：智能体应该利用已知的策略（选择估计价值最高的动作），还是去探索未知的动作（这些动作可能会带来更好的结果）？

- 最简单的策略是**ε-贪婪策略**：以概率$\epsilon$选择随机动作（进行探索）；以概率$1 - \epsilon$选择最优动作（进行利用）。常见的策略是初始时设置较高的$\epsilon$值（大量探索），然后随着时间逐渐降低该值。

- 表格法（将每个状态-动作组合的值存储在表格中）适用于状态空间较小且离散的情况。对于状态空间较大或连续的情况，则需要使用函数近似方法。**深度Q网络（DQN）**利用神经网络来近似$Q(s, a; \theta)$，其中$\theta$为网络权重。

- DQN引入了两种关键的稳定技术。**经验回放**：不再从连续的状态转换中学习（因为这些转换之间存在高度相关性），而是将状态转换存储在回放缓冲区中，随机抽取小批量数据用于训练。这样可以打破数据之间的相关性，并高效地重复利用数据。

- **目标网络**：使用一个独立且更新速度较慢的网络副本来计算TD目标值。如果没有目标网络，每次更新网络时目标值都会发生变化，从而导致“追逐自身尾巴”的不稳定现象。目标网络会定期更新（每$N$步进行一次完全更新），或者持续更新（软更新：$\theta^{-} \leftarrow \tau\theta + (1-\tau)\theta^{-}$）。

- DQN的损失函数就是预测的Q值与TD目标值之间的均方误差：

$$\mathcal{L}(\theta) = \mathbb{E} \left[ \left( r + \gamma \max_{a'} Q(s', a'; \theta^{-}) - Q(s, a; \theta) \right)^2 \right]$$

- 到目前为止所介绍的所有方法都是先学习价值函数，再从中推导出策略。而**策略梯度**方法则采取了不同的途径：它直接对策略$\pi(a \mid s; \theta)$进行参数化，然后通过基于期望回报的梯度上升法来优化该策略。

- **策略梯度定理**给出了期望回报关于策略参数的梯度：

$$\nabla_\theta J(\theta) = \mathbb{E}_\pi \left[ \nabla_\theta \log \pi(a \mid s; \theta) \cdot G_t \right]$$

- 这意味着：应增加那些能带来高回报的动作的概率，同时降低那些导致低回报的动作的概率。对数概率梯度指出了调整策略的方向，而$G_t$则决定了调整的幅度。

- **REINFORCE**是最简单的策略梯度算法。首先运行一个训练周期，计算每一步的回报$G_t$，然后进行更新：

$$\theta \leftarrow \theta + \alpha \, \nabla_\theta \log \pi(a_t \mid s_t; \theta) \cdot G_t$$

- 由于$G_t$是对期望回报的噪声较大且基于单样本的估计，REINFORCE的方差较高。一种常见的解决方法是为其减去一个**基线值**（通常是平均回报或通过学习得到的价值函数），这样可以在不引入偏差的情况下降低方差：

$$\theta \leftarrow \theta + \alpha \, \nabla_\theta \log \pi(a_t \mid s_t; \theta) \cdot (G_t - b)$$

- **演员-评论家**方法使用两个网络。**演员网络**负责表示策略$\pi(a \mid s; \theta)$，而**评论家网络**则是一个价值函数$V(s; \phi)$，用作基线。优势值$A_t = r_t + \gamma V(s_{t+1}) - V(s_t)$则用来替代$G_t - b$：

$$\theta \leftarrow \theta + \alpha \, \nabla_\theta \log \pi(a_t \mid s_t; \theta) \cdot A_t$$

- 评论家网络通过最小化TD误差来更新，这与基于价值的方法类似。而演员网络则通过策略梯度进行更新，同时利用评论家网络计算出的优势值来降低方差。这种做法结合了两者的优点。

![双网络架构：演员网络输出动作概率，评论家网络输出价值估计值，优势信号则指导演员网络的更新](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/actor_critic.svg)

- **PPO**（近端策略优化）是实践中最常用的策略梯度算法。它解决了一个关键问题：如果策略更新幅度过大，性能可能会急剧下降。

- PPO采用了一种**截断的替代目标函数**。设$r_t(\theta) = \frac{\pi(a_t | s_t; \theta)}{\pi(a_t | s_t; \theta_{\text{old}})}$为新策略与旧策略之间的概率比。其损失函数为：

$$\mathcal{L}^{\text{CLIP}}(\theta) = \mathbb{E} \left[ \min\!\left( r_t(\theta) A_t, \; \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]$$

- 截止机制（通常为$\epsilon = 0.2$）可防止比率偏离1过远，从而让更新幅度保持较小且稳定。如果优势值为正（该动作表现良好），则比率的上限为$1 + \epsilon$；若为负（动作表现不佳），则比率的上限为$1 - \epsilon$。相比早期的信任区域方法（TRPO），这种方式更为简单且稳定。

- PPO正是通过**RLHF**（基于人类反馈的强化学习）来训练类似ChatGPT的模型的技术。在RLHF中，首先会根据人类的偏好数据训练奖励模型（人类更喜欢两种输出中的哪一种？），然后利用PPO优化语言模型的策略，以最大化这一学到的奖励值。

- **DPO**（直接偏好优化）通过完全省去奖励模型来简化RLHF流程。它无需先训练奖励模型再进行强化学习，而是直接从偏好数据中得出一个封闭形式的损失函数，用以优化策略：

$$\mathcal{L}_{\text{DPO}}(\theta) = -\mathbb{E} \left[ \log \sigma\!\left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} \right) \right]$$

- 这里，$y_w$表示更受青睐的响应结果，而$y_l$则表示较不受欢迎的响应结果。DPO能够提高受青睐响应结果的相对概率，其实现方式也比基于PPO的RLHF更为简单。

- 强化学习算法中有两个重要的区别：**在线学习与离线学习**：在线学习方法（如SARSA、PPO）是从当前策略生成的数据中学习；而离线学习方法（如Q学习、DQN）则可以从任何策略生成的数据中学习。离线学习方法的样本效率更高（可以重复使用旧数据），但稳定性可能较差。

- 另一个区别是**基于模型与无模型**：无模型方法（即目前所讨论的所有方法）都是直接从经验中学习价值或策略；而基于模型方法则会先构建环境的模型（$P(s' \mid s, a)$和$R(s, a)$），再利用这些模型进行规划（在不实际执行动作的情况下预测未来状态）。基于模型方法的样本效率更高，但需要额外处理构建精确模型的问题。

- 总结一下强化学习的各种方法：

| 方法 | 类型 | 核心思想 | 优点 |
| --- | --- | --- | --- |
| 价值迭代 | 动态规划，基于模型 | 贝尔曼最优性原理 | 可得到精确解（适用于规模较小的MDP问题） |
| SARSA | 时间差分法，在线学习 | 在线学习Q值 | 稳定可靠 |
| Q学习 | 时间差分法，离线学习 | 学习Q*值及贪婪目标函数 | 简单有效 |
| DQN | 深度学习，离线学习 | 神经网络Q函数+回放机制+目标网络 | 适用于高维状态空间 |
| REINFORCE | 策略梯度法 | 对数概率的梯度与回报值结合 | 策略优化较为简单 |
| 行动者-评论家方法 | 策略梯度法+价值函数 | 行动者与评论家共同作用，降低方差 | 实用且灵活 |
| PPO | 策略梯度法，带有截止机制 | 具有类似信任区域方法的稳定性 | 已成为行业标准 |
| DPO | 直接偏好优化 | 不需要奖励模型 | RLHF流程更为简单 |

## 编程任务（可使用CoLab或笔记本完成）（续1）

1. 对一个简单的网格世界环境实现价值迭代算法。计算出最优价值函数，并确定最优策略。将结果以热图和箭头图的形式展示出来。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# 4x4 gridworld: goal at (3,3), reward -1 per step, 0 at goal
grid_size = 4
gamma = 0.99
goal = (3, 3)

# Actions: up, down, left, right
actions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
action_names = ['up', 'down', 'left', 'right']
action_arrows = ['\u2191', '\u2193', '\u2190', '\u2192']

def step(s, a):
    """Deterministic transition."""
    ns = (max(0, min(grid_size-1, s[0]+a[0])),
          max(0, min(grid_size-1, s[1]+a[1])))
    return ns

# Value iteration
V = jnp.zeros((grid_size, grid_size))
for iteration in range(100):
    V_new = jnp.array(V)
    for i in range(grid_size):
        for j in range(grid_size):
            if (i, j) == goal:
                continue
            values = []
            for a in actions:
                ns = step((i, j), a)
                values.append(-1 + gamma * float(V[ns[0], ns[1]]))
            V_new = V_new.at[i, j].set(max(values))
    if jnp.max(jnp.abs(V_new - V)) < 1e-6:
        print(f"Converged in {iteration+1} iterations")
        break
    V = V_new

# Extract policy
policy = [['' for _ in range(grid_size)] for _ in range(grid_size)]
for i in range(grid_size):
    for j in range(grid_size):
        if (i, j) == goal:
            policy[i][j] = 'G'
            continue
        best_a = max(range(4), key=lambda a: -1 + gamma * float(V[step((i,j), actions[a])[0], step((i,j), actions[a])[1]]))
        policy[i][j] = action_arrows[best_a]

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
im = axes[0].imshow(V, cmap='YlOrRd_r')
axes[0].set_title("Optimal Value Function")
for i in range(grid_size):
    for j in range(grid_size):
        axes[0].text(j, i, f"{V[i,j]:.1f}", ha='center', va='center', fontsize=10)
plt.colorbar(im, ax=axes[0])

axes[1].imshow(jnp.ones((grid_size, grid_size)), cmap='Greys', vmin=0, vmax=2)
axes[1].set_title("Optimal Policy")
for i in range(grid_size):
    for j in range(grid_size):
        axes[1].text(j, i, policy[i][j], ha='center', va='center', fontsize=18)
plt.tight_layout(); plt.show()
```

1. 在一个简单的网格世界环境中实现表格型Q学习。对智能体进行训练，绘制学习曲线，并展示学到的Q值。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

grid_size = 5
goal = (4, 4)
actions = [(-1,0), (1,0), (0,-1), (0,1)]

# Q-table
Q = {}
for i in range(grid_size):
    for j in range(grid_size):
        Q[(i,j)] = [0.0] * 4

alpha = 0.1
gamma = 0.95
epsilon = 1.0
epsilon_decay = 0.995
min_epsilon = 0.01

def step(s, a_idx):
    a = actions[a_idx]
    ns = (max(0, min(grid_size-1, s[0]+a[0])),
          max(0, min(grid_size-1, s[1]+a[1])))
    r = 0.0 if ns == goal else -1.0
    done = ns == goal
    return ns, r, done

key = jax.random.PRNGKey(42)
rewards_per_episode = []

for ep in range(500):
    s = (0, 0)
    total_reward = 0
    for _ in range(100):
        key, subkey = jax.random.split(key)
        if float(jax.random.uniform(subkey)) < epsilon:
            key, subkey = jax.random.split(key)
            a = int(jax.random.randint(subkey, (), 0, 4))
        else:
            a = max(range(4), key=lambda i: Q[s][i])

        ns, r, done = step(s, a)
        total_reward += r
        # Q-learning update
        Q[s][a] += alpha * (r + gamma * max(Q[ns]) - Q[s][a])
        s = ns
        if done:
            break
    rewards_per_episode.append(total_reward)
    epsilon = max(min_epsilon, epsilon * epsilon_decay)

plt.figure(figsize=(8, 4))
# Smooth the curve
window = 20
smoothed = [sum(rewards_per_episode[max(0,i-window):i+1])/min(i+1, window)
            for i in range(len(rewards_per_episode))]
plt.plot(smoothed, color='#3498db', linewidth=1.5)
plt.xlabel("Episode"); plt.ylabel("Total Reward (smoothed)")
plt.title("Q-Learning on Gridworld")
plt.grid(alpha=0.3); plt.show()

# Show learned policy
arrow = ['\u2191', '\u2193', '\u2190', '\u2192']
print("Learned policy:")
for i in range(grid_size):
    row = ""
    for j in range(grid_size):
        if (i,j) == goal:
            row += " G "
        else:
            row += f" {arrow[max(range(4), key=lambda a: Q[(i,j)][a])]} "
    print(row)
```

1. 在多臂老虎机问题上实现REINFORCE算法。展示在训练过程中策略是如何演变的，从而最终选择最优的臂。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# 5-armed bandit with different expected rewards
true_rewards = jnp.array([0.2, 0.5, 0.8, 0.3, 0.1])
n_arms = len(true_rewards)

# Policy: softmax over logits
logits = jnp.zeros(n_arms)
lr = 0.1
key = jax.random.PRNGKey(42)

policy_history = []
reward_history = []

for step in range(2000):
    probs = jax.nn.softmax(logits)
    policy_history.append(probs)

    # Sample action
    key, subkey = jax.random.split(key)
    action = jax.random.choice(subkey, n_arms, p=probs)

    # Get reward (Bernoulli)
    key, subkey = jax.random.split(key)
    reward = float(jax.random.uniform(subkey) < true_rewards[action])
    reward_history.append(reward)

    # REINFORCE update
    # grad log pi(a) = e_a - probs (for softmax parameterisation)
    grad_log_pi = -probs.at[action].add(1.0)  # one-hot(a) - probs
    logits = logits + lr * reward * grad_log_pi

policy_history = jnp.stack(policy_history)

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
colors = ['#3498db', '#e74c3c', '#27ae60', '#9b59b6', '#f39c12']
for i in range(n_arms):
    axes[0].plot(policy_history[:, i], color=colors[i],
                 label=f'Arm {i} (true={true_rewards[i]:.1f})', linewidth=1.5)
axes[0].set_xlabel("Step"); axes[0].set_ylabel("P(arm)")
axes[0].set_title("Policy Evolution (REINFORCE)")
axes[0].legend(fontsize=8); axes[0].grid(alpha=0.3)

# Smoothed reward
window = 50
smoothed = [sum(reward_history[max(0,i-window):i+1])/min(i+1,window)
            for i in range(len(reward_history))]
axes[1].plot(smoothed, color='#27ae60', linewidth=1.5)
axes[1].axhline(y=0.8, color='#e74c3c', linestyle='--', alpha=0.5, label='Best arm')
axes[1].set_xlabel("Step"); axes[1].set_ylabel("Avg Reward")
axes[1].set_title("Reward Over Time"); axes[1].legend()
axes[1].grid(alpha=0.3)
plt.tight_layout(); plt.show()
```

## 分布式深度学习

_分布式训练将计算任务分配到多个GPU和机器上，从而能够训练那些单个设备无法处理的大型或训练速度过慢的模型。本文档介绍了混合精度、数据并行、模型并行、流水线并行、ZeRO、FSDP、张量并行以及全求和等通信机制，这些都是大规模训练大型语言模型所必需的。_

- 在单个GPU上训练大型神经网络最终会遇到瓶颈。模型可能无法完全加载到内存中，或者训练过程可能需要数月时间。分布式训练则通过将任务分配到多个设备（GPU、TPU或整台机器）上来加快训练速度，并允许训练更大的模型。本文档介绍了实现这一目标的各种技术。

- 要理解为什么分布式训练很重要，首先需要了解训练的**计算成本**。对于一个具有$d_{\text{in}}$个输入节点和$d_{\text{out}}$个输出节点的密集层，处理$B$个样本时，每个输出元素都需要进行一次乘法和一次加法运算，因此总共需要大约$2 \cdot B \cdot d_{\text{in}} \cdot d_{\text{out}}$次浮点运算。反向传播时的计算量则是正向传播的两倍（因为需要同时计算输入和权重对应的梯度），所以处理一个密集层所需的浮点运算次数约为$6 \cdot B \cdot d_{\text{in}} \cdot d_{\text{out}}$次。

- 对于隐藏维度为$d$的Transformer层，自注意力模块涉及四次投影操作（Q、K、V和输出），每次操作都需要$O(B \cdot n \cdot d^2)$次浮点运算（其中$n$为序列长度），此外还有注意力矩阵的计算，其计算量为$O(B \cdot n^2 \cdot d)$。前馈网络部分则包含两个密集层，参数规模通常会从$d$扩大到$4d$再变回$d$，因此该部分的计算量为$O(B \cdot n \cdot 8d^2)$。因此，每层的总计算量约为$O(B \cdot n \cdot 12d^2 + B \cdot n^2 \cdot d)$。将这个数值乘以层数，就能明白为何训练GPT级别的模型需要数千GPU小时的计算时间。

- **内存限制**往往是更关键的约束条件。在训练过程中，GPU内存必须同时存储四类数据：

![展示训练所需内存构成的堆叠条形图：模型参数、梯度、优化器状态、激活值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/training_memory_breakdown.svg)

- **模型参数**：即模型的权重。一个含有70亿个参数的模型，如果使用FP32格式存储（每个参数占4字节），那么仅权重部分就需要28GB的内存。
- **梯度**：其大小与参数相同，也需要28GB内存。
- **优化器状态**：Adam优化器会维护两个额外的缓冲区，用于存储一阶和二阶矩估计值，每个缓冲区的大小也与参数相同。为了保证数值稳定性，即使模型使用较低精度的格式，这些缓冲区仍以FP32格式存储。对于我们的70亿参数模型来说，这部分需要$2 \times 28 = 56$GB内存。
- **激活值**：是在正向传播过程中产生的中间结果，用于反向传播时使用。其大小取决于批量大小、序列长度以及模型的宽度。这通常是内存占用最大的部分，且会随着批量大小的增加而线性增长。

- 对于使用FP32格式和Adam优化器的70亿参数模型来说，仅参数、梯度和优化器状态这三者就需要28 + 28 + 56 = 112GB内存，这还没有包括激活值。而单个80GB容量的A100 GPU根本无法容纳这么多数据，这就是为什么需要采用分布式训练策略的原因。

- **混合精度训练**是解决这一问题的第一道防线。无需将所有数据都存储为FP32格式，可以在正向传播和反向传播过程中使用FP16或BF16格式来降低内存占用，而模型的权重则仍以FP32格式保存，以便用于优化器更新。

- **FP16**的精度较高（尾数部分为10位），但数值范围有限，容易发生溢出或下溢现象。通过损失缩放技术（在反向传播之前将损失值乘以一个较大的系数，然后再用相同的系数来除以梯度值），可以缓解这一问题。

- **BF16**的指数范围与FP32相同（为8位），但精度较低（尾数部分为7位）。它几乎不会发生溢出现象，也几乎不需要损失缩放，因此更易于使用。目前，BF16已成为现代Transformer模型训练的默认格式。

- 混合精度训练可以将激活值和梯度所需的内存占用减少大约一半（这两者是正向传播和反向传播过程中最占内存的部分），同时仍能以FP32格式存储优化器状态，从而保证数值稳定性。

- **数据并行**是最简单的分布式训练策略。只需将整个模型复制到$N$个GPU上，将每个小批量数据分成$N$个相等的部分，然后将每个部分发送到不同的GPU上。每个GPU独立地对属于自己的那部分数据进行正向传播和反向传播操作。之后，通过全求和操作将所有GPU上的梯度值平均起来，每个GPU再根据平均后的梯度值来更新自身的模型副本。

- 从模型的角度来看，这相当于使用大小为$N$倍的批量数据进行训练。如果每个GPU处理的批量大小为$B$，那么实际的有效批量大小就是$N \cdot B$。

![并列对比图：数据并行策略是复制模型并分割数据，而模型并行策略则是分割模型并共享数据](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/data_model_parallelism.svg)

- 梯度平均操作可以同步进行，也可以异步进行。**同步SGD**会等待所有GPU完成计算后再进行平均，这样就能确保其效果与使用更大批量数据进行单GPU训练的效果相同。不过，这种方法的缺点是，速度最慢的GPU会拖慢整体训练进度。

- **异步SGD**则允许每个GPU独立地更新共享的参数，无需等待其他GPU完成计算。虽然这样可以避免速度最慢的GPU成为瓶颈，但会导致“过时梯度”的问题：某个GPU可能会基于略显过时的参数来计算梯度。过时梯度会引入噪声，从而减缓模型收敛的速度。实际上，人们更倾向于使用具有高效通信机制的同步SGD。

- **梯度累积**是一种软件技巧，用于在硬件资源有限的条件下模拟更大的批量大小。无需在每个小批量数据后都进行一次模型更新，而是可以先进行多次正向传播和反向传播操作，将梯度值累积起来，然后再进行一次更新。这样就能获得与使用更大批量数据相同的训练效果，而且无需为存储激活值而占用过多GPU内存（因为一次只会有一个批量的激活值存储在内存中）。

- 当模型本身过大，无法存储在单个GPU上时，就需要采用**模型并行**策略。这种策略主要有两种实现方式。
- **张量并行**是将各个层分配到不同的GPU上处理。对于像$Y = XW$这样的大规模矩阵乘法操作，可以按列进行分解：将矩阵$W$分成$[W_1, W_2]$两部分，分别放在两个GPU上，同时计算$Y_1 = XW_1$和$Y_2 = XW_2$，最后再将结果合并。这种方法适用于注意力投影层和前馈层。由于每层都需要合并部分计算结果，因此需要GPU之间快速通信（通常是在同一节点内通过NVLink实现）。

- **流水线并行**则是将不同的层分配到不同的GPU上处理。GPU 0负责处理第1-4层，GPU 1负责处理第5-8层，以此类推。数据就像在流水线上一样依次传递。这种方法的缺点是存在“流水线空闲期”：当GPU 0正在处理第一个小批量的数据时，GPU 1-3则处于闲置状态。**微批量处理**可以通过将大批量数据拆分成更小的微批次来缓解这一问题，这样所有GPU就能持续处于工作状态。

- **混合并行**则结合了数据并行、张量并行和流水线并行三种方式。在大型模型中，通常会在同一节点内使用张量并行（通过快速的NVLink连接8个GPU），在不同节点之间使用流水线并行，而在多个节点组之间则使用数据并行。GPT-4和Llama等模型就是采用这种方式进行训练的。

- 分布式训练的效率在很大程度上取决于**通信效率**。其中最关键的操作就是**全量求和**：给定$N$个GPU上的各个数值，计算它们的总和（或平均值），然后将结果分发到所有GPU上。

- 传统的全量求和方法是将所有数据发送到一个GPU上，对其进行求和后再广播回去。这种方式的通信复杂度为$O(N)$，且会在数据传输环节形成瓶颈。

- **环形全量求和**则效率更高。将$N$个GPU排列成一个环状结构，每个GPU将自己的数据分成$N$份。在$N-1$步之后，每个GPU都会向相邻的GPU发送一份数据，同时从另一个相邻的GPU那里接收一份数据，从而逐步积累出部分总和。再经过$N-1$步后，最终的总和就会传送到所有GPU上。每个GPU所需传输的数据量为$2(N-1)/N$倍于数据总量，随着$N$的增大，这一数值会趋近于2。重要的是，这一数值不会随$N$的增加而上升，因此是一种符合带宽优化要求的通信方式。

![四个GPU呈环形排列，每个GPU都将梯度数据分发给相邻的GPU，直到所有GPU都获得完整的总和](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/ring_allreduce.svg)

- **参数服务器**是一种另一种架构，它由专门的服务器节点来存储模型参数。工作节点负责计算梯度并将结果发送给服务器，服务器则更新参数后再将其发回工作节点。虽然这种方式更为简单，但可能会在服务器端产生通信瓶颈。

- **NCCL**（NVIDIA集体通信库）是用于GPU间通信的标准库。它提供了全量求和、全量收集、广播等集体操作的高效实现方式，并能根据网络拓扑结构自动选择最优的算法。

- **规模定律**描述了模型性能如何随着计算资源、数据量和模型规模的增加而提升。Kaplan等人（2020年）提出的规模定律表明，损失值会以某种幂律形式随这些因素的变化而下降：

$$L(N) \propto N^{-\alpha_N}, \quad L(D) \propto D^{-\alpha_D}, \quad L(C) \propto C^{-\alpha_C}$$

其中，$N$表示参数数量，$D$表示数据集大小，$C$则表示可用的计算资源。

- Hoffmann等人（2022年）提出的**Chinchilla规模定律**指出，大多数模型都存在欠训练的问题：在给定的计算资源下，应该使用更小的模型并处理更多的数据。理想的参数与数据比例大约为每个参数对应20个token。一个70亿参数的模型应该处理约1400亿个token，而非Llama 1所使用的3000亿个token（该模型对应650亿参数）。这一发现促使研究方向转向“计算资源最优”的训练策略。

- **专家混合架构（MoE）**是一种无需按比例增加计算资源即可提升模型容量的架构。在这种架构中，每个Transformer层不再只有一个前馈网络，而是有$N$个“专家”网络（每个都是标准的前馈网络）。一个**门控网络**会判断每个token，然后将其发送到排名靠前的$K$个专家网络中处理（通常$K=1$或$K=2$）。

![Token通过门控网络被路由到选定的专家网络中，再通过对输出结果进行稀疏路由和加权组合来得到最终结果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/moe_routing.svg)

虽然这种架构的参数总数会大幅增加（因为有$N$个专家网络），但由于每个token只有$K$个专家网络会被激活，因此每个token所需的浮点运算次数大致保持不变。例如，Mixtral 8x7B模型的总参数数为470亿，但在每次前向传播过程中实际上只使用约130亿次浮点运算，从而能够获得类似更大模型的性能，却只需消耗较小模型的计算资源。

- MoE架构也带来了一些挑战。首先是**负载均衡问题**：如果门控网络总是将大部分token发送到同一个专家网络，那么其他专家网络就会被闲置。为了解决这个问题，人们引入了辅助损失函数来确保token能够均匀地分配到各个专家网络中。其次是**通信问题**：不同的专家网络可能位于不同的GPU上，因此需要进行全互连通信，而这会带来较高的通信成本。

- 当训练需要在数千个GPU上持续数周甚至数月时，**容错能力**就显得非常重要。如果某个GPU出现故障，就不能让所有的训练进度都白费。为此，需要定期将模型权重、优化器状态以及训练状态（如学习率、训练步数、数据位置等信息）保存到磁盘上。一旦发生故障，就可以从上一个检查点重新开始训练。

- **梯度检查点技术**（也称为激活值重算技术）其实是一种内存优化手段，而非容错机制。在正向传播过程中，不需要为反向传播保存所有的激活值，只需在某些关键点保存激活值即可。在反向传播过程中，再从这些保存的点重新计算缺失的激活值。这种做法是以增加一定的计算成本为代价来减少内存占用：它会使正向传播的成本增加约33%，但可以将激活值所需的内存占用降低到原来的$\sqrt{L}$倍（其中$L$为层数）。
- 总的来说，训练先进的模型需要综合运用多种技术：BF16混合精度计算、通过环形全归约技术在数千个GPU上实现数据并行处理、在单个节点内实现张量并行处理、在多个节点间实现流水线并行处理、通过梯度检查点机制来减少内存占用、利用MoE技术提升参数效率，以及通过定期保存检查点来增强系统的容错能力。系统设计同样具有与算法设计相当的挑战性。

- 以下是分布式训练相关技术的总结：

| 技术 | 功能 | 缺点 |
| --- | --- | --- |
| 混合精度计算（BF16） | 减少激活值和梯度所需的内存 | 会导致轻微的数值误差 |
| 数据并行处理 | 允许在多个GPU上处理更大的批量数据 | 需要额外的通信开销来同步梯度 |
| 张量并行处理 | 将模型的不同层分配到不同的GPU上 | 需要高速的互连技术 |
| 流水线并行处理 | 将模型的不同处理阶段分配到不同的GPU上 | 可能导致计算资源浪费 |
| 梯度累积 | 模拟大批量数据处理的效果 | 计算速度较慢，需进行多次前向/后向传播 |
| 梯度检查点机制 | 减少激活值所需的内存 | 计算量会增加约33% |
| 环形全归约技术 | 高效地计算梯度平均值 | 对于大型模型而言，受带宽限制 |
| MoE技术 | 在保持相同浮点运算次数的同时提升处理能力 | 需要处理负载均衡和路由调度问题 |
| 扩展定律 | 为计算资源分配提供指导 | 基于经验得出，可能在不同规模下并不适用 |

## 编程任务（可使用CoLab或笔记本完成）（续2）

1. 计算Transformer层所需的浮点运算次数及内存容量。给定隐藏维度$d$、序列长度$n$、批量大小$B$以及层数，估算出总的训练成本。

```python
import jax.numpy as jnp

def transformer_layer_flops(d, n, B):
    """Approximate FLOPs for one transformer layer forward pass."""
    # QKV projections: 3 * (B * n * d * d) * 2 (multiply-add)
    qkv_flops = 3 * 2 * B * n * d * d
    # Attention: (B * n * n * d) * 2 for QK^T, (B * n * n * d) * 2 for attn*V
    attn_flops = 2 * 2 * B * n * n * d
    # Output projection: (B * n * d * d) * 2
    out_flops = 2 * B * n * d * d
    # FFN: two layers, d->4d and 4d->d: 2 * (B * n * d * 4d) * 2
    ffn_flops = 2 * 2 * B * n * d * 4 * d
    return qkv_flops + attn_flops + out_flops + ffn_flops

def transformer_layer_memory(d, n, B, dtype_bytes=2):
    """Approximate activation memory (bytes) for one layer."""
    # QKV: 3 * B * n * d
    qkv_mem = 3 * B * n * d * dtype_bytes
    # Attention weights: B * heads * n * n (approx B * n * n * sizeof)
    attn_mem = B * n * n * dtype_bytes
    # FFN intermediate: B * n * 4d
    ffn_mem = B * n * 4 * d * dtype_bytes
    return qkv_mem + attn_mem + ffn_mem

# Example: GPT-2 scale
d, n, B, L = 1024, 1024, 8, 24
fwd_flops = transformer_layer_flops(d, n, B)
total_flops = 3 * L * fwd_flops  # 3x for forward + backward
act_mem = L * transformer_layer_memory(d, n, B)
param_count = L * (12 * d * d + 13 * d)  # approximate

print(f"Model: d={d}, n={n}, B={B}, L={L}")
print(f"Parameters: {param_count / 1e6:.0f}M")
print(f"FLOPs per step: {total_flops / 1e12:.2f} TFLOPs")
print(f"Activation memory: {act_mem / 1e9:.2f} GB (BF16)")
print(f"Parameter memory (FP32): {param_count * 4 / 1e9:.2f} GB")
print(f"Adam optimizer memory: {param_count * 8 / 1e9:.2f} GB")
print(f"Total training memory: {(param_count * 16 + act_mem) / 1e9:.2f} GB")
```

1. 模拟数据并行训练。将数据集分配到多个“虚拟GPU”上，分别计算梯度后再将它们取平均值，最后验证该结果是否与单GPU训练的结果一致。

```python
import jax
import jax.numpy as jnp

# Simple linear model: y = wx + b
key = jax.random.PRNGKey(0)
X = jax.random.normal(key, (64, 4))
w_true = jnp.array([1.0, -2.0, 3.0, 0.5])
y = X @ w_true + 0.1 * jax.random.normal(key, (64,))

def loss_fn(w, X, y):
    return jnp.mean((X @ w - y) ** 2)

grad_fn = jax.grad(loss_fn)

# Single GPU: full batch gradient
w = jnp.zeros(4)
grad_single = grad_fn(w, X, y)

# Data parallel: split across 4 "GPUs"
n_gpus = 4
chunk_size = len(X) // n_gpus
grads = []
for i in range(n_gpus):
    X_chunk = X[i*chunk_size:(i+1)*chunk_size]
    y_chunk = y[i*chunk_size:(i+1)*chunk_size]
    grads.append(grad_fn(w, X_chunk, y_chunk))

# All-reduce: average gradients
grad_parallel = jnp.mean(jnp.stack(grads), axis=0)

print("Single-GPU gradient:", grad_single)
print("Data-parallel gradient (avg):", grad_parallel)
print(f"Match: {jnp.allclose(grad_single, grad_parallel, atol=1e-5)}")

# Train both and compare
w_single, w_parallel = jnp.zeros(4), jnp.zeros(4)
lr = 0.1
for step in range(100):
    w_single = w_single - lr * grad_fn(w_single, X, y)

    grads = [grad_fn(w_parallel, X[i*chunk_size:(i+1)*chunk_size],
                     y[i*chunk_size:(i+1)*chunk_size]) for i in range(n_gpus)]
    avg_grad = jnp.mean(jnp.stack(grads), axis=0)
    w_parallel = w_parallel - lr * avg_grad

print(f"\nAfter 100 steps:")
print(f"Single-GPU weights: {w_single}")
print(f"Data-parallel weights: {w_parallel}")
print(f"Max difference: {jnp.max(jnp.abs(w_single - w_parallel)):.2e}")
```

1. 实现一个简单的专家混合层。构建一个门控网络，用于将各个令牌路由到排名前K的专家处，并整合这些专家的输出结果。

```python
import jax
import jax.numpy as jnp

def expert_fn(x, W1, b1, W2, b2):
    """Simple 2-layer FFN expert."""
    h = jnp.maximum(0, x @ W1 + b1)  # ReLU
    return h @ W2 + b2

def moe_layer(x, gate_W, experts_params, top_k=2):
    """
    MoE forward pass.
    x: (batch, d_model)
    gate_W: (d_model, n_experts)
    experts_params: list of (W1, b1, W2, b2) per expert
    """
    n_experts = len(experts_params)

    # Gating: compute routing scores
    gate_logits = x @ gate_W  # (batch, n_experts)
    gate_probs = jax.nn.softmax(gate_logits, axis=-1)

    # Top-K selection
    top_k_indices = jnp.argsort(-gate_probs, axis=-1)[:, :top_k]
    top_k_probs = jnp.take_along_axis(gate_probs, top_k_indices, axis=-1)
    # Renormalise
    top_k_probs = top_k_probs / jnp.sum(top_k_probs, axis=-1, keepdims=True)

    # Compute expert outputs (simplified: run all experts, mask later)
    expert_outputs = jnp.stack([
        expert_fn(x, *experts_params[i]) for i in range(n_experts)
    ], axis=1)  # (batch, n_experts, d_model)

    # Gather top-K expert outputs and weight them
    batch_idx = jnp.arange(x.shape[0])[:, None]
    selected_outputs = expert_outputs[batch_idx, top_k_indices]  # (batch, top_k, d_model)
    output = jnp.sum(selected_outputs * top_k_probs[:, :, None], axis=1)

    return output, gate_probs

# Setup
key = jax.random.PRNGKey(42)
batch, d_model, d_ff, n_experts = 8, 16, 32, 4

# Initialise experts
experts_params = []
for i in range(n_experts):
    k1, k2, key = jax.random.split(key, 3)[0], jax.random.split(key, 3)[1], jax.random.split(key, 3)[2]
    experts_params.append((
        jax.random.normal(k1, (d_model, d_ff)) * 0.1,
        jnp.zeros(d_ff),
        jax.random.normal(k2, (d_ff, d_model)) * 0.1,
        jnp.zeros(d_model),
    ))

key, subkey = jax.random.split(key)
gate_W = jax.random.normal(subkey, (d_model, n_experts)) * 0.1
x = jax.random.normal(key, (batch, d_model))

output, gate_probs = moe_layer(x, gate_W, experts_params, top_k=2)

print(f"Input shape: {x.shape}")
print(f"Output shape: {output.shape}")
print(f"Gate probabilities (first sample): {gate_probs[0]}")
print(f"Expert usage (avg across batch):")
for i in range(n_experts):
    usage = jnp.mean(gate_probs[:, i])
    print(f"  Expert {i}: {usage:.3f}")
```

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
