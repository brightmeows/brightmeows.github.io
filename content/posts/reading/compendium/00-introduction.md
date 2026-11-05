---
title: "导读与学习路线"
date: "2026-11-05"
order: 0
slug: "compendium/00-introduction"
description: "全书导读与学习路线"
tags: []
---

# Maths, CS & AI Compendium 导读与学习先导

本文基于对全书 104 个正文页的逐页通读（2026 年 11 月，仓库版本），给出逐章内容总结与按目标定制的学习路线。

全书格式约定：每一页都以一段斜体导语开头，正文是直觉优先的条目式讲解（大量比喻 + LaTeX 公式），页尾固定附两道可在 Colab 直接跑的 JAX 编码任务，多数章节另有“Side Quest”补充材料（符号表、清单、冷知识）。粗体小写表示向量等记法全书通用。

---

## 逐章导读

### 第 1 章 向量（5 页，入门级）

全章定位：线性代数的地基，从“向量是什么”讲到“坐标的本源是什么”。

- **01 向量空间**：把向量空间定义为“加法与数乘都跑不出集合的封闭游戏”，用整数集不是实数域上向量空间这个反例讲封闭性的意义；逐条过公理（加法交换、零向量、加法逆、两条分配律、结合、单位元），全部配几何图示；用“把人表示成 [身高, 体重, 年龄]”引出特征向量；子空间的关键判据是必须过原点，并联系 PCA。Side Quest 是一张集合与逻辑符号速查表（∈ ⊂ ∪ ∩ ⇒ ∀ ∃ 等）。
- **02 向量性质**：模长（勾股定理推广）、方向、相等；平行 = 互为标量倍数，正交 = 互不贡献信息；线性无关/相关的直觉是“数据集里重复样本会带偏观测”；稀疏与稠密影响存储和计算；单位向量与归一化 = 去掉“多远”只留“朝哪”。
- **03 范数与度量**：L1（曼哈顿）、L2（欧几里得）、L∞（最大分量）与一般 Lp 范数，p 越大越被最大分量主导；范数三公理、度量四公理（非负、同一、对称、三角不等式）；每个范数可造度量，但不是所有度量来自范数（Hamming 距离反例）；L1 对单个大误差不敏感、L2 敏感，这决定 kNN、聚类、检索的选型。
- **04 向量积**：内积三公理；点积的几何解读 a·b = |a||b|cosθ，由此得到正交判定、投影和余弦相似度（embeddings 相似度的基础）；叉积只在 3D 有定义、右手定则、模长 = 平行四边形面积、反交换；标量三重积 = 平行六面体体积（为零即共面），向量三重积展开式与不结合性。
- **05 基与对偶**：全章最难的一页，作者自己都打了预防针。基 = 线性无关 + 张成；换基矩阵 P 及其逆（“两套语言描述同一家咖啡馆”的比喻贯穿全页）；线性泛函 = 诚实的标尺，对偶空间 V* 收拢所有标尺；对偶基就是 P⁻¹ 的行，单位矩阵是 Kronecker delta 写成的表；提醒：只有正交基下“和基向量做点积”才恰好等于坐标；结尾点题——注意力机制里 query 查询 key 就是对偶性在起作用。

前置要求：无。这章是全书真正意义上的起点。

### 第 2 章 矩阵（5 页，入门级）

全章定位：从“矩阵是数字表格”讲到“矩阵是变换本身”，是神经网络层的数学原型。

- **01 矩阵性质**：矩阵 = 向量的堆叠（三个人 × 三特征即 3×3 矩阵）；转置、迹（对角和 = 特征值之和，且与基无关）、秩（独立行数 = “有用信息量”）、秩-零化度定理（保留的维数 + 毁掉的维数 = 列数）、列空间与零空间共同完整刻画矩阵行为；行列式 = 面积/体积缩放因子，符号判定向翻转，为零即奇异（信息永久丢失）；逆矩阵、条件数（衡量小扰动被放大的程度，正交矩阵为 1、奇异矩阵无穷大）；Frobenius 范数与谱范数；正定/半正定（保证优化问题有唯一极小值；协方差矩阵、核矩阵、局部极小值处的 Hessian 都是 PSD）。
- **02 矩阵类型**：一张“结构即捷径”的清单——单位、零、对角（缩放各分量，计算极快）、对称（特征向量必正交）、三角（行列式 = 对角元之积，配合前代/回代解方程）、正交（转置即逆）、稀疏（社交网络邻接矩阵的例子）、置换、Toeplitz 与循环矩阵（卷积 = 乘 Toeplitz 矩阵、DFT 的联系）、Hermitian/酉矩阵（复数版对称/正交）、幂等（投影）、幂零、布尔、Vandermonde（多项式插值）、Hessenberg（特征值算法的中间形态）。这页当速查表用。
- **03 矩阵运算**：矩阵-向量乘 = “用 x 的分量加权组合 A 的列”，点明每个神经网络层就是 Ax + b；矩阵乘法规则（不交换、可结合、可分配）；Hadamard 积（逐元素乘，ML 里做门控/掩码）；外积（结果恒为秩 1，SVD 就是把矩阵拆成秩 1 外积之和）；矩阵乘法 O(n³) 的代价；CSR 稀疏存储格式；线性方程组 Ax = b 的“买水果”实例；实践中不直接求逆（贵且数值不稳），用分解代替；伪逆。
- **04 线性变换**：“矩阵即变换”——列向量告诉你基向量落到哪；旋转（正交、行列式 1）、缩放（对角矩阵）、反射（行列式 -1）、剪切（斜体文字的原理）；平移不是线性变换，引出仿射变换与齐次坐标（游戏引擎摆放物体的方式）；退化变换压缩维度不可逆（RGB 转灰度即此）；结尾点题：ChatGPT、Claude、Gemini 这些 Transformer 本质上就是一串线性变换。
- **05 矩阵分解**：全书数学核心页之一。高斯消元与行阶梯形是一切分解的原型（把难问题化成三角回代）；LU（一次分解多次复用）、Cholesky（对称正定专属，快两倍且兼当正定性检验）；特征值/特征向量（Av = λx，方向不变只缩放）；特征多项式、trace = 特征值之和、det = 特征值之积；大型矩阵走迭代法（幂迭代、QR 算法、逆迭代、Arnoldi/Lanczos）；对角化 A = PDP⁻¹ 让 A¹⁰⁰ 变得便宜；QR 分解与 Gram-Schmidt；SVD（任意矩阵通用，几何上 = 旋转-缩放-旋转，奇异值 = 各方向重要性，截断即最优低秩近似 → 图像压缩、伪逆）；PCA 五步流程与标准化的必要性、核 PCA；Schur 分解、NMF（非负性带来可解释的主题模型）；谱定理收尾。

前置要求：第 1 章。第 05 页是后续 PCA（统计）、注意力机制（第 7 章）、量化（第 17 章）的公共依赖，值得放慢读。

### 第 3 章 微积分（5 页，入门级）

全章定位：“数学是研究变化的学问”，从单变量求导一路铺到为什么神经网络能训练。

- **01 微分**：从直线斜率讲到极限（x→1 时的 0/0 洞例子）、差商定义的导数（割线滑向切线）；求导法则全家桶——幂、和差、积、商、链式法则；明确指出链式法则就是反向传播的数学基础；常见函数导数表（eˣ 是唯一等于自身导数的函数，这是它在 ML 无处不在的原因）；洛必达法则处理 0/0 型极限（sin x/x → 1 这个极限在信号处理里的地位）。
- **02 积分**：积分 = 曲线下有符号面积（黎曼和的极限，∫ 是拉长的 S）；不定积分与积分常数 +C；微积分基本定理两部分（牛顿-莱布尼茨公式 + 求导积分互逆）；换元法（链式法则的逆）、分部积分（乘积法则的逆，LIATE 选 u 口诀）；点明 ML 里积分出现在概率密度、期望值、ROC 曲线下面积。
- **03 多元微积分**：ML 有百万级参数，所以多变量才是主战场。偏导数（固定其他变量切片求斜率）、梯度（最陡上升方向 + 陡峭程度，负梯度即梯度下降）、方向导数、等高线（梯度处处垂直于等高线）；Jacobian 矩阵（向量值函数的一阶导，行列式 = 局部面积缩放，复合变换的 Jacobian 相乘——这正是反向传播的机制）；Hessian 矩阵（二阶曲率，Clairaut 定理保证对称，正定 = 局部极小、负定 = 极大、混合 = 鞍点）；多元链式法则；数值/符号/自动微分三者对比，并附一道从零实现迷你 autodiff 引擎（带拓扑排序反向传播）的编码任务，是全书含金量最高的练习之一。
- **04 函数逼近**：为什么多项式能逼近一切——每升一次幂多一层细节；线性化（切线近似）、Taylor/Maclaurin 级数（eˣ、sin、cos 的展开，4 项逼近 e^0.5 已有三位小数精度）、收敛半径与拉格朗日余项（误差界）；二元二阶 Taylor 展开把梯度与 Hessian 串起来，直通牛顿法；样条、Fourier 级数、神经网络（万能逼近定理）作为三大替代方案。
- **05 优化**：训练模型 = 找损失函数最小值。零点与重数、临界点、二阶导数判定凹凸；凸函数“局部极小即全局极小”的关键性质；牛顿法求根与求极值（多维版 x - H⁻¹∇f，即二阶 Taylor 在干活）；拉格朗日乘子法（约束优化的几何直觉：最优点处两个梯度平行）、KKT 条件处理不等式约束；最后过一遍算法家族——一阶（SGD、Adam）、拟牛顿（BFGS/L-BFGS）、共轭梯度、Gauss-Newton/Levenberg-Marquardt、自然梯度，并解释深度学习为什么被一阶方法统治（参数太多，Hessian 算不动）。

前置要求：第 1、2 章。第 03 页的迷你 autodiff 练习强烈建议亲手做；第 04、05 页直接服务于第 6 章的梯度学习与训练。

### 第 4 章 统计（5 页，入门级）

全章定位：描述数据、量化不确定性的语言，ML 评估指标与损失函数的概念底座。

- **01 统计基础**：描述统计与推断统计之分；分布（频率分布 → 概率分布）、随机变量（把实验结果映射成数，才能做算术）；离散用 PMF 求和、连续用 PDF 积分（呼应第 3 章的积分）；期望 = 加权平均 = 分布重心，期望的线性性在损失函数里到处用；矩系统（ raw/central/standardised）——均值、方差、偏度、峰度四兄弟各自刻画分布的一个侧面，并用同一个数据集完整算了一遍四阶矩。
- **02 统计度量**：离散度（方差、标准差、对异常值更稳健的 MAD、Bessel 样本校正）、位置（四分位数、IQR、箱线图、百分位、z 分数 = 标准化 = ML 特征缩放）、形状（偏度峰度回顾）；关联性——Pearson 相关（点破：就是去均值后的余弦相似度，呼应第 1 章）与 Spearman 秩相关（抗异常值、容忍单调非线性）；几何平均（增长率场景）；指数移动平均 EMA（Adam 优化器和 BatchNorm 运行统计的原型）；IQR 法与 z-score 法两种离群点检测的适用差异。
- **03 抽样**：总体/样本、参数/统计量、抽样框与覆盖误差；概率抽样四法（简单随机、分层、整群、系统）与非概率抽样（方便、配额、滚雪球）各自适用场景；抽样分布与标准误 SE = σ/√n；全书最重要的统计定理——中心极限定理（无论原分布什么形状，样本均值的分布趋于正态），三个前提条件（独立、有限方差、同分布）。
- **04 假设检验**：H0/H1、检验统计量、p 值与显著性水平的完整流程，配螺栓厂均值检验的完整算例；单尾/双尾；第一类错误（假阳性，概率 α）与第二类错误（假阴性，概率 β）、统计功效及四大影响因素、两类错误此消彼长的张力；参数检验家族（z 检验、t 检验三变体、ANOVA 用组间/组内方差比避免多次 t 检验膨胀第一类错误）；非参数家族（卡方、Mann-Whitney U、Wilcoxon、Kruskal-Wallis）与正态性检验；落地场景：模型 A 92% vs 模型 B 91%，配对 t 检验判断差异是不是噪声。
- **05 统计推断**：点估计 vs 置信区间（严格澄清 95% CI 的含义——参数固定、区间在变）；边际误差与 t 分布版 CI；功效分析反推实验需要的样本量（防欠功效与过度浪费）；蒙特卡洛方法（撒点估 π 的经典例子；ML 中的 MC dropout、MCMC、策略梯度都是它）；因子分析（潜变量模型，直接衔接第 2 章的特征分解与 SVD）；实验设计（自变量/因变量、对照组、随机分配；随机化区组、析因设计看交互、交叉设计——并点破交叉验证就是交叉设计、消融实验遵循析因逻辑）。

前置要求：第 3 章的积分概念。整章服务于第 6 章的评估、第 18 章的 A/B 测试与实验设计。

### 第 5 章 概率（5 页，入门级）

全章定位：不确定性的数学，从数数一直讲到交叉熵损失为什么长那样。

- **01 计数**：乘法规则（3 衣 4 裤 = 12 套穿搭）、加法规则与容斥原理；阶乘及其爆炸式增长（暴力搜索不可行的根源）；排列（选主席团，有序）与组合（选委员会，无序，每个组合对应 r! 个排列所以除掉）；“8 男 6 女选 3 男 2 女”的多步组合算例示范拆解模式；可重复排列 n^r 与可重复组合（隔板法）；末尾附计数公式速查表与生日悖论模拟。
- **02 概率概念**：频率派（长期频率）与贝叶斯派（信念程度）两种诠释，并点明分歧在 ML 中的映射（点估计 vs 参数分布）；样本空间与事件、补集技巧（“至少一个正面”从反面算）；互斥与一般加法规则；联合/边际/条件概率（缩小样本空间的直觉）；独立性及其作为“让计算可行”的简化假设（朴素贝叶斯的由来）；贝叶斯定理四件套（先验、似然、证据、后验）配经典医疗诊断算例——95% 准确率的检测在 1% 患病率下阳性结果只有 8.8% 是真病，直接引出“类别不平衡时准确率会骗人”；全概率公式、概率链式法则（点破：这就是自回归语言模型逐词生成概率的骨架）、条件独立性（贝叶斯网络可分解的前提）。
- **03 概率分布**：PMF/PDF/CDF 三件套与支撑集回顾后，按目录式过一遍核心分布——离散：Bernoulli（sigmoid 输出就是它的 p）、Binomial（二项式系数在此回收）、Poisson（均值 = 方差的签名性质，Binomial 的稀有事件极限）、Geometric（无记忆性）、Negative Binomial（过散计数数据）；连续：Uniform（随机数生成器的源头）、Normal（CLT 的产物；68-95-99.7 法则；MSE 损失隐含高斯误差假设、VAE 重参数化技巧都靠它）、Exponential（无记忆的等待时间）、Gamma（指数的推广）、Beta（定义在 [0,1] 上天然适合建模概率，且是 Bernoulli/Binomial 的共轭先验，为下一页埋线）、Chi-squared（k 个独立标准正态平方和）、Student t 分布（重尾，小样本不确定性）。末尾一张全分布均值方差速查表。
- **04 贝叶斯方法与序列模型**：ML 的核心问题“给定数据怎么找参数”。MLE（抛 10 次 7 次正面 → p = 0.7；但 10 正会给出 p = 1 的过度自信）、MAP（加先验 = 加正则，点破 L2 正则等价于高斯先验下的 MAP；Beta 共轭先验让后验解析可算）、完整贝叶斯推断（整个后验分布，不确定性尽在其中）三级阶梯；马尔可夫链（无记忆性、转移矩阵、平稳分布 πT = π——MCMC 的地基）；隐马尔可夫模型（雨伞例子贯穿：转移/发射/初始三组件，Viterbi 解码逐日手算演示、Forward 算法评估、Baum-Welch 即 EM 学习）；CRF（去掉发射独立性假设，判别式 vs 生成式的分野同逻辑回归 vs 朴素贝叶斯，现代 NLP 里 BiLSTM-CRF/BERT-CRF 仍在用）。
- **05 信息论**：香农 1948 年的框架。惊奇度 surprisal = -log₂p（为什么用对数：确定事件零信息、独立事件信息相加、函数温和）；熵 = 平均惊奇度 = 压缩极限（香农信源编码定理；低熵图像压缩得好就是 JPEG 的原理）；微分熵与“同方差下高斯熵最大”（高斯假设少即是美德）；互信息（特征选择）；交叉熵 = 用 q 的编码方案编码 p 的平均代价——分类损失的真身（单样本即 -log ŷ_c，损失就是模型对正确类的惊奇度）；KL 散度 = 交叉熵与熵之差，非对称性带来两种逼近风格（moment-matching vs mode-seeking，变分推断用后者）；收束一句话：熵是分布的内在不确定性，交叉熵衡量模型逼近现实的程度，KL 是两者的差距——三者是现代 ML 优化的骨架。

前置要求：第 3、4 章。第 02 页的贝叶斯定理与第 05 页的信息论是全书引用率最高的两页；第 04 页直接铺给第 6 章的 MLE 训练视角和第 7 章的序列建模。

### 第 6 章 机器学习（5 页，核心章）

全章定位：全书第一条主线的正文——从“不写规则改喂数据”到大规模训练的系统工程，前四章的数学在这里全部兑付。

- **01 经典机器学习**：监督/无监督/强化三范式、分类 vs 回归、生成式 vs 判别式的分野（朴素贝叶斯 vs 逻辑回归的对比将贯穿全书）；Naive Bayes 三变体（Multinomial/Gaussian/Bernoulli）与 Laplace 平滑；决策树（Gini 与熵两种不纯度、信息增益、剪枝）；集成方法——bagging（自助采样，降方差）vs boosting（顺序纠错，降偏差），AdaBoost 权重公式、梯度提升（XGBoost/LightGBM 的原理，表格数据竞赛之王）；K-Means（分配-更新交替、K-Means++ 初始化、肘部法与轮廓系数）与 GMM（软分配、EM 算法，点破 K-Means 是球形协方差 + 硬分配的特例）；SVM（最大间隔、支持向量、软间隔与松弛变量、核技巧 RBF 核，对偶形式只依赖内积正是核技巧可行的原因）。末尾一张算法优劣速查表。
- **02 梯度机器学习**：线性回归（MSE 的概率解释：高斯似然下 MLE 等价于最小 MSE；正规方程 w = (XᵀX)⁻¹Xᵀy 及其失效条件）；逻辑回归（sigmoid 性质、BCE 损失直接来自 Bernoulli 似然）；梯度下降（雾中下山的比喻）、batch/SGD/mini-batch 三变体；反向传播 = 链式法则在计算图上的系统化应用；优化器进化史——Momentum（EMA 思想回收）、NAG、Adagrad、RMSprop、Adam（一阶二阶矩 + 偏差校正）、AdamW（权重衰减解耦，transformer 标配）、LION（只用动量符号，程序搜索发现的）、Muon（Nesterov + Newton-Schulz 正交化，当前 transformer 训练新秀，注意力与 MLP 权重矩阵用它、embedding 仍归 AdamW 管）——这条谱系追到了 2025 年的最新进展；损失函数家族（MAE、Huber、CCE、Hinge）；L1/L2/Elastic Net 正则与贝叶斯解释（L2 = 高斯先验 MAP，L1 = Laplace 先验）；混淆矩阵、精确率/召回率/F1、ROC/AUC；k 折交叉验证；偏差-方差分解；学习率调度（step/余弦/warmup/1cycle）与超参搜索（grid/random/贝叶斯优化/ASHA 早期淘汰），还有 schedule-free 学习（把调度本身消掉的新方法）。
- **03 深度学习**：深度 = 层级表征；MLP 与“没有非线性则堆层坍缩成一个矩阵乘”（直接回收第 2 章）；激活函数谱系（ReLU 及死亡问题、sigmoid/tanh 饱和、GELU/Swish 是 GPT/BERT 默认）；万能逼近定理的真意（深度换的是参数效率而非表达力）；梯度消失/爆炸与五种解法；初始化（Xavier/He 各自的方差公式）；归一化四兄弟（BatchNorm/LayerNorm/InstanceNorm/GroupNorm 各自沿哪个维度归一化，transformer 为何用 LayerNorm）；Dropout 与 inverted dropout；CNN（卷积、stride/padding 输出尺寸公式、池化、空洞卷积、1×1 卷积换通道、残差连接救活百层网络、特征层级与感受野）；embeddings（查表即 one-hot 矩阵乘）与子词分词（BPE/WordPiece/SentencePiece）；RNN 的序列瓶颈 → LSTM 三门 + 细胞状态传送带（逐公式）→ GRU；注意力 Q/K/V（图书馆检索比喻，缩放点积公式逐项解释——QKᵀ 是矩阵乘、点积是余弦相似度、除以 √dₖ 防 softmax 饱和）→ 多头注意力 → Transformer 完整块结构、位置编码（正弦公式，及 RoPE/ALiBi 等现代方案）、O(n²) 代价与 FlashAttention 等变体；ViT 把图像切块当 token、MLP-Mixer 说明关键在“高效混合”而非注意力本身；自编码器 → VAE（重参数化技巧 + 重建 + KL 双项损失，回收第 5 章）。
- **04 强化学习**： agent-环境循环五要素、策略 π；MDP 五元组与马尔可夫性质（回收第 5 章）；折扣回报 G_t、状态价值 V 与动作价值 Q、Bellman 方程与最优方程；动态规划（策略迭代/值迭代，需要已知模型）；时序差分学习（bootstrapping、TD 误差）；SARSA（on-policy，保守）vs Q-learning（off-policy，激进）；探索-利用困境与 ε-greedy；DQN 的两大稳定器（经验回放打破相关性、目标网络防止追自己尾巴）；策略梯度定理（“提高带来高回报动作的概率”）、REINFORCE 与 baseline 减方差、Actor-Critic（演员出策略、评论家出优势值）；PPO 裁剪代理目标（防策略更新过大崩盘，业界标准）；RLHF 流程（人类偏好训练奖励模型 + PPO 优化）与 DPO（跳过奖励模型的闭式损失）；on/off-policy 与 model-based/free 两组分野。末尾 RL 方法速查表。
- **05 分布式深度学习**：训练大模型的系统工程。计算量账本（一层训练 ≈ 6·B·d_in·d_out FLOPs，transformer 层的完整 FLOPs 分解）；显存四面墙（参数 + 梯度 + Adam 优化器状态 + 激活值，7B 模型 FP32 下 112 GB 起步）；混合精度（FP16 需损失缩放、BF16 是现代默认）；数据并行（梯度 all-reduce，同步 vs 异步、梯度累积模拟大 batch）；模型并行两路——张量并行（按列切 W，需要 NVLink 级互联）与流水线并行（层分组装线，micro-batching 填气泡）；混合并行（节点内张量、节点间流水线、节点组间数据——GPT-4/Llama 的真实训法）；通信原语（朴素 all-reduce 的 O(N) 瓶颈 vs ring all-reduce 的带宽最优，NCCL）；scaling laws（Kaplan 幂律 → Chinchilla 的“每参数 20 token 计算最优”转折）；MoE（门控路由 top-K 专家，参数多 FLOPs 不变，Mixtral 8x7B 实例；负载均衡与 all-to-all 通信难题）；检查点容错与梯度检查点（重算换显存，前向多花约 33%）。末尾一张分布式技术权衡表。

前置要求：第 1–5 章全部（这章是前五章的总兑付）。第 02 页的优化器谱系与第 05 页的显存账本对面试极有用；第 03 页注意力一节是第 7 章的前置。

### 第 7 章 计算语言学（5 页，全书最大的一章）

全章定位：从语言学地基一路推进到 2025 年前沿 LLM 的完整架构（DeepSeek-V3、Qwen3、Llama 4、Kimi K2 都在里面），是全书最重要的一章。

- **01 语言学基础**：不是可跳过的“废话页”——形态学（词素、屈折 vs 派生、分析/黏着/模板语言的分野直接决定 tokenisation 策略）；句法两大框架（成分结构树 + CFG 产生式规则、依存文法——后者是现代 NLP 主流；配价）；语义学（词汇语义关系五种、一词多义与 WSD、组合性原则与成语反例）；分布语义学（“观其伴而知其义”是词向量的理论根基）；语用学（言语行为三层、格赖斯合作原则与会话含义、指代消解、RST 篇章结构，点破这是 LLM 至今的前沿难题）；音位学收尾（音位/音位变体/IPA/韵律，桥接第 9 章）。
- **02 文本处理与经典 NLP**：文本规范化（大小写折叠的陷阱、Unicode NFC/NFD）；编辑距离（Levenshtein 的 DP 公式，拼 startups 纠错/模糊匹配/DNA 比对）；tokenisation 谱系（空格 → 规则 → 子词三阶段，BPE 合并算法逐步演示、WordPiece 按似然选合并、Unigram 反向删词、SentencePiece 按字节流处理任意语言、词表大小权衡）；词干提取 vs 词性还原；POS 标注（HMM + Viterbi 的经典用法）；NER 与 BIO 标注体系（CRF 的判别式建模，BiLSTM-CRF/BERT-CRF 的现代叠法）；句法分析（CYK 的 O(n³|G|) 与 shift-reduce 的 O(n)）；词袋与 TF-IDF（余弦相似度回收第 1 章）；n-gram 语言模型（马尔可夫假设、困惑度 = 交叉熵的指数——回收第 5 章）、Laplace 平滑到 Kneser-Ney（续接概率的“San Francisco”例子讲透 continuation probability 的巧思）。
- **03 词向量与序列模型**：Word2Vec（CBOW 与 Skip-gram 对偶、负采样把全 softmax 变二分类、Levy-Goldberg 结论——SGNS 隐式分解平移 PMI 矩阵，把 Word2Vec 与经典分布语义打通；king-man+woman=queen 的线性方向性）；GloVe（全局共现矩阵分解 log X）；FastText（字符 n-gram，能出 OOV 词向量，黏着语救星）；嵌入评估（类比任务 vs 相似度基准，“最好评估是任务本身”）；RNN 语言模型、双向 RNN（为何不能做 LM）、堆叠 RNN；seq2seq 编码器-解码器（机器翻译突破，输入倒序的工程小技巧）与瓶颈问题 → 注意力登场（Bahdanau 加性注意力逐公式、Luong 乘性注意力、对齐热力图可视化）；beam search 与长度惩罚 α；TextCNN（多宽度滤波器 + 时序最大池化）与空洞因果卷积；ELMo 开启“预训练-微调”范式（层级混合权重，低层句法高层语义）。
- **04 Transformer 与语言模型**：post-norm vs pre-norm（残差直通梯度，深模型训练稳定的关键）；FFN = 参数大头 + 知识键值记忆假说；位置编码三件套——正弦/学习的绝对编码、RoPE（二维子空间旋转，RₘᵀRₙ = Rₙ₋ₘ 推出“注意力分数只依赖相对位置”的漂亮证明）、ALiBi 线性距离惩罚；三大范式（BERT 双向 + MLM 的 80/10/10 掩码策略与 NSP（RoBERTa 证明可弃）、GPT 因果注意力 + CLM、T5/BART 文本到文本 + span corruption）；GPT-2 零样本 → GPT-3 上下文学习；PEFT 三方案（Adapter、LoRA 的 W + BA 低秩分解、Prefix tuning）；prompt 工程（zero/few-shot、CoT）；scaling laws（Kaplan 幂律 → Chinchilla 修正，N_opt ∝ C^0.5，“每参数约 20 token”法则）；MoE（门控 top-k、负载均衡辅助损失、专家并行 all-to-all）；评估体系占了半页——表面指标（EM、token 级 P/R/F1、BLEU 修正 n-gram 精度 + 短句惩罚、ROUGE 召回向、ROUGE-L 的 LCS、METEOR、ChrF 字符级）、语义指标（BERTScore、BLEURT、COMET 看得到源句）、LLM-as-judge（成对比较 + Elo 排名，位置偏差/冗长偏差/自一致性三坑）、数据污染与金丝雀串；基准地图（GLUE 饱和、MMLU/MMLU-Pro、HellaSwag、GSM8K/MATH/AIME、HumanEval 的 pass@k 公式、SWE-bench、GPQA、TruthfulQA/BBQ、MT-Bench、Chatbot Arena）。
- **05 高级文本生成**：离散扩散（D3PM 的转移矩阵 + ELBO、MDLM 只用掩码 = “扩散版 BERT”、连续嵌入空间扩散）；OCR（场景文本检测、CRNN + CTC 的 blank token 与前向算法 DP——直接回收第 5 章 HMM；LayoutLM 加坐标嵌入、TrOCR 图像到文本）；可控生成（classifier-free guidance 从图像迁移）；对齐三阶段 RLHF（SFT → 奖励模型 pairwise ranking loss → PPO + KL 惩罚防 reward hacking）与 DPO 完整推导（闭式最优策略代回 Bradley-Terry，配分函数抵消，一步监督搞定）；Constitutional AI / RLAIF；长上下文（稀疏/滑窗注意力、ring attention 跨设备、记忆增强；渐进式扩长度训练——Llama 3.1 8K→128K、DeepSeek-V3 的实例；RoPE 插值 vs 外推、YaRN 分频段处理、ABF 调基频；lost-in-the-middle 现象、needle-in-a-haystack 测试；序列 packing 的坑）；状态空间模型——S5/S4（HiPPO 矩阵保持历史压缩表示）到 Mamba（选择性 SSM：B/C/Δ 输入相关，卷积视角失效改用硬件感知并行扫描，推理 O(1) 每 token 无 KV cache）与 Jamba/Zamba 混合架构；RAG（BM25/DPR 双塔、FAISS、分块策略、可引用来源减幻觉）；投机解码（draft 提案 + target 一次验证，接受-拒绝方案保证输出分布不变，含证明；Medusa 多头自投机）；前沿架构盘点——GQA（Llama 3 的 8 倍 KV cache 压缩）、MLA（DeepSeek-V2/V3 低秩潜向量缓存，93% 压缩 + 解耦 RoPE）、MoE 规模化（DeepSeek-V3 256 专家 top-8、无辅助损失的动态偏置负载均衡、共享专家、Llama 4 的 top-1 + 128 倍稀疏）、多 token 预测、知识蒸馏（Gemma 3-4B ≈ Gemma 2-27B 的原因、DeepSeek-R1 蒸馏）、推理 RL（DeepSeek-R1 用 GRPO 去掉价值网络、组内相对优势、规则奖励防 hack）、混合思考模式（Qwen3）、训练稳定化（logit soft-capping、QK-Norm、MuonClip 的 QK-Clip）、FP8 训练（DeepSeek-V3 用 2.8M H800 GPU 小时训练 671B 的关键）。

前置要求：第 6 章第 03 页（注意力机制）。第 04、05 页是全书含金量最高的两页，覆盖到 2025 年公开资料能确认的全部主流 LLM 架构细节，做 LLM 工程的话值得精读加二刷。

### 第 8 章 计算机视觉（5 页，核心章）

全章定位：从“图像是数字网格”到 NeRF 与 3D 高斯泼溅，覆盖视觉完整技术栈。

- **01 图像基础**：像素、位深、四种色彩空间（RGB、HSV 分离色相便于分割、YCbCr 亮度色度分离是 JPEG/视频编码的基础——人眼对亮度敏感、LAB 感知均匀）；针孔相机模型（内参矩阵 K + 外参 [R|t]，齐次坐标回收第 2 章；径向/切向畸变与标定）；空间滤波（盒式/高斯/中值滤波，中值抗椒盐噪声保边缘）；边缘检测（Sobel 梯度算子、Canny 四步法——高斯平滑、梯度、非极大值抑制、双阈值滞后）；频域分析（2D Fourier、卷积定理：空域卷积 = 频域逐元素乘）；直方图（均衡化 = CDF 线性化、Otsu 自动阈值 = 类间方差最大）；特征提取（Harris 角点——结构张量特征值判平坦/边缘/角点、Shi-Tomasi、SIFT 尺度空间 + DoG + 128 维描述子、SURF/ORB、HOG）；高斯/拉普拉斯金字塔与尺度空间理论（FPN 的理论基础）。
- **02 卷积网络**：卷积力学（stride/padding/膨胀、输出尺寸公式、感受野逐层增长、全局平均池化）；正则化（空间 Dropout 丢整个通道、数据增强进阶：Mixup/CutMix/RandAugment）；架构史完整叙事——LeNet（6 万参数的起点）→ AlexNet（ReLU + dropout + GPU 点燃革命）→ VGG（两个 3×3 等效一个 5×5 还省参数）→ Inception（多尺度并行 + 1×1 瓶颈，参数是 VGG 的 1/12）→ ResNet（残差连接解决退化问题、投影捷径、bottleneck 块，152 层）→ DenseNet（密集连接全复用）→ 移动端线（MobileNet 深度可分离卷积省约 9 倍、MobileNet-V2 反残差、EfficientNet 复合缩放 α·β²·γ²≈2、ShuffleNet 通道混洗）；迁移学习（特征提取 vs 微调）；CNN 可视化（Grad-CAM 的梯度加权热力图逐公式、特征反演、Deep Dream 与风格迁移的 Gram 矩阵）。
- **03 目标检测与分割**：IoU、AP/mAP（COCO 标准 mAP@[.5:.95]）、NMS 去重框；两阶段检测演进——R-CNN（2000 次 CNN 的暴力）→ Fast R-CNN（共享特征图 + RoI pooling）→ Faster R-CNN（RPN + anchor box 机制，偏移参数化用 log 保尺度不变，smooth L1 损失）；FPN 多尺度特征金字塔；单阶段——YOLO 网格法（v1 到 v8 的演进线）、SSD 多尺度、RetinaNet 的 focal loss（(1-pₜ)^γ 降权易样本，解决单阶段的类别失衡）；无锚框检测（FCOS 中心度、CenterNet 关键点热图、CornerNet 角点配对）；语义分割（FCN 全卷积 + 转置卷积上采样、U-Net 对称编解码 + 跳跃连接——后来成为扩散模型骨干、DeepLab 空洞卷积 + ASPP + CRF 后处理）；实例分割（Mask R-CNN：RoIAlign 双线性插值代替量化、逐类掩码解耦）；全景分割（stuff vs things、PQ 指标分解）；实时分割（BiSeNet 双路、DDRNet）。
- **04 视觉 Transformer 与生成**：ViT（图像切块当 token、[CLS]、patch embedding 等价于 P×P 卷积；“归纳偏差少 → 需要大数据”的核心论点，JFT-300M 上反超 CNN）；DeiT（蒸馏 token 让 ImageNet 就够）；Swin（移位窗口注意力把 O(N²) 降到 O(N)、层级 patch merging 对接检测分割头）；PVT；自监督视觉学习——对比学习（SimCLR 的 NT-Xent 损失、MoCo 动量队列解决大 batch 依赖、BYOL 免负样本、DINO 自蒸馏出无监督分割能力）；掩码图像建模（MAE 掩 75% 只编码可见块、BEiT 预测离散视觉 token）；图像生成三王朝——GAN（对抗目标、mode collapse、谱归一化等稳定技巧、StyleGAN 的映射网络 + AdaIN 分层控制姿态/发型/纹理）；VAE（结构化潜空间，后成为扩散的压缩器）；扩散模型（前向加噪闭式采样公式、反过程预测噪声 ε 的 MSE 损失、DDPM 千步采样 → DDIM 跳步、score-based 视角与 SDE 统一、classifier-free guidance 的引导尺度、Stable Diffusion 的潜空间扩散——VAE 压缩 64 倍 + CLIP 文本嵌入经 cross-attention 注入）；流匹配（CNF 的 ODE、最优传输直线路径、rectified flow 迭代拉直 → 一少步生成；SD3 与 Flux 已弃 DDPM 改流匹配）。
- **05 视频与 3D 视觉**：光流（亮度恒常假设、约束方程一式两未知、Lucas-Kanade 窗内最小二乘——结构张量回收第 01 页、Farneback 多项式展开、RAFT 迭代精化）；视频分类（双流网络分离外观与运动、C3D、I3D 把 2D 预训练“膨胀”成 3D、SlowFast 快慢双路匹配时空带宽不对称、TimeSformer 分解注意力 O(T²+N²)、VideoMAE 90-95% 超高掩码率利用时间冗余）；动作识别基准与时序检测；目标跟踪（SORT = 卡尔曼滤波 + 匈牙利算法匹配、DeepSORT 加外观 embedding 抗遮挡、ByteTrack 连低置信度检测都用上）；深度估计（双目 Z = fb/d 视差反比、单目学习先验 MiDaS/Depth Anything）；点云（PointNet 共享 MLP + 最大池化解决无序性）；NeRF（场景 = MLP 映射位置与视角到颜色和密度、体渲染积分公式逐项解释、慢）；3D 高斯泼溅（高斯基元 + 溅射 + alpha 混合，GPU 实时 100+ FPS）；SLAM（视觉里程计、ORB-SLAM 三线程——跟踪/建图/回环、LiDAR SLAM、视觉-惯性融合）；VR/AR（姿态估计 OpenPose 热图回归、自上而下 vs 自下而上、注视点渲染与重投影保 90 FPS）。

前置要求：第 6 章第 03 页；第 01 页与第 9 章 DSP 互为镜像。生成部分（第 04 页）是第 10 章多模态的前置。

### 第 9 章 音频与语音（5 页，全书体量最大的章）

全章定位：从声波物理到降噪耳机原理的完整语音技术栈，每页的编码任务都是可跑的完整实现（手搓 MFCC、CTC、Griffin-Lim、FastICA、LMS）。

- **01 数字信号处理**：声音物理与波形三参数（振幅/频率/相位，分贝的对数尺度）；采样与量化（Nyquist 定理 fs ≥ 2f_max、 wagon-wheel 效应解释混叠、抗混叠滤波、μ-law 压扩）；时域特征（能量、过零率、自相关——音高检测的标准手法，点破就是信号与其移位版本的点积）；频域（DFT 即换基——回收第 2 章、FFT 的 O(N log N) 分治）；语谱图（分帧 + FFT 堆叠）；mel 刻度与 mel 滤波器组（人耳蜗的频率分辨率模拟）；MFCC 七步流水线（预加重 → 分帧 → 加窗 → FFT → mel 滤波器组 → log → DCT，cepstrum 是 spectrum 的变位词，保前 13 系数 = 留共振峰弃音高细节；现代深度模型用 log-mel 跳过 DCT）；窗函数家族（矩形/Hamming/Hann/Blackman 的旁瓣 vs 主瓣宽度权衡，Gabor 极限 = 信号处理版的测不准原理）；STFT 与 overlap-add 重建；滤波器（FIR 稳定可线性相位、IIR 少系数可失稳、z 变换零极点）。
- **02 自动语音识别**：ASR 史完整叙事——经典模块化流水线（特征 → 声学模型 → 发音词典 → 语言模型 → 解码器；三音子 + 决策树聚成 senone）；GMM-HMM 时代（Baum-Welch 训练、Viterbi 解码——第 5 章直接回收）；DNN-HMM 混合时代（相对词错率降 20-30%）；WFST 组合解码 H∘C∘L∘G；端到端时代——对齐问题与 CTC（blank token、前向后向算法 O(T·L)、条件独立假设的局限与外部语言模型补偿）；RNN-T（加预测网络去掉条件独立，天生支持流式，手机端 ASR 主流）；LAS 注意力编解码（金字塔 BiLSTM，不适合流式）；Conformer（FFN-注意力-卷积-FFN 三明治半残差结构，已成默认编码器）；Whisper（68 万小时弱监督数据 + 编解码 transformer + 多任务 token，数据规模而非架构取胜）；自监督线——wav2vec 2.0（CNN 特征编码 + 乘积量化目标 + 对比学习，10 分钟标注数据接近 SOTA）、HuBERT（掩码预测聚类目标更简单）；2023-2024 新模型盘点（Fast Conformer 降采样注意力、Parakeet、Canary、Moonshine 边缘部署、Distil-Whisper 蒸馏、USM 1200 万小时、MMS 1100+ 语言）；语言模型融合（浅融合/深融合/冷融合/N-best 重打分/ILME 修正内部语言模型双计）；流式 vs 离线（分块注意力、lookahead、延迟四构成）；评估（WER 公式——可超 100%、CER、RTF）；增强（SpecAugment 频谱遮罩是音频版 dropout）；tokenisation 选型。
- **03 文本转语音与声音**：TTS 四段流水线（文本规范化 → G2P → 声学模型 → 声码器）；声码器史——WaveNet（膨胀因果卷积 + 门控，质量天花板但 1 秒音频要 2.4 万次前向）、WaveRNN（粗细 8bit 双 softmax）、WaveGlow（流模型并行生成）、HiFi-GAN（多感受野融合 + 多周期判别器，比 WaveNet 快千倍实现实时）；声学模型——Tacotron 2（位置敏感注意力防跳词、stop token）、FastSpeech 2（非自回归 + 时长/音高/能量三预测器，快 10-20 倍且可控）、VITS（VAE + 流 + 对抗端到端）；VALL-E 开启 codec 语言模型范式（EnCodec 离散 token + 3 秒样本零样本克隆，AR 第一码本 + NAR 并行其余）；开源模型大全——StyleTTS 2（风格解耦 + 扩散先验）、Kokoro（82M 参数的性价比之王）、Orpheus（Llama 3 底座的情感语音，[laugh]/[sigh] 标签控制）、Dia 对话式 TTS、Sesame CSM 会话动力学、Fish Speech、ChatTTS、Bark、Parler-TTS 自然语言描述控制等，并总结两大范式分野（codec LM vs 流/扩散）；韵律建模（F0/时长/能量/GST 风格 token）；声音转换与克隆（解耦表示三法：信息瓶颈/对抗梯度反转/VQ）；VAD（WebRTC GMM 基线 vs Silero——不到 2MB 的深度可分离卷积 + LSTM，双阈值防抖动，已是生产标配）；TTS 评估（MOS/MCD/说话人相似度）。
- **04 说话人与音频分析**：验证 vs 辨识之分；余弦相似度 + EER（等错误率）评估体系；嵌入演化——i-vector（UBM + 总变异空间因子分析 + PLDA 打分）、d-vector（首个神经嵌入）、x-vector（TDNN 帧级层 + 统计池化 μσ 拼接 + 段级层）、ECAPA-TDNN（SE 通道注意力 + Res2Net 多尺度 + 注意力统计池化，配 AAM-Softmax 角度间隔损失——人脸识别 ArcFace 的迁移）；说话人分离 diarisation（聚类法四步 vs 端到端 EEND 多标签——天然处理重叠语音、PIT 排列不变训练解标签歧义）；音频分类（频谱图当图像处理；ESC-50、AudioSet 弱监督 SED 用注意力池化、场景分类）；音频嵌入——VGGish、PANNs CNN14、AST（直接把 ViT 搬到频谱图上，还能借 ImageNet 预训练做跨模态迁移）、HTS-AT、BEATs 迭代掩码预测；音乐检索 MIR（节拍跟踪、chromagram 折叠八度的和弦识别公式、Shazam 指纹）。
- **05 源分离与降噪**：鸡尾酒会问题的问题形式化（频域 mask 估计范式、IBM/IRM）；经典方法——ICA（FastICA 最大化非高斯性，多麦克风场景）、NMF（V ≈ WH 非负分解学每源的谱字典，乘法更新）、波束成形（delay-and-sum 对齐求和、MVDR 的闭式解，助听器/智能音箱/会议系统在用）；深度分离——deep clustering（T-F bin 嵌入 + K-means）、Conv-TasNet（时域端到端：学习编解码基绕过 STFT 的相位丢失 + TCN 膨胀卷积）、DPRNN 双路 RNN（块内/块间，序列长从 L 降到 √L）、SepFormer（双路换 transformer）；PIT 与 SI-SDR 指标（含推导）；音乐分离（Open-Unmix、Demucs 波形 U-Net 与 Hybrid 版时频双支）；主动降噪 ANC（feedforward/feedback 结构、LMS 自适应滤波 = 对 MSE 的 SGD、NLMS 按输入功率归一化、RLS 更快更贵）；语音增强（谱减法与音乐噪声伪影、Wiener 滤波 = 软掩码 + 先验 SNR 决策导向估计、DCCRN 复数域网络、FullSubNet 全带/子带双路）；回声消除（AEC 建模房间冲激响应、双讲检测冻结滤波器、归一化互相关指示器、自适应滤波 + 神经网络的现代组合）。

前置要求：第 1、2、6 章。第 01 页是全章硬前置（不读它后面全是天书）；做语音方向的话这章是全书性价比最高的一章。

### 第 10 章 多模态学习（5 页，核心章）

全章定位：视觉与语言如何“合流”——从 CLIP 的对比对齐一路到 Gemini/GPT-4o 的原生多模态与世界模型。

- **01 多模态表征**：模态定义与互补性动机；融合三策略（早期拼接、晚期决策、中期 cross-attention——现代主流）；联合嵌入空间（双编码器映进同一向量空间，余弦相似度回收第 1 章）；CLIP 完整讲解（4 亿图文对、N×N 相似度矩阵、对称 InfoNCE 损失、可学习温度 τ、零样本分类 = “文本编码器当灵活分类头”）；ALIGN（18 亿脏数据证明规模可抵噪声）；SigLIP（把 softmax 换成逐对 sigmoid，去掉全局归一化的分布式通信瓶颈）；对比损失族（InfoNCE 与 NT-Xent 实为同一公式、温度的作用物理直觉、triplet loss 与难负样本挖掘为何输给 InfoNCE）；图文检索与 Recall@K/MedR 评估；音视频对应学习（AVE）；ImageBind（以图像为锚绑六模态，未经共训的模态间对齐自发涌现）；评估（零样本基准、linear probe、Winoground/ARO 揭示对比训练抓全局语义但弱于组合结构）。
- **02 视觉语言模型**：VQA 任务史（VQA v1 的语言先验漏洞 → v2 平衡对设计 → GQA/OK-VQA/TextVQA）；图像描述（Show and Tell 单向量瓶颈 → Show Attend and Tell 的空间注意力软/硬两种 → bottom-up attention；CIDEr 指标）；架构三范式（双编码器——检索快但无细粒度交互；融合编码器——cross-attention 深交互；编码器-解码器——生成任务通吃）；Flamingo（冻结 NFNet + Chinchilla，Perceiver Resampler 压成 64 个视觉 token + 门控 cross-attention 的 α 初始为零渐进打开，交错图文序列实现少样本多模态学习）；LLaVA（极简主义：线性投影把 CLIP 特征投进 LLM 词嵌入空间 + GPT-4 造 15.8 万条视觉指令数据 + 两阶段训练，证明简单方案 + 好数据足够，后续开源 VLM 基本都跟这个配方；LLaVA-1.5 的三个小改动大提升）；规模化三家——PaLI（视觉编码器也要大，ViT-e 4B + mT5 13B）、Qwen-VL（三阶段课程，Qwen2-VL 动态分辨率）、InternVL（6B 视觉编码器 + 448 分块动态高分辨率 + 渐进对齐训练）；视觉定位 grounding（坐标离散化为 token——Pix2Seq 开创、Kosmos-2 文中夹 box token、Shikra/Ferret 指点式）；OCR-free 文档理解（Donut 免 OCR 直接出 JSON、Pix2Struct 截图解析网页、Nougat 论文页图直接转 LaTeX）；视觉 token 流水线五步（切块 → 编码 → 压缩（Q-Former 的 32 个可学习查询）→ 投影 → 注入 LLM）与 token 预算权衡；训练目标（ITC/ITM/LM/前缀 LM）。
- **03 图像与视频 tokenisation**：为什么要 tokenise（压缩、与文本统一词表、语义瓶颈）；VQ-VAE 全套机制（码本最近邻量化、直通估计器 z_q = z_e + sg(z_q - z_e)、三项损失——重建/码本/承诺 β=0.25、EMA 更新 = 在线 k-means）；码本坍缩问题与五种解法（重置、Laplace 平滑、调 β、因式分解码本、熵正则）；VQ-GAN（加 patch 判别器 + 感知损失治模糊，DALL-E/Parti 的底座 tokeniser）；残差量化（T 层码本 → 有效词表 K^T 只存 T×K）；多尺度与乘积量化；FSQ 有限标量量化（不学码本直接取整，天然免疫坍缩）；实践 tokeniser（DALL-E dVAE 的 Gumbel-Softmax、LlamaGen 证明纯 LLM 架构能生图、Cosmos 因果 3D 架构图像视频统一）；视频 tokenisation（3D VQ-VAE 的时空下采样、因果 tokeniser 支持流式与自回归生成、单帧图像无需特判的统一性、时间压缩策略与关键帧插值 token）；连续 vs 离散 token 的选型决策树（扩散后端用连续、自回归后端用离散）；应用（自回归生图的 raster scan 不对称性与 MaskGIT/多尺度补救；Chameleon 的 8192 图像 token 并入 6.5 万统一词表、Gemini 原生多模态；词表配额与容量平衡问题）。
- **04 跨模态生成**：文生图两条路线——自回归（DALL-E：dVAE 32×32 token + 120 亿参数 transformer 建模 1280 token 联合分布，CLIP 重排候选）、扩散（Stable Diffusion 三件套：VAE 压 48 倍 + CLIP 文本嵌入 + U-Net cross-attention 去噪）；CFG 实战（s=7.5 默认、s 与质量-多样性权衡）；Imagen（冻结 T5-XXL 做文本编码器证明语言理解 > 图像模型大小、级联扩散、动态阈值）；Parti（200 亿参数重振自回归）；DiT（transformer 换掉 U-Net 骨干，计算量翻倍 FID 减半的规模可预测性）；流匹配 + MM-DiT（SD3/Flux：文本图像 token 双向互相注意）；文生视频（时间一致性三难；Make-A-Video 给预训练 T2I 插时间层只学运动、VideoPoet 全 token 化 LLM 统一任意模态生成、Sora 的时空 patch 把视频当原生 3D 信号、开源 Wan 1.3B/14B 流匹配 + 3D VAE）；文生音频（AudioLM 语义 token 与声学 token 两级、MusicLM 的 MuLan 条件与哼旋律条件、MusicGen 单阶段交错码本模式）；图生文（CoCa 对比 + 描述双任务合一）；视音联合生成的帧级 InfoNCE 同步损失；指令编辑（InstructPix2Pix 双 CFG 两维旋钮、SDEdit 加噪再去噪控编辑强度、ControlNet 零卷积挂条件不伤预训练权重）；评估三指标（FID 的 Frechet 距离公式、IS 的 KL 定义、CLIPScore 无参考对齐度量）与人类评估协议；伦理专节（深度伪造与检测军备赛/水印、生成偏置、内容过滤层、开源与滥用的张力、版权与同意）。
- **05 统一多模态架构**：统一化的实践与理论动机（k 个模态 k(k-1) 条流水线的组合爆炸）；any-to-any 三种集成深度——浅（NExT-GPT：冻结专家 + 投影层 + 信号 token 路由）、中（CoDi：共享条件对齐各模态扩散）、深（Gemini/GPT-4o：原生交错预训练，端到端共享 transformer 与下一 token 目标）；编码器-共享骨干-解码器三段式（模态嵌入 e_m + 位置嵌入）；多模态 tokenisation（各模态 token 化后用分隔符交错成单一序列、token 预算与 token merging/自适应 tokenisation）；四阶段训练配方（单模态预训练 → 跨模态对齐 → 联合多模态预训练 → 指令微调 + RLHF/DPO）与模态坍缩防范（梯度均衡、数据比例调度、损失加权）；多模态思维链（中间步骤引用图像区域、蒸馏轨迹训练）；多模态智能体（观察-推理-行动循环、工具调用、WebVoyager/SeeAct 网页智能体、PaLM-E 具身）；基准地图（MMLU 防灾难遗忘、MMBench/SEED-Bench/MM-Vet/MathVista/AVQA、WebArena/OSWorld 智能体基准、Chatbot Arena、数据污染）；世界模型（状态转移预测、Sora/Genie 即隐式世界模拟器、JEPA 在嵌入空间预测避免像素浪费、模型基 RL/自动驾驶/机器人应用、Genie 2 的可交互世界）。

前置要求：第 7、8 章（LLM 与 CNN/ViT/扩散）。第 02、04 页与第 7 章第 05 页共同构成“现代多模态系统”的完整拼图。

### 第 11 章 自主系统（5 页）

全章定位：把感知、控制、VLA、自动驾驶、极端环境机器人串成一条“机器人在物理世界生存”的完整线。

- **01 感知**：传感器全家桶对比——相机（密集色彩但丢深度）、LiDAR（飞行时间测距 d = cΔt/2 出点云，旋转式 vs 固态）、雷达（多普勒直接测速度、全天候但分辨率粗）、超声（泊车近距离）、IMU（高频自运动但漂移）、GNSS/RTK（绝对定位，厘米级要基站）；三类标定（内参、外参 4×4 齐次变换、时间同步——10 ms 误差在高速下就是 30 cm）；融合三策略与 BEVFusion（把相机与 LiDAR 特征统一投进鸟瞰图网格，BEV 是度量尺度的统一坐标系）；3D 检测（PointPillars 把点云柱化成伪图像走 2D CNN、CenterPoint 热图找中心点天然延伸到跟踪、BEVFormer/BEVDet 的纯相机 3D 检测在缩小差距）；深度估计（立体 Z = fb/d、单目先验、LiDAR 监督填充）；占用网络（从“检测物体”转向“哪些空间被占据”，TPVFormer 三正交平面分解降立方成本）；车道检测（三次多项式拟合、GANet 图拓扑）与语义地图（贝叶斯占据栅格 + log-odds 累积证据，SLAM 衔接）。
- **02 机器人学习**：运动学——DH 参数 + 齐次变换链式乘积做正运动学，逆运动学用雅可比伪逆迭代（本质是牛顿法）、阻尼最小二乘处理奇异点；动力学（操作臂方程 M q̈ + C q̇ + g = τ，质量矩阵正定回收第 2 章）；控制三件套——PID（比例弹簧/积分消稳态差/微分阻尼，及整定失衡的后果）、MPC（滚动时域优化，约束显式进目标）、阻抗控制（“像弹簧-阻尼器那样表现”而非刚性跟踪，接触任务必备）；模仿学习——行为克隆的分布偏移/复合误差问题（看完美司机开车学不会救偏）、DAgger 迭代数据聚合、ACT 动作分块（transformer + 条件 VAE）、Diffusion Policy（扩散建模多模态动作分布，回归会平均出无效动作）；sim-to-real（域随机化 vs 系统辨识，实践是两者结合）；世界模型（DreamerV3 三组件在潜空间做梦，JEPA 式嵌入预测；误差随预测步累积的局限）；操作（力闭合的秩判据、GraspNet 数据驱动抓取、灵巧手 RL + 域随机化）；运动（ZMP 零力矩点稳定判据、CPG 中枢模式发生器耦合振荡器出步态、RL 已成四足/人形主流——PPO + 奖励塑形）；安全 RL（约束 MDP/CPO、安全包络层、风险感知规划）。
- **03 视觉-语言-动作模型**：VLA = VLM 的输出模态换成动作，机器人控制变成序列建模问题；架构三件套（ViT/SigLIP 视觉编码 + LLM 骨干 + 动作头）；动作 tokenisation（均匀分箱——7 维 × 256 bin、动作分块保时序平滑、VQ-VAE 学习式离散化）；模型谱系——RT-2（VLM 直接微调，动作当文本 token 生成，VLM 的世界知识涌现到机器人任务上但绑定单一本体）、Octo（开源本体无关，扩散动作头天然处理多模态分布，100 条示范即可微调）、OpenVLA（7B Llama 底座 + 统一动作 token，简单可复用 LLM 基建）、π0（流匹配动作头，当前 SOTA，双臂灵巧手都行）；预训练配方（VLM 预训练 → 网络数据与机器人数据共训防遗忘 → LoRA 微调）；泛化四轴（新物体/新指令/新环境/新本体——最难）与“一模型多机器人”的动作空间适配方案；评估（SIMPLER 仿真基准与 Open X-Embodiment 22 家机构数据集）。
- **04 自动驾驶**：模块化流水线四层（感知 → 预测 → 规划 → 控制）及误差传播的缺点；HD 地图（厘米级先验但维护贵）vs 无图方案（MapTR 在线矢量化建图）与混合实践；运动预测（多假设轨迹 + minADE_K 的 best-of-K 指标、社会力模型、GNN 建模交互、transformer 架构 MTR/QCNet、目标条件分解“去哪”与“怎么去”）；规划三层（规则式可审计但规则爆炸、优化式——进度/舒适/安全三权重加约束的轨迹优化、学习式端到端输出轨迹）；端到端驾驶（UniAD 级联 transformer 全可微、规划损失一路反传到图像编码器；DriveVLM 把 VLM 拉进驾驶栈；可解释性 vs 安全认证的张力）；世界模型（GAIA-1 自回归视频生成、DriveDreamer/GenAD 在 BEV 空间预测、反事实闭环仿真、JEPA 式嵌入预测、长时程误差与再锚定）；仿真（CARLA、nuPlan、开环重放 vs 闭环交互评估的本质区别、对抗场景生成）；安全标准（ISO 26262 的 ASIL 等级、SOTIF 管“按设计工作仍不安全”、ODD 设计运行域、fail-safe vs fail-operational、冗余设计）；SAE L0-L5 六级划分与“谁负责安全”的分界（当前行业是 L2 广泛部署 + L3 开始 + L4 限区域）。
- **05 太空与极端环境机器人**：火星车的通信延迟约束（单程 4-24 分钟，遥控不可行 → 真自主；AutoNav 立体建图 + 可通行性代价图让日行驶距离翻倍；辐射硬化处理器只有几百 MIPS，深度网络跑不动 → 模型压缩是刚需）；轨道服务（OSAM/Astroscale 的近距离操作与位姿估计）；在轨通信约束对架构的影响（板载决策 + 数据压缩 + 间歇窗口）；水下（AUV/ROV 之分、水声通信 1-10 kbps 比火星还挤、水下 SLAM 的声呐多径与色彩衰减、DVL 航位推算漂移）；搜救机器人（GPS 拒止、穿墙通信不可靠、多机器人前沿探索覆盖优化）；群体机器人（去中心化控制无单点故障、共识算法与图拉普拉斯代数连通度定收敛速度、Reynolds 三规则分离/对齐/凝聚出 flocking）；人机交互（共享自主的 α 混合控制 u = αu_h + (1-α)u_r、遥操作的预测显示与虚拟夹具、信任校准——透明度与不确定性表达、可读性运动 = 最大化观察者推断目标的贝叶斯后验）。

前置要求：第 8 章（视觉）、第 6 章第 04 页（RL）。第 03 页 VLA 是当前机器人领域最热的方向，与第 10 章多模态强联动。

### 第 12 章 图神经网络（5 页）

全章定位：用“对称性”统一全书见过的所有架构，然后专攻图数据与 3D 几何数据。

- **01 几何深度学习**：全书最有思想性的一页——对称性即“什么不重要”，知道什么不重要对学习是巨大助力；群四公理（封闭/结合/单位元/逆元）；关键群清单（平移群 → CNN、对称群 Sₙ → GNN 与 transformer、旋转群 SO(n)/欧氏群 E(n) → 3D 与物理）；不变性 vs 等变性之分（中间层等变保结构、最终输出不变出答案；架构内置等变性比从数据学省指数级参数）；五大几何域（网格/集合/序列/图/流形）——点破“CNN 是网格图上的 GNN、transformer 是完全图上的 GNN、DeepSets 是无边 GNN”的统一视角；尺度分离与粗化（局部特征逐层聚合，图池化即图像池化）。
- **02 图论**：邻接矩阵（Aᵏ 计数 k 长路径——矩阵乘法回收）；图类型（无向/有向/加权/二部/多重/超图/完全图——完全图就是 transformer 的舞台）；度与度矩阵、路径连通性、中心性（特征向量中心性 → PageRank）；图拉普拉斯 L = D - A（xᵀLx 度量信号在图上的平滑度、零特征值个数 = 连通分量数、代数连通度 λ₂）；谱图理论（拉普拉斯特征向量 = 图上的傅里叶基、图卷积 = 频域逐元素乘——卷积定理回收；特征分解 O(n³) 太贵 → Chebyshev 多项式近似直通 GCN）；谱聚类（Fiedler 向量正负切分社区）与模块度 Q；六类真实图（社交/分子/知识图谱/引文/蛋白质/路网）。
- **03 图神经网络**：消息传递三步框架（消息 φ → 置换不变聚合 ⊕ → 更新 ψ，k 层看 k 跳邻域）；GCN 一行公式 H′ = σ(ÂHW)（谱卷积的一阶 Chebyshev 近似 + 自环 + 对称归一化防高度数节点支配）；GraphSAGE（邻域采样变归纳式，计算树限 10×10 与图大小无关）；GIN（WL 测试与表达能力上限，sum 聚合对多重集单射而 mean/max 不行——配了 [1,1,1,1] vs [2,2] 的反例）；过平滑（重复归一化邻接收敛到秩 1，GNN 只能浅、四种缓解手段）；图池化（readout 的 DeepSets 回收、DiffPool 软分配矩阵、TopKPool 硬选择）；异构图（R-GCN 每关系一个权重矩阵 + 基分解、HGT 类型化注意力、HAN 元路径双层注意力）；链接预测与知识图谱补全（TransE 平移、RotatE 旋转、ComplEx 复值）；三类任务（节点级/边级/图级）。
- **04 图注意力网络**：GAT（LeakyReLU( aᵀ[W h_i ∥ W h_j] ) + softmax 邻域归一化，权重从“结构决定”变“数据决定”，注意力只在边上算保 |E| 复杂度）；多头图注意力（中间层拼接末层平均）；GATv2 的静态注意力缺陷分析（分解成两项后排序只由邻居决定）与修复（非线性移进括号内，免费换严格更强表达力）；Graph Transformer（全局注意力打破局部瓶颈；Graphormer 用最短路距离偏置 + 边偏置 + 中心性编码注入结构；GPS 每层同时跑消息传递 + 全局注意力两头兼得）；位置/结构编码（拉普拉斯特征向量及其符号歧义、随机游走返回概率、度编码）；可扩展性（邻域爆炸、采样、Cluster-GCN 分块、稀疏/线性注意力）；时序图（快照 DTDG vs 连续事件流 CTDG，TGN 的 GRU 记忆状态 + Fourier 时间编码、TGAT 时间衰减注意力）。
- **05 3D 图网络**：几何图（节点带 3D 坐标，边可按距离定义）；几何量层级——距离（旋转平移不变）、键角、二面角（蛋白质骨架必需）、相对位置向量（平移不变但旋转敏感 → 需等变架构）；SE(3)/E(3) 等变性要求（标量输出要不变、向量输出要等变——转分子能量不变、力向量跟着转）；不变式路线——SchNet（距离 RBF 展开 + 连续滤波卷积，设计选择即免费获得不变性）、DimeNet（方向性消息传递 + 球贝塞尔/球谐函数编码角度）、SphereNet（加二面角的全几何层级）；等变式路线——EGNN（位置由相对向量加权和更新，可证等变，优雅但只有一阶张量）、张量场网络/SE(3)-Transformer/MACE/Equiformer（球张量阶 ℓ 的 Wigner-D 矩阵变换 + Clebsch-Gordan 张量积，MACE 用高阶消息少层数高精度）；应用（分子性质预测 QM9/OC20、分子动力学加速千到百万倍、蛋白质结构——AlphaFold 的几何推理、材料与催化、DiffDock 的 SE(3) 等变扩散对接）；图生成（自回归 GraphRNN、GraphVAE、离散扩散 DiGress、保证化学有效性的 JT-VAE、目标导向生成 = 生成 + 性能评估 + RL/Bayes 优化闭环）。

前置要求：第 2 章（特征分解/正定）、第 1 章（对偶与注意力）。第 01 页值得所有 AI 从业者读——它把全书架构地图收拢成一个原理。

### 第 13 章 计算与操作系统（5 页）

全章定位：从离散数学到编程语言的“计算机科学通识”卷，每页都落到 ML 实践（为什么显存是瓶颈、为什么 GIL 挡并行、为什么 cache 友好的代码快 100 倍）。

- **01 离散数学**：命题逻辑（五个连接词、真值表、vacuous truth 的澄清、De Morgan/逆否命题在代码中的直接对应）；谓词逻辑与量词（否定翻转、嵌套量词顺序敏感，形式化规格的语言）；证明四法（直接、反证——√2 无理数经典、归纳——递归算法正确性的隐式基础、鸽巢——哈希碰撞必然性）；集合（幂集 2ⁿ、可数 vs 不可数无穷——程序可数而函数不可数所以大多数函数不可计算）；关系（等价关系分等价类、偏序——并发的 happens-before 关系就是偏序）；函数（单射/满射/双射映射到无损压缩/加密/可逆）；图论算法侧（MST 的 Kruskal/Prim、平面图欧拉公式、图着色 = 寄存器分配、Euler 多项式时间 vs Hamilton NP 完全的对照）；递推关系与 Master Theorem（归并排序 T(n) = 2T(n/2) + n 三种情形判定）；可计算性（图灵机、丘奇-图灵论题、停机问题的对角反证——完美死锁检测器/病毒扫描器/优化编译器在数学上不可能）；复杂度（P/NP/NP-complete/NP-hard、归约、SAT/TSP/图着色/子集和清单、实践中用近似与启发式）。
- **02 计算机体系结构**：数制（二进制/十六进制、补码让加减共用电路、IEEE 754 的符号-阶码-尾数布局，float16/bfloat16 与 ML 混合精度的直接联系、0.1+0.2≠0.3 与 Kahan 求和）；逻辑门（NAND 是万能门、半加器/全加器级联）；CPU 组成（ALU/寄存器/PC/控制单元、取指-译码-执行循环与光速物理限制）；ISA（CISC vs RISC、x86 内部解码成微操作、ARM 与 RISC-V）；流水线（流水线冒险三类——数据冒险用转发、控制冒险用分支预测 >95% 准确、误预测代价约 15 周期）；存储金字塔（寄存器 0.3ns 到 HDD 5-10ms 的巨大落差、时间/空间局部性、组相联、MESI 缓存一致性——并发编程困难的根源之一；直接点破 ML 的行主序、batch 大小、混合精度都是在跟存储层级博弈）；虚拟内存（页表 + TLB、缺页与 thrashing——训练爆内存的本质）、I/O 三方式（轮询/中断/DMA——`model.to('cuda')` 就是 PCIe 上的 DMA，带宽常是 GPU 训练瓶颈）。
- **03 操作系统**：OS 三职责（抽象/资源管理/隔离）；进程（PCB、fork+exec 模型、四状态转换、上下文切换代价）；线程（共享内存快但危险、内核线程 vs 用户线程、M:N 模型——Go goroutine、线程池）；CPU 调度算法族（FCFS 的护航效应、SJF 最优但需预知、RR 时间片权衡、优先级 + 老化防饥饿、MLFQ 自适应、Linux CFS 红黑树按虚拟运行时间）；内存管理（分页/请求分页/分段、分配器与碎片）；文件系统（inode 与硬链接、FAT/ext4/Btrfs、日志防崩溃损坏）；系统调用与内核态/用户态切换；网络栈（TCP/IP 四层、TCP 三次握手与拥塞控制 vs UDP 低延迟、socket、DNS、HTTP；延迟影响同步屏障、带宽影响梯度传输——分布式训练的两个维度）；虚拟化与容器（VM 完整内核 vs 容器共享内核 + namespaces/cgroups，CUDA 版本打包成镜像解决复现性，Kubernetes 编排大规模 serving）；安全基础（权限、最小特权、seccomp/AppArmor 沙箱、ASLR）。
- **04 并发与并行**：概念之分（并发 = 交替管理的艺术、并行 = 多核同时执行，一个厨师换菜 vs 两个厨师）；同步原语（竞态条件的丢失更新实例——counter += 1 是三步、mutex/信号量/条件变量/管程/读写锁）；三大经典问题（生产者-消费者 = 消息队列的原理、读者-写者的饥饿、哲学家就餐 = 死锁活教材）；死锁（四必要条件、预防 = 资源全序、避免 = 银行家算法、检测 = 等待图找环——数据库 abort 一个事务）；无锁结构（CAS 原子指令 + 重试循环、lock-free vs wait-free 之分）；并行编程模型（OpenMP 共享内存指令、MPI 消息传递——ring all-reduce 就是 MPI 集合操作、GPU SIMT）；异步与事件循环（协程 await 挂起、I/O 密集 vs CPU 密集选型、Python GIL 及 3.13+ free-threaded 去除）；扩展定律（Amdahl 串行瓶颈——数据加载占 10% 则 GPU 上限 10 倍、Gustafson 换个视角——加大 batch 的弱扩展对应线性加速）。
- **05 编程语言**：范式（命令式/OOP/函数式——纯函数易并行且 JAX 的 grad 正是建立在纯函数性上/逻辑式）；类型系统四象限（静态/动态 × 强/弱，type hints + mypy 在生产 ML 的价值）；内存管理三路（C 手动管理的三类经典错误、GC 两种——追踪式有停顿 vs 引用计数遇循环——Python 依赖独立循环检测器、Rust 所有权 + 借用检查器编译期零开销保安全）；编译管线五段（词法 → AST → 语义分析 → 优化——常量折叠/死代码/内联 → 生成，LLVM 作为公共中间表示普惠多语言）；解释与 JIT 光谱（CPython 字节码慢百倍、JVM/JIT 热点编译、PyPy、jax.jit 首次调用编译后缓存——把这条光谱讲成一条轴）；语言特性（闭包与捕获、模式匹配、代数数据类型、trait/接口）；DSL（SQL/正则/shader，PyTorch/JAX 本质是嵌在 Python 里的张量计算 DSL）；设计权衡表（性能 vs 安全、表达力 vs 简单、控制 vs 抽象、编译速度 vs 运行速度，ML 生态的 Python 训练 + C++/CUDA 推理 + Rust 基建分工）。

前置要求：无硬性前置，可与第 6 章第 05 页（分布式训练）互相印证。

### 第 14 章 数据结构与算法（6 页，面试导向）

全章定位：LeetCode/面试备战卷。理念是“模式识别而非背题”——把千道题收拢为 15-20 个核心模式，每个模式讲清“什么结构特征触发它、为什么成立、怎么变形”，每页末尾附 NeetCode 习题清单（带链接）。作者自称朋友靠这套材料过了大厂面试。

- **00 基础**：Big O（增长率层级表——10⁸ 操作/秒下各复杂度能撑多大的 n、分析套路、常见陷阱：Python 里 `in list` 是 O(n)、字符串循环拼接是 O(n²)、摊还 vs 最坏之分）；递归（信任递归的思维法、尾递归 Python 不优化）；回溯（choose-explore-unchoose 三步模板、剪枝把 N-Queens 从 1600 万候选砍到 4 万）；DP（最优子结构 + 重叠子问题双判据、Fibonacci 三版对比、五步配方——定义状态/写递推/基例/迭代顺序/空间优化、1D/2D/区间/背包/ bitmask 分类、自顶向下 vs 自底向上对照表）。
- **01 数组与哈希**：数组机制（连续内存 + cache 局部性是快 10-100 倍的真因、动态数组摊还翻倍）；哈希表（链地址 vs 开放寻址、负载因子与再哈希、Bloom 过滤器）；四大模式由浅入深——哈希查找（Two Sum 的 complement 技巧 → Group Anagrams 的规范化键 → Longest Consecutive Sequence 的“只从序列起点起数”防退化）、双指针（回文 → 3Sum 去重 → 接雨水 O(1) 空间解法）、滑动窗口（股票 → 无重复最长子串 → 最小覆盖子串的 have 计数器优化）、前缀和（区间和 → 和为 K 的子数组配哈希 → 除自身以外数组的乘积）。
- **02 链表、栈与队列**：链表（哨兵节点消特判、LRU 缓存的 doubly 链表用途）；快慢指针族（判环、找中点、找环起点的 a = c - b 推导、K 组翻转）；栈（括号匹配）；单调栈（每日温度、柱状图最大矩形——含 start 回溯扩展和哨兵清栈两个坑）；队列与双栈实现；堆（二叉堆数组表示、建堆 O(n)、第 K 大元素维护 size-k 小顶堆、合并 K 条链表的堆解法及 tiebreaker 坑）。
- **03 树**：四种遍历（递归拼接列表的 O(n²) 陷阱）；核心递归模式（深度、翻转、LCA 分裂判定、最大路径和的“过此节点”vs“贡献给父节点”双问题）；BST（验证 BST 必须传 lo/hi 边界不能只查直接子节点、第 K 小 = 中序）；Trie（O(L) 与词数无关、Word Search II 用 Trie 剪枝）；Union-Find（路径压缩 + 按秩合并 = 反 Ackermann 近似常数、连通分量数、冗余连接找环）；线段树与 Fenwick 树（lowbit 技巧，前缀和场景选 Fenwick）。
- **04 图**：表示（邻接表几乎总是对的）；BFS（入队时标记 visited 的关键、岛屿数量网格四方向模板、腐烂橘子的多源 BFS = 最短时间语义）；DFS（三态 visited 区分“在探索”与“探索完”——课程表判环的正确姿势）；拓扑排序（Kahn 入度法，结果不满即有环）；Dijkstra（跳过陈旧堆条目的必要、负权不可用）；Kosaraju 强连通分量。
- **05 排序、搜索与算法设计**：排序算法对照表（稳定性定义、比较排序 Ω(n log n) 下界的决策树证明、归并/快排/计数排序实现及 pivot 与稳定性坑）；二分查找（防 off-by-one 模板、lower_bound、旋转数组找“哪半有序”、两有序数组中位数的分区点二分——最难一题）；答案二分元模式（“容量最小能几天运完”——只要可行性判定单调就能二分答案）；贪心（跳跃游戏的最大可达、合并区间）；DP 实战（爬楼梯、零钱兑换、LCS、0/1 背包及 1D 逆向迭代防重复使用的坑）；回航实战（子集/组合总和——`backtrack(i)` vs `backtrack(i+1)` 决定能否重用、N-Queens 的对角线集合编码）。

前置要求：第 13 章第 01 页的 Big O 与 Master Theorem。目标是刷题的人按页序过一遍即可；纯做 ML 的可以把这章当工具书。

### 第 15 章 生产级软件工程（5 页）

全章定位：把“能跑的 notebook”升级成“能维护的生产代码”的工程卷，最后一节专讲如何用好 AI 编码代理，在同类教材里相当超前。

- **01 Linux 与命令行**：shell 基础与管道组合（“找出日志里最常见的 10 种错误”一行命令示范）；文件系统层级（ML 相关：CUDA 在 /usr/local/cuda、GPU 是 /dev/nvidia0）；权限（rwx 三类用户、chmod 脚本执行位）；进程管理（nohup 让训练扛住 SSH 断连、tmux 持久会话、nvidia-smi 与 watch）；包管理（永远别装进系统 Python）；环境变量（CUDA_VISIBLE_DEVICES、.env 与 gitignore）；SSH（密钥、config 别名、端口转发连远程 Jupyter、rsync）；末尾一整块 ML 工程师日常命令速查表。
- **02 Git 与仓库管理**：快照式心智模型与四区流转（工作区 → 暂存 → 本地 → 远程）；分支策略（feature branch 是 ML 团队甜点位、trunk-based 需要强 CI、gitflow 对 ML 过重）；merge vs rebase 的选择法则（rebase 自己未推送的分支、merge 进主干、绝不 rebase 已共享提交）；冲突解决；好提交信息的格式（祈使语气、原子提交让 bisect 可用）；PR 实践（400 行以内、review 的真正目的是知识共享而非抓虫）；ML 向 .gitignore 模板；Git for ML 三难题——大文件（LFS/DVC）、实验追踪（W&B/MLflow/至少记录 git hash）、可复现清单（commit hash + config + 种子 + pip freeze + 数据版本 + 硬件）。
- **03 代码库设计与模式**：src 布局防导入污染、scripts 与库分离（训练脚本应只有 50 行）；clean code（命名第一、单一职责、DRY 但不过早抽象——配了“何时才该提取”的判断、消灭魔法数字）；ML 设计模式四件套（注册表工厂按 config 实例化模型、策略模式换损失、观察者回调早停、依赖注入让 logger 可 mock）；配置管理（YAML + Hydra 组合覆盖，实验配置随结果一起存档）；日志五级与结构化日志（JSON 供机器检索）；API（FastAPI + Pydantic 校验、gRPC 内部通信）；打包（pyproject.toml、可编辑安装 -e、锁版本）；**AI 编码代理专节**——定位是“快但没经验的结对程序员，你是 senior 它是 junior”：何时用（脚手架/测试/机械重构/原型/文档）、何时不该依赖（架构决策/安全代码/性能关键内循环/你看不懂的代码——最后一条是最常见也最危险的失败模式）；review 纪律（逐行读、查幻觉 API、防过度工程）；好 prompt 的写法（给上下文、定约束、要解释）；质量门（mypy/ruff/pytest/CI）与代理产出的组合拳；点破“生产率幻觉”——10 分钟生成 500 行再花 2 小时调试，不如自己写 200 行。
- **04 测试与质量保证**：测试金字塔（单元多、集成少、E2E 更少）；pytest（fixture 与 scope、参数化）；mock 的边界（mock 外部服务与昂贵操作，别 mock 自己的逻辑）；ML 专属测试五招——形状测试、梯度流测试（每个可训练参数梯度非零）、单 batch 过拟合测试（过拟合不了说明根本性错误）、数据验证（NaN/inf 检查）、确定性测试（同种子同输出）；浮点容差断言；CI（GitHub Actions 流水线示例：lint → type check → test）；pre-commit hooks；ruff + mypy。
- **05 部署与 DevOps**：Docker for ML（层缓存顺序——requirements 先于源码让重建从 10 分钟变 10 秒、GPU passthrough、多阶段构建瘦身、compose 编排模型 + 监控）；模型 serving 工具谱（Triton 的动态批处理/模型集成/多模型共享、TorchServe、vLLM 的 PagedAttention、Cactus 端侧引擎的 OpenAI 兼容 API + 云回退混合架构）；模型格式（ONNX 互通、TensorRT 2-5 倍提速、GGUF）；实验追踪（W&B/MLflow 代码示例、模型注册表回答“生产上跑的是哪个模型谁训的”）；可复现（清单表格 + 全部 pin 死 + Docker 镜像哈希即环境指纹）；生产监控（延迟看 p50/p95/p99、吞吐、错误率、模型指标、数据漂移与特征漂移的统计检验、Prometheus + Grafana + 告警）；特征库（Feast 解决训练-服务偏斜与特征复用）；流水线编排（Airflow DAG 示例、Kubeflow、Prefect/Dagster；“什么时候才需要编排器”的判据）。

前置要求：第 13 章（OS 与体系结构）。这一章对从研究转工程的读者价值最高。

### 第 16 章 SIMD 与 GPU 编程（8 页，第二厚的章）

全章定位：从“为什么 Python 只是方向盘”讲到亲手写 Vulkan compute shader 的完整性能工程卷，抽象阶梯清晰——C++ intrinsics → CUDA → Triton/Pallas → JAX/PyTorch。

- **00 为什么是 C++ 与 ML 框架原理**：双语言架构的分工表（一次 4096² 矩阵乘纯 Python 30 分钟 vs C++ 10 毫秒，18 万倍差距）；框架分层解剖（Python API → dispatch/JIT → C++ kernel 库 → 硬件后端；NumPy 走 BLAS、PyTorch 的 ATen 与 torch.compile、JAX 编译到 XLA）；给 Python 工程师的 C++ 速成（指针、栈堆、模板、STL、智能指针）；何时才写自定义 kernel（四判据）与三条绑定路径（pybind11、torch cpp_extension、JAX custom call/Pallas）；附 g++/clang 编码任务（含行主序 vs 列主序访问的实测对比）。
- **01 硬件基础**：免费性能时代终结史（2005 年 4 GHz 功耗墙 P ∝ CV²f → 多核是唯一出路）；现代 CPU 执行技术（超标量、乱序、分支预测、投机）；SIMD 概念与向量寄存器宽度表；roofline 模型（算术强度 = FLOPS/字节，memory-bound vs compute-bound 的判定——点破 kernel fusion 为什么是 ML 最重要的优化：把三个 memory-bound 操作合成一个 compute-bound）；延迟 vs 吞吐（公交车 vs 出租车类比 GPU vs CPU）；芯片版图（x86/ARM/Apple Silicon 统一内存与 AMX/RISC-V/GPU/TPU）；功耗与暗硅（FLOPS/watt 才是 Scale 时代的真指标）；C++ 基准测试套路（warm up、测带宽不测 FLOPS）。
- **02 ARM 与 NEON**：ARM RISC 特征（load-store、定长指令、32 寄存器）；NEON intrinsics 命名法与核心指令（vfmaq_f32 是 ML 最重要的 SIMD 指令、vaddvq 归约、vbslq 掩码选择）；向量点积实战（4 累加器隐藏 FMA 延迟 + 尾部清理循环的通用范式）、无分支 ReLU；I8MM（INT8 矩阵乘指令，量化推理快 4-8 倍）；SME/SME2（ZA tile 二维寄存器 + 外积累加，流模式）；SVE/SVE2（向量长度无关编程，谓词寄存器替代清理循环）；Apple Silicon 细节（P/E 核、AMX 不可直接编程、统一内存消灭 CPU-GPU 拷贝、Neural Engine、MLX）；自动向量化（帮编译器的写法：restrict/无依赖/连续访问，何时才值得手写 intrinsics）。
- **03 x86 与 AVX**：SIMD 演进表（MMX → SSE → AVX/AVX2 → AVX-512 → AMX，xmm ⊂ ymm ⊂ zmm 的向下兼容）；AVX2 intrinsics（fmadd 命名法、加载存储、set1 广播）；点积与 softmax 实战（水平归约为什么丑——SIMD 天生垂直）；AVX-512（掩码寄存器消灭标量清理、降频问题）；Intel AMX（tile 寄存器一条指令算 16×32 × 32×16）；内存对齐（现代 CPU 上已基本不重要但 cache line 分裂仍 2 倍慢）；性能坑（AVX-SSE 转换惩罚、寄存器压力、多累加器展开隐藏 FMA 延迟）；profiling（perf stat 的 IPC/缓存未中/分支误预测解读）。
- **04 GPU 架构与 CUDA**：CPU vs GPU 设计哲学对比表；GPU 内存层级表（寄存器/共享内存/L1/L2/HBM 的延迟带宽）；CUDA 编程模型（grid-block-thread 层级、第一个 vector add 完整代码）；warp 与 SIMT（warp divergence 的串行化代价与 branchless 写法）；memory coalescing（合并访问 vs 步长访问的 3% 带宽利用率惨案）；共享内存 tiling 完整矩阵乘 kernel（__syncthreads 两个位置的原因）；streams 重叠传输与计算；Nsight profiling 的 occupancy/带宽解读；进阶技术（AoS vs SoA 数据布局、软件预取、kernel fusion、混合精度 Tensor Core、内存池分配器——torch.empty 微秒级的真相、roofline 引导的优化决策树）；NVIDIA 世代表（Volta Tensor Core → Hopper FP8 Transformer Engine → Blackwell）。
- **05 Triton 与 TPU**：Triton 的 block-level 抽象（不用管线程、mask 处理边界、编译到 PTX 缓存）；softmax kernel 与融合 kernel 实战（PyTorch 3 个 kernel vs Triton 1 个）；autotune 自动调 tile 配置；Triton vs CUDA 选型表（80-95% 性能换 10 倍开发速度）；Flash Attention 案例研究（online softmax 的运行最大值重缩放技巧、SRAM 内循环、为什么它让长序列成为可能）；TPU 架构（systolic array MXU 的确定性数据流、ICI 互联、BF16 发源地）；JAX/Pallas 写 TPU kernel；GPU vs TPU 选型表与全场景工具选择表。
- **06 RISC-V 与嵌入式**：开源 ISA 的经济学（零授权费）；模块化指令集（47 条基础 + 扩展）；V 向量扩展的 vsetvl 长度自适应编程与 LMUL；TinyML 的极端约束表（微控制器 256 KB RAM vs 服务器 80 GB）；TFLM（静态 tensor arena、无 malloc、20 KB 运行时）；边缘模型优化四招（量化/剪枝/蒸馏/NAS——MCUNet）；RISC-V 在 AI 加速器里当控制核的架构模式（Esperanto/Tenstorrent）；边缘部署的五大约束（功耗/延迟/隐私/连接/规模化成本）。
- **07 Vulkan 与跨平台 GPU**：为什么需要 Vulkan（AMD/Intel/Android/浏览器没有 CUDA）；显式控制哲学（300 行 vector add 换驱动简单与性能）；GLSL compute shader 与 CUDA 概念映射表（workgroup↔block、barrier↔__syncthreads）；shared memory 版 ReLU、树形归约、tiling 矩阵乘三个 shader；完整 C++ 管线十步（instance → 设备 → 队列 → buffer → SPIR-V → pipeline → descriptor → command buffer → 提交 → 读取）；Kompute 封装库对比；WebGPU/WGSL 浏览器推理（ONNX Runtime Web、Transformers.js）；何时用 Vulkan 的场景表。

前置要求：第 13 章（体系结构、并发）。第 04 页的 tiling 与第 05 页的 Flash Attention 是理解现代推理引擎（第 17 章）的直接前置。

### 第 17 章 AI 推理（5 页）

全章定位：“让大模型跑得又快又便宜”的推理优化卷，是全书与生产部署距离最近的一章。

- **01 量化**：开篇即算账——70B FP16 要 140 GB，INT4 只要 35 GB；量化收益四来源（显存/吞吐/带宽——LLM 推理是带宽瓶颈所以量化近似线性加速/能耗）；精度格式全表（FP32 → TF32/FP16/BF16 → FP8 E4M3 与 E5M2 → INT8/4/2，BF16 与 FP16 的范围-精度权衡）；量化方程（scale/zero-point、对称 vs 非对称）；粒度四级（per-tensor → per-channel → per-group → per-token，outlier 问题用编码任务实测 per-channel 比全 tensor 好 6 倍）；PTQ 校准四法（min-max/百分位/MSE 最优/KL 熵，TensorRT 用后者）；QAT（直通估计器，何时值得花 1 万-10 万美元重训）；权重-only 量化全家桶——GPTQ（逐列量化 + Hessian 误差补偿）、AWQ（保护 1-3% 显著通道的缩放技巧）、GGUF 的 k-quants、QuIP/QuIP#（正交旋转去相干 + E8 格点码本做到 2-bit）、SpQR（离群点全精度存储）、HQQ（零校准数据）、AQLM（多码本加性量化 2-bit SOTA）、BitNet b1.58（三值权重，矩阵乘变加减法）；Microscaling 块浮点格式（业界新标准）；FP8 训练配方（前向 E4M3、反向 E5M2、延迟缩放）；SmoothQuant 把激活量化难度迁移给权重；KV-cache 量化（编码任务算出 70B 模型 128K 上下文 FP16 要 330 GB，不量化根本不可行）。
- **02 高效架构**：StreamingLLM（attention sink 现象——前几个 token 承接异常高注意力，逐出即崩；sink + 滚动窗口实现常数内存无限生成）；稀疏注意力（滑窗/局部+全局/膨胀/交错混用——Mistral 的选择）；线性注意力与 SSM（φ(Q)(φ(K)ᵀV) 的结合律技巧、RWKV、Mamba 的选择性）；MQA/GQA/MLA 三级 KV-cache 压缩（32 头 → 8 组 → 1 组 → DeepSeek-V2 潜向量压缩 93.3%）；FlashAttention 回收（已内置于所有主流框架）；Ring Attention（K/V 块沿设备环形传递、通信与计算重叠、百万 token 上下文）；MoE 推理的专家缓存与 offloading；蒸馏（温度软化 + 任务特定蒸馏——7B 学生在医疗问答上可胜 70B 老师）；剪枝（非结构化 vs 结构化、NVIDIA 2:4 稀疏是唯一有硬件加速的模式、彩票假说）；NAS 与 once-for-all 网络。
- **03 服务与批处理**：prefill 与 decode 的两相分裂（prefill 是计算密集并行、decode 是带宽密集串行，GPU 利用率 1-10% vs 50-80%；TTFT 与 TPOT 两个指标的不同用户容忍度）；静态批处理的两大浪费（等最长的、padding 空转）；«Redacted — read as environment variable $SECRET_UNQUOTED_SECRET_ASSIGNMENT_9 via script» batching（逐步插入移除，2-10 倍提升）；PagedAttention（把 OS 虚拟内存思想搬进 KV-cache——分页、按需分配、写时复制共享前缀）与 vLLM；调度策略（FCFS/SJF/抢占/优先级/token 预算）；分离式 serving（prefill 节点与 decode 节点分开部署，Mooncake 架构）；多模型与 LoRA serving（S-LoRA 千级 adapter、Punica 批内异构 adapter）；约束生成（Outlines 把 JSON schema 编译成 FSM，掩码非法 token，消灭 10-30% 的重试）；请求路由（级联——小模型先答置信度不够升级大模型，80% 流量走便宜模型省 70% 成本；Cactus 的端云混合路由）；指标表（TTFT/TPOT/吞吐/p99/成本/SLA 达标率）。
- **04 边缘推理**：边缘的四重收益（无网络/低延迟/零边际成本/隐私）与算力鸿沟表（H100 989 TFLOPS → 手机 NPU 45 TOPS → ESP32 0.001 TOPS）；压缩流水线五步顺序（蒸馏 → 结构化剪枝 → 量化 → 编译器优化 → 运行时，顺序错了会压已损失模型）；端侧运行时谱（ONNX Runtime 最可移植、TFLite、Core ML、ExecuTorch、TensorRT、llama.cpp）；编译器栈（图优化——常量折叠/融合/布局变换 → 下降 → 后端——tiling/向量化/内存规划）；硬件目标（Adreno/Mali/Apple GPU、NPU 三家——Apple Neural Engine 38 TOPS、Hexagon、Edge TPU，delegation 模式拆分算子）；端侧 LLM 现状表（Llama 3.2 1B Q4 约 700 MB 手机 30 token/s；内存/温控降频/电池三难）；联邦学习（FedAvg、差分隐私、梯度压缩）；延迟优化（early exit、模型分区、缓存、投机预取）。
- **05 扩展与部署**：推理侧并行（张量并行每层 all-reduce——NVLink 加 8 ms vs PCIe 加 240 ms，这就是 NVLink 值钱的原因；流水线并行跨节点；序列并行切 KV-cache）；投机解码完整算法（draft 提案 + target 单次验证，接受-拒绝保证分布不变即无损，2-3 倍加速；Medusa/EAGLE/自投机变体）；前缀缓存（系统提示词 KV-cache 复用、SGLang 的 RadixAttention 前缀树，TTFT 降 50-90%）；KV-cache 逐出策略（H2O 的 heavy-hitter + 滑窗、Scissorhands，核心洞察是注意力实际稀疏）；框架选型表（vLLM 默认之选、TensorRT-LLM 极致性能、SGLang 结构化输出、llama.cpp 消费级、Ollama 本地）；成本优化五招（GPU 匹配负载/spot 实例/自动扩缩/提高利用率/量化）与每百万 token 成本对照表（自托管 70B INT8 $0.25 vs GPT-4o API $2.50）；生产监控（p99 尖峰的三种病因、GPU 利用率与 MFU 解读、质量回归排查）。

前置要求：第 16 章（roofline、tiling、Flash Attention）、第 6 章第 05 页（分布式训练）。做 LLM 推理部署的人应整章精读。

### 第 18 章 ML 系统设计（5 页）

全章定位：面试与实战双用的“从零设计一套 ML 系统”卷，第 05 页给了七个完整案例。

- **01 系统设计基础**：客户端-服务器与有状态/无状态之分（无状态才能水平扩展）；应用层协议（HTTP/WebSocket 流式——LLM token 流就靠它/gRPC + protobuf）；DNS 的负载均衡/地理路由/故障转移用途；反向代理与 API 网关（认证/限流/路由）；负载均衡算法（轮询/最少连接/加权/一致哈希——前缀缓存亲和也靠它）与 L4/L7 之分；缓存三模式（cache-aside/write-through/write-back）与逐出策略（LRU/LFU/TTL）、CDN、Redis 在 ML serving 的角色（预测缓存命中率 20-40% 直接省 GPU）；SQL vs NoSQL 五族与 CAP 定理（特征库选 AP、模型注册表选 CP）；分片（哈希/范围/一致哈希解决重分片）；索引（B-tree/哈希/复合索引的最左前缀）；API 设计（REST 约定、分页、版本化、结构化错误）；消息队列（Kafka 的 topic/partition/offset、为何生产者消费者解耦）；一致性模型四档；韧性模式五件套（限流/熔断/背压/指数退避 + jitter/幂等性）。
- **02 云计算**：IaaS/PaaS/SaaS/FaaS 四层模型与 ML 团队的混用策略；三大云的 ML 服务清单（EC2/S3/SageMaker、GCE/GCS/Vertex + 独家 TPU、Azure + 独家 OpenAI）；Kubernetes for ML（Pod/Deployment/Service/StatefulSet/DaemonSet、NVIDIA device plugin 把 GPU 变成可调度资源）；三种自动扩缩（HPA 按指标、Cluster Autoscaler 按节点、KEDA 按队列深度）；存储四型（块/对象/文件/数据湖，训练数据从 S3 流式加载的三个方案）；云网络（VPC/子网公私隔离/安全组——配置错误是云安全第一事故源/服务网格 Istio 的 mTLS 与流量切分）；serverless 的适用与不适用（冷启动 0.5-5 秒毁掉延迟敏感推理）；成本管理（spot 6-9 折但要能容忍中断、预留实例、自动扩缩、right-sizing、存储生命周期策略）；多区域部署（active-passive vs active-active、数据驻留合规）；GPU 云定价对照表；Terraform IaC（声明式、可审计、可灾备重建）。
- **03 大规模基础设施**：垂直 vs 水平扩展与无状态默认可扩展；分布式三难（网络分区、时钟偏差——逻辑时钟、共识——Raft 选主容忍 ⌊(n-1)/2⌋ 故障）；微服务（独立部署扩缩 vs 网络开销、服务发现、Saga 补偿事务）；数据管道（批处理 Spark、流处理 Flink 的 exactly-once 与事件时间、Lambda 架构 vs Kappa）；ML 训练基础设施重头戏——GPU 集群解剖（8×H100 节点、NVLink 900 GB/s 是 PCIe 30 倍；Llama 3 用 16384 卡）；网络拓扑（InfiniBand 400 Gb/s、RDMA 绕过 CPU、胖树 vs rail-optimized 与并行策略的匹配关系）；存储三层（数据集 Lustre/检查点 70B Adam 560 GB 一个、日志）；作业调度（SLURM、Volcano/Run:ai 的 gang scheduling、碎片化与拓扑感知）；容错（万卡集群 MTBF 以小时计；Llama 3 训练 54 天中断 466 次，有效时间 90%——基础设施决定能不能训前沿模型）；MFU（40-50% 及格 50-60% 优秀，损失来自通信/带宽/空闲）；自建 vs 租用的规模分界（>1000 卡持续 6 个月以上自建便宜 2-3 倍）；数据库扩展（读写分离/分片/连接池）；搜索与向量系统（倒排索引 + BM25、FAISS 四种索引——HNSW 是默认之选）；可观测性三支柱（结构化日志 ELK、指标 RED/USE 方法、OpenTelemetry 分布式追踪）；可靠性（SLO/SLI/SLA、错误预算、混沌工程）；CI/CD（蓝绿/金丝雀/feature flag + ML 特有的影子部署）。
- **04 ML 系统设计**：完整生命周期环（问题定义 → 数据 → 特征 → 训练 → 评估 → 部署 → 监控 → 迭代）；问题定义先行（“该用 transformer”不是设计答案，“200ms 内从 1000 万候选排序”才是）；数据（显式 vs 隐式标签、Snorkel 程序化标注、主动学习省 10 倍标注、数据校验 Great Expectations）；特征库双库架构（offline Spark + online Redis，消灭训练-服务偏斜）；评估双轨（离线——切片评估防“总体 95% 某群体 70%”、回测防时间泄漏；在线——A/B 测试的样本量/周期/护栏指标、影子部署、交错评估比 A/B 更省样本）；服务（批 vs 实时混用、模型注册表与一键回滚）；特征工程模式（计数/嵌入/交叉/时间/聚合五类）；监控重头戏——数据漂移（KS 检验、PSI 阈值 0.1/0.25、嵌入漂移）vs 概念漂移（关系变了特征没变，靠代理指标监控）；反馈回路专题（推荐系统流行度正反馈塌缩、欺诈模型“抓光就没样本”负反馈，四种缓解——探索采样/反事实日志/holdout/延迟标签）；embedding 表管理（50 GB 表的存储分片/蓝绿更新/冷启动）；公平性监控（demographic parity/equal opportunity/calibration 三指标与发布流程）。
- **05 ML 设计案例**：七个完整案例走统一七步框架（问题定义/数据/特征/模型/服务/评估/迭代）——推荐系统（两阶段管道 1 亿候选 → 召回 1000 → 精排 100 → 重排 20；双塔召回 + HNSW + 多目标精排 + 业务重排；冷启动是系统工程；附完整的基础设施估算——多少副本多少 GPU 每月多少钱）；搜索排序（查询理解四步纠错/扩展/意图/实体 → BM25 + 稠密检索混合 → pointwise/pairwise/listwise 三种 LTR 与 cross-encoder 重排）；广告 CTR（DLRM、校准直接决定出价所以必须准、Thompson 采样探索、RTB 拍卖流程）；欺诈检测（速度特征实时流、GBDT 标准、代价矩阵定阈值而非准确率、人审回流标注）；内容审核（多模态 + policy-as-code 分离模型与规则、主动/被动审核的选择、PhotoDNA 哈希是法律义务、人审规模估算——假阳性每降 0.1% 省 100 万次审核）；RAG 聊天机器人（分块策略四选、查询改写解决指代、护栏三层、逐项延迟与成本账）；大规模图像搜索（CLIP 嵌入 + HNSW 分片、增量插入）。末尾附系统设计面试五步框架（澄清 → 高层 → 深挖 → 评估监控 → 迭代）。

前置要求：第 15 章（部署 DevOps）、第 17 章（推理优化）。冲 ML 系统设计面试的人读 01+04+05，做平台工程的人读 02+03。

### 第 19–20 章 应用与前沿（各 5 页，均为提纲存根）

两章在仓库中尚未展开正文，每页只有一份要点提纲（各约 300 字节），对应官网标注的 “Coming” 状态：

- 第 19 章应用 AI：金融（时序预测/算法交易/组合优化/风控 VaR/反欺诈/金融 NLP/另类数据/可解释性与合规）、生物（AlphaFold 系列/蛋白质设计 RFDiffusion/分子生成/基因组 Enformer/单细胞/医学影像/临床 NLP）有提纲；药物发现、智能体系统、医疗三页完全空白。
- 第 20 章前沿 AI：量子机器学习（量子门/变分算法 VQE QAOA/量子核/贫瘠高原/NISQ 之争）、神经形态计算（脉冲神经网络 SNN/STDP/Loihi 2/事件相机）有提纲；太空数据中心、去中心化 AI、脑机接口三页空白。

目前这两章只当“学习路线预告”用，不必分配阅读时间。

---

## 全书地图与三条主线

整本书不是 20 个孤立章节，而是三条主线拧成的一股绳：

1. **数学主线（第 1–5 章）**：向量 → 矩阵 → 微积分 → 统计 → 概率。作者刻意让每一章都埋下后面会用到的钩子——第 1 章的余弦相似度是第 10 章嵌入检索的工具，第 2 章的 SVD 是第 4 章因子分析与第 8 章潜空间压缩的工具，第 5 章的交叉熵是第 6 章分类损失的真身。这条线的特点是“所有公式都带比喻”，适合被传统教材劝退过的人重建直觉。
2. **AI 主线（第 6–12 章）**：机器学习总纲之后按模态分章（语言、视觉、语音、多模态、机器人、图）。第 6 章是总纲（优化器、反向传播、RL、分布式训练一网打尽），第 7 章是全书信息密度最高的单章（从语言学一路讲到 2025 年的 DeepSeek-V3/Qwen3/Llama 4 架构细节），第 8–10 章各按“基础 → 架构 → 进阶”三段式推进。
3. **系统主线（第 13–18 章）**：计算机科学通识（离散数学/体系结构/OS/并发/语言）→ 工程实践（Linux/Git/测试/部署）→ 性能工程（SIMD/GPU/CUDA/Triton/Vulkan）→ 推理优化（量化/服务/边缘）→ 系统设计（基础设施 + 七大案例）。这条线回答的问题是“模型训出来之后，怎么让它以合理成本服务百万用户”。

全书贯穿三个写作习惯，读的时候可以主动利用：**每页末尾两道可跑的 JAX 编码任务**（数学章验证公式、AI 章手搓模型、系统章做基准测试，照着敲一遍胜过读三遍）；**比喻先行**（每个公式先给生活类比再给符号）；**前向引用显式标注**（“这在第 X 章会用到”），可以按需跳转。

## 学习路线

### 路线 A：AI 研究员 / 读研深造（全覆盖，约 3–6 个月）

第 1–5 章 → 第 6 章 → 第 12 章 → 第 7 章 → 第 8 章 → 按研究方向选修 9/10/11 → 第 16 章第 00–04 页 → 第 13 章。研究岗需要最宽的数学底座和“把架构统一成一个原理”的视角（第 12 章第 01 页），系统部分够用即可。

### 路线 B：LLM 应用与大模型工程师（当前最热门，约 2–3 个月）

第 1–2 章（速读，抓直觉）→ 第 3 章第 03/05 页（autodiff 与优化）→ 第 5 章第 02/05 页（贝叶斯与信息论）→ 第 6 章第 02/03/05 页 → **第 7 章全部（核心中的核心，建议精读二刷）** → 第 10 章第 01/02 页 → 第 15 章（工程化）→ 第 17 章全部（推理优化）→ 第 18 章第 04/05 页（系统设计）。第 7 章第 05 页覆盖 GQA/MLA/MoE/投机解码/RoPE 扩展，是这份材料相对其他教材的最大差异化价值。

### 路线 C：ML 平台 / MLOps / 基础设施工程师（约 2–3 个月）

第 13 章全部（CS 通识）→ 第 14 章（当工具书）→ 第 15 章全部 → 第 16 章全部（性能工程的完整阶梯）→ 第 17 章 → 第 18 章第 01–03 页。数学部分只需第 2 章第 05 页（SVD/分解）和第 6 章第 05 页（显存账本与并行策略）。

### 路线 D：语音 / 音频方向（约 2 个月）

第 1–3 章速读 → 第 6 章第 02/03 页 → **第 9 章全部（全书性价比最高的单章之一，编码任务全部可跑）** → 第 10 章第 01 页（CLIP 式对齐在音频的对应物）→ 第 16 章第 00–03 页（端侧 SIMD）。

### 路线 E：面试冲刺（约 1–2 个月）

- 算法岗：第 14 章全部（每页的 NeetCode 清单刷完）+ 第 13 章第 01 页。
- ML 工程岗：第 6 章第 02/05 页 + 第 7 章第 04/05 页 + 第 17 章 + 第 15 章。
- 系统设计岗：第 18 章全部（尤其第 05 页的七个案例和面试五步框架）。
- 研究岗：第 6 章全部 + 第 7 章第 04/05 页 + 目标方向对应章节 + 第 12 章第 01 页。

### 起点自检

- 完全零基础：从第 1 章第 01 页开始，一页一页来，每页编码任务都做。作者承诺只需要初等数学和基础 Python。
- 有线性代数基础：第 1–2 章可以两天扫完，但第 1 章第 05 页（对偶）和第 2 章第 05 页（分解）建议慢读。
- 有 ML 基础想补系统：直接进第 13 章，然后 15 → 16 → 17。
- 只对 LLM 感兴趣：第 7 章可以当入口，语言学名词卡住时再细读第 7 章第 01 页。

## 使用技巧

1. **编码任务别跳过**。这是这本书与传统教材最大的区别：每个公式都有对应的 JAX 验证代码，每个架构都有从零实现。第 3 章的迷你 autodiff、第 9 章的手搓 MFCC 与 CTC、第 16 章的 tiling 矩阵乘，做完这几个，相关的抽象就永久属于你了。
2. **善用仓库自带的 MCP Server**。仓库 mcp/ 目录内置了把全书当知识库的服务器，Claude Code、Cursor 等 AI 助手可以直接查询全书内容，配合本文的导读定位章节效率更高。
3. **两阶段学习法（作者自述）**：课后累积阅读（每次从上次起点重读到当前进度末尾，让大脑连接模式）+ 考前影子阅读（遮住内容，看小标题复述解释，只重读想不起来的部分，最后用代码实现一遍）。作者的类比是掩码语言模型。
4. **配合官网与仓库**。官网（henryndubuaku.github.io/maths-cs-ai-compendium）由 mkdocs 渲染，公式与 SVG 图比裸 Markdown 好读；仓库（HenryNdubuaku/maths-cs-ai-compendium）持续更新，19/20 章未来补全后可按需追加阅读。
5. **本书的已知局限**：条目式写作在少数页（尤其第 14 章面试向内容）显得仓促，个别页面有拼写笔误（不影响理解）；19/20 章未完成。把它当作“带代码的讲义”而非严谨教科书使用，定位就对了。

## 一页速查：每章一句话

| 章    | 主题           | 一句话定位                                |
| ----- | -------------- | ----------------------------------------- |
| 01    | 向量           | 线性代数地基，收尾于“坐标是对偶基的读数”  |
| 02    | 矩阵           | 矩阵即变换，分解是化难为易的通用策略      |
| 03    | 微积分         | 变化的数学，链式法则直通反向传播          |
| 04    | 统计           | 描述与推断，中心极限定理是根基            |
| 05    | 概率           | 不确定性数学，交叉熵损失的真身在这里      |
| 06    | 机器学习       | 前五章的总兑付，优化器谱系追到 2025       |
| 07    | 计算语言学     | 全书最重要单章，从语言学讲到前沿 LLM 架构 |
| 08    | 计算机视觉     | 从像素到 NeRF 与高斯泼溅的完整视觉栈      |
| 09    | 音频与语音     | 体量最大单章，编码任务全书最实            |
| 10    | 多模态         | CLIP 到 Gemini 的合流之路与世界模型       |
| 11    | 自主系统       | 感知、控制、VLA、自动驾驶、极端环境       |
| 12    | 图神经网络     | 对称性统一所有架构，3D 等变网络           |
| 13    | 计算与 OS      | CS 通识五合一，处处落到 ML 实践           |
| 14    | 数据结构与算法 | 面试模式识别，15-20 个模式吃透千题        |
| 15    | 生产软件工程   | notebook 到生产，含 AI 编码代理专节       |
| 16    | SIMD 与 GPU    | 从 intrinsics 到 Vulkan 的性能阶梯        |
| 17    | AI 推理        | 量化、架构、服务、边缘、成本的完整账本    |
| 18    | ML 系统设计    | 基础设施 + 七大案例 + 面试框架            |
| 19-20 | 应用与前沿     | 提纲存根，尚未展开                        |

**03 概率分布**：PMF/PDF/CDF 三件套与支撑集回顾后，按目录式过一遍核心分布——离散：Bernoulli（sigmoid 输出就是它的 p）、Binomial（二项式系数在此回收）、Poisson（均值 = 方差的签名性质，Binomial 的稀有事件极限）、Geometric（无记忆性）、Negative Binomial（过散计数数据）；连续：Uniform（随机数生成器的源头）、Normal（CLT 的产物；68-95-99.7 法则；MSE 损失隐含高斯误差假设、VAE 重参数化技巧都靠它）、Exponential（无记忆的等待时间）、Gamma（指数的推广）、Beta（定义在 [0,1] 上天然适合建模概率，且是 Bernoulli/Binomial 的共轭先验，为下一页埋线）、Chi-squared（k 个独立标准正态平方和）、Student t 分布（重尾，小样本不确定性）。末尾一张全分布均值方差速查表。

**04 Transformer 与语言模型**：post-norm vs pre-norm（残差直通梯度，深模型训练稳定的关键）；FFN = 参数大头 + 知识键值记忆假说；位置编码三件套——正弦/学习的绝对编码、RoPE（二维子空间旋转，RₘᵀRₙ = Rₙ₋ₘ 推出“注意力分数只依赖相对位置”的漂亮证明）、ALiBi 线性距离惩罚；三大范式（BERT 双向 + MLM 的 80/10/10 掩码策略与 NSP（RoBERTa 证明可弃）、GPT 因果注意力 + CLM、T5/BART 文本到文本 + span corruption）；GPT-2 零样本 → GPT-3 上下文学习；PEFT 三方案（Adapter、LoRA 的 W + BA 低秩分解、Prefix tuning）；prompt 工程（zero/few-shot、CoT）；scaling laws（Kaplan 幂律 → Chinchilla 修正，N_opt ∝ C^0.5，“每参数约 20 token”法则）；MoE（门控 top-k、负载均衡辅助损失、专家并行 all-to-all）；评估体系占了半页——表面指标（EM、token 级 P/R/F1、BLEU 修正 n-gram 精度 + 短句惩罚、ROUGE 召回向、ROUGE-L 的 LCS、METEOR、ChrF 字符级）、语义指标（BERTScore、BLEURT、COMET 看得到源句）、LLM-as-judge（成对比较 + Elo 排名，位置偏差/冗长偏差/自一致性三坑）、数据污染与金丝雀串；基准地图（GLUE 饱和、MMLU/MMLU-Pro、HellaSwag、GSM8K/MATH/AIME、HumanEval 的 pass@k 公式、SWE-bench、GPQA、TruthfulQA/BBQ、MT-Bench、Chatbot Arena）。

**03 图神经网络**：消息传递三步框架（消息 φ → 置换不变聚合 ⊕ → 更新 ψ，k 层看 k 跳邻域）；GCN 一行公式 H′ = σ(ÂHW)（谱卷积的一阶 Chebyshev 近似 + 自环 + 对称归一化防高度数节点支配）；GraphSAGE（邻域采样变归纳式，计算树限 10×10 与图大小无关）；GIN（WL 测试与表达能力上限，sum 聚合对多重集单射而 mean/max 不行——配了 [1,1,1,1] vs [2,2] 的反例）；过平滑（重复归一化邻接收敛到秩 1，GNN 只能浅、四种缓解手段）；图池化（readout 的 DeepSets 回收、DiffPool 软分配矩阵、TopKPool 硬选择）；异构图（R-GCN 每关系一个权重矩阵 + 基分解、HGT 类型化注意力、HAN 元路径双层注意力）；链接预测与知识图谱补全（TransE 平移、RotatE 旋转、ComplEx 复值）；三类任务（节点级/边级/图级）。
