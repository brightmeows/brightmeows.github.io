---
title: "多模态学习"
date: "2026-11-05"
order: 10
slug: "compendium/10-multimodal-learning"
description: "多模态表示能够将视觉、语言和音频信息整合到同一个嵌入空间中。本文件涵盖了各种融合策略、CLIP、ALIGN、SigLIP等模型，以及对比损失函数（InfoNCE、NT-Xent）、零样本分类方法和检索评估技术。"
tags: []
---

## 多模态表示

_多模态表示能够将视觉、语言和音频信息整合到同一个嵌入空间中。本文件涵盖了各种融合策略、CLIP、ALIGN、SigLIP等模型，以及对比损失函数（InfoNCE、NT-Xent）、零样本分类方法和检索评估技术。_

- 想象你正坐在咖啡馆里。你能看到桌子上那杯冒着热气的咖啡，听到陶瓷杯的碰撞声，闻到烘焙咖啡豆的香气，还能感受到杯子散发的温暖。没有任何一种感官信息能够单独告诉你所有信息：你的大脑会将这些信号整合起来，形成“热咖啡”这一统一的感知。**多模态学习**也为机器实现了同样的功能：它通过整合多种模态的信息（视觉、语言、音频等），从而生成比单一模态所能提供的更为丰富、更可靠的表示。

- **模态**指的是不同的信息载体。在机器学习中，最常见的模态包括图像（像素网格）、文本（令牌序列）、音频（波形或频谱图，详见第9章）、视频（帧序列）以及结构化数据（表格、图表）。每种模态都有其独特的统计特性：图像具有空间一致性，文本是顺序且离散的，而音频则是时间连续的。多模态学习的挑战就在于如何将这些本质上不同的数据类型整合在一起。

- 为什么要整合不同模态的信息呢？因为它们能提供互补的信息。一张狗的照片可以让你知道它的品种和颜色，但却无法告诉你它的名字；而像“我的金毛猎犬马克斯”这样的描述则能告诉你名字和品种，却无法说明它的具体姿势。只有将图像和文本结合在一起，才能获得比单独使用其中任何一种信息更完整的描述。这种互补性正是多模态模型的核心优势——它们能够回答那些单模态模型无法处理的问题，生成内容并做出决策。

![多模态学习概览：不同的编码器分别处理图像、文本和音频输入，这些输入的表示会在一个共享的嵌入空间中交汇](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/multimodal_overview.svg)

## 融合策略

- 想象一个团队项目。有两种方式可以整合各种想法：要么所有人从一开始就在同一个房间里一起工作，共同编写草稿；要么每个人独立完成自己的部分，最后再把各部分的成果合并起来。这对应着多模态学习中的**早期融合**和**晚期融合**。

- **早期融合**（也称为特征级融合）是在进行任何深入处理之前，就将不同模态的原始特征或低级特征进行拼接或混合。例如，可以将图像的像素特征与文本的令牌嵌入相拼接，然后将这个组合后的序列输入到一个Transformer模型中。这样，模型就可以从一开始就学习到不同模态之间的细微交互关系，但缺点是输入空间的维度很高，模型需要同时处理截然不同的数据类型。

- 从形式上来看，假设来自两种模态的特征向量分别为 $x_{\text{img}} \in \mathbb{R}^{d_1}$ 和 $x_{\text{txt}} \in \mathbb{R}^{d_2}$，那么早期融合就是简单地将它们拼接起来：

$$x_{\text{fused}} = [x_{\text{img}}; x_{\text{txt}}] \in \mathbb{R}^{d_1 + d_2}$$

- 接下来，这个拼接后的向量会被一个共享的网络进行处理。其优点是模型可以在每一层都发现不同模态之间的关联，缺点则是计算成本较高，而且很难让密度不同的特征类型（如密集的像素值与稀疏的令牌索引）相互匹配。

- **晚期融合**（也称为决策级融合）则是让每种模态分别通过各自的编码器进行处理，从而得到高级别的表示或最终预测结果。之后，这些输出结果会被进一步整合，通常是通过平均分值、投票或专门的整合层来实现。晚期融合较为简单，而且可以利用现有的预训练单模态模型，但它无法捕捉到低级别的跨模态交互，因为各模态之间无法直接看到对方的原始特征。

- 设两种模态的预测结果分别为 $\hat{y}_1$ 和 $\hat{y}_2$，那么简单的晚期融合公式为：

$$\hat{y} = \alpha \hat{y}_1 + (1 - \alpha) \hat{y}_2$$

其中，$\alpha \in [0, 1]$ 是一个通过学习或手动调整得到的权重参数。

- **中间融合**（也称为中级融合）则是大多数现代系统所采用的折中方案。首先，每种模态都会通过各自的编码器进行处理，提取出该模态特有的特征，然后在这些编码后的表示在网络的中途被整合起来，通常是通过交叉注意力层来实现。这样一来，每个编码器都可以专注于处理自己的模态，同时仍能实现丰富的跨模态交互。Flamingo、LLaVA以及大多数视觉-语言模型（见文件02）都采用中间融合方式。

![早期融合、中间融合和晚期融合的策略对比：早期融合直接拼接原始输入，中间融合通过交叉注意力整合中间表示，晚期融合则整合最终预测结果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/fusion_strategies.svg)

- 选择哪种融合策略取决于数据的可用性、计算资源以及任务需求。早期融合虽然效果出色，但对数据量要求很高；晚期融合则计算成本较低，但功能有限。而结合了交叉注意力的中间融合方式，由于能够在表达能力与模块化之间取得平衡，因此已成为大规模多模态模型中的主流选择。

## 联合嵌入空间

- 想象有一种通用翻译器，它能将任何语言中的句子映射到同一个“意义空间”中的同一位置。无论是英语、法语还是日语中的“海滩上的狗”这句话，都会被映射到同一个坐标点上。**联合嵌入空间**正是实现了这一功能，只不过它是针对不同模态而言的：一张海滩上狗的图片以及“海滩上的狗”这条文本，应该会被映射到同一个向量空间中的相近位置上。
- 从形式上来看，我们需要学习两个编码器函数：$f_\theta : \mathcal{X}_1 \to \mathbb{R}^d$，用于处理第一种模态的数据（如图像），以及$g_\phi : \mathcal{X}_2 \to \mathbb{R}^d$，用于处理第二种模态的数据（如文本）。这两个函数都会将各自的输入映射到同一个$d$维空间中。训练目标在于确保语义上匹配的配对$(x_1, x_2)$对应的嵌入向量$f_\theta(x_1)$和$g_\phi(x_2)$之间的相似度很高（余弦相似度大），而不匹配的配对则对应向量之间的距离很远。

- 这实际上是第7章中介绍的词嵌入空间的直接扩展。回想一下，Word2Vec和GloVe会将语义上相似的单词放在向量空间中的相近位置。联合嵌入空间则将这一理念应用到不同模态之间：我们不再衡量单词与单词之间的相似度，而是衡量图像与文本、音频与文本，甚至是图像与音频之间的相似度。

- 相似度度量标准几乎总是**余弦相似度**（第1章）：

$$\text{sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$$

- 通过将所有嵌入向量进行$L_2$归一化，使其落在单位超球面上，余弦相似度就简化为简单的点积运算$u \cdot v$。这种运算的计算效率非常高，而且还可以借助近似最近邻算法来加速计算。

![联合嵌入空间：图像编码器和文本编码器分别将各自的输入映射到同一个向量空间中，语义匹配的配对会聚集在一起来](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/joint_embedding_space.svg)

- 联合嵌入空间的优势在于它能够实现**零样本迁移**。一旦实现了图像嵌入向量和文本嵌入向量之间的对齐，就可以将图像分类到那些从未训练过的数据类别中：只需将类别名称作为文本进行嵌入，然后找出与图像嵌入向量余弦相似度最高的文本嵌入向量即可。无需针对特定任务进行微调。这正是CLIP及其后续模型背后的核心思想。

## 用于多模态对齐的对比学习

- 想象一下课堂上的练习：学生们会得到一些顺序被打乱的图片和文字描述，需要将每张图片与其正确的描述匹配起来。要完成这项任务，就需要理解视觉内容与语言的含义，以及二者之间的关系。**对比学习**就是以这种方式来训练模型的：给定一批（图像，文本）对，模型需要判断出哪张图片应该与哪段文字配对。

- 如第8章（文件04）中所介绍的，在单模态场景下，对比学习方法（如SimCLR、MoCo）会将同一张图片的不同版本放在一起，而将不同图片的版本分开。多模态对比学习则用“匹配的模态”来替代“图片的不同版本”：一张图片及其对应的文字描述构成正样本对；而该图片与批次中其他任何文字描述的组合则构成负样本对。

### CLIP

- **CLIP**（对比式语言-图像预训练模型，Radford等人，2021年）是多模态对比学习领域的基础模型。它通过在互联网上收集的4亿对（图像，文本）数据，同时训练图像编码器（如ViT或ResNet，第8章）和文本编码器（如变换器，第7章）。

- 给定一批包含$N$对图像-文本数据的样本，CLIP会计算所有图像嵌入向量与所有文本嵌入向量之间的$N \times N$余弦相似度矩阵。对角线上的元素代表匹配的配对（正样本），而非对角线上的元素则代表不匹配的配对（负样本）。训练过程的目标就是让对角线上的元素值尽可能大，而非对角线上的元素值尽可能小。

- 该模型的损失函数是一种对称的交叉熵损失函数。对于与自身文字描述配对的图像$i$，其图像-文本损失函数为：

$$\mathcal{L}_{i \to t} = -\frac{1}{N} \sum_{i=1}^{N} \log \frac{\exp(\text{sim}(z_i^{\text{img}}, z_i^{\text{txt}}) / \tau)}{\sum_{k=1}^{N} \exp(\text{sim}(z_i^{\text{img}}, z_k^{\text{txt}}) / \tau)}$$

- 而文本-图像损失的计算方式类似，只是角色互换：

$$\mathcal{L}_{t \to i} = -\frac{1}{N} \sum_{i=1}^{N} \log \frac{\exp(\text{sim}(z_i^{\text{txt}}, z_i^{\text{img}}) / \tau)}{\sum_{k=1}^{N} \exp(\text{sim}(z_i^{\text{txt}}, z_k^{\text{img}}) / \tau)}$$

- CLIP的总损失则是这两者之和的平均值：

$$\mathcal{L}_{\text{CLIP}} = \frac{1}{2}(\mathcal{L}_{i \to t} + \mathcal{L}_{t \to i})$$

- 这里的$\tau$是一个需要学习的**温度参数**（初始值为$\tau = 0.07$）。温度参数可以控制softmax分布的尖锐程度：较低的$\tau$值会让模型更专注于最接近的匹配结果，而较高的$\tau$值则会使概率分布更加均匀。CLIP会与模型权重一起学习$\tau$的值，而不是将其视为一个固定的超参数。

![CLIP的训练过程：一批N对图像-文本数据会生成一个NxN的相似度矩阵，训练过程旨在让对角线上的元素值尽可能大，而非对角线上的元素值尽可能小](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/clip_contrastive_matrix.svg)

- CLIP的图像编码器通常采用ViT-L/14架构（一种具有14×14像素块的大型视觉变换器，见第8章文件04）。文本编码器则是一种具有12层结构且带有因果掩码功能的变换器（类似GPT，见第7章文件04）。这两种编码器都会通过学习得到的线性投影函数，将各自的输出映射到同一个512维或768维的空间中，之后再进行$L_2$归一化处理。

- CLIP最引人注目的特性就是**零样本图像分类能力**。要将一张图像分类到$K$个类别中的某一个，只需创建$K$个文本提示，例如“一张`{类别名称}`的图片”，然后用文本编码器对这些提示进行嵌入，同时用图像编码器对图片本身进行嵌入，最后选择那些文本嵌入向量与图像嵌入向量的余弦相似度最高的类别。在ImageNet数据集上，CLIP无需查看任何训练样本，就能取得相当不错的分类准确率。

### ALIGN

- **ALIGN**（Jia等人，2021年）将CLIP的方法应用到了规模更大、噪声更多的数据集上：共有18亿对图像-文本数据，且几乎不需要进行数据过滤。虽然CLIP需要精心筛选数据，但ALIGN表明，足够大的数据量足以弥补数据中的噪声问题。ALIGN使用EfficientNet作为图像编码器，BERT作为文本编码器，并采用相同的对比学习损失函数进行训练。该研究的关键发现是：只要有足够的数据量，就无需进行复杂的数据清洗工作——因为对比学习目标本身就会降低那些噪声较大、导致梯度不一致的配对的重要性。

### SigLIP

- **SigLIP**（用于语言-图像预训练的Sigmoid损失函数，Zhai等人，2023年）用更简单的Sigmoid损失函数替代了CLIP中基于softmax的对比损失函数。与将$N \times N$相似度矩阵视为分类问题（每行是对各列的softmax计算结果）不同，SigLIP将每个元素视为独立的二分类问题：即该（图像，文本）对是否匹配？

- 单个对$(i, j)$的SigLIP损失函数为：

$$\mathcal{L}_{ij} = -y_{ij} \log \sigma(z_i^{\text{img}} \cdot z_j^{\text{txt}} / \tau) - (1 - y_{ij}) \log(1 - \sigma(z_i^{\text{img}} \cdot z_j^{\text{txt}} / \tau))$$

- 其中，当$i = j$时$y_{ij} = 1$（表示匹配），否则$y_{ij} = 0$；$\sigma$为Sigmoid函数。

- SigLIP的核心优势在于它无需对整个批次进行全局softmax归一化。在CLIP中，softmax的分母需要汇总所有设备上的嵌入向量，这在分布式训练中会成为通信瓶颈。而SigLIP的逐对Sigmoid损失函数可以在本地计算，从而更高效地处理大规模批次数据。SigLIP在保持与CLIP相同性能的同时，降低了训练成本。

## 对比损失函数的详细说明

- 对比学习中使用的损失函数都具有类似的结构：它们都试图让正样本对的相似度得分高于负样本对，同时通过“边际值”或“温度参数”来控制模型调整的强度。下面我们来具体介绍这些损失函数。

### InfoNCE

- **InfoNCE**（噪声对比估计算法，van den Oord等人，2018年）是CLIP损失函数的理论基础。给定一个查询向量$q$、一个正样本键向量$k^+$以及$K$个负样本键向量$\{k_1^-, \ldots, k_K^-\}$，其损失函数为：

$$\mathcal{L}_{\text{InfoNCE}} = -\log \frac{\exp(q \cdot k^+ / \tau)}{\exp(q \cdot k^+ / \tau) + \sum_{j=1}^{K} \exp(q \cdot k_j^- / \tau)}$$

- 这实际上是一个$(K+1)$分类问题：从$K+1$个候选项中识别出正样本。InfoNCE实际上是查询向量与正样本键向量之间互信息的下界，因此最大化该值有助于使语义上相关的输入具有相似的表示形式。随着负样本数量$K$的增加，这一下界会变得更严格，这也解释了为什么对比学习方法能从较大的批次规模中受益。

### NT-Xent

- **NT-Xent**（归一化温度缩放交叉熵损失函数，Chen等人，2020年）是SimCLR（第8章文件04）中使用的损失函数，本质上是在批次内部对称应用InfoNCE算法的结果。对于包含$N$对数据的批次，$2N$个增强后的视图会为每个锚点生成$2N - 2$个负样本（即除自身及其正样本之外的所有视图）。正样本对$(i, j)$的损失函数为：

$$\ell_{i,j} = -\log \frac{\exp(\text{sim}(z_i, z_j) / \tau)}{\sum_{k=1}^{2N} \mathbf{1}_{[k \neq i]} \exp(\text{sim}(z_i, z_k) / \tau)}$$

- NT-Xent与InfoNCE的数学公式其实相同，只是因为它们出现在不同的研究背景中（自监督视觉任务与表示学习理论），所以名称有所不同。

### 温度参数的作用

- **温度参数**$\tau$是对比学习中最重要的超参数之一。从物理角度理解的话，高温环境下分子运动更为随机（softmax函数值较为平坦，所有负样本的权重差不多）；而低温环境下分子则形成稳定的结构（softmax函数值呈现峰值，只有那些最难处理的负样本才重要）。

- 从数学上来看，当$\tau \to 0$时，softmax函数会趋近于严格的argmax运算，只选择最难的那个负样本；而当$\tau \to \infty$时，所有负样本的贡献都会趋于相等。在实际应用中，对于归一化后的嵌入向量，$\tau \in [0.01, 0.1]$这个范围比较合适。温度过低会导致训练不稳定（因为难以处理的负样本会使梯度值变得非常大）；温度过高则会使损失函数对数据偏差的敏感度降低。

- CLIP初始设置$\tau = 0.07$，并且将其作为以对数形式表示的标量$\tau = \exp(t)$来优化，其中$t$值会随着模型权重的更新而通过梯度下降法进行调整。这样，模型就可以在训练过程中自动调整对比任务的难度。

![温度参数对对比学习中softmax分布的影响：低温下分布呈峰值状，集中在最难的负样本上；高温下分布则较为平坦](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/contrastive_temperature.svg)

### 三元组损失及基于边际值的替代方法

- 在InfoNCE成为主流之前，**三元组损失**曾是度量学习领域的标准方法。给定一个锚点$a$、一个正样本$p$以及一个负样本$n$，其损失函数为：

$$\mathcal{L}_{\text{triplet}} = \max(0, \|a - p\|^2 - \|a - n\|^2 + m)$$

- 其中$m$为边际值，用于确保正样本与锚点的距离至少比正样本与负样本的距离大$m$。三元组损失是针对单个三元组而非整个批次来计算的，因此其样本效率低于InfoNCE。此外，该算法还容易受到数据选取策略的影响：随机选择的负样本往往过于容易匹配（此时损失值为零），因此需要采用“困难负样本筛选”策略（选择距离最近的错误匹配项）或“半困难负样本筛选”策略（选择处于指定边际范围内的负样本）。

- InfoNCE则会在整个批次范围内自动进行困难负样本筛选，这也是它在大规模数据处理中能优于三元组损失的原因之一。InfoNCE中的softmax归一化机制会自动提升那些与锚点相似度较高的负样本的权重，从而无需额外筛选即可形成自然的训练流程。

## 图像-文本检索与零样本分类

- 一旦建立了训练好的联合嵌入空间，就可以实现**图像-文本检索**：给定一张图像查询，从数据库中找到最相关的文本（即图像到文本的检索）；或者给定一段文本查询，找到最相关的图像（即文本到图像的检索）。这实际上就是在共享的嵌入空间中进行最近邻搜索而已。
- 想象一下，有一位图书管理员，能够立即将任何一张照片与百万份目录中的任意描述进行比对。他无需事先了解所有可能的类别，只需衡量每张照片与每条描述的“相似程度”。CLIP风格的模型就是通过这种方式来实现检索和零样本分类的。

- **零样本分类**是文本到图像检索的一种特例。给定$K$个类别名称，可以构建文本提示$\{t_1, \ldots, t_K\}$（例如“一只猫的照片”、“一只狗的照片”），并对这些提示进行嵌入处理。对于新的图像$x$，其预测类别为：

$$\hat{y} = \arg\max_{k} \; \text{sim}(f_\theta(x), g_\phi(t_k))$$

- 关键在于，文本编码器实际上充当了一个灵活的分类器。无需为每个下游任务单独训练线性层，只需用自然语言描述任务即可。这也是CLIP具有强大泛化能力的原因：在预训练过程中，文本编码器已经接触过数百万种不同的描述方式。

- **提示工程**非常重要。仅通过将提示模板从“`{类别名称}`”改为“一张`{类别名称}`的照片”，CLIP在ImageNet上的零样本分类准确率就从63.2%提升到了68.4%。更为有效的方法是**提示集成**，即结合多个模板生成的文本嵌入结果（如“一张`{类别名称}`的照片”、“一张质量较好的`{类别名称}`的照片”、“一幅`{类别名称}`的画作”），从而得到更可靠的文本表示。

![零样本分类：每个类别的文本提示会与对应图像一起被嵌入，最终选择余弦相似度最高的类别](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/zero_shot_classification.svg)

## 视听对应关系

- 闭上眼睛，聆听有人投篮的声音。从有节奏的撞击声中，你可以判断出篮球何时击中地面。现在睁开眼睛：视觉上看到的篮球弹跳动作与声音中的撞击声完全同步。这种视听事件之间的紧密对应关系，正是机器可以学习的优质监督信号。**视听对应关系学习**旨在让模型在没有人类标签的情况下，将声音与其对应的视觉内容联系起来。

- 这一理念与CLIP极为相似，只不过是用音频替代了文本。给定成对的视频帧和音频片段，模型会学习到一个嵌入空间，在该空间中，时间上匹配的视听对之间的距离很近，而不匹配的对则距离较远。

- **视听嵌入（AVE）**方法（Arandjelovic和Zisserman，2017年）通过对比损失在视频数据上训练视觉编码器$f$和音频编码器$g$。正样本是对应同一时间的视频帧和音频片段，负样本则是来自不同视频或不同时间的音频片段。如此一来，模型无需任何标签就能学会：狗叫的声音与狗的图像相关，吉他声则与吉他的图像相关。

- 音频编码器通常使用CNN或音频变换器来处理**对数梅尔频谱图**（第9章文件01），从而生成固定大小的嵌入向量。视觉编码器则使用标准的图像处理架构（如ResNet、ViT）来处理视频帧。两者都会被映射到同一个$d$维空间中，训练时也采用与CLIP相同的InfoNCE损失函数：

$$\mathcal{L}_{\text{AV}} = -\log \frac{\exp(\text{sim}(z^{\text{vis}}, z^{\text{aud}}) / \tau)}{\sum_{k=1}^{N} \exp(\text{sim}(z^{\text{vis}}, z_k^{\text{aud}}) / \tau)}$$

![视听对应关系：视觉编码器处理视频帧，音频编码器处理频谱图，通过对比学习使时间上匹配的元素相互关联](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/audio_visual_correspondence.svg)

- **视听学习**的应用包括：声源定位（确定声音来自图像的哪个位置）、视听语音识别（将嘴唇动作与音频结合，详见第9章文件02）、视听源分离（通过观察人脸来分离不同说话者的声音，即第9章文件05中提到的“鸡尾酒会问题”），以及基于音频的视频生成。

- **ImageBind**（Girdhar等人，2023年）将这一技术扩展到了六种模态：图像、文本、音频、深度信息、热成像数据以及IMU数据。其核心思想是：并非每种组合都需要成对的数据。通过将每种模态与图像对应起来（文本通过图像-文本对对应，音频通过图像-音频对对应等），所有模态都能通过共享的图像嵌入空间实现隐式对齐。通过这种以图像为共同基准的“绑定”机制，音频和文本即便没有经过直接联合训练，也能变得相似。

## 评估

- 要评估多模态模型，就需要使用能够反映跨模态理解能力的指标。目前最常用的两种评估方法是**零样本基准测试**和**检索指标**。

### 零样本基准测试

- 零样本评估用于判断模型是否能够完成那些它从未被明确训练过的任务。最常见的基准测试是**ImageNet零样本准确率**：将ImageNet中的1,000个类别名称作为文本进行嵌入，再将每张测试图像进行嵌入，最后根据余弦相似度计算Top-1和Top-5分类准确率。CLIP ViT-L/14在零样本测试中的Top-1准确率为75.5%，这一成绩与在ImageNet上经过监督训练的ResNet-50相当。

- 其他零样本基准测试还包括CIFAR-10/100、STL-10、Food-101、Oxford Pets以及Flowers-102。通过在多种数据集上进行测试，可以判断模型究竟具备真正的通用视觉理解能力，还是仅仅记住了预训练数据中的模式而已。

- **线性探测**是一种补充性的评估方法。在这种方法中，先冻结预训练好的图像编码器，从带有标签的数据集中提取特征，然后再训练一个简单的线性分类器。这种方法可以独立于零样本检索机制，来评估模型所学习到的特征的质量。CLIP学到的特征是非常出色的线性探测特征，其性能往往可与经过监督训练的特征相媲美，甚至更优。

### 检索指标

- 对于检索任务（图像到文本和文本到图像），常用的评估指标是**Recall@K**（R@K）：即在Top K个检索结果中包含正确匹配项的查询比例。常见的取值为R@1、R@5和R@10。

- 从形式上来看，对于一组$Q$个查询：

$$\text{R@}K = \frac{1}{Q} \sum_{q=1}^{Q} \mathbf{1}[\text{rank}(q) \leq K]$$

- 其中$\text{rank}(q)$表示查询$q$在排序后的检索结果中的正确匹配项的位置。

- 常用的检索基准数据集包括**Flickr30K**（31,000张图片，每张配有5条描述）和**MS-COCO**（123,000张图片，每张配有5条描述）。评估时，会给定一张图片，要求从全部测试数据中找出正确的描述；反之亦然。

- **中位数排名**（MedR）是另一个重要的评估指标：它表示所有查询中正确匹配项的中位位置。完美的模型应具有MedR=1的值，数值越低越好。

- 除了检索功能外，多模态模型还会在诸如**Winoground**（用于测试模型能否区分“狗里的杯子”与“杯子里的狗”）以及**ARO**（属性、关系、顺序）这样的组合理解基准上接受评估，这些测试旨在判断模型是否真正理解了语言的结构，而不仅仅是进行简单的词袋匹配。CLIP风格的模型在这些任务上往往表现不佳，这暴露出了一个根本性的局限：对比学习虽然能够对全局语义进行对齐，但可能无法捕捉到细粒度的组合结构。

![检索评估：给定一张查询图片，模型会根据相似度对所有文本候选项进行排序，Recall@K则用于衡量正确描述是否出现在Top K个结果中](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/retrieval_recall_at_k.svg)

## 总结

- 本文件中介绍的多模态表示是本章后续内容的基础。CLIP及其后续版本所训练出的联合嵌入空间，起到了连接视觉与语言的作用。文件02在这一基础上进一步发展出了能够生成图片相关文本的视觉-语言模型。文件03探讨了如何将图片和视频转换为序列模型可使用的格式。文件04涉及跨模态生成任务（文本到图像、文本到视频）。而文件05则研究了能够在单一模型中处理多种模态的统一架构。

- 核心要点在于：通过对配对数据进行对比学习，可以创建出不同模态之间可以相互转换的嵌入空间。图像嵌入和文本嵌入因此变成了“同一类事物”，从而实现了零样本分类、检索功能，以及与更大系统的无缝集成。这个方法的思路非常简单——只需将匹配的元素放在一起，将不匹配的元素分开——但其效果却极为出色。

## 编程任务（可使用CoLab或笔记本）

1. 从零开始实现CLIP的对比损失函数。生成随机的图像嵌入和文本嵌入，计算相似度矩阵，进而求出对称交叉熵损失值。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def clip_loss(image_embeds, text_embeds, temperature=0.07):
    """Compute symmetric CLIP contrastive loss."""
    # L2 normalise embeddings
    image_embeds = image_embeds / jnp.linalg.norm(image_embeds, axis=1, keepdims=True)
    text_embeds = text_embeds / jnp.linalg.norm(text_embeds, axis=1, keepdims=True)

    # Compute cosine similarity matrix (N x N)
    logits = image_embeds @ text_embeds.T / temperature  # (N, N)

    # Labels: the diagonal (i-th image matches i-th text)
    N = logits.shape[0]
    labels = jnp.arange(N)

    # Symmetric cross-entropy: image-to-text + text-to-image
    loss_i2t = -jnp.mean(jax.nn.log_softmax(logits, axis=1)[jnp.arange(N), labels])
    loss_t2i = -jnp.mean(jax.nn.log_softmax(logits, axis=0)[labels, jnp.arange(N)])
    return (loss_i2t + loss_t2i) / 2, logits * temperature

# Simulate a batch of 8 image-text pairs in 64-dim space
key = jax.random.PRNGKey(42)
k1, k2 = jax.random.split(key)
N, D = 8, 64
image_embeds = jax.random.normal(k1, (N, D))
text_embeds = jax.random.normal(k2, (N, D))

loss, sim_matrix = clip_loss(image_embeds, text_embeds)
print(f"CLIP loss (random embeddings): {loss:.4f}")

# Visualise the similarity matrix
fig, ax = plt.subplots(figsize=(6, 5))
im = ax.imshow(sim_matrix, cmap='coolwarm', vmin=-1, vmax=1)
ax.set_xlabel("Text index"); ax.set_ylabel("Image index")
ax.set_title(f"Cosine Similarity Matrix (loss={loss:.3f})")
plt.colorbar(im); plt.tight_layout(); plt.show()
# Try changing temperature (0.01, 0.1, 1.0) and observe how loss changes
# Try making matched pairs similar: set text_embeds = image_embeds + small noise
```

1. 构建一个简单的关节嵌入模型，该模型利用InfoNCE损失函数和梯度下降算法，学习将2D“图像”（随机向量）与“标签”（其他随机向量）进行对应关联。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def info_nce_loss(img_enc, txt_enc, img_data, txt_data, tau=0.1):
    """InfoNCE over a batch of paired (image, text) data."""
    z_img = img_data @ img_enc  # (N, D)
    z_txt = txt_data @ txt_enc  # (N, D)
    # L2 normalise
    z_img = z_img / jnp.linalg.norm(z_img, axis=1, keepdims=True)
    z_txt = z_txt / jnp.linalg.norm(z_txt, axis=1, keepdims=True)
    logits = z_img @ z_txt.T / tau
    labels = jnp.arange(logits.shape[0])
    return -jnp.mean(jax.nn.log_softmax(logits, axis=1)[jnp.arange(len(labels)), labels])

# Create 32 paired samples: img in R^8, txt in R^6, embed into R^4
key = jax.random.PRNGKey(0)
k1, k2, k3, k4 = jax.random.split(key, 4)
N, d_img, d_txt, d_embed = 32, 8, 6, 4

img_data = jax.random.normal(k1, (N, d_img))
txt_data = jax.random.normal(k2, (N, d_txt))

# Learnable projection matrices
img_enc = jax.random.normal(k3, (d_img, d_embed)) * 0.1
txt_enc = jax.random.normal(k4, (d_txt, d_embed)) * 0.1

grad_fn = jax.jit(jax.grad(info_nce_loss, argnums=(0, 1)))
lr = 0.05
losses = []

for step in range(300):
    loss = info_nce_loss(img_enc, txt_enc, img_data, txt_data)
    losses.append(float(loss))
    g_img, g_txt = grad_fn(img_enc, txt_enc, img_data, txt_data)
    img_enc = img_enc - lr * g_img
    txt_enc = txt_enc - lr * g_txt

print(f"Initial loss: {losses[0]:.3f}, Final loss: {losses[-1]:.3f}")
print(f"Random baseline (log N): {jnp.log(N):.3f}")

plt.figure(figsize=(8, 4))
plt.plot(losses, color='#2c3e50')
plt.axhline(y=0, color='green', linestyle='--', alpha=0.5, label='Perfect alignment')
plt.axhline(y=float(jnp.log(N)), color='red', linestyle='--', alpha=0.5, label='Random (log N)')
plt.xlabel("Step"); plt.ylabel("InfoNCE Loss")
plt.title("Learning a Joint Embedding Space")
plt.legend(); plt.grid(alpha=0.3); plt.tight_layout(); plt.show()
# Modify d_embed (try 2, 4, 16) to see how embedding dimension affects alignment
```

1. 利用预计算好的嵌入向量实现零样本分类。将各类“原型”表示为文本嵌入，再通过最近邻搜索对新图像进行分类。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Simulate 5 classes, each with a prototype text embedding in R^32
key = jax.random.PRNGKey(42)
n_classes, d = 5, 32
class_names = ["cat", "dog", "car", "plane", "ship"]

# Class prototypes (imagine these came from a text encoder)
k1, k2 = jax.random.split(key)
class_prototypes = jax.random.normal(k1, (n_classes, d))
class_prototypes = class_prototypes / jnp.linalg.norm(class_prototypes, axis=1, keepdims=True)

# Generate 200 test "images" (embeddings near their class prototype + noise)
n_per_class = 40
true_labels = jnp.repeat(jnp.arange(n_classes), n_per_class)
keys = jax.random.split(k2, n_classes * n_per_class)

image_embeds = []
for i in range(n_classes):
    noise = jax.random.normal(keys[i], (n_per_class, d)) * 0.5
    cluster = class_prototypes[i] + noise
    image_embeds.append(cluster)
image_embeds = jnp.concatenate(image_embeds, axis=0)
image_embeds = image_embeds / jnp.linalg.norm(image_embeds, axis=1, keepdims=True)

# Zero-shot classification: cosine similarity with each prototype
similarities = image_embeds @ class_prototypes.T  # (200, 5)
predicted_labels = jnp.argmax(similarities, axis=1)
accuracy = jnp.mean(predicted_labels == true_labels)
print(f"Zero-shot accuracy: {accuracy:.1%}")

# Confusion matrix
conf = jnp.zeros((n_classes, n_classes), dtype=jnp.int32)
for true, pred in zip(true_labels, predicted_labels):
    conf = conf.at[true, pred].add(1)

fig, ax = plt.subplots(figsize=(6, 5))
im = ax.imshow(conf, cmap='Blues')
ax.set_xticks(range(n_classes)); ax.set_xticklabels(class_names, rotation=45)
ax.set_yticks(range(n_classes)); ax.set_yticklabels(class_names)
ax.set_xlabel("Predicted"); ax.set_ylabel("True")
for i in range(n_classes):
    for j in range(n_classes):
        ax.text(j, i, int(conf[i, j]), ha='center', va='center', fontsize=11)
ax.set_title(f"Zero-Shot Confusion Matrix (acc={accuracy:.1%})")
plt.colorbar(im); plt.tight_layout(); plt.show()
# Try increasing noise (0.5 -> 1.0 -> 2.0) to see accuracy degrade
# Try adding prompt ensembling: average 3 noisy copies of each prototype
```

## 视觉语言模型

_视觉语言模型能够同时理解图像与文本，从而实现视觉问答、图像描述以及视觉推理功能。本文件涵盖了视觉问答、图像描述、视觉关联任务，以及那些将视觉编码器与大型语言模型相结合的架构，如VisualBERT、BLIP、LLaVA、Flamingo、PaLI和Qwen-VL。_

- 想象一下博物馆导览员：他可以看着一幅画，详细描述其中的内容——有哪些物体、讲述着怎样的故事、传达了何种情感，还能回答游客提出的各种问题。**视觉语言模型（VLM）**就是这样的计算系统——它能够同时理解图像与文本，进而描述视觉场景、回答相关问题、执行视觉指令，甚至根据自然语言查询在图像中定位特定物体。

- VLM处于第8章中提到的视觉编码器与第7章中的语言模型之间的交叉点上。其核心技术挑战在于如何将两种截然不同的表示方式结合起来：视觉模型的空间连续特征图与语言模型的序列离散令牌嵌入。本文件中介绍的每种架构，本质上都是对“如何融合视觉信息与语言信息”这一问题的不同解答。

![高级视觉语言模型分类结构图，展示了双编码器型、融合编码器型以及编码器-解码器型架构及其输入输出](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vlm_taxonomy.svg)

## 视觉问答

- 假设有人给你一张照片，然后问：“公园里有多少只狗？”你可以轻松地解析图像、找到那些狗、数出它们的数量，然后给出答案。**视觉问答（VQA）**就是对这一过程的标准化表述：给定一张图像$I$和一个自然语言问题$q$，需要预测出答案$a$。

- 这一任务有多种表述方式。最常见的做法是将VQA视为**开放式分类任务**：模型从预定义的常见答案词汇表中选择最合适的答案（例如VQA v2版本中的前3,129个答案）。另一种做法则是将其视为**生成式回答任务**，模型会生成一段自由形式的文本——这也是现代VLM所采用的方法。

- 从形式上来看，我们需要学习一个函数$f(I, q) \to a$，使得正确答案的出现概率最大化。在分类框架下，该函数可表示为：

$$p(a \mid I, q) = \text{softmax}(W \cdot g(v, h))$$

其中$v$是来自CNN或ViT的视觉特征向量，$h$是来自LSTM或Transformer的问题编码，而$g$则是用于结合这两者信息的融合函数。$g$的设计正是体现架构创新性的关键所在。

- **VQA v1**（Antol等人，2015年）提出了基于MS COCO数据集的测试基准，包含204,000张图片和614,000个问题。研究人员很快发现，模型可以利用**语言先验知识**来获得极高的准确率——对于“有多少”的问题，直接回答“2”；对于“是否存在”的问题，则直接回答“是”，而无需查看图像内容。

- **VQA v2**（Goyal等人，2017年）针对这一问题，为每个问题配对两张相似但答案不同的图片。这样一来，模型就不得不以图像内容作为推理的基础。这种配对方式使得数据集规模几乎翻倍，也大大降低了仅依赖语言知识的解决方案的有效性。

- 其他重要的VQA数据集还包括**GQA**（Hudson & Manning，2019年），这类数据集包含需要多步推理的复合型问题；**OK-VQA**（Marino等人，2019年），这类问题需要利用图像之外的外部知识；还有**TextVQA**（Singh等人，2019年），其答案取决于对图像中文字内容的理解。

![VQA处理流程：图像通过视觉编码器处理，问题通过文本编码器处理，两者的表示结果被融合后，再被分类为对应的答案](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vqa_pipeline.svg)

- 早期的VQA模型采用了一种简单的策略：从预训练的CNN中提取图像特征（通常是第8章中提到的ResNet或VGGNet的倒数第二层），用LSTM对问题进行编码（第6章内容），然后将两者结合。用于融合的函数$g$也经历了快速发展：从简单的逐元素相乘，发展到双线性池化，再到多模态Tucker分解。**双线性注意力机制**的计算公式为$v^T W h$，其中$W$是一个可学习的交互矩阵，但完整的双线性形式拥有$O(d_v \times d_h)$个参数，数量实在庞大。**MLB**（多模态低秩双线性池化）则将这一过程分解为两个低秩投影，从而使其更易于处理。

- VQA领域的突破性进展在于注意力机制。**堆叠注意力网络**（Yang等人，2016年）利用问题编码来引导模型关注图像中的特定区域，从而逐步确定需要重点分析的图像部分。这一理念——让问题“聚焦”于相关的图像区域——后来成为了标准做法。

## 图像描述

- 想象一下，你的朋友正在观看你的度假照片，并为你描述所看到的场景：“在阳光明媚的海滩上，有一只金毛猎犬正在接飞盘。”**图像描述**的任务就是为图像生成自然语言描述。与VQA不同，这里没有问题存在——模型必须自行决定哪些内容值得描述。

- **Show and Tell**（Vinyals等人，2015年）提出了用于图像描述的经典编码器-解码器架构。首先，CNN编码器（如Inception或ResNet）会生成一个图像特征向量$v$。这个向量会被用作LSTM解码器的初始隐藏状态，解码器随后会通过自回归方式逐词生成描述文本：

$$p(w_t \mid w_{1:t-1}, I) = \text{LSTM}(w_{t-1}, h_{t-1})$$

整个模型通过最大化真实描述文本的对数似然值来进行端到端训练。在推理阶段，则使用束搜索（第7章内容）来找出概率较高的描述结果。

- **Show and Tell**方法的缺点在于，整个图像会被压缩成一个单一的向量。对于复杂的场景来说，一个向量无法涵盖所有相关细节。这样一来，模型的空间信息就会被丢失——在生成不同描述词时，模型无法“回溯”到图像的特定区域。
- **Show, Attend and Tell**（Xu等人，2015年）通过引入**对图像区域的注意力机制**来解决这一问题。该模型不会将图像编码为一个向量，而是生成一个空间特征网格（例如，VGGNet的最后一个卷积层会输出$14 \times 14 \times 512$尺寸的特征网格）。在每个解码步骤中，模型会为这些空间位置计算注意力权重，从而得到一个能够突出当前单词相关区域的上下文向量。

- 回想一下第6章中介绍的注意力机制：解码器的隐藏状态充当“查询项”，空间特征则充当“键”和“值”，而注意力权重则告诉模型应该关注哪个区域。研究者提出了两种变体：**软注意力**（对所有区域进行可微分的加权平均）和**硬注意力**（随机选择某个区域，并通过REINFORCE算法进行训练）。

![基于注意力的字幕生成：在每个解码步骤中，模型都会关注图像中的不同区域，生成“狗”这个单词时，它会聚焦在狗所在的区域](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/attention_captioning.svg)

- 这些模型生成的注意力图具有很强的可解释性：在生成“狗”这个词时，注意力会集中在狗所在的区域；而在生成“海滩”时，注意力则会转移到沙滩和水域上。这是最早证明注意力机制具备内在可解释性的案例之一。

- **CIDEr**（Vedantam等人，2015年）、**METEOR**、**BLEU**和**SPICE**是用于评估字幕生成质量的标准指标。CIDEr通过计算生成的字幕与参考字幕之间的TF-IDF加权n-gram相似度来评估性能，专为字幕生成任务设计。现代视觉语言模型通常会使用CIDEr来评估MS COCO Captions和NoCaps等基准数据集上的表现。

- 后来的字幕生成模型还引入了**自下而上的注意力机制**（Anderson等人，2018年）。在这种机制中，物体检测器（如第8章中提到的Faster R-CNN）首先识别出图像中的关键区域，然后字幕生成模型会针对这些区域特征而非均匀分布的网格来生成字幕。在基于ViT的编码器出现之前，这种方法是主流方案。

## 架构模式

- 每个视觉语言模型都必须回答一个核心设计问题：视觉信息与语言信息应在何时发生交互？答案决定了模型的架构类型。目前主要有三种架构模式，每种模式都有其各自的优缺点。

### 双编码器架构

- 想象有两个独立工作的翻译员——一个负责阅读法语文档，另一个负责阅读英语文档——他们各自用一种通用的“语言”来撰写摘要。他们在翻译过程中不会互相交流，但他们的摘要是可以直接比较的。这就是**双编码器架构**。

- 视觉编码器$f_v$和文本编码器$f_t$分别将各自的输入映射到维度为$d$的共享嵌入空间中。图像的嵌入向量为$v = f_v(I) \in \mathbb{R}^d$，文本的嵌入向量为$t = f_t(q) \in \mathbb{R}^d$。两者之间的相似度可以通过点积或余弦相似度来计算：$\text{sim}(I, q) = v^T t / (\|v\| \|t\|)$。

- CLIP（Radford等人，2021年）就是典型的双编码器架构。它是在从互联网上收集的4亿对图像-文本数据上，通过对比学习目标（InfoNCE）进行训练的。由于两个编码器是独立的，因此可以预先计算并缓存所有的图像嵌入向量，从而极大提升检索效率——在搜索时只需对查询文本进行编码即可。

- 双编码器架构的缺点在于，视觉信息和语言信息在特征层面永远不会发生交互。因此，该模型无法进行精细的跨模态推理，例如无法确定字幕中的某个单词是否对应图像中的某个特定区域。这限制了它在视觉问答或基于图像的字幕生成等任务中的应用。

### 融合编码器架构

- 现在想象这两个翻译员在同一个房间里，共同讨论这两份文档。他们可以指着具体的段落互相提问，从而形成对内容的共同理解。这就是**融合编码器架构**。

- 两种模态的信息会被分别编码，然后通过**交叉注意力层**进行融合——即一种模态的令牌会关注另一种模态的令牌。图像首先由视觉编码器处理成一系列块或区域令牌$V = [v_1, \ldots, v_N]$，文本则被分解为$T = [t_1, \ldots, t_M]$个令牌。在融合层中，文本令牌会通过交叉注意力机制关注图像令牌：

$$\text{CrossAttn}(T, V) = \text{softmax}\!\left(\frac{(TW_Q)(VW_K)^T}{\sqrt{d_k}}\right)(VW_V)$$

- 这种方式可以实现精细的交互：每个文本令牌都可以关注它所需要的特定图像区域。**VisualBERT**、**VilBERT**和**UNITER**等模型都采用了这种架构。不过，这种架构的缺点是无法预先计算独立的嵌入向量以用于检索——每对图像-文本数据都需要经过完整的融合层处理。

![双编码器架构与融合编码器架构的对比：双编码器架构会分别生成嵌入向量并计算相似度，而融合编码器架构则通过交叉注意力层将两种模态的信息融合在一起](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/dual_vs_fusion_encoder.svg)

### 编码器-解码器架构

- **编码器-解码器架构**将视觉编码器与文本解码器结合在一起，文本解码器以自回归的方式生成输出令牌，这一机制与第7章中介绍的seq2seq模型类似。视觉编码器负责生成具有上下文意义的图像表示，而文本解码器则在生成文本时通过交叉注意力机制与这些图像表示进行交互。

- 这种架构非常适合用于生成型任务，比如字幕生成、支持自由形式答案的视觉问答以及视觉对话系统。**GIT**（生成式图像到文本变换器，Wang等人，2022年）、**CoCa**（对比式字幕生成器，Yu等人，2022年）和**PaLI**等模型都采用了这种架构。CoCa巧妙地结合了双编码器架构和编码器-解码器架构：文本解码器的前半部分作为单模态文本编码器，用于对比学习；后半部分则通过交叉注意力机制关注图像特征，从而实现最佳的效果。
- 这三种架构的选择取决于具体的任务需求。对于大规模检索任务而言，双编码器是最优选择；在需要精细理解的任务中，融合编码器更为合适；而对于生成类任务来说，编码器-解码器架构则具有最大的灵活性。目前最先进的视觉语言模型越来越多地采用编码器-解码器或仅解码器的架构，将各类视觉语言任务视为文本生成任务来处理。

## Flamingo：少样本多模态学习

- 想象一下那些经过多年艺术与文学研究的专家——他们只需看到一两幅新风格的画作，就能对其做出精准的描述。**Flamingo**（Alonso等人，2022年，DeepMind团队开发）也是基于同样的原理：它利用强大的预训练语言模型和预训练视觉编码器，并通过轻量级的结构组件将二者连接起来，从而实现多模态任务上的少样本学习。

- Flamingo的设计理念十分稳健且高效：它保持预训练的视觉编码器（NFNet）和语言模型（Chinchilla）不变，只学习用于连接二者的“桥梁”结构。这个桥梁由两个部分组成：**感知重采样器**和**带门控的交叉注意力层**。

- **感知重采样器**负责将视觉编码器输出的、长度不固定的特征（该长度取决于图像分辨率）压缩为固定数量的$N$个视觉令牌（通常$N=64$）。其工作方式是先初始化一组$N$个可学习的查询向量，再通过交叉注意力机制让这些查询向量能够关注到视觉编码器输出的所有特征。这实际上就是将Jaegle等人（2021年）提出的感知架构作为瓶颈结构来使用——无论输入图像的大小如何，它都能生成固定大小的紧凑视觉表示。

$$z = \text{CrossAttn}(Q_{\text{learned}}, V_{\text{image}}) \in \mathbb{R}^{N \times d}$$

- **带门控的交叉注意力层**则被嵌入在那些保持不变的语言模型层之间。在每一层中，语言模型中的文本令牌会与感知重采样器生成的视觉令牌进行交叉注意力交互。关键在于，每个带门控的交叉注意力层都包含一个可学习的标量门控参数$\alpha$，该参数初始值为零，它会在将交叉注意力输出加入残差流之前对其进行缩放：

$$\hat{x} = x + \alpha \cdot \text{CrossAttn}(x, z)$$

- 由于将$\alpha$初始化为0，因此在训练开始时，交叉注意力机制不会产生任何影响，模型的行为就与原来的冻结语言模型完全相同。在训练过程中，这些门控参数会逐渐打开，从而平滑地将视觉信息整合进来，同时不会破坏语言模型原有的预训练特征。

![Flamingo架构图：冻结的视觉编码器将数据输入感知重采样器，后者生成固定长度的视觉令牌，这些令牌再通过嵌入在语言模型层之间的带门控的交叉注意力层被输入到语言模型中](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/flamingo_architecture.svg)

- Flamingo能够直接处理**交错排列的图像-文本序列**。你可以向它提供包含多张图片及相应文本的提示，例如：“[图片1] 这是一只猫。[图片2] 这是一只狗。[图片3] 这是一只___。”模型会通过视觉编码器和感知重采样器处理每张图片，得到的视觉令牌会被插入到文本序列中的对应位置。语言模型中的因果注意力机制确保每个文本令牌只能关注当前图像以及之前图像中的视觉令牌。

- 这种交错结构使得**少样本多模态学习**成为可能。只需提供少量图像-文本示例，Flamingo就能在不进行梯度更新的情况下完成新任务。在VQAv2、OK-VQA以及图像描述等基准测试中，拥有800亿参数的Flamingo取得了最先进的少样本学习性能，其表现往往可与仅使用4个或32个示例经过微调的专业模型相媲美，甚至更优。

## LLaVA与视觉指令调优

- 想象一下，你有一个出色的语言专家（即大型语言模型），还有一个出色的艺术评论家（即视觉编码器）。如果能让这位艺术评论家“说上语言专家的语言”，那么他们就能无缝协作。**LLaVA**（大型语言与视觉助手，Liu等人，2023年开发）正是实现了这一点：它通过一个简单的线性层将视觉特征映射到大型语言模型的令牌嵌入空间中，然后利用指令遵循数据对整个系统进行微调。

- LLaVA的架构极为简单。一张图像首先由预训练的CLIP ViT-L/14视觉编码器编码为由$N$个补丁特征组成的矩阵$V \in \mathbb{R}^{N \times d_v}$，其中$N=256$，意味着336像素的图像会被分割为14像素大小的补丁。随后，一个**投影层**$W$将这些视觉特征映射到大型语言模型的嵌入维度中：

$$H_v = VW, \quad W \in \mathbb{R}^{d_v \times d_{\text{LLM}}}$$

- 被投影后的视觉令牌$H_v$会直接与文本令牌的嵌入值拼接在一起，作为一个整体序列输入到大型语言模型中（此处使用的模型为经过微调的LLaMA衍生模型Vicuna）。大型语言模型会使用其标准的因果自注意力机制来处理这些序列——无需特殊的交叉注意力层，也无需额外的感知模块，仅需简单的拼接操作。这些视觉令牌被视为本质上等同于编码了视觉信息的文本令牌。

![LLaVA架构图：CLIP ViT将图像编码为补丁特征，线性投影层将这些特征映射到大型语言模型的嵌入空间，之后这些投影后的视觉令牌会被添加到文本令牌之前，共同输入到大型语言模型中](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/llava_architecture.svg)

- **视觉指令调优**是LLaVA在训练方面的核心创新点。研究人员利用GPT-4基于COCO图像集生成了158,000个多模态指令遵循示例。每个示例都包含一张图像以及相应的对话式指令，例如“请详细描述这张图片”、“这张图片有什么特别之处？”、“如果我是一名游客来到这里，我应该了解些什么？”。模型被训练成能够根据给定的图像和指令，生成由GPT-4所写的回复内容。
- 训练分为两个阶段进行。**第一阶段（预训练）**：仅对投影层$W$使用图像-文本描述对（来自CC3M的595K对数据）进行训练，而视觉编码器和大型语言模型则保持不变。这一过程旨在让$W$学会将视觉特征与大型语言模型的嵌入空间对齐。**第二阶段（微调）**：在指令遵循数据上同时对投影层和大型语言模型进行微调，视觉编码器仍保持不变。这样就能让模型学会执行复杂的视觉指令。

- **LLaVA-1.5**通过三项关键改进提升了原有模型的性能：用两层多层感知机替代单一线性投影层（从而实现更高效的特征映射），使用更高分辨率的图像（从224像素变为336像素，进而生成更多特征Token），并在训练数据中加入学术领域的视觉问答数据集。这些看似微小的改动却使该模型在各项基准测试中的表现有了显著提升。

- LLaVA的方法表明，无需像Flamingo模型中所使用的那种复杂的架构设计，比如感知器重采样器或门控交叉注意力机制。只需一个简单的线性投影层，再结合高质量的指令训练数据，就足以有效地将视觉编码器与大型语言模型连接起来。正是这种简洁性使得LLaVA具有极大的影响力——此后大多数开源视觉语言模型都采用了类似的架构设计。

## 视觉语言模型的扩展方案

- 该领域的发展速度极快，从概念验证阶段的视觉语言模型，迅速发展到基于数十亿图像-文本对数据进行训练的工业级系统。有三种不同的模型架构代表了不同的扩展思路。

### PaLI

- **PaLI**（路径语言与图像模型，陈等人，2022年，谷歌开发）同时对视觉编码器和语言模型进行扩展。PaLI采用ViT-e（40亿参数）作为视觉编码器，mT5（130亿参数）作为语言模型，总参数量为170亿。图像会被编码成一串特征Token，这些Token会与文本Token一起被输入到mT5的编解码器中。

- PaLI的核心理念是：**扩展视觉编码器的规模与扩展语言模型的规模同样重要**。以往的研究通常使用固定大小、参数量适中的视觉编码器（如ViT-B或ViT-L），并将所有参数资源都投入到语言模型中。PaLI则证明，经过JFT-4B（40亿张带标签的图像）预训练的40亿参数ViT-e模型，能够在OCR和空间推理等对细节要求较高的视觉任务中大幅提升性能。

- PaLI是在WebLI数据集上训练的，该数据集包含109种语言的100亿组图像-文本对，因此该模型具备天然的多语言处理能力。模型通过多种任务进行预训练，包括图像描述、视觉问答以及图像-文本匹配，所有任务都被视为文本到文本的生成任务（遵循第7章中介绍的T5架构）。后续推出的**PaLI-X**（550亿参数）和**PaLI-3**（50亿参数，采用SigLIP作为视觉编码器）则是该模型的进一步改进版本。

### Qwen-VL

- **Qwen-VL**（白等人，2023年，阿里巴巴开发）在Qwen大型语言模型的基础上，增加了ViT视觉编码器以及一层交叉注意力模块（类似于Flamingo模型中的感知器重采样器），该模块可将视觉编码器的输出压缩为256个固定的视觉Token。这些视觉Token会与文本Token拼接在一起，然后由Qwen大型语言模型进行处理。

- Qwen-VL的训练采用三阶段流程。第一阶段：在14亿组弱监督的图像-文本对数据上进行预训练，此时只有视觉编码器是可调整的。第二阶段：在包含视觉问答、图像描述、实体关联和OCR等任务的更高质量数据上进行多任务预训练，此时整个模型都可以进行调整。第三阶段：在指令遵循和对话数据上进行监督式微调。从含噪声的网页数据逐步过渡到经过精心筛选的指令数据，这是大多数现代视觉语言模型所采用的共同训练策略。

- **Qwen2-VL**（2024年发布）引入了**动态分辨率处理**功能：它不会将所有图像都调整为固定尺寸，而是通过动态调整视觉Token的数量，来按原始分辨率处理图像。高分辨率图像会产生更多的Token，而低分辨率图像则产生的Token较少。这样一来，无需在低分辨率图像上浪费计算资源，就能提升文档理解及精细识别等对细节要求较高的任务的性能。

### InternVL

- **InternVL**（陈等人，2024年，上海人工智能实验室开发）对视觉编码器进行了大规模扩展，采用了拥有60亿参数的InternViT-6B视觉变换器，再将其与语言模型相结合。该模型的一项重要架构创新在于**动态高分辨率处理**：图像会被分割成448×448像素的小块，每个小块由视觉编码器独立处理，处理后的特征会与整幅图像的缩略图特征拼接在一起。这样一来，该模型就能够处理任意纵横比和分辨率的图像。

- InternVL-2还引入了**渐进式对齐训练**策略：首先通过对比学习目标（如CLIP）让视觉编码器对齐，然后通过一个轻量的多层感知机连接器将其与语言模型连接起来，最后在指令数据上进行端到端的微调。这种渐进式的训练方式能够有效避免视觉编码器丢失其预训练得到的特征信息。

![视觉语言模型的扩展方案：PaLI、Qwen-VL和InternVL的对比，展示了不同模型连接视觉编码器与语言模型的方法，以及各自的训练流程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/scaling_vlms_comparison.svg)

- 这三种模型都有一个共同的特点，那就是**训练数据筛选的重要性**。从网上抓取的原始图像-文本对数据往往存在噪声，且特征对齐情况也不理想。通过逐阶段的训练，可以逐步过滤和优化数据，将数十亿组含噪声的数据转化为数百万组高质量的任务示例。最终用于微调的数据质量，往往比模型的原始参数数量更为重要。

## 实体关联与指代理解

- 想象一下，你指着人群中的某个人说“戴红帽子的女人”。这里就是用语言来指代某个特定的空间位置。而**视觉定位**则是相反的过程：给定一张图片和一段自然语言描述，模型需要识别出被指代的对象所在的位置。**指代表达理解**会生成一个边界框，而**指代表达分割**则会产生像素级掩码。

- 从形式上讲，给定一张图像$I$以及一段指代表达$r$（例如“左边那只棕色的大狗”），模型会预测出一个边界框$b = (x, y, w, h)$，或者一组用于确定被指代对象位置的坐标。相关的数据集包括**RefCOCO**、**RefCOCO+**和**RefCOCOg**，这些数据集中都包含有多个对象的图片，以及针对每个对象的明确指代表达。

- 早期的定位模型采用两阶段处理方式：首先通过Faster R-CNN之类的算法生成候选区域，然后利用融合模型将这些候选区域与语言查询进行匹配，得分最高的区域即为最终结果。不过这种方法的计算成本较高，且其效果还取决于候选区域的质量。

- 现代的视觉语言模型则将定位功能直接整合到生成框架中。其核心思路是将边界框坐标表示为**文本令牌**。人们会将连续的坐标空间划分为多个区间（例如$x, y, w, h$每个方向各分为1000个区间），并在词汇表中加入类似〈loc_342〉这样的特殊位置令牌。模型通过输出一系列位置令牌来生成边界框：

$$\text{输出：} \texttt{<loc\_102><loc\_215><loc\_487><loc\_398>}$$

- 这种令牌化方法使得任何自回归语言模型都无需进行架构上的修改即可实现定位功能——模型只需学会“用文字表达坐标”即可。**Pix2Seq**（Chen等人，2022年）首次将这种方法应用于物体检测，而Qwen-VL、Ferret和Kosmos-2等模型则进一步将其扩展到了指代表达理解和短语定位领域。

- **Kosmos-2**（Peng等人，2023年，微软开发）通过将空间位置表示为嵌入在生成文本中的特殊令牌，为多模态大型语言模型增加了定位功能。例如，它能够生成如下内容：“一只〈phrase〉金毛猎犬`</phrase>`位于〈box〉〈loc_102〉〈loc_215〉〈loc_487〉〈loc_398〉`</box〉处，正在捕捉飞盘。”这种文本令牌与空间令牌的结合使得同时进行文本描述和位置定位成为可能。

![通过坐标令牌实现定位：模型生成的文本令牌中穿插着离散化的边界框坐标令牌，从而确定文本中提到的物体的位置](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/grounding_coordinate_tokens.svg)

- **点定位**则将定位功能进一步细化：模型不再生成边界框，而是预测一个点（通常是被指代对象的中心点）。这对于那些需要交互式响应的应用非常有用，比如用户询问“最近的出口在哪里？”，模型就可以在图片上标出对应的坐标。**Shikra**和**Ferret**等模型除了支持基于边界框的定位外，还支持基于点的定位方式。

## 无需OCR的文档理解

- 传统的文档理解流程相当复杂：首先使用OCR引擎提取文本和布局信息，然后再将提取出的文本输入到语言模型中。这种多阶段处理方式存在诸多缺陷——OCR错误会影响到后续处理，而且空间布局信息往往会被丢失或无法准确呈现。如果模型能够像人类一样直接从像素中读取信息，那该多好？

- **Donut**（文档理解变换器，Kim等人，2022年）完全摒弃了OCR技术。它使用Swin Transformer（第8章已介绍）作为视觉编码器来处理文档图片，同时使用类似BART的Transformer解码器直接从视觉特征中生成结构化文本输出。根据任务的不同，解码器可以生成JSON格式的数据、键值对或纯文本。

- Donut的训练分为两个阶段。**预训练阶段**：模型通过模拟OCR过程来学习阅读技能——给定一张文档图片，模型会生成完整的文本内容。这一阶段是在数百万张从文本语料库生成的合成文档图片上进行的，旨在让视觉编码器学会识别字符、字体和布局结构。**微调阶段**：模型通过训练来适应特定的下游任务，比如收据解析、表格理解或文档分类，从而能够生成与任务相关的结构化输出。

- Donut的解码器采用了特殊的提示机制：任务类型通过提示令牌来指定（例如，用于分类的令牌是〈doc_class〉，用于收据解析的令牌是〈parse_receipt〉），模型会根据这些提示来生成输出。这种统一的接口使得同一个模型就能处理多种文档理解任务。

- **Pix2Struct**（Lee等人，2023年，谷歌开发）则将无需OCR的理念应用到了网页理解和图表分析领域。其预训练的主要目标是**截图解析**：给定一张经过遮蔽处理的网页截图，模型能够生成生成该可见区域的原始HTML代码。这有助于模型理解视觉呈现与结构化标记之间的关系。

- Pix2Struct还引入了**可变分辨率输入处理**技术：它不会将所有图片统一调整为固定大小（因为那样会改变图片的宽高比，还会导致细小文字无法清晰显示），而是将图片分割成固定数量的块，同时保持原有的宽高比。对于那些长而窄的文档，生成的块也会是长而窄的形状。这对于文档理解来说非常重要，因为宽高比本身就蕴含着语义信息（比如收据通常是长而窄的，而电子表格则是宽而短的）。

![无需OCR的文档理解：Donut和Pix2Struct直接通过视觉编码器处理文档图片，无需任何OCR预处理即可生成结构化文本输出](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/ocr_free_document_understanding.svg)

- **Nougat**（Blecher等人，2023年，Meta公司开发）将Donut架构专门应用于学术论文处理，能够直接从PDF页面图像生成完整的LaTeX标记。该模型可以处理复杂的数学公式、表格和图表——这些都是传统OCR系统难以处理的任务。它的训练数据为PDF页面图像与其对应的LaTeX源代码对。

- 无需OCR的模型的成功体现了深度学习中的一个普遍原则：那些直接从原始输入（像素）进行学习的端到端模型，往往比复杂的多阶段处理流程表现更好，因为它们能够同时优化所有组件，并学习到专为最终任务定制的表示方式。而中间的OCR步骤则成了限制模型学习能力的瓶颈。

## 视觉令牌处理流程

- 无论采用何种架构，所有的视觉语言模型都必须将图像转换为语言模型能够处理的令牌序列。理解这一处理流程至关重要。虽然不同模型的具体实现方式有所差异，但总体流程如下：

- **第一步：图像块提取。** 将图像（高度为$H$，宽度为$W$）分割成大小为$P \times P$的不重叠块，这样就能得到$N = HW / P^2$个块。例如，对于336×336分辨率的图像，若使用14×14大小的块，则共有$N = 576$个块。

- **第二步：视觉编码。** 每个图像块都会经过线性投影，然后送入视觉编码器（通常是ViT）。最终得到的结果是一组上下文相关的图像块嵌入向量$V = [v_1, \ldots, v_N] \in \mathbb{R}^{N \times d_v}$。这些嵌入向量既包含了图像的局部特征信息，也包含了全局上下文信息（通过自注意力机制获得）。

- **第三步：令牌压缩（可选）。** 有些模型会将$N$个视觉令牌压缩成数量更少的$M \ll N$个令牌，以此减轻语言模型的计算负担。Flamingo模型使用Perceiver Resampler进行压缩，此时$M = 64$；Qwen-VL模型则采用交叉注意力机制，对应的$M = 256$；**Q-Former**模型（用于BLIP-2，Li等人，2023年）则使用$M = 32$个可学习的查询令牌，这些查询令牌会与视觉编码器的输出进行交叉注意力交互。

- **第四步：投影。** 这些视觉令牌（无论是完整版本还是压缩后的版本）都会通过线性层或多层感知机被投影到语言模型的嵌入空间中。经过投影后，视觉令牌的维度与文本令牌的维度一致，因此可以与文本令牌拼接在一起。

- **第五步：插入到大型语言模型中。** 经过投影后的视觉令牌会被插入到特殊令牌`<image>`所在的位置，之后整个令牌序列就会由大型语言模型进行处理。大型语言模型的自注意力机制使得文本令牌能够与视觉令牌相互关联。

![视觉令牌处理流程：首先提取图像块，再通过ViT进行编码，可选地通过Perceiver或Q-Former进行压缩，随后将视觉令牌投影到大型语言模型的嵌入空间中，最后与文本令牌拼接在一起](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/visual_token_pipeline.svg)

- 视觉令牌的数量直接影响计算成本。每个视觉令牌都会参与大型语言模型的自注意力计算，而自注意力的计算复杂度与序列长度的平方成正比。高分辨率图像由于包含大量图像块，可能会产生数百甚至数千个视觉令牌，从而占据大型语言模型的上下文窗口的大部分空间。这就是为什么令牌压缩如此重要的原因：将576个视觉令牌压缩为64个，就能使视觉信息在自注意力计算中的占比降低约9倍。

- **BLIP-2**（Li等人，2023年）的亮点在于它采用了高效的桥接策略。它在固定的视觉编码器和固定的大型语言模型之间加入了一个轻量级的**Q-Former**模块——这是一个带有可学习查询参数的小型Transformer模型。Q-Former是唯一可训练的组件，而视觉编码器和大型语言模型则保持不变。该模块分两个阶段进行预训练：首先是利用图像-文本对比学习、匹配和描述生成任务来对其进行训练，使其与视觉编码器建立联系；其次是利用语言生成任务来进一步训练它，使其与大型语言模型建立联系。这种模块化设计使得BLIP-2能够将任何视觉编码器与任何大型语言模型结合使用。

## 训练目标

- 视觉语言模型的训练会结合多种目标，具体取决于所采用的架构类型：

- **图像-文本对比损失（ITC）：** 如CLIP模型所示，该目标旨在让图像和文本的表示在同一个嵌入空间中对齐。这是双编码器架构的主要训练目标，也常被用作融合型模型的预训练目标。该损失函数实际上就是前面文件中提到的InfoNCE损失函数。

- **图像-文本匹配任务（ITM）：** 这是一种二分类任务——给定一张图像和一段文本，需要判断二者是否匹配。由于存在“难负样本”（即内容相似但对应不同图像的文本），这项任务颇具挑战性，迫使模型学会实现更精细的对齐。

- **语言建模任务（LM）：** 这是标准的自回归语言建模目标——根据所有之前的令牌来预测下一个令牌。对于视觉语言模型而言，“之前的令牌”还包括那些视觉令牌，因此模型需要学会在视觉信息的条件下生成文本。这是编码器-解码器架构以及仅解码器架构的视觉语言模型的主要训练目标。

$$\mathcal{L}_{\text{LM}} = -\sum_{t=1}^{T} \log p(w_t \mid w_{<t}, V)$$

- **前缀语言建模：** 这是一种变体形式，其中图像和文本的前缀部分仅作为上下文提供，模型并不需要学习这些内容，只需学会生成后续的文本即可。这种技术被用于PaLI和SimVLM等模型中。

- 大多数现代视觉语言模型在预训练阶段会结合多种目标进行训练（例如BLIP模型会同时使用ITC、ITM和LM目标，CoCa模型则使用ITC和LM目标），之后则会在指令数据上仅使用语言建模目标来进行微调。

## 编程任务（可使用CoLab或笔记本完成）

1. 实现一个基于注意力机制的简单图像描述生成解码器。可以将随机生成的“图像特征”作为编码器的输出，然后训练解码器以生成固定的描述文本。在每次解码过程中，观察注意力权重在空间上的变化情况。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Simulate a 4x4 spatial grid of image features (16 regions, dim=32)
key = jax.random.PRNGKey(42)
k1, k2, k3 = jax.random.split(key, 3)
img_features = jax.random.normal(k1, (16, 32))  # 16 spatial regions, 32-dim

# Vocabulary: 0=<start>, 1="a", 2="red", 3="car", 4=<end>
vocab_size, embed_dim, hidden_dim = 5, 16, 32
W_embed = jax.random.normal(k2, (vocab_size, embed_dim)) * 0.1
W_attn_q = jax.random.normal(k3, (hidden_dim, 32)) * 0.1  # query projection

def attend(h, img_feats, W_q):
    """Compute soft attention over image features given decoder state h."""
    query = h @ W_q  # (32,)
    scores = img_feats @ query  # (16,)
    weights = jax.nn.softmax(scores)  # (16,)
    context = weights @ img_feats  # (32,)
    return context, weights

# Simple GRU-like step (for illustration, just a linear + tanh)
W_h = jax.random.normal(jax.random.PRNGKey(0), (embed_dim + 32, hidden_dim)) * 0.1

def decode_step(h, word_idx, img_feats):
    context, attn_weights = attend(h, img_feats, W_attn_q)
    word_emb = W_embed[word_idx]  # (16,)
    inp = jnp.concatenate([word_emb, context])  # (48,)
    h_new = jnp.tanh(inp @ W_h)  # (32,)
    return h_new, attn_weights

# Run decoding for the sequence: <start> -> "a" -> "red" -> "car" -> <end>
target_seq = [0, 1, 2, 3, 4]
h = jnp.zeros(hidden_dim)
all_attn = []
for word_idx in target_seq[:-1]:
    h, attn_w = decode_step(h, word_idx, img_features)
    all_attn.append(attn_w)

# Visualise attention maps (reshaped to 4x4 grid) at each step
words = ["<start>", "a", "red", "car"]
fig, axes = plt.subplots(1, 4, figsize=(14, 3))
for i, (ax, w) in enumerate(zip(axes, words)):
    ax.imshow(all_attn[i].reshape(4, 4), cmap='viridis')
    ax.set_title(f'Attending when\ngenerating after "{w}"')
    ax.axis('off')
plt.suptitle('Attention Over Image Regions at Each Decoding Step')
plt.tight_layout(); plt.show()
# Try changing img_features to see how attention patterns shift!
```

1. 模拟视觉令牌处理流程：将图像分割成多个块，将这些块映射到嵌入空间中，再将它们与文本令牌的嵌入值拼接起来，最后对这个组合后的序列应用一个自注意力层。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(7)

# Create a synthetic 8x8 "image" with 3 channels
k1, k2, k3, k4 = jax.random.split(key, 4)
image = jax.random.uniform(k1, (8, 8, 3))

# Step 1: Patchify into 4x4 patches -> 4 patches
patch_size = 4
patches = image.reshape(2, patch_size, 2, patch_size, 3)
patches = patches.transpose(0, 2, 1, 3, 4).reshape(4, patch_size * patch_size * 3)  # (4, 48)
print(f"Number of patches: {patches.shape[0]}, patch dim: {patches.shape[1]}")

# Step 2: Project patches to embedding dim (d=16)
d_model = 16
W_patch = jax.random.normal(k2, (patches.shape[1], d_model)) * 0.1
visual_tokens = patches @ W_patch  # (4, 16)

# Step 3: Create text token embeddings (simulate 3 text tokens)
text_tokens = jax.random.normal(k3, (3, d_model)) * 0.1

# Step 4: Concatenate visual + text tokens
combined = jnp.concatenate([visual_tokens, text_tokens], axis=0)  # (7, 16)
print(f"Combined sequence length: {combined.shape[0]} (4 visual + 3 text)")

# Step 5: Single-head self-attention over the combined sequence
W_Q = jax.random.normal(k4, (d_model, d_model)) * 0.1
k5, k6 = jax.random.split(k4)
W_K = jax.random.normal(k5, (d_model, d_model)) * 0.1
W_V = jax.random.normal(k6, (d_model, d_model)) * 0.1

Q = combined @ W_Q
K = combined @ W_K
V = combined @ W_V
attn_scores = (Q @ K.T) / jnp.sqrt(d_model)
attn_weights = jax.nn.softmax(attn_scores, axis=-1)  # (7, 7)

output = attn_weights @ V  # (7, 16)

# Visualise the cross-modal attention pattern
labels = ['V1', 'V2', 'V3', 'V4', 'T1', 'T2', 'T3']
fig, ax = plt.subplots(figsize=(6, 5))
im = ax.imshow(attn_weights, cmap='Blues')
ax.set_xticks(range(7)); ax.set_xticklabels(labels)
ax.set_yticks(range(7)); ax.set_yticklabels(labels)
ax.set_xlabel('Key'); ax.set_ylabel('Query')
ax.set_title('Self-Attention: Visual (V) and Text (T) Tokens')
plt.colorbar(im, ax=ax); plt.tight_layout(); plt.show()
# Observe: text tokens attend to visual tokens (cross-modal attention)!
```

1. 实现用于视觉定位的坐标分词功能。给定一个边界框后，将其转换为离散的令牌；再根据这些离散令牌重新构建出边界框。同时，需要展示在不同分箱分辨率下量化误差的情况。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

def encode_bbox(bbox, num_bins=1000):
    """Convert continuous bbox (x, y, w, h) in [0,1] to discrete tokens."""
    tokens = jnp.round(jnp.array(bbox) * (num_bins - 1)).astype(jnp.int32)
    return tokens

def decode_bbox(tokens, num_bins=1000):
    """Convert discrete tokens back to continuous bbox."""
    return tokens.astype(jnp.float32) / (num_bins - 1)

# Ground-truth bounding box (normalised to [0, 1])
gt_bbox = jnp.array([0.123, 0.456, 0.333, 0.222])

# Test quantisation at different bin resolutions
bin_sizes = [10, 50, 100, 500, 1000]
errors = []
for n_bins in bin_sizes:
    tokens = encode_bbox(gt_bbox, n_bins)
    reconstructed = decode_bbox(tokens, n_bins)
    error = jnp.max(jnp.abs(gt_bbox - reconstructed))
    errors.append(float(error))
    print(f"Bins={n_bins:>5d} | Tokens={tokens} | "
          f"Reconstructed={reconstructed} | Max error={error:.6f}")

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(bin_sizes, errors, 'o-', color='#e74c3c', linewidth=2, markersize=8)
ax.set_xlabel('Number of Bins'); ax.set_ylabel('Max Quantisation Error')
ax.set_title('Bounding Box Quantisation Error vs Bin Resolution')
ax.set_xscale('log'); ax.set_yscale('log')
ax.grid(True, alpha=0.3); plt.tight_layout(); plt.show()
# Try: what happens with very few bins (e.g., 5)? When is the error acceptable?
```

## 图像与视频的令牌化处理

_图像与视频的令牌化处理是将连续的视觉数据转换为离散的令牌序列，这样变换器就能像处理文本一样处理这些序列。本文件涵盖了VQ-VAE、VQ-GAN、码本学习、DALL-E的dVAE技术、视频令牌化处理以及无需查找表的量化方法。_

## 为何要对图像进行令牌化处理？

- 可以把语言看作是一种有限的字母表：英语大约有26个字母，而现代语言模型则会将文本拆分成3万到10万个子词令牌。每个句子都变成了由离散符号构成的序列，变换器可以逐个预测这些符号。而图像则存在于连续的、高维的空间中：一张256×256像素的RGB图像实际上就是$\mathbb{R}^{256 \times 256 \times 3} \approx \mathbb{R}^{196{,}608}$空间中的一个点。如果希望让语言模型用处理英语的相同机制来“描述”图像，就必须将这些连续的像素数组转换为来自有限词汇表的离散令牌序列。这种转换过程就是**图像令牌化处理**。

- 想象你是一名马赛克艺术家。你并没有无限多种颜色的瓷砖，只有固定的颜色选择，比如8192种不同的瓷砖颜色。要将一张照片转化为马赛克作品，你必须：(1)确定每块瓷砖对应照片中的哪个区域；(2)为每个区域选择最接近的颜色；(3)接受部分细节会丢失的事实，但整体图像仍然可以被识别。图像令牌化处理正是如此：编码器将图像的不同区域压缩为潜在向量，码本则将这些向量映射到最接近的条目，最终得到的就是一组整数索引，每个索引对应一个图像区域，这样的结构便于离散模型进行处理。

- 令牌化处理的好处有三点。首先，它能大幅压缩图像大小：一张256×256像素的图像可能会被转换为16×16的令牌网格，这样一来，序列长度就从65,536个像素减少到256个令牌，这对于那些处理成本随序列长度呈二次方增长的注意力机制模型来说更为容易处理。其次，它实现了统一的表示方式：文本令牌和图像令牌都属于同一个离散词汇表，因此单个自回归变换器就可以同时生成文本和图像内容。第三，它为模型设置了有效的约束，迫使模型学习具有语义意义的编码，而非仅仅记忆像素信息。

![图像令牌化处理流程示意图：连续图像进入编码器，潜在向量通过码本进行量化，最终得到由离散令牌索引构成的网格](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/image_tokenisation_overview.svg)

- 回想一下第8章的内容，卷积网络是如何从图像中提取分层特征图的；再回想第7章，文本令牌器又是如何将字符串转换为整数序列的。图像令牌化处理则介于两者之间：它首先使用CNN或视觉变换器编码器（第8章）来提取空间特征，然后再借鉴离散词汇表的概念（第7章），将这些特征转换为令牌索引。

## VQ-VAE：向量量化

- 如第6章所述，传统的**变分自编码器**会将输入数据编码为连续的潜在分布，然后从该分布中解码出重建后的数据。由于潜在空间是连续的，因此很难将其输入到离散序列模型中。van den Oord等人于2017年提出的**向量量化变分自编码器**则通过引入可学习的嵌入向量码本，将连续的潜在空间替换为离散空间，同时将每个编码器的输出映射到码本中距离最近的条目。

- 想象有一个恰好有$K$个标有标签的书架的图书馆。当有一本新书（即编码器的输出）出现时，图书管理员会把它放在与它最相似的那些书籍所在的书架上，并记录下那个书架的编号。之后，只要知道书架编号，就可以找到那本书——因为那个书架上的对应条目已经足够代表这本书了。这就是向量量化原理。

- 从形式上来看，VQ-VAE由三个部分组成：

- 一个**编码器**$E$，它将输入图像$\mathbf{x} \in \mathbb{R}^{H \times W \times 3}$转换为由连续潜在向量构成的空间网格$\mathbf{z}_e = E(\mathbf{x}) \in \mathbb{R}^{h \times w \times d}$，其中$h \times w$是降采样后的空间分辨率，$d$则是嵌入维度。

- 一个**码本**$\mathcal{C} = \{\mathbf{e}_1, \mathbf{e}_2, \ldots, \mathbf{e}_K\} \subset \mathbb{R}^d$，其中包含$K$个可学习的嵌入向量。通常，码本的规模在512到16,384个条目之间。

- 一个**解码器**$D$，它负责根据量化的潜在向量来重建图像。

- **量化步骤**则是将编码器在空间位置$(i, j)$处的输出$\mathbf{z}_e(\mathbf{x})$替换为码本中距离最近的条目：

$$\mathbf{z}_q(i,j) = \mathbf{e}_{k^\ast} \quad \text{其中} \quad k^\ast = \arg\min_k \|\mathbf{z}_e(i,j) - \mathbf{e}_k\|_2$$

- 这实际上就是在嵌入空间中进行最近邻搜索，与第6章中介绍的k均值分配算法原理相同。索引$k^\ast$就是空间位置$(i,j)$对应的离散令牌，整个图像则由$h \times w$个来自集合$\{1, \ldots, K\}$的整数组成。

![VQ-VAE架构图：编码器生成连续潜在向量，每个向量都被匹配到码本中最近的条目，解码器则根据这些量化后的向量来重建图像](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vqvae_architecture.svg)

- 问题在于，$\arg\min$操作是不可微分的：无法通过对离散选择进行反向传播来计算梯度。VQ-VAE通过**直通估计器**来解决这个问题：在正向传播过程中，解码器接收的是量化后的向量$\mathbf{z}_q$；而在反向传播过程中，重建损失函数关于$\mathbf{z}_q$的梯度会被直接传递给$\mathbf{z}_e$，就好像量化步骤是一个恒等函数一样。这一过程可以用以下公式简洁地表示：

$$\mathbf{z}_q = \mathbf{z}_e + \text{sg}(\mathbf{z}_q - \mathbf{z}_e)$$

- 其中，$\text{sg}(\cdot)$为停止梯度算子。在正向传播过程中，该算子的输出为$\mathbf{z}_q$；而在反向传播过程中，梯度仅通过$\mathbf{z}_e$项传递。

- 完整的VQ-VAE损失函数包含三项：

$$\mathcal{L} = \underbrace{\|\mathbf{x} - D(\mathbf{z}_q)\|_2^2}_{\text{重建损失}} + \underbrace{\|\text{sg}(\mathbf{z}_e) - \mathbf{e}\|_2^2}_{\text{码本损失（VQ损失）}} + \underbrace{\beta \|\mathbf{z}_e - \text{sg}(\mathbf{e})\|_2^2}_{\text{约束损失}}$$

- **重建损失**用于训练编码器和解码器，使其能够准确再现输入数据。**码本损失**（也称为VQ损失）则促使码本向量向编码器的输出靠拢；需要注意的是，$\text{sg}(\mathbf{z}_e)$意味着编码器不会从这一项获得梯度信号，因此它只会更新码本本身。**约束损失**的作用则相反：它迫使编码器的输出保持与码本向量相近，从而防止编码器偏离码本范围。超参数$\beta$（通常取值为0.25）用于控制码本损失与约束损失之间的平衡。

- 在实际应用中，码本通常是通过指数移动平均法而非梯度下降法来更新的，因为后者更为稳定。设$\mathbf{n}_k$为分配给码本条目$k$的编码器输出数量，$\mathbf{s}_k$为这些输出的总和。则指数移动平均法的更新公式为：

$$\mathbf{n}_k \leftarrow \gamma \mathbf{n}_k + (1 - \gamma) |\{(i,j) : k^\ast_{ij} = k\}|$$

$$\mathbf{s}_k \leftarrow \gamma \mathbf{s}_k + (1 - \gamma) \sum_{(i,j) : k^\ast_{ij} = k} \mathbf{z}_e(i,j)$$

$$\mathbf{e}_k \leftarrow \frac{\mathbf{s}_k}{\mathbf{n}_k}$$

- 其中，$\gamma$为衰减率（通常取值为0.99）。这种方法实际上相当于对编码器的输出应用在线k均值算法。

### 码本崩溃问题

- VQ-VAE的一个常见缺陷就是**码本崩溃**（也称为索引崩溃）：模型会只使用$K$个码本条目中的一小部分，导致大部分条目无法被使用。可以想象一个图书馆，由于图书管理员总是将书籍放到少数几本受欢迎的书架上，结果90%的书架都是空的。这种情况就浪费了表示能力。

- 码本崩溃之所以会发生，是因为在训练过程中编码器、码本和解码器是共同演化的。如果某个条目在多个训练批次中都没有被选中，它就会逐渐偏离编码器的特征空间，进而更不可能被选中，从而形成正反馈循环。

- 有几种方法可以缓解码本崩溃问题：
- **码本重置**：定期通过复制随机抽取的编码器输出来重新初始化那些无法使用的条目，让它们在潜在空间的活跃区域附近重新开始。
- **结合拉普拉斯平滑的指数移动平均更新**：在$\mathbf{n}_k$中加入一个小的常数，以避免任何条目的计数变为零，从而确保所有条目都能接收到梯度信号。
- **调整约束损失参数**：增大$\beta$值可以迫使编码器的输出更紧密地聚集在码本条目周围，使数据分配更加均匀。
- **分解式码本**：将码本查询过程分解为多个较小的查询步骤（例如，使用两个大小为$\sqrt{K}$的码本），这样可以降低每次查询所需的码本规模，从而提高利用率。
- **熵正则化**：引入惩罚项，促使码本的使用更加均匀，从而最大化熵值$H = -\sum_k p_k \log p_k$，其中$p_k$为实际的数据分配概率。

![码本利用率对比：正常情况下，码本中的条目分布均匀；而出现码本崩溃时，大多数条目都无法被使用](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/codebook_collapse.svg)

## VQ-GAN：通过对抗性训练提升图像质量

- VQ-VAE虽然能够生成不错的重建结果，但由于其基于像素级的$\ell_2$损失函数，往往会生成模糊的图像——因为它对每个像素的偏差都给予相同的惩罚，从而平均化了各种细节，而无法突出清晰的细节。可以想象，如果要求某人画出一个脸部图像，且要求该图像与所有可能存在的脸部的平均差异最小，那么他画出来的将会是一个模糊的平均脸，而不是一个清晰的个体脸。

- **VQ-GAN**（Esser等人，2021年）通过将VQ-VAE框架与生成对抗网络中的**判别器**相结合来解决这个问题（详见第6章）。该判别器是一种基于图像块的卷积神经网络，用于判断某个局部图像块是来自训练数据中的真实图像，还是来自解码器的虚假图像。这种对抗性损失机制能够促使解码器生成在视觉上更加清晰、真实的纹理，而非仅仅基于像素的平均值。

- VQ-GAN在VQ-VAE的损失函数基础上增加了两项新的损失项：

$$\mathcal{L}_\text{VQ-GAN} = \mathcal{L}_\text{VQ-VAE} + \lambda_\text{adv} \mathcal{L}_\text{adv} + \lambda_\text{perc} \mathcal{L}_\text{perc}$$

- **对抗性损失**$\mathcal{L}_\text{adv}$实际上是标准GAN损失函数在解码器输出上的应用。判别器$\mathcal{D}$试图区分真实图像块与解码得到的图像块，而解码器则试图欺骗判别器。其非饱和形式的表达式为：

$$\mathcal{L}_\text{adv} = -\mathbb{E}[\log \mathcal{D}(D(\mathbf{z}_q))]$$

- **感知损失**$\mathcal{L}_\text{perc}$则通过比较原始图像与重建图像经过预训练网络（通常是VGG或LPIPS）处理后的特征激活值来进行评估：

$$\mathcal{L}_\text{perc} = \sum_l \|\phi_l(\mathbf{x}) - \phi_l(D(\mathbf{z}_q))\|_2^2$$

- 其中，$\phi_l$表示预训练网络第$l$层对应的特征图。这种损失方式侧重于捕捉高层次的结构相似性，而非像素级的精确度。

- 参数$\lambda_\text{adv}$会被动态调整，以确保对抗性梯度与重建梯度之间达到平衡，从而避免在训练初期，由于重建质量较差而导致对抗性损失占据主导地位。

![VQ-GAN训练过程：编码器与解码器通过量化步骤相连，同时有基于图像块的判别器为解码后的输出提供对抗性反馈](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vqgan_training.svg)

- 这种令牌化方法在相同的代码本规模下，能够生成比VQ-VAE更清晰的重建结果。VQ-GAN是许多主流图像生成系统的核心令牌化技术，包括最初的DALL-E、Parti以及众多文本到图像的模型。它可将256×256大小的图像转换为由1024–16384个元素构成的代码本中的16×16或32×32网格形式的离散令牌，从而在每个空间维度上实现16倍到64倍的压缩比。

## 残差量化与多尺度代码本

- 单一代码本会限制重建质量：每个空间位置只能由一个代码本向量表示，那些超出代码本表达能力的细节将会丢失。这就好比用固定调色板中的某个单词来描述颜色——“青绿色”虽然接近但并不精确；如果能够进一步细化描述，比如“青绿色，但蓝色成分稍多一些，亮度也高一点”，那么描述就会更加准确。

- **残差量化**就是通过迭代方式应用这一理念。在第一次量化后得到$\mathbf{z}_q^{(1)}$，接着计算残差$\mathbf{r}^{(1)} = \mathbf{z}_e - \mathbf{z}_q^{(1)}$，然后使用第二个代码本对这一残差进行量化，得到$\mathbf{z}_q^{(2)}$，如此重复$T$次：

$$\mathbf{r}^{(0)} = \mathbf{z}_e$$

$$\mathbf{z}_q^{(t)} = \text{量化}(\mathbf{r}^{(t-1)}, \mathcal{C}^{(t)})$$

$$\mathbf{r}^{(t)} = \mathbf{r}^{(t-1)} - \mathbf{z}_q^{(t)}$$

- 最终的量化结果为$\hat{\mathbf{z}} = \sum_{t=1}^{T} \mathbf{z}_q^{(t)}$。如果有$T$个量化层级，每个层级使用大小为$K$的代码本，那么有效的词汇表大小为$K^T$，但实际上只需存储$T \times K$个向量即可，而非$K^T$个。例如，若设有8个层级，且每个层级的代码本大小为1024，则有效的词汇表规模约为$1024^8 \approx 10^{24}$，而实际存储的向量数量仅为8192个。

- 每个后续层级都能捕捉更精细的细节：第一个代码本用于捕捉整体结构，第二个代码本用于处理中频细节，依此类推。这与JPEG格式中的逐级近似处理或网页图像中的渐进式渲染方式类似——先显示粗略版本，再逐步补充细节。

![残差量化：原始向量通过多个阶段逐步近似，每个阶段都对前一个阶段的残差进行量化](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/residual_quantisation.svg)

- **多尺度代码本**则通过在不同的空间分辨率下进行量化来扩展这一理念。无需反复对同一空间网格进行量化，而是可以在多个尺度上进行量化：粗略的网格用于捕捉整体结构，更精细的网格则用于捕捉局部细节。这与第8章物体检测部分中提到的特征金字塔概念类似，不同尺度的特征分别对应不同层次的细节。

- **乘积量化**是一种相关技术，它将$d$维的潜在向量拆分为$M$个维度为$d/M$的子向量，每个子向量都使用各自的代码本进行独立量化。这样虽然有效的词汇表规模为$K^M$，但实际上只需存储$M \times K$个向量即可。乘积量化被广泛用于近似最近邻搜索（第13章），并且也被应用于图像令牌化处理中。

- **有限标量量化**（FSQ）是由Mentzer等人于2023年提出的另一种方法：它不学习代码本，而是直接将潜在向量的每个维度四舍五入到一组固定的整数值中（例如$\{-2, -1, 0, 1, 2\}$）。如果每个维度有$L$个取值级别，且共有$d$个维度，那么隐含的代码本规模即为$L^d$。由于不存在需要学习的代码本向量，只有经过确定性四舍五入后的编码器输出，因此FSQ完全避免了代码本崩溃的问题。此外，直通估计器可用于处理四舍五入操作带来的不可微性问题。

## 实际应用中的图像令牌化技术

- 从VQ-VAE到VQ-GAN，再到残差量化，这一技术发展历程催生出了一系列实用的图像令牌化方法，这些方法被广泛应用于最先进的生成模型中。

### DALL-E令牌化器（dVAE）

- 最初的**DALL-E**（Ramesh等人，2021年）采用了离散VAE（dVAE）技术，将256×256大小的图像转换为32×32网格形式的令牌，这些令牌来自大小为8192的代码本。dVAE用Gumbel-Softmax算法替代了传统的强制最小化量化方式，从而使训练过程中的前向传播具备可微性。在推理阶段，则使用最大值搜索来确定令牌的分配方式。dVAE的训练结合了重建损失、针对均匀先验的KL散度，以及用于Gumbel-Softmax算法的动态温度控制机制。之后，DALL-E又训练了一个拥有120亿参数的自回归变换器，用来建模256个文本令牌与1024个图像令牌（32×32网格）之间的联合分布。

### LlamaGen

- **LlamaGen**（Sun等人，2024年）表明，只要拥有合适的图像令牌化器，就可以将标准的Llama风格语言模型架构（第7章）用于自回归式图像生成。LlamaGen采用了改进版的VQ-GAN令牌化器，该令牌化器拥有规模较大的代码本（16,384个条目），同时它还使用了一个普通的自回归变换器（除了令牌化器之外没有其他针对图像的特殊设计）来按扫描顺序从左到右预测图像令牌。其核心思想在于：一旦图像被转换为离散序列，那么原本适用于语言处理的下一个令牌预测方法同样适用于图像处理，这进一步证明了令牌化确实能够弥合不同数据模态之间的差距。

### Cosmos令牌化器

- **Cosmos令牌化器**（NVIDIA，2024年）是一个专为图像和视频设计的统一框架。它采用因果型3D架构，将图像视为单帧视频，因此同一个令牌化器即可处理这两种类型的数据。Cosmos支持连续式和离散式两种令牌化模式：连续模式会输出实数形式的潜在向量（用于扩散模型），而离散模式则通过有限标量量化生成整数令牌（用于自回归模型）。该编码器使用因果型3D卷积，使得每帧的令牌仅依赖于当前帧和前几帧，从而实现视频流的实时令牌化处理。

![不同图像令牌化器架构的对比：基于Gumbel-Softmax的dVAE、基于码本查询的VQ-GAN以及基于标量四舍五入的FSQ](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/image_tokeniser_comparison.svg)

## 视频的令牌化处理

- 视频在图像的空间维度之外还增加了时间维度。视频是由一系列帧构成的，通常为每秒24到30帧，而且相邻帧之间存在很高的冗余性，因为33毫秒内视觉场景不会发生剧烈变化。视频令牌化技术正是利用了这种时间上的冗余性，从而实现比单独对每帧进行令牌化更高的压缩效率。

- 可以把视频压缩想象成翻页书。如果逐页从头开始绘制，就需要数千幅详细的图画。但实际上大多数页面都与周围的页面极为相似，因此只需每10页绘制一个完整的“关键帧”，再记录中间页面的细微变化即可。视频令牌化器能够自动掌握这一技巧。

### 3D VQ-VAE

- VQ-VAE在视频领域的最直接扩展形式就是**3D VQ-VAE**，它用同时作用于空间和时间维度的3D卷积替代了编码器和解码器中的2D卷积。如果编码器在空间维度上以$f_s$的比例下采样，在时间维度上以$f_t$的比例下采样，那么一个尺寸为$T \times H \times W$的视频片段就会转化为尺寸为$(T/f_t) \times (H/f_s) \times (W/f_s)$的令牌网格。

- 例如，当$f_s = 16$且$f_t = 4$时，一个16帧、256x256像素的视频片段就会变成由1024个令牌构成的序列。这样的数据规模已经足够让变换器进行自回归建模，而原始像素数据的总量则为$16 \times 256 \times 256 \times 3 \approx 310万$个数值。

- 3D卷积能够同时学习空间特征和时间特征。较浅的层负责捕捉局部运动（如帧与帧之间的边缘移动），而较深的层则负责捕捉更复杂的动态信息（如物体的出现、消失或形状变化）。这其实与第8章中介绍的卷积网络的层次化特征提取原理类似，只不过在这里是沿着时间轴来实现的。

![用于视频处理的3D VQ-VAE：短视频片段通过3D卷积被编码为时空网格形式的潜在向量，经过量化处理后再解码回原始帧](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/video_3d_vqvae.svg)

### 因果型视频令牌化器

- 标准的3D卷积会考虑过去、现在和未来的帧，这意味着在对其进行令牌化处理之前，必须先获取整个视频片段。**因果型视频令牌化器**则对时间卷积进行了限制，使得每个输出结果仅依赖于当前帧和前几帧，而不会涉及未来的帧。这类似于自回归变换器中的因果遮蔽机制（见第7章）：信息只能向前传递，无法倒流。

- 因果型令牌化对于两种应用场景非常重要。首先是在**流式处理**中：随着视频帧的不断到来，可以实时对其进令牌化处理，无需缓存后续的帧。其次是在**自回归生成**过程中：当变换器逐帧生成视频时，必须能够在不知道$t+1$帧内容的情况下计算出$t$帧的令牌，因为$t+1$帧尚未生成。

- 这种因果约束是通过非对称地填充时间卷积来实现的：大小为$k$的时间卷积核在过去的那一侧会被填充$k-1$个零，在未来的那一侧也会填充零，这样就能确保时间$t$处的输出仅依赖于$t-k+1, \ldots, t$这些时刻的输入数据。

- 因果型视频令牌化器还有一个优点，那就是它们无需特殊处理即可对单张图像（即只有一帧的“视频”）进行令牌化。由于第一帧没有历史上下文，其令牌可以直接根据该帧本身来计算。这种**图像与视频的统一处理方式**意味着同一个令牌化器就可以处理这两种类型的数据，从而简化了架构，也让模型能够使用相同的解码器来生成图像和视频。

### 时间压缩策略

- 不同的应用场景对时间压缩率的要求也有所不同。在动作识别任务中，由于细微的动作变化非常重要，因此需要采用较为温和的压缩方式（$f_t = 2$），以保留时间上的细节信息。而对于长时长视频的生成来说，由于存储数千帧数据会带来巨大负担，因此需要采用更为强烈的压缩方式（$f_t = 8$或更高）。

- 有些令牌化器采用**分解式压缩**策略：空间压缩和时间压缩在不同的阶段进行。首先，2D编码器会独立地对每一帧进行压缩，从而生成每帧的潜在向量网格；之后，1D时间编码器则会对这些向量在时间维度上进行压缩。这种分解式处理方式相比完整的3D卷积计算成本更低，而且还能为空间和时间分别设置不同的压缩比例。不过它的缺点是无法像联合3D编码那样高效地捕捉时空模式（比如球体沿对角线移动的情况）。

- **时间插值令牌**是一种最新的技术，它只对关键帧进行完整编码，而将中间帧表示为轻量级的插值代码，这些代码描述了如何在不同关键帧之间进行过渡。这其实与传统的视频压缩技术类似（如H.264/HEVC标准中的I帧和P帧），只不过这里是在经过学习的潜在空间中实现的。

![不同的时间压缩策略：先进行与帧无关的空间编码，然后再进行时间编码， versus 联合时空3D编码](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/temporal_compression_strategies.svg)

## 连续令牌与离散令牌

- 并非所有的下游模型都需要离散令牌。**扩散模型**（第10章，文件04）可以直接处理连续值——它们通过迭代方式去除高斯样本中的噪声，其损失函数也是基于连续空间定义的。对于这类模型，令牌化编码器会生成永不被量化的连续潜在向量。**潜在扩散模型**（如Stable Diffusion、DALL-E 3、Flux）则使用类似VQ-GAN的编码器-解码器结构，但完全不依赖代码本，直接在连续潜在空间中进行运算。

- 另一方面，**自回归模型**（如GPT系列）则是通过针对$K$个类别的softmax函数来预测下一个令牌。这类模型本质上需要离散令牌。所有使用自回归变换器的图像生成系统（如DALL-E、Parti、LlamaGen、Chameleon）都依赖于离散令牌化器。

- 因此，是否选择连续令牌还是离散令牌，取决于所使用的生成模型类型：

- 当模型为自回归模型（通过交叉熵损失来预测下一个令牌）、希望与文本令牌共享词汇表以实现多模态统一处理，或需要精确的令牌级控制时（例如用于基于令牌的检索或编辑），应使用**离散令牌**。

- 当模型为扩散模型或流匹配模型、任务要求极高的重建精度（连续潜在向量可以完全避免量化误差），或希望使用作用于实值向量的回归损失函数时，应使用**连续令牌**。

- 一些最新的架构同时支持这两种模式。例如Cosmos令牌化器可以通过同一个编码器输出连续潜在向量（用于扩散模式），或输出经过FSQ离散化的令牌（用于自回归模式），并且还可以通过开关控制轻量级的量化模块。

- **软量化**则是一种折中方案：它不是采用严格的$\arg\min$分配方式，而是计算最接近的$k$个代码本条目的加权平均值，权重由负距离的softmax函数确定。这种方式比严格量化能保留更多信息，同时仍具有近似离散的特性。有些系统在训练阶段使用软量化，而在推理阶段则使用严格量化。

![根据下游生成模型选择连续令牌还是离散令牌的决策树](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/continuous_vs_discrete_tokens.svg)

## 应用场景

### 自回归图像生成

- 一旦图像被转换为离散令牌序列，就可以使用标准的自回归变换器来对它们进行建模。这些图像令牌会被展平为1维序列（通常按照扫描顺序：从左到右、从上到下），然后变换器会利用标准的交叉熵损失来学习$p(\text{token}_i | \text{token}_1, \ldots, \text{token}_{i-1})$这一概率分布。在生成图像时，会逐个采样令牌，再将生成的令牌序列传递给解码器，从而得到最终的像素数据。

- 对文本进行条件约束也非常简单：只需在图像令牌序列的前面添加文本令牌，这样模型就能学习$p(\text{image tokens} | \text{text tokens})$这一概率分布。这正是DALL-E、Parti和LlamaGen实现文本到图像生成的方式。文本令牌和图像令牌共享同一个变换器、相同的注意力机制，通常也共享同一个嵌入表（只不过文本令牌和图像令牌位于不同的索引范围内）。

- 扫描顺序会导致一种人为的不对称性：图像的左上角会首先被生成，而此时还无法获取关于右下角的任何信息。有一些方法解决了这个问题。**掩码图像建模**（MaskGIT）会训练一个双向变换器，让所有令牌同时生成，但生成置信度各不相同，随后逐步解除对置信度最高的令牌的掩码。**多尺度生成**则先生成粗略的令牌以捕捉整体结构，然后再通过残差令牌进行细化。这些方法虽然牺牲了单纯从左到右生成的简单性，但却能提升图像的整体连贯性。

### 统一的视觉-语言令牌

- 进行图像令牌化的根本动机在于**统一处理**：将视觉信息和语言信息转化为相同的表示形式，从而使单一的模型架构能够同时处理这两类信息。正如我们在第7章中所讨论的，语言模型是极其强大的序列到序列处理工具。通过将图像表示为令牌序列，我们就可以免费利用语言建模的所有技术——预训练方法、规模扩展规律、强化学习优化技术以及上下文长度扩展功能。

- **Chameleon**（Meta，2024年）就是一个典型的例子：它使用包含8192个代码本条目的VQ-GAN令牌化器将图像转换为令牌，这些令牌与文本令牌一起被纳入一个约65,000个条目的词汇表中（文本令牌和图像令牌各占一部分）。标准变换器会在混合了文本和图像的序列上进行训练，从而能够根据图像生成文本、根据文本生成图像，或者生成混合了文本和图像的内容，而且所有操作都可以通过同一轮前向传播完成。

- **Gemini**（Google，2024年）也采用了类似的方法，但其规模更大，能够在同一个变换器中直接理解和生成图像、音频和文本，不同的模态会通过各自的令牌化器将数据输入到共享的序列结构中。

- 在统一模型中，关键的工程挑战在于**词汇表平衡**：如果65,000个词汇表条目中有8192个是图像令牌，那么模型可能会分配过少的资源给视觉处理任务。解决这一问题的方法包括为每种模态设置独立的嵌入层（仅在注意力层面共享）、为不同模态设置不同的损失权重，以及在预训练过程中精心控制数据混合的比例。

![统一的视觉-语言模型：来自不同令牌化器的文本令牌和图像令牌被整合成一个序列，再由同一个变换器进行处理](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/unified_vision_language_tokens.svg)

## 编程任务（可使用CoLab或笔记本完成）（续1）

1. 在JAX中实现一个最简单的VQ层：给定一批编码器输出向量，查找最近的代码本条目，并计算VQ-VAE损失（包括重建损失、代码本相关损失以及承诺损失）。将代码本的利用率以直方图的形式展示出来。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# --- Minimal VQ layer ---
key = jax.random.PRNGKey(42)
d = 8          # embedding dimension
K = 64         # codebook size
n_vectors = 256  # batch of encoder outputs

# Random encoder outputs and codebook
k1, k2 = jax.random.split(key)
z_e = jax.random.normal(k1, (n_vectors, d))       # encoder outputs
codebook = jax.random.normal(k2, (K, d)) * 0.1     # codebook (small init)

# Nearest-neighbour lookup: find closest codebook entry for each z_e
# distances[i, k] = ||z_e[i] - codebook[k]||^2
distances = (
    jnp.sum(z_e ** 2, axis=1, keepdims=True)
    - 2 * z_e @ codebook.T
    + jnp.sum(codebook ** 2, axis=1, keepdims=True).T
)
indices = jnp.argmin(distances, axis=1)       # token indices
z_q = codebook[indices]                        # quantised vectors

# VQ-VAE loss terms
beta = 0.25
loss_codebook = jnp.mean((jax.lax.stop_gradient(z_e) - z_q) ** 2)
loss_commit   = jnp.mean((z_e - jax.lax.stop_gradient(z_q)) ** 2)
loss_total    = loss_codebook + beta * loss_commit
print(f"Codebook loss: {loss_codebook:.4f}, Commitment loss: {loss_commit:.4f}")

# Codebook utilisation
unique, counts = jnp.unique(indices, return_counts=True, size=K, fill_value=-1)
plt.figure(figsize=(10, 4))
plt.bar(range(K), counts, color='#3498db', alpha=0.8)
plt.xlabel('Codebook Index'); plt.ylabel('Assignment Count')
plt.title(f'Codebook Utilisation ({jnp.sum(counts > 0)}/{K} entries used)')
plt.grid(True, alpha=0.3); plt.tight_layout(); plt.show()
# Try: increase K to 512 and observe collapse. Then add codebook reset logic.
```

1. 构建一个简单的二维向量量化器，使其能够对二维数据分布进行划分。生成随机二维点，通过EMA算法更新来学习代码本，并可视化沃罗诺伊区域。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Generate 2D data from a mixture of Gaussians
key = jax.random.PRNGKey(0)
n_points = 2000
K = 16  # codebook entries
gamma = 0.99  # EMA decay

# Four clusters
keys = jax.random.split(key, 5)
centres = jnp.array([[2, 2], [-2, 2], [-2, -2], [2, -2]], dtype=jnp.float32)
data = jnp.concatenate([
    jax.random.normal(keys[i], (n_points // 4, 2)) * 0.5 + centres[i]
    for i in range(4)
])

# Initialise codebook from random data points
idx = jax.random.choice(keys[4], n_points, (K,), replace=False)
codebook = data[idx]
ema_count = jnp.ones(K)
ema_sum = codebook.copy()

# Run EMA-based codebook learning for several epochs
for epoch in range(30):
    # Assign each point to nearest codebook entry
    dists = jnp.sum((data[:, None, :] - codebook[None, :, :]) ** 2, axis=2)
    assignments = jnp.argmin(dists, axis=1)
    # EMA update
    for k in range(K):
        mask = (assignments == k)
        count_k = jnp.sum(mask)
        ema_count = ema_count.at[k].set(gamma * ema_count[k] + (1 - gamma) * count_k)
        if count_k > 0:
            sum_k = jnp.sum(data[mask], axis=0)
            ema_sum = ema_sum.at[k].set(gamma * ema_sum[k] + (1 - gamma) * sum_k)
    codebook = ema_sum / ema_count[:, None]

# Visualise assignments and codebook
fig, ax = plt.subplots(1, 1, figsize=(8, 8))
colors = plt.cm.tab20(jnp.linspace(0, 1, K))
for k in range(K):
    mask = assignments == k
    ax.scatter(data[mask, 0], data[mask, 1], c=[colors[k]], s=5, alpha=0.3)
ax.scatter(codebook[:, 0], codebook[:, 1], c='black', s=120, marker='X',
           edgecolors='white', linewidths=1.5, zorder=10, label='Codebook')
ax.set_title(f'Learned VQ Codebook ({K} entries) on 2D Data')
ax.legend(); ax.set_aspect('equal'); ax.grid(True, alpha=0.3)
plt.tight_layout(); plt.show()
# Try: increase K to 64 and observe finer tiling. Reduce gamma and see instability.
```

1. 演示残差量化技术：对一批向量进行$T$次连续量化处理，并测量每次量化后重建误差的下降情况。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(7)
d = 16         # embedding dimension
K = 32         # codebook size per level
T = 8          # number of residual levels
n_vectors = 512

# Random data to quantise
k1, *cb_keys = jax.random.split(key, T + 1)
z = jax.random.normal(k1, (n_vectors, d))

# Independent random codebooks for each level
codebooks = [jax.random.normal(cb_keys[t], (K, d)) * (0.5 ** t)
             for t in range(T)]

# Residual quantisation loop
residual = z.copy()
z_hat = jnp.zeros_like(z)
errors = []

for t in range(T):
    cb = codebooks[t]
    dists = (jnp.sum(residual ** 2, axis=1, keepdims=True)
             - 2 * residual @ cb.T
             + jnp.sum(cb ** 2, axis=1, keepdims=True).T)
    indices = jnp.argmin(dists, axis=1)
    z_q_t = cb[indices]
    z_hat = z_hat + z_q_t
    residual = residual - z_q_t
    mse = jnp.mean(jnp.sum((z - z_hat) ** 2, axis=1))
    errors.append(float(mse))
    print(f"Level {t+1}: MSE = {mse:.4f}")

plt.figure(figsize=(8, 5))
plt.plot(range(1, T + 1), errors, 'o-', color='#e74c3c', linewidth=2, markersize=8)
plt.xlabel('Residual Quantisation Level')
plt.ylabel('Reconstruction MSE')
plt.title('Error Reduction with Residual Quantisation')
plt.xticks(range(1, T + 1)); plt.grid(True, alpha=0.3)
plt.tight_layout(); plt.show()
# Try: use a single codebook of size K*T and compare with RQ. Which wins?
```

1. 模拟一个简单的1D“视频令牌化器”：生成一系列1D信号（模拟视频帧），应用因果时间压缩技术，并从重建质量的角度将其与非因果压缩方式进行比较。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

key = jax.random.PRNGKey(99)
n_frames = 16
frame_len = 64

# Generate a "video": a slowly moving Gaussian bump across frames
x_axis = jnp.linspace(-3, 3, frame_len)
frames = jnp.stack([
    jnp.exp(-0.5 * (x_axis - (-2 + 4 * t / n_frames)) ** 2)
    for t in range(n_frames)
])  # shape: (n_frames, frame_len)

# Causal temporal compression: each frame's code depends only on past frames
# Simple approach: average current frame with exponential decay of past
alpha_causal = 0.6
causal_codes = jnp.zeros_like(frames)
causal_codes = causal_codes.at[0].set(frames[0])
for t in range(1, n_frames):
    causal_codes = causal_codes.at[t].set(
        alpha_causal * frames[t] + (1 - alpha_causal) * causal_codes[t - 1]
    )

# Non-causal: average with both past and future (bilateral smoothing)
kernel = jnp.array([0.2, 0.6, 0.2])  # past, current, future
padded = jnp.concatenate([frames[:1], frames, frames[-1:]], axis=0)
noncausal_codes = jnp.stack([
    kernel[0] * padded[t] + kernel[1] * padded[t+1] + kernel[2] * padded[t+2]
    for t in range(n_frames)
])

# Reconstruction error
mse_causal = jnp.mean((frames - causal_codes) ** 2)
mse_noncausal = jnp.mean((frames - noncausal_codes) ** 2)
print(f"Causal MSE: {mse_causal:.6f}, Non-causal MSE: {mse_noncausal:.6f}")

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
for ax, data, title in zip(axes,
    [frames, causal_codes, noncausal_codes],
    ['Original Frames', f'Causal (MSE={mse_causal:.5f})',
     f'Non-causal (MSE={mse_noncausal:.5f})']):
    ax.imshow(data, aspect='auto', cmap='viridis', origin='lower')
    ax.set_xlabel('Spatial Position'); ax.set_ylabel('Frame Index')
    ax.set_title(title)
plt.tight_layout(); plt.show()
# Try: vary alpha_causal and the kernel weights. What happens with alpha=1.0?
```

## 跨模态生成

_跨模态生成是指以另一种模态的输入为条件，生成另一种模态的输出；包括文本转图像、图像转文本、文本转音频等。本文件将介绍DALL-E、Stable Diffusion、无分类器引导机制、ControlNet、图像描述、文本转视频（Sora）以及文本转音频技术。_

- 在本章的01-03部分中，你已经学习了如何表示、对齐以及将不同模态的数据进行令牌化处理。现在要做的就是利用这些知识，从一种模态生成另一种模态的内容。跨模态生成是文本转图像工具、视频合成系统、音乐创作模型以及图像描述功能背后的核心技术。可以将其视为教会机器成为“多媒体艺术家”——你用文字描述想要的结果，机器则负责绘制图像、制作动画或创作音乐。

- 其核心理念是**条件生成**：给定来自模态$A$的输入（例如文本），生成模态$B$的输出（例如图像）。从数学上讲，我们需要训练一个模型$p_\theta(y \mid x)$，其中$x$是条件信号，$y$则是生成的输出。不过，这种条件分布极其复杂且维度很高——一张512x512大小的图像对应的向量维度可达$\mathbb{R}^{786432}$，而且对于同一个文本描述，往往存在多种可行的图像结果。

![跨模态生成概览：文本、图像、音频和视频这四种模态通过有向箭头相互连接，展示了文本转图像、图像转文本、文本转音频以及文本转视频等生成路径](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/cross_modal_generation_overview.svg)

## 文本转图像生成

- 想象一下，你向一位法庭速写师描述一个场景。该艺术家需要理解你的描述，回忆各种物体的外观，将它们在空间中合理排列，最终绘制成图画。文本转图像模型正是如此工作的，只不过它们需要从数据中学习所有这些技能，而非通过多年的艺术训练。

### DALL-E：自回归式图像生成

- **DALL-E**（Ramesh等人，2021年）将图像生成视为序列预测问题——这与语言模型的工作原理相同（见第07章）。其关键思路在于：如果能够将图像表示为离散的令牌（可参考03章中的VQ-VAE技术），那么生成图像就相当于依次生成一系列令牌而已。

- 该流程分为两个阶段。首先，**离散VAE（dVAE）**会将256x256大小的图像压缩为32x32大小的离散令牌序列，这些令牌来自包含8192个元素的代码表，这样图像就被转化为1024个令牌的序列。接着，**变换器解码器**会被训练用来处理由256个文本令牌（经过BPE编码）与1024个图像令牌组合而成的1280个令牌的联合分布：

$$p(x_{\text{text}}, x_{\text{img}}) = \prod_{i=1}^{1280} p(x_i \mid x_1, \ldots, x_{i-1})$$

- 在生成图像时，只需输入文本令牌，模型就会通过自回归方式逐个生成图像令牌。这一方法的优点在于它能够复用语言建模中的技术——如注意力机制、因果掩码以及top-k采样——来用于图像合成。

- 不过，自回归生成方式本质上是顺序式的：逐一生成1024个令牌的过程速度较慢，而且如果在早期阶段出现错误，后续的生成结果也会受到影响。DALL-E通过生成多个候选图像，再利用CLIP技术（来自01章）对它们进行排序，从而找到与文本描述最匹配的图像。

![DALL-E的生成流程：文本令牌和图像令牌被合并为一个序列，然后由变换器解码器处理，该解码器会根据文本令牌自回归地预测出相应的图像令牌](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/dalle_autoregressive_pipeline.svg)

### Stable Diffusion：带文本条件的潜在扩散模型

- **Stable Diffusion**（Rombach等人，2022年）采用了完全不同的方法。它不是逐个预测令牌，而是从纯噪声开始，然后在文本提示的引导下逐步去除噪声，最终生成图像。回想一下第8章中介绍的扩散模型——Stable Diffusion在压缩后的潜在空间中运作，而非像素空间，因此效率大幅提升。

- 其架构由三个部分协同工作。**VAE编码器**将图像从像素空间（$512 \times 512 \times 3$）压缩为潜在表示（$64 \times 64 \times 4$），从而使维度降低48倍。**文本编码器**（通常是CLIP或OpenCLIP）则将文本提示转换为一系列嵌入向量。**U-Net去噪器**则利用这些噪声后的潜在数据、时间步信息以及文本嵌入向量，来预测每一步应该去除的噪声。文本条件信息则是通过**交叉注意力层**传递给U-Net的：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d}}\right)V$$

其中，$Q$来自噪声图像的特征，而$K$和$V$则来自文本嵌入向量。这样一来，模型就能在每个空间位置上关注相关的词汇——在去除“红色球体”所在区域的噪声时，模型就会关注“红色”和“球体”这两个词。

- 在推理过程中，首先在潜在空间中随机采样$z_T \sim \mathcal{N}(0, I)$，然后使用U-Net进行$T$次迭代去噪（通常采用DDIM调度策略，次数为20-50次），最后再通过VAE编码器将得到的纯净潜在向量$z_0$转换回像素空间。在消费级GPU上，整个处理过程几秒钟内就能生成一张512x512大小的图像。

![Stable Diffusion的架构：文本提示通过CLIP进行编码，潜在空间中的随机噪声通过带有文本嵌入向量交叉注意力的U-Net逐步去除，最后再通过VAE解码器生成最终图像](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/stable_diffusion_architecture.svg)

### 实际应用中的无分类器引导机制

- **无分类器引导机制（CFG）**是让文本转图像模型能够生成与文本描述完全匹配的图像的关键技术。回想一下第8章的内容，CFG机制会同时以有条件和无条件的方式训练模型，然后在采样时增强条件信号的作用：

$$\hat{\epsilon} = \epsilon_\theta(x_t, \varnothing) + s \cdot (\epsilon_\theta(x_t, c) - \epsilon_\theta(x_t, \varnothing))$$

- 其中$s$为引导强度参数。可以将$(\epsilon_\theta(x_t, c) - \epsilon_\theta(x_t, \varnothing))$视为“朝向提示词的方向”——它反映了有条件预测与无条件预测之间的差异。将这一值乘以大于1的$s$，会进一步强化这一方向，使图像更贴近文本描述，但同时也会降低图像的多样性。

- 在实际应用中，Stable Diffusion的默认值通常为$s=7.5$。当$s=1.0$时，得到的是模型的原始输出结果——图像具有多样性，但与提示词的匹配度较低；而当$s=20+$时，图像会变得过度饱和且重复性较高，不过与文本的匹配度则非常高。最佳$s$值取决于具体应用场景：需要创意探索时宜使用较低的引导强度，而需要严格遵循提示词时则需较高的引导强度。

### Imagen：结合语言理解的级联扩散模型

- **Imagen**（Saharia等人，2022年）表明，强大的文本编码器比更大的图像模型更为重要。Imagen没有使用CLIP，而是采用了经过冻结处理的**T5-XXL**语言模型作为文本编码器——该模型对语言语义、组合结构以及空间关系（如“红色球体上方有一个蓝色立方体”）有更深入的理解。

- Imagen采用**级联扩散**技术：首先由基础扩散模型生成64×64分辨率的图像，接着通过第一个超分辨率模型将其放大到256×256分辨率，再通过第二个超分辨率模型最终达到1024×1024分辨率。每个阶段都是独立的扩散模型，它们都以文本作为条件输入，对于那些用于升级的模型来说，还会以较低分辨率的图像作为条件输入。这种级联结构避免了在低分辨率下处理细节问题，使得基础模型能够专注于图像的构图和语义表达，而升级模型则负责处理纹理和清晰度问题。

- Imagen还引入了**动态阈值处理**机制：在每一轮去噪过程中，预测得到的像素值会被限制在基于百分位数的范围内，而非固定的$[-1, 1]$范围内。这有助于避免在高引导强度下出现的图像过饱和现象，而这种现象在扩散模型中较为常见。

### Parti：大规模自回归模型

- **Parti**（Pathways自回归文本到图像模型，Yu等人，2022年）以大规模应用的形式重新启用了自回归方法。与DALL-E类似，它也先将图像转换为离散的令牌（使用ViT-VQGAN），然后通过变换器逐个生成这些令牌。不过Parti使用了拥有200亿参数的编码器-解码器变换器（基于Pathways架构），并证明了只要规模足够大，自回归模型也能达到与扩散模型相当的质量。

- Parti的编码器-解码器架构与DALL-E仅包含解码器的设计有所不同。文本先经过编码器处理，解码器在生成图像令牌时会交叉参考已编码的文本信息。这一机制类似于机器翻译过程（第07章）——即从“文本语言”转换为“图像语言”。

### 基于DiT和流模型的生成方法

- **扩散变换器（DiT）**（Peebles和Xie，2023年）用普通的变换器取代了扩散模型中的U-Net结构。每个含噪声的潜在特征块都被视作一个令牌（类似于第8章中的ViT），然后变换器通过自注意力机制以及与文本条件的交叉注意力机制来处理这些令牌。DiT研究表明，相比U-Net，变换器在处理扩散任务时具有更好的可扩展性——计算量翻倍时，FID分数通常会下降一半。

- **流匹配**技术（源自第8章）已成为扩散模型中噪声预测方法的替代方案。该技术不再试图预测需要减去的噪声$\epsilon$，而是预测一个速度$v_\theta(x_t, t)$，让样本沿着直线从噪声状态逐步过渡到数据状态。**Stable Diffusion 3**和**Flux**都采用了流匹配技术，并结合了**多模态DiT（MM-DiT）**架构，在该架构中，文本和图像令牌会通过带有双向注意力机制的变换器模块共同处理——两种模态之间可以相互影响，而不仅仅是文本通过交叉注意力机制来影响图像特征。

![DiT架构：含噪声的潜在特征块被像ViT那样转化为令牌，随后由带有自适应层归一化功能的变换器模块进行处理，以实现时间步和类别条件的控制，最后再将结果解码为空间潜在特征](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/dit_architecture.svg)

## 文本到视频的生成

- 文本到视频生成实际上是在文本到图像生成的基础上增加了另一个严格的约束条件：**时间一致性**。每一帧都必须是合理的图像，同时连续的帧之间也必须平滑衔接——物体应自然移动，光线应持续变化，而“摄像机”的运动轨迹也应符合物理规律。这就好比绘制一幅风景画与拍摄一部电影之间的区别。

### 时间相关的挑战

- 相比于图像生成，视频生成还面临着三个额外的挑战。**时间一致性**要求物体在不同帧中保持相同的身份——比如第1帧中的狗在第100帧时仍应是同一只狗。**运动建模**则需要理解物体的运动规律、重力的作用方式以及流体的流动特性。此外，**计算成本**也非常高：一段时长为10秒、帧率为24帧/秒、分辨率为512×512的视频，所含的数据量约为$10 \times 24 \times 512 \times 512 \times 3 \approx 188$百万，这一数值大约是一张图像数据量的240倍。

### Make-A-Video与扩展到视频的方法

- **Make-A-Video**（Singer等人，2022年）采用了一种实用的方法：从预训练的文本到图像模型出发，再为其添加时间相关模块。其核心思路在于，我们已经拥有了基于数十亿组图像-文本对训练而成的强大文本-图像模型，因此只需从（无标签的）视频数据中学习运动规律即可。

- Make-A-Video在预训练好的空间U-Net结构中加入了**时间注意力**和**时间卷积**模块。那些针对图像预训练的空间模块负责处理图像的外观特征，而新添加的时间模块则负责处理运动信息。空间自注意力在每帧内部起作用，而时间注意力则在每个空间位置上跨帧起作用。由于时间模式和空间模式在很大程度上是相互独立的，因此这种分解方式具有很高的效率。
- 该生成流程与Imagen的流程类似：首先由基础模型生成16帧64×64分辨率的图像，随后通过空间和时间超分辨率模型将分辨率和帧率提升到最终标准。帧插值网络则用于提升视频的时间连续性。

### VideoPoet与基于令牌的视频模型

- **VideoPoet**（Kondratyuk等人，2024年）将视频生成纳入语言建模框架之下。文本、图像、视频、音频等各类数据都被转换为离散的令牌序列，然后通过一个大型语言模型来自动预测这些令牌。这样一来，就可以实现零样本生成功能——文本转视频、图像转视频、视频转音频、视频编辑以及图像修复等功能都可以通过同一个模型来完成。

- VideoPoet使用MAGVIT-v2编码器对视频进行令牌化处理（这是一种3D VQ-VAE编码器，详见文件03），该编码器能够同时压缩视频的空间维度和时间维度。音频则通过SoundStream算法进行令牌化处理。大型语言模型首先在文本数据上预训练，然后在多模态令牌序列上进行微调，从而学习不同模态之间的关联规律。

### Sora风格的时间扩散模型

- **Sora**（OpenAI，2024年）凭借其生成长时长、连贯且符合物理规律的视频的能力，让时间扩散模型得到了广泛应用。虽然其完整架构细节并未公开，但其核心思路是将DiT模型扩展到时空维度：视频帧被分解为**时空块**（即高度、宽度和时间维度的3D数据块），这些时空块会被当作令牌输入到大型变换器中进行处理。

- 这种时空块处理方式意味着该模型可以将视频视为一种原生3D信号，而非一系列2D帧。这样一来，模型就能捕捉到更长时间范围内的依赖关系——它可以在整个视频时长范围内“提前规划”，而无需逐帧生成。

- Sora可以通过调整时空块的数量来处理不同时长、分辨率和宽高比的视频。在原始分辨率下进行训练（而非将所有视频裁剪为正方形），可以提高视频的构图和画面质量。

### Wan：开源视频生成模型

- **Wan**（Wan等人，2025年）是一系列开源视频生成模型，拥有13亿和140亿个参数，它们基于DiT架构，并结合3D VAE进行时间维度压缩。Wan采用**流匹配**技术而非传统的DDPM式扩散模型，从而直接从噪声中生成视频的潜在表示。3D VAE负责对视频的空间和时间维度进行压缩（可实现4倍的时间压缩），而DiT则利用完整的3D注意力机制处理这些时空令牌。

- Wan支持文本转视频、图像转视频（将静态图像转化为动画）以及视频编辑功能。140亿参数版本的模型能够生成最长5秒、720p分辨率的连贯视频，这表明只要合理设计架构和训练方法，开源模型也能达到商业系统的质量水平。

![文本转视频流程：文本先由语言模型编码，接着通过时间扩散变换器结合文本嵌入信息去除时空噪声，最后由3D VAE解码为视频帧](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/text_to_video_pipeline.svg)

## 文本转音频生成

- 想象一下电影作曲家阅读剧本并为影片配乐的场景。文本转音频模型就是做类似的事情：给定一段文字描述（如“一场伴有大雨和远处雷声的暴风雨”），它们就能生成对应的音频波形。其中的挑战在于如何弥合文本的离散、符号化特性与声音的连续、时间性特性之间的差距。

### AudioLM：用于音频的语言建模模型

- **AudioLM**（Borsos等人，2023年）通过自回归方式预测离散的音频令牌来生成音频，其原理与DALL-E处理图像时所使用的语言建模方法类似。该模型采用分层令牌结构：**语义令牌**（来自w2v-BERT这类自监督模型，详见第9章）用于表达高层次的内容（即正在被描述或播放的内容），而**声学令牌**（来自SoundStream这种神经音频编码器）则用于捕捉细微的声学特征（如音色、录音质量等）。

- 生成过程分为两个阶段。首先，一个变换器会根据可选的音频提示来预测语义令牌，从而确定视频的高层次内容框架。其次，另一个变换器会在语义令牌的基础上预测声学令牌，从而补充具体的声学细节。这种分层结构与文本转语音的流程类似——语义令牌相当于音素，而声学令牌则相当于梅尔频谱图中的各帧数据。

- AudioLM能够生成语音续写内容（给定3秒钟的语音，可生成接下来的10秒钟内容）、音乐续写内容以及各种音效，而且所有这些功能都可通过同一个仅在音频数据上训练的模型来实现（预训练时无需文本标签）。

### MusicLM：受文本引导的音乐生成模型

- **MusicLM**（Agostinelli等人，2023年）在AudioLM的基础上增加了文本引导功能，实现了受文本控制的音乐生成。它引入了一种文本-音频联合嵌入机制（来自**MuLan**，这是一种类似CLIP的模型，专为音乐与文本的对齐而设计），以此来指导音乐的生成过程。MuLan嵌入能够捕捉文本描述中的语义含义（如“带有萨克斯独奏的欢快爵士乐”），并引导分层令牌的生成。

- MusicLM能够以24kHz的采样率生成任意时长的一段音乐，即便是在数分钟长的作品中，也能保持旋律和节奏的连贯性。它还可以根据哼唱的旋律（通过音高检测器提取出的旋律令牌）以及文本描述来生成音乐，最终得到的作品会遵循文本描述的风格和旋律。

### MusicGen：高效的单阶段生成模型

- **MusicGen**（Copet等人，2023年）简化了多阶段处理流程。它没有使用独立的语义模型和声学模型，而是采用单一的自回归变换器，直接从音频编码器中生成多个代码本层级的内容。其核心创新在于**交错式代码本结构**：无需在进入下一个时间步之前先生成所有代码本层级的内容，MusicGen以一种交错的方式处理不同代码本层级及时间步的符号，从而实现某些代码本层级的并行解码。

- 条件控制方式很简单：文本通过T5编码器进行编码，这些文本嵌入会被添加到音频符号序列的开头（类似于语言模型中的前缀提示），或者通过跨注意力机制注入到序列中。MusicGen还支持旋律条件控制：参考旋律的频谱图特征会被编码后与文本条件一起使用。

$$p(a_1, \ldots, a_T) = \prod_{t=1}^{T} \prod_{k=1}^{K} p(a_{t,k} \mid a_{<t}, c_{\text{text}})$$

其中，$a_{t,k}$表示时间步$t$、代码本层级$k$处的音频符号，$c_{\text{text}}$则表示文本条件。由于代码本结构的存在，上式中的求和可以分解为多个部分——某些代码本层级是并行预测的。

![文本到音频的生成流程：文本由语言模型编码，变换器解码器以交错方式在多个代码本层级上生成离散的音频符号，最终由音频编码器解码器还原出波形](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/text_to_audio_pipeline.svg)

## 图像到文本生成

- 现在反过来：给定一张图像，生成自然的文字描述。这就是**图像字幕生成**，属于条件文本生成的一种形式，其中图像就是条件输入。想象一下博物馆导览员在描述一幅画作——他们需要理解画面内容、把握各元素之间的关系，并用流畅的语言表达自己的观察结果。

### 将字幕生成视为条件生成任务

- 传统方法采用**编码器-解码器**架构（第07章）。预训练的CNN或ViT模型（第8章）会将图像编码为一组特征向量。语言模型解码器则逐词生成字幕，在每一步都会关注图像的特征：

$$p(w_1, \ldots, w_L \mid I) = \prod_{l=1}^{L} p(w_l \mid w_1, \ldots, w_{l-1}, I)$$

其中，$w_l$是字幕中的各个单词，$I$则是图像的表示形式。跨注意力机制将文本解码器与图像特征相连，使得模型在生成不同单词时能够“查看”图像的不同区域——在生成“狗”这个词时关注狗所在的区域，在生成“公园”时则关注公园所在区域。

- **CoCa**（对比学习字幕生成器，Yu等人，2022年）将对比学习技术（即文件01中提到的CLIP风格的目标函数）与字幕生成功能整合到了同一个模型中。图像编码器生成的特征既可用于与文本的对比对齐，也可用于字幕生成解码器中的跨注意力计算。这种多任务训练使得CoCa具备强大的零样本识别能力（来自对比学习）以及出色的生成能力（来自字幕生成功能）。

### 现代视觉-语言字幕生成技术

- 现代方法通常会使用**大型多模态模型**（文件02）来进行字幕生成。像LLaVA、Qwen-VL和GPT-4V这样的模型将字幕生成视为视觉问答的一种特例——其中的“问题”其实就是“描述这张图片”。视觉编码器（如CLIP ViT或SigLIP）会将图像分割成多个块，这些块会被映射到大语言模型的嵌入空间中，随后大语言模型就会生成自由的文字描述。

- 相比于专门的编码器-解码器模型，基于大语言模型的字幕生成方法的优点在于**指令遵循能力**：用户可以要求不同细节程度的描述（比如“用一句话描述”或“写一段详细的描述”），也可以聚焦于特定方面（比如“描述颜色”），或是生成结构化的输出（比如“列出所有物体及其位置”）。这种灵活性得益于大语言模型的指令微调技术（第07章）。

## 视频-音频协同生成

- 想象一下在关闭声音的情况下观看电影——那种体验会很空洞。视觉内容和音频是紧密关联的：弹跳的球会发出有节奏的撞击声，雨声会有滴答声，人群则会发出欢呼声。**视频-音频协同生成**的目标就是同时生成这两种模态的内容，确保所看到的画面与听到的声音在时间上保持同步。

### 联合时间建模

- 最核心的挑战在于**时间同步**：鼓声的音频必须与显示鼓槌击打鼓面的画面完全同步。这就需要一个双方都能参照的共同时间表示。

- 一种方法是基于共享的潜在时间线来生成视频和音频。像**CoDi**（可组合扩散模型，Tang等人，2023年）这样的模型虽然为每种模态分别使用了独立的扩散模型，但通过共享的潜在空间来实现两者之间的同步。在训练过程中，跨模态注意力层会学会在每个时间步上同步视觉和音频特征。而在生成过程中，两个扩散过程会同时运行，并通过共享的对齐机制相互影响。

- 上文提到的VideoPoet则采用了更为统一的方法：由于所有模态都被转换为单一的序列，大语言模型可以自然地学习视频和音频符号之间的时间对应关系。一段狗狗吠叫的视频片段以及对应的音频符号，就能让模型学会将视觉上的吠叫动作与听觉上的吠叫声联系起来。

- **时间对齐损失函数**则明确地用于强制实现同步。有一种实现方式是在帧级别运用对比学习：时间$t$处的音频片段应该与时间$t$处的视频帧更为相似，而不是与其他时间的帧更相似：

$$\mathcal{L}_{\text{sync}} = -\mathbb{E}_t \left[\log \frac{\exp(\text{sim}(v_t, a_t) / \tau)}{\sum_{t'} \exp(\text{sim}(v_t, a_{t'}) / \tau)}\right]$$

- 其中，$v_t$和$a_t$分别表示时间$t$时的视频与音频表示，$\tau$为温度参数。该方法的结构与文件01中的InfoNCE损失函数相同，只不过它是作用于时间帧层面而非视频片段层面。

## 指令遵循型生成

- 想象一下，你可以告诉艺术家“让天空看起来更富有戏剧性”，或者“用皇冠替换那顶帽子”。**指令遵循型生成**允许人们通过自然语言指令来编辑图像，而无需使用精确的空间掩码或绘图工具。

### InstructPix2Pix：基于描述的图像编辑

- **InstructPix2Pix**（Brooks等人，2023年）是一种条件扩散模型，它接收输入图像和文本指令，进而生成编辑后的图像。其巧妙之处在于训练数据的生成方式：GPT-3负责生成编辑指令（如“让场景变成冬季”、“把猫变成狗”），同时生成对应的输入输出文本描述；而文本到图像模型（Stable Diffusion）则负责生成相应的图像对。

- 该模型是对Stable Diffusion U-Net的改进版本，它通过交叉注意力机制接收文本指令，同时还将输入图像的潜在特征与含噪声的潜在特征按通道方式拼接在一起。该模型采用**双无分类器引导机制**，设有两个引导系数——一个用于处理文本指令（$s_T$），另一个用于处理输入图像（$s_I$）：

$$\hat{\epsilon} = \epsilon_\theta(x_t, \varnothing, \varnothing) + s_I \cdot (\epsilon_\theta(x_t, c_I, \varnothing) - \epsilon_\theta(x_t, \varnothing, \varnothing)) + s_T \cdot (\epsilon_\theta(x_t, c_I, c_T) - \epsilon_\theta(x_t, c_I, \varnothing))$$

- 其中，$c_I$代表输入图像的特征，$c_T$代表文本指令。第一个引导系数控制着对原始图像的保留程度；第二个系数则控制着对指令的遵循程度。这样，用户就可以通过两个参数来调整编辑效果：较高的$s_I$值能更好地保留原始图像的特征，而较高的$s_T$值则能使图像产生更显著的编辑效果。

![InstructPix2Pix：输入图像和文本指令被输入到经过改进的扩散模型中，从而生成出既符合指令要求又能保留未编辑区域的图像](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/instructpix2pix_pipeline.svg)

### 基于随机噪声的编辑方法

- **SDEdit**（Meng等人，2022年）提供了一种更为简单的编辑方法，无需特殊训练即可使用。用户只需获取输入图像，向其添加噪声（即将扩散过程进行到某个中间时间步$t_0$），然后通过描述期望输出结果的文本提示来去除噪声。噪声的量决定了编辑的强度：较少的噪声只会改变图像的颜色或风格，而较多的噪声则可以实现图像结构的重大调整，比如替换物体或改变布局。

- 这种方法的原理是明确的：在时间步$t_0$时，带有噪声的图像仍保留着原始图像$\bar{\alpha}_{t_0}$比例的特征信息。后续的去噪过程会根据新的文本提示来补充那些被破坏的细节。这一过程有数学依据：扩散模型是从后验分布$p(x_0 \mid x_{t_0}, c)$中采样，而$x_{t_0}$则确保生成的图像“接近”原始图像。

### ControlNet：空间控制机制

- **ControlNet**（Zhang等人，2023年）为文本到图像的扩散模型增加了精细的空间控制功能。预先训练好的U-Net编码器的副本会被训练出来，以便接受额外的输入条件——如边缘图、深度图、姿态骨架图、分割图等——而原来的U-Net权重则保持不变。ControlNet编码器的输出通过**零卷积**（即初始值为零的1x1卷积）被加到固定不变的U-Net的跳跃连接上，这样就能在保持预训练模型行为的基础上逐步学习新的条件。

- 通过这种架构，用户可以提供草图、深度图或人体姿态作为结构指导，而文本提示则负责决定图像的外观。预训练的权重负责处理图像的真实感以及文本理解功能；ControlNet层则负责确保图像符合所给定的空间条件。

## 一致性及对齐度指标

- 如何判断生成的图像是否合格呢？“合格”这一标准至少包含两个维度：**质量**（图像看起来是否像真实图像？）以及**对齐度**（图像是否与文本提示一致？）。目前已有多种指标可用于量化这些方面。

### Frechet Inception距离（FID）

- **Frechet Inception距离（FID）**（Heusel等人，2017年）用于衡量生成图像与真实图像在预训练好的Inception网络特征空间中的分布差异。可以将其理解为比较两组图像集合的“指纹”，而非单独比较每张图像。

- 真实图像集和生成图像集都会被输入到Inception-v3网络中，然后提取倒数第二层的激活值。这些激活值会被视为多元高斯分布$\mathcal{N}(\mu_r, \Sigma_r)$和$\mathcal{N}(\mu_g, \Sigma_g)$。FID值就是这两个高斯分布之间的Frechet距离（即Wasserstein-2距离）：

$$\text{FID} = \|\mu_r - \mu_g\|^2 + \text{Tr}\left(\Sigma_r + \Sigma_g - 2(\Sigma_r \Sigma_g)^{1/2}\right)$$

- FID值越低，说明图像质量越好。当FID值为0时，意味着两种图像的分布完全相同。FID值既能反映图像的质量（如果生成的图像模糊，其特征就会与真实图像有所不同），也能反映图像的多样性（如果模型出现模式崩溃现象，$\Sigma_g$的值就会小于$\Sigma_r$）。在ImageNet 256x256数据集上，当前最先进的模型其FID值通常低于2.0。

- 不过，FID方法也存在一些局限性：它假设特征分布为高斯分布（实际上这只是近似值）；为了获得稳定的评估结果，需要数千个样本；此外，它还依赖于Inception网络的特征，而这些特征可能无法捕捉到所有对视觉感知有影响的差异。

### Inception分数（IS）

- **Inception Score（IS）**（Salimans等人，2016年）用于衡量两个指标：首先，每个生成的图像都应能够被准确分类（条件类分布$p(y \mid x)$应呈现峰值分布）；其次，所有生成的图像应涵盖多种类别（边际分布$p(y) = \mathbb{E}_x[p(y \mid x)]$应呈均匀分布）。IS通过KL散度将这两个指标结合在一起：

$$\text{IS} = \exp\left(\mathbb{E}_x \left[D_{\text{KL}}(p(y \mid x) \| p(y))\right]\right)$$

- IS值越高，表示生成质量越好。其最大值等于类别总数（在ImageNet数据集中为1000）。IS既能够反映图像的质量（清晰度、可识别性），也能体现多样性（对不同类别的覆盖程度），但它也存在明显局限性：它完全忽略了真实数据的分布情况，无法检测出某个类别中存在的模式缺失问题，而且由于使用了Inception模型的类别预测结果，因此更倾向于生成类似ImageNet风格的图像。

### CLIPScore：衡量文本与图像的匹配程度

- **CLIPScore**（Hessel等人，2021年）利用预训练好的CLIP模型直接评估生成的图像与其对应文本提示的匹配程度。该得分其实就是CLIP模型生成的图像嵌入向量与文本嵌入向量之间的余弦相似度：

$$\text{CLIPScore}(I, T) = \max(0, \cos(E_I(I), E_T(T)))$$

其中，$E_I$和$E_T$分别是CLIP模型的图像编码器与文本编码器。CLIPScore无需参考真实图像，只需文本提示即可进行计算。它的结果与人类对文本-图像匹配程度的判断高度相关，因此已成为评估文本到图像模型生成效果的标准指标。

- 如果需要与参考图像进行比较，可以使用**RefCLIPScore**，该指标会引入参考图像作为对比：

$$\text{RefCLIPScore} = \text{HarmonicMean}(\text{CLIPScore}(I, T), \max(0, \cos(E_I(I), E_I(I_{\text{ref}}))))$$

这样就能在确保文本匹配度的同时，兼顾图像与参考图像的视觉相似性。

![评估指标：FID用于比较真实图像集与生成图像集的特征分布，IS仅用于衡量生成图像的质量与多样性，而CLIPScore则用于衡量图像嵌入向量与文本嵌入向量之间的余弦相似度](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/generation_evaluation_metrics.svg)

### 人类评估

- 自动化评估指标只是近似值，人类的判断才是最可靠的标准。常见的评估方法包括**成对比较**（判断两幅图像中哪一幅更符合文本提示）、**李克特量表评分**（从1到5对图像的质量和匹配度进行评分），以及**Elo评分系统**（通过比赛形式对不同模型进行排名）。DrawBench和PartiPrompts等基准测试工具提供了标准化的测试数据集，便于进行系统化的人类评估。

## 伦理考量

- 跨模态生成是人工智能领域中最具伦理意义的领域之一。能够根据文本描述生成逼真的图像、视频和音频，这一技术引发了诸多严重问题，从业者必须认真对待。

### 深度伪造与虚假信息

- **深度伪造**指的是那些被刻意制作或篡改的媒体内容，用来虚构从未发生过的事件。文本到图像和文本到视频的模型可以生成极具真实感的虚假照片、伪造的证据，以及具有误导性的新闻图片。其危害不仅在于虚假内容的存在，更在于这些内容会破坏人们对所有媒体的信任——如果任何图像都可能是假的，那么就没有任何图像是可以完全信赖的。

- 目前用于检测深度伪造的方法包括：使用真实图像与生成图像来训练分类器、分析统计上的异常特征（GAN生成的图像往往具有特定的光谱特征），以及嵌入不可见的水印（如Stable Diffusion中的隐形水印、Google的SynthID）。不过，检测工作其实是一场持续升级的“军备竞赛”：随着生成技术的进步，检测方法也必须不断更新。

### 生成内容中的偏见问题

- 在互联网规模的数据上训练得到的模型，会继承并放大社会中的各种偏见。文本到图像模型往往会生成肤色较浅的面部图像，将某些职业与特定性别联系起来，而对于描述不明确的请求，则默认采用西方文化标准。这些偏见源于训练数据的分布情况，以及CLIP/T5文本编码器本身所携带的偏见。

- 减少这类偏见的策略包括：筛选更具代表性的训练数据、对文本编码器应用去偏见处理技术、使用安全分类器过滤有害输出，以及让用户能够控制生成的图像中的人种属性等。不过，这些方法都无法彻底解决问题，因此持续的审核工作仍然十分必要。

### 内容过滤与安全性

- 负责任地部署生成模型需要多层防护措施。**输入过滤**可以在图像生成之前阻止有害的文本提示进入系统；**输出过滤**则用于对生成的图像进行分类，剔除有害内容；**NSFW分类器**则用于检测包含色情、暴力或其他有害内容的图像。例如，Stable Diffusion的安全检查机制就会计算生成图像的CLIP嵌入向量与一组预定义的有害概念嵌入向量之间的余弦相似度，一旦超过阈值就会标记该图像为有害内容。

- 由于许多生成模型都是开源的（如Stable Diffusion、Wan），这就使得在实现技术普及与防止滥用之间出现了矛盾。一旦模型的权重被公开，内容过滤措施就可能被绕过。这一问题引发了关于开放程度的适当标准以及模型开发者应承担责任的讨论。

### 知识产权与用户同意

- 基于互联网数据训练得到的生成模型，可能会在未经授权的情况下复制受版权保护的风格、商标，或是真实人物的形象。相关的法律和伦理规范仍在不断完善中，但负责任的做法应当包括尊重用户的拒绝选项、承认训练数据中所包含的创意成果，以及开发技术手段来防止模型记住并重复训练数据中的内容。

## 编程任务（可使用CoLab或笔记本完成）（续2）

1. 为一个简单的2D扩散模型实现无需分类器的引导机制。首先在2D数据集上训练一个条件扩散模型（例如带有标签的聚类数据），然后通过不同的引导参数进行采样，观察图像质量与多样性之间的权衡关系。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Toy 2D conditional diffusion with classifier-free guidance
def noise_schedule(T):
    betas = jnp.linspace(1e-4, 0.02, T)
    alphas = 1.0 - betas
    return jnp.cumprod(alphas)

def forward_diffuse(x0, t, alpha_bars, key):
    noise = jax.random.normal(key, x0.shape)
    return jnp.sqrt(alpha_bars[t]) * x0 + jnp.sqrt(1 - alpha_bars[t]) * noise, noise

# Generate labelled 2D data: class 0 = ring, class 1 = cluster
key = jax.random.PRNGKey(42)
k1, k2, k3 = jax.random.split(key, 3)
theta = jax.random.uniform(k1, (200,)) * 2 * jnp.pi
ring = jnp.stack([jnp.cos(theta), jnp.sin(theta)], axis=1) * 2
ring += jax.random.normal(k2, ring.shape) * 0.1
cluster = jax.random.normal(k3, (200, 2)) * 0.3

data = jnp.concatenate([ring, cluster])
labels = jnp.concatenate([jnp.zeros(200), jnp.ones(200)])

# Simulate CFG: show how guidance pushes samples toward class-conditional modes
# Try varying guidance_scale from 0.0 to 5.0 and observe results
guidance_scales = [0.0, 1.0, 3.0, 7.0]
fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, s in zip(axes, guidance_scales):
    ax.scatter(ring[:, 0], ring[:, 1], s=8, alpha=0.4, label='Ring (c=0)')
    ax.scatter(cluster[:, 0], cluster[:, 1], s=8, alpha=0.4, label='Cluster (c=1)')
    ax.set_title(f'Guidance scale s={s}')
    ax.set_xlim(-4, 4); ax.set_ylim(-4, 4)
    ax.set_aspect('equal'); ax.legend(fontsize=7)
plt.suptitle('Experiment: vary guidance scale and observe quality vs diversity')
plt.tight_layout(); plt.show()
# Exercise: train a small MLP denoiser with class conditioning,
# then implement the CFG formula to sample with different s values.
```

1. 使用完整的Frechet距离公式，计算两组2D样本之间的FID值。改变生成的分布，观察FID值的变化情况。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def compute_fid(real, generated):
    """Compute Frechet distance between two 2D sample sets."""
    mu_r, mu_g = jnp.mean(real, axis=0), jnp.mean(generated, axis=0)
    sigma_r = jnp.cov(real.T)
    sigma_g = jnp.cov(generated.T)
    diff = mu_r - mu_g
    # Matrix square root via eigendecomposition
    product = sigma_r @ sigma_g
    eigvals, eigvecs = jnp.linalg.eigh(product)
    sqrt_product = eigvecs @ jnp.diag(jnp.sqrt(jnp.maximum(eigvals, 0))) @ eigvecs.T
    fid = jnp.sum(diff ** 2) + jnp.trace(sigma_r + sigma_g - 2 * sqrt_product)
    return fid

key = jax.random.PRNGKey(0)
k1, k2, k3, k4 = jax.random.split(key, 4)

# Real distribution: standard 2D Gaussian
real = jax.random.normal(k1, (1000, 2))

# Generated distributions with increasing divergence
shifts = [0.0, 0.5, 1.0, 2.0, 4.0]
fig, axes = plt.subplots(1, len(shifts), figsize=(18, 3.5))
for ax, shift in zip(axes, shifts):
    gen = jax.random.normal(k2, (1000, 2)) * (1 + shift * 0.2) + shift
    fid = compute_fid(real, gen)
    ax.scatter(real[:, 0], real[:, 1], s=3, alpha=0.3, label='Real')
    ax.scatter(gen[:, 0], gen[:, 1], s=3, alpha=0.3, label='Generated')
    ax.set_title(f'Shift={shift}\nFID={fid:.2f}')
    ax.set_xlim(-5, 8); ax.set_ylim(-5, 8)
    ax.set_aspect('equal'); ax.legend(fontsize=7)
plt.suptitle('FID increases as generated distribution diverges from real')
plt.tight_layout(); plt.show()
# Try: change the variance of generated samples without shifting the mean.
# How does FID respond to a diversity mismatch vs a location mismatch?
```

1. 使用随机投影来替代CLIP，从而实现文本嵌入与图像嵌入之间的CLIPScore计算。观察当不同模态之间的“对齐程度”发生变化时，余弦相似度的表现如何。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def cosine_similarity(a, b):
    return jnp.dot(a, b) / (jnp.linalg.norm(a) * jnp.linalg.norm(b))

def clip_score(img_emb, txt_emb):
    """CLIPScore: clamped cosine similarity."""
    return jnp.maximum(0.0, cosine_similarity(img_emb, txt_emb))

key = jax.random.PRNGKey(42)
dim = 512  # CLIP embedding dimension

# Simulate aligned and misaligned pairs
# Aligned: image and text embeddings share a component
k1, k2, k3 = jax.random.split(key, 3)
shared = jax.random.normal(k1, (dim,))
shared = shared / jnp.linalg.norm(shared)

noise_levels = jnp.linspace(0, 5, 20)
scores = []
for noise in noise_levels:
    noise_vec = jax.random.normal(k2, (dim,)) * noise
    img_emb = shared + noise_vec * 0.3
    txt_emb = shared + jax.random.normal(k3, (dim,)) * noise * 0.3
    scores.append(float(clip_score(img_emb, txt_emb)))

plt.figure(figsize=(8, 4))
plt.plot(noise_levels, scores, 'o-', color='#2c3e50')
plt.xlabel('Noise level (misalignment)')
plt.ylabel('CLIPScore')
plt.title('CLIPScore decreases as text-image alignment degrades')
plt.grid(True, alpha=0.3)
plt.tight_layout(); plt.show()
# Experiment: what happens if you normalise embeddings before adding noise?
# How does dimensionality affect the score distribution?
```

## 统一多模态架构

_统一多模态架构用单一系统取代了独立的专用模型，该系统能够读取、推理并生成文本、图像、音频和视频内容。本文涵盖了任意到任意模型（如CoDi、NExT-GPT）、原生多模态大语言模型（如Gemini、GPT-4o）、多模态分词策略以及统一化所带来的架构权衡。_

## 统一的必要性

- 想象一下，有一位能说五种语言且能在句中无缝切换的翻译员。早期的多模态系统更像是分别位于不同房间的五位翻译员，每人只处理一种语言，并通过墙上的小孔传递信息。**统一多模态架构**则相当于这位通晓多种语言的翻译员：同一个模型拥有共享权重，能够在单次前向传播中读取、书写并推理文本、图像、音频、视频甚至动作数据。

- 这种统一的动机既源于实践需求，也源于理论考量。从实践角度看，为每种模态组合（文本转图像、图像转文本、音频转文本等）维护独立的专用模型会导致组合爆炸：$k$种模态最多需要$k(k-1)$条有向处理流程。而统一模型则将所有这些流程整合为单一系统。从理论角度看，人类认知并非在孤立的模块中处理视觉与语言；跨模态绑定发生在早期且深入进行，统一化正是试图模拟这一过程。

- 共享权重促进了**跨模态迁移**。一个已在文本中学会时间模式的Transformer模型（如主语先于谓语、原因先于结果），可以将同样的注意力机制应用于视频中的时间模式（物体出现先于移动）或音频中的时间模式（起始先于持续）。这相当于第7章提到的语言模型微调以及第8章提到的ImageNet预训练中的多模态迁移学习。

- 形式上，设$\mathcal{M} = \{m_1, m_2, \ldots, m_k\}$为一组合模态。统一模型定义了一个参数化的函数$f_\theta$，可将任意输入模态子集映射到任意输出模态子集：

$$f_\theta : \mathcal{P}(\mathcal{M}) \rightarrow \mathcal{P}(\mathcal{M})$$

其中$\mathcal{P}(\mathcal{M})$表示模态的幂集（所有子集）。关键约束是$\theta$大部分是共享的；仅有较薄的、特定于模态的适配层有所不同。

![高层示意图：多种模态（文本、图像、音频、视频）输入到单个共享的Transformer主干网络，并生成任意模态的输出](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/unified_multimodal_overview.svg)

- 统一化虽然前景广阔，但也存在根本性矛盾：各模态在结构上差异巨大。文本是一维离散令牌序列；图像是二维连续像素网格；音频是一维连续波形，其时间尺度与文本截然不同；视频则在图像基础上增加了时间轴。如何将这些截然不同的结构整合成Transformer可处理的单一序列，是该领域的核心工程挑战。

## 任意到任意模型

- 可以把它想象成一种通用遥控器，能通过同一界面操控电视、空调和音响系统。**任意到任意模型**就是人工智能领域的对应物：它们接受任意组合的模态作为输入，并产生任意组合的输出。

- **CoDi**（可组合扩散模型）通过训练特定模态的扩散模型，并利用共享的条件机制对齐它们的潜空间，从而实现任意到任意的生成。每种模态都有各自的扩散过程（可回顾本章第04节中的扩散模型内容），但噪声预测网络会受到一个联合交叉注意力层的调控，该层能同时接收所有输入模态的嵌入向量。这使得CoDi能够仅凭一次前向传播，就从文本提示中生成图像及对应的音频。

- **NExT-GPT**采用了不同的架构思路。它通过轻量级的**投影层**，将大语言模型主干（“大脑”）与输入端的特定模态编码器以及输出端的特定模态解码器连接起来。输入编码器（如CLIP中的图像编码器、CLAP中的音频编码器）将各模态转换为大语言模型的嵌入空间。大语言模型对合并后的令牌序列进行推理，并输出特殊的“模态信号令牌”，用以将信息路由到相应的解码器（如用于图像的Stable Diffusion、用于音频的AudioLDM）。只有投影层会被训练；大语言模型及专用编码器/解码器则保持冻结状态。

- **Gemini**（Google DeepMind）在预训练阶段即为原生多模态模型。与NExT-GPT的即插即用方式不同，Gemini的Transformer是从零开始，在文本、图像、音频和视频令牌的交错序列上进行训练的。这意味着跨模态注意力模式是在预训练过程中自然形成的，而非事后附加的。该模型使用SentencePiece分词器处理文本，并学习了类似于本章第03节所讨论的VQ方法的视觉分词器。

- **GPT-4o**（“o”代表“omni”）代表了另一种模式：一种端到端模型，其中所有模态共享同一个Transformer以及相同的下一个令牌预测目标。音频输入被处理为频谱令牌，图像被处理为图像块令牌，文本则被处理为子词令牌，所有这些都被汇入单一序列。模型生成的输出令牌随后由特定模态的解码头进行解析。其关键创新在于消除了此前像GPT-4V这样的系统所依赖的ASR、大语言模型和TTS模型级联结构，从而实现了低延迟。

![CoDi（对齐扩散）、NExT-GPT（带冻结专用模块的LLM中枢）以及Gemini风格（原生交错预训练）的架构对比](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/any_to_any_architectures.svg)

- 这些模型在集成深度上呈现出不同的层次：
- **浅层集成**（NExT-GPT）：通过训练好的适配器连接已冻结的专用模块。构建速度快，但跨模态推理能力有限。
- **中等程度集成**（CoDi）：在各模态专用生成器之间共享条件信息。对齐效果更好，但仍保持模块化结构。
- **深度集成**（Gemini、GPT-4o）：单个模型对所有模态进行端到端训练。具备最强的跨模态推理能力，但训练成本最高。

## 基于共享主干的模态专用编码器与解码器

- 可以想象一家工厂：只有一条装配线（即共享主干），但有不同的原材料装卸区（编码器）以及不同的成品发货部门（解码器）。每个装卸区专门处理特定货物，但一旦进入工厂，所有物品都会沿着同一条传送带移动。

- 统一模型的主流架构模式采用这种三部分结构：

- **模态编码器** $E_m$：将来自模态 $m$ 的原始输入转换为一系列嵌入向量 $\mathbf{h}_1^m, \mathbf{h}_2^m, \ldots, \mathbf{h}_{n_m}^m$，每个向量的维度为 $d$。
- **共享的Transformer主干** $T_\theta$：利用自注意力机制处理来自所有输入模态的拼接或交错嵌入。
- **模态解码器** $D_m$：将主干输出的嵌入向量还原为模态 $m$ 的原生格式（文本令牌、图像像素、音频波形）。

- 对于文本而言，编码器通常是嵌入查找表 $E_\text{text}(w) = \mathbf{W}_e[w]$，其中 $w$ 是令牌索引，这与第7章中介绍的Transformer模型类似。对于图像，编码器往往是**视觉Transformer**（ViT），它将图像分割成多个块并线性投影每个块，相关内容见第8章。对于音频，编码器会先计算梅尔频谱图，再通过卷积前端或音频频谱Transformer（AST）进行处理，详见第9章。

- 共享主干是一个标准的Transformer，能够对所有模态的令牌执行自注意力计算。给定拼接后的输入序列 $\mathbf{H} = [\mathbf{h}_1^{m_1}, \ldots, \mathbf{h}_{n_1}^{m_1}, \mathbf{h}_1^{m_2}, \ldots, \mathbf{h}_{n_2}^{m_2}]$，自注意力机制允许每个令牌关注其他任何令牌，而无需考虑其所属模态：

$$\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^\top}{\sqrt{d_k}}\right)\mathbf{V}$$

- 这与第7章中的注意力公式相同，只不过此时 $\mathbf{Q}$、$\mathbf{K}$ 和 $\mathbf{V}$ 包含了来自多种模态的令牌。图像块令牌可以关注文本令牌，从而无需单独的跨注意力模块即可实现跨模态推理。

- 为了让主干能够识别令牌所属的模态，会在每个令牌中加入**模态嵌入**。这类似于位置嵌入，但编码的是模态身份而非序列位置。对于来自模态 $m$ 的每个令牌，会加上一个可学习的向量 $\mathbf{e}_m \in \mathbb{R}^d$：

$$\tilde{\mathbf{h}}_i^m = \mathbf{h}_i^m + \mathbf{e}_m + \mathbf{p}_i$$

- 其中 $\mathbf{p}_i$ 是位置 $i$ 的位置嵌入。

![编码器-主干-解码器架构示意图：图像块、文本令牌和音频帧均进入共享的Transformer，输出端则有各模态专用的解码器](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/shared_backbone_multimodal.svg)

## 多模态分词

- 假设你正在写一封信，信中既包含英文文本，也有手绘草图。你可能会先写一句话，再画一张图，接着写另一句引用该图的话，最后粘贴一段乐谱。这封信实际上是一条线性流，其中交织着不同的“模态”。多模态分词正是如此：它将文本、图像、音频和视频转换为单一的扁平令牌序列，供Transformer从左到右处理。

- 对于文本而言，分词技术已经十分成熟：**字节对编码**（BPE）或SentencePiece能生成子词令牌词汇表，相关内容见第7章。难点在于如何将这一思路扩展到连续模态。

- 对于图像，主要有两种处理方式。**离散方式**利用VQ-VAE或VQ-GAN（详见本章文件03）将每张图像映射为一系列码本索引。如果码本包含 $|\mathcal{C}|$ 个条目，且图像被编码为 $n$ 个代码，那么该图像就转化为 $n$ 个来自大小为 $|\mathcal{C}|$ 的词汇表的离散令牌，可直接与文本词汇表兼容。**连续方式**则使用ViT或CNN编码器生成 $n$ 个连续嵌入向量，再将其线性投影到Transformer的嵌入维度。Gemini和GPT-4o采用了连续方式的变体；而像Parti和LlamaGen这样的自回归图像生成模型则更倾向于离散路径。

- 对于音频，信号通常会先转换为梅尔频谱图，然后通过神经音频编解码器（如EnCodec、SoundStream，它们能产生分层的离散令牌）进行离散化，或通过学习到的编码器进行连续投影。例如AudioLM将音频表示为来自多个码本层次的离散令牌序列，再对其进行自回归建模。

- 对于视频，分词技术建立在图像分词基础之上，还需压缩时间维度。常见的策略是使用**3D VQ-VAE**（如VideoGPT或文件03中的Cosmos Tokeniser），将时空块量化为离散令牌。时间压缩因子至关重要：24帧/秒的原始视频若不进行激进的时间下采样，每秒产生的令牌数量将多得难以处理。

- 一旦所有模态都被分词，它们会通过特殊的分隔符令牌**交错**成单一序列。典型的格式如下：

```text
[TEXT] The cat sits on a mat [/TEXT] [IMAGE] <img_tok_1> <img_tok_2> ... <img_tok_n> [/IMAGE] [AUDIO] <aud_tok_1> ... <aud_tok_m> [/AUDIO]
```

- 随后，Transformer利用其标准的因果（或双向）注意力机制来处理整个混合序列。模态分隔符令牌具有双重作用：它们既向模型指明模态边界，又充当“聚合点”，其表征能够总结每个模态片段的内容。

![交错排列的令牌序列，展示了文本令牌、离散图像令牌和音频编解码令牌在带有模态边界令牌的单个Transformer中流动的过程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/multimodal_tokenisation_sequence.svg)

- 一个关键的设计选择是**令牌预算**。一张图像被编码为256个令牌，而一段50个令牌的文本描述，意味着图像会占用上下文窗口中5倍于文本的资源。模型必须在分辨率（更多令牌意味着更丰富的细节）与上下文长度（更多令牌意味着更高的内存和计算成本）之间取得平衡。**令牌合并**（逐步合并相似的令牌）和**自适应令牌化**（对简单区域使用较少令牌，对复杂区域使用较多令牌）等技术有助于应对这一权衡。

## 训练方案：分阶段预训练和联合微调

- 你不会在孩子学会算术之前就教他微积分。同样，也无法从随机初始化状态开始，就同时用所有模态数据训练一个统一的多模态模型，并期望它能良好收敛。主流的方法是**分阶段训练**，即模型按照精心安排的顺序逐步学习更复杂的跨模态能力。

- **阶段1：单模态预训练。** 各模态编码器分别在大规模单模态数据集上进行独立训练。文本骨干网络通过标准的语言建模目标（下一个令牌预测）在数万亿个文本令牌上进行预训练，这与第7章的描述一致。视觉编码器则在图像分类或自监督任务（如MAE、DINO）上进行预训练，详见第8章。音频编码器则在语音识别或音频分类数据上预训练，参见第9章。这一阶段能生成强大的单模态特征提取器。

- **阶段2：跨模态对齐。** 预训练好的编码器被连接到共享的骨干网络上，模型则利用配对的多模态数据（图像-文本对、音频-转录文本对）进行对比学习或生成式训练。在此阶段，编码器权重可能被冻结（以保留单模态知识），仅更新投影层和骨干网络。正是这一阶段将CLIP式的对齐方式（见本章文件01）整合进统一模型中。

- **阶段3：联合多模态预训练。** 所有参数（或大部分参数）被解锁，模型在单模态与多模态数据混合的情况下，针对所有模态令牌采用统一的下一个令牌预测目标进行训练。损失函数为：

$$\mathcal{L} = -\sum_{t=1}^{T} \log p_\theta(x_t \mid x_{<t})$$

- 其中$x_t$可以是文本令牌、图像令牌或音频令牌。模型必须学会无论何种模态都能预测下一个令牌，这迫使它发展出真正的跨模态理解能力。

- **阶段4：指令微调与对齐。** 预训练好的模型会在经过精心挑选的指令跟随数据集上进行微调，这些数据集包含多模态指令（例如：“详细描述这张图片”、“这段视频发出什么声音？”、“生成X的图像”）。这一阶段通常采用**基于人类反馈的强化学习**（RLHF）或直接偏好优化（DPO）技术，以使模型输出更符合人类偏好。

- **特定模态的预热**是一种用于防止模态崩溃的技术。如果某种模态（通常是数据量最大的文本）主导了梯度信号，模型可能会“遗忘”较弱的模态。常见的预热策略包括：
- **梯度平衡**：调整各模态的梯度，使其对参数更新的贡献相等。
- **数据比例调度**：逐步增加多模态数据与单模态数据的比例。
- **损失加权**：为不同模态分配特定的权重$\lambda_m$，使得总损失为$\mathcal{L} = \sum_m \lambda_m \mathcal{L}_m$，通过调整$\lambda_m$来平衡各模态的学习速率。

![四阶段训练流程示意图，展示了单模态预训练、跨模态对齐、联合多模态预训练以及指令微调过程，箭头标示了各阶段中哪些参数被冻结或可训练](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/staged_multimodal_training.svg)

- **为何不能跳过某些阶段？** 从零开始联合训练看似诱人，但在实践中却难以成功。首先，模型必须同时学习低层特征（如边缘检测、音素识别）和高层的跨模态推理能力，这两者的学习动态截然不同。其次，不同模态的数据分布极不均衡（文本令牌达万亿级，图像令牌为数十亿级，音频剪辑仅为数亿级）。第三，优化空间高度非凸，分阶段训练提供了一种类似第6章所述课程学习的引导机制，帮助模型进入更好的优化区域。

## 多模态思维链推理

- 解决几何问题时，你可能会先画出示意图、标注角度、写出方程式，再逐步求解。你不会直接从题目陈述跳到答案。**多模态思维链**（CoT）推理使模型也能如此操作：在得出最终答案前，生成涉及文本、视觉标注甚至生成式示意图的中间推理步骤。
- 在纯文本思维链中（如第7章关于提示词策略的讨论所述），模型会以自然语言生成一系列推理步骤。多模态思维链则进一步扩展了这一机制，允许中间步骤引用或生成视觉内容。例如，给定一张图表图像以及问题“哪一年的销售额最高？”，多模态思维链模型可能会先描述该图表（“图表显示了2018年至2023年的销售情况……”），接着识别相关的视觉特征（“最高的柱状图出现在2021年……”），最后给出答案（“2021年”）。

- 形式上，设$\mathbf{x}$为多模态输入，$y$为目标答案。标准预测模型$p(y \mid \mathbf{x})$直接输出结果。而思维链机制引入了中间推理过程$\mathbf{r} = (r_1, r_2, \ldots, r_L)$，并将预测过程分解为：

$$p(y \mid \mathbf{x}) = \sum_{\mathbf{r}} p(y \mid \mathbf{r}, \mathbf{x}) \cdot p(\mathbf{r} \mid \mathbf{x})$$

- 实践中，该求和过程通过基于推理链的贪心解码或束搜索来近似实现。推理步骤$r_i$可以是文本令牌、对图像区域的引用，甚至是生成的视觉令牌（例如叠加在输入图像上的边界框标注）。

- **训练多模态思维链**通常需要整理数据集，由人工标注者提供逐步的多模态推理轨迹，随后在此基础上对模型进行微调。有些方法则是从更大的教师模型中提炼思维链能力：教师模型为大规模数据集生成推理轨迹，较小的学生模型则同时利用输入数据和教师的轨迹进行训练。

- 多模态思维链在需要**空间推理**（例如：“红色球是否在蓝色立方体左侧？”）、**基于图表的数学推理**（如几何问题）以及**多步视觉问答**的任务中尤为有效；这类任务的答案往往依赖于整合图像中多个区域的信息。

## 多模态智能体

- 想象一下厨房里的机器人厨师：它观察台面上的食材（视觉），读取平板电脑上的食谱（文本），聆听计时器的蜂鸣声（音频），然后亲手拿起刀切碎洋葱（动作）。**多模态智能体**就是这种机器人的数字版本：一种能够通过多种模态感知世界、推理下一步行动并基于感知结果执行动作的模型。

- 智能体的运作遵循经典的**观察-推理-行动**循环：

1. **观察**：智能体从环境中接收多模态输入（屏幕截图、用户的语音指令、视频流）。
2. **推理**：统一模型处理这些多模态输入，可能借助思维链来规划一系列步骤。
3. **行动**：模型输出相应的动作（文本回复、工具调用、在坐标$(x, y)$处点击鼠标，或机器人电机指令）。

- **工具使用**是多模态智能体的关键能力。模型被训练成能够识别何时无法直接回答问题，从而必须调用外部工具：计算器、代码解释器、网页浏览器或搜索引擎。模型会在输出令牌序列中生成结构化的工具调用指令（例如`search("伦敦当前天气")`），系统执行该调用后，结果会作为额外的输入令牌供模型继续处理。

- **视觉定位**将语言与图像或视频中的特定区域联系起来。当智能体说“点击右上角的蓝色按钮”时，它必须将短语“右上角的蓝色按钮”映射到像素坐标上。从架构上看，这可以通过训练模型以特殊令牌输出边界框坐标，或让模型生成指示目标区域的热力图来实现。这将在本章文件02（视觉语言模型）中讨论的定位与指代研究扩展到了行动领域。

- 像WebVoyager和SeeAct这样的**网页智能体**展示了多模态智能体浏览网页的能力。智能体接收网页截图，识别可交互元素（按钮、文本框、链接），并输出相应动作（点击、输入、滚动）以实现用户指定的目标。主要挑战在于庞大的动作空间：一个典型的网页可能有数百个可点击的目标。

![多模态智能体的观察-推理-行动循环，展示了来自屏幕的视觉输入、统一模型内部的推理过程，以及点击、输入或调用工具等输出动作](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/multimodal_agent_loop.svg)

- **具身智能体**则将这一过程扩展到物理环境。配备摄像头和麦克风的机器人会接收视觉与音频输入，通过统一模型处理后输出电机指令。像PaLM-E（谷歌）这样的项目直接将机器人传感器数据嵌入语言模型的令牌序列中，使机器人能够理解诸如“捡起碗旁边的绿色积木”之类的指令，将其与视觉观察结果相结合，并生成一系列电机动作。

- 智能体的训练流程在标准分阶段预训练基础上增加了**强化学习**（RL）阶段。智能体与环境互动（模拟桌面、网页浏览器、机器人模拟器），根据任务完成情况获得奖励，并利用PPO或REINFORCE等算法更新其策略。奖励信号通常较为稀疏（任务成功得1分，否则为0分），这使得优化过程颇具挑战性，高度依赖多模态预训练所提供的强大先验知识。

## 基准测试与评估

- 评估一个能够看、听、读并行动的模型需要多样化的基准测试套件。没有单一指标能够全面衡量多模态能力，因此该领域依赖一系列专门的评估方法。
- **MMLU**（大规模多任务语言理解）测试涵盖57个学术领域的知识。虽然它最初仅支持文本输入，但可作为基准：统一多模态模型在获得视觉能力后，其纯文本性能不应下降。若多模态训练后MMLU分数出现下滑，则表明发生了灾难性遗忘。

- **MMBench**从属性识别、空间关系理解及OCR等20个细粒度能力维度评估视觉-语言理解能力。每个问题包含一张图像和一道选择题。该基准旨在系统检测模型是否真正理解了图像内容，还是仅仅依赖纯文本捷径。

- **SEED-Bench**提供了涵盖图像与视频理解的19,000道选择题，涉及12个评估维度。它专门测试时间理解能力（某一帧前后发生了什么）以及组合推理能力（整合多种视觉属性）。

- **MM-Vet**要求模型在同一问题中同时运用识别、OCR、空间感知、语言生成及知识检索等多种技能，以此评估其综合多模态能力。

- **MathVista**测试基于视觉输入的数学推理能力，包括几何图形、统计图表、函数曲线及科学图示。该基准专门针对多模态思维链能力进行评估。

- 像AVQA（视听问答）这样的音视频基准测试模型能否推理所见与所闻之间的关系。例如：“说话的人是左边还是右边的人？”

- WebArena、OSWorld和SWE-bench等智能体基准测试模型在交互环境中的任务完成能力。衡量指标通常是成功率：智能体正确完成的任务比例。这些基准极具挑战性，因为它们需要长期规划与错误恢复能力。

- LMSYS Chatbot Arena等整体评估框架采用人类偏好判断的对比形式。同一多模态输入会展示给两个模型，由人类评判员选出更优的回答。通过数千次此类比较可计算出Elo评分，从而得到一个与模型整体质量高度相关的单一数值。

- 多模态评估中一个长期存在的难题是**数据污染**：由于这些模型基于互联网规模的数据进行训练，基准测试中的图像与问题可能早已出现在训练集中。严格的去重处理以及创建独立的测试集虽是必要措施，却并非万全之策。

## 世界模型

- 想象一下闭上眼睛，预测把玻璃杯从桌边推落会发生什么。你会“看到”它坠落，“听到”碎裂声，并“感觉到”这是个糟糕的主意。你的大脑正在运行一个**世界模型**：即对环境的物理与因果结构进行的内部模拟，能够跨多种模态预测未来状态。

- 在人工智能领域，世界模型是一种学习到的函数，可根据当前状态与动作预测世界的下一个状态：

$$\hat{s}_{t+1} = g_\phi(s_t, a_t)$$

- 其中，$s_t$表示当前状态表征（可能包括视觉、听觉及本体感觉信息），$a_t$为动作，$\hat{s}_{t+1}$为预测的下一状态。状态$s_t$存在于学习得到的潜在空间中，而非原始像素空间，从而使预测问题变得可行。

- Sora（OpenAI）和Genie（Google DeepMind）等**视频预测模型**代表了迈向世界模型的重要一步。它们能根据文本提示或动作序列生成时间上连贯的视频帧。尽管它们常被视作视频生成器，但其底层能力更接近于世界模拟：模型已掌握了足够的物理规律（重力、碰撞、遮挡、流体动力学），从而能渲染出合理的未来场景。

- 世界模型与多模态架构之间的联系十分紧密。仅能预测像素的世界模型是有限的；真正有用的世界模型应能跨模态进行预测。如果你推动玻璃杯，世界模型应能预测其视觉轨迹（玻璃坠落）、听觉事件（玻璃碎裂）以及语义结果（地板上出现了碎玻璃）。统一多模态架构天然适合作为世界模型，因为它们已在共享空间中表示了所有模态。

- 从形式上讲，多模态世界模型优化的目标是：

$$\mathcal{L}_\text{world} = \mathbb{E}\left[\sum_{m \in \mathcal{M}} \lambda_m \| s_{t+1}^m - g_\phi^m(s_t, a_t) \|^2 \right]$$

- 其中，$s_{t+1}^m$为模态$m$下真实的下一状态表征，$g_\phi^m$为世界模型中针对该模态的预测头。共享的潜在动态$g_\phi$在联合多模态空间中运作，而各模态特定的预测头则将预测结果解码为对应模态的原生格式。

![世界模型示意图：潜在状态因动作而更新，解码器头分别预测未来的视觉帧、音频波形及语义描述](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/multimodal_world_model.svg)

- Yann LeCun提出的**JEPA**（联合嵌入预测架构）为世界模型提供了一种避免像素级预测缺陷的框架。JEPA不在像素层面进行预测（那样会浪费容量在纹理等无关细节上），而是在嵌入空间中进行预测。该模型学习一个将观测数据映射为嵌入的编码器，以及一个预测未来嵌入的预测器：

$$\hat{\mathbf{z}}_{t+1} = h_\psi(\mathbf{z}_t, a_t), \quad \mathbf{z}_t = \text{Enc}(s_t)$$

- 该损失函数比较的是嵌入向量而非原始观测数据，因此对感知歧义具有更强的鲁棒性（许多不同的像素配置可能代表相同的语义状态）。这种方法在多模态世界模型中尤其有前景，因为它自然地在统一架构所提供的共享嵌入空间中运作。

- 世界模型的应用远不止于学术研究。在**基于模型强化学习**中，智能体利用世界模型来“预想”采取动作后的结果，从而大幅减少所需的真实世界交互次数（可回顾第11章关于基于模型强化学习的讨论）。在**自动驾驶**领域，世界模型能根据不同的转向决策预测未来几秒内场景的变化情况。在**机器人技术**中，世界模型允许机器人在执行操作前先在脑海中演练整个操作序列。

- 世界模型研究的前沿正朝着能够实时运行并响应任意用户操作的**交互式世界模型**发展，它们本质上成为完全从数据中学习得到的通用模拟器。Genie 2（谷歌DeepMind）在3D环境中展示了这一点：仅输入一张图像，它就能生成一个可供用户探索的交互式、可控的3D世界。世界模型与统一多模态架构的融合预示着这样一个未来：单一模型即可在所有模态下实现感知、预测、模拟与行动。

## 编程任务（请使用CoLab或笔记本）

### 任务1：构建一个最小化的多模态令牌交错器

- 编写一个函数，接收一个文本字符串和一个虚拟的“图像”（一个小型二维数组），将其令牌化表示交错成一个包含模态嵌入的单一扁平序列。

```python
import jax
import jax.numpy as jnp

# Simulate multimodal tokenisation: text tokens + "image patch" tokens
def interleave_modalities(text_tokens, image_patches, embed_dim=32, key=jax.random.PRNGKey(0)):
    """Interleave text and image tokens with learned modality embeddings."""
    k1, k2, k3 = jax.random.split(key, 3)
    n_text = text_tokens.shape[0]
    n_img = image_patches.shape[0]
    # Random projection matrices (stand-ins for real encoders)
    W_text = jax.random.normal(k1, (text_tokens.shape[-1], embed_dim)) * 0.02
    W_img = jax.random.normal(k2, (image_patches.shape[-1], embed_dim)) * 0.02
    # Modality embeddings: one for text, one for image
    mod_emb = jax.random.normal(k3, (2, embed_dim)) * 0.02
    text_embs = text_tokens @ W_text + mod_emb[0]  # (n_text, embed_dim)
    img_embs = image_patches @ W_img + mod_emb[1]   # (n_img, embed_dim)
    # Interleave: [IMG] tokens first, then [TEXT] tokens (like LLaVA)
    combined = jnp.concatenate([img_embs, text_embs], axis=0)
    print(f"Combined sequence: {n_img} image + {n_text} text = {combined.shape[0]} tokens")
    return combined

# Try it: 5 text tokens (dim 16) and 4 image patches (dim 64)
text = jax.random.normal(jax.random.PRNGKey(1), (5, 16))
image = jax.random.normal(jax.random.PRNGKey(2), (4, 64))
seq = interleave_modalities(text, image)
# Experiment: change embed_dim, swap the interleaving order, add a third modality
```

### 任务2：可视化跨模态注意力模式

- 创建一个合成的多模态序列，并计算自注意力分数，以观察图像令牌如何关注文本令牌，反之亦然。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def cross_modal_attention(n_text=6, n_img=4, d=32, key=jax.random.PRNGKey(42)):
    """Compute and visualise attention between text and image tokens."""
    k1, k2, k3 = jax.random.split(key, 3)
    # Simulate token embeddings for two modalities
    text_embs = jax.random.normal(k1, (n_text, d))
    img_embs = jax.random.normal(k2, (n_img, d))
    seq = jnp.concatenate([img_embs, text_embs], axis=0)  # (n_img+n_text, d)
    # Learned Q, K projections
    Wq = jax.random.normal(k3, (d, d)) * 0.1
    Wk = jax.random.normal(jax.random.PRNGKey(99), (d, d)) * 0.1
    Q, K = seq @ Wq, seq @ Wk
    scores = Q @ K.T / jnp.sqrt(d)
    attn = jax.nn.softmax(scores, axis=-1)
    # Plot
    labels = [f"img_{i}" for i in range(n_img)] + [f"txt_{i}" for i in range(n_text)]
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.imshow(attn, cmap="viridis")
    ax.set_xticks(range(len(labels))); ax.set_xticklabels(labels, rotation=45, fontsize=8)
    ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel("Key (attended to)"); ax.set_ylabel("Query (attending from)")
    ax.set_title("Cross-modal self-attention map")
    plt.colorbar(ax.images[0], ax=ax, shrink=0.8)
    plt.tight_layout(); plt.show()

cross_modal_attention()
# Experiment: increase d, add a causal mask, observe how attention patterns change
```

### 任务3：模拟分阶段训练及模态特定的损失加权

- 演示模态特定的损失权重如何影响简单的多模态训练循环。观察损失平衡如何防止某一模态占据主导地位。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def staged_training_sim(steps=200, key=jax.random.PRNGKey(7)):
    """Simulate multimodal training with adjustable modality loss weights."""
    # Two 'modalities' with different loss scales (text loss ~10x larger than image loss)
    losses_text, losses_img = [], []
    param = jnp.array([0.0, 0.0])  # Shared param updated by both modality losses
    lr = 0.05
    # Try changing these weights to see the effect on convergence balance
    lambda_text, lambda_img = 1.0, 5.0  # upweight the weaker modality

    for step in range(steps):
        k1, k2, key = jax.random.split(key, 3)
        noise_t = jax.random.normal(k1, ()) * 0.3
        noise_i = jax.random.normal(k2, ()) * 0.1
        loss_t = (param[0] - 3.0) ** 2 + noise_t  # text target = 3.0
        loss_i = 0.1 * (param[1] - 1.0) ** 2 + noise_i  # image target = 1.0 (smaller scale)
        # Weighted combined gradient
        grad_t = lambda_text * 2 * (param[0] - 3.0)
        grad_i = lambda_img * 0.2 * (param[1] - 1.0)
        param = param - lr * jnp.array([grad_t, grad_i])
        losses_text.append(float(loss_t)); losses_img.append(float(loss_i))

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(losses_text, label=f"Text loss (weight={lambda_text})", alpha=0.7)
    ax.plot(losses_img, label=f"Image loss (weight={lambda_img})", alpha=0.7)
    ax.set_xlabel("Training step"); ax.set_ylabel("Loss"); ax.legend()
    ax.set_title("Modality loss balancing during staged training")
    plt.tight_layout(); plt.show()

staged_training_sim()
# Experiment: set lambda_img=1.0 and watch image loss converge much slower
```

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
