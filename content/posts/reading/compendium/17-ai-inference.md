---
title: "AI 推理"
date: "2026-11-05"
order: 17
slug: "compendium/17-ai-inference"
description: "量化会降低模型权重和激活值的精度，从而使模型体积更小、运行速度更快，且计算成本更低。本文件涵盖了数值格式、训练后的量化处理、考虑量化的训练方法、仅针对权重进行量化的方法（如GPTQ、AWQ）、激活值量化、混合精度以及KV缓存量化等内容。"
tags: []
---

## 量化

_量化会降低模型权重和激活值的精度，从而使模型体积更小、运行速度更快，且计算成本更低。本文件涵盖了数值格式、训练后的量化处理、考虑量化的训练方法、仅针对权重进行量化的方法（如GPTQ、AWQ）、激活值量化、混合精度以及KV缓存量化等内容。_

- 一个拥有700亿参数的模型，若以float16格式存储，则需要140GB的内存，这超过了任何单块GPU的容量。若将其量化为INT4格式，那么只需35GB内存即可存储该模型（使用A100显卡），或者通过数据卸载技术，甚至只需20GB内存（使用消费级RTX 4090显卡）。量化并非一种微不足道的优化手段，它才是让大型模型得以实际应用的关键。

- 量化过程中存在一个根本性的权衡：较低的精度意味着更少的内存需求、更高的处理速度以及更低的能耗，但同时也会引入**量化误差**，进而降低模型质量。量化技术的核心就在于尽可能减少这种质量下降。

## 为何要量化

- **减少内存占用**：INT8格式的数值大小是FP16的一半，而INT4格式则更是FP16的1/4。对于大型语言模型而言，模型权重占据了大部分内存空间。将精度降低一半，就能使所需内存减少一半。

- **提升处理速度**：较低的精度意味着每秒可以执行更多的操作。NVIDIA的Tensor Core技术使得FP16格式下的处理速度是FP32格式的两倍，INT8格式下的处理速度又是FP16格式的两倍，而INT4格式下的处理速度则是INT8格式的两倍。H100显卡在FP8格式下可实现989 TFLOPS的计算性能，而在FP32格式下仅为67 TFLOPS——两者之间存在15倍的性能差异。

- **节省带宽**：大型语言模型的推理过程通常会受到**内存带宽限制**的影响（详见第16章的roofline模型）。真正的瓶颈在于从GPU内存中读取权重数据，而非对数据进行计算。较小的权重意味着需要传输的数据量更少，从而直接提升了每秒的处理量。正因如此，量化往往能带来近乎线性的推理速度提升。

- **节约能源**：较低的精度意味着每次操作所需的能量更少。在数据中心规模下（数千块GPU），这将带来显著的电力成本降低。

## 数值格式

- 我们在第13章（计算机架构）中已经介绍了IEEE 754浮点数格式。以下是机器学习领域中各种数值格式的详细信息：

![精度格式的位布局图：从FP32到三进制格式，展示了符号位、指数位和尾数位在内存中的排列方式，同时还给出了每种格式下每个参数所需的内存大小](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/precision_formats_memory.svg)

| 格式 | 位数 | 指数位 | 尾数位 | 数值范围 | 应用场景 |
| ------ || ------ || -------- || -------- || --------- || ---------- ||
| FP32 | 32 | 8 | 23 | ±3.4×10³⁸ | 训练阶段（标准格式） |
| TF32 | 19 | 8 | 10 | ±3.4×10³⁸ | 使用Tensor Core的训练场景（A100及以上显卡） |
| FP16 | 16 | 5 | 10 | ±65504 | 混合精度训练 |
| BF16 | 16 | 8 | 7 | ±3.4×10³⁸ | 训练阶段（数值范围与FP32相同） |
| FP8 E4M3 | 8 | 4 | 3 | ±448 | 前向传播阶段（Hopper及以上芯片） |
| FP8 E5M2 | 8 | 5 | 2 | ±57344 | 梯度计算阶段（数值范围更广） |
| INT8 | 8 | — | — | -128至127 | PTQ推理阶段 |
| INT4 | 4 | — | — | -8至7 | 仅针对权重进行量化的格式 |
| INT2/三进制 | 2 | — | — | `{-1, 0, 1}` | 极端压缩格式 |

- **FP8**格式有两种变体：**E4M3**格式，其指数位为4位，尾数位为3位，数值范围较窄但精度较高，适用于前向传播阶段；而**E5M2**格式的指数位为5位，尾数位为2位，数值范围更广但精度较低，适用于梯度计算阶段。Transformer Engine（详见第16章）会根据不同张量的需求自动在这两种格式之间切换。

- **BF16与FP16的比较**：BF16的指数位范围与FP32相同，因此不存在溢出风险，但其尾数位的精度较低。FP16的精度更高，但数值范围较窄（最大值为65504），因此在训练过程中需要调整损失值。在推理阶段，这两种格式的表现都不错；而在训练阶段，BF16更为可靠。

- **整数格式**没有指数位，它们表示的是定点数值。要将浮点数转换为整数，需要使用**缩放因子**，有时还需要**零点**作为参考：$x_{\text{float}} = \text{scale} \times (x_{\text{int}} - \text{zero\_point})$。

## 量化公式

- 所有的量化方法都是将浮点数值转换为整数，然后再将整数转换回浮点数值：

$$x_q = \text{clamp}\left(\text{round}\left(\frac{x}{\text{scale}}\right) + \text{zero\_point}, \; q_{\min}, \; q_{\max}\right)$$

$$\hat{x} = \text{scale} \times (x_q - \text{zero\_point})$$

- **缩放因子**决定了数值的分辨率：$\text{scale} = \frac{x_{\max} - x_{\min}}{q_{\max} - q_{\min}}$。对于INT8格式来说，$q_{\min} = -128$，$q_{\max} = 127$。

- **对称量化**将**零点**设置为0，此时$\text{scale} = \frac{\max(|x|)}{127}$。这种方法的实现更为简单，速度也更快（在推理阶段无需进行零点减法操作）。

- **非对称量化**则使用非零的**零点**，以便处理非对称的数值分布情况（例如ReLU函数的输出均为非负值）。这种格式会将$[x_{\min}, x_{\max}]$范围映射到无符号INT8格式的$[0, 255]$范围内。

![量化粒度：对于整个矩阵，每个张量使用一个缩放因子；对于每列，每个通道使用一个缩放因子；对于每个小块，每组元素使用一个缩放因子](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/quantisation_granularity.svg)

- **量化粒度**指的是有多少个数值共享同一个缩放因子：
- **按整个张量处理**：整个张量使用同一个缩放因子。这种方法最简单，但精度最低——因为只要有一个异常值，就会影响整个张量的缩放比例。
- **按通道处理**：对于卷积层，每个输出通道使用一个缩放因子；对于线性层，则每行使用一个缩放因子。这种方法的精度更高，且带来的开销相对较小。
- **按组处理**：每组包含$g$个元素时，使用一个缩放因子（例如$g = 128$）。这是精度最高的量化方式，被广泛应用于现代的仅针对权重进行量化的方法中，如GPTQ和AWQ。
- **按Token处理**：对于每个激活值，都使用一个独立的缩放因子。这种方法能够考虑到不同Token的激活值幅度可能存在很大差异。

## 训练后的量化（PTQ）

- **PTQ**是一种无需重新训练即可对预训练模型进行量化的方法。首先，需要使用一个**校准集**（即一个包含少量样本的代表性数据集，通常为128-512个样本）让模型进行处理，从而获取激活值的统计信息，进而确定最优的缩放因子。

### 校准方法

- **最小-最大法**：根据观察到的最小值和最大值来确定缩放因子。这种方法简单易行，但对异常值较为敏感——因为极端的数值会占用大部分量化范围，导致那些很少被使用的数值无法得到合理的量化处理。
- **百分位数法**：使用第99.99百分位数而非绝对最大值。该方法会截断极端的异常值，从而为大多数数值提供更好的分辨率。被截断后的数值会变为$q_{\min}$或$q_{\max}$的值。

- **最小均方误差法**：寻找能够使原始张量与量化后张量之间的均方误差最小的量化尺度。这是一种一维优化过程（在可能的截断值中进行搜索），通常能获得最佳的PTQ精度。

- **基于熵的方法**（KL散度）：寻找能够使原始数据分布与量化后数据分布之间的KL散度最小的量化尺度。该方法被用于TensorRT的INT8量化流程中。

### 实际应用中的PTQ

```python
# Simplified PTQ with PyTorch (conceptual)
import torch

def quantise_tensor_symmetric(tensor, bits=8):
    qmax = 2 ** (bits - 1) - 1  # 127 for INT8
    scale = tensor.abs().max() / qmax
    quantised = torch.clamp(torch.round(tensor / scale), -qmax, qmax).to(torch.int8)
    return quantised, scale

def dequantise(quantised, scale):
    return quantised.float() * scale

# Quantise a weight matrix
weight = torch.randn(512, 512)  # pretrained weight
weight_q, scale = quantise_tensor_symmetric(weight, bits=8)
weight_reconstructed = dequantise(weight_q, scale)

# Quantisation error
error = (weight - weight_reconstructed).abs().mean()
print(f"Mean absolute error: {error:.6f}")
print(f"Compression: {weight.numel() * 4 / (weight_q.numel() * 1 + 4):.1f}x")  # +4 bytes for scale
```

- 对于大多数模型而言，PTQ在INT8精度下表现良好，精度损失不到1%。而对于INT4来说，PTQ的量化质量会显著下降——仅对权重进行量化的方法则能更好地处理INT4数据。

## 量化感知训练（QAT）

- **QAT**会在训练过程中插入虚拟的量化操作：在前向传播时，权重和激活值会被量化后再反量化，但梯度传递时则如同没有发生量化一样（即采用**直通估计器**）。

$$\text{前向传播：} \hat{W} = \text{dequant}(\text{quant}(W))$$
$$\text{反向传播：} \frac{\partial L}{\partial W} \approx \frac{\partial L}{\partial \hat{W}}$$

- 模型在训练过程中会学会抵御量化带来的噪声影响。QAT通常能够恢复大部分甚至全部因PTQ而损失的精度，尤其是在低比特宽度情况下（如INT4、INT2）。

- **成本**：QAT需要重新训练模型，这对于大型模型来说成本很高。对于一个拥有700亿个参数的模型，使用QAT可能需要1万到10万美元的计算成本。而PTQ几乎不需要任何成本（仅需进行校准即可）。

- **何时使用QAT**：当PTQ的量化质量不可接受时（通常是INT4或更低比特宽度），或者当模型需要部署在对延迟有严格要求的边缘设备上时，又或者当模型需要被量化数百万次时（此时一次性的QAT成本可以通过多次使用来分摊）。

## 仅对权重进行量化

- 在大语言模型推理过程中，瓶颈在于从内存中加载权重，而非对权重进行计算（属于受内存带宽限制的情况）。**仅对权重进行量化**的方法是将权重量化为INT4或INT3格式，而激活值则保持为FP16格式。计算仍在FP16模式下进行（在动态反量化权重之后），但这样可以将内存占用和带宽需求降低4到8倍。

### GPTQ

- **GPTQ**（Frantar等人，2022年提出）是一种逐列量化权重的方法，通过调整后续列的值来弥补每列量化带来的误差。该方法利用**海森矩阵**（来自校准集的二阶信息）来确定最优的量化顺序及误差补偿方式：

$$\hat{W}_{:,j} = \text{quant}(W_{:,j}), \quad W_{:,j+1:} \mathrel{-}= \frac{(\hat{W}_{:,j} - W_{:,j}) \cdot H_{j,j+1:}}{H_{j,j}}$$

- 其核心思想是：量化第$j$列会引入误差，GPTQ会立即通过调整其余列的值，使得该层的整体输出变化尽可能小。这实际上就是应用于Transformer架构的**最优权重量化**方法。

- 使用4位分组量化方式的GPTQ（每组包含128个权重），在大多数大语言模型上，其精度损失可控制在1%以内。对于一个700亿参数的模型，在单个GPU上完成量化大约需要1小时时间。

### AWQ

- **AWQ**（激活值感知的权重量化，Lin等人，2023年提出）发现，有一小部分权重通道（1-3%）比其他通道更为重要——这些通道对应的激活值幅度较大。保护这些关键通道可以显著降低量化误差。

- AWQ在量化之前会将这些重要通道的数值放大$s$倍（从而使其数值更大，减少四舍五入带来的影响），同时将对应的激活值缩小为$1/s$倍（以保持输出结果不变）。这个放大系数$s$会根据每个通道组的特点进行优化，以最小化整体量化误差。

- 相比于GPTQ，AWQ更简单（无需计算海森矩阵），运行速度更快，且量化质量相当。它现已成为许多开源大语言模型量化工具的默认选择。

### GGUF / llama.cpp量化

- **GGUF**（GGML通用格式）是llama.cpp用于CPU端推理的格式。它支持多种量化方案：
- **Q4_0**：4位格式，每32个元素为一个块，采用对称量化。
- **Q4_K_M**：4位格式，对重要的通道采用混合精度量化。
- **Q5_K_M**：5位格式，同样采用k-量化方式，量化质量更高。
- **Q8_0**：8位格式，简单且快速。

- “K”系列量化方式会为重要的权重块分配更多比特数，这一思路与AWQ类似，但是在格式层面实现的。对于大多数模型而言，Q4_K_M是最佳选择：平均为4位精度，且精度损失最小。

### QuIP与QuIP♯

- **QuIP**（Chee等人，2023年提出）引入了**非相干处理**机制：在量化之前，通过随机正交变换来旋转权重矩阵。这样可以将信息分散到所有权重中，避免少数异常权重主导量化误差。

- 其基本原理是：如果某个权重值为100，而其他权重值都约为1，那么用相同的量化尺度对所有权重进行量化的话，大部分INT4量化范围都会被用于处理那个异常值。经过正交变换后（该变换不会改变矩阵的数学性质），所有权重的数值都会趋于相近，此时统一量化就能取得更好的效果。

- **QuIP#**则在QuIP的基础上进一步改进，采用了**格点编码表**：不再将权重映射到均匀的整数网格上，而是映射到最优格点上（例如8维空间中的E8格点）。这种格点编码方式能在相同的比特数下容纳更多的量化点，从而实现比统一量化更好的速率-失真平衡。QuIP#即使在**2位**精度下也能获得可用的模型质量——这一精度仅为传统INT4量化方法的一半。

### SpQR

- **SpQR**（Dettmers等人，2023年提出）发现，只有一小部分权重（0.1-1%）属于**异常值**，却会对模型输出质量产生巨大影响。与其对所有权重都使用相同的量化精度，SpQR采取了以下策略：

1. 通过敏感性分析识别出那些异常权重（量化该权重会如何改变层的输出？）。
2. 以**全精度**（FP16格式）将这些异常权重以稀疏形式存储起来。
3. 将其余所有权重量化为INT3或INT4格式。

- 这样做的好处是：约99%的权重会被高度量化（即量化精度较低），而那1%的关键权重则能保持全精度（精度较高）。稀疏存储异常权重的方式几乎不会增加额外开销（总大小的增加幅度不到5%）。

### HQQ

- **HQQ**（半二次量化，Badri和Shaji，2023年提出）是一种**零样本**权重量化方法，完全不需要任何校准数据。它将量化问题转化为半二次优化问题，通过迭代方式求解最优的量化权重和缩放因子。
- 其优势在于：无需校准数据集，因此没有数据依赖性，可实现即时量化，且不存在校准数据不匹配的风险。对于那些缺乏合适的校准数据或对校准数据极为敏感的模型来说，HQQ尤其有用。

### AQLM

- **AQLM**（Egiazarian等人，2024年）将**加法量化**（多码本向量量化）技术应用于大型语言模型。该技术并非单独量化每个权重，而是将权重分组为向量，再将每个向量表示为多个学习得到的码本中对应元素的之和：

$$\mathbf{w} \approx \mathbf{c}_1^{(1)} + \mathbf{c}_2^{(2)} + \cdots + \mathbf{c}_M^{(M)}$$

其中$\mathbf{c}_i^{(m)}$是码本$m$中的某个元素。若使用2个码本，每个码本包含256个元素，那么一个包含8个元素的向量就可以通过两个8位索引来表示，即2字节，相当于每个权重仅需2比特即可表示。在2比特的精度下，AQLM仍能实现出色的性能，其效果优于GPTQ和AWQ这类在极端压缩条件下的量化方法。

### BitNet与1比特大型语言模型

- **BitNet**（Wang等人，2023年）将量化技术推向了极致：权重采用三进制形式（$\{-1, 0, +1\}$），这样每个权重仅需约1.58比特即可表示。矩阵乘法运算则简化为加法和减法操作，无需进行浮点数乘法。

- **BitNet b1.58**（Ma等人，2024年）要求所有权重都取值于$\{-1, 0, +1\}$。“1.58比特”这一数值来源于$\log_2(3) \approx 1.58$。在这种精度下，一个700亿参数的模型只需约15GB的存储空间，而且在进行推理时也无需进行乘法运算，只需进行加法、减法以及符号反转操作即可。

- 矩阵乘法运算可以表示为：

$$y_j = \sum_i W_{ij} \cdot x_i = \sum_{i: W_{ij}=+1} x_i - \sum_{i: W_{ij}=-1} x_i$$

与FP16格式相比，这种运算方式在任何硬件上都能大幅降低计算成本，甚至使得那些没有浮点运算单元的设备也能用于大型语言模型的推理。虽然当前模型在精度方面会有所牺牲，但随着模型规模的增大以及训练过程中对量化技术的更好利用，精度问题会逐渐得到改善。

### Microscaling（MX）格式

- **Microscaling**（MX）格式是一种新的行业标准（得到了AMD、Arm、Intel、Meta、Microsoft、NVIDIA、Qualcomm等公司的支持），它采用**块级浮点数**机制：一组元素共享同一个指数部分，而每个元素则拥有自己的尾数部分。

| 格式 | 共享的指数位数 | 每个元素的位数 | 每个元素的总位数 | 相当于哪种格式 |
| ------ || ---------------- || -------------- || ------------------ || ---------------- ||
| MXFP8 | 每块8位 | 8位（E4M3/E5M2格式） | 约8位 | 类似FP8，但精度更高 |
| MXFP6 | 每块8位 | 6位 | 约6.5位 | 介于FP8和INT4之间 |
| MXFP4 | 每块8位 | 4位 | 约4.5位 | 行为类似INT4，但具有浮点数特性 |
| MXINT8 | 每块8位 | 8位（整数形式） | 约8.5位 | 类似INT8，但具有共享的缩放机制 |

通过共享指数，可以在一个块内分摊指数部分的计算成本（通常一个块包含16到32个元素）。这样一来，每个元素所拥有的尾数位数就会比使用独立指数时更多，从而提升每比特的精度。预计在未来，MX格式将会取代传统的FP8和INT8格式。

### FP8格式下的训练

- 在NVIDIA Hopper和Blackwell架构的GPU上，现在已经可以实现FP8格式下的训练，而不仅仅是推理操作。具体的训练流程如下：

- **前向传播**：权重和激活值采用E4M3格式存储（精度较高，但数值范围较窄）。Transformer引擎会通过延迟缩放技术动态计算每个张量的缩放因子——即利用上一次迭代的统计信息来调整当前迭代的缩放值。

- **反向传播**：梯度值则采用E5M2格式存储（数值范围更广，精度较低）。由于梯度的数值范围比权重和激活值更大，因此额外的指数位有助于避免数值溢出。

- **主权重**：优化器状态相关的权重仍以FP32格式存储（这与第6章中介绍的采用FP16的混合精度训练方式类似）。FP8格式仅用于矩阵乘法运算，而不用于权重更新。

- **损失值缩放**：对于FP8格式而言，同样需要损失值缩放功能，就像FP16一样。动态损失值缩放器会调整缩放因子，以确保梯度值始终处于FP8所能表示的范围内。

- 使用FP8格式进行训练，对于大多数模型规模而言，其输出质量可与BF16格式相媲美，同时还能实现大约两倍的计算效率提升。在H100架构的集群上进行大规模训练时，FP8格式已成为默认选择。

## 激活值的量化

- 激活值（即层与层之间传递的中间张量）也可以被量化，这样就可以实现完全的INT8格式计算（权重和激活值均为INT8类型，累加操作则使用INT32类型）。

- **动态量化**：在运行时根据实际的激活值来计算缩放因子。这种方式更为精确，因为能够根据每个输入的特点进行调整，但也会带来一定的开销——需要在每一层中计算最小值、最大值或百分位数等信息。

- **静态量化**：在校准阶段一次性计算出所有的缩放因子，之后不再更改。这种方式在推理时的速度更快，因为无需在运行时再计算各种统计信息，但如果校准数据不能代表实际情况，那么量化后的精度就会下降。

- **按令牌量化**：为序列中的每个令牌分别计算对应的缩放因子。这对于大型语言模型来说非常重要，因为不同令牌产生的激活值幅度可能相差极大（有些令牌产生的激活值可能是其他令牌的100倍）。

- 激活值的量化比权重的量化更为困难，因为激活值会随着输入的不同而变化，而权重则是固定不变的。尤其是“异常值”问题十分突出：某些激活通道的数值可能远远超过平均值（可能是平均值的100倍），如果用与正常通道相同的缩放因子来量化这些通道，就会浪费精度。

- **SmoothQuant**（Xiao等人，2022年）通过数学手段解决了异常值问题，它将量化难度从原本难以量化的激活值转移到了相对容易量化的权重上：将激活值乘以$1/s$，将权重乘以$s$，其中$s$的值用于平衡量化难度。经过这样的处理后，输出结果$XW = (X \cdot \text{diag}(s^{-1})) \cdot (\text{diag}(s) \cdot W)$仍然保持不变。

## 混合精度量化

- 并非所有层对量化的敏感度都相同。注意力层通常可以容忍INT4格式，而嵌入层以及最终的分类层则需要更高的精度。

- **敏感性分析**：可以对每一层分别进行量化处理，然后测量其对模型精度的影响。那些对量化较为敏感的层会分配更多的比特位数，而那些不太敏感的层则分配较少的比特位数。
- Transformer Engine（NVIDIA Hopper的第16章）在操作层面实现了动态混合精度处理：每个矩阵乘法操作会根据张量的统计特性在FP8和FP16两种格式之间进行选择，从而在保证质量的同时提升处理效率。

## KV缓存量化

- 在LLM生成过程中，**KV缓存**会存储所有先前生成的令牌对应的键值张量。对于较长的序列来说，这部分数据会占用大量内存：

$$\text{KV缓存大小} = 2 \times n_{\text{layers}} \times n_{\text{heads}} \times d_{\text{head}} \times \text{seq\_len} \times \text{bytes\_per\_element}$$

- 对于一个拥有80层、64个注意力头、每个注意力头的维度为128的70B模型，当序列长度为128K时，使用FP16格式存储所需的内存量为：$2 \times 80 \times 64 \times 128 \times 131072 \times 2 = 330$ GB，这一数值已经超过了GPU的可用内存容量。

- **KV缓存量化**可以通过将缓存的键值数据以INT8或INT4格式而非FP16格式来存储，从而减少内存占用。虽然量化误差会随着序列的延伸而累积（每个新生成的令牌都需要参考所有缓存的键值数据），但通过针对每通道或每个注意力头进行量化处理，其带来的性能下降是可以接受的。

- **KV缓存量化具有显著的优化效果**：它能够支持更长的序列处理（从而获得更多上下文信息）、更大的批量大小（支持更多用户同时处理任务），还能提升推理速度（因为无需消耗太多内存带宽来加载缓存数据）。这是对LLM服务性能提升效果最显著的优化手段之一。

## 编码任务（可使用CoLab或笔记本完成）

1. 从零开始实现对称INT8量化功能。对某个权重矩阵进行量化处理，然后再将其反量化，最后根据数值分布情况来衡量重构误差。

```python
import jax.numpy as jnp
import jax

def quantise_int8(tensor):
    scale = jnp.max(jnp.abs(tensor)) / 127.0
    quantised = jnp.clip(jnp.round(tensor / scale), -127, 127).astype(jnp.int8)
    return quantised, scale

def dequantise(quantised, scale):
    return quantised.astype(jnp.float32) * scale

# Normal weights (typical for trained models)
key = jax.random.PRNGKey(0)
weights = jax.random.normal(key, (1024, 1024)) * 0.02

q, s = quantise_int8(weights)
recon = dequantise(q, s)

print(f"Original:     {weights.nbytes / 1024:.0f} KB")
print(f"Quantised:    {q.nbytes / 1024:.0f} KB ({weights.nbytes / q.nbytes:.0f}x smaller)")
print(f"Mean abs err: {jnp.abs(weights - recon).mean():.6f}")
print(f"Max abs err:  {jnp.abs(weights - recon).max():.6f}")
print(f"Relative err: {jnp.abs(weights - recon).mean() / jnp.abs(weights).mean():.4%}")
```

1. 演示异常值问题。创建包含若干极端值的通道，展示为何按张量进行量化会失败，而按通道进行量化则能够成功。

```python
import jax.numpy as jnp
import jax

key = jax.random.PRNGKey(42)

# Activations: most channels are normal, 2 channels have 100x outliers
activations = jax.random.normal(key, (32, 512)) * 0.1
activations = activations.at[:, 0].set(activations[:, 0] * 100)   # outlier channel
activations = activations.at[:, 1].set(activations[:, 1] * 50)    # outlier channel

# Per-tensor quantisation (one scale for entire tensor)
scale_tensor = jnp.max(jnp.abs(activations)) / 127.0
q_tensor = jnp.clip(jnp.round(activations / scale_tensor), -127, 127)
recon_tensor = q_tensor * scale_tensor

# Per-channel quantisation (one scale per channel)
scales_channel = jnp.max(jnp.abs(activations), axis=0) / 127.0
q_channel = jnp.clip(jnp.round(activations / scales_channel), -127, 127)
recon_channel = q_channel * scales_channel

err_tensor = jnp.abs(activations - recon_tensor).mean()
err_channel = jnp.abs(activations - recon_channel).mean()

print(f"Per-tensor error: {err_tensor:.6f}")
print(f"Per-channel error: {err_channel:.6f}")
print(f"Per-channel is {err_tensor / err_channel:.1f}x better")
print(f"\nOutlier channels waste {(activations.shape[1] - 2) / activations.shape[1]:.0%} "
      f"of the quantisation range for {2 / activations.shape[1]:.1%} of channels")
```

1. 计算不同模型规模和序列长度下的KV缓存内存需求。说明为何对于长上下文模型而言，KV缓存量化是不可或缺的。

```python
def kv_cache_gb(n_layers, n_heads, d_head, seq_len, bytes_per_elem):
    return 2 * n_layers * n_heads * d_head * seq_len * bytes_per_elem / 1e9

models = [
    ("Llama-7B",  32, 32, 128),
    ("Llama-70B", 80, 64, 128),
    ("GPT-4 (est)", 120, 96, 128),
]

print(f"{'Model':<15} {'SeqLen':>8} {'FP16 (GB)':>10} {'INT8 (GB)':>10} {'INT4 (GB)':>10}")
print("-" * 60)

for name, layers, heads, d_head in models:
    for seq_len in [4096, 32768, 131072]:
        fp16 = kv_cache_gb(layers, heads, d_head, seq_len, 2)
        int8 = kv_cache_gb(layers, heads, d_head, seq_len, 1)
        int4 = kv_cache_gb(layers, heads, d_head, seq_len, 0.5)
        print(f"{name:<15} {seq_len:>8} {fp16:>9.1f}  {int8:>9.1f}  {int4:>9.1f}")
    print()
```

## 高效架构

_提升模型速度并不仅意味着降低精度，还意味着采用更智能的架构，让每个令牌的处理成本更低。本文件涵盖了StreamingLLM、稀疏与线性注意力机制、多查询与分组查询注意力机制、推理时的专家混合技术、知识蒸馏、剪枝以及神经网络架构搜索等内容。_

- 量化处理（文件1）能够降低每项操作的计算成本；而本文件则旨在减少需要执行的操作数量。这两种方法互为补充：一个在架构上高效且经过量化的模型，其运行速度可比原始模型快10到100倍。

## StreamingLLM：无限长度序列生成

- 标准的Transformer会将所有历史令牌存储在KV缓存中，而该缓存的容量会随着序列长度的增加而呈线性增长。一旦缓存容量超过GPU的内存限制，序列生成就会失败。**StreamingLLM**（Xiao等人，2023年）通过使用固定大小的**滚动KV缓存**解决了这一问题。

- 一个重要的观察结果是：序列中的前几个令牌无论内容如何，都会获得极高的注意力分数。这些令牌被称为**注意力汇聚点**。如果将它们从缓存中移除，注意力的分配方式就会被打乱，序列生成的质量也会急剧下降。

- StreamingLLM的解决方案是：在缓存中永久保留少量**注意力汇聚点令牌**（即前1-4个令牌），同时再保留最近$w$个令牌构成的**滚动窗口**。因此，总缓存大小为$\text{sink} + w$，这一数值不会因生成的令牌数量而变化。

$$\text{缓存内容} = [\text{token}_0, \text{token}_1, \text{token}_{t-w+1}, \ldots, \text{token}_t]$$

- 这些注意力汇聚点有助于稳定softmax函数的输出分布，而滚动窗口则能提供最近的上下文信息。这样一来，即便序列长度无限，也能在保持内存占用恒定的前提下实现序列生成，不过代价是无法获取序列中间的上下文信息。

- 对于那些本身就存在注意力汇聚点的模型（大多数预训练的LLM都属于此类），无需重新训练即可使用StreamingLLM。而对于没有这类汇聚点的模型，则可以在训练过程中添加一个可学习的注意力汇聚点令牌，从而解决这个问题。

## 稀疏注意力机制

- 在序列长度为$n$的情况下，全自注意力机制的复杂度为$O(n^2)$，因为每个令牌都需要与其他所有令牌进行交互。当$n = 128K$时，注意力矩阵的元素数量将达到$128K^2 = 16$十亿个。**稀疏注意力机制**通过限制某些令牌之间才能发生交互，从而降低了计算复杂度。

![注意力稀疏性模式：全注意力机制的复杂度为O(n²)，滑动窗口注意力机制的复杂度为O(n·w)，局部+全局注意力机制则能处理长距离依赖关系](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/attention_sparsity_patterns.svg)

- **滑动窗口注意力机制**（Mistral、Gemma）：每个令牌仅与之前的$w$个令牌进行交互（例如$w = 4096$）。此时，注意力的计算复杂度为$O(n \cdot w)$，而非$O(n^2)$。信息可以通过多层结构传递到窗口之外；经过$L$层后，有效的上下文范围为$L \times w$。

- **局部+全局注意力机制**（Longformer、BigBird）：大多数令牌使用滑动窗口注意力机制来处理局部信息，而少数特定令牌（如[CLS]令牌，以及每隔512个令牌出现的令牌）则可以与所有令牌进行交互，从而捕捉长距离依赖关系。

- **扩张注意力机制**：只与窗口内的每第$k$个令牌进行交互，这样就能用相同的注意力分数覆盖更大的范围。在多层结构中逐步增加扩张比例，就可以形成类似扩张卷积的层次化结构（详见第8章）。

- 对于现代LLM而言，最实用的方案是**滑动窗口注意力机制与全注意力机制交替使用**：部分层采用滑动窗口注意力机制（计算成本低，适合处理局部上下文），另一部分层则采用全注意力机制（计算成本高，但能捕捉长距离依赖关系）。Mistral/Mixtral模型就采用了这种设计。

## 线性注意力机制与状态空间模型

- 我们能否完全取代复杂的$O(n^2)$级注意力机制呢？**线性注意力机制**和**状态空间模型（SSM）**通过避免显式计算注意力矩阵，能够在$O(n)$的时间复杂度内处理序列数据。

- **线性注意力机制**用核函数近似替代了softmax函数：

$$\text{标准方式： } O = \text{softmax}(QK^T / \sqrt{d}) V$$
$$\text{线性方式： } O = \phi(Q) (\phi(K)^T V)$$

- 通过先计算$K^T V$这一项（其规模为$d \times d$，与序列长度无关），计算复杂度便从$O(n^2 \cdot d)$降为$O(n \cdot d^2)$。对于那些序列长度远大于特征维度$n$的情况，这种优化带来的好处极为显著。

- **RWKV**模型结合了RNN和Transformer的优点。它采用递归结构按顺序处理令牌（类似RNN），但在训练阶段又可以实现并行处理（类似Transformer）。在推理时，每个令牌的处理时间均为$O(1)$，且内存占用恒定，无需扩展KV缓存。

- **Mamba**模型（Gu & Dao，2023年）是一种选择性状态空间模型。它通过学习到的状态转换规则来处理序列数据：

$$h_t = \bar{A} h_{t-1} + \bar{B} x_t, \quad y_t = C h_t$$

其中，$\bar{A}$和$\bar{B}$的值取决于输入数据，具有选择性，这使得Mamba能够动态地决定关注或忽略输入中的某些部分。与固定的状态空间模型不同，这种选择性使得Mamba在语言处理任务上能够与Transformer相媲美，同时仍保持$O(n)$级的计算效率。

- **权衡点**：线性注意力机制和状态空间模型在处理长序列时速度更快，但对于那些需要精确捕捉长距离依赖关系的任务来说，它们的性能通常不如全注意力机制。因此，采用混合架构——即结合部分Transformer层和部分Mamba层——往往能取得最佳效果。

## 多查询注意力机制与分组查询注意力机制

- 标准的多头注意力机制（MHA，详见第7章）为每个注意力头单独设置$K$和$V$投影参数。对于$h$个注意力头来说，这意味着KV缓存中需要存储$h$组独立的键值张量。**多查询注意力机制（MQA）**和**分组查询注意力机制（GQA）**则可以减少这种冗余。

- **MQA**机制（Shazeer，2019年）：所有注意力头共享同一组$K$和$V$投影参数，不过每个头部仍然有自己的$Q$投影参数。这样一来，KV缓存的容量就会减少$h$倍（例如，若有32个注意力头，缓存容量可减少32倍）。

- **GQA**机制（Ainslie等人，2023年）则是一种折中方案：将多个注意力头分组，每组共享一组$K$和$V$投影参数。例如，当有32个注意力头且分为8组时，每组包含4个头部，它们共享相同的$K$和$V$参数。这样，KV缓存的容量就能减少$h/g = 4$倍。

$$\text{MHA：} h \text{个头，} h \text{组K/V参数} \quad \rightarrow \quad \text{GQA：} h \text{个头，} g \text{组K/V参数} \quad \rightarrow \quad \text{MQA：} h \text{个头，} 1 \text{组K/V参数}$$

![MHA与GQA与MQA的对比：MHA为每个头分配独立的K/V参数，GQA在各个组之间共享K/V参数，而MQA则所有头共用同一组K/V参数——这大大降低了K/V缓存的大小](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mha_gqa_mqa.svg)

- 大多数现代大语言模型都采用GQA架构（如Llama 2/3、Gemma、Mistral）。与MHA相比，它能够减少K/V缓存占用及推理延迟，且质量损失可忽略不计。

### 多头潜在注意力机制（MLA）

- **MLA**（DeepSeek-V2，2024年提出）在GQA的基础上更进一步，它将K/V缓存压缩到**低秩潜在空间**中。MLA不会缓存完整的键值向量，而是为每个令牌存储一个压缩后的潜在向量$\mathbf{c}_t$，并在注意力计算时动态重建K/V向量：

$$\mathbf{c}_t = W_{\text{compress}} \cdot [\mathbf{k}_t; \mathbf{v}_t], \quad \mathbf{k}_t = W_K^{\text{up}} \cdot \mathbf{c}_t, \quad \mathbf{v}_t = W_V^{\text{up}} \cdot \mathbf{c}_t$$

- 压缩后的向量$\mathbf{c}_t$的体积远小于原始的K和V向量之和。DeepSeek-V2相比MHA，其K/V缓存大小可减少**93.3%**，性能甚至优于MQA，同时仍能保持与MHA相当的质量。

- 其代价是：从潜在向量中重建K/V向量会为每次注意力计算带来少量额外的计算开销。但由于大语言模型的解码过程主要受内存带宽限制而非计算能力限制，因此总体而言仍是优势：需要加载的内存更少，但每个令牌的处理成本略有上升。

### Flash Attention

- **Flash Attention**（Dao等人，2022年提出，详见第16章文件05）并非架构上的变革，而是一种实现优化手段，属于任何关于高效注意力机制的讨论内容。它通过以下方式实现精确的标准注意力计算：

- 仅需**O(n)**的内存，而非O(n²)（因为注意力矩阵无需存储在HBM中）；
- 由于采用分块处理及在线软阈值函数，其速度比标准注意力快**2-4倍**；
- **没有质量损失**——其输出在数学上与标准注意力完全一致。

- 目前，Flash Attention已是PyTorch（`torch.nn.functional.scaled_dot_product_attention`）、JAX以及所有主流推理框架中的默认注意力实现方式。如果在2024年或之后使用注意力机制，几乎可以肯定是在使用Flash Attention。

### 环形注意力机制

- **环形注意力机制**（Liu等人，2023年提出）用于处理那些长度过长、即便使用Flash Attention也无法容纳在单个GPU内存中的序列数据。该机制将序列分割到$N$个设备上，每个设备负责存储$n/N$个令牌的Q、K、V向量。这些设备以环形方式连接在一起。在每一步中：

1. 每个设备计算自身的局部注意力（即用自己的Q向量与本地的K/V向量进行计算）；
2. 每个设备将自己处理的K/V向量传递给环中的下一个设备；
3. 每个设备接收来自前一个设备的K/V向量，并用它们来计算注意力；
4. 经过$N$步后，每个设备都完成了对所有K/V向量的处理。

- 通信操作与计算操作是**同步进行的**：在当前K/V向量正在被处理的同时，下一个向量已经在传输途中。这样一来，通信带来的延迟几乎可以被完全消除。

- 通过将K/V缓存分布在多个GPU构成的环状结构中，环形注意力机制能够支持**百万级令牌的上下文窗口**。每个设备所需的内存仅为O(n/N)，因此理论上可以处理任意长的序列，唯一限制因素就是设备的数量。

## 推理时的专家混合机制

- MoE模型（见第7章）在处理每个令牌时，只会激活其中一部分参数（通常为8个专家中的2个）。在推理阶段，面临的独特挑战就是**专家缓存问题**：由于任何令牌都可能被分配给任意专家，因此所有专家都需要保留在内存中，但实际上每个令牌只会有2个专家处于活跃状态。

- 以Mixtral 8x7B模型为例：总参数量为470亿（8个70亿参数的专家模块，但这些模块之间存在共享组件）。每个令牌对应的活跃参数量约为130亿（2个活跃专家加上共享层）。该模型的质量可与LLM-70B级别相媲美，而推理成本则仅相当于LLM-13B级别，不过需要470亿参数的存储空间。

- **专家卸载策略**：对于那些受GPU内存限制的场景，可以将不活跃的专家模型保存在CPU或SSD上，按需再加载到GPU中。这种方法之所以可行，是因为令牌的分配模式具有足够的规律性，从而可以提前预加载可能被使用的专家模型。

- **专家缓存策略**：在GPU内存中维护一个最近使用过的专家模型的LRU缓存。如果某些专家模型会被反复激活（在特定领域的数据处理中很常见），那么缓存命中率就会很高。

## 知识蒸馏技术

- **知识蒸馏**（见第6章）是一种训练方法，通过让较小的“学生模型”模仿较大的“教师模型”来学习。学生模型是从教师模型输出的软预测结果（即各类别的概率分布）中学习的，而这些概率分布所包含的信息量要大于单纯的硬标签。

$$\mathcal{L} = \alpha \cdot \text{KL}(p_{\text{teacher}}^{T} \| p_{\text{student}}^{T}) + (1 - \alpha) \cdot \mathcal{L}_{\text{CE}}(y, p_{\text{student}})$$

其中，$T$表示温度参数（较高的$T$值会使概率分布更加平滑，从而体现教师模型的不确定性），而$\alpha$则用于平衡知识蒸馏带来的损失与传统的交叉熵损失。

- **在大型语言模型中的应用**：知识蒸馏可用于从功能强大的大型模型中创建出体积更小、运行速度更快的模型。例如，GPT-4可以通过知识蒸馏生成一个70亿参数的学生模型，该模型在特定任务上能够展现出与GPT-4相似的性能。此外，这类学生模型的部署成本可能仅为原模型的10-100分之一。

- **针对特定任务的蒸馏**：只需针对与具体应用任务相关的数据来进行知识蒸馏。例如，用一个70亿参数的教师模型对医疗领域的问答数据进行处理，然后从中提取知识来训练一个70亿参数的学生模型，那么这个学生模型在该特定任务上的表现可能会优于原来的70亿参数模型，因为学生模型的全部计算资源都集中在目标领域上。

## 权重剪枝技术

- **权重剪枝**是通过将不必要的权重设为零来减少模型的规模及计算量。

- **非结构化剪枝**（基于权重幅值）：即删除绝对值最小的那些权重。这样就能得到一个稀疏的权重矩阵。这种方法简单且高效，适合用于模型压缩。不过，目前的硬件（如GPU）无法高效地处理稀疏运算，除非权重矩阵的稀疏结构符合某种特定模式。
- **结构化剪枝**：移除整个单元——注意力头、MLP神经元或整层结构。这样就能得到规模更小的密集模型，便于在标准硬件上加速运行。但缺点是剪枝的粒度较粗（移除整个注意力头时，有用和无用的权重都会被一起删除）。

- **2:4稀疏性**（NVIDIA Ampere+架构）：这是一种由硬件支持的稀疏模式，即每4个权重中有2个为0。GPU的稀疏张量核心可以跳过这些零值的乘法运算，从而实现约2倍的性能提升。这是目前唯一具备实际硬件加速功能的稀疏模式。

- **“彩票假说”**（Frankle & Carlin，2019）：在随机初始化的网络中，存在某个子网络（即“中奖组合”），该子网络经过独立训练后能够达到与整个网络相同的性能水平。虽然找到这类子网络需要耗费大量资源（通过训练、剪枝等方式），但这一理论为剪枝研究提供了方向。

## 神经网络架构搜索（NAS）

- **NAS**通过遍历所有可能的架构，自动寻找在满足硬件约束（延迟、内存、功耗）的前提下能实现最高准确率的架构。

- **EfficientNet**（第8章）就是通过NAS找到的：其优化规则——深度、宽度与分辨率之间的平衡关系——是搜索过程得出的，而非基于人类直觉。

- 为了提升推理效率，NAS还能找到针对特定硬件而优化的架构：“找到一种在iPhone神经引擎上运行时延迟低于5毫秒、在ImageNet数据集上的准确率高于80%的模型。”搜索范围包括层类型、宽度、激活函数以及注意力机制等参数。

- **一次训练多用途网络**：通过一次训练生成一个过度参数化的网络，然后从中提取出适用于不同应用场景的子网络。这样一次训练就可以为云GPU、移动设备GPU以及CPU生成各自最优化的模型。

## 编码任务（可使用CoLab或笔记本完成）（续1）

1. 实现滑动窗口注意力机制，并比较其与全注意力机制在内存使用方面的差异。

```python
import jax
import jax.numpy as jnp

def full_attention(Q, K, V):
    """Standard O(n^2) attention."""
    scores = Q @ K.T / jnp.sqrt(Q.shape[-1])
    weights = jax.nn.softmax(scores, axis=-1)
    return weights @ V

def sliding_window_attention(Q, K, V, window_size=128):
    """Sliding window attention: each token attends to window_size previous tokens."""
    n = Q.shape[0]
    d = Q.shape[-1]
    output = jnp.zeros_like(Q)

    for i in range(n):
        start = max(0, i - window_size + 1)
        k_window = K[start:i+1]
        v_window = V[start:i+1]
        scores = Q[i] @ k_window.T / jnp.sqrt(d)
        weights = jax.nn.softmax(scores)
        output = output.at[i].set(weights @ v_window)

    return output

n, d = 512, 64
key = jax.random.PRNGKey(0)
Q = jax.random.normal(key, (n, d))
K = jax.random.normal(jax.random.PRNGKey(1), (n, d))
V = jax.random.normal(jax.random.PRNGKey(2), (n, d))

print(f"Full attention memory:    O(n^2) = {n*n} entries")
print(f"Window (w=128) memory:   O(n*w) = {n*128} entries")
print(f"Reduction: {n*n / (n*128):.1f}x")
```

1. 比较MHA、GQA和MQA的KV缓存大小。说明为何GQA是实际应用中的最佳选择。

```python
def kv_cache_size(n_heads, n_kv_heads, d_head, seq_len, bytes=2):
    """KV-cache size in MB."""
    return 2 * n_kv_heads * d_head * seq_len * bytes / 1e6

n_heads = 32
d_head = 128
seq_len = 32768

mha = kv_cache_size(n_heads, n_heads, d_head, seq_len)       # 32 KV heads
gqa = kv_cache_size(n_heads, 8, d_head, seq_len)              # 8 KV heads
mqa = kv_cache_size(n_heads, 1, d_head, seq_len)              # 1 KV head

print(f"MHA (32 KV heads): {mha:.0f} MB per layer")
print(f"GQA (8 KV heads):  {gqa:.0f} MB per layer ({mha/gqa:.0f}x smaller)")
print(f"MQA (1 KV head):   {mqa:.0f} MB per layer ({mha/mqa:.0f}x smaller)")
```

1. 通过从随机注意力层中移除最不重要的注意力头，并测量输出的变化，来模拟结构化剪枝过程。

```python
import jax
import jax.numpy as jnp

key = jax.random.PRNGKey(0)
n_heads, seq_len, d_head = 8, 64, 32

# Random multi-head attention output (one per head)
head_outputs = jax.random.normal(key, (n_heads, seq_len, d_head))

# Full output: concatenate all heads
full_output = head_outputs.reshape(seq_len, n_heads * d_head)

# Importance: measure each head's contribution by its norm
head_norms = jnp.linalg.norm(head_outputs, axis=(1, 2))
print("Head importance (by norm):", jnp.round(head_norms, 2))

# Prune least important heads
for n_keep in [8, 6, 4, 2]:
    top_heads = jnp.argsort(head_norms)[-n_keep:]
    pruned = head_outputs[top_heads].reshape(seq_len, n_keep * d_head)

    # Pad to original size for comparison (zero out pruned heads)
    full_pruned = jnp.zeros_like(head_outputs)
    full_pruned = full_pruned.at[top_heads].set(head_outputs[top_heads])
    full_pruned = full_pruned.reshape(seq_len, n_heads * d_head)

    error = jnp.linalg.norm(full_output - full_pruned) / jnp.linalg.norm(full_output)
    print(f"Keep {n_keep}/{n_heads} heads: relative error = {error:.4f}, "
          f"memory = {n_keep/n_heads:.0%}")
```

## 服务与批处理

_向数千名并发用户提供服务大型语言模型时，仅仅加载模型并运行推理是不够的。本文涵盖了预填充-解码拆分、连续批处理、PagedAttention和vLLM、调度策略、分离式服务、多模型及LoRA服务，以及重要的性能指标。_

- 单个大型语言模型推理请求很简单：输入令牌，生成输出令牌。但要在低延迟和高吞吐量的条件下为1万名并发用户提供服务，则是一个系统级难题。采用简单的方法（一次处理一个请求）会浪费90%以上的GPU算力。而通过智能批处理和调度，无需增加硬件即可将吞吐量提升10到50倍。

## 预填充与解码：两个截然不同的阶段

- 大型语言模型推理包含两个具有根本不同计算特性的阶段：

- **预填充**（提示词处理）：同时处理所有输入令牌。这相当于一次大规模矩阵乘法：$O(\text{提示词长度} \times d_{\text{模型}}^2)$。由于所有令牌已知，因此可以并行处理。预填充属于**计算密集型**：GPU的算术逻辑单元成为瓶颈。

- **解码**（令牌生成）：逐个令牌地自回归生成。每个新令牌都需要通过KV缓存来参考之前的所有令牌。解码属于**内存带宽密集型**：GPU大部分时间都在从内存中加载模型权重和KV缓存，而非进行计算。每一步解码仅生成一个令牌，却需要加载整个模型（70B参数的模型在FP16格式下约占140GB）。

- 具体影响如下：

|            | 预填充                       | 解码                             |
| ---------- | ---------------------------- | -------------------------------- |
| 处理的令牌 | 一次性并行处理               | 逐个顺序处理                     |
| 瓶颈       | 计算能力（FLOPS）            | 内存带宽                         |
| 算术强度   | 高                           | 极低                             |
| GPU利用率  | 高（50-80%）                 | 不批处理时低至1-10%              |
| 延迟指标   | **首个令牌生成时间（TTFT）** | **每个输出令牌生成时间（TPOT）** |

- TTFT对用户体验至关重要（响应开始流式传输所需的时间）。TPOT决定了感知到的生成速度。用户能容忍较高的TTFT（1-5秒），但期望较快的TPOT（对话应用中每个令牌30-100毫秒）。

## 静态批处理（简单方式）

- 最简单的批处理方式：收集$B$个请求，将它们填充到相同长度，然后作为一个批次处理。

- **问题1**：不同请求的提示词长度不同，生成的输出令牌数量也不同。短请求提前完成，但必须等待批次中最长的请求结束后才能开始下一个批次。在此期间，GPU会因处理剩余的长请求而处于空闲状态。

- **问题2**：填充操作浪费了计算资源。如果最长提示词为2000令牌，最短仅为50令牌，那么批次会被填充到2000令牌。对于短请求而言，GPU需处理1950个填充令牌——纯属浪费。

![静态批处理在等待最长请求时会浪费GPU资源；连续批处理则会立即利用释放出的资源](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/static_vs_continuous_batching.svg)

## 连续批处理

- **连续批处理**（也称迭代级批处理）以单个解码步骤而非整个请求为单位进行操作，从而解决了上述问题。

- 在每个解码步骤中：

1. 所有正在处理的请求并行生成一个令牌（作为一个批次）。
2. 已完成请求（生成EOS令牌）会立即从批次中移除。
3. 队列中的新请求会立刻插入到释放出的位置中。

- 批次大小在每一步都会动态变化。GPU无需等待缓慢的请求，也不会出现填充浪费现象（每个请求仅占用其实际需要的资源）。

- **效果**：与静态批处理相比，连续批处理通常能将吞吐量提升2到10倍，且不会影响模型质量或显著增加延迟。

## PagedAttention与vLLM

- KV缓存给内存管理带来了巨大挑战。每个请求产生的KV缓存会随着生成的令牌增加而增长。不同请求所处的阶段不同（缓存大小各异）。为每个请求分配连续的内存会浪费空间（即使请求仅生成少量令牌，也需按最大可能长度分配内存）。

![PagedAttention将虚拟KV缓存页映射到非连续的物理GPU内存中，消除了碎片并实现了按需分配](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/paged_attention.svg)

- **PagedAttention**（Kwon等人，2023年）借鉴了操作系统中虚拟内存的概念（第13章）来处理KV缓存。缓存被划分为固定大小的**页面**（令牌位置块）。页面按需分配，且在物理GPU内存中可以不连续。

- 其优势包括：
- **无内存碎片**：页面尺寸统一，因此请求之间不会存在浪费的内存“空洞”。
- **惰性分配**：仅在实际生成令牌时才分配内存，无需预先为最大长度分配空间。
- **写时复制**：共享相同前缀的请求（如系统提示词）会共用同一份KV缓存页面；只有当请求路径分叉时才会复制页面。

- **vLLM**是基于PagedAttention构建的推理引擎。它通过几乎消除KV缓存的内存浪费，使吞吐量比静态分配的服务方式（如未采用PagedAttention的HuggingFace文本生成推理服务）高出2到4倍。

## 调度策略

- 当有多个请求等待处理且GPU只能处理有限批次时，**调度**便决定了优先服务哪些请求：

- **先到先服务（FCFS）**：按请求到达顺序处理。虽然简单，但不够公平：提交10K令牌生成任务的用户会阻塞其后的所有用户。

- **最短作业优先（SJF）**：优先处理最快能完成的请求。该策略能最小化平均延迟，但会损害长时间运行的请求（它们可能被饿死）。实际上，预估输出长度难以确定，因此SJF依赖启发式方法（如提示词长度、用户历史记录）。
- **抢占机制**：如果高优先级请求到达，会暂停正在处理的低优先级请求（将其KV缓存交换到CPU内存或SSD中），先处理高优先级请求，然后再恢复被暂停的请求。vLLM支持此功能。

- **基于优先级的调度**：为用户或请求类型分配优先级。实时交互式查询的优先级高于批量处理任务。结合抢占机制，可确保高优先级流量的延迟符合服务等级目标。

- **令牌预算限制**：限制活跃批次中的令牌总数。这能防止少数长请求占用过多GPU内存，从而导致新请求无法得到及时处理。

## 分离式服务架构

- 预填充和解码阶段的计算特性截然不同。在同一GPU上同时运行这两类任务时，GPU会在计算受限（预填充）和内存带宽受限（解码）之间切换，无法充分利用任一资源。

- **分离式服务架构**将两者分开：
- **预填充节点**：采用专为计算优化的GPU（高FLOPS，内存可能较少），负责处理所有传入的提示词。
- **解码节点**：采用专为内存带宽优化的GPU（具备较大的KV缓存容量和高内存带宽），负责生成所有令牌。

- 预填充节点计算出初始KV缓存后，通过NVLink或网络将其发送给解码节点；解码节点利用接收到的缓存来生成令牌。

- 这就是**Mooncake**（Moonshot AI）所采用的架构，目前也有多家大语言模型服务团队正在探索这一方案。其优势在于：每种GPU都能匹配相应的工作负载特性，从而提高整体利用率。

## 多模型与LoRA服务

- 在生产环境中，通常需要同时提供多个模型（针对不同层级使用不同规模的模型，或针对不同任务使用不同的微调变体）。

- **模型复用**：在同一GPU上加载多个模型，并将请求路由到合适的模型。GPU内存是共享的：一块40 GB的GPU可以同时容纳一个13B模型（26 GB）和一个7B模型（14 GB）。

- **LoRA服务**：无需部署单独的微调模型，只需部署一个基础模型并搭配多个**LoRA适配器**（详见第6章）。每个适配器增加的参数量不到1%。推理时，请求会被路由到对应的适配器。

- **S-LoRA**（Sheng等人，2023年）：从单个基础模型中为数千个LoRA适配器提供服务。适配器存储在CPU中，按需分页载入GPU内存。基础模型的KV缓存和权重是共享的；只有每个请求所对应的小型LoRA矩阵有所不同。

- **Punica**（Chen等人，2023年）：通过自定义CUDA内核，在同一批次中为不同LoRA适配器的请求应用不同的LoRA矩阵，从而避免为每个请求切换适配器的开销。

## 受限生成与引导生成

- 许多应用场景要求大语言模型输出特定格式的内容：有效的JSON、SQL查询、特定语言的代码，或符合某种模式的响应。**受限生成**能确保输出符合既定的语法或模式要求。

- **语法受限解码**：在每一步解码过程中，屏蔽那些违反语法的令牌。如果当前输出为`{"name": "Alice", "age":`，而语法要求下一个令牌为整数，则只保留数字令牌。大语言模型的概率分布会在有效令牌范围内重新归一化。

- **Outlines**（Willard & Louf，2023年）：将JSON模式或正则表达式编译成有限状态机（FSM）。在每一步解码时，FSM会确定哪些令牌是合法的延续。非法令牌的概率为0。这种方式能保证100%符合模式要求，且无需重试。

- **SGLang**原生支持受限生成：用户可在Python中指定输出结构，引擎会高效地处理令牌屏蔽与缓存工作。该功能还与RadixAttention（前缀缓存）相结合，使得结构化输出能够复用已缓存的前缀。

- **为何重要**：若无受限生成机制，系统会自由生成内容后再进行解析，失败时还需重试。对于复杂的JSON模式，重试率常常达到10–30%，造成计算资源的浪费。受限生成则完全消除了重试现象。

## 请求路由

- 并非所有查询都需要使用最大的模型。**请求路由**会根据预估的复杂度将查询导向不同的模型：

- **级联路由**：先尝试使用小型模型。若小型模型的置信度低于阈值（例如，最高概率令牌的softmax值<0.8），则转交大型模型处理。简单的查询（占流量的80%以上）可由小型模型低成本处理；只有复杂查询才会动用昂贵的大型模型。

- **智能路由**：训练一个轻量级分类器（或利用小型模型的困惑度）来预测查询所需的模型层级。例如，将“2+2等于多少？”路由给3B模型，而将“解释量子纠缠的数学基础”路由给70B模型。

- **影响**：如果80%的查询可由成本仅为十分之一的模型处理，那么每条查询的平均成本可降低约70%。这是多模型部署中效果最显著的成本优化手段之一。

- **设备端+云端混合路由**：**Cactus**（[github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus)）在设备层面实现请求路由。它通过定制的ARM SIMD内核在设备端（手机、笔记本电脑、可穿戴设备）运行小型模型，当本地模型置信度较低或查询超出设备能力时，会自动路由至云端模型。应用程序对两种路径均使用兼容OpenAI的API——路由过程对使用者而言是透明的。这是一种基础设施层面的级联路由：第一层免费（设备端），第二层收费（云端API）。对于大多数查询较为简单的应用场景（如助手问答、自动补全、语音转录），设备端可处理70–90%的流量，且边际成本为零。

## 推理指标

- 合适的指标取决于具体的应用场景：

| 指标 | 衡量内容 | 对话式目标 | 批处理目标 |
| -------- || ----------------- || ------------------------ || ----------------- ||
| **TTFT** | 首个令牌生成时间 | <1秒 | 重要性较低 |
| **TPOT** | 每个输出令牌生成时间 | <100毫秒 | 重要性较低 |
| **吞吐量** | 每秒令牌数（总计） | 重要性较低 | 最大化 |
| **p99延迟** | 最慢的1%请求延迟 | <5秒 | <30秒 |
| **每令牌成本** | 每百万令牌的费用 | 最小化 | 最小化 |
| **SLO达标率** | 满足延迟目标的请求占比 | >99% | >95% |

- **TTFT与TPOT之间的权衡**：激进的批处理能提升吞吐量（更高的每秒令牌总数），但会增大TPOT（由于GPU需处理更多请求，导致每个令牌生成时间变长）。调度策略必须在吞吐量（收入）与延迟（用户体验）之间取得平衡。

- **每令牌成本是生产环境中的终极指标**。它综合了硬件成本（GPU租赁费）、吞吐量（每秒令牌数）以及利用率。GPU利用率仅为50%的系统，其每令牌成本会比利用率达100%的系统高出两倍。正因如此，批处理、调度以及PagedAttention才显得至关重要——它们能够提升利用率。

## 编码任务（使用CoLab或笔记本）

1. 模拟连续批处理与静态批处理，并测量两者在吞吐量上的差异。

```python
import random
import time

def simulate_static_batching(requests, batch_size=8):
    """Process requests in fixed batches. Wait for all to finish."""
    total_tokens = 0
    total_time = 0

    for i in range(0, len(requests), batch_size):
        batch = requests[i:i + batch_size]
        max_len = max(r['output_len'] for r in batch)
        # All requests in the batch take as long as the longest
        batch_time = max_len * 0.01  # 10ms per token
        total_time += batch_time
        total_tokens += sum(r['output_len'] for r in batch)

    return total_tokens / total_time  # tokens per second

def simulate_continuous_batching(requests, max_batch=8):
    """Process with continuous batching. Remove finished, add new."""
    total_tokens = 0
    total_time = 0
    active = []
    queue = list(requests)

    while active or queue:
        # Fill batch
        while len(active) < max_batch and queue:
            active.append({'remaining': queue.pop(0)['output_len']})

        if not active:
            break

        # One decode step: all active requests generate 1 token
        for req in active:
            req['remaining'] -= 1
        total_tokens += len(active)
        total_time += 0.01  # 10ms per step

        # Remove finished requests
        active = [r for r in active if r['remaining'] > 0]

    return total_tokens / total_time

# Generate requests with varied output lengths
random.seed(42)
requests = [{'output_len': random.randint(10, 500)} for _ in range(100)]

static_tps = simulate_static_batching(requests)
continuous_tps = simulate_continuous_batching(requests)

print(f"Static batching:     {static_tps:.0f} tokens/s")
print(f"Continuous batching: {continuous_tps:.0f} tokens/s")
print(f"Speedup: {continuous_tps / static_tps:.1f}x")
```

1. 计算PagedAttention带来的KV缓存内存节省量。比较预分配情况（最坏情况）与分页使用情况（实际占用）。

```python
def paged_vs_preallocated(n_requests, max_seq_len, avg_seq_len, page_size, kv_per_token_bytes):
    """Compare memory usage: preallocated vs paged KV-cache."""
    # Preallocated: every request gets max_seq_len slots
    preallocated_gb = n_requests * max_seq_len * kv_per_token_bytes / 1e9

    # Paged: allocate only what is used (with page granularity)
    import math
    avg_pages = math.ceil(avg_seq_len / page_size)
    paged_gb = n_requests * avg_pages * page_size * kv_per_token_bytes / 1e9

    waste_preallocated = (max_seq_len - avg_seq_len) / max_seq_len
    waste_paged = (avg_pages * page_size - avg_seq_len) / (avg_pages * page_size)

    print(f"Requests: {n_requests}, Max seq: {max_seq_len}, Avg seq: {avg_seq_len}")
    print(f"  Preallocated: {preallocated_gb:.1f} GB (waste: {waste_preallocated:.0%})")
    print(f"  Paged:        {paged_gb:.1f} GB (waste: {waste_paged:.0%})")
    print(f"  Savings:      {preallocated_gb - paged_gb:.1f} GB ({preallocated_gb/paged_gb:.1f}x)")
    print()

# Llama-70B: ~1.3 KB per token per layer, 80 layers = ~100 KB per token total
kv_bytes = 100_000

# Scenario 1: short requests, large max
paged_vs_preallocated(256, max_seq_len=4096, avg_seq_len=256, page_size=16, kv_per_token_bytes=kv_bytes)

# Scenario 2: varied lengths
paged_vs_preallocated(256, max_seq_len=8192, avg_seq_len=1024, page_size=16, kv_per_token_bytes=kv_bytes)

# Scenario 3: long context
paged_vs_preallocated(64, max_seq_len=131072, avg_seq_len=16000, page_size=16, kv_per_token_bytes=kv_bytes)
```

## 边缘推理

_边缘推理是在用户设备上运行模型（手机、笔记本电脑、物联网传感器），无需将数据发送到云端。本文件涵盖了边缘设备的限制条件、模型压缩流程、设备端运行环境、编译器技术、硬件平台（NPU、神经网络引擎）、设备端大语言模型、联邦学习以及延迟优化等内容。_

- 云端推理需要网络连接，会带来50-200毫秒的延迟，每次请求都需要支付费用，而且还会将用户数据传输到第三方服务器。而**边缘推理**则解决了这四个问题：模型在本地运行，响应速度极快，每次推理无需付费，同时还能保障数据隐私。

- 不过，边缘设备的计算能力和内存容量相比数据中心中的GPU要低100到1000倍。因此，要让模型在这些受限条件下正常运行，就需要在各个层面进行深度优化。

- **Cactus**（[github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus)）是一款专为移动设备和可穿戴设备设计的低延迟人工智能引擎。它在实际应用中运用了本文件中介绍的许多技术：用于注意力计算和矩阵运算的定制化ARM SIMD内核（第16章）、KV缓存量化技术（第17章第01节）、分块预填充技术、在苹果及高通芯片上通过NPU加速模型推理、零拷贝内存映射技术以降低RAM使用量，以及在设备端计算能力不足时自动切换到云端处理。Cactus支持在iOS、Android、macOS以及嵌入式Linux系统上进行多模态推理（大语言模型、视觉处理、语音处理），并提供针对Swift、Kotlin、Python、Flutter、React Native和Rust等语言的SDK。其测试结果显示，在M4 Pro芯片上，对于12亿参数的模型，解码速度可达100个token/秒；在iPhone 17 Pro芯片上则为48个token/秒，这充分体现了优化后的边缘推理的实际性能。

## 边缘设备的限制条件

| 资源类型 | 云端GPU（H100） | 笔记本电脑（M4芯片） | 手机（Snapdragon 8 Gen 3芯片） | 物联网设备（ESP32） |
| ---------- || ----------------- || --------------------- || ------------------------------- || ------------------- ||
| 内存容量 | 80 GB HBM3 | 16-36 GB统一内存 | 8-12 GB LPDDR5内存 | 520 KB内存 |
| 计算能力 | 989 TFLOPS（FP8精度） | 38 TOPS（神经网络引擎） | 45 TOPS（NPU） | 0.001 TOPS |
| 功耗 | 700瓦 | 15-30瓦 | 5-10瓦 | 0.1瓦 |
| 存储容量 | TB级 | 256 GB至2 TB | 128-512 GB | 4 MB |

- 云端GPU与手机NPU之间的计算能力差距约为20倍；而GPU与微控制器之间的差距则高达1,000,000倍。因此，不同的设备需要采用不同级别的压缩技术以及不同的模型架构。

## 模型压缩流程

- 对于边缘部署而言，压缩并非单一的技术手段，而是一系列相互配合的技术按顺序应用的**流程**：

```text
Full model (FP32, 70B params)
    ↓ Knowledge distillation → smaller model (7B params)
    ↓ Structured pruning → remove redundant heads/layers (4B effective)
    ↓ Quantisation (INT4) → 4x smaller (2 GB)
    ↓ Compiler optimisation → fused kernels, optimised memory layout
    ↓ Runtime → on-device execution
```

- 每一步操作都能降低模型的体积并减少推理延迟。执行顺序很重要：首先进行模型精简（简化架构），然后删除不必要的结构，接着进行量化处理（降低精度），最后进行编译优化，以适配目标硬件。如果在量化之后再进行精简，那么实际上是在尝试压缩一个已经存在损失的信息量的模型。

## 设备端运行时环境

- **运行时环境**负责加载模型、分配内存，并在目标硬件上执行推理任务。不同的平台有各自推荐的运行时环境：

- **ONNX Runtime**：跨平台，支持Windows、Linux、macOS、iOS和Android系统。可利用CPU、GPU（CUDA、DirectML、CoreML、NNAPI）以及多种加速器。是最具便携性的选择。模型可从PyTorch/TensorFlow格式转换为ONNX格式。

- **TensorFlow Lite (TFLite)**：谷歌推出的边缘端运行时环境，针对ARM CPU和Android NPU进行了优化。其二进制文件体积很小（约1 MB），支持INT8和float16数据类型，是Android平台上的标准选择。

- **Core ML**：苹果为iOS/macOS开发的运行时环境，会根据模型的特性自动选择使用神经网络引擎、GPU或CPU来进行推理。模型可通过`coremltools`工具从PyTorch/TensorFlow格式转换而来。该环境与苹果的硬件有着紧密的集成关系（如统一内存架构、神经网络引擎等）。

- **ExecuTorch**：Meta公司推出的用于设备端PyTorch推理的新运行时环境，具备提前编译的功能，还能将各种运算任务直接交给硬件加速器处理。它是PyTorch Mobile的继任者。

- **TensorRT**：NVIDIA推出的用于GPU推理优化的运行时环境（详见第15章）。该工具能够合并模型中的各个层，选择最优的运算内核，并自动进行量化处理。在NVIDIA GPU上，其推理速度比PyTorch的普通模式快2到5倍。

- **llama.cpp**：一种基于C++的单文件型LLM推理引擎，支持GGUF格式的量化处理（Q4、Q5、Q8等级），同时也能在CPU（AVX/NEON指令集）、Apple GPU、CUDA及Vulkan平台上运行。是在普通消费级硬件上运行LLM模型的理想选择。

## 编译器栈

- 在高级模型结构（PyTorch图结构）与硬件指令之间，存在着**编译器栈**，它的作用就是针对特定的目标硬件对模型进行优化。

```text
PyTorch model
    ↓ Export (torch.export, ONNX, TorchScript)
Graph IR (intermediate representation)
    ↓ Graph optimisations
        - Constant folding (compute constant expressions at compile time)
        - Dead code elimination (remove unused operations)
        - Operator fusion (conv + bn + relu → single fused op)
        - Layout transformation (NCHW → NHWC for ARM, channels-last)
    ↓ Lowering
Hardware-specific IR
    ↓ Backend optimisations
        - Tiling and loop ordering (cache-friendly access patterns)
        - Vectorisation (SIMD, chapter 16)
        - Memory planning (reuse buffers to minimise peak memory)
        - Kernel selection (choose the best implementation per op)
    ↓ Code generation
Machine code / NPU instructions
```

- **操作符融合**是效果最显著的优化手段。一个Transformer模块大约包含20种操作（矩阵乘法、加法、层归一化、Softmax等）。如果不进行融合，每种操作都会将自己的结果写入内存，而后续操作则需从内存中读取这些数据；通过融合，多种操作可以被整合到一个内核中，从而让数据保留在寄存器或缓存中。这样一来，处理速度可以提高2到5倍（参见第16章的Roofline模型）。

- **内存规划**：编译器会分析模型结构，判断哪些张量在生命周期内存在时间重叠，因此可以共享同一个内存缓冲区。一个包含100个中间张量的模型，实际上可能只需要10个张量的内存空间，因为大多数张量在新的张量被创建之前就已经被使用并释放了。对于那些内存资源有限的设备来说，这一点非常重要。

## 硬件平台

### 移动端GPU

- **高通Adreno**（安卓系统）：支持OpenCL、Vulkan计算接口（参见第16章），以及高通自研的SNPE（Snapdragon神经处理引擎）。Adreno GPU拥有256至1024个运算单元，同时支持FP16和INT8格式的数据处理。

- **ARM Mali**（安卓系统）：支持OpenCL和Vulkan。Mali GPU采用基于瓦片的架构（与桌面端GPU不同），这种架构会影响内存访问效率。

- **苹果GPU**（iOS/macOS）：通过Metal（苹果的GPU API）进行访问。其统一内存架构意味着无需进行CPU与GPU之间的数据复制操作。Metal性能着色器提供了经过优化的机器学习运算功能。

### 神经处理单元（NPU）

- NPU是专为机器学习推理设计的固定功能加速器。对于常见的机器学习操作（如矩阵乘法、卷积、激活函数计算），它们的能效远高于GPU。

- **苹果神经引擎**：拥有16个核心，INT8格式下的计算性能约为38 TOPS。该引擎通过Core ML接口进行访问，非常适合用于视觉处理任务以及设备端的扩散模型训练。它无法运行任意代码，只能执行Core ML支持的运算。

- **高通Hexagon NPU**：集成在Snapdragon芯片组中，支持INT8和INT4格式的推理操作。可通过SNPE或带有QNN后端的ONNX Runtime进行访问。它为设备端的背景虚化、语音识别以及实时翻译等功能提供支持。

- **谷歌Edge TPU**：是云端TPU的简化版，功耗较低。其计算性能为4 TOPS，功耗为2瓦特。它被用于Coral系列设备中，以实现设备端的推理功能。该芯片仅支持经过INT8量化处理的TFLite模型。

- **任务分配策略**：运行时系统会将模型结构中的不同操作分配到NPU（处理支持的操作）和CPU（处理不支持的操作）上。尽可能让更多操作在NPU上执行，是提升性能和能效的关键。

## 设备端大型语言模型

- 随着模型规模的缩小以及量化技术的进步，现在已经在手机和笔记本电脑上运行大型语言模型成为可能：

| 模型名称 | 参数量 | 量化后的大小 | 适用设备 | 性能表现 |
| ---------- || -------- || -------------- || ---------- || ----------- ||
| Phi-3 Mini | 38亿 | 约2GB（Q4格式） | 手机/笔记本电脑 | 在iPhone 15上，处理速度约为15个token/秒 |
| Gemma 2B | 20亿 | 约1.5GB（Q4格式） | 手机 | 在Pixel 8上，处理速度约为20个token/秒 |
| Llama 3.2 1B | 10亿 | 约700MB（Q4格式） | 手机 | 处理速度约为30个token/秒 |
| Llama 3.2 3B | 30亿 | 约2GB（Q4格式） | 手机/笔记本电脑 | 处理速度约为15个token/秒 |
| Llama 3.1 8B | 80亿 | 约4.5GB（Q4格式） | 笔记本电脑 | 在M2芯片上，处理速度约为20个token/秒 |

- **面临的挑战**：
- **内存问题**：30亿参数的模型量化后体积约为2GB，但长时间对话所需的KV缓存会进一步增加内存占用。在手机上，上下文长度通常限制在2到4千个token左右。
- **过热问题**：持续进行推理操作会导致手机温度上升。连续生成内容30秒后，芯片组会降低时钟频率以防止过热，这会导致性能下降30%到50%。
- **电池消耗**：以15个token/秒的速度运行30亿参数的模型，功耗约为3到5瓦特。进行30分钟的对话大约会消耗手机电池容量的5%。这种功耗水平适合偶尔使用，但对于需要持续运行的应用来说则存在问题。

- **llama.cpp**是目前设备端运行大型语言模型的标准工具。它可以在CPU（支持AVX2、NEON、I8MM指令集）、苹果GPU（通过Metal接口）、NVIDIA GPU（通过CUDA接口）、AMD GPU（通过ROCm或Vulkan接口）上运行，甚至在安卓手机的Termux环境中也能使用。

## 联邦学习

- **联邦学习**是一种无需集中存储数据即可跨多台设备训练模型的方法。每台设备都使用本地数据来训练模型，计算出梯度更新值，然后只将更新值（而非原始数据）发送到中央服务器，由服务器汇总这些更新值。

- **相关算法**（FedAvg）：

1. 服务器将当前模型发送给$K$台选定的设备。
2. 每台设备使用本地数据对模型进行几步微调。
3. 每台设备将其更新后的模型（或差异值）发送回服务器。
4. 服务器对所有更新值进行平均处理：$W_{\text{new}} = \frac{1}{K} \sum_{k=1}^{K} W_k$。
5. 重复上述步骤。

- **隐私保护**：原始数据永远不会离开设备，服务器只能看到汇总后的模型更新值。**差分隐私**技术会在更新值中加入噪声，从而防止从梯度数据中反推出单个数据点的信息。

- **通信效率优化**：模型更新数据的体积很大（与模型本身大小相当）。可以通过以下方法降低通信量：**梯度量化**（用INT8格式的梯度代替FP32格式的梯度）、**稀疏化**（只传输数值最大的梯度）以及**梯度累积**（在本地多执行几步计算，减少发送更新的频率）。

- **应用场景**：谷歌的键盘预测功能（Gboard）、苹果的语音识别功能，以及健康监测系统（可在不集中存储敏感健康数据的情况下进行模型训练）都属于联邦学习的应用实例。

## 延迟优化

- 除了压缩技术之外，还有多种方法可以降低端到端的推理延迟：

- **提前终止机制**：在模型的中间层添加分类模块。如果模型在24层中的第6层就已经能够给出较为准确的预测结果，那么就可以直接返回预测结果，而无需继续处理后面的层7到24。对于容易处理的输入，模型会提前终止计算；而对于复杂的输入，则会使用完整的模型进行处理。对于包含多种类型输入的任务，这种机制能显著降低平均延迟。

- **模型分区处理**：将模型分为不同的部分，分别交由NPU（擅长处理矩阵乘法操作）、GPU（擅长处理非规则运算）和CPU（处理其他各类操作）来处理。编译器会根据性能分析结果决定将哪些操作分配到哪个处理单元上。
- **缓存**：对于有重复查询需求的应用（如自动补全、代码补全），可缓存最近的计算结果。如果用户输入“我该怎么做”，而模型之前已经为类似问题生成过答案，那么就可以直接使用这些缓存的KV数据，从而完全跳过预填充步骤。

- **预测性预取**：通过预测用户接下来的操作，在其提出问题之前就开始进行推理。例如，在聊天应用中，当用户正在阅读当前回复时，系统就可以开始为用户可能提出的下一个问题生成回复。

## 编程任务（请使用CoLab或笔记本）

1. 模拟模型压缩流程。从float32格式的模型开始，依次应用蒸馏处理、剪枝和量化操作，并记录每一步后的模型大小变化。

```python
def compression_pipeline(original_params_M, original_bits=32):
    size_mb = original_params_M * 1e6 * original_bits / 8 / 1e6

    print(f"Original: {original_params_M}M params, {original_bits}-bit → {size_mb:.0f} MB")

    # Step 1: Knowledge distillation (reduce params)
    distilled_params = original_params_M * 0.15  # 70B → ~10B equivalent
    size_mb = distilled_params * 1e6 * original_bits / 8 / 1e6
    print(f"After distillation ({distilled_params:.0f}M params): {size_mb:.0f} MB")

    # Step 2: Structured pruning (remove 30% of remaining)
    pruned_params = distilled_params * 0.7
    size_mb = pruned_params * 1e6 * original_bits / 8 / 1e6
    print(f"After pruning ({pruned_params:.0f}M params): {size_mb:.0f} MB")

    # Step 3: INT4 quantisation
    size_mb = pruned_params * 1e6 * 4 / 8 / 1e6
    print(f"After INT4 quantisation: {size_mb:.0f} MB")

    print(f"Total compression: {original_params_M * 1e6 * original_bits / 8 / 1e6 / size_mb:.0f}x")

print("=== Starting from 70B model ===")
compression_pipeline(70000)

print("\n=== Starting from 7B model ===")
compression_pipeline(7000)
```

1. 估算设备端的推理延迟。根据模型的操作次数及硬件规格，判断其是否满足预定的延迟要求。

```python
def estimate_latency(model_name, params_M, bits, compute_tops, mem_bw_gbs, seq_len=256):
    """Estimate token generation latency for a memory-bandwidth-bound model."""
    # Model size in bytes
    model_bytes = params_M * 1e6 * bits / 8

    # Decode is memory-bound: must load entire model per token
    time_per_token_ms = model_bytes / (mem_bw_gbs * 1e9) * 1000

    # Tokens per second
    tokens_per_sec = 1000 / time_per_token_ms

    print(f"{model_name}: {params_M/1000:.1f}B params @ {bits}-bit = {model_bytes/1e9:.1f} GB")
    print(f"  Memory bandwidth: {mem_bw_gbs} GB/s")
    print(f"  Time per token: {time_per_token_ms:.1f} ms")
    print(f"  Tokens/sec: {tokens_per_sec:.0f}")
    print()

# Apple M2 Pro: 200 GB/s unified memory bandwidth
print("=== Apple M2 Pro (200 GB/s) ===")
estimate_latency("Llama-7B Q4", 7000, 4, 15.8, 200)
estimate_latency("Llama-7B Q8", 7000, 8, 15.8, 200)
estimate_latency("Llama-70B Q4", 70000, 4, 15.8, 200)

# Phone (Snapdragon 8 Gen 3): ~50 GB/s LPDDR5
print("=== Snapdragon 8 Gen 3 (50 GB/s) ===")
estimate_latency("Phi-3 Mini Q4", 3800, 4, 45, 50)
estimate_latency("Llama-3B Q4", 3000, 4, 45, 50)
```

## 扩展与部署

_要为数百万用户提供大型模型的服务，就需要在多个GPU上分布式执行推理任务，在需要之前就预测出相应的令牌，对共享的上下文进行缓存，并选择合适的框架。本文件涵盖了推理过程中的并行处理、推测性解码、前缀缓存、推理框架、成本优化以及监控相关内容。_

- 单个H100 GPU在处理700亿参数的模型时，能够以可接受的延迟同时服务约100名用户。而要服务1000万名用户，则需要10万个GPU，这每年将在云计算方面带来约30亿美元的支出。效率每提升一个百分点，就能节省数千万美元的成本。正因如此，推理优化并非纯理论问题——它直接决定了人工智能产品的经济性。

## 推理过程中的模型并行处理

- 当模型过大而无法容纳在单个GPU中时，就必须将其拆分到多个GPU上。训练阶段所用的并行策略（第6章）在推理阶段也可应用，不过会带来不同的权衡。

### 张量并行处理

- **张量并行处理**（类似Megatron架构，见第6章）是将各个权重矩阵分配到不同的GPU上。对于线性层$Y = XW$，权重矩阵$W$会被按列拆分到$N$个GPU上。每个GPU分别计算一部分结果，之后再通过全求和操作将所有结果整合起来：

$$W = [W_1 | W_2 | \cdots | W_N], \quad Y_i = X W_i, \quad Y = \text{concat}(Y_1, \ldots, Y_N)$$

- 在推理过程中，对于那些无法容纳在单个GPU中的模型，张量并行处理是默认的方案。700亿参数的模型在FP16格式下需要140GB的存储空间，通过张量并行处理，这些数据可以分配到2个各80GB容量的GPU上。

- **对延迟的影响**：张量并行处理会在每一层增加一次全求和通信操作。在NVLink接口上，这一操作每层会增加约0.1毫秒的延迟；而在PCIe接口上，则会增加约3毫秒的延迟。对于一个有80层、总参数量为700亿的模型，使用NVLink时总延迟约为8毫秒，而使用PCIe时则约为240毫秒。这也说明了为什么NVLink对于多GPU推理来说至关重要。

### 管道并行处理

- **管道并行处理**则是将不同的层分配到不同的GPU上。GPU 1负责处理第0层到第39层，GPU 2负责处理第40层到第79层。令牌会依次通过这些GPU进行处理。

- 在推理过程中，管道并行处理的延迟高于张量并行处理（因为每个令牌都需要让整个处理流程完整运行一遍），但其通信开销更低（只需在GPU之间传递激活值，无需进行全求和操作）。当GPU之间的连接速度较慢时（例如位于不同节点且没有NVLink连接），就会采用这种并行方式。

### 序列并行处理

- 对于非常长的序列，即便模型本身可以容纳在单个GPU中，KV缓存也可能无法容纳全部数据。**序列并行处理**就是将KV缓存拆分到多个GPU上：每个GPU负责存储序列中部分键值对。

- 在注意力计算过程中，每个GPU会针对自己所负责的那一部分序列计算出部分的注意力分数，之后再通过聚合操作将这些分数合并起来。这种方法适用于需要处理长上下文的情况（如128K以上令牌数的场景），因为此时KV缓存的规模已经超出了单个GPU的存储能力。

## 推测性解码

- **推测性解码**是LLM推理优化中最有效的手段之一。其核心思路是：解码过程之所以缓慢，是因为它是一次生成一个令牌，而每个令牌的生成都需要让整个大型模型进行一次完整的forward pass。不过，小型模型可以更快地生成候选令牌，而大型模型则可以同时**验证**多个候选令牌。

![推测性解码示意图：一个快速的草稿模型先生成5个候选令牌，目标模型则一次性验证所有候选令牌，被接受的令牌会被保留，而被拒绝的令牌则会从目标模型的概率分布中重新采样](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/speculative_decoding.svg)

- **具体算法步骤如下**：

1. 一个**草稿模型**（参数量小、处理速度快，例如10亿参数）通过自回归方式生成$k$个候选令牌。
2. **目标模型**（参数量大、精度高，例如700亿参数）会对整个草稿序列进行一次forward pass，从而计算出每个候选令牌的概率。
3. 如果目标模型认为某个候选令牌的概率足够高，那么该令牌就会被接受；否则，就会从目标模型的概率分布中重新采样候选令牌。
4. 平均而言，每次验证步骤中会有多个令牌被接受，因此速度提升程度与接受率成正比。

$$\text{速度提升倍数} \approx \frac{k \times \text{接受率}}{\text{成本比率}} \approx 2\text{-}3\times$$

- **为何不会影响质量**：由于采用了拒绝采样机制，最终的输出分布与目标模型完全一致。因此推测性解码是一种无损优化方法——其输出在统计意义上与直接使用目标模型得到的结果相同，只是处理速度更快而已。

- **其他变体方案**：
- **Medusa**（Cai等人，2024年）：不需要单独的草稿模型，而是在目标模型中添加多个轻量级的“头模块”，让它们同时预测多个未来的令牌。 thus无需额外的模型。
- **EAGLE**（Li等人，2024年）：训练一个轻量级的草稿模块，该模块利用目标模型的隐藏状态来预测未来的令牌。相比独立的草稿模型，它的接受率更高。
- **自我推测性解码**：让目标模型自身通过提前终止的方式生成草稿（仅运行前几层即可生成草稿，然后再用完整模型进行验证）。
- **并行解码**：同时生成多个候选序列（形成一棵候选树），然后一次性验证整棵树。这种方式吞吐量更高，但由于需要为每个分支存储KV缓存，因此会占用更多内存。

## 前缀缓存

- 许多请求都包含相同的前缀内容，比如系统提示语、少量样本数据或常见的查询模式。**前缀缓存**就是将这些前缀对应的KV缓存存储起来，以便在后续请求中重复使用。

- **系统提示语缓存**：如果每个请求都以相同的2000个令牌组成的系统提示语开头，那么这2000个令牌对应的KV缓存只需计算一次，就可以在所有请求中重复使用。对于一个有80层的700亿参数模型来说，这样每条请求就能节省约200MB的存储空间。

- **基数树缓存**（SGLang）：可以将缓存的前缀信息组织在基数树中。当有新请求到来时，系统会找到最长的匹配前缀，然后从该前缀开始生成内容，从而无需再次计算已匹配的部分。
- **影响**：对于那些具有较长共享前缀的应用程序（如带有系统提示的聊天机器人、使用相同检索内容的RAG系统），前缀缓存可将TTFT降低50-90%，同时减少GPU的计算负担。

## KV缓存淘汰机制

- 除了对KV缓存进行量化处理（文件01）以及利用GQA/MLA技术来缩小其规模（文件02）之外，**KV缓存淘汰机制**还会选择性地移除那些将来不太可能被使用的缓存项。

- **H2O**（Heavy-Hitter Oracle，Zhang等人，2023年）发现，注意力分数遵循幂律分布：只有一小部分Token会获得大部分的注意力，而大多数Token则几乎得不到任何关注。H2O会保留：

1. **最近的Token**（即最后$w$个Token，类似StreamingLLM的做法）；
2. **高重要性Token**（即根据所有历史解码步骤中的累积注意力分数排序后的前$k$个Token）。

- 那些既不是最近出现的Token也不是高重要性Token的会被淘汰。这样就能保持KV缓存的固定大小，同时保留那些真正会影响生成结果的Token。H2O仅使用20%的内存就能实现接近完整KV缓存的质量。

- **Scissorhands**（Liu等人，2023年）采用了类似的方法，但它使用了更复杂的重要性评估指标：在**当前**步骤中受到高度关注的Token会被保留，而那些已经$T$步未被关注的Token则会被淘汰。这种方式能够适应生成过程中不断变化的注意力模式。

- **动态淘汰+StreamingLLM**：结合了“固定保留部分Token”的方式与“动态淘汰”策略，既能保留最近的Token和高重要性Token，又能有效控制内存使用。这是处理超长文本生成任务时最节省内存的方法，能够在保证质量基本不受影响的前提下实现无限长度的文本生成。

- 所有淘汰机制背后的共同原理是：在实际应用中，大语言模型的注意力分配是**稀疏的**——尽管模型会对所有缓存中的Token都进行注意力计算，但实际上大部分注意力权重都集中在少数Token上。淘汰掉其余Token对输出质量的影响微乎其微。

## 推理框架

- 目前，大语言模型服务领域已经形成了几种主流的推理框架：

| 框架 | 优点 | 最适合的应用场景 |
| ------ || ------ || ------------------ ||
| **vLLM** | 支持分页注意力机制、连续批处理，吞吐量高 | 通用的大语言模型服务，需要最高吞吐量的场景 |
| **TensorRT-LLM** | 经过NVIDIA优化的内核、FP8格式支持、支持在线批处理 | 在NVIDIA GPU上实现最佳性能 |
| **SGLang** | 支持前缀缓存（RadixAttention机制）、快速的结构化生成 | 需要共享前缀或对输出格式有严格要求的应用程序 |
| **llama.cpp** | 支持CPU/Metal/CUDA/Vulkan多种硬件，支持GGUF格式量化，具备良好的便携性 | 适用于消费级硬件及设备端推理 |
| **TGI**（HuggingFace提供） | API简单，易于部署，可与模型中心集成 | 需要快速部署的应用，以及HuggingFace生态系统内的应用 |
| **Ollama** | 通过一条命令即可完成模型的下载和运行 | 个人使用及本地开发场景 |
| **ExLlamaV2** | 采用极端的量化优化技术（EXL2格式），非常适合内存受限的GPU环境 | 内存资源紧张的GPU推理场景 |

- **vLLM**是目前生产环境中大语言模型服务的默认选择。它支持连续批处理、分页注意力机制、张量并行处理、推测性解码、LoRA模型支持，而且能够兼容大多数开源模型。

- **TensorRT-LLM**在NVIDIA硬件上能实现最高的性能（在同一GPU上比vLLM快10-30%），但其灵活性较差，定制难度也更高。

- **SGLang**在那些需要结构化输出（如JSON格式数据、特定格式的代码）或具有共享前缀的应用场景中表现优异，这得益于它的Radix注意力缓存机制以及高效的解码引擎。

## 成本优化

- 在大规模应用中，推理成本往往占据机器学习项目预算的很大比例。以下是一些降低成本的方法：

- **合理选择GPU型号**：并非所有模型都需要H100这样的高端GPU。经过量化的70亿参数模型在A10G上也能正常运行，其成本约为每小时1美元，而使用H100的成本则高达每小时8美元左右。应根据实际工作负载来选择合适的GPU。

- **使用临时实例**：云服务提供商会以60-90%的折扣提供未被使用的GPU资源（如AWS的Spot实例、GCP的Preemptible实例）。虽然这些临时实例可能会被中断，但它们适合用于批量推理任务，而不适合对延迟要求极高的应用。通过适当的错误处理机制（如保存状态并在新实例上继续运行），这些临时实例也可以用于处理交互式请求。

- **自动扩缩容**：根据流量情况动态调整GPU的数量。在高峰时段增加GPU数量，而在夜间则减少。Kubernetes的HPA功能或云平台的自动扩缩容功能可以实现这一目标。

- **批量处理提升利用率**：GPU的利用率从30%提升到90%，每处理一个Token的成本就会降低3倍。连续批处理、智能调度以及分页注意力机制都能帮助提高GPU的利用率。

- **量化处理**：使用INT4格式相比FP16格式可节省4倍的存储空间，因此可以在更小的GPU上运行，进而降低成本。此外，相同的批次中可以处理更多的请求，从而提高吞吐量，进一步降低每Token的成本。

- **各框架下每百万Token的预估成本**（2026年数据）：

| 框架 | 每百万Token的成本 |
| ------ || ------------------ ||
| GPT-4o API | 2.50美元 |
| Claude 3.5 Sonnet API | 3.00美元 |
| 在H100上运行的Llama-70B模型（vLLM，FP16格式） | 0.50美元 |
| 在H100上运行的Llama-70B模型（TRT-LLM，INT8格式） | 0.25美元 |
| 在A10G上运行的Llama-8B模型（vLLM，INT4格式） | 0.05美元 |
| 在设备端运行的Llama-3B模型（llama.cpp） | 0美元（硬件成本已分摊） |

## 监控

- 在生产环境中，必须对推理过程进行持续监控，以便在问题出现之前及时发现并解决，避免影响用户体验。

- **延迟监控**：需要监测p50、p95和p99级别的TTFT和TPOT值。一旦p99值超过预设的标准，就需要触发警报。p99值的上升通常意味着：KV缓存内存压力过大、某个长时间运行的请求占用了所有资源，或者GPU出现了过热现象。

- **吞吐量监控**：需要监测每台GPU每秒能够处理的Token数量。如果吞吐量下降，可能是由于批量处理的效率降低（大量短请求导致GPU利用率不高）、序列长度增加（每个请求需要更多的KV缓存空间），或是硬件出现问题（如GPU处于ECC错误校正模式，导致运行速度变慢）。
- **GPU利用率**：需监控SM的占用率、内存使用情况以及内存带宽。如果SM占用率低而内存使用率很高，则说明存在内存瓶颈（需要更高的带宽或采用量化技术）。反之，如果SM占用率高但内存使用率低，则属于计算瓶颈（需要更高的计算能力或更小的模型）。

- **模型质量监控**：需跟踪每次请求的相关指标，如响应长度、在测试集上的困惑度以及用户反馈。模型质量可能会因为数据分布变化、长时间对话过程中KV缓存量化误差的积累，或是服务流程中的缺陷而下降。

- **成本监控**：需记录每种模型、每种GPU类型每处理一个token所需的成本。如果成本上升而处理效率却没有提升，那就需要检查是否存在效率下降的问题，比如新版本模型的内存占用过高、批量处理配置不合理，或是GPU未能得到充分利用。

- **工具**：用于监控基础设施指标的工具有Prometheus和Grafana（见第15章）；vLLM/TRT-LLM则提供了内置的指标接口；对于模型层面的指标，则可以通过自定义日志来记录。

## 编程任务（可使用CoLab或笔记本完成）

1. 模拟推测性解码功能。使用快速的“草稿”函数和慢速的“目标”函数，然后测量同时生成和验证多个token时的速度提升效果。

```python
import random
import time

def target_model(tokens):
    """Slow but accurate model. Returns probability of each candidate token."""
    time.sleep(0.01)  # simulate 10ms per forward pass
    # For simulation: accept tokens that are even numbers
    return [0.9 if t % 2 == 0 else 0.1 for t in tokens]

def draft_model():
    """Fast but approximate model. Generates one candidate token."""
    time.sleep(0.001)  # simulate 1ms per token
    return random.randint(0, 9)

def standard_decoding(n_tokens):
    """Generate one token at a time with the target model."""
    tokens = []
    for _ in range(n_tokens):
        time.sleep(0.01)  # target model generates 1 token
        tokens.append(random.randint(0, 9))
    return tokens

def speculative_decoding(n_tokens, k=4):
    """Generate k draft tokens, verify with target, accept/reject."""
    tokens = []
    total_target_calls = 0

    while len(tokens) < n_tokens:
        # Draft: generate k candidates quickly
        candidates = [draft_model() for _ in range(k)]

        # Verify: one target model call for all k candidates
        probs = target_model(candidates)
        total_target_calls += 1

        # Accept tokens until one is rejected
        for i, (tok, prob) in enumerate(zip(candidates, probs)):
            if random.random() < prob:
                tokens.append(tok)
                if len(tokens) >= n_tokens:
                    break
            else:
                # Resample from target distribution
                tokens.append(tok + 1)  # simplified resampling
                break

    return tokens, total_target_calls

n = 50

start = time.time()
_ = standard_decoding(n)
standard_time = time.time() - start

start = time.time()
_, target_calls = speculative_decoding(n, k=5)
spec_time = time.time() - start

print(f"Standard:    {standard_time:.2f}s ({n} target calls)")
print(f"Speculative: {spec_time:.2f}s ({target_calls} target calls)")
print(f"Speedup:     {standard_time / spec_time:.1f}x")
```

1. 估算在LLM服务部署中应用不同优化策略所能带来的成本节约。

```python
def serving_cost_analysis(
    model_name, params_B, precision_bits,
    gpu_name, gpu_mem_gb, gpu_cost_per_hr,
    target_throughput_tps,
):
    """Estimate serving cost for an LLM deployment."""
    model_size_gb = params_B * 1e9 * precision_bits / 8 / 1e9
    gpus_for_model = max(1, int((model_size_gb * 1.2) / gpu_mem_gb + 0.99))  # 1.2x for KV-cache

    # Rough throughput estimate (memory-bandwidth limited)
    tokens_per_gpu = 500 / (params_B * precision_bits / 16)  # normalised to 500 tok/s for 7B FP16
    total_throughput = tokens_per_gpu * gpus_for_model

    replicas = max(1, int(target_throughput_tps / total_throughput + 0.99))
    total_gpus = gpus_for_model * replicas
    cost_per_hr = total_gpus * gpu_cost_per_hr
    cost_per_1M_tokens = cost_per_hr / (total_throughput * replicas * 3600 / 1e6)

    print(f"{model_name} @ {precision_bits}-bit on {gpu_name}:")
    print(f"  Model size: {model_size_gb:.0f} GB → {gpus_for_model} GPU(s)/replica")
    print(f"  Throughput: {total_throughput:.0f} tok/s/replica")
    print(f"  Replicas for {target_throughput_tps} tok/s: {replicas}")
    print(f"  Total GPUs: {total_gpus}")
    print(f"  Cost: ${cost_per_hr:.0f}/hr, ${cost_per_1M_tokens:.2f}/1M tokens")
    print()

print("=== Cost Comparison ===\n")

# Baseline: FP16 on H100
serving_cost_analysis("Llama-70B", 70, 16, "H100", 80, 8.0, 1000)

# Quantised: INT8 on H100
serving_cost_analysis("Llama-70B", 70, 8, "H100", 80, 8.0, 1000)

# Quantised: INT4 on A100
serving_cost_analysis("Llama-70B", 70, 4, "A100", 80, 4.0, 1000)

# Smaller model: 8B on A10G
serving_cost_analysis("Llama-8B", 8, 4, "A10G", 24, 1.0, 1000)
```
