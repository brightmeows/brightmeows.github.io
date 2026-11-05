---
title: "语音与音频"
date: "2026-11-05"
order: 9
slug: "compendium/09-audio-and-speech"
description: "数字信号处理的作用是将原始音频波形转换为结构化的表示形式，以便机器学习模型能够从中学习。本文件涵盖了声音的物理特性、采样与量化、傅里叶变换（DFT、FFT）、频谱图、梅尔滤波器组、MFCC参数以及窗口函数等内容，这些都是用于所有语音和音频人"
tags: []
---

## 数字信号处理

_数字信号处理的作用是将原始音频波形转换为结构化的表示形式，以便机器学习模型能够从中学习。本文件涵盖了声音的物理特性、采样与量化、傅里叶变换（DFT、FFT）、频谱图、梅尔滤波器组、MFCC参数以及窗口函数等内容，这些都是用于所有语音和音频人工智能系统的特征提取方法。_

- **声音**是一种在介质中传播的压力波——无论是空气、水还是固体。振动的物体（如声带、吉他弦、扬声器锥体）会推动和拉动空气分子，从而形成高压区与低压区的交替出现。

- 这些压力变化以大约343米/秒的速度在空气中传播，最终到达耳朵，使耳膜振动，并进而转化为神经信号。

- 可以把声音想象成向静止的池塘中投入石头：石头是振动源，涟漪就是压力波，而漂浮在水面上的软木塞则相当于对波的响应——即麦克风或耳膜。

- 软木塞的波动幅度称为**振幅**，每秒波动的次数称为**频率**，而当波到达时软木塞是从波动的最高点还是最低点开始移动，则对应**相位**的概念。

- **波形**则是压力（或电压，即麦克风将声音转换为电信号后的数值）随时间变化的图形。最简单的波形是**纯音**，也就是单一的正弦波：

$$x(t) = A \sin(2\pi f t + \phi)$$

- 其中：
- $A$为振幅（即偏离零点的最大值，决定了声音的响度），
- $f$为频率，单位为赫兹，表示每秒的周期数，决定了声音的音高，
- $\phi$为相位，以弧度为单位，表示波的起始时间偏移。

- **周期**$T = 1/f$，即完成一个完整周期所需的时间。

![标注有振幅、周期、频率和相位偏移的正弦波图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/audio_waveform.svg)

- **振幅**决定了声音的响度。振幅翻倍，其功率就会增加四倍（因为功率与振幅的平方成正比）。

- 人类的听觉范围非常广泛，因此我们使用对数尺度来表示振幅，即**分贝**。声音的声压级计算公式为：

$$L = 20 \log_{10}\left(\frac{A}{A_\text{ref}}\right) \text{ dB}$$

- 其中$A_\text{ref}$为参考振幅，通常取听觉阈值，即$20 \mu\text{Pa}$。耳语的声压级约为30分贝，正常对话约为60分贝，摇滚音乐会的声压级则可达110分贝。每增加6分贝，振幅大约翻一番；每增加10分贝，声音的响度大约也会翻一番。这里所使用的对数函数与第03章中的相同。

- **频率**决定了声音的音高。低频率（20-250赫兹）对应低音，高频率（2000-20000赫兹）对应高音。人类的听觉范围大约在20赫兹到20千赫兹之间。A调的标准频率为440赫兹。频率翻倍，音高就会上升一个**八度**。

- 大多数自然声音并非纯音，而是多种频率的复杂混合体。这就是为什么钢琴和小提琴演奏同一个音符时听起来会有所不同的原因：它们具有相同的**基频**，但在**谐波**（基频的整数倍）及其相对振幅方面存在差异，而这些差异正是决定声音**音色**的因素。

- **相位**决定了波在其周期中的起始位置。两个振幅和频率相同但相位不同的波，可能会发生相长干涉（相位一致，振幅相加）或相消干涉（相位相反，振幅相互抵消）。

- 相位在立体声音频和波束形成技术中非常重要，但在许多语音处理流程中被忽略，因为人类对音高和音色的感知基本上不受相位影响。

- 现实世界中的音频信号是时间的**连续函数**，而计算机处理的是离散数值。**采样**就是通过定期测量信号的值，将连续信号转换为离散序列。

- **采样率**$f_s$表示每秒的采样次数。CD音频的采样率为$44{,}100$赫兹；电话通信的采样率为8000赫兹；现代语音处理系统通常采用16000赫兹的采样率。

- **奈奎斯特-香农采样定理**指出，只有当采样率至少是信号中最高频率的两倍时，才能从采样数据中完美重建出原始连续信号：

$$f_s \geq 2 f_\text{max}$$

- $f_s / 2$这个频率被称为**奈奎斯特频率**。如果信号中包含高于奈奎斯特频率的成分，这些成分会“折叠”回有效频率范围内，表现为虚假的低频成分。这种现象被称为**混叠**。混叠一旦发生就无法逆转：无法再从采样数据中恢复出原始信号。

- 用生活中的例子来说明混叠现象，就是电影中车轮旋转的效果：当车轮的旋转速度略高于影片的帧率时，由于拍摄时的采样频率不足，车轮看起来会反向缓慢旋转。在音频领域，15千赫兹的音频若以16千赫兹的采样率进行采样（奈奎斯特频率为8千赫兹），则会混叠为16千赫兹减去15千赫兹，即1千赫兹的频率，这显然是一个完全不同的音高。

![正确采样与采样率过低导致的混叠现象对比图](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/sampling_aliasing.svg)

- 为避免混叠，会使用**抗混叠滤波器**（即低通滤波器），在采样之前去除所有高于$f_s/2$的频率。这种滤波功能由模数转换器在信号数字化之前执行。

- **量化**则是将每个连续值的样本映射到有限等级集合中最接近的数值上。一个$n$位量化器拥有$2^n$个等级。CD音频采用16位量化（$2^{16} = 65{,}536$个等级）；电话通信则常用8位量化，并结合$\mu$律或A律**压缩映射**技术——这是一种非线性映射方式，它为较小的振幅分配更多的等级，从而更符合人类的听觉感知。量化过程会产生**量化噪声**，这是一种舍入误差，其方差为$\Delta^2/12$，其中$\Delta$为各等级之间的间隔大小。

- **时域分析**则是直接从波形中提取特征，而不需要将其转换到其他域中。这类特征较为简单，计算速度快，且能够反映信号的基本特性。
- 由$N$个样本构成的数据帧的**能量**值可用于衡量该信号的总体响度：

$$E = \sum_{n=0}^{N-1} x[n]^2$$

- 语音信号的能量值较高，而静音部分的能量值较低。这里的能量实际上就是第01章中提到的$\ell_2$范数的平方，应用于信号向量上。

- **零交叉率**用于统计信号在每个数据帧中改变符号的频率：

$$\text{ZCR} = \frac{1}{2(N-1)} \sum_{n=1}^{N-1} |\text{sign}(x[n]) - \text{sign}(x[n-1])|$$

- 高零交叉率意味着信号中含有较多的高频成分或噪声；低零交叉率则表明信号为低频信号或浊音信号（即声带周期性振动产生的信号）。零交叉率其实是一种简单的频率估计方法：频率为$f$赫兹的纯音，每秒会经历$2f$次零交叉。

- **自相关函数**用于衡量一个信号与其延迟后的版本之间的相似程度：

$$R[k] = \sum_{n=0}^{N-1-k} x[n] \cdot x[n+k]$$

- 当滞后时间$k = 0$时，自相关函数的值等于该信号的能量。对于周期性信号，其自相关函数会在与周期相等的滞后时间点出现峰值。这一特性被广泛用于**音高检测**：只需找到$R[k]$中$k=0$之后的第一个显著峰值，即可计算出音高，公式为$f_s / k_\text{peak}$。自相关函数实际上与第01章中的点积运算有关：$R[k]$就是信号与其经过$k$步延迟后的版本的点积结果。

- **频域分析**能够揭示信号中的频谱成分，这些信息在时域波形中是看不到的。实现这一分析的关键工具是**离散傅里叶变换**，它可以将包含$N$个样本的信号分解为$N$个复数值的频谱分量：

$$X[k] = \sum_{n=0}^{N-1} x[n] \cdot e^{-j 2\pi k n / N}, \quad k = 0, 1, \ldots, N-1$$

- 每个$X[k]$都是一个复数，其模值$|X[k]|$表示频率为$f_k = k \cdot f_s / N$赫兹的频谱分量的幅度，而其相位$\angle X[k]$则表示该分量的相位偏移。离散傅里叶变换实际上是从时域基函数（单位脉冲）转换为频域基函数（复指数函数）的一种方式，这正是第02章中基函数概念的直接应用。离散傅里叶变换可以用矩阵乘法表示为$\mathbf{X} = W \mathbf{x}$，其中$W$是一个$N \times N$大小的离散傅里叶变换矩阵，其元素为$W_{kn} = e^{-j2\pi kn/N}$。

- **快速傅里叶变换**是一种高效的算法，它可以通过将问题递归地分解为偶数索引和奇数索引的两个子问题来计算离散傅里叶变换，从而将计算复杂度从传统的$O(N^2)$降低到$O(N \log N)$，这种优化使得实时频谱分析成为可能。快速傅里叶变换堪称所有计算机领域中最重要的算法之一。

- **功率谱**$|X[k]|^2$反映了信号在不同频率上的能量分布情况，而**幅度谱**$|X[k]|$则显示了各频率分量的幅度。通过绘制这两类谱图，可以判断哪些频率在信号中占主导地位：元音信号的谐波频率通常是基频的整数倍；而摩擦音（如“s”音）则具有较宽的高频能量分布。

- **频谱图**是一种可视化工具，用于展示信号中的频谱成分随时间的变化情况。它的生成方法是把信号分割成多个重叠的短数据帧，分别对每个数据帧进行快速傅里叶变换，然后将得到的幅度谱并排显示出来。横轴表示时间，纵轴表示频率，而每个点上的颜色或亮度则代表该频率分量的幅度。频谱图是音频处理中最重要的可视化工具。

![频谱图：横轴为时间，纵轴为频率，颜色表示幅度](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/spectrogram_stft.svg)

- **梅尔频率刻度**是一种基于人类听觉感知特性的频率刻度，它反映了人类对音高的感知方式。人类会将频率的相等比例视为音高的相等间隔（就像我们会将幅度的相等比例视为响度的相等间隔一样）。在1000赫兹以下，梅尔频率刻度大致呈线性关系；而在1000赫兹以上，则呈现近似对数关系：

$$m = 2595 \log_{10}\left(1 + \frac{f}{700}\right)$$

- 其逆公式为$f = 700(10^{m/2595} - 1)$。正是由于梅尔频率刻度的存在，音乐中的半音在対数频率轴上才是等间距的：A4（440赫兹）到A5（880赫兹），以及A5到A6（1760赫兹），虽然它们之间的频率差分别为440赫兹和880赫兹，但听起来都像是“高一个八度”。

- **梅尔滤波器组**是一组在梅尔频率刻度上均匀分布的三角形带通滤波器。每个滤波器负责处理某个特定的频率范围，将该范围内的频谱能量求和后得到一个数值。典型的语音处理系统会使用40到80个这样的梅尔滤波器。低频滤波器的通带较窄（因为在低频区域人类的听觉敏感度较高），而高频滤波器的通带较宽（因为在高频区域人类的听觉敏感度较低）。这种方式能够模拟人耳耳蜗的频率分辨率特性。

![在线性频率轴上显示的梅尔滤波器组：低频区域滤波器较窄，高频区域滤波器较宽](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mel_filterbank.svg)

- **梅尔频率倒谱系数**是用于表示语音和音频特征的经典方法。它们将梅尔频谱压缩为少量互不相关的系数，这些系数能够捕捉频谱包络的形状（该形状反映了声道结构，进而决定了语音的身份），同时忽略那些细节复杂的频谱信息（这些信息则与音高和相位相关）。
- MFCC处理流程：

1. **预加重处理**：应用一阶高通滤波器 $y[n] = x[n] - \alpha x[n-1]$（通常$\alpha = 0.97$），以增强被声道衰减的高频信号。
2. **分帧处理**：将信号分割成相互重叠的帧（通常每帧长度为25毫秒，帧间间隔为10毫秒）。
3. **加窗处理**：用窗函数（汉明窗）对每个帧进行乘法运算，从而减少频谱泄漏现象（详见下文）。
4. **FFT变换**：计算每个加窗后帧的功率谱。
5. **梅尔滤波器组**：将三角形的梅尔滤波器组应用于功率谱上，从而得到梅尔频带能量值。
6. **对数变换**：对梅尔频带能量值取对数。对数变换可以压缩动态范围，并将频谱分量的乘法运算转化为加法运算，从而更符合人类的响度感知方式。
7. **DCT变换**：对经过对数变换后的梅尔能量值应用离散余弦变换。DCT变换能够降低各梅尔频带之间的相关性，并将能量集中在前几个系数中。通常保留前13个系数（即MFCC-0到MFCC-12）。

![从原始音频到加窗帧、FFT变换、梅尔滤波器组、对数压缩以及DCT变换，最终得到MFCC特征值的整个处理流程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mfcc_pipeline.svg)

- 第7步中的DCT变换实际上相当于“频谱的傅里叶变换”（因此才被称为“倒谱”——即“频谱”的变体）。低阶倒谱系数能够反映频谱的整体形状（即声道共振峰），而高阶系数则能捕捉更精细的频谱细节（如音高谐波）。通过仅保留前13个系数，我们既保留了共振峰信息，又去掉了与音高相关的细节信息。

- **Delta**和**delta-delta** MFCC值是通过计算相邻帧之间的差分得到的，它们反映了频谱形状的变化情况，从而为信号添加时间维度信息。一个完整的MFCC特征向量通常是39维的：13个静态系数 + 13个Delta系数 + 13个delta-delta系数。

- 现代的神经网络模型（第06章）已经逐渐用学习得到的特征来替代MFCC特征：对数梅尔频谱图（即第6步的输出，省略了DCT变换步骤）已成为深度学习语音识别和音频分类任务的标准输入。这类模型能够自行实现信号的去相关性处理。不过，在资源有限的场景下，以及在传统的机器学习处理流程中，MFCC特征仍然非常重要，因为它们有助于理解信号处理的原理。

- **加窗处理**是指在计算FFT之前，先将信号帧与某种平滑的窗函数相乘。如果不进行加窗处理，FFT算法会假设该帧是无限重复的；而帧的突然开始和结束会导致人为的不连续性，使得能量分散到所有频率上，这种现象被称为“频谱泄漏”。

- **矩形窗**：对于所有的$n$，都有$w[n] = 1$。这种窗没有渐变结构，因此频谱泄漏最严重，但主瓣最宽（在给定帧长下频率分辨率最高）。在实际应用中很少使用。

- **汉明窗**：其表达式为$w[n] = 0.54 - 0.46 \cos(2\pi n / (N-1))$。该窗在边缘处逐渐趋近于零，从而大大减少了频谱泄漏。它是语音处理中的标准选择。

- **汉宁窗**：其表达式为$w[n] = 0.5 - 0.5 \cos(2\pi n / (N-1))$。该窗在边缘处也恰好趋近于零。它与汉明窗非常相似，但旁瓣抑制效果稍好一些。

- **布莱克曼窗**：其表达式为$w[n] = 0.42 - 0.5 \cos(2\pi n / (N-1)) + 0.08 \cos(4\pi n / (N-1))$。它的旁瓣抑制效果更好，但主瓣较宽（频率分辨率较差）。当旁瓣干扰特别严重时，会使用这种窗。

- 这里存在一个根本性的权衡：频谱泄漏越小的窗，其主瓣就越宽，这意味着它们无法分辨距离很近的两个频率。这就是所谓的“频谱分辨率与泄漏之间的权衡”，这一现象实际上是第03章中所提到的不确定性原理所带来的结果。

- **重叠相加法**是一种从经过加窗处理的帧中重建信号的技术。这些帧会相互重叠（通常重叠率为50-75%），处理完成后，会将所有加窗后的输出值相加。如果窗函数和重叠率选择得当（例如使用汉宁窗且重叠率为50%），那么这些重叠的窗函数叠加后的结果将为常数，从而实现完美的信号重建。这对于任何基于帧的音频处理操作来说都是至关重要的，比如降噪、音高调整、时间拉伸等。

- **短时傅里叶变换**是生成频谱图所依据的正式框架。它会对信号的每一个加窗后的帧应用DFT变换。

$$
\text{STFT}\{x[n]\}(m, k) = \sum_{n=0}^{N-1} x[n + mH] \cdot w[n] \cdot e^{-j 2\pi k n / N}

$$

- 其中，$m$为帧索引，$H$为跳变间隔（相邻帧之间的样本数），$w[n]$为窗函数，$N$为FFT的点数。输出结果是一个二维复值矩阵，即信号的**时频表示**。

- STFT体现了基本的**时频权衡关系**：
- 较长的帧长度（较大的$N$值）：具有较高的频率分辨率（能够区分间距较小的频率），但时间分辨率较低（无法精确判断频率变化的时间点）。
- 较短的帧长度（较小的$N$值）：时间分辨率较高，但频率分辨率较低。
- 时间分辨率与频率分辨率的乘积存在下限：$\Delta t \cdot \Delta f \geq \frac{1}{4\pi}$。这就是**加博尔极限**，它相当于信号处理领域的海森堡不确定性原理。

- 语音信号的典型STFT参数为：帧长为25毫秒（在16 kHz采样率下，$N = 400$），跳变间隔为10毫秒（$H = 160$），使用汉明窗函数，FFT点数为512点（为提高效率并使频谱插值更平滑，会从400点开始补零）。

- **滤波**通过放大某些频率、衰减其他频率来改变信号的频率特性。**滤波器**是一种能够将输入信号转换为输出信号的系统。滤波器的特性由其**频率响应**$H(f)$决定，该参数描述了不同频率所对应的增益和相位偏移情况。

- **低通滤波器**：允许低于截止频率$f_c$的频率通过，而衰减高于该频率的信号。它能去除高频噪声和细节信息。采样前的抗混叠滤波器就是一种低通滤波器。

- **高通滤波器**：允许高于$f_c$的频率通过，而衰减低于该频率的信号。它能去除低频噪声和直流偏移。在MFCC提取过程中使用的预加重滤波器（$y[n] = x[n] - 0.97 x[n-1]$）就是一种简单的高通滤波器。

- **带通滤波器**：允许位于$[f_1, f_2]$范围内的频率通过，衰减该范围之外的频率。梅尔滤波器组中的每个三角形结构都对应一个带通滤波器。

- **带阻滤波器**：用于衰减某个特定的窄频段信号。它可以用来消除特定的干扰信号，比如50/60赫兹的电源线噪声。

- **有限脉冲响应滤波器**（FIR滤波器）通过将当前及过去的输入样本按权重相加来计算输出样本：

$$y[n] = \sum_{k=0}^{M} b_k \cdot x[n-k]$$

- 这些权重$b_k$被称为**滤波器系数**。该滤波器的阶数为$M$。FIR滤波器始终是稳定的（输出不会发散），并且可以设计成具有完全线性的相位特性（所有频率的延迟量相同，从而保持波形形状）。不过，要实现尖锐的截止频率，就需要较多的滤波器系数（较大的$M$值），这会增加计算量。其输出实际上是输入信号与系数向量的卷积结果，这与第06章中介绍的一维卷积操作类似。

- **无限脉冲响应滤波器**（IIR滤波器）则利用反馈机制：输出不仅取决于过去的输入信号，还取决于过去的输出信号。

$$
y[n] = \sum_{k=0}^{M} b_k \cdot x[n-k] - \sum_{k=1}^{L} a_k \cdot y[n-k]

$$

- 反馈项$a_k$构成了一个递归结构，其脉冲响应在理论上具有无限的长度。与FIR滤波器相比，IIR滤波器可以用更少的系数实现更陡峭的截止特性，但它们可能存在不稳定性——如果传递函数的极点位于单位圆之外，输出值就会无限制地增长（这一概念源自$z$变换）。此外，IIR滤波器还存在非线性相位效应，这会扭曲波形形状。经典的滤波器设计类型（巴特沃斯、切比雪夫、椭圆型）都属于IIR滤波器。

- 離散时间滤波器的**传递函数**是通过$z$变换得到的：

$$H(z) = \frac{\sum_{k=0}^{M} b_k z^{-k}}{1 + \sum_{k=1}^{L} a_k z^{-k}}$$

- 分子的根被称为**零点**，分母的根则被称为**极点**。极点与零点的分布情况可以完全决定滤波器的行为特征：靠近单位圆的极点会放大附近的频率信号，而靠近单位圆的零点则会削弱这些频率信号。FIR滤波器只有零点（因为分母为1）。这一概念与第02章和第03章中提到的特征值及根的求解方法相关。

- **卷积定理**：时域中的卷积相当于频域中的逐元素相乘。这意味着，滤波操作可以通过将信号与滤波器的脉冲响应直接进行卷积来实现，或者通过将两者的傅里叶变换相乘后再进行逆变换来完成。对于长度较长的滤波器，采用频域方法（利用FFT）效率更高：时间复杂度为$O(N \log N)$，而直接卷积的方法则为$O(NM)$。

- **逆STFT**（iSTFT）能够根据信号的STFT表示来重建其时域形式。这对于任何需要在频域对音频进行处理的系统来说都是至关重要的，比如降噪、声源分离、语音转换等。这种重建过程采用的是重叠相加法。

$$
x[n] = \frac{\sum_{m} w[n - mH] \cdot \text{IDFT}\{X(m, k)\}[n - mH]}{\sum_{m} w[n - mH]^2}

$$

- 分母值会根据窗口的重叠情况进行调整，这样当合成窗口与分析窗口完全匹配且重叠程度足够时，就能实现完美的信号重建。

- **语音处理的DSP流程概述**：原始音频以16 kHz的频率进行采样，随后经过预增强处理，再被分割成长度为25毫秒、带有汉明窗处理的帧，帧与帧之间的间隔为10毫秒。每个帧都会经过FFT变换，之后通过梅尔滤波器组处理，再进行对数压缩。最终，这些数据要么以对数梅尔特征的形式保留下来（用于神经网络模型），要么经过DCT变换生成MFCC特征（用于传统模型）。整个流程将一维时域信号转换为适合后续机器学习的二维时频表示，这一内容将是文件02的主题。

## 编码任务（可使用CoLab或笔记本完成）

1. 生成正弦波，以不同的采样率对其进行采样，从而展示混叠现象。同时绘制出连续信号、正确采样的版本以及采样率过低而出现混叠的版本。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Parameters
f_signal = 5.0  # 5 Hz signal
duration = 1.0  # 1 second

# "Continuous" signal (very high sample rate)
t_cont = jnp.linspace(0, duration, 10000)
x_cont = jnp.sin(2 * jnp.pi * f_signal * t_cont)

# Properly sampled (fs = 50 Hz, well above Nyquist = 10 Hz)
fs_good = 50
t_good = jnp.arange(0, duration, 1.0 / fs_good)
x_good = jnp.sin(2 * jnp.pi * f_signal * t_good)

# Under-sampled (fs = 7 Hz, below Nyquist = 10 Hz) -> aliasing
fs_bad = 7
t_bad = jnp.arange(0, duration, 1.0 / fs_bad)
x_bad = jnp.sin(2 * jnp.pi * f_signal * t_bad)

# The aliased frequency: |f_signal - fs_bad| = |5 - 7| = 2 Hz
f_alias = abs(f_signal - fs_bad)
x_alias_cont = jnp.sin(2 * jnp.pi * f_alias * t_cont)

fig, axes = plt.subplots(3, 1, figsize=(12, 9))

# Plot 1: original signal
axes[0].plot(t_cont, x_cont, color='#3498db', linewidth=1.5, label=f'Original {f_signal} Hz')
axes[0].set_title(f'Original {f_signal} Hz Signal')
axes[0].set_xlabel('Time (s)'); axes[0].set_ylabel('Amplitude')
axes[0].legend(); axes[0].grid(True, alpha=0.3)

# Plot 2: proper sampling
axes[1].plot(t_cont, x_cont, color='#3498db', linewidth=1, alpha=0.4, label='Original')
axes[1].stem(t_good, x_good, linefmt='#27ae60', markerfmt='o', basefmt='k-',
             label=f'Sampled at {fs_good} Hz (above Nyquist)')
axes[1].set_title(f'Proper Sampling: fs = {fs_good} Hz > 2 x {f_signal} Hz')
axes[1].set_xlabel('Time (s)'); axes[1].set_ylabel('Amplitude')
axes[1].legend(); axes[1].grid(True, alpha=0.3)

# Plot 3: aliased sampling
axes[2].plot(t_cont, x_cont, color='#3498db', linewidth=1, alpha=0.4, label='Original')
axes[2].stem(t_bad, x_bad, linefmt='#e74c3c', markerfmt='o', basefmt='k-',
             label=f'Sampled at {fs_bad} Hz (below Nyquist)')
axes[2].plot(t_cont, x_alias_cont, color='#f39c12', linewidth=1.5, linestyle='--',
             label=f'Aliased signal appears as {f_alias} Hz')
axes[2].set_title(f'Aliased Sampling: fs = {fs_bad} Hz < 2 x {f_signal} Hz')
axes[2].set_xlabel('Time (s)'); axes[2].set_ylabel('Amplitude')
axes[2].legend(); axes[2].grid(True, alpha=0.3)

plt.tight_layout(); plt.show()
```

1. 计算由多个正弦波构成的信号的FFT值并将其可视化。显示幅频谱，从而确定各组成频率。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Create a composite signal: 220 Hz + 440 Hz + 880 Hz (A3 + A4 + A5)
fs = 8000  # 8 kHz sample rate
duration = 0.1  # 100 ms
t = jnp.arange(0, duration, 1.0 / fs)
n_samples = len(t)

# Three frequency components with different amplitudes
x = 1.0 * jnp.sin(2 * jnp.pi * 220 * t) + \
    0.6 * jnp.sin(2 * jnp.pi * 440 * t) + \
    0.3 * jnp.sin(2 * jnp.pi * 880 * t)

# Compute FFT
X = jnp.fft.fft(x)
freqs = jnp.fft.fftfreq(n_samples, d=1.0 / fs)
magnitude = jnp.abs(X) / n_samples  # normalise

# Only plot positive frequencies
pos_mask = freqs >= 0
freqs_pos = freqs[pos_mask]
mag_pos = magnitude[pos_mask] * 2  # double to account for negative freq energy

fig, axes = plt.subplots(2, 1, figsize=(12, 7))

# Time domain
axes[0].plot(t * 1000, x, color='#3498db', linewidth=1)
axes[0].set_title('Composite Signal: 220 Hz + 440 Hz + 880 Hz')
axes[0].set_xlabel('Time (ms)'); axes[0].set_ylabel('Amplitude')
axes[0].grid(True, alpha=0.3)

# Frequency domain
axes[1].plot(freqs_pos, mag_pos, color='#e74c3c', linewidth=1.5)
axes[1].set_title('Magnitude Spectrum (FFT)')
axes[1].set_xlabel('Frequency (Hz)'); axes[1].set_ylabel('Magnitude')
axes[1].set_xlim(0, 1500)
# Annotate peaks
for f_peak, amp in [(220, 1.0), (440, 0.6), (880, 0.3)]:
    axes[1].annotate(f'{f_peak} Hz', xy=(f_peak, amp), fontsize=10,
                     ha='center', va='bottom', color='#9b59b6',
                     arrowprops=dict(arrowstyle='->', color='#9b59b6'))
axes[1].grid(True, alpha=0.3)

plt.tight_layout(); plt.show()
```

1. 使用JAX从零开始构建完整的MFCC处理流程：预加重、分帧、加窗、FFT、梅尔滤波器组、对数变换、DCT。以热图形式展示梅尔滤波器组以及处理后的MFCC数值。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# --- Generate a synthetic speech-like signal ---
key = jax.random.PRNGKey(42)
fs = 16000
duration = 1.0
t = jnp.arange(0, duration, 1.0 / fs)

# Simulate voiced speech: fundamental + harmonics with amplitude decay
f0 = 150.0  # fundamental frequency
x = sum(jnp.sin(2 * jnp.pi * f0 * k * t) / k for k in range(1, 8))
# Add some noise
x = x + 0.1 * jax.random.normal(key, t.shape)
x = x / jnp.max(jnp.abs(x))  # normalise

# --- Step 1: Pre-emphasis ---
alpha = 0.97
x_pre = jnp.concatenate([x[:1], x[1:] - alpha * x[:-1]])

# --- Step 2: Framing ---
frame_len = int(0.025 * fs)   # 25 ms = 400 samples
hop_len = int(0.010 * fs)     # 10 ms = 160 samples
n_frames = (len(x_pre) - frame_len) // hop_len + 1
frames = jnp.stack([x_pre[i * hop_len : i * hop_len + frame_len]
                     for i in range(n_frames)])

# --- Step 3: Hamming window ---
hamming = 0.54 - 0.46 * jnp.cos(2 * jnp.pi * jnp.arange(frame_len) / (frame_len - 1))
windowed = frames * hamming

# --- Step 4: FFT ---
n_fft = 512
spectra = jnp.fft.rfft(windowed, n=n_fft)
power_spectra = jnp.abs(spectra) ** 2 / n_fft

# --- Step 5: Mel filterbank ---
n_mels = 40
f_min, f_max = 0.0, fs / 2.0

def hz_to_mel(f):
    return 2595 * jnp.log10(1 + f / 700)

def mel_to_hz(m):
    return 700 * (10 ** (m / 2595) - 1)

mel_min = hz_to_mel(f_min)
mel_max = hz_to_mel(f_max)
mel_points = jnp.linspace(mel_min, mel_max, n_mels + 2)
hz_points = mel_to_hz(mel_points)

freq_bins = jnp.floor((n_fft + 1) * hz_points / fs).astype(jnp.int32)
n_freqs = n_fft // 2 + 1
filterbank = jnp.zeros((n_mels, n_freqs))

for m in range(n_mels):
    f_left = freq_bins[m]
    f_center = freq_bins[m + 1]
    f_right = freq_bins[m + 2]
    # Rising slope
    for k in range(int(f_left), int(f_center)):
        if f_center != f_left:
            filterbank = filterbank.at[m, k].set((k - f_left) / (f_center - f_left))
    # Falling slope
    for k in range(int(f_center), int(f_right)):
        if f_right != f_center:
            filterbank = filterbank.at[m, k].set((f_right - k) / (f_right - f_center))

# Apply filterbank
mel_spectra = jnp.dot(power_spectra, filterbank.T)

# --- Step 6: Log ---
log_mel = jnp.log(mel_spectra + 1e-10)

# --- Step 7: DCT (type-II) ---
n_mfcc = 13
n_mel_channels = log_mel.shape[1]
dct_matrix = jnp.zeros((n_mfcc, n_mel_channels))
for i in range(n_mfcc):
    for j in range(n_mel_channels):
        dct_matrix = dct_matrix.at[i, j].set(
            jnp.cos(jnp.pi * i * (j + 0.5) / n_mel_channels)
        )
mfccs = jnp.dot(log_mel, dct_matrix.T)

# --- Visualisation ---
fig, axes = plt.subplots(3, 1, figsize=(14, 11))

# Mel filterbank
freq_axis = jnp.linspace(0, fs / 2, n_freqs)
for m in range(n_mels):
    color = '#3498db' if m % 2 == 0 else '#e74c3c'
    axes[0].plot(freq_axis, filterbank[m], color=color, alpha=0.6, linewidth=0.8)
axes[0].set_title(f'Mel Filterbank ({n_mels} filters)')
axes[0].set_xlabel('Frequency (Hz)'); axes[0].set_ylabel('Weight')
axes[0].grid(True, alpha=0.3)

# Log-mel spectrogram
im1 = axes[1].imshow(log_mel.T, aspect='auto', origin='lower',
                      extent=[0, duration, 0, n_mels], cmap='viridis')
axes[1].set_title('Log-Mel Spectrogram')
axes[1].set_xlabel('Time (s)'); axes[1].set_ylabel('Mel Band')
plt.colorbar(im1, ax=axes[1], label='Log Energy')

# MFCCs
im2 = axes[2].imshow(mfccs.T, aspect='auto', origin='lower',
                      extent=[0, duration, 0, n_mfcc], cmap='coolwarm')
axes[2].set_title(f'MFCCs (first {n_mfcc} coefficients)')
axes[2].set_xlabel('Time (s)'); axes[2].set_ylabel('MFCC Index')
plt.colorbar(im2, ax=axes[2], label='Coefficient Value')

plt.tight_layout(); plt.show()
```

1. 实现FIR低通滤波器和高通滤波器，并观察它们对同时包含低频成分和高频成分的信号所产生的影响。需展示时域和频域下的效果。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Create a signal with low (100 Hz) and high (2000 Hz) components
fs = 8000
duration = 0.05  # 50 ms for clear visualisation
t = jnp.arange(0, duration, 1.0 / fs)

x_low = jnp.sin(2 * jnp.pi * 100 * t)
x_high = 0.5 * jnp.sin(2 * jnp.pi * 2000 * t)
x = x_low + x_high

# Design a simple FIR low-pass filter using windowed sinc
def fir_lowpass(cutoff_hz, fs, n_taps=51):
    """Design FIR low-pass filter using windowed sinc method."""
    fc = cutoff_hz / fs  # normalised cutoff
    n = jnp.arange(n_taps)
    mid = (n_taps - 1) / 2.0
    # Sinc function (ideal low-pass impulse response)
    h = jnp.where(n == mid, 2 * fc,
                  jnp.sin(2 * jnp.pi * fc * (n - mid)) / (jnp.pi * (n - mid)))
    # Apply Hamming window
    window = 0.54 - 0.46 * jnp.cos(2 * jnp.pi * n / (n_taps - 1))
    h = h * window
    h = h / jnp.sum(h)  # normalise to unity gain at DC
    return h

def apply_filter(x, h):
    """Apply FIR filter via convolution."""
    return jnp.convolve(x, h, mode='same')

# Low-pass filter at 500 Hz (passes 100 Hz, blocks 2000 Hz)
h_lp = fir_lowpass(500, fs, n_taps=51)
x_lp = apply_filter(x, h_lp)

# High-pass = delta - low-pass (spectral inversion)
delta = jnp.zeros(51)
delta = delta.at[25].set(1.0)
h_hp = delta - h_lp
x_hp = apply_filter(x, h_hp)

# Compute spectra for all signals
def compute_spectrum(signal, fs):
    X = jnp.fft.rfft(signal)
    freqs = jnp.fft.rfftfreq(len(signal), d=1.0 / fs)
    mag = jnp.abs(X) / len(signal) * 2
    return freqs, mag

fig, axes = plt.subplots(3, 2, figsize=(14, 10))

# Time domain plots
for i, (sig, title, color) in enumerate([
    (x, 'Original (100 Hz + 2000 Hz)', '#3498db'),
    (x_lp, 'Low-pass filtered (< 500 Hz)', '#27ae60'),
    (x_hp, 'High-pass filtered (> 500 Hz)', '#e74c3c')
]):
    axes[i, 0].plot(t * 1000, sig[:len(t)], color=color, linewidth=1)
    axes[i, 0].set_title(f'Time Domain: {title}')
    axes[i, 0].set_xlabel('Time (ms)'); axes[i, 0].set_ylabel('Amplitude')
    axes[i, 0].grid(True, alpha=0.3)

# Frequency domain plots
for i, (sig, title, color) in enumerate([
    (x, 'Original', '#3498db'),
    (x_lp, 'Low-pass', '#27ae60'),
    (x_hp, 'High-pass', '#e74c3c')
]):
    freqs, mag = compute_spectrum(sig, fs)
    axes[i, 1].plot(freqs, mag, color=color, linewidth=1.5)
    axes[i, 1].set_title(f'Spectrum: {title}')
    axes[i, 1].set_xlabel('Frequency (Hz)'); axes[i, 1].set_ylabel('Magnitude')
    axes[i, 1].set_xlim(0, 3000)
    axes[i, 1].axvline(x=500, color='#f39c12', linestyle='--', alpha=0.7,
                        label='Cutoff (500 Hz)')
    axes[i, 1].legend(); axes[i, 1].grid(True, alpha=0.3)

plt.tight_layout(); plt.show()
```

## 自动语音识别

_自动语音识别能够将语音音频转换为文字，从而弥合人类语言与机器可读语言之间的差距。本文件涵盖了从传统的处理流程到现代的神经网络架构，包括GMM-HMM模型、CTC损失函数、RNN-Transducer模型、基于注意力机制的编码器-解码器模型（LAS）、Whisper系统以及端到端的自动语音识别技术。_

- **自动语音识别**是指将语音音频转换为文字的任务。这是人工智能领域中最古老的问题之一（最早的系统出现在20世纪50年代，能够识别单个数字），同时它也是应用最广泛的技术之一——被用于语音助手、文本转录服务以及字幕生成等领域。

- 该任务的难点在于语音的巨大差异性：不同的说话者、口音、语速、背景噪音、麦克风特性，再加上将连续的声学信号映射为离散单词时的固有模糊性，都给处理带来了挑战。

- 可以把自动语音识别系统想象成法庭上的速记员。速记员听到连续的声音流后，会在心中将其分割成单词，通过上下文来消除歧义（比如“they’re”、“their”和“there”的区别），然后把结果打出来。自动语音识别系统也是做类似的工作，只不过它的各个处理步骤可以被明确划分出来，并且可以单独优化或共同优化。

- **传统的自动语音识别处理流程**包括多个连续的步骤：首先将原始音频转换为特征值（如MFCC或对数梅尔频谱图，详见文件01）；接着，**声学模型**会评估每个特征帧与各个音素单元的匹配程度；**发音模型**则负责将音素单元映射为具体的单词；**语言模型**则用来评估各种单词序列出现的概率；最后，**解码器**会找出能使总得分最高的单词序列。这些组件都是分别进行训练和调整的。

![从原始音频开始，经过特征提取、声学模型、解码器及语言模型，最终输出文字的自动语音识别处理流程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/asr_pipeline.svg)

- **音素**是构成语言中不同单词的最小声音单位。英语中大约有39到44个音素（具体数量取决于所使用的方言以及音素库）。例如，“bat”和“pat”之间的区别就在于一个音素 /b/ 和 /p/。大多数自动语音识别系统会使用所谓的**三音素**来建模——即一个音素由其左右相邻的音素决定（比如在“b_t”这个语境中的“a”与在“c_t”语境中的“a”是不同的音素），因为一个音素的声学表现会受到其相邻音素的影响（这被称为**协同发音**现象）。

- 可能的三音素组合数量极其庞大（40个音素的三次方等于64,000种组合），因此人们会使用**决策树聚类**技术，将声学特性相似的三音素组合在一起，形成**组元音素**（通常有2000到10,000个类别）。每个组元音素都有对应的声学模型。这种聚类方法实际上就是第06章中介绍的决策树算法的一种应用。

- **GMM-HMM**（高斯混合模型-隐马尔可夫模型）是从20世纪80年代到2010年代初最常用的声学建模方法。隐马尔可夫模型（详见第05章）用于描述语音的时间结构：每个音素都可以看作是一个由3到5个状态构成的隐马尔可夫模型，每个状态代表一个子音段（起始部分、中间部分、结束部分）。状态之间的转换则隐含地体现了语音的持续时间信息。

- 在每个隐马尔可夫状态中，某个特定特征向量出现的概率是通过**高斯混合模型**来建模的——也就是多个多元高斯分布的加权之和（详见第05章）。

$$
p(\mathbf{x} | s) = \sum_{m=1}^{M} w_m \cdot \mathcal{N}(\mathbf{x} ; \boldsymbol{\mu}_m, \boldsymbol{\Sigma}_m)

$$

- 其中，$\mathbf{x}$为特征向量（例如39维的MFCC参数），$s$表示HMM状态，$M$为混合组分的数量（通常为8到64之间），$w_m$为各混合组分的权重，而$\boldsymbol{\mu}_m$、$\boldsymbol{\Sigma}_m$则分别是每个高斯分量的均值和协方差矩阵。为提高计算效率，这些协方差矩阵通常为对角矩阵形式（前提是各特征维度相互独立，对于MFCC参数而言，由于DCT变换的作用，这一前提基本成立）。

- 训练过程采用**Baum-Welch算法**（即EM算法的一种特例，详见第05章），通过已转录的语音数据来迭代估计GMM参数以及HMM的状态转移概率。而解码过程（即确定最可能的状态序列）则使用**Viterbi算法**（动态规划算法，详见第05章）。

$$
\delta_t(j) = \max_{i} \left[ \delta_{t-1}(i) \cdot a_{ij} \right] \cdot b_j(\mathbf{x}_t)

$$

- 其中，$\delta_t(j)$表示在时间$t$时，以状态$j$作为终点的最优路径的概率；$a_{ij}$表示从状态$i$转移到状态$j$的概率；而$b_j(\mathbf{x}_t)$则表示在状态$j$下，特征$\mathbf{x}_t$被输出的概率。

- **DNN-HMM**（Hinton等人，2012年）用深度神经网络取代了GMM的输出模型。该神经网络能够根据一串特征帧来预测后验概率$p(s | \mathbf{x})$。HMM仍然负责处理时间结构和序列关系，而神经网络则能提供更精确的输出概率值。与GMM相比，这种混合方法将单词错误率降低了20-30%，并在2012年至2016年间成为主流技术。

- **WFST解码**（加权有限状态转换器）是传统自动语音识别的标准解码框架。其中的各个组件——HMM结构H、上下文依赖性C、词典L以及语法/语言模型G——都被表示为加权有限状态转换器，这些组件共同构成一个单一的搜索图$H \circ C \circ L \circ G$。Viterbi算法则用于在该搜索图中找到成本最低的路径。WFST使得各种知识源可以以模块化方式组合在一起，同时还能实现高效的动态规划搜索。其数学基础来自有限自动机理论（与第05章中的状态机相关）。

- **端到端自动语音识别**则摒弃了那些独立的组件（发音模型、音素表、WFST解码器），而是训练一个单一的神经网络，该网络可以直接将音频特征转换为字符或词片段。其核心挑战在于**对齐问题**：输入数据（每秒数百个特征帧）与输出结果（每秒仅几个字符）的长度差异极大，而且在训练过程中两者之间的对齐关系也是未知的。

- **连接主义时间分类**（CTC）（Graves等人，2006年）通过引入一种特殊的“空白”令牌来解决对齐问题。该算法允许网络输出任意由字符和空白组成的序列，只要将这些序列中的连续重复项合并并去除空白后，得到的结果就是正确的转录文本。例如，文本“cat”就可以通过序列“--cc-aa-t--”来表示（其中“-”代表空白）。

- 从形式上讲，CTC定义了一个从所有长度为$T$的输出序列集合到标签序列集合的多对一映射$\mathcal{B}$。某个标签序列$\mathbf{y}$的概率，就是所有能够映射到该序列的对齐方式的总和：

$$P(\mathbf{y} | \mathbf{x}) = \sum_{\boldsymbol{\pi} \in \mathcal{B}^{-1}(\mathbf{y})} \prod_{t=1}^{T} p(\pi_t | \mathbf{x})$$

![CTC对齐示意图：通过空白令牌和字符标记存在多种可能的路径，但最终都会得到相同的输出文本](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/ctc_alignment.svg)

- 如果直接计算这个总和，就需要枚举指数级多的对齐方式，但**CTC前后向算法**可以利用动态规划技术在$O(T \cdot |\mathbf{y}|)$的时间复杂度内高效地计算出结果，这一方法与第05章中的HMM前后向算法类似。

- CTC假设**条件独立性**：即给定输入后，每个时间步的输出与其他所有输出都是独立的。这意味着CTC无法建模输出之间的依赖关系（例如，它无法识别出“q”之后几乎总是跟着“u”出现）。因此，需要借助外部的语言模型来处理这类依赖关系。

- **CTC解码**的几种方法：
- **贪婪解码**：在每个时间步选择概率最高的令牌，然后再进行合并。这种方法速度快，但结果并非最优。
- **束搜索**：在每一步保留排名前$k$的候选序列，同时合并那些最终会得到相同前缀的候选序列。该方法还可以结合语言模型的评分结果。
- **前缀束搜索**：这是一种经过改进的束搜索方法，能够正确处理CTC中的空白令牌合并问题，确保在合并后再对候选序列进行比较。

- **RNN-Transducer**（RNN-T）（Graves，2012年）在CTC的基础上进一步发展，它加入了一个明确的**预测网络**（类似于语言模型的RNN结构），该网络会根据之前的输出来决定当前的输出，从而打破了条件独立性的假设。RNN-T由三个部分组成：
- **编码器**：负责处理音频特征，生成隐藏表示$\mathbf{h}_t^\text{enc}$（通常是由LSTM或Conformer层构成的结构）。
- **预测网络**：是一种自回归RNN，它能够根据之前生成的标签来生成新的隐藏表示$\mathbf{h}_u^\text{pred}$。
- **联合网络**：在每个（时间，标签）位置上，将编码器和预测网络的输出结合起来，从而生成下一个令牌的概率分布（包括空白令牌）：

$$p(y | t, u) = \text{softmax}(W \cdot \text{tanh}(W_\text{enc} \mathbf{h}_t^\text{enc} + W_\text{pred} \mathbf{h}_u^\text{pred} + b))$$

- RNN-T在每个时间步可以输出零个或多个令牌——要么在进入下一个时间步之前输出非空白令牌，要么输出空白令牌以跳过当前步骤而不产生输出。其训练过程采用在二维（时间，标签）网格上的前后向算法，时间复杂度为$O(T \cdot U)$，其中$U$为输出序列的长度。由于RNN-T天然支持流式处理，因此成为设备端流式自动语音识别的主流架构（被谷歌的Pixel手机及类似产品所采用）：编码器从左到右处理音频，而预测网络则逐步生成输出结果。
- **Listen, Attend and Spell**（LAS）（Chan等人，2016年）是一种基于注意力机制的编码器-解码器模型（即第06章中介绍的序列到序列架构）。它由三个部分组成：
- **监听器**（编码器）：一种金字塔形的双向LSTM结构，用于处理完整的输入序列，并通过每层合并连续的隐藏状态对来将序列长度缩小8倍，从而得到更短的编码器隐藏状态序列。
- **注意力机制**：在解码的每一步中，该机制会计算所有编码器状态的注意力权重，进而生成上下文向量（与第07章中介绍的注意力机制相同）。
- **拼写器**（解码器）：一种自回归LSTM结构，它根据上下文向量以及之前已生成的字符，逐个字符地生成输出文本。

- LAS能够取得不错的识别效果，但由于需要在解码前获取完整的音频内容（因为注意力机制需要考虑所有的编码器状态），因此不适合用于流式应用。此外，对于过长的音频序列，注意力机制的效果也会下降，因为长序列上的注意力分配会变得不那么精准。

- **Conformer**（Gulati等人，2020年）结合了卷积的局部模式捕捉能力与自注意力的全局依赖建模能力。每个Conformer模块都采用“三明治”结构，包含四个模块：

1. **前馈模块**（半步）：一种带有残差连接的前馈网络，使用的残差权重为原来的一半。
2. **多头自注意力模块**：标准Transformer自注意力机制（来自第07章），并加入了相对位置编码。
3. **卷积模块**：包括点积卷积、门控线性单元（GLU）、一维深度卷积、批量归一化、Swish激活函数，以及另一个点积卷积。深度卷积用于捕捉局部上下文信息（类似于特征序列上的n-gram结构）。
4. **前馈模块**（半步）：与模块1结构相同。

- 输出结果为：$\mathbf{y} = \text{LayerNorm}(\mathbf{x} + \frac{1}{2}\text{FFN}_1 + \text{MHSA} + \text{Conv} + \frac{1}{2}\text{FFN}_2)$。经验表明，这种“FFN-注意力-卷积-FFN”的结构，再加上半步残差连接，其性能优于其他结构。目前，Conformer已成为CTC和RNN-T系统中的默认编码器，其性能优于纯Transformer编码器和纯LSTM编码器。

![Conformer模块的“三明治”结构示意图，包含前馈模块、自注意力模块、卷积模块以及前馈模块](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/conformer_block.svg)

- **Whisper**（Radford等人，2023年）是OpenAI开发的一种大规模、基于注意力机制的语音识别模型。它采用标准的编码器-解码器Transformer架构（来自第07章），并在从互联网上收集的68万小时的弱监督数据上进行训练，这些数据包含音频文件及其对应的近似转录文本。其主要设计特点如下：
- 输入：80通道的对数梅尔频谱图，窗口大小为25毫秒，步长为10毫秒，经过归一化处理，使其均值为0，方差为1。
- 编码器：标准的Transformer编码器，采用正弦函数作为位置编码，并对预激活层进行归一化处理。
- 解码器：Transformer解码器，利用字节级的BPE分词器自回归地生成文本 token（来自第07章）。
- 多任务处理：同一个模型可以同时完成转录、翻译、语言识别以及时间戳预测等功能，具体功能由解码器输入中的特殊任务令牌来决定。
- Whisper之所以能在不同领域、不同口音及不同语言上表现出色，主要得益于庞大的训练数据量，而非架构上的创新。

- **wav2vec 2.0**（Baevski等人，2020年）是一种用于语音表示的**自我监督**预训练框架。其核心思想是从大量无标签的音频数据中学习语音表示，然后再用少量有标签的数据进行微调。这一方法与BERT所采用的自我监督思路类似（来自第07章），但适用于连续音频信号。

- wav2vec 2.0的架构由三部分组成：
- **特征编码器**：一种多层一维CNN结构，用于处理原始波形样本，以20毫秒的帧率生成潜在表示$\mathbf{z}_t$（在16kHz采样率下，每320个样本对应一个向量）。
- **量化模块**：通过**乘积量化**技术将潜在表示转换为有限的代码本形式——即将向量分成若干组，分别对每组进行量化，每个代码本包含$V$个元素，共有$G$个这样的代码本。这样就可以得到用于对比学习的目标值$\mathbf{q}_t$。
- **上下文网络**：一种Transformer编码器，它接收经过部分掩码处理的潜在表示，进而生成具有上下文信息的表示$\mathbf{c}_t$。

![wav2vec 2.0的架构示意图，包括CNN特征编码器、掩码处理、Transformer上下文网络以及基于量化目标的对比学习过程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/wav2vec2_pretraining.svg)

- 在预训练过程中，潜在表示中的某些部分会被**随机掩码**（替换为经过学习的掩码嵌入），模型需要从一组干扰项中识别出被掩码位置的真实量化表示——这些干扰项是从同一音频序列的其他位置中选取的。对比损失公式如下：

$$\mathcal{L} = -\log \frac{\exp(\text{sim}(\mathbf{c}_t, \mathbf{q}_t) / \kappa)}{\sum_{\tilde{\mathbf{q}} \in Q_t} \exp(\text{sim}(\mathbf{c}_t, \tilde{\mathbf{q}}) / \kappa)}$$

其中，$\text{sim}$表示余弦相似度，$\kappa$是温度参数，$Q_t$则包含真实的量化目标以及各种干扰项。此外，还有一种**多样性损失**，旨在确保所有代码本中的元素都能被均匀使用。这种损失实际上就是InfoNCE对比损失，属于与视觉自我监督学习中使用的相同类型的对比损失机制。

- 在预训练之后，会在模型上添加线性投影层和CTC头，然后利用带标签的数据对模型进行微调。wav2vec 2.0仅使用10分钟的带标签数据（预训练则使用了53,000小时的未标记音频），就取得了接近当前最佳水平的识别效果，这充分体现了自监督学习在资源匮乏的语音识别任务中的强大作用。

- **HuBERT**（Hsu等人，2021年）是另一种自监督学习方法，它用**掩码预测**目标来替代对比学习目标（即预测被掩码的音频帧应属于哪个类别）。这些目标是通过离线聚类步骤生成的——第一轮是对MFCC特征进行k均值聚类，后续轮次则是对HuBERT特征进行k均值聚类。与wav2vec 2.0相比，HuBERT的训练流程更为简单（无需量化模块或对比采样），且能取得相当甚至更好的识别效果。

- **Fast Conformer**（Rekesh等人，2023年，NVIDIA NeMo框架）将标准Conformer模型中的二次自注意力机制替换为**下采样注意力**机制：在计算注意力之前，先对输入序列进行压缩（通常通过步长为8的卷积操作），然后再将其扩展回来。这样一来，注意力计算的成本从$O(T^2)$降低到了$O(T^2/64)$，同时仍能保留全局上下文信息，因此可以处理长度达数分钟的音频序列而不会出现内存问题。Fast Conformer是NVIDIA NeMo工具箱中的默认编码器，也是其生产级模型的核心组成部分。

- **Parakeet**（NVIDIA，2024年）是一系列高精度的英语语音识别模型，它们基于Fast Conformer编码器构建，并搭配CTC和RNN-T解码器，训练数据量为64,000小时的英语语音。在发布时，这些模型（参数量分别为0.6B和1.1B）在各类标准测试集上的词错误率均处于最低水平，其性能甚至超过了Whisper large-v3模型。其成功的关键在于高效的Fast Conformer架构、强大的数据增强技术（如SpecAugment、速度扰动、噪声混合），以及大规模的监督训练数据——这表明，通过对现有组件的精心设计，依然可以不断提升识别性能。

- **Canary**（NVIDIA，2024年）将NeMo框架扩展到了多语言、多任务的语音识别场景。它同样采用Fast Conformer编码器，但解码器基于注意力机制而非CTC或RNN-T；该模型能够在同一个框架内同时完成转录和多种语言的翻译任务（类似于Whisper的多任务设计，但采用了更高效的Fast Conformer架构）。Canary模型能够以出色的准确率处理英语、德语、西班牙语和法语等语言。

- **Moonshine**（Useful Sensors，2024年）是一系列专为**设备端和边缘计算环境**设计的语音识别模型。其编码器采用混合架构，用小型CNN层替代了最初的Transformer/Conformer层，再接几层Transformer层，从而大幅降低了模型规模（基础模型的参数量不到30M）。Moonshine旨在在CPU及低功耗设备上实现实时语音处理，因为对于这类设备来说，Whisper模型体积过大且处理速度过慢；为此，该模型在牺牲一定准确率的前提下，将延迟和内存占用降低了5-10倍。

- **Distil-Whisper**（Gandhi等人，2023年）采用了**知识蒸馏**技术（见第06章），将Whisper模型压缩为体积更小、处理速度更快的模型。该模型的解码器仅有2层（而Whisper有32层），但编码器部分则保持不变，同时经过训练以匹配Whisper的输出分布。Distil-Whisper的词错误率仅比Whisper高1%左右，但处理速度却是后者的6倍，因此非常适合那些无法使用完整Whisper模型的实时应用场景。

- **通用语音模型（USM）**（Zhang等人，2023年，Google公司）将自监督预训练的范围扩展到了300多种语言的1200万小时未标记音频数据，之后再进行监督微调。USM证明了wav2vec 2.0/自监督学习范式确实适用于海量数据场景，即使在标注数据极为有限的条件下，也能在低资源语言上实现出色的识别性能。

- **大规模多语言语音模型（MMS）**（Pratap等人，2023年，Meta公司）则利用宗教录音及其他多语言音频资源，将wav2vec 2.0的预训练范围扩展到了1,100多种语言。MMS覆盖的语言种类远远超过以往的任何语音识别系统，使得许多原本缺乏足够训练数据的语言也能实现语音识别功能。

- 当前现代语音识别技术的发展趋势可归纳为几种主流模式：(1) 用于实时处理的Conformer系列编码器，搭配CTC或RNN-T解码器；(2) 用于离线处理或多任务处理的编码器-解码器型Transformer模型；(3) 用于资源匮乏场景的自监督预训练方法；(4) 数据规模与模型规模的扩大——更多的数据和更大的模型始终有助于提升识别精度。具体选择哪种方案取决于应用场景的限制因素，如延迟要求、可用计算资源、需要支持的语言数量，以及应用是实时处理还是批量处理。

- **语言模型集成**通过引入语音模型所无法捕捉的语言学知识，从而提升语音识别的性能。其基本思路是在解码过程中，将语音模型给出的得分$p(\mathbf{x} | \mathbf{y})$（即音频与文本转录结果的匹配程度）与语言模型给出的得分$p(\mathbf{y})$（即某段文本作为句子的合理性）结合起来使用。

- **浅层融合**是在波束搜索阶段将这两种得分相加：

$$\hat{\mathbf{y}} = \arg\max_\mathbf{y} \left[ \log p_\text{AM}(\mathbf{y} | \mathbf{x}) + \lambda \log p_\text{LM}(\mathbf{y}) \right]$$

其中$\lambda$是一个可调参数，$p_\text{LM}$则是外部语言模型（通常是第07章中提到的n-gram模型或神经网络语言模型）。这种方法的实现简单且效果良好，但要求语言模型使用与语音识别模型相同的词汇表。

- **深层融合**（Gulcehre等人，2015年）则将语言模型直接整合到解码器网络中：语言模型的隐藏状态会与解码器的隐藏状态相连接，然后通过门控机制处理，之后再进行输出生成。整个系统（包括预训练好的语言模型）会一起进行微调。这种方法可以实现更深度的整合，但训练难度也更大。
- **冷聚变”技术**（Sriram等人，2018年）与深度融合技术类似，但它是从头开始训练ASR解码器，并将语言模型整合其中，而非对预训练的解码器进行微调。这样一来，声学模型就需要学习那些语言模型尚未掌握的信息，而不是重复已有的信息。

- **重新评分”技术**（N最佳重排法）是一种两阶段处理方式：首先通过束搜索生成$N$个候选转录文本，然后再利用更强大的语言模型（如大型变换器语言模型）对这些候选文本进行重新排序。这种方法的实现较为简单，而且允许使用那些在第一步解码过程中会导致处理速度过慢的庞大语言模型。

- **内部语言模型估计”技术**旨在解决一个潜在问题：端到端模型会在训练过程中隐式地学习出一个内部语言模型，而在浅层融合模式下，这个内部模型可能会与外部语言模型产生冲突（实际上相当于重复计算了语言相关的先验信息）。ILME技术会估算出这个内部语言模型，并在融合过程中将其贡献的分数减去：

$$\hat{\mathbf{y}} = \arg\max_\mathbf{y} \left[ \log p_\text{E2E}(\mathbf{y} | \mathbf{x}) - \beta \log p_\text{ILM}(\mathbf{y}) + \lambda \log p_\text{LM}(\mathbf{y}) \right]$$

- **流式ASR与离线ASR**是两种根本不同的架构选择。离线（或批量）ASR会在生成任何输出之前先处理完整的音频内容。而流式ASR则会在音频数据逐段到达时立即生成输出，因此具有较低的延迟。

- 对于实时应用来说，流式处理至关重要：比如实时字幕生成、语音助手（用户希望在说完话后立即得到回应）、电话通话转录等。不过，有些未来的上下文信息对于语音识别非常重要（例如，知道下一个词是“York”就能帮助区分“New”和“York”这两个词），但流式系统无法等待过长的时间来获取这些信息。

- **单向编码器**（从左到右的LSTM、因果卷积、因果变换器）天然适合流式处理，因为它们的输出仅依赖于过去的和当前的输入信息。而双向编码器则需要考虑未来的上下文信息，因此无法直接用于流式处理。

- **分块注意力机制**（也称为块状或分段注意力机制）会将输入数据分割成固定长度的块，然后仅在每个块内部应用自注意力机制（有时也会考虑前几个块的信息）。这样一来，系统的延迟就由块的大小加上处理时间决定，同时每个块内仍然可以保留一定的局部双向上下文信息。不过，块的大小越小，系统的识别精度就会下降。

- **前瞻机制**允许流式编码器在为当前帧生成输出之前，先查看少量未来的帧数据（例如300-900毫秒内的数据）。这一功能是通过在单向计算过程中加入少量未来上下文信息来实现的。虽然前瞻机制会增加一些延迟，但却能显著提升识别精度。

- 流式ASR中的延迟包含多个组成部分：
- **算法延迟**：从音频数据到达开始到模型能够开始处理它为止的延迟时间，这一时间取决于块的大小、前瞻范围以及特征提取的效率。
- **计算延迟**：模型执行前向传播所需的时间。
- **结束令牌检测延迟**：检测用户是否已经结束说话的延迟时间。
- **第一个词出现延迟**：系统能够输出第一个词所需的延迟时间。**最终输出确认延迟**：系统能够确定最终输出结果所需的延迟时间。在流式系统中，通常会先生成临时输出，随后随着更多音频数据的到来再对输出进行修正。

- ASR系统的评估指标包括：

- **词错误率**是主要的评估指标。其计算方法是利用编辑距离——即将假设输出与参考转录文本转换成彼此所需的最少替换、插入和删除操作次数——来对两者进行对齐，然后计算出词错误率：

$$\text{WER} = \frac{S + D + I}{N}$$

其中，$S$表示替换次数，$D$表示删除次数，$I$表示插入次数，$N$则是参考转录文本中的总词数。如果插入操作过多，词错误率可能会超过100%。对于清晰的语音而言，5%的词错误率大致相当于人类水平的识别效果；而对于对话式或嘈杂环境下的语音，识别难度要大得多，词错误率通常在10-20%以上。

- **字符错误率**则是用相同的公式来计算，只不过是在字符层面而非词层面进行计算。对于那些没有明确词界的分隔的语言（如汉语、日语），字符错误率能提供更有用的信息。此外，它还可以用来判断相似词之间的差异程度——例如，“cat”和“bat”的词错误率为100%，但字符错误率仅为33%。

- **丢失的词信息量**和**保留的词信息量**是两种基于信息论的评估指标，它们比词错误率能更精确地反映参考文本与假设输出之间的关联，不过这类指标的使用频率相对较低。

- **实时性因子**用于衡量系统的计算效率，即处理时间与音频时长之比。如果实时性因子小于1，说明系统的处理速度快于实时处理速度；反之，则说明系统无法跟上实时音频的节奏。流式系统必须确保实时性因子始终小于1。

- **数据增强**对于提升ASR系统的稳定性非常重要。常见的数据增强技术包括：
- **速度扰动**：以0.9倍或1.1倍的速度重新采样音频，从而改变音频的音调和时长。
- **SpecAugment**技术（Park等人，2019年）：在频谱图中随机遮盖某些频率带和时间点。这项技术类似于深度学习中的丢弃机制，是ASR领域中最有效的正则化技术之一，而且不需要额外的数据。
- **噪声增强**：将清晰的语音与不同信噪比下的噪声混合在一起。
- **房间声学响应模拟**：将清晰的语音与模拟出的房间声学特性相叠加，以此模拟混响环境中的语音传输情况。
- 在自动语音识别中，**分词方式**决定了模型的输出词汇表。常见的分词方式包括：
- **字符级分词**：较为简单，词汇表规模较小（英语约30个字符），但生成的输出序列较长，且不支持隐式的语言建模。
- **子词级分词/BPE**（详见第07章）：通过子词单元来平衡词汇表规模与输出序列长度，是现代系统中的标准做法（Whisper采用字节级的BPE分词方式，词汇表规模约为50,000个单元）。
- **单词级分词**：词汇表规模较大（50,000个以上），生成的输出序列较短，但无法处理那些不在词汇表中的单词。
- **音素级分词**：基于语言学原理，结构紧凑，但需要相应的发音词典。

- 自动语音识别技术的发展历程可以概括为：从依赖复杂模块结构的系统（如GMM-HMM结合WFST解码技术，1990年代至2010年代），发展到混合系统（DNN-HMM，2012年至2016年）；再进一步发展为端到端系统，将越来越多的处理步骤整合到单个神经网络中（CTC、RNN-T、LAS，2016年至2020年）；最终形成能够利用大量未标注或弱标注数据的大规模预训练模型（wav2vec 2.0、Whisper，2020年至今）。每一次技术进步都在简化实现流程的同时提升识别精度，这符合机器学习领域从手动设计特征到从数据中学习特征的总体发展趋势（第06章讲述了图像特征被CNN取代的过程，第07章则介绍了自然语言处理特征被变换器取代的情况）。

## 编程任务（可使用CoLab或笔记本完成）

1. 使用JAX从零实现CTC损失函数。创建一个简单的示例，包含一段短的逻辑值序列以及对应的目标标签，运用CTC前向算法计算总概率，进而求出负对数似然损失值。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def ctc_forward(log_probs, targets):
    """
    CTC forward algorithm (log-domain for numerical stability).
    log_probs: (T, V) log probabilities over vocabulary (index 0 = blank)
    targets: (U,) target label indices (no blanks)
    Returns: log probability of the target sequence under CTC.
    """
    T, V = log_probs.shape
    U = len(targets)

    # Build the extended label sequence with blanks: [blank, y1, blank, y2, ..., yU, blank]
    S = 2 * U + 1
    labels = jnp.zeros(S, dtype=jnp.int32)  # all blanks
    for i in range(U):
        labels = labels.at[2 * i + 1].set(targets[i])

    # Initialise alpha (log domain)
    NEG_INF = -1e30
    alpha = jnp.full((T, S), NEG_INF)
    alpha = alpha.at[0, 0].set(log_probs[0, labels[0]])        # start with blank
    alpha = alpha.at[0, 1].set(log_probs[0, labels[1]])        # or first label

    # Fill forward
    for t in range(1, T):
        for s in range(S):
            # Same state
            a = alpha[t - 1, s]
            # From previous state
            if s > 0:
                a = jnp.logaddexp(a, alpha[t - 1, s - 1])
            # Skip blank (if current and two-back labels are different)
            if s > 1 and labels[s] != 0 and labels[s] != labels[s - 2]:
                a = jnp.logaddexp(a, alpha[t - 1, s - 2])
            alpha = alpha.at[t, s].set(a + log_probs[t, labels[s]])

    # Total log probability: sum of last two states at final time step
    log_prob = jnp.logaddexp(alpha[T - 1, S - 1], alpha[T - 1, S - 2])
    return log_prob, alpha

# --- Toy example ---
T = 12   # input length (time steps)
V = 5    # vocab size (0=blank, 1='c', 2='a', 3='t', 4='x')
targets = jnp.array([1, 2, 3])  # "c", "a", "t"

# Create random logits and convert to log-probabilities
key = jax.random.PRNGKey(42)
logits = jax.random.normal(key, (T, V))
log_probs = jax.nn.log_softmax(logits, axis=-1)

log_prob, alpha = ctc_forward(log_probs, targets)
ctc_loss = -log_prob

print(f"Target sequence: {targets.tolist()} ('c', 'a', 't')")
print(f"Input length T={T}, Vocab size V={V}")
print(f"CTC log-probability: {log_prob:.4f}")
print(f"CTC loss (neg log-prob): {ctc_loss:.4f}")

# Visualise the forward variable (alpha) lattice
fig, ax = plt.subplots(figsize=(12, 5))
# Convert from log to linear for visualisation
alpha_linear = jnp.exp(alpha - jnp.max(alpha))  # normalise for visibility
im = ax.imshow(alpha_linear.T, aspect='auto', origin='lower', cmap='viridis')
ax.set_xlabel('Time step (t)')
ax.set_ylabel('Extended label index (s)')

label_names = ['_', 'c', '_', 'a', '_', 't', '_']  # _ = blank
ax.set_yticks(range(len(label_names)))
ax.set_yticklabels(label_names)
ax.set_title(f'CTC Forward Variable (alpha lattice) | Loss = {ctc_loss:.2f}')
plt.colorbar(im, ax=ax, label='Normalised probability')
plt.tight_layout(); plt.show()
```

1. 使用JAX构建一个简单的、基于注意力机制的编解码器式ASR模型（一种类似LAS的最简架构）。该模型包含一个一维卷积编码器以及一个采用点积注意力机制的单层解码器。在合成数据上运行该模型，并可视化注意力权重。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# --- Minimal attention-based encoder-decoder for ASR ---

def init_params(key, input_dim, hidden_dim, vocab_size):
    """Initialise parameters for a tiny LAS-like model."""
    keys = jax.random.split(key, 8)
    scale = 0.1
    params = {
        # Encoder: simple linear projection (simulating conv output)
        'enc_w': jax.random.normal(keys[0], (input_dim, hidden_dim)) * scale,
        'enc_b': jnp.zeros(hidden_dim),
        # Attention: query, key, value projections
        'attn_q': jax.random.normal(keys[1], (hidden_dim, hidden_dim)) * scale,
        'attn_k': jax.random.normal(keys[2], (hidden_dim, hidden_dim)) * scale,
        'attn_v': jax.random.normal(keys[3], (hidden_dim, hidden_dim)) * scale,
        # Decoder RNN (simple Elman RNN for illustration)
        'dec_wh': jax.random.normal(keys[4], (hidden_dim, hidden_dim)) * scale,
        'dec_wx': jax.random.normal(keys[5], (vocab_size, hidden_dim)) * scale,
        'dec_wc': jax.random.normal(keys[6], (hidden_dim, hidden_dim)) * scale,
        'dec_b': jnp.zeros(hidden_dim),
        # Output projection
        'out_w': jax.random.normal(keys[7], (hidden_dim, vocab_size)) * scale,
        'out_b': jnp.zeros(vocab_size),
    }
    return params

def encode(params, x):
    """Encoder: linear projection (placeholder for conv/LSTM stack)."""
    return jnp.tanh(x @ params['enc_w'] + params['enc_b'])

def attend(params, query, enc_out):
    """Dot-product attention over encoder outputs."""
    q = query @ params['attn_q']                   # (hidden,)
    k = enc_out @ params['attn_k']                 # (T_enc, hidden)
    v = enc_out @ params['attn_v']                 # (T_enc, hidden)
    d_k = q.shape[-1]
    scores = (k @ q) / jnp.sqrt(d_k)              # (T_enc,)
    weights = jax.nn.softmax(scores)               # (T_enc,)
    context = weights @ v                          # (hidden,)
    return context, weights

def decode_step(params, h_prev, y_prev_onehot, enc_out):
    """Single decoder step: RNN + attention."""
    # Embed previous token
    y_emb = y_prev_onehot @ params['dec_wx']       # (hidden,)
    # Attend to encoder
    context, attn_w = attend(params, h_prev, enc_out)
    # RNN update
    h = jnp.tanh(h_prev @ params['dec_wh'] + y_emb + context @ params['dec_wc']
                  + params['dec_b'])
    # Output logits
    logits = h @ params['out_w'] + params['out_b']
    return h, logits, attn_w

# --- Setup ---
key = jax.random.PRNGKey(0)
input_dim = 40       # e.g., 40 mel bands
hidden_dim = 64
vocab_size = 10      # small vocab for demo
T_enc = 30           # encoder time steps
T_dec = 8            # decoder steps

params = init_params(key, input_dim, hidden_dim, vocab_size)

# Synthetic input: random mel-like features
key, subkey = jax.random.split(key)
x = jax.random.normal(subkey, (T_enc, input_dim))

# Encode
enc_out = encode(params, x)

# Decode (teacher forcing with random targets)
key, subkey = jax.random.split(key)
targets = jax.random.randint(subkey, (T_dec,), 0, vocab_size)

h = jnp.zeros(hidden_dim)
all_logits = []
all_attn = []

for t in range(T_dec):
    y_prev = jax.nn.one_hot(targets[t] if t > 0 else 0, vocab_size)
    h, logits, attn_w = decode_step(params, h, y_prev, enc_out)
    all_logits.append(logits)
    all_attn.append(attn_w)

all_attn = jnp.stack(all_attn)  # (T_dec, T_enc)
all_logits = jnp.stack(all_logits)  # (T_dec, vocab_size)

# --- Visualise attention weights ---
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

im = axes[0].imshow(all_attn, aspect='auto', cmap='Blues', origin='lower')
axes[0].set_xlabel('Encoder time step')
axes[0].set_ylabel('Decoder step')
axes[0].set_title('Attention Weights (decoder -> encoder)')
plt.colorbar(im, ax=axes[0])

# Show predicted token distribution for each decoder step
im2 = axes[1].imshow(jax.nn.softmax(all_logits, axis=-1), aspect='auto',
                      cmap='Oranges', origin='lower')
axes[1].set_xlabel('Vocabulary index')
axes[1].set_ylabel('Decoder step')
axes[1].set_title('Output Token Probabilities')
plt.colorbar(im2, ax=axes[1])

plt.suptitle('Minimal Attention-based ASR Model (untrained)')
plt.tight_layout(); plt.show()
```

1. 使用动态规划（编辑距离）从零开始计算词错误率（WER），并对比多个假设与参考值的差异。同时可视化编辑距离矩阵。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
import numpy as np

def compute_wer(reference, hypothesis):
    """
    Compute WER using dynamic programming (Levenshtein distance on words).
    Returns WER, number of substitutions, deletions, insertions, and the DP matrix.
    """
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    N = len(ref_words)
    M = len(hyp_words)

    # DP matrix: d[i][j] = edit distance between ref[:i] and hyp[:j]
    d = np.zeros((N + 1, M + 1), dtype=np.int32)
    # Backtrack matrix to count S, D, I
    ops = np.zeros((N + 1, M + 1, 3), dtype=np.int32)  # [sub, del, ins]

    for i in range(N + 1):
        d[i][0] = i  # all deletions
    for j in range(M + 1):
        d[0][j] = j  # all insertions

    for i in range(1, N + 1):
        for j in range(1, M + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                sub_cost = d[i - 1][j - 1]  # match, no edit
            else:
                sub_cost = d[i - 1][j - 1] + 1  # substitution
            del_cost = d[i - 1][j] + 1      # deletion
            ins_cost = d[i][j - 1] + 1      # insertion

            d[i][j] = min(sub_cost, del_cost, ins_cost)

    # Backtrack to count operations
    i, j = N, M
    S, D, I = 0, 0, 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i-1][j-1] and ref_words[i-1] == hyp_words[j-1]:
            i -= 1; j -= 1  # correct
        elif i > 0 and j > 0 and d[i][j] == d[i-1][j-1] + 1:
            S += 1; i -= 1; j -= 1  # substitution
        elif i > 0 and d[i][j] == d[i-1][j] + 1:
            D += 1; i -= 1  # deletion
        elif j > 0 and d[i][j] == d[i][j-1] + 1:
            I += 1; j -= 1  # insertion
        else:
            break

    wer = (S + D + I) / N if N > 0 else 0.0
    return wer, S, D, I, d

# --- Test cases ---
reference = "the cat sat on the mat"
hypotheses = [
    "the cat sat on the mat",          # perfect
    "the cat sit on the mat",          # 1 substitution
    "the cat on the mat",              # 1 deletion
    "the big cat sat on the mat",      # 1 insertion
    "a dog sat in a rug",              # multiple errors
]

print(f"Reference: '{reference}'\n")
print(f"{'Hypothesis':<40s} {'WER':>6s} {'S':>3s} {'D':>3s} {'I':>3s}")
print("-" * 60)
results = []
for hyp in hypotheses:
    wer, S, D, I, dp = compute_wer(reference, hyp)
    results.append((hyp, wer, S, D, I, dp))
    print(f"'{hyp}':<40s} {wer:>6.1%} {S:>3d} {D:>3d} {I:>3d}")

# Visualise the DP matrix for the worst case
worst = results[-1]
hyp_words = worst[0].split()
ref_words = reference.split()
dp_matrix = worst[5]

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# DP matrix
im = axes[0].imshow(dp_matrix, cmap='YlOrRd', origin='upper')
axes[0].set_xticks(range(len(hyp_words) + 1))
axes[0].set_xticklabels([''] + hyp_words, rotation=45, ha='right', fontsize=9)
axes[0].set_yticks(range(len(ref_words) + 1))
axes[0].set_yticklabels([''] + ref_words, fontsize=9)
axes[0].set_xlabel('Hypothesis words')
axes[0].set_ylabel('Reference words')
axes[0].set_title(f'Edit Distance Matrix\nWER = {worst[1]:.1%}')
for i in range(dp_matrix.shape[0]):
    for j in range(dp_matrix.shape[1]):
        axes[0].text(j, i, str(dp_matrix[i, j]), ha='center', va='center', fontsize=8)
plt.colorbar(im, ax=axes[0])

# WER comparison bar chart
names = [f'Hyp {i+1}' for i in range(len(results))]
wers = [r[1] * 100 for r in results]
colors = ['#27ae60' if w == 0 else '#f39c12' if w < 30 else '#e74c3c' for w in wers]
axes[1].barh(names, wers, color=colors)
axes[1].set_xlabel('WER (%)')
axes[1].set_title('Word Error Rate Comparison')
for i, (w, r) in enumerate(zip(wers, results)):
    axes[1].text(w + 1, i, f'{w:.0f}% (S={r[2]}, D={r[3]}, I={r[4]})',
                 va='center', fontsize=9)
axes[1].set_xlim(0, max(wers) * 1.4)

plt.tight_layout(); plt.show()
```

1. 对对数梅尔频谱图应用SpecAugment技术（频率掩蔽和时间掩蔽），并展示原始频谱图与处理后的频谱图。同时，还需要从合成信号中生成频谱图。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# --- Generate synthetic log-mel spectrogram ---
key = jax.random.PRNGKey(42)
fs = 16000
duration = 2.0
t = jnp.arange(0, duration, 1.0 / fs)

# Simulate speech: chirp signal with harmonics
f0 = 120.0
x = sum(jnp.sin(2 * jnp.pi * f0 * k * t * (1 + 0.1 * t)) / k for k in range(1, 10))
key, subkey = jax.random.split(key)
x = x + 0.05 * jax.random.normal(subkey, t.shape)

# Compute log-mel spectrogram (simplified)
frame_len = 400  # 25 ms
hop_len = 160    # 10 ms
n_fft = 512
n_mels = 80

n_frames = (len(x) - frame_len) // hop_len + 1
hamming = 0.54 - 0.46 * jnp.cos(2 * jnp.pi * jnp.arange(frame_len) / (frame_len - 1))

frames = jnp.stack([x[i * hop_len : i * hop_len + frame_len] for i in range(n_frames)])
windowed = frames * hamming
spectra = jnp.abs(jnp.fft.rfft(windowed, n=n_fft)) ** 2

# Simple mel filterbank
def hz_to_mel(f): return 2595 * jnp.log10(1 + f / 700)
def mel_to_hz(m): return 700 * (10 ** (m / 2595) - 1)

mel_points = jnp.linspace(hz_to_mel(0), hz_to_mel(fs / 2), n_mels + 2)
hz_pts = mel_to_hz(mel_points)
bins = jnp.floor((n_fft + 1) * hz_pts / fs).astype(jnp.int32)

n_freqs = n_fft // 2 + 1
fb = jnp.zeros((n_mels, n_freqs))
for m in range(n_mels):
    lo, mid, hi = int(bins[m]), int(bins[m+1]), int(bins[m+2])
    for k in range(lo, mid):
        if mid != lo:
            fb = fb.at[m, k].set((k - lo) / (mid - lo))
    for k in range(mid, hi):
        if hi != mid:
            fb = fb.at[m, k].set((hi - k) / (hi - mid))

log_mel = jnp.log(spectra @ fb.T + 1e-10)

# --- SpecAugment ---
def spec_augment(spec, key, n_freq_masks=2, freq_mask_width=15,
                 n_time_masks=2, time_mask_width=25):
    """Apply SpecAugment: frequency and time masking."""
    augmented = spec.copy()
    T, F = spec.shape

    # Frequency masking
    for _ in range(n_freq_masks):
        key, k1, k2 = jax.random.split(key, 3)
        f_width = jax.random.randint(k1, (), 1, freq_mask_width + 1)
        f_start = jax.random.randint(k2, (), 0, max(1, F - freq_mask_width))
        mask = (jnp.arange(F) >= f_start) & (jnp.arange(F) < f_start + f_width)
        augmented = jnp.where(mask[None, :], 0.0, augmented)

    # Time masking
    for _ in range(n_time_masks):
        key, k1, k2 = jax.random.split(key, 3)
        t_width = jax.random.randint(k1, (), 1, time_mask_width + 1)
        t_start = jax.random.randint(k2, (), 0, max(1, T - time_mask_width))
        mask = (jnp.arange(T) >= t_start) & (jnp.arange(T) < t_start + t_width)
        augmented = jnp.where(mask[:, None], 0.0, augmented)

    return augmented

key, subkey = jax.random.split(key)
log_mel_aug = spec_augment(log_mel, subkey)

# --- Visualise ---
fig, axes = plt.subplots(2, 1, figsize=(14, 8))

im0 = axes[0].imshow(log_mel.T, aspect='auto', origin='lower', cmap='inferno',
                       extent=[0, duration, 0, n_mels])
axes[0].set_title('Original Log-Mel Spectrogram')
axes[0].set_xlabel('Time (s)'); axes[0].set_ylabel('Mel Band')
plt.colorbar(im0, ax=axes[0], label='Log Energy')

im1 = axes[1].imshow(log_mel_aug.T, aspect='auto', origin='lower', cmap='inferno',
                       extent=[0, duration, 0, n_mels])
axes[1].set_title('After SpecAugment (frequency + time masking)')
axes[1].set_xlabel('Time (s)'); axes[1].set_ylabel('Mel Band')
plt.colorbar(im1, ax=axes[1], label='Log Energy')

plt.tight_layout(); plt.show()
```

## 文本转语音与语音技术

_文本转语音合成技术逆转了ASR流程，能够从书面文本生成自然流畅的音频。本文涵盖了TTS流程（文本规范化、G2P、声学模型、声码器）、Tacotron、WaveNet、HiFi-GAN、语音克隆、语音转换以及语音活动检测（VAD）。_

- 在文件01中，我们构建了信号处理工具包：波形、频谱图、梅尔滤波器组和MFCC。在文件02中，我们将语音转换为文本。现在我们将流程逆转：给定文本，合成自然流畅的语音。这就是**文本转语音（TTS）**，它也为语音转换、语音克隆和语音活动检测打开了大门。

- 可以把TTS想象成一场舞台表演。剧本就是输入的文本。导演（声学模型）决定每一行台词的声音效果、音高、节奏和重音。乐团（声码器）则根据乐谱演奏，产生观众听到的实际声波。现代神经TTS系统用堪比人类发音者的表现，取代了基于规则的系统那种生硬、机械的发音方式。

![TTS流程：文本经过规范化处理，转换为音素，再由声学模型生成梅尔频谱图，最后通过声码器生成最终波形](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/tts_pipeline.svg)

- **文本转语音流程**：标准的TTS流程分为四个阶段：（1）文本规范化，（2）音素转换，（3）声学模型，（4）声码器。一些现代系统将第3步和第4步合并为一个端到端模型，但这种概念上的拆分仍然很有用处。

- **文本规范化**将原始文本转换为可发音的形式。缩写会被展开（“Dr.”变为“Doctor”），数字会转为单词（“1984”变为“nineteen eighty-four”），货币符号会被表述出来（“$5”变为“five dollars”），URL或特殊字符也会被妥善处理。这一阶段通常基于特定语言的语法规则，不过也存在神经规范化模型。此处的错误会影响到后续所有阶段：如果“St.”被误读为“saint”而非“street”，整个语句就会出错。

- **字形到音素（G2P）转换**将规范化后的文本映射为音素序列。英语的拼写规则极为不规则（“though”、“through”、“tough”中“ough”的发音各不相同），因此常用词典查询（如CMU发音词典）来处理常见词汇，而神经序列到序列模型（第06章介绍的编码器-解码器或第07章的Transformer）则用于处理词典外的词汇。正字法较简单的语言（如西班牙语、芬兰语）所需的G2P转换更为简单。输出通常是国际音标（IPA）序列或等效的内部音素集。

- **声学模型**接收音素序列并生成中间声学表示，几乎总是**梅尔频谱图**（见文件01）。梅尔频谱图捕捉每个时间帧内的频谱包络，其中包含了声码器重建波形所需的感觉相关信息。声学模型必须确定时序（每个音素的持续时间）、音高（基频$F_0$）以及能量（响度）。

- **声码器**利用梅尔频谱图生成原始音频波形。这是一个不适定的逆问题：由于相位信息被丢弃，许多波形可以产生相同的频谱图。传统的声码器（如Griffin-Lim、WORLD）采用迭代或信号模型方法，但如今神经声码器在音质上占据主导地位。

- **声码器：WaveNet**（van den Oord等人，2016年）是首个能生成与人类录音几乎无法区分的语音的神经声码器。它采用自回归方式建模波形，根据所有先前样本来预测每个样本$x_t$：

$$P(x) = \prod_{t=1}^{T} P(x_t \mid x_1, \ldots, x_{t-1}, c)$$

- 其中$c$为条件信号（梅尔频谱图）。每个样本为16位，因此对65536个取值直接应用softmax是不现实的。WaveNet采用**μ律压缩**将量化级别减少到256级，后续变体则使用逻辑斯蒂混合分布。

- WaveNet的核心构件是**膨胀因果卷积**。所谓因果性，是指滤波器权重只参考过去样本（不会涉及未来数据）；所谓膨胀，是指滤波器以指数级递增的间隔跳过样本：膨胀因子为$1, 2, 4, 8, \ldots, 512$。这种方式在参数数量保持线性的同时，获得了指数级增大的感受野。

- 每层的门控激活函数为：

$$z = \tanh(W_{f} \ast x) \odot \sigma(W_{g} \ast x)$$

- 其中$W_f$和$W_g$分别为滤波器和门控卷积权重，$\ast$表示膨胀因果卷积，$\odot$为逐元素相乘。这种门控机制（源自第06章介绍的LSTM）使网络能够控制信息流。

- WaveNet的音质卓越，但推理速度极慢：生成一秒24 kHz音频需要24000次连续前向传播。这推动了此后所有声码器研究的发展。

- **WaveRNN**（Kalchbrenner等人，2018年）用单层循环神经网络取代了WaveNet的深度卷积结构。它将每个16位样本拆分为粗码部分（高8位）和细码部分（低8位），分别用GRU（第06章介绍）进行预测。这种双softmax方法大幅减少了计算量，同时保持了高质量。经过精心优化的内核，WaveRNN足以在移动CPU上实现实时处理。

- **WaveGlow**（Prenger等人，2019年）是一种**基于流**的声码器，完全避免了自回归生成过程。它利用一系列可逆变换（仿射耦合层，即第06章介绍的正则化流）将简单的高斯分布映射到波形分布。训练时利用变量变换公式来最大化精确对数似然：

$$\log P(x) = \log P(z) + \sum_{i} \log \left| \det \frac{\partial f_i}{\partial f_{i-1}} \right|$$

- 其中 $z = f(x)$ 是将 $x$ 输入流模型后得到的潜变量。在推理阶段，抽取一个样本 $z \sim \mathcal{N}(0, I)$，并通过反向流模型一次性并行处理。WaveGlow用较大的模型尺寸（用于耦合层的庞大网络）来换取更快的生成速度。

- **HiFi-GAN**（Kong等人，2020年）利用**生成对抗网络**从梅尔频谱图合成波形。生成器通过一系列转置卷积对梅尔频谱图进行上采样，每个转置卷积之后都接有一个**多感受野融合（MRF）**模块。MRF模块并行应用多个具有不同核大小和膨胀率的残差块，然后将它们的输出相加。这使得生成器能够同时捕捉多个时间尺度上的模式。

![HiFi-GAN生成器架构：梅尔频谱图输入经过转置卷积上采样层，每层之后均接有多感受野融合模块，这些模块将具有不同膨胀模式的并行残差堆叠组合在一起](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/hifi_gan_generator.svg)

- HiFi-GAN使用两种类型的判别器。**多周期判别器（MPD）**通过将一维波形以不同周期（2、3、5、7、11）折叠成二维形式，再应用二维卷积，从而捕捉不同基频下的周期性结构。**多尺度判别器（MSD）**则对原始波形、2倍下采样版本以及4倍下采样版本进行处理，以捕捉不同时间分辨率下的模式。

- 训练目标结合了对抗损失、**梅尔频谱图重建损失**（合成音频与真实音频的梅尔频谱图之间的L1距离）以及**特征匹配损失**（判别器中间特征之间的L1距离）：

$$\mathcal{L}_G = \mathcal{L}_{\text{adv}}(G) + \lambda_{\text{mel}} \mathcal{L}_{\text{mel}}(G) + \lambda_{\text{fm}} \mathcal{L}_{\text{fm}}(G)$$

- HiFi-GAN的合成质量可与WaveNet相媲美，但速度却快了1000倍以上，因此能够在单张GPU上实现实时生成。

- **神经源滤波（NSF）模型**将传统信号处理与神经网络相结合。在经典的源滤波模型中，浊音语音是由声源激励（基频为$F_0$的周期性脉冲序列）经过声道滤波器（频谱包络）产生的。NSF模型用神经网络取代手工设计的滤波器，同时保留显式的声源信号。输入的$F_0$轮廓提供了精细的音高控制能力，而纯数据驱动的声码器有时难以实现这一点。

- **声学模型：Tacotron**（Wang等人，2017年）是首个端到端的神经TTS系统，可直接将字符序列转换为梅尔频谱图。它采用带注意力机制的编码器-解码器架构（详见第07章）。编码器通过卷积层、高速网络和双向GRU处理字符/音素序列。解码器是一个自回归GRU，每次预测一帧梅尔谱，输入为前一帧及注意力上下文。

- **Tacotron 2**（Shen等人，2018年）对该架构进行了显著改进。编码器由三层一维卷积层组成，随后接双向LSTM（详见第06章）。解码器是两层LSTM，采用**位置敏感注意力机制**，该机制不仅依据编码器输出和解码器状态，还参考前几步累积的注意力权重来调整注意力分布。这避免了注意力机制中常见的跳过或重复词语的现象。

![Tacotron 2架构：包含卷积层和BiLSTM的字符/音素编码器，用于对齐梅尔频谱图帧的位置敏感注意力机制，以及带有停止令牌预测的自回归解码器](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/tacotron2_architecture.svg)

- 在解码步骤$i$时，编码器位置$j$处的位置敏感注意力能量为：

$$e_{i,j} = w^T \tanh(W_s s_{i-1} + W_h h_j + W_f f_{i,j} + b)$$

- 其中$s_{i-1}$为前一个解码器状态，$h_j$为编码器在位置$j$的输出，$f_{i,j}$是通过将累积注意力权重$\sum_{k<i} \alpha_{k,j}$与一维卷积滤波器卷积得到的位置特征。注意力权重为$\alpha_{i,j} = \text{softmax}(e_{i,j})$。

- Tacotron 2的解码器还在每一步预测一个**停止令牌**概率，用以指示梅尔频谱图何时生成完毕。生成的梅尔频谱图随后被送入声码器（最初为WaveNet，后来被HiFi-GAN或类似模型取代）。

- Tacotron 2的自回归特性决定了合成速度受限于梅尔帧的数量。对于典型的每秒80帧的梅尔频谱图而言，一段5秒的语音需要经历400个连续的解码步骤。

- **FastSpeech**（Ren等人，2019年）通过采用**非自回归**声学模型解决了速度问题。FastSpeech并非顺序生成梅尔帧，而是并行生成所有帧。关键挑战在于确定每个音素应产生多少梅尔帧，FastSpeech通过**时长预测器**来解决这一问题。

- 时长预测器是一个小型卷积网络，用于预测每个音素的整数时长（即梅尔帧数）。训练时，真实时长从预训练的自回归教师模型（Tacotron 2）的注意力对齐结果中提取。推理时，预测的时长被用来通过**长度调节器**将音素级的隐藏序列扩展到帧级：该调节器只需将每个音素的隐藏表示重复预定次数即可。

- **FastSpeech 2**（Ren等人，2021年）在FastSpeech的基础上去除了教师-学生蒸馏过程。它直接利用强制对齐技术（来自文件02中的声学模型框架）提取真实时长，并额外加入了针对音高（$F_0$）和能量的显式**方差适配器**。每个适配器都是小型卷积预测器，其输出会作为解码器的输入条件。

$$
\begin{aligned}
\hat{d}_i &= \text{DurationPredictor}(h_i) \\
\hat{p}_i &= \text{PitchPredictor}(h_i) \\
\hat{e}_i &= \text{EnergyPredictor}(h_i)
\end{aligned}

$$

- 其中$h_i$表示音素$i$对应的编码器隐藏状态。训练时使用真实值；推理时，预测值可实现对韵律的精确控制。这种可控性是FastSpeech 2的主要优势：调整音调、速度或能量就像缩放预测器输出一样简单。

- FastSpeech 2在推理时的速度通常比Tacotron 2快10到20倍，且能避免诸如单词跳过、重复以及注意力崩溃等常见的自回归模型故障模式。

- **VITS**（Kim等人，2021年）是一种**端到端**的TTS模型，可直接从文本生成波形，无需单独的声码器阶段。VITS将条件变分自编码器（第06章）与归一化流及对抗训练相结合。后验编码器将真实的梅尔频谱图映射到潜空间，先验编码器则通过基于Transformer的文本编码器和时长预测器将音素映射到同一潜空间，而解码器（基于HiFi-GAN）则从潜变量中生成波形。

- VITS的训练目标包括：
- **重建损失**：VAE迫使潜分布编码声学信息；
- **KL散度**：使文本条件的先验与音频条件的后验保持一致；
- **对抗损失**：判别器确保波形质量；
- **时长损失**：用于训练随机时长预测器。

- VITS的生成质量优于两阶段系统（FastSpeech 2 + HiFi-GAN），因为声学模型与声码器是联合优化的，避免了两阶段系统中预测值与真实梅尔频谱图之间的不匹配问题，而这种不匹配会降低合成质量。

- **VALL-E**（Wang等人，2023年）将TTS彻底重新定义为基于离散音频令牌的语言建模问题。它使用神经音频编解码器（EnCodec）将语音表示为来自多个码本层的离散代码序列。给定文本提示以及一段3秒的注册语音（同样被编码为离散令牌），VALL-E利用Transformer语言模型以自回归方式预测音频令牌。

- VALL-E采用两个模型：一个**自回归（AR）模型**逐词生成第一码本层的令牌；另一个**非自回归（NAR）模型**则在第一码本层的基础上并行预测其余码本层，各层之间互相依赖。这种编解码器语言模型方法实现了出色的零样本语音克隆能力：仅需3秒的样本即可复现说话人的声音、音色甚至情感语调。

- **StyleTTS**（Li等人，2022年）和**StyleTTS 2**将语音分解为内容成分与风格成分。风格编码器从参考音频中提取风格向量，捕捉说话人身份、韵律及录音条件等信息。推理时，风格可从学习到的先验分布中采样，或从参考语音中迁移而来。StyleTTS 2采用扩散模型（第08章）作为风格先验，能够生成多样且自然的韵律。

- **Kokoro**（2024年）是一款轻量级、高质量的开源TTS模型，其参数规模仅约8200万，却具备令人惊叹的自然度。它采用了受StyleTTS 2启发的架构，配备基于扩散模型的风格先验，以及经过微调的ISTFTNet声码器，可直接预测STFT系数（参见文件01），而非原始波形样本。尽管其规模仅为VALL-E等模型的一小部分，Kokoro在英语、日语、法语、韩语和中文中都能达到接近人类的自然度，证明了精心挑选的训练数据与高效的架构设计足以与大规模模型相媲美。Kokoro体积小巧，非常适合本地及边缘设备部署。

- **Orpheus**（Canopy Labs，2025年）是一系列基于VALL-E开创的**编解码器语言模型**范式构建的开源TTS模型（参数规模为10亿和30亿）。Orpheus进一步创新，采用LLM骨干网络（微调后的Llama 3）直接生成SNAC音频编解码器令牌。其突出特点是具有类人的情感表达能力：它能以极高的自然度处理笑声、叹息、犹豫以及带有情感的韵律。在输入文本中，可通过`[laugh]`或`[sigh]`等标签对副语言表达进行精细控制。

- **Dia**（Nari Labs，2025年）是一款开源对话式TTS模型，能从单一文本转录中生成逼真的多说话人对话。该模型基于16亿参数的编码器-解码器Transformer架构，能够处理对话中的轮流发言、不同说话人的声音特征以及非言语线索（如笑声、停顿）。它还支持通过短音频提示进行语音克隆，从而实现对话场景下的零样本说话人生成。

- **Sesame CSM**（对话语音模型，2025年）专注于自然的多轮对话语音合成。与传统的朗读式TTS优化方向不同，Sesame模型模拟真实对话的动态特征：诸如“嗯哼”之类的回应、打断现象、说话人之间的节奏变化以及情感响应等。该模型以Transformer为骨干，根据对话上下文（文本与音频历史）进行调整，生成的语音能随对话流程改变其风格。

- **Fish Speech**（Fish Audio，2024年）是一款开源TTS系统，采用双自回归架构：大型语言模型从文本中生成语义令牌，较小的模型将其转化为VQGAN声学令牌，再由声码器解码为波形。Fish Speech支持利用10至15秒的参考音频进行零样本语音克隆，且延迟极低，适合实时应用。其模块化设计允许独立替换组件（例如不同的声码器）。
- **ChatTTS**（2024年发布）是一款开源的对话式TTS模型，专为聊天机器人和虚拟助手等对话应用设计。它利用嵌入在文本输入中的特殊令牌，生成自然且富有对话感的语音，并能对韵律特征（如笑声、停顿、填充词）进行精细控制。ChatTTS支持中英文混合合成以及多说话人生成。

- **Bark**（Suno公司，2023年发布）是一款基于Transformer的开源模型，能够根据文本提示生成语音、音乐和音效。它采用三阶段流水线结构：文本 → 语义令牌 → 粗略声学令牌 → 精细声学令牌，支持语音克隆、多语言合成以及音乐和环境音等非语音音频生成。Bark的通用性是以可控性为代价换来的——虽然它不如专用TTS系统精确，但更加灵活。

- **Parler-TTS**（Hugging Face，2024年发布）采用**自然语言描述**的方式进行语音控制：用户无需提供参考音频片段来设定风格，只需给出类似“一位声音温暖、富有表现力的女性说话者，在安静的房间里讲话”的文本描述即可。Parler-TTS的训练数据包含带有自然语言描述的语音样本，每个语句都与对应的说话风格描述配对，从而无需参考音频就能实现直观控制。

- **Neuphonic**是一款基于API的TTS平台，专为超低延迟语音合成优化，适用于实时语音代理和对话式AI应用。通过流式架构，它在完整输入文本就绪前就开始生成音频，从而使首段音频的生成时间低于100毫秒。Neuphonic侧重于部署与延迟优化层面，而非开发新型模型架构，为现代神经TTS提供生产级基础设施。

- **KittenTTS**是一款小巧、快速的TTS模型，专为高效性和低资源环境部署而设计。它优先考虑极低的延迟和较小的模型尺寸，以适应边缘设备和嵌入式应用，为此会适当牺牲部分自然度，以在CPU和移动设备上实现实时性能。

- 现代TTS领域正分为两种范式：(1) **编解码语言模型**（如VALL-E、Orpheus、Fish Speech），将语音生成视为对离散音频代码的下一个令牌预测，充分利用大语言模型的扩展规律；(2) **基于流/扩散的模型**（如VITS、StyleTTS 2、Kokoro），通过迭代细化生成连续的梅尔频谱图或波形。编解码语言模型在零样本克隆和表现力方面表现突出；基于流/扩散的模型则往往体积更小、速度更快。两者都在迅速向人类水平的自然度靠拢。

- **韵律建模**用于控制语音的“音乐性”：包括音高、时长、能量、节奏和语调。如果韵律处理不当，即使单个音素清晰，合成语音也会显得平淡且机械。可以把韵律理解为单调的GPS语音与富有表现力的有声书朗读者之间的区别。

- **音高**（基频$F_0$）决定了语音听起来是高还是低。疑问句的结尾音高上升，陈述句的结尾音高下降，而在情感丰富的语音中音高会持续变化。$F_0$可通过CREPE（一种神经音高追踪器）或YIN（基于自相关的算法，详见文件01）等算法从音频中提取。在TTS中，音高要么由声学模型预测（如FastSpeech 2的音高预测器），要么被隐式学习（如Tacotron 2）。

- **时长**决定了语速和节奏。重读音节较长，功能词较短，停顿则标示短语边界。在非自回归模型中（如FastSpeech），时长建模是显式的；而在自回归模型中（如Tacotron），时长则由注意力对齐机制隐式决定。

- **能量**（响度）承载着重音信息。“我没说‘他’偷了它”与“我没说他‘偷了’它”这两句话的含义完全依靠能量模式来区分。

- **风格嵌入**用于捕捉更高层次的韵律模式。**全局风格令牌（GST）**框架（Wang等人，2018年）学习一组风格令牌（通过对已学嵌入向量集的软性注意力机制），用以表示“兴奋”、“悲伤”或“耳语”等说话风格。风格嵌入从参考语句中提取，并叠加到编码器输出上，从而在推理阶段实现风格迁移。

- **语音转换（VC）**能在保留语言内容的同时改变语句的说话人身份。想象一下，你录制自己的声音，但输出结果听起来像某个特定的目标说话人。语音转换需要将说话人身份与内容分离。

![语音转换流程：源语音被分解为内容表征和说话人嵌入，用目标说话人嵌入替换源嵌入，再由解码器以目标声音重建语音](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/voice_conversion_pipeline.svg)

- **说话人嵌入**（详见文件04）将说话人身份编码为一个固定维度的向量。这些嵌入可来自预训练的说话人验证模型（如x-vectors、ECAPA-TDNN）。在语音转换中，源语音被编码成与说话人无关的内容表征，随后再用目标说话人嵌入进行解码。

- **解耦表征**将语音拆分为独立的因素：内容（音素）、说话人身份、音高和节奏。常用方法包括：
- **信息瓶颈**：将内容表征压缩到极致，以至于说话人信息丢失（如AutoVC）；
- **对抗训练**：在内容表征上训练说话人分类器，并利用梯度反转层去除说话人信息；
- **矢量量化**：VQ-VAE迫使内容通过离散瓶颈，自然剥离说话人身份（因为码本条目代表音素类别，而非说话人特征）。
- **语音克隆**能够以目标说话人的声音合成语音。**多说话人TTS**利用多位说话人的数据训练模型，并通过说话人嵌入来约束模型。在推理阶段，从注册音频中提取新说话人的嵌入，用以指导语音生成。

- **少样本语音克隆**仅需少量数据（几分钟）即可适应新说话人。说话人编码器从注册音频中提取嵌入，TTS模型则基于该嵌入生成语音。SV2TTS（Jia等人，2018年）采用的就是这种方法：使用单独训练的说话人编码器、以说话人嵌入为条件的Tacotron 2合成器，以及WaveRNN声码器。

- **零样本语音克隆**完全无需适配：短短几秒（3–30秒）的音频就足够了。VALL-E通过将注册音频视为语言模型的提示来实现这一点。由于该模型在大规模多说话人数据上训练，语音一致性是统计上的常态，因此它能学会以同一声音继续生成语音。

- **语音活动检测（VAD）**在每个时间帧中回答一个简单的二元问题：是否有人正在说话？尽管原理简单，VAD却是ASR（文件02）、说话人分离（文件04）和降噪（文件05）的关键预处理步骤。优秀的VAD能跳过静音部分以减少计算量，同时避免将噪声误判为语音，从而提高准确性。

- 传统的VAD依靠能量阈值（语音比静音更响）、过零率（语音具有特定的交叉模式）以及频谱特征来判断。但在信噪比低的嘈杂环境中，这些方法会失效。

- **神经VAD**将这一问题视为帧级二元分类任务。小型RNN或CNN接收声学特征（来自文件01的对数梅尔能量），并预测语音/非语音的概率。

- **WebRTC VAD**（谷歌开发）是一种经典且轻量的VAD算法，它基于简单频谱特征使用GMM分类器。它有四种灵敏度级别（0–3），运行速度极快，但在处理音乐、非语音声响以及低信噪比环境时表现不佳。由于其无需依赖任何外部库，仍被广泛用作基准方案。

- **Silero VAD**（Silero团队，2021年）是目前生产环境中事实上的标准神经VAD。其架构由一系列深度可分离一维卷积层组成（借鉴了第08章中MobileNet的设计思路应用于音频处理），随后是一个用于捕捉时序信息的LSTM层，最后通过线性层输出每帧的语音概率。整个模型大小不到2MB（约100万个参数），能以30–100毫秒的块处理音频。
- **输入**：原始的16 kHz音频（无需手动提取特征——卷积前端会直接从波形中学习特征）。
- **带状态的窗口化推理**：LSTM隐藏状态会在不同数据块之间传递，因此模型能够处理流式音频而无需重新处理全部历史数据。每次调用可处理30、60或100毫秒的音频块，并返回$[0, 1]$范围内的语音概率。
- **自适应阈值机制**：Silero VAD并非使用单一固定阈值，而是分别设定起始和结束阈值，并规定最短语音/静音持续时间，以防止在嘈杂边界处频繁切换状态。语音段必须持续超过起始阈值一定时间才会被确认，而静音段必须低于结束阈值一段时间才会被判定为结束。
- **性能表现**：Silero VAD在CPU上的实时处理速率达到1–2%（处理1秒音频仅需约10–20毫秒），非常适合边缘设备、手机及实时处理流程。它在嘈杂或含大量音乐的音频中表现明显优于WebRTC VAD，同时体积小巧，便于在设备上部署。
- Silero VAD常被用作Whisper（文件02）的前端，用于在转录前将长音频切分为语句级别的片段；也用于说话人分离流程（文件04），以便在提取说话人嵌入前先识别出语音区域。

- **声学活动检测（AAD）**是对VAD的扩展，能够检测任何声学活动，而不仅仅是语音。它在智能家居设备、安防系统以及野生动物监测中十分有用。AAD模型可以识别玻璃破碎、狗叫或警报声等事件，通常采用文件04中描述的音频分类框架来实现。

- **TTS评估指标**用于衡量客观质量和主观自然度：
- **平均意见得分（MOS）**：人类听众按1–5分制评价语音的自然程度。虽是黄金标准，但成本高且耗时久。
- **梅尔倒谱失真（MCD）**：衡量合成语音与参考语音之间梅尔倒谱的距离。数值越低越好，但不一定与感知结果一致。
- **PESQ / POLQA**：最初为电话通信设计的标准化感知评估指标。
- **说话人相似度**：合成语音与参考语音的说话人嵌入之间的余弦相似度（对语音克隆尤为重要）。
- **可懂度**：将合成语音输入ASR系统（文件02）并计算词错误率来衡量。

## 编程任务（请使用CoLab或笔记本）

- **任务1：基于梅尔频谱图的Griffin-Lim声码器。** 实现Griffin-Lim迭代相位重建算法，将梅尔频谱图还原为波形。这有助于理解声码器问题以及为何需要神经声码器。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Generate a synthetic waveform (sum of harmonics simulating a vowel)
sr = 16000
duration = 1.0
t = jnp.linspace(0, duration, int(sr * duration))
f0 = 220.0  # fundamental frequency
waveform = (
    0.6 * jnp.sin(2 * jnp.pi * f0 * t) +
    0.3 * jnp.sin(2 * jnp.pi * 2 * f0 * t) +
    0.1 * jnp.sin(2 * jnp.pi * 3 * f0 * t)
)

# Compute STFT
n_fft = 1024
hop_length = 256
window = jnp.hanning(n_fft)

def stft(signal, n_fft, hop_length, window):
    """Compute Short-Time Fourier Transform."""
    n_frames = 1 + (len(signal) - n_fft) // hop_length
    frames = jnp.stack([
        signal[i * hop_length : i * hop_length + n_fft] * window
        for i in range(n_frames)
    ])
    return jnp.fft.rfft(frames, n=n_fft)

def istft(stft_matrix, hop_length, window, length):
    """Compute inverse STFT with overlap-add."""
    n_fft = (stft_matrix.shape[1] - 1) * 2
    n_frames = stft_matrix.shape[0]
    frames = jnp.fft.irfft(stft_matrix, n=n_fft)
    frames = frames * window[None, :]
    output = jnp.zeros(length)
    for i in range(n_frames):
        start = i * hop_length
        end = start + n_fft
        if end <= length:
            output = output.at[start:end].add(frames[i])
    return output

# Forward STFT
S = stft(waveform, n_fft, hop_length, window)
magnitude = jnp.abs(S)

# Mel filterbank
n_mels = 80
mel_low = 0.0
mel_high = 2595 * jnp.log10(1 + (sr / 2) / 700)
mel_points = jnp.linspace(mel_low, mel_high, n_mels + 2)
hz_points = 700 * (10 ** (mel_points / 2595) - 1)
freq_bins = jnp.floor((n_fft + 1) * hz_points / sr).astype(int)

mel_filterbank = jnp.zeros((n_mels, n_fft // 2 + 1))
for m in range(n_mels):
    f_left = freq_bins[m]
    f_center = freq_bins[m + 1]
    f_right = freq_bins[m + 2]
    for k in range(f_left, f_center):
        mel_filterbank = mel_filterbank.at[m, k].set(
            (k - f_left) / max(f_center - f_left, 1)
        )
    for k in range(f_center, f_right):
        mel_filterbank = mel_filterbank.at[m, k].set(
            (f_right - k) / max(f_right - f_center, 1)
        )

# To mel and back (pseudo-inverse)
mel_spec = magnitude @ mel_filterbank.T
magnitude_reconstructed = mel_spec @ jnp.linalg.pinv(mel_filterbank.T)
magnitude_reconstructed = jnp.maximum(magnitude_reconstructed, 1e-7)

# Griffin-Lim algorithm
def griffin_lim(magnitude, n_iter, hop_length, window, signal_length):
    """Iterative phase reconstruction."""
    n_fft = (magnitude.shape[1] - 1) * 2
    key = jax.random.PRNGKey(42)
    phase = jax.random.uniform(key, magnitude.shape, minval=-jnp.pi, maxval=jnp.pi)

    for _ in range(n_iter):
        complex_spec = magnitude * jnp.exp(1j * phase)
        signal = istft(complex_spec, hop_length, window, signal_length)
        reanalysis = stft(signal, n_fft, hop_length, window)
        phase = jnp.angle(reanalysis)

    complex_spec = magnitude * jnp.exp(1j * phase)
    return istft(complex_spec, hop_length, window, signal_length)

reconstructed = griffin_lim(magnitude_reconstructed, n_iter=60, hop_length=hop_length,
                            window=window, signal_length=len(waveform))

# Plot comparison
fig, axes = plt.subplots(3, 1, figsize=(12, 8))

axes[0].plot(t[:1000], waveform[:1000], color='#3498db', linewidth=0.8)
axes[0].set_title('Original Waveform')
axes[0].set_ylabel('Amplitude')

axes[1].imshow(jnp.log1p(mel_spec.T), aspect='auto', origin='lower', cmap='magma')
axes[1].set_title('Mel Spectrogram (intermediate representation)')
axes[1].set_ylabel('Mel bin')

axes[2].plot(t[:1000], reconstructed[:1000], color='#e74c3c', linewidth=0.8)
axes[2].set_title('Griffin-Lim Reconstructed Waveform (60 iterations)')
axes[2].set_xlabel('Time (s)')
axes[2].set_ylabel('Amplitude')

plt.tight_layout()
plt.show()

# Measure reconstruction error
mse = jnp.mean((waveform[:len(reconstructed)] - reconstructed[:len(waveform)]) ** 2)
print(f"MSE between original and reconstructed: {mse:.6f}")
print("Note: phase information loss through mel inversion causes artifacts.")
```

- **任务2：时长预测器（FastSpeech风格）**。训练一个小型卷积时长预测器，将音素嵌入映射到对应的时长。这是实现非自回归TTS的核心组件。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Simulate phoneme sequences with ground-truth durations
# In real TTS, durations come from forced alignment or teacher attention
def generate_synthetic_data(key, n_samples=200, max_phonemes=30, embed_dim=64):
    """Generate synthetic phoneme embeddings and durations."""
    keys = jr.split(key, 4)
    lengths = jr.randint(keys[0], (n_samples,), 5, max_phonemes)

    all_embeddings = []
    all_durations = []
    all_masks = []

    for i in range(n_samples):
        L = int(lengths[i])
        emb = jr.normal(keys[1], (max_phonemes, embed_dim))
        # Durations: vowels (even indices) are longer, consonants shorter
        base_dur = jnp.where(jnp.arange(max_phonemes) % 2 == 0, 8.0, 4.0)
        noise = jr.normal(jr.fold_in(keys[2], i), (max_phonemes,)) * 1.5
        dur = jnp.clip(base_dur + noise, 1.0, 20.0).astype(jnp.float32)
        mask = (jnp.arange(max_phonemes) < L).astype(jnp.float32)

        all_embeddings.append(emb)
        all_durations.append(dur * mask)
        all_masks.append(mask)

    return (jnp.stack(all_embeddings), jnp.stack(all_durations),
            jnp.stack(all_masks))

key = jr.PRNGKey(42)
embeddings, durations, masks = generate_synthetic_data(key)

# Duration predictor: 2-layer 1D convolution + linear projection
def init_duration_predictor(key, embed_dim=64, hidden_dim=128, kernel_size=3):
    """Initialise duration predictor weights."""
    keys = jr.split(key, 4)
    scale1 = jnp.sqrt(2.0 / (embed_dim * kernel_size))
    scale2 = jnp.sqrt(2.0 / (hidden_dim * kernel_size))
    params = {
        'conv1_w': jr.normal(keys[0], (kernel_size, embed_dim, hidden_dim)) * scale1,
        'conv1_b': jnp.zeros(hidden_dim),
        'conv2_w': jr.normal(keys[1], (kernel_size, hidden_dim, hidden_dim)) * scale2,
        'conv2_b': jnp.zeros(hidden_dim),
        'linear_w': jr.normal(keys[2], (hidden_dim, 1)) * jnp.sqrt(2.0 / hidden_dim),
        'linear_b': jnp.zeros(1),
    }
    return params

def duration_predictor(params, x):
    """Predict log-durations from phoneme embeddings. x: (batch, seq, embed)."""
    # Conv layer 1 with ReLU
    h = jax.lax.conv_general_dilated(
        x.transpose(0, 2, 1),  # (batch, embed, seq)
        params['conv1_w'].transpose(2, 1, 0),  # (out, in, kernel)
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['conv1_b']  # back to (batch, seq, hidden)
    h = jax.nn.relu(h)

    # Conv layer 2 with ReLU
    h = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1),
        params['conv2_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['conv2_b']
    h = jax.nn.relu(h)

    # Linear projection to scalar
    log_dur = (h @ params['linear_w'] + params['linear_b']).squeeze(-1)
    return log_dur

# Loss: MSE on log-durations (standard in FastSpeech)
def loss_fn(params, embeddings, durations, masks):
    log_dur_pred = duration_predictor(params, embeddings)
    log_dur_true = jnp.log(jnp.clip(durations, 1.0, None))
    sq_err = (log_dur_pred - log_dur_true) ** 2 * masks
    return jnp.sum(sq_err) / jnp.sum(masks)

grad_fn = jax.jit(jax.value_and_grad(loss_fn))

# Training loop
params = init_duration_predictor(jr.PRNGKey(0))
lr = 1e-3
losses = []

for epoch in range(300):
    loss_val, grads = grad_fn(params, embeddings, durations, masks)
    params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
    losses.append(float(loss_val))

# Evaluate on a sample
log_dur_pred = duration_predictor(params, embeddings[:1])
dur_pred = jnp.exp(log_dur_pred[0])
dur_true = durations[0]
mask = masks[0]
valid_len = int(jnp.sum(mask))

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].plot(losses, color='#3498db', linewidth=1.5)
axes[0].set_xlabel('Epoch')
axes[0].set_ylabel('MSE Loss (log-duration)')
axes[0].set_title('Duration Predictor Training')
axes[0].set_yscale('log')

x_pos = jnp.arange(valid_len)
width = 0.35
axes[1].bar(x_pos - width/2, dur_true[:valid_len], width, color='#27ae60',
            label='Ground truth', alpha=0.8)
axes[1].bar(x_pos + width/2, dur_pred[:valid_len], width, color='#e74c3c',
            label='Predicted', alpha=0.8)
axes[1].set_xlabel('Phoneme index')
axes[1].set_ylabel('Duration (frames)')
axes[1].set_title('Duration Prediction vs Ground Truth')
axes[1].legend()

plt.tight_layout()
plt.show()
```

- **任务3：基于上采样卷积的简单神经声码器。** 构建一个最简化的HiFi-GAN风格生成器，利用转置卷积和残差块将梅尔频谱图上采样为波形。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

def init_residual_block(key, channels, kernel_size, dilation):
    """Initialise a dilated residual convolution block."""
    k1, k2 = jr.split(key)
    scale = jnp.sqrt(2.0 / (channels * kernel_size))
    return {
        'conv1_w': jr.normal(k1, (kernel_size, channels, channels)) * scale,
        'conv1_b': jnp.zeros(channels),
        'conv2_w': jr.normal(k2, (kernel_size, channels, channels)) * scale,
        'conv2_b': jnp.zeros(channels),
        'dilation': dilation
    }

def residual_block(params, x):
    """x: (batch, time, channels). Dilated conv residual block with LeakyReLU."""
    h = jax.nn.leaky_relu(x, negative_slope=0.1)
    # Simplified: use standard conv (dilation handled conceptually)
    h = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1),
        params['conv1_w'].transpose(2, 1, 0),
        window_strides=(1,),
        padding='SAME',
        rhs_dilation=(params['dilation'],)
    ).transpose(0, 2, 1) + params['conv1_b']
    h = jax.nn.leaky_relu(h, negative_slope=0.1)
    h = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1),
        params['conv2_w'].transpose(2, 1, 0),
        window_strides=(1,),
        padding='SAME'
    ).transpose(0, 2, 1) + params['conv2_b']
    return x + h

def init_generator(key, n_mels=80, upsample_rates=(8, 8, 4),
                   channels=128):
    """Initialise a minimal HiFi-GAN-style generator."""
    keys = jr.split(key, 10)
    params = {}

    # Input projection: mel bins -> channels
    params['input_w'] = jr.normal(keys[0], (7, n_mels, channels)) * 0.02
    params['input_b'] = jnp.zeros(channels)

    # Upsample blocks (transposed convolutions)
    in_ch = channels
    for i, rate in enumerate(upsample_rates):
        k_size = rate * 2
        scale = jnp.sqrt(2.0 / (in_ch * k_size))
        out_ch = in_ch // 2
        params[f'up{i}_w'] = jr.normal(keys[i+1], (k_size, in_ch, out_ch)) * scale
        params[f'up{i}_b'] = jnp.zeros(out_ch)
        # Residual blocks at each scale
        params[f'res{i}_0'] = init_residual_block(jr.fold_in(keys[i+4], 0),
                                                    out_ch, 3, 1)
        params[f'res{i}_1'] = init_residual_block(jr.fold_in(keys[i+4], 1),
                                                    out_ch, 3, 3)
        in_ch = out_ch

    # Output projection to mono waveform
    params['output_w'] = jr.normal(keys[8], (7, in_ch, 1)) * 0.02
    params['output_b'] = jnp.zeros(1)
    params['upsample_rates'] = upsample_rates

    return params

def generator_forward(params, mel):
    """mel: (batch, time, n_mels) -> waveform: (batch, time * prod(rates), 1)."""
    # Input projection
    h = jax.lax.conv_general_dilated(
        mel.transpose(0, 2, 1),
        params['input_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['input_b']

    for i, rate in enumerate(params['upsample_rates']):
        h = jax.nn.leaky_relu(h, negative_slope=0.1)
        # Upsample via transposed convolution
        k_size = rate * 2
        h = jax.lax.conv_transpose(
            h.transpose(0, 2, 1),
            params[f'up{i}_w'].transpose(2, 1, 0),
            strides=(rate,),
            padding='SAME'
        ).transpose(0, 2, 1) + params[f'up{i}_b']
        # Residual blocks
        h = residual_block(params[f'res{i}_0'], h)
        h = residual_block(params[f'res{i}_1'], h)

    h = jax.nn.leaky_relu(h, negative_slope=0.1)
    out = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1),
        params['output_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['output_b']

    return jnp.tanh(out)

# Create a synthetic mel spectrogram (simulating a vowel)
n_mels = 80
n_frames = 50
mel = jnp.zeros((1, n_frames, n_mels))
# Add energy in low-frequency mel bins (simulating formants)
mel = mel.at[:, :, 5:15].set(1.0)
mel = mel.at[:, :, 20:25].set(0.6)

# Initialise and run generator
key = jr.PRNGKey(42)
params = init_generator(key, n_mels=n_mels, upsample_rates=(8, 8, 4),
                         channels=128)
waveform = generator_forward(params, mel)

print(f"Input mel shape:  {mel.shape}")
print(f"Output waveform shape: {waveform.shape}")
print(f"Upsample factor: {8 * 8 * 4} = {8*8*4}x")

fig, axes = plt.subplots(2, 1, figsize=(12, 6))

axes[0].imshow(mel[0].T, aspect='auto', origin='lower', cmap='magma')
axes[0].set_title('Input Mel Spectrogram')
axes[0].set_ylabel('Mel bin')
axes[0].set_xlabel('Frame')

waveform_np = waveform[0, :, 0]
axes[1].plot(waveform_np[:2000], color='#9b59b6', linewidth=0.5)
axes[1].set_title('Generator Output Waveform (untrained - random noise)')
axes[1].set_ylabel('Amplitude')
axes[1].set_xlabel('Sample')

plt.tight_layout()
plt.show()
print("Note: The output is noise because the generator is untrained.")
print("In practice, adversarial + mel loss training shapes this into speech.")
```

- **任务4：使用简单的RNN进行语音活动检测。** 在合成音频特征上训练一个基于GRU的小型VAD模型，以将帧分类为语音或静音。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Generate synthetic log-mel energy features with speech/silence labels
def generate_vad_data(key, n_sequences=100, n_frames=200, n_features=40):
    """Simulate log-mel features: speech regions are higher energy with structure."""
    keys = jr.split(key, 5)
    all_features = []
    all_labels = []

    for i in range(n_sequences):
        k = jr.fold_in(keys[0], i)
        k1, k2, k3 = jr.split(k, 3)

        # Random speech/silence pattern
        label = jnp.zeros(n_frames)
        n_segments = jr.randint(k1, (), 2, 6)
        for seg in range(int(n_segments)):
            start = jr.randint(jr.fold_in(k2, seg), (), 0, n_frames - 20)
            length = jr.randint(jr.fold_in(k3, seg), (), 10, 50)
            end = jnp.minimum(start + length, n_frames)
            label = label.at[int(start):int(end)].set(1.0)

        # Features: speech frames have higher energy + spectral structure
        noise = jr.normal(jr.fold_in(keys[1], i), (n_frames, n_features)) * 0.3
        speech_pattern = jnp.outer(label, jnp.exp(-jnp.arange(n_features) / 15.0))
        features = speech_pattern * 2.0 + noise + 0.1

        all_features.append(features)
        all_labels.append(label)

    return jnp.stack(all_features), jnp.stack(all_labels)

key = jr.PRNGKey(123)
features, labels = generate_vad_data(key)
train_features, train_labels = features[:80], labels[:80]
test_features, test_labels = features[80:], labels[80:]

# Simple GRU-based VAD model
def init_vad_model(key, input_dim=40, hidden_dim=64):
    keys = jr.split(key, 6)
    scale_ih = jnp.sqrt(2.0 / input_dim)
    scale_hh = jnp.sqrt(2.0 / hidden_dim)
    return {
        'W_z': jr.normal(keys[0], (input_dim, hidden_dim)) * scale_ih,
        'U_z': jr.normal(keys[1], (hidden_dim, hidden_dim)) * scale_hh,
        'b_z': jnp.zeros(hidden_dim),
        'W_r': jr.normal(keys[2], (input_dim, hidden_dim)) * scale_ih,
        'U_r': jr.normal(keys[3], (hidden_dim, hidden_dim)) * scale_hh,
        'b_r': jnp.zeros(hidden_dim),
        'W_h': jr.normal(keys[4], (input_dim, hidden_dim)) * scale_ih,
        'U_h': jr.normal(keys[5], (hidden_dim, hidden_dim)) * scale_hh,
        'b_h': jnp.zeros(hidden_dim),
        'W_out': jr.normal(jr.fold_in(keys[0], 99), (hidden_dim, 1)) * 0.1,
        'b_out': jnp.zeros(1),
    }

def gru_step(params, h, x):
    """Single GRU step."""
    z = jax.nn.sigmoid(x @ params['W_z'] + h @ params['U_z'] + params['b_z'])
    r = jax.nn.sigmoid(x @ params['W_r'] + h @ params['U_r'] + params['b_r'])
    h_tilde = jnp.tanh(x @ params['W_h'] + (r * h) @ params['U_h'] + params['b_h'])
    h_new = (1 - z) * h + z * h_tilde
    return h_new

def vad_forward(params, x):
    """x: (batch, time, features) -> logits: (batch, time)."""
    batch_size, n_frames, _ = x.shape
    hidden_dim = params['W_z'].shape[1]
    h = jnp.zeros((batch_size, hidden_dim))

    outputs = []
    for t in range(n_frames):
        h = gru_step(params, h, x[:, t, :])
        logit = (h @ params['W_out'] + params['b_out']).squeeze(-1)
        outputs.append(logit)

    return jnp.stack(outputs, axis=1)

def bce_loss(params, features, labels):
    """Binary cross-entropy loss for VAD."""
    logits = vad_forward(params, features)
    probs = jax.nn.sigmoid(logits)
    probs = jnp.clip(probs, 1e-7, 1 - 1e-7)
    loss = -(labels * jnp.log(probs) + (1 - labels) * jnp.log(1 - probs))
    return jnp.mean(loss)

grad_fn = jax.jit(jax.value_and_grad(bce_loss))

# Training
params = init_vad_model(jr.PRNGKey(0))
lr = 5e-3
losses = []

for epoch in range(200):
    loss_val, grads = grad_fn(params, train_features, train_labels)
    params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
    losses.append(float(loss_val))
    if epoch % 50 == 0:
        print(f"Epoch {epoch}: loss = {loss_val:.4f}")

# Evaluate on test set
test_logits = vad_forward(params, test_features)
test_preds = (jax.nn.sigmoid(test_logits) > 0.5).astype(jnp.float32)
accuracy = jnp.mean(test_preds == test_labels)
print(f"\nTest accuracy: {accuracy:.4f}")

# Visualise a test example
idx = 0
fig, axes = plt.subplots(3, 1, figsize=(14, 7))

axes[0].imshow(test_features[idx].T, aspect='auto', origin='lower', cmap='magma')
axes[0].set_title('Log-Mel Energy Features')
axes[0].set_ylabel('Mel bin')

axes[1].fill_between(range(200), test_labels[idx], alpha=0.4, color='#27ae60',
                     label='Ground truth')
axes[1].plot(jax.nn.sigmoid(test_logits[idx]), color='#e74c3c',
             linewidth=1.5, label='Predicted probability')
axes[1].axhline(0.5, color='gray', linestyle='--', linewidth=0.8)
axes[1].set_ylabel('Speech probability')
axes[1].legend()
axes[1].set_title('VAD Predictions')

axes[2].fill_between(range(200), test_labels[idx], alpha=0.4, color='#27ae60',
                     label='Ground truth')
axes[2].fill_between(range(200), test_preds[idx], alpha=0.4, color='#f39c12',
                     label='Predicted (threshold=0.5)')
axes[2].set_ylabel('Speech / Silence')
axes[2].set_xlabel('Frame')
axes[2].legend()
axes[2].set_title('VAD Binary Decision')

plt.tight_layout()
plt.show()
```

## 说话人与音频分析

_说话人与音频分析用于识别谁在说话、说话时间以及音频中存在的非语音声音。本文档涵盖了说话人验证与识别、i-向量、d-向量、x-向量、说话人日记化、音频事件分类、音乐信息检索以及从语音中识别情感等内容。_

- 在第01个文件中，我们奠定了信号处理的基础：频谱图、MFCC和梅尔滤波器组。在第02个文件中，我们识别了所说的内容。现在我们要确定是谁说的、何时说的，以及音频中还发生了什么。说话人识别、日记化、音频分类和音乐分析都有一个共同点：学习能够捕捉任务所需不变性的紧凑嵌入，这与第06章中的嵌入思想相呼应。

- 可以把识别说话人想象成在电话中辨认朋友的声音。你无需理解所说的话；音色、语速和声质等方面的特征对该人而言是独一无二的。说话人识别系统能从原始音频中提取出这种“声纹”，忽略所说内容而专注于说话方式。

- **说话人识别**是两项相关任务的总称：
- **说话人验证**（SV）：给定声称的身份和音频片段，判断说话人是否为其所声称的人。这是一个二元决策（接受或拒绝），也是基于语音的认证技术背后的原理（“嘿，Siri，这是我的声音吗？”）。
- **说话人识别**（SI）：给定音频片段和已知说话人库，确定该片段由哪位说话人产生。这是一个多类分类问题。

![说话人验证：注册音频被嵌入，测试音频被嵌入，计算嵌入之间的余弦相似度，再通过阈值决定接受或拒绝](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/speaker_verification.svg)

- 这两项任务共享相同的基础表示：一个固定维度的**说话人嵌入**，它能反映说话人的身份，而与所说内容无关。区别仅在于决策阶段：验证是对比两个嵌入，识别则是在候选者中找到最接近的嵌入。

- **余弦相似度**是比较说话人嵌入的标准指标。给定注册嵌入$e$和测试嵌入$t$：

$$s = \frac{e \cdot t}{\|e\| \, \|t\|}$$

- 阈值$\theta$决定了接受/拒绝决策：若$s > \theta$，则接受。该阈值在**误接受率（FAR）**和**误拒绝率（FRR）**之间进行权衡。**等错误率（EER）**（即FAR = FRR）是常用的评估指标。EER越低，性能越好。最先进的系统在标准基准测试（VoxCeleb）上的EER可低于1%。

- **i-向量**（Dehak等人，2010年）在深度学习兴起前是主流的说话人嵌入方法。其思想源自因子分析（第02章的矩阵分解和第04章的降维）。**通用背景模型（UBM）**是在多种说话人数据上训练出的大型GMM，它定义了一个超向量空间。每段语音的GMM超向量会被投影到低维度的**总变异空间**：

$$M = m + Tw$$

- 其中$M$是语音的GMM超向量，$m$是UBM均值超向量，$T$是从数据中学习得到的总变异矩阵，$w$就是i-向量，它是一个低维度（通常为400–600）的表示，能够捕捉说话人和信道变异信息。

- 为了消除i-向量中的信道变异，**概率线性判别分析（PLDA）**将i-向量建模为说话人特定变量和信道特定变量的总和。PLDA为验证提供了一个合理的对数似然比评分：

$$\text{score}(w_1, w_2) = \log \frac{P(w_1, w_2 \mid \text{同一说话人})}{P(w_1 \mid \text{说话人}_1) \, P(w_2 \mid \text{说话人}_2)}$$

- **d-向量**（Variani等人，2014年）是最早的神经说话人嵌入方法。一种针对帧级特征进行说话人分类训练的DNN，通过对一段语音中所有帧的最后一层激活值取平均，从而得到固定维度的表示。d-向量虽简单却有效，它证明了神经网络无需复杂的统计机制就能学习到具有区分度的说话人特征。

- **x-向量**（Snyder等人，2018年）采用**时延神经网络（TDNN）**架构，显著推进了神经说话人嵌入的发展。TDNN是一种每层具有特定上下文窗口的一维卷积网络，它与第03个文件中WaveNet所用的扩张卷积类似，但应用于帧级特征而非原始波形样本。

![x-向量架构：TDNN层以逐渐扩大的上下文处理帧级特征，统计池化在时间维度上聚合信息，全连接层生成说话人嵌入](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/xvector_architecture.svg)

- x-向量架构分为三个阶段：
- **帧级层**：一系列TDNN层处理来自第01个文件的MFCC，其时间上下文逐渐扩大。每层看到的上下文窗口固定（例如第一层为$\{t-2, t-1, t, t+1, t+2\}$，后续层更宽）。
- **统计池化**：在帧级层之后，会计算整段语音中帧级输出的均值和标准差，从而生成一个与语音长度无关的固定维度向量：

$$
\begin{aligned}
\mu &= \frac{1}{T} \sum_{t=1}^{T} h_t \\
\sigma &= \sqrt{\frac{1}{T} \sum_{t=1}^{T} (h_t - \mu)^2}
\end{aligned}

$$

- 其中$h_t$表示时间$t$处的帧级输出。拼接后的$[\mu; \sigma]$即为池化后的表征。
- **片段级层**：全连接层对池化后的表征进行处理。第一个片段级层的输出（在softmax之前）即为x向量嵌入。

- x向量通过基于说话人身份的标准交叉熵损失进行训练。尽管它是为分类任务而训练的，但所学到的中间表征（即x向量）对未见过的说话人仍具有良好的泛化能力，因为网络学会了提取具有区分度的说话人特征，而非单纯记忆特定说话人。

- **ECAPA-TDNN**（Desplanques等人，2020年）是目前用于说话人识别的、基于TDNN的最先进架构。它相比x向量有三项改进：
- **挤压-激励（SE）模块**：即通道注意力机制（源自第08章的SENet），根据全局上下文重新加权特征通道，使模型能够突出与说话人相关的通道。
- **Res2Net风格的多尺度特征**：在每个TDNN块中，通道被分成若干组并分层处理，从而生成多种时间分辨率下的特征（类似于第08章中的多尺度特征提取）。
- **注意力统计池化**：不同于等权平均，该机制利用注意力机制来权衡每一帧对池化统计量的贡献。包含更多说话人区分信息的帧（如元音，它们携带更多说话人信息）会获得更高的注意力权重：

$$\alpha_t = \frac{\exp(v^T f(h_t))}{\sum_{\tau} \exp(v^T f(h_\tau))}$$

- 其中$f$是一个小型神经网络，$v$是学习得到的注意力向量。加权后的均值和标准差分别为$\tilde{\mu} = \sum_t \alpha_t h_t$以及$\tilde{\sigma} = \sqrt{\sum_t \alpha_t (h_t - \tilde{\mu})^2}$。

- ECAPA-TDNN通常采用**AAM-Softmax**（加性角度间隔Softmax）进行训练，该损失函数在分类损失中加入角度间隔惩罚，促使同一说话人的嵌入在超球面上更紧密地聚集，不同说话人的嵌入则彼此远离：

$$L = -\log \frac{e^{s \cos(\theta_{y_i} + m)}}{e^{s \cos(\theta_{y_i} + m)} + \sum_{j \neq y_i} e^{s \cos \theta_j}}$$

- 其中$\theta_{y_i}$是嵌入向量与真实类别权重向量之间的夹角，$m$为间隔参数（通常为0.2），$s$为缩放因子（通常为30）。这种损失函数源自人脸识别领域（第08章的ArcFace），在说话人验证中效果显著。

- **说话人日志分析**旨在回答多说话人录音中“谁在何时发言”的问题。可以将其理解为给时间线着色：每种颜色代表不同的说话人，系统必须确定每位说话人的活跃时段，包括语音重叠的情况。

![说话人日志分析：音频时间线被分割并标注上说话人身份，显示出轮流发言及重叠区域](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/speaker_diarisation.svg)

- **基于聚类的日志分析**是传统的处理流程：
- **分割**：利用滑动窗口或说话人变化检测技术，将音频切分为较短的片段（通常1-2秒）。
- **嵌入提取**：为每个片段提取说话人嵌入（x向量或ECAPA-TDNN）。
- **聚类**：按说话人对片段进行分组。**凝聚型层次聚类（AHC）**是常用方法：初始时每个片段自成一类，然后迭代合并最相似的两类，直至满足停止条件（基于距离阈值或目标说话人数）。
- **重新分割**：利用基于Viterbi算法的重新对齐技术来细化边界。

- 说话人数量通常是事先未知的，这使得该问题比常规聚类更为复杂。另一种常见方法是采用谱聚类，并通过特征值来确定$k$值。

- **端到端神经日志分析（EEND）**（Fujita等人，2019年）将日志分析视为多标签分类问题。神经网络（通常是基于自注意力的模型，即第07章的Transformer）以整段录音为输入，为每一帧输出每位说话人的二元活动标签。这种方法能直接处理语音重叠情况，而这正是基于聚类方法的主要弱点。

- 对于$S$位说话人，在时间$t$的EEND输出为：

$$\hat{y}_{t,s} = \sigma(f_s(h_t))$$

- 其中$h_t$是Transformer在帧$t$的输出，$f_s$是针对说话人$s$的线性投影。训练损失为对所有说话人和帧计算的二元交叉熵之和。一个关键挑战在于说话人数量必须固定，或通过可变输出架构来处理（EEND-EDA采用带有吸引子的编码器-解码器结构）。

- 用于日志分析的**排列不变训练（PIT）**解决了标签歧义问题：由于说话人没有固有顺序，损失函数会对所有可能的说话人与输出对应关系进行计算，并取最小值（这与第05文件中介绍的源分离任务中所用的PIT相同）。

- **音频分类**是为整个音频片段赋予一个标签。与ASR（第02文件）不同，后者用于语音转录，音频分类涵盖的范围更广：环境声音（警报声、雨声、狗吠声）、音乐流派（摇滚、爵士、古典）以及各种音频事件。

- 标准做法遵循第08章中的图像分类范式：将音频表示为频谱图（一种二维时频图像），再应用CNN或Transformer分类器。这种频谱图像方法利用了计算机视觉领域数十年的研究成果。

- **环境声音分类（ESC）**使用诸如ESC-50（50个类别，2000个音频片段）和UrbanSound8K等数据集。常用的架构是将CNN（第06章）应用于对数梅尔频谱图。数据增强至关重要：时间拉伸、音高变换、添加背景噪声以及**SpecAugment**（第02文件中介绍的针对频谱图的掩码技术）都能有效提升模型的泛化能力。
- **音频事件检测**（Sound Event Detection, SED）是分类任务的时间维度延伸：不仅要识别存在哪些事件，还要确定它们的起始与结束时间。**AudioSet**（Gemmeke等人，2017年）是一个大规模基准数据集，包含527个事件类别以及超过200万个来自YouTube的10秒音频片段，这些片段均为弱标注（仅提供片段级标签，而非帧级标签）。

- **弱监督SED**需要从片段级标签中学习帧级预测。常用方法是使用CNN生成帧级类别概率，再通过注意力池化将其聚合为片段级预测：

$$\hat{Y}_c = \sigma\left(\sum_t \alpha_{t,c} \cdot f_{t,c}\right)$$

其中，$f_{t,c}$表示时间$t$下类别$c$的帧级逻辑值，$\alpha_{t,c}$为注意力权重。片段级预测$\hat{Y}_c$会针对片段级标签进行训练。

- **声场景分类**（Acoustic Scene Classification, ASC）用于对整体环境进行分类，如“机场”、“公园”、“地铁站”、“办公室”等。这是一项整体性任务：模型必须捕捉整体的声学特征，而非特定事件。DCASE挑战赛每年都会对ASC任务进行评测，获胜系统通常采用基于多分辨率频谱图的CNN集成模型。

- **音频嵌入**是从大规模音频数据中学习得到的通用表示，类似于词嵌入（第07章）或图像特征（第08章），可迁移至下游任务中。

- **VGGish**（Hershey等人，2017年）将VGG图像分类网络（第08章）应用于音频领域。它通过预先在AudioSet上训练的类似VGG的CNN处理0.96秒的对数梅尔频谱图块，为每个块生成128维嵌入。VGGish嵌入可作为下游任务的通用音频特征，类似于ImageNet预训练的CNN所提供的视觉特征。

- **PANNs**（预训练音频神经网络，Kong等人，2020年）是一系列在完整AudioSet数据集上训练用于音频标注的CNN架构（CNN6、CNN10、CNN14）。其中应用最广泛的是CNN14，这是一种14层CNN，采用$3 \times 3$卷积处理对数梅尔频谱图。PANNs可生成2048维嵌入，在各类音频任务中均能达到最先进的迁移学习效果。

- **音频频谱图变换器**（Audio Spectrogram Transformer, AST）（Gong等人，2021年）直接将视觉变换器（Vision Transformer, ViT，第08章）架构应用于音频频谱图。频谱图被划分为$16 \times 16$的块（与ViT处理图像的方式类似），每个块被线性投影为令牌嵌入，再加入位置嵌入，随后由标准变换器编码器（第07章）处理该序列。分类结果取自[CLS]令牌的输出。

![音频频谱图变换器：梅尔频谱图被划分为多个块，每个块被展平并线性投影为令牌，加入位置嵌入后，由变换器编码器通过CLS令牌产生分类结果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/audio_spectrogram_transformer.svg)

- AST得益于**ImageNet预训练**：由于频谱图属于二维图像，AST初始参数来自在ImageNet图像上预训练的ViT，随后在音频数据上进行微调。这种跨模态迁移效果显著，因为两个领域共享低层特征（边缘、纹理），且位置嵌入可通过插值来适应不同尺寸的频谱图。

- **HTS-AT**（Chen等人，2022年）在AST基础上引入了分层Swin Transformer架构（第08章中的移位窗口注意力机制），在降低计算成本的同时，通过多尺度特征提取提升了性能。

- **BEATs**（Chen等人，2023年）采用了一种针对音频的预训练策略：利用离散令牌化器进行迭代掩码预测（类似于文件02中wav2vec 2.0的方法，但应用于通用音频）。令牌化器会逐步优化，从而生成语义上更具意义的离散音频令牌。

- **基于嵌入的说话人聚类**结合了说话人嵌入与时间建模。现代系统如Pyannote.audio采用三阶段流程：（1）神经分割模型用于检测说话人切换点及重叠语音；（2）对每个检测到的片段提取嵌入（ECAPA-TDNN）；（3）通过聚类为整个录音分配说话人身份。

- **音乐信息检索**（Music Information Retrieval, MIR）将音频分析应用于音乐领域。文件01中提到的频谱表示在此尤为有用，因为音乐具有丰富的和声结构。

- **节拍追踪**用于检测音乐的节奏脉冲。常用方法是从频谱图中计算**起始强度包络**（用于识别表示音符起始的能量峰值），再利用自相关或节奏图确定节奏，最后通过动态规划追踪各节拍位置，从而找到与起始强度包络最匹配且节奏一致的节拍序列。

- **和弦识别**用于确定随时间变化的和声内容。输入通常为**色度图**（也称音高类轮廓）：一种将所有八度合并的12维表示，显示12个音高类（C、C#、D、…、B）中的能量分布。CNN或RNN（第06章）会将每个时间帧分类为标准和弦标签（如C大调、A小调、G7等）。

色度图是通过STFT（文件01）计算的，具体是将每个频率 bin 映射到其音高类：

$$\text{chroma}(p) = \sum_{k : \text{pitch}(k) \bmod 12 = p} |X(k)|^2$$

其中，$p \in \{0, 1, \ldots, 11\}$表示音高类，$\text{pitch}(k)$将频率 bin $k$映射为对应的MIDI音符编号。

- **源分离基础**（详见文件05）是指将音乐录音分解为各个独立乐器（人声、鼓、贝斯等）。这在混音、卡拉OK及音乐转录等MIR应用中至关重要。像Demucs（文件05）这样的模型在标准的MUSDB18基准测试中能取得极佳的分离效果。
- **音乐标签标注**为歌曲赋予标签（流派、情绪、乐器、时代）。本质上是对音乐应用的音频分类技术，采用相同的基于频谱图的CNN方法。Million Song Dataset和MagnaTagATune是常用的基准数据集。

- **音频指纹识别**能够从简短的音频片段中识别出特定的录音，即使存在噪声、混响或压缩失真。经典的系统是Shazam，它通过对频谱图中显著的峰值点进行哈希处理来实现识别。神经网络方法则能学习出对声学退化具有鲁棒性、同时又能区分不同录音的嵌入向量，这与第06章和第08章中讨论的不变特征学习理念相呼应。

## 编程任务（请使用CoLab或笔记本）（续1）

- **任务1：利用统计池化提取说话人嵌入向量。** 构建一个简单的类x-vector模型，该模型通过TDNN层处理帧级特征，再利用统计池化生成说话人嵌入向量。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Simulate frame-level MFCC features for multiple speakers
def generate_speaker_data(key, n_speakers=5, utterances_per_speaker=20,
                          n_frames=100, n_features=40):
    """Generate synthetic speaker data with speaker-dependent patterns."""
    keys = jr.split(key, 3)
    all_features = []
    all_labels = []

    # Each speaker has a characteristic spectral pattern
    speaker_patterns = jr.normal(keys[0], (n_speakers, n_features)) * 0.5

    for spk in range(n_speakers):
        for utt in range(utterances_per_speaker):
            k = jr.fold_in(keys[1], spk * utterances_per_speaker + utt)
            noise = jr.normal(k, (n_frames, n_features)) * 0.3
            features = speaker_patterns[spk][None, :] + noise
            all_features.append(features)
            all_labels.append(spk)

    perm = jr.permutation(keys[2], len(all_features))
    features = jnp.stack(all_features)[perm]
    labels = jnp.array(all_labels)[perm]
    return features, labels

key = jr.PRNGKey(42)
features, labels = generate_speaker_data(key)
n_speakers = 5
n_features = 40

# x-vector-style model
def init_xvector(key, n_features=40, hidden=128, embed_dim=64, n_speakers=5):
    keys = jr.split(key, 8)
    params = {
        # TDNN layer 1: context [-2, 2]
        'tdnn1_w': jr.normal(keys[0], (5, n_features, hidden)) * jnp.sqrt(2.0 / (5 * n_features)),
        'tdnn1_b': jnp.zeros(hidden),
        # TDNN layer 2: context [-2, 2]
        'tdnn2_w': jr.normal(keys[1], (5, hidden, hidden)) * jnp.sqrt(2.0 / (5 * hidden)),
        'tdnn2_b': jnp.zeros(hidden),
        # TDNN layer 3: context [-3, 3]
        'tdnn3_w': jr.normal(keys[2], (7, hidden, hidden)) * jnp.sqrt(2.0 / (7 * hidden)),
        'tdnn3_b': jnp.zeros(hidden),
        # Segment-level layers (after pooling: 2*hidden -> embed_dim)
        'seg1_w': jr.normal(keys[3], (2 * hidden, embed_dim)) * jnp.sqrt(2.0 / (2 * hidden)),
        'seg1_b': jnp.zeros(embed_dim),
        # Classification head
        'cls_w': jr.normal(keys[4], (embed_dim, n_speakers)) * jnp.sqrt(2.0 / embed_dim),
        'cls_b': jnp.zeros(n_speakers),
    }
    return params

def xvector_forward(params, x, return_embedding=False):
    """x: (batch, frames, features) -> logits or embeddings."""
    # TDNN layers (1D convolutions)
    h = jax.lax.conv_general_dilated(
        x.transpose(0, 2, 1), params['tdnn1_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['tdnn1_b']
    h = jax.nn.relu(h)

    h = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1), params['tdnn2_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['tdnn2_b']
    h = jax.nn.relu(h)

    h = jax.lax.conv_general_dilated(
        h.transpose(0, 2, 1), params['tdnn3_w'].transpose(2, 1, 0),
        window_strides=(1,), padding='SAME'
    ).transpose(0, 2, 1) + params['tdnn3_b']
    h = jax.nn.relu(h)

    # Statistics pooling: mean and std over time
    mu = jnp.mean(h, axis=1)
    sigma = jnp.std(h, axis=1)
    pooled = jnp.concatenate([mu, sigma], axis=-1)

    # Segment-level layer -> embedding
    embedding = jax.nn.relu(pooled @ params['seg1_w'] + params['seg1_b'])

    if return_embedding:
        return embedding

    # Classification
    logits = embedding @ params['cls_w'] + params['cls_b']
    return logits

def cross_entropy_loss(params, features, labels):
    logits = xvector_forward(params, features)
    one_hot = jax.nn.one_hot(labels, n_speakers)
    log_probs = jax.nn.log_softmax(logits)
    return -jnp.mean(jnp.sum(one_hot * log_probs, axis=-1))

grad_fn = jax.jit(jax.value_and_grad(cross_entropy_loss))

# Train
params = init_xvector(jr.PRNGKey(0))
lr = 1e-3
losses = []

for epoch in range(300):
    loss_val, grads = grad_fn(params, features, labels)
    params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
    losses.append(float(loss_val))

# Extract embeddings and visualise with t-SNE-style 2D projection (using PCA)
embeddings = xvector_forward(params, features, return_embedding=True)

# Simple PCA to 2D
emb_centered = embeddings - jnp.mean(embeddings, axis=0)
_, _, Vt = jnp.linalg.svd(emb_centered, full_matrices=False)
proj_2d = emb_centered @ Vt[:2].T

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].plot(losses, color='#3498db', linewidth=1.5)
axes[0].set_xlabel('Epoch')
axes[0].set_ylabel('Cross-Entropy Loss')
axes[0].set_title('Speaker Classification Training')
axes[0].set_yscale('log')

colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6']
for spk in range(n_speakers):
    mask = labels == spk
    axes[1].scatter(proj_2d[mask, 0], proj_2d[mask, 1], c=colors[spk],
                    label=f'Speaker {spk}', alpha=0.7, s=30)
axes[1].set_xlabel('PC 1')
axes[1].set_ylabel('PC 2')
axes[1].set_title('Speaker Embeddings (PCA projection)')
axes[1].legend()

plt.tight_layout()
plt.show()

# Verification demo: cosine similarity
emb_norm = embeddings / jnp.linalg.norm(embeddings, axis=-1, keepdims=True)
sim_matrix = emb_norm @ emb_norm.T
print(f"Embedding shape: {embeddings.shape}")
print(f"Avg same-speaker similarity: {jnp.mean(sim_matrix[labels[:, None] == labels[None, :]]):.4f}")
print(f"Avg diff-speaker similarity: {jnp.mean(sim_matrix[labels[:, None] != labels[None, :]]):.4f}")
```

- **任务2：基于余弦相似度评分的说话人验证。** 给定预先计算好的说话人嵌入向量，实现一个验证系统，用于计算EER（等错误率）并绘制DET曲线。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

def generate_verification_pairs(key, n_speakers=20, dim=64, n_pairs=2000):
    """Generate speaker embeddings and verification trial pairs."""
    keys = jr.split(key, 5)

    # Speaker centroids with some variance
    centroids = jr.normal(keys[0], (n_speakers, dim))
    centroids = centroids / jnp.linalg.norm(centroids, axis=-1, keepdims=True)

    # Generate enrollment and test embeddings with intra-speaker variance
    enroll_embs = []
    test_embs = []
    trial_labels = []  # 1 = same speaker (target), 0 = different (impostor)

    for i in range(n_pairs):
        k1, k2, k3 = jr.split(jr.fold_in(keys[1], i), 3)
        is_target = jr.bernoulli(k1).astype(int)

        spk1 = jr.randint(k2, (), 0, n_speakers)
        emb1 = centroids[spk1] + jr.normal(jr.fold_in(k3, 0), (dim,)) * 0.15

        if is_target:
            spk2 = spk1
        else:
            spk2 = (spk1 + jr.randint(jr.fold_in(k3, 1), (), 1, n_speakers)) % n_speakers

        emb2 = centroids[spk2] + jr.normal(jr.fold_in(k3, 2), (dim,)) * 0.15

        enroll_embs.append(emb1)
        test_embs.append(emb2)
        trial_labels.append(int(is_target))

    return (jnp.stack(enroll_embs), jnp.stack(test_embs),
            jnp.array(trial_labels))

key = jr.PRNGKey(42)
enroll, test, labels = generate_verification_pairs(key)

# Compute cosine similarity scores
enroll_norm = enroll / jnp.linalg.norm(enroll, axis=-1, keepdims=True)
test_norm = test / jnp.linalg.norm(test, axis=-1, keepdims=True)
scores = jnp.sum(enroll_norm * test_norm, axis=-1)

# Compute FAR and FRR at various thresholds
thresholds = jnp.linspace(-1.0, 1.0, 500)

target_scores = scores[labels == 1]
impostor_scores = scores[labels == 0]

fars = []
frrs = []
for thresh in thresholds:
    far = jnp.mean(impostor_scores >= thresh)  # false accepts
    frr = jnp.mean(target_scores < thresh)     # false rejects
    fars.append(float(far))
    frrs.append(float(frr))

fars = jnp.array(fars)
frrs = jnp.array(frrs)

# Find EER: where FAR ≈ FRR
eer_idx = jnp.argmin(jnp.abs(fars - frrs))
eer = float((fars[eer_idx] + frrs[eer_idx]) / 2)
eer_threshold = float(thresholds[eer_idx])

print(f"Equal Error Rate (EER): {eer:.4f} ({eer*100:.2f}%)")
print(f"EER threshold: {eer_threshold:.4f}")

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Score distributions
bins = jnp.linspace(-0.5, 1.0, 60)
axes[0].hist(target_scores, bins=bins, alpha=0.6, color='#27ae60',
             label='Target (same speaker)', density=True)
axes[0].hist(impostor_scores, bins=bins, alpha=0.6, color='#e74c3c',
             label='Impostor (different speaker)', density=True)
axes[0].axvline(eer_threshold, color='#f39c12', linestyle='--', linewidth=2,
                label=f'EER threshold = {eer_threshold:.3f}')
axes[0].set_xlabel('Cosine Similarity Score')
axes[0].set_ylabel('Density')
axes[0].set_title('Score Distributions')
axes[0].legend()

# FAR vs FRR
axes[1].plot(thresholds, fars, color='#e74c3c', linewidth=2, label='FAR')
axes[1].plot(thresholds, frrs, color='#3498db', linewidth=2, label='FRR')
axes[1].axvline(eer_threshold, color='#f39c12', linestyle='--', linewidth=1.5)
axes[1].scatter([eer_threshold], [eer], color='#f39c12', s=100, zorder=5,
                label=f'EER = {eer:.4f}')
axes[1].set_xlabel('Threshold')
axes[1].set_ylabel('Error Rate')
axes[1].set_title('FAR and FRR vs Threshold')
axes[1].legend()

# DET curve (FAR vs FRR)
axes[2].plot(fars, frrs, color='#9b59b6', linewidth=2)
axes[2].plot([0, 1], [0, 1], 'k--', alpha=0.3)
axes[2].scatter([eer], [eer], color='#f39c12', s=100, zorder=5,
                label=f'EER = {eer:.4f}')
axes[2].set_xlabel('False Acceptance Rate')
axes[2].set_ylabel('False Rejection Rate')
axes[2].set_title('DET Curve')
axes[2].set_xlim([0, 0.5])
axes[2].set_ylim([0, 0.5])
axes[2].legend()
axes[2].set_aspect('equal')

plt.tight_layout()
plt.show()
```

- **任务3：音频频谱图补丁嵌入（AST风格）。** 实现音频频谱图Transformer的补丁提取与嵌入层，可视化频谱图是如何被分块处理的。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Generate a synthetic spectrogram (harmonic structure + noise)
def generate_spectrogram(key, n_time=128, n_freq=128):
    """Create a synthetic spectrogram with harmonic patterns."""
    k1, k2 = jr.split(key)
    spec = jr.normal(k1, (n_time, n_freq)) * 0.1

    # Add harmonic bands (simulating speech formants)
    for f0 in [15, 30, 45, 70]:
        width = 3
        envelope = jnp.exp(-0.5 * ((jnp.arange(n_freq) - f0) / width) ** 2)
        time_mod = 0.5 + 0.5 * jnp.sin(2 * jnp.pi * jnp.arange(n_time) / 40)
        spec += jnp.outer(time_mod, envelope)

    return jnp.clip(spec, 0, None)

key = jr.PRNGKey(42)
spectrogram = generate_spectrogram(key)
n_time, n_freq = spectrogram.shape

# Patch extraction parameters
patch_h = 16  # time
patch_w = 16  # frequency
stride_h = 16
stride_w = 16
embed_dim = 192  # ViT-Small dimension

n_patches_h = n_time // stride_h
n_patches_w = n_freq // stride_w
n_patches = n_patches_h * n_patches_w

print(f"Spectrogram: {n_time} x {n_freq}")
print(f"Patch size: {patch_h} x {patch_w}")
print(f"Number of patches: {n_patches_h} x {n_patches_w} = {n_patches}")

# Extract patches
def extract_patches(spec, patch_h, patch_w, stride_h, stride_w):
    """Extract non-overlapping patches from spectrogram."""
    patches = []
    positions = []
    for i in range(0, spec.shape[0] - patch_h + 1, stride_h):
        for j in range(0, spec.shape[1] - patch_w + 1, stride_w):
            patch = spec[i:i+patch_h, j:j+patch_w]
            patches.append(patch.flatten())
            positions.append((i, j))
    return jnp.stack(patches), positions

patches, positions = extract_patches(spectrogram, patch_h, patch_w, stride_h, stride_w)
print(f"Patches shape: {patches.shape}")  # (n_patches, patch_h * patch_w)

# Linear projection (patch embedding)
patch_dim = patch_h * patch_w
k1, k2 = jr.split(jr.PRNGKey(0))
W_embed = jr.normal(k1, (patch_dim, embed_dim)) * jnp.sqrt(2.0 / patch_dim)
b_embed = jnp.zeros(embed_dim)

# Learnable positional embeddings
pos_embed = jr.normal(k2, (n_patches + 1, embed_dim)) * 0.02  # +1 for CLS

# CLS token
cls_token = jnp.zeros((1, embed_dim))

# Forward pass
patch_tokens = patches @ W_embed + b_embed  # (n_patches, embed_dim)
tokens = jnp.concatenate([cls_token, patch_tokens], axis=0)  # (n_patches+1, embed_dim)
tokens = tokens + pos_embed  # Add positional embeddings

print(f"Token sequence shape: {tokens.shape}")
print(f"Each token has dimension: {embed_dim}")

# Visualisation
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Original spectrogram with patch grid
axes[0, 0].imshow(spectrogram.T, aspect='auto', origin='lower', cmap='magma')
for i in range(0, n_time + 1, stride_h):
    axes[0, 0].axvline(i - 0.5, color='white', linewidth=0.5, alpha=0.5)
for j in range(0, n_freq + 1, stride_w):
    axes[0, 0].axhline(j - 0.5, color='white', linewidth=0.5, alpha=0.5)
axes[0, 0].set_title(f'Spectrogram with {patch_h}x{patch_w} Patch Grid')
axes[0, 0].set_xlabel('Time frame')
axes[0, 0].set_ylabel('Frequency bin')

# Individual patches visualised
n_show = min(16, n_patches)
patch_grid = patches[:n_show].reshape(n_show, patch_h, patch_w)
combined = jnp.concatenate([patch_grid[i] for i in range(min(8, n_show))], axis=1)
axes[0, 1].imshow(combined.T, aspect='auto', origin='lower', cmap='magma')
axes[0, 1].set_title(f'First {min(8, n_show)} Patches (concatenated)')
axes[0, 1].set_xlabel('Patch index (horizontal)')
axes[0, 1].set_ylabel('Frequency within patch')

# Token embeddings similarity matrix
token_norms = tokens / jnp.linalg.norm(tokens, axis=-1, keepdims=True)
sim = token_norms @ token_norms.T
im = axes[1, 0].imshow(sim, cmap='RdBu_r', vmin=-1, vmax=1)
axes[1, 0].set_title('Token Similarity Matrix (cosine)')
axes[1, 0].set_xlabel('Token index')
axes[1, 0].set_ylabel('Token index')
plt.colorbar(im, ax=axes[1, 0], fraction=0.046)

# Positional embedding similarity
pos_norms = pos_embed / jnp.linalg.norm(pos_embed, axis=-1, keepdims=True)
pos_sim = pos_norms @ pos_norms.T
im2 = axes[1, 1].imshow(pos_sim, cmap='RdBu_r', vmin=-1, vmax=1)
axes[1, 1].set_title('Positional Embedding Similarity')
axes[1, 1].set_xlabel('Position index')
axes[1, 1].set_ylabel('Position index')
plt.colorbar(im2, ax=axes[1, 1], fraction=0.046)

plt.tight_layout()
plt.show()
```

- **任务4：用于和弦分析的简单色度图计算。** 从合成的和声信号中计算并可视化色度图，展示音乐信息检索中所使用的音高类别折叠技术。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Generate a synthetic musical signal: C major chord -> G major chord
sr = 16000
duration = 2.0
t = jnp.linspace(0, duration, int(sr * duration))

# C major (C4=261.6, E4=329.6, G4=392.0) for first half
# G major (G3=196.0, B3=246.9, D4=293.7) for second half
half = len(t) // 2

c_major = (0.5 * jnp.sin(2 * jnp.pi * 261.63 * t[:half]) +
           0.4 * jnp.sin(2 * jnp.pi * 329.63 * t[:half]) +
           0.3 * jnp.sin(2 * jnp.pi * 392.00 * t[:half]))

g_major = (0.5 * jnp.sin(2 * jnp.pi * 196.00 * t[:half]) +
           0.4 * jnp.sin(2 * jnp.pi * 246.94 * t[:half]) +
           0.3 * jnp.sin(2 * jnp.pi * 293.66 * t[:half]))

signal = jnp.concatenate([c_major, g_major])

# Compute STFT
n_fft = 4096  # high resolution for pitch accuracy
hop_length = 512
window = jnp.hanning(n_fft)

def stft(signal, n_fft, hop_length, window):
    n_frames = 1 + (len(signal) - n_fft) // hop_length
    frames = jnp.stack([
        signal[i * hop_length : i * hop_length + n_fft] * window
        for i in range(n_frames)
    ])
    return jnp.fft.rfft(frames, n=n_fft)

S = stft(signal, n_fft, hop_length, window)
power_spec = jnp.abs(S) ** 2
freqs = jnp.fft.rfftfreq(n_fft, 1.0 / sr)

# Compute chromagram by mapping frequency bins to pitch classes
# MIDI note number from frequency: 69 + 12 * log2(f / 440)
note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def freq_to_chroma(freq):
    """Map frequency to pitch class (0-11). Returns -1 for freq <= 0."""
    midi = 69 + 12 * jnp.log2(jnp.clip(freq, 1e-10, None) / 440.0)
    return jnp.round(midi).astype(int) % 12

# Build chromagram: sum power spectrum energy for each pitch class
chromagram = jnp.zeros((power_spec.shape[0], 12))
valid_freqs = freqs[1:]  # skip DC
valid_power = power_spec[:, 1:]

for p in range(12):
    # Find frequency bins belonging to this pitch class
    chroma_bins = freq_to_chroma(valid_freqs)
    mask = (chroma_bins == p).astype(jnp.float32)
    chromagram = chromagram.at[:, p].set(
        jnp.sum(valid_power * mask[None, :], axis=1)
    )

# Normalise each frame
chromagram = chromagram / (jnp.max(chromagram, axis=1, keepdims=True) + 1e-8)

# Visualisation
fig, axes = plt.subplots(3, 1, figsize=(14, 10))

# Waveform
axes[0].plot(t[:3000], signal[:3000], color='#3498db', linewidth=0.5,
             label='C major')
axes[0].plot(t[half:half+3000], signal[half:half+3000], color='#e74c3c',
             linewidth=0.5, label='G major')
axes[0].set_title('Waveform: C major → G major')
axes[0].set_ylabel('Amplitude')
axes[0].set_xlabel('Time (s)')
axes[0].legend()

# Spectrogram (log scale)
time_axis = jnp.arange(power_spec.shape[0]) * hop_length / sr
axes[1].imshow(jnp.log1p(power_spec[:, :500].T), aspect='auto', origin='lower',
               cmap='magma', extent=[0, time_axis[-1], 0, freqs[500]])
axes[1].set_title('Power Spectrogram')
axes[1].set_ylabel('Frequency (Hz)')
axes[1].set_xlabel('Time (s)')

# Chromagram
im = axes[2].imshow(chromagram.T, aspect='auto', origin='lower', cmap='YlOrRd',
                     extent=[0, time_axis[-1], -0.5, 11.5])
axes[2].set_yticks(range(12))
axes[2].set_yticklabels(note_names)
axes[2].set_title('Chromagram (pitch class energy over time)')
axes[2].set_ylabel('Pitch class')
axes[2].set_xlabel('Time (s)')
plt.colorbar(im, ax=axes[2], fraction=0.046, label='Normalised energy')

# Mark expected active pitch classes
mid_frame = chromagram.shape[0] // 2
print(f"C major region - expected: C, E, G")
print(f"  Chroma values: {dict(zip(note_names, [f'{v:.2f}' for v in chromagram[mid_frame//2]]))}")
print(f"G major region - expected: G, B, D")
print(f"  Chroma values: {dict(zip(note_names, [f'{v:.2f}' for v in chromagram[mid_frame + mid_frame//2]]))}")

plt.tight_layout()
plt.show()
```

## 源分离与噪声消除

_源分离与噪声消除技术能够从混合音频中恢复出各个独立的信号，这实际上就是解决“鸡尾酒会问题”。本文件介绍了ICA、NMF、时频掩蔽、波束成形、深度学习分离模型（如Conv-TasNet、SepFormer）、语音增强以及自适应噪声消除等技术。_

- 想象自己身处一个拥挤的鸡尾酒会上：有数十人同时交谈，音乐在播放，玻璃杯相互碰撞发出声响，但你却能专注于某一段对话并清晰地理解它。这种能力被称为“鸡尾酒会问题”（Cherry，1953年提出），人类听觉系统可以轻松实现这一功能，而机器则面临极大挑战。本文件介绍了各种试图解决该问题的算法：分离混合音频中的不同信号、消除不必要的噪声，以及在恶劣条件下提升语音质量。

- 文件01中介绍的信号处理基础知识（如STFT、频谱图、滤波器组）是所有这些方法的基础。文件02中的矩阵分解技术（如NMF、ICA、SVD）则构成了传统的解决方案工具箱。文件06中的深度学习架构（如CNN、RNN、注意力机制），以及文件04/05中的概率论知识，则为现代解决方案提供了支持。

![鸡尾酒会问题：多个说话者和声源在麦克风阵列中混合在一起，分离系统需要从这些混合信号中恢复出各个独立的声源信号](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/cocktail_party.svg)

- **问题描述**：在一个或多个麦克风处可以观测到混合信号$x(t)$。在最简单的情况下，该混合信号是由$C$个独立声源信号叠加而成的：

$$x(t) = \sum_{c=1}^{C} s_c(t) + n(t)$$

其中，$s_c(t)$是第$c$个声源信号，$n(t)$则是背景噪声。目标是从$x(t)$中恢复出各个独立的$s_c(t)$信号。在仅使用一个麦克风的情况下，这个问题存在严重的欠定性问题：一个方程对应$C$个未知数。因此需要一些额外的假设（如统计独立性、频谱结构、先验知识）才能使问题得以解决。

- 在频域中（通过文件01中的STFT技术），混合信号可表示为：

$$X(t, f) = \sum_{c=1}^{C} S_c(t, f) + N(t, f)$$

- 许多分离方法都是在时频域中工作的，其原理是为每个声源估计一个属于$[0, 1]$范围的**掩码**$M_c(t, f)$，然后通过$\hat{S}_c(t, f) = M_c(t, f) \cdot X(t, f)$来恢复出对应的声源信号。**理想二值掩码**则规定：如果声源$c$在某个时频窗口内占主导地位，则$M_c(t, f)=1$，否则为0。**理想比率掩码**则是一种更为柔和的版本：

$$\text{IRM}_c(t, f) = \frac{|S_c(t, f)|^2}{\sum_{j=1}^{C} |S_j(t, f)|^2}$$

- 当麦克风的数量等于或大于声源数量时，**独立成分分析**是一种经典的解决方案。ICA通过寻找一个线性解混矩阵$W$，使得$\hat{s} = Wx$，这样得到的恢复信号$\hat{s}$在统计上具有最大的独立性。这一方法的关键假设是声源信号为非高斯分布且彼此独立，这一假设通常适用于语音和音乐信号。

- 对于多麦克风下的瞬时混合模型$x = As$（其中$A$为混合矩阵），ICA通过最大化输出信号的非高斯特性（FastICA算法使用负熵作为度量标准），或最小化互信息，来求得$W \approx A^{-1}$。ICA在受控环境中表现良好，但当混合过程中存在卷积效应（如房间混响）、声源数量超过麦克风数量，或是独立性假设不成立时，该方法就不再适用。

- **非负矩阵分解**可以将幅度频谱图$V \in \mathbb{R}_+^{F \times T}$分解为两个非负矩阵的乘积（见文件02）：

$$V \approx WH$$

其中，$W \in \mathbb{R}_+^{F \times K}$代表了$K$个频谱基向量，而$H \in \mathbb{R}_+^{K \times T}$则包含了随时间变化的激活系数。非负性约束源于物理现实：声音的幅度始终为非负值，且各种声音信号是线性叠加的。

- 在源分离应用中，NMF会为每个声源学习不同的特征字典：$W_{\text{speech}}$用于捕捉语音的频谱特征（如共振峰结构），而$W_{\text{noise}}$则用于捕捉噪声的特征。混合信号可以被分解为$V \approx W_{\text{speech}} H_{\text{speech}} + W_{\text{noise}} H_{\text{noise}}$的形式，随后通过掩码技术即可恢复出各个声源信号。NMF的优化过程通常采用乘法更新方式，以弗罗贝尼乌斯范数或KL散度作为代价函数。

$$
\begin{aligned}
\text{Frobenius:} \quad D_F(V \| WH) &= \|V - WH\|_F^2 \\
\text{KL:} \quad D_{KL}(V \| WH) &= \sum_{f,t} \left[ V_{ft} \log \frac{V_{ft}}{(WH)_{ft}} - V_{ft} + (WH)_{ft} \right]
\end{aligned}

$$

- **波束成形**技术利用麦克风阵列的空间信息。当声源信号因空间布局而以不同延迟到达各个麦克风时，可以利用这些延迟来增强来自某个方向的信号，同时抑制其他方向的信号。

![波束成形：麦克风阵列接收来自不同方向的、具有不同时间延迟的信号，波束成形器将这些信号合并起来，从而增强目标方向的信号，同时抑制其他方向的信号](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/beamforming.svg)

- **延时求和波束成形**是最简单的方法。如果目标声源相对于麦克风阵列的角度为$\theta$，那么第$m$个麦克风处的时间延迟为$\tau_m(\theta) = d_m \sin \theta / c$，其中$d_m$是该麦克风的位置，$c$是声速。波束成形器的输出就是将所有麦克风接收到的信号对齐并相加：

$$y(t) = \frac{1}{M} \sum_{m=1}^{M} x_m(t - \tau_m(\theta))$$

- 来自目标方向的信号会以相干的方式叠加，而来自其他方向的信号则以非相干方式叠加，这样就实现了空间滤波效果。麦克风阵列的几何结构决定了其空间分辨率：阵列越大，产生的波束就越窄。

- **最小方差无失真响应（MVDR）波束成形**技术通过优化权重，在不扭曲目标方向信号的前提下，使总输出功率达到最小：

$$
\begin{aligned}
\min_{\mathbf{w}} \quad & \mathbf{w}^H \Phi_{nn} \mathbf{w} \\
\text{subject to} \quad & \mathbf{w}^H \mathbf{d}(\theta) = 1
\end{aligned}

$$

- 其中，$\Phi_{nn}$是噪声的空间协方差矩阵，$\mathbf{d}(\theta)$则是方向为$\theta$的导向向量。其解析解为：

$$\mathbf{w}_{\text{MVDR}} = \frac{\Phi_{nn}^{-1} \mathbf{d}(\theta)}{\mathbf{d}(\theta)^H \Phi_{nn}^{-1} \mathbf{d}(\theta)}$$

- MVDR通过利用估算得到的噪声协方差来适应不同的噪声环境，因此比延迟求和法具有更强的干扰抑制能力。它被广泛应用于助听器、智能音箱以及视频会议系统中。

- **深度学习在源分离中的应用**显著提升了处理性能，尤其是在传统方法难以处理的单麦克风场景中。其基本流程为：对混合信号进行编码，利用神经网络估算出各声源的表征，最后再解码以恢复各个独立的声源信号。

- **深度聚类技术**（Hershey等人，2016年）将每个时频单元映射到高维空间中，使得属于同一声源的单元彼此靠近，而来自不同声源的单元则相距较远。双向LSTM模型（见第06章）会将每个时频单元$(t, f)$映射为一个嵌入向量$v_{t,f} \in \mathbb{R}^D$。训练目标为：

$$\mathcal{L} = \|VV^T - YY^T\|_F^2$$

- 其中，$V$是嵌入向量矩阵，$Y$则是表示声源归属的独热矩阵。$VV^T$表示两个嵌入向量之间的相似度，而$YY^T$则表示理想情况下的相似度——若属于同一声源则为1，否则为0。在推理阶段，通过对这些嵌入向量进行K均值聚类，就可以得到二进制形式的声源掩码。

- **Conv-TasNet**（Luo和Mesgarani，2019年）完全在时域内进行操作，无需使用STFT算法。该模型由三个部分组成：

![Conv-TasNet架构图：编码器将混合波形转换为潜在表示，时序卷积网络用于估算声源掩码，解码器则用于恢复各个独立的声源波形](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/conv_tasnet.svg)

- **编码器**：1D卷积操作可将混合波形的短片段转换为潜在表示。对于一个长度为$x \in \mathbb{R}^T$的混合信号，编码器的输出为$w = \text{ReLU}(U \ast x) \in \mathbb{R}^{N \times L}$，其中$U$是可学习的基函数（类似于STFT中的基函数，但是由数据学习得到的），$N$是基函数的数量，$L$则是信号的分段数。编码器的核大小和步长（通常为2毫秒和1毫秒）决定了时间分辨率。

- **分离器**：**时序卷积网络（TCN）**负责处理经过编码的混合信号，并输出$C$个声源掩码。TCN通过堆叠多层具有逐层放大倍率的1D深度可分离卷积层来实现这一功能，放大倍率依次为$1, 2, 4, \ldots, 2^{B-1}$，共重复$R$次。这样的设计能够在保持计算效率的同时获得非常大的感受野。

- **解码器**：通过转置后的1D卷积操作（使用可学习的基函数$V$），可以将每个掩码对应的潜在表示转换回时域信号：$\hat{s}_c = V^T (M_c \odot w)$。

- Conv-TasNet的性能远远优于基于频谱图的方法，因为它所使用的编码器-解码器基函数能够捕捉到STFT算法所忽略的信息，尤其是相位信息。

- **双路径RNN（DPRNN）**（Luo等人，2020年）解决了源分离任务中长序列建模的问题。该算法不会用单个RNN或TCN来处理整个编码后的序列，而是将序列分割成多个重叠的片段，然后分别沿两条路径应用RNN：一条是**片段内部路径**，用于建模每个片段内的局部模式；另一条是**片段间路径**，用于建模不同片段之间的全局模式。这样一来，RNN需要处理的序列长度就从$L$降到了$\sqrt{L}$。

$$
\begin{aligned}
\text{Intra-chunk:} \quad & h_{k,n}^{\text{intra}} = \text{BiLSTM}_{\text{intra}}(z_{k,n}) \\
\text{Inter-chunk:} \quad & h_{k,n}^{\text{inter}} = \text{BiLSTM}_{\text{inter}}(h_{k,n}^{\text{intra}})
\end{aligned}

$$

- 其中，$k$表示数据块编号，$n$表示该数据块内的位置。对于固定的$k$值，块内LSTM会处理$n$个位置上的数据；而对于固定的$n$值，块间LSTM则会处理$k$个数据块中的数据。

- **SepFormer**（Subakan等人，2021年）将双路径框架中的RNN替换为变换器结构（详见第07章）。块内变换器通过自注意力机制捕捉局部依赖关系，而块间变换器则用于捕捉全局依赖关系。多头注意力机制能够有效建模长距离依赖关系，且不会出现梯度消失的问题（详见第06章），因此SepFormer在处理长时长录音时表现尤为出色。在该模型上，SepFormer在WSJ0-2mix基准测试中取得了最优性能。

- **排列不变训练法（PIT）**解决了有监督源分离中的一个核心问题——标签分配的不确定性。如果网络有两个输出结果（对应两个说话者），那么哪个输出结果应该对应哪个说话者呢？这里并不存在自然的排序方式。PIT会计算所有可能的标签分配方式下的损失值，然后选择最小的那个值：

$$\mathcal{L}_{\text{PIT}} = \min_{\pi \in \mathcal{P}} \sum_{c=1}^{C} \ell(\hat{s}_{\pi(c)}, s_c)$$

- 其中，$\mathcal{P}$是集合$\{1, \ldots, C\}$的所有排列组合，$\ell$则是针对每个源的损失度量指标（通常是尺度不变的信噪比，即SI-SDR）。当$C = 2$时，只有2种排列方式；当$C = 3$时，则有6种排列方式。对于更大的$C$值，可以使用匈牙利算法高效地计算这些数值。

- **尺度不变的信噪比（SI-SDR）**是用于评估源分离性能的标准指标。

$$
\begin{aligned}
s_{\text{target}} &= \frac{\langle \hat{s}, s \rangle}{\|s\|^2} s \\
e_{\text{noise}} &= \hat{s} - s_{\text{target}} \\
\text{SI-SDR} &= 10 \log_{10} \frac{\|s_{\text{target}}\|^2}{\|e_{\text{noise}}\|^2}
\end{aligned}

$$

- 其中$\hat{s}$为估计得到的信号源，$s$为真实信号源。SI-SDR值不受估计结果整体幅度的影响，这一特性十分重要，因为相比分离质量而言，绝对幅度并非那么关键。SI-SDR值越高越好。目前最先进的系统在WSJ0-2mix数据集上能够实现约20-22分贝的SI-SDR提升。

- **音乐源分离**技术可以将音乐录音分解为不同的声部：人声、鼓声、贝斯声以及其他乐器声。这一技术可应用于卡拉OK（去除人声）、混音（调整各乐器音量）以及音频转写（逐个分析不同乐器声）等场景。

- **Open-Unmix**（Stoter等人，2019年）是一种基准算法，它利用三层双向LSTM网络，在幅度STFT域中为每个信号源生成软掩码。该算法为每个信号源单独使用对应的模型进行处理。虽然结构简单，但效果不错，因此被用作MUSDB18数据集上的标准测试方法。

- **Demucs**（Defossez等人，2019年；2021年升级为Hybrid Demucs）采用U-Net架构（见第08章），直接对波形进行处理。编码器通过步进卷积来压缩混合信号，解码器则通过带跳跃连接的转置卷积将信号恢复出来，且每个信号源都有独立的解码器模块。**Hybrid Demucs**则结合了时域和频域处理方式：编码器包含并行的时域处理模块和STFT处理模块，两者产生的特征会在解码器之前被融合在一起，从而同时保留精细的时间细节和频谱结构。

- Demucs在MUSDB18数据集上实现了最先进的分离效果，尤其是在人声分离方面表现优异。其U-Net架构与第08章中介绍的图像分割架构类似，即将信号分离问题视为一种“音频分割”任务。

- **主动噪声消除（ANC）**技术通过生成与噪声相抵消的反噪声信号来降低不需要的声音。以降噪耳机为例：麦克风会捕捉环境中的噪声，ANC系统则会生成与这些噪声相反的信号，理想情况下，噪声与反噪声信号相互抵消后就能实现静音效果。

- 其原理很简单：如果噪声为$n(t)$，则在同一位置生成$-n(t)$信号，这样就能得到静音效果：$n(t) + (-n(t)) = 0$。不过，要实现这一点，反噪声信号必须在时间、幅度和相位上与原始噪声完全匹配。哪怕有微小的误差，也会产生残余噪声或异常信号。

- **前馈式ANC**利用参考麦克风在噪声到达听者之前就将其捕获。这样一来，系统就有足够的时间来处理噪声并生成反噪声信号。参考信号会经过一个自适应滤波器，其输出结果会被从听者所在位置的噪声信号中减去。这种方法对于那些具有规律性的宽带噪声（如引擎噪音、风扇噪音）效果很好。

- **反馈式ANC**仅使用位于听者耳边的误差麦克风。系统根据实际听到的信号中的残余噪声来估算噪声强度，进而调整反噪声信号。反馈式ANC结构更简单（无需参考麦克风），但其带宽有限，且容易变得不稳定。

- **自适应滤波**是ANC技术背后的数学基础。滤波器系数必须不断适应变化的噪声环境。最常用的算法就是**最小二乘法（LMS）**滤波器。

![LMS自适应滤波器：参考信号先经过FIR滤波器，其输出结果与目标信号相减得到误差信号，该误差信号再被反馈回去以更新滤波器系数](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/lms_adaptive_filter.svg)

- **LMS算法**：一个具有系数$\mathbf{w} = [w_0, w_1, \ldots, w_{L-1}]^T$的FIR滤波器用于处理参考信号$\mathbf{x}(n) = [x(n), x(n-1), \ldots, x(n-L+1)]^T$。滤波器的输出为$y(n) = \mathbf{w}^T \mathbf{x}(n)$，误差则为$e(n) = d(n) - y(n)$（其中$d(n)$为目标/原始信号），权重更新公式为：

$$\mathbf{w}(n+1) = \mathbf{w}(n) + \mu \, e(n) \, \mathbf{x}(n)$$

- 其中$\mu$为步长（即学习率）。这实际上是对均方误差$E[e^2(n)]$进行随机梯度下降处理，此时使用的是瞬时梯度估计值$-2 e(n) \mathbf{x}(n)$，而非真正的梯度值（相关内容可见第03章的梯度下降算法及第06章的SGD算法）。

- 步长$\mu$决定了算法的收敛速度与稳态误差之间的平衡。如果步长过大，滤波器可能会振荡或发散；如果步长过小，则适应过程会变得缓慢。稳定性条件为$0 < \mu < 2 / (\lambda_{\max})$，其中$\lambda_{\max}$是输入自相关矩阵$R = E[\mathbf{x}\mathbf{x}^T]$的最大特征值。

- **归一化LMS（NLMS）**算法通过输入信号的功率来归一化步长，从而使算法的收敛性不受信号强度的影响：

$$\mathbf{w}(n+1) = \mathbf{w}(n) + \frac{\mu}{\|\mathbf{x}(n)\|^2 + \epsilon} \, e(n) \, \mathbf{x}(n)$$

- 其中$\epsilon$是一个很小的正则化常数，用于避免出现除零错误。由于有效步长会随输入信号功率而变化，因此NLMS算法的收敛性比LMS算法更可靠。

- **递归最小二乘法（RLS）**是一种收敛速度更快的替代算法，它通过最小化加权最小二乘代价$\sum_{k=1}^{n} \lambda^{n-k} e^2(k)$来实现优化，其中$\lambda \in (0, 1]$为遗忘因子。RLS算法会维护一个逆自相关矩阵的估计值，并通过递归方式不断更新该矩阵，从而实现最优收敛效果，不过每处理一个样本所需的计算量为$O(L^2)$，而LMS算法的计算量为$O(L)$。

- **噪声降低与语音增强**技术旨在改善嘈杂环境下的语音质量和清晰度。与那些用于分离不同信号源的源分离技术不同，语音增强技术专门针对“语音+噪声”的混合信号，旨在从含噪声的信号中恢复出清晰的语音。

- **频谱减法**是最简单的处理方法。在仅存在噪声的帧中（可通过文件03中的VAD功能检测出来），首先估算出噪声的频谱$|\hat{N}(f)|^2$，然后从每个帧的信号中减去这个值：

$$|\hat{S}(f)|^2 = \max(|X(f)|^2 - \alpha |\hat{N}(f)|^2, \beta |X(f)|^2)$$

- 其中，$\alpha$为过减因子（通常取值在1到4之间；过大的减法操作虽然能去除更多噪声，但也会产生更多伪影），而$\beta$则是一个阈值，用于防止出现负数值，并减少“音乐噪声”伪影（即那些听起来像随机音符的孤立音调）。

- **维纳滤波**能够给出纯净语音频谱的最小均方误差估计值：

$$\hat{S}(t, f) = \frac{|S(t,f)|^2}{|S(t,f)|^2 + |N(t,f)|^2} \cdot X(t, f) = G(t, f) \cdot X(t, f)$$

- 维纳增益$G(t, f) = \text{SNR}(t, f) / (1 + \text{SNR}(t, f))$的取值范围从0（纯噪声）到1（纯语音），它实际上起到一种软掩模的作用。难点在于如何准确估计语音和噪声的功率谱。**先验信噪比**$\xi(t, f) = |S(t,f)|^2 / |N(t,f)|^2$则是通过“基于决策的方法”来估算的：即当前帧的估算值与上一帧经过维纳滤波后的输出值相结合后进行平滑处理。

- **神经网络语音增强技术**则利用深度学习来直接生成掩模（类似维纳增益的功能）或纯净的频谱图。这类技术的架构多种多样，从简单的反馈网络到U-Net（见第08章）、卷积循环网络以及变换器等都有。

- **DCCRN**（深度复杂卷积循环网络）是对复数形式的STFT结果进行处理的——它同时考虑幅度和相位信息，利用复数域的卷积运算来自然地处理实部和虚部，从而避免了仅基于幅度处理的相位估算问题。

- **FullSubNet**采用双路径架构，其中一个路径使用全频带模型来捕捉整体频谱特征，另一个路径则使用子频带模型来捕捉各个频率点附近的局部谐波细节。全频带模型负责处理整个频谱，而子频带模型则处理以每个频率点为中心的窄频带。最终，这两个路径的输出会被结合起来，从而得到最终的掩模估计值。

- 微软每年都会举办**DNS（深度噪声抑制）挑战赛**，以此来评估各种语音增强系统的性能。获胜的系统通常采用大规模训练数据、多种类型的噪声模拟、数据增强技术（如在不同信噪比下添加噪声、混响效果以及编码器产生的伪影等），并且还具备实时处理能力。

- **回声消除技术**用于消除双向通信中的声学回声。在打电话时，对方说话的声音会通过扬声器传出，然后在房间内反射，再被麦克风捕获，从而形成回声，让对方也能听到。**声学回声消除技术**会模拟从扬声器到麦克风的声学路径，然后减去预测出的回声信号。

- 声学路径是通过自适应FIR滤波器来建模的（可使用LMS或NLMS算法），其输入为对方的信号。该滤波器能够模拟房间的脉冲响应，其中包括直接路径、早期反射以及后期混响效应。房间的脉冲响应可能长达数百毫秒，因此需要具有数千个滤波系数的滤波器。

- **双话检测**对于回声消除来说非常重要：当通话双方同时说话时，自适应滤波器必须停止更新，这样才能避免消除掉近端说话者的声音。双话检测器会比较误差信号的强度与对方信号强度；如果误差信号强度突然上升，且这一上升无法用对方信号来解释，那就说明近端有说话声。

- 近端信号$x(n)$与麦克风信号$d(n)$之间的**归一化互相关值**可以用来判断是否存在双话现象：

$$\xi(n) = \frac{|\sum_{k=0}^{L-1} x(n-k) d(n-k)|}{\sqrt{\sum_{k} x^2(n-k)} \sqrt{\sum_{k} d^2(n-k)}}$$

- 在只有远端说话的情况下，$\xi$的值会很高，因为$d$信号基本上就是$x$信号的回声。而在双话情况下，$\xi$的值会下降，因为近端的说话声与$x$信号之间没有相关性。

- 现代回声消除系统会将自适应滤波与神经网络结合使用：自适应滤波器首先给出回声的初步估计值，而后神经网络（类似于上述的语音增强模型）则负责消除剩余的回声，并处理线性滤波器无法处理的非线性问题（如扬声器的失真现象）。

- **用于源分离与语音增强的评估指标**：
- **SI-SDR**（上文已定义）：用于源分离的标准指标。
- **SDR**（信噪比）：来自BSS Eval的标准，用于衡量包括伪影和干扰在内的整体分离质量。
- **PESQ**（语音质量感知评估指标）：ITU制定的标准，用于预测主观语音质量评分，其数值范围为-0.5到4.5。
- **STOI**（短时客观可懂度指标）：用于预测语音的可懂度，其数值范围为0到1。
- **DNSMOS**：微软开发的深度噪声抑制MOS预测模型，它是一种神经网络，无需纯净的参考音频即可预测人类的MOS评分。

## 编码任务（可使用CoLab或笔记本完成）（续1）

- **任务1：利用独立成分分析进行源分离。** 实现FastICA算法，对两个混合在一起的音频源进行分离，从而展示在特定条件下（即音频源和麦克风数量相等时）的经典解决方案。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Generate two source signals
sr = 8000
duration = 1.0
t = jnp.linspace(0, duration, int(sr * duration))

# Source 1: sinusoidal (like a tone)
s1 = jnp.sin(2 * jnp.pi * 440 * t) + 0.3 * jnp.sin(2 * jnp.pi * 880 * t)

# Source 2: sawtooth-like (rich harmonics)
s2 = 2 * (t * 200 % 1) - 1  # sawtooth at 200 Hz

# Normalise sources
s1 = s1 / jnp.max(jnp.abs(s1))
s2 = s2 / jnp.max(jnp.abs(s2))
sources = jnp.stack([s1, s2])  # (2, T)

# Mixing matrix (unknown to the algorithm)
A = jnp.array([[0.8, 0.4],
               [0.3, 0.9]])
mixtures = A @ sources  # (2, T)

# FastICA implementation
def whiten(X):
    """Centre and whiten the data."""
    X_centered = X - jnp.mean(X, axis=1, keepdims=True)
    cov = (X_centered @ X_centered.T) / X_centered.shape[1]
    eigvals, eigvecs = jnp.linalg.eigh(cov)
    D_inv_sqrt = jnp.diag(1.0 / jnp.sqrt(eigvals + 1e-8))
    whitening = D_inv_sqrt @ eigvecs.T
    return whitening @ X_centered, whitening

def fastica(X, n_components=2, max_iter=200, tol=1e-6):
    """FastICA using tanh non-linearity (approximation to negentropy)."""
    X_white, whitening = whiten(X)
    n, T = X_white.shape

    key = jr.PRNGKey(42)
    W = jr.normal(key, (n_components, n))
    # Orthogonalise W
    U, _, Vt = jnp.linalg.svd(W, full_matrices=False)
    W = U @ Vt

    for iteration in range(max_iter):
        W_old = W.copy()

        # For each component
        for i in range(n_components):
            w = W[i]
            # w^T X_white: (T,)
            wx = w @ X_white  # (T,)

            # g(u) = tanh(u), g'(u) = 1 - tanh^2(u)
            g_wx = jnp.tanh(wx)
            g_prime_wx = 1 - g_wx ** 2

            # Newton update: w_new = E[X * g(w^T X)] - E[g'(w^T X)] * w
            w_new = jnp.mean(X_white * g_wx[None, :], axis=1) - \
                    jnp.mean(g_prime_wx) * w

            # Decorrelate from previous components (deflation)
            for j in range(i):
                w_new = w_new - jnp.dot(w_new, W[j]) * W[j]

            w_new = w_new / jnp.linalg.norm(w_new)
            W = W.at[i].set(w_new)

        # Check convergence
        convergence = jnp.min(jnp.abs(jnp.diag(W @ W_old.T)))
        if convergence > 1 - tol:
            print(f"FastICA converged in {iteration + 1} iterations")
            break

    # Unmixing matrix
    unmixing = W @ whitening
    recovered = unmixing @ X
    return recovered, unmixing

recovered, W_unmix = fastica(mixtures)

# Fix sign ambiguity (ICA can flip signs)
for i in range(2):
    if jnp.corrcoef(recovered[i], sources[i])[0, 1] < -0.5:
        recovered = recovered.at[i].set(-recovered[i])

# If sources are swapped, fix permutation
corr_00 = jnp.abs(jnp.corrcoef(recovered[0], sources[0])[0, 1])
corr_01 = jnp.abs(jnp.corrcoef(recovered[0], sources[1])[0, 1])
if corr_01 > corr_00:
    recovered = recovered[::-1]

# Normalise for display
recovered = recovered / jnp.max(jnp.abs(recovered), axis=1, keepdims=True)

fig, axes = plt.subplots(3, 2, figsize=(14, 9))

axes[0, 0].plot(t[:1000], s1[:1000], color='#3498db', linewidth=0.8)
axes[0, 0].set_title('Source 1 (Original)')
axes[0, 0].set_ylabel('Amplitude')

axes[0, 1].plot(t[:1000], s2[:1000], color='#e74c3c', linewidth=0.8)
axes[0, 1].set_title('Source 2 (Original)')

axes[1, 0].plot(t[:1000], mixtures[0, :1000], color='#9b59b6', linewidth=0.8)
axes[1, 0].set_title('Mixture 1 (Microphone 1)')
axes[1, 0].set_ylabel('Amplitude')

axes[1, 1].plot(t[:1000], mixtures[1, :1000], color='#9b59b6', linewidth=0.8)
axes[1, 1].set_title('Mixture 2 (Microphone 2)')

axes[2, 0].plot(t[:1000], recovered[0, :1000], color='#27ae60', linewidth=0.8)
axes[2, 0].set_title('Recovered Source 1 (FastICA)')
axes[2, 0].set_ylabel('Amplitude')
axes[2, 0].set_xlabel('Time (s)')

axes[2, 1].plot(t[:1000], recovered[1, :1000], color='#f39c12', linewidth=0.8)
axes[2, 1].set_title('Recovered Source 2 (FastICA)')
axes[2, 1].set_xlabel('Time (s)')

plt.tight_layout()
plt.show()

# Report correlation with originals
for i in range(2):
    corr = jnp.corrcoef(recovered[i], sources[i])[0, 1]
    print(f"Source {i+1} recovery correlation: {corr:.4f}")
```

- **任务2：基于NMF的频谱图源分离。**利用非负矩阵分解技术（第02章所述方法）将频谱图分解为两个组成部分，从而展示NMF是如何为每个声源建立相应的频谱特征的。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Generate two signals with distinct spectral characteristics
sr = 8000
duration = 1.0
t = jnp.linspace(0, duration, int(sr * duration))

# Source 1: low-frequency harmonic (simulating bass)
src1 = (jnp.sin(2 * jnp.pi * 100 * t) +
        0.5 * jnp.sin(2 * jnp.pi * 200 * t) +
        0.3 * jnp.sin(2 * jnp.pi * 300 * t))

# Source 2: high-frequency harmonic (simulating a flute)
src2 = (jnp.sin(2 * jnp.pi * 800 * t) +
        0.4 * jnp.sin(2 * jnp.pi * 1600 * t))

# Time-varying amplitudes (sources active at different times)
env1 = jnp.where(t < 0.5, 1.0, 0.3)
env2 = jnp.where(t > 0.3, 1.0, 0.2)
src1 = src1 * env1
src2 = src2 * env2

mixture = src1 + src2

# Compute magnitude spectrogram (STFT)
n_fft = 512
hop = 128
window = jnp.hanning(n_fft)

def compute_stft(signal, n_fft, hop, window):
    n_frames = 1 + (len(signal) - n_fft) // hop
    frames = jnp.stack([
        signal[i * hop : i * hop + n_fft] * window
        for i in range(n_frames)
    ])
    return jnp.fft.rfft(frames, n=n_fft)

S_mix = compute_stft(mixture, n_fft, hop, window)
V = jnp.abs(S_mix).T  # (F, T) - frequency x time
phase = jnp.angle(S_mix).T

F, T = V.shape
print(f"Spectrogram shape: {F} freq bins x {T} time frames")

# NMF: V ≈ WH using multiplicative update rules
def nmf(V, K, n_iter=200, key=jr.PRNGKey(0)):
    """Non-negative Matrix Factorisation with Frobenius norm."""
    k1, k2 = jr.split(key)
    W = jnp.abs(jr.normal(k1, (F, K))) * 0.1 + 0.01  # (F, K)
    H = jnp.abs(jr.normal(k2, (K, T))) * 0.1 + 0.01  # (K, T)

    costs = []
    for i in range(n_iter):
        # Multiplicative update for H
        WtV = W.T @ V
        WtWH = W.T @ W @ H + 1e-8
        H = H * (WtV / WtWH)

        # Multiplicative update for W
        VHt = V @ H.T
        WHHt = W @ H @ H.T + 1e-8
        W = W * (VHt / WHHt)

        cost = jnp.sum((V - W @ H) ** 2)
        costs.append(float(cost))

    return W, H, costs

# Run NMF with K=2 components
K = 2
W, H, costs = nmf(V, K, n_iter=300)

# Reconstruct each source using soft masks
V_hat = W @ H
mask1 = (W[:, 0:1] @ H[0:1, :]) / (V_hat + 1e-8)
mask2 = (W[:, 1:2] @ H[1:2, :]) / (V_hat + 1e-8)

V_src1 = mask1 * V
V_src2 = mask2 * V

# Visualisation
fig, axes = plt.subplots(3, 2, figsize=(14, 10))

# Mixture spectrogram
axes[0, 0].imshow(jnp.log1p(V), aspect='auto', origin='lower', cmap='magma')
axes[0, 0].set_title('Mixture Spectrogram |X|')
axes[0, 0].set_ylabel('Frequency bin')

# NMF convergence
axes[0, 1].plot(costs, color='#3498db', linewidth=1.5)
axes[0, 1].set_title('NMF Convergence')
axes[0, 1].set_xlabel('Iteration')
axes[0, 1].set_ylabel('Frobenius cost')
axes[0, 1].set_yscale('log')

# Spectral basis vectors W
freq_hz = jnp.arange(F) * sr / n_fft
axes[1, 0].plot(freq_hz, W[:, 0], color='#27ae60', linewidth=1.5,
                label='Basis 1 (low freq)')
axes[1, 0].plot(freq_hz, W[:, 1], color='#e74c3c', linewidth=1.5,
                label='Basis 2 (high freq)')
axes[1, 0].set_title('Learned Spectral Bases W')
axes[1, 0].set_xlabel('Frequency (Hz)')
axes[1, 0].set_ylabel('Magnitude')
axes[1, 0].legend()

# Temporal activations H
time_s = jnp.arange(T) * hop / sr
axes[1, 1].plot(time_s, H[0], color='#27ae60', linewidth=1.5,
                label='Activation 1')
axes[1, 1].plot(time_s, H[1], color='#e74c3c', linewidth=1.5,
                label='Activation 2')
axes[1, 1].set_title('Temporal Activations H')
axes[1, 1].set_xlabel('Time (s)')
axes[1, 1].set_ylabel('Activation')
axes[1, 1].legend()

# Separated spectrograms
axes[2, 0].imshow(jnp.log1p(V_src1), aspect='auto', origin='lower', cmap='magma')
axes[2, 0].set_title('Separated Source 1 (low-frequency)')
axes[2, 0].set_ylabel('Frequency bin')
axes[2, 0].set_xlabel('Time frame')

axes[2, 1].imshow(jnp.log1p(V_src2), aspect='auto', origin='lower', cmap='magma')
axes[2, 1].set_title('Separated Source 2 (high-frequency)')
axes[2, 1].set_xlabel('Time frame')

plt.tight_layout()
plt.show()

print(f"Reconstruction error: {jnp.sum((V - W @ H)**2):.2f}")
print(f"NMF learns spectral bases that capture each source's frequency profile.")
```

- **任务3：用于噪声消除的LMS自适应滤波器。** 实现用于回声/噪声消除的LMS和NLMS算法，展示其收敛行为以及步长对性能的影响。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Simulate an echo cancellation scenario
# Far-end signal -> room impulse response -> echo at microphone
# Near-end speech is the desired signal we want to preserve

sr = 8000
duration = 2.0
n_samples = int(sr * duration)
key = jr.PRNGKey(42)
keys = jr.split(key, 5)

# Far-end signal (reference): random speech-like signal
far_end = jr.normal(keys[0], (n_samples,)) * 0.5

# Room impulse response (unknown to the algorithm)
rir_length = 64
rir = jnp.zeros(rir_length)
rir = rir.at[0].set(0.8)   # direct path
rir = rir.at[5].set(0.3)   # early reflection
rir = rir.at[12].set(-0.2) # reflection
rir = rir.at[25].set(0.1)  # late reflection
rir = rir.at[40].set(-0.05)

# Echo: convolution of far-end with RIR
echo = jnp.convolve(far_end, rir)[:n_samples]

# Near-end speech (active in a portion of the signal)
near_end = jnp.zeros(n_samples)
start, end = n_samples // 3, 2 * n_samples // 3
near_speech = 0.3 * jnp.sin(
    2 * jnp.pi * 300 * jnp.linspace(0, (end - start) / sr, end - start)
)
near_end = near_end.at[start:end].set(near_speech)

# Microphone signal: echo + near-end + noise
noise = jr.normal(keys[1], (n_samples,)) * 0.01
mic_signal = echo + near_end + noise

# LMS adaptive filter
def lms_filter(reference, desired, filter_length, mu):
    """Standard LMS adaptive filter."""
    n = len(reference)
    w = jnp.zeros(filter_length)
    output = jnp.zeros(n)
    error = jnp.zeros(n)
    w_history = []

    for i in range(filter_length, n):
        x = reference[i:i-filter_length:-1]  # reversed segment
        if len(x) < filter_length:
            x = jnp.pad(x, (0, filter_length - len(x)))
        x = reference[max(0, i-filter_length+1):i+1][::-1]

        y = jnp.dot(w, x)
        e = desired[i] - y
        w = w + mu * e * x

        output = output.at[i].set(y)
        error = error.at[i].set(e)

        if i % 500 == 0:
            w_history.append(w.copy())

    return output, error, w_history

# NLMS adaptive filter
def nlms_filter(reference, desired, filter_length, mu, eps=1e-6):
    """Normalised LMS adaptive filter."""
    n = len(reference)
    w = jnp.zeros(filter_length)
    output = jnp.zeros(n)
    error = jnp.zeros(n)

    for i in range(filter_length, n):
        x = reference[max(0, i-filter_length+1):i+1][::-1]

        y = jnp.dot(w, x)
        e = desired[i] - y
        norm_factor = jnp.dot(x, x) + eps
        w = w + (mu / norm_factor) * e * x

        output = output.at[i].set(y)
        error = error.at[i].set(e)

    return output, error

# Run LMS with different step sizes
filter_len = 64
mu_values = [0.001, 0.01, 0.05]
colors_mu = ['#3498db', '#e74c3c', '#27ae60']

fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Original signals
t = jnp.arange(n_samples) / sr
axes[0, 0].plot(t, mic_signal, color='#9b59b6', linewidth=0.5, alpha=0.7,
                label='Mic (echo + near-end)')
axes[0, 0].plot(t, echo, color='#e74c3c', linewidth=0.5, alpha=0.7,
                label='Echo (to cancel)')
axes[0, 0].plot(t, near_end, color='#27ae60', linewidth=0.8,
                label='Near-end speech (to preserve)')
axes[0, 0].set_title('Signal Components')
axes[0, 0].set_xlabel('Time (s)')
axes[0, 0].set_ylabel('Amplitude')
axes[0, 0].legend(fontsize=8)

# LMS convergence for different step sizes
for mu, color in zip(mu_values, colors_mu):
    _, err, _ = lms_filter(far_end, mic_signal, filter_len, mu)
    # Smoothed squared error
    sq_err = err ** 2
    window_size = 200
    smoothed = jnp.convolve(sq_err, jnp.ones(window_size)/window_size,
                             mode='valid')
    axes[0, 1].plot(smoothed, color=color, linewidth=1.2,
                    label=f'mu={mu}')

axes[0, 1].set_title('LMS Convergence (smoothed MSE)')
axes[0, 1].set_xlabel('Sample')
axes[0, 1].set_ylabel('Squared Error')
axes[0, 1].set_yscale('log')
axes[0, 1].legend()

# Best LMS result
_, err_lms, w_hist = lms_filter(far_end, mic_signal, filter_len, 0.01)
axes[1, 0].plot(t, mic_signal, color='#9b59b6', linewidth=0.5, alpha=0.4,
                label='Before cancellation')
axes[1, 0].plot(t, err_lms, color='#3498db', linewidth=0.5, alpha=0.8,
                label='After LMS cancellation')
axes[1, 0].plot(t, near_end, color='#27ae60', linewidth=0.8, alpha=0.5,
                label='True near-end')
axes[1, 0].set_title('LMS Echo Cancellation Result (mu=0.01)')
axes[1, 0].set_xlabel('Time (s)')
axes[1, 0].set_ylabel('Amplitude')
axes[1, 0].legend(fontsize=8)

# NLMS result
_, err_nlms = nlms_filter(far_end, mic_signal, filter_len, 0.5)
axes[1, 1].plot(t, mic_signal, color='#9b59b6', linewidth=0.5, alpha=0.4,
                label='Before cancellation')
axes[1, 1].plot(t, err_nlms, color='#f39c12', linewidth=0.5, alpha=0.8,
                label='After NLMS cancellation')
axes[1, 1].plot(t, near_end, color='#27ae60', linewidth=0.8, alpha=0.5,
                label='True near-end')
axes[1, 1].set_title('NLMS Echo Cancellation Result (mu=0.5)')
axes[1, 1].set_xlabel('Time (s)')
axes[1, 1].set_ylabel('Amplitude')
axes[1, 1].legend(fontsize=8)

plt.tight_layout()
plt.show()

# Measure echo reduction
echo_power = jnp.mean(echo ** 2)
lms_residual = jnp.mean(err_lms[n_samples//2:] ** 2)  # after convergence
nlms_residual = jnp.mean(err_nlms[n_samples//2:] ** 2)
print(f"Echo power: {10*jnp.log10(echo_power):.1f} dB")
print(f"LMS residual: {10*jnp.log10(lms_residual):.1f} dB "
      f"(ERLE: {10*jnp.log10(echo_power/lms_residual):.1f} dB)")
print(f"NLMS residual: {10*jnp.log10(nlms_residual):.1f} dB "
      f"(ERLE: {10*jnp.log10(echo_power/nlms_residual):.1f} dB)")
```

- **任务4：用于语音增强的时频掩蔽技术。** 实现一种简单的频谱掩蔽方法（理想比例掩蔽），并将其与频谱减法技术进行比较，同时通过合成噪声语音信号来评估两种方法的分离效果。

```python
import jax
import jax.numpy as jnp
import jax.random as jr
import matplotlib.pyplot as plt

# Create synthetic "speech" and "noise" signals
sr = 8000
duration = 2.0
t = jnp.linspace(0, duration, int(sr * duration))

# Speech: harmonic series with time-varying amplitude (simulating speech)
speech = jnp.zeros_like(t)
for f0 in [150, 300, 450, 600, 900]:
    amp_env = 0.5 + 0.5 * jnp.sin(2 * jnp.pi * 2.0 * t)  # 2 Hz modulation
    speech = speech + (0.5 / (f0/150)) * amp_env * jnp.sin(2 * jnp.pi * f0 * t)
speech = speech / jnp.max(jnp.abs(speech))

# Noise: band-limited noise
key = jr.PRNGKey(42)
noise_raw = jr.normal(key, t.shape) * 0.4

# Mix at a given SNR
snr_db = 5.0
speech_power = jnp.mean(speech ** 2)
noise_power = jnp.mean(noise_raw ** 2)
noise_scale = jnp.sqrt(speech_power / (noise_power * 10 ** (snr_db / 10)))
noise = noise_raw * noise_scale
mixture = speech + noise

# STFT
n_fft = 512
hop = 128
window = jnp.hanning(n_fft)

def stft(signal, n_fft, hop, window):
    n_frames = 1 + (len(signal) - n_fft) // hop
    frames = jnp.stack([
        signal[i * hop : i * hop + n_fft] * window
        for i in range(n_frames)
    ])
    return jnp.fft.rfft(frames, n=n_fft)

def istft(S, hop, window, length):
    n_fft = (S.shape[1] - 1) * 2
    n_frames = S.shape[0]
    frames = jnp.fft.irfft(S, n=n_fft) * window[None, :]
    output = jnp.zeros(length)
    window_sum = jnp.zeros(length)
    for i in range(n_frames):
        start = i * hop
        end = start + n_fft
        if end <= length:
            output = output.at[start:end].add(frames[i])
            window_sum = window_sum.at[start:end].add(window ** 2)
    window_sum = jnp.maximum(window_sum, 1e-8)
    return output / window_sum

S_speech = stft(speech, n_fft, hop, window)
S_noise = stft(noise, n_fft, hop, window)
S_mix = stft(mixture, n_fft, hop, window)

mag_speech = jnp.abs(S_speech)
mag_noise = jnp.abs(S_noise)
mag_mix = jnp.abs(S_mix)
phase_mix = jnp.angle(S_mix)

# Method 1: Ideal Ratio Mask (oracle - upper bound)
irm = mag_speech ** 2 / (mag_speech ** 2 + mag_noise ** 2 + 1e-8)
S_irm = (irm * mag_mix) * jnp.exp(1j * phase_mix)
enhanced_irm = istft(S_irm, hop, window, len(mixture))

# Method 2: Spectral subtraction
# Estimate noise from first 0.2s (assumed silence)
noise_frames = int(0.2 * sr / hop)
noise_est = jnp.mean(mag_mix[:noise_frames] ** 2, axis=0, keepdims=True)
alpha = 2.0  # over-subtraction factor
beta = 0.02  # spectral floor
mag_sub = jnp.maximum(mag_mix ** 2 - alpha * noise_est, beta * mag_mix ** 2)
mag_sub = jnp.sqrt(mag_sub)
S_sub = mag_sub * jnp.exp(1j * phase_mix)
enhanced_sub = istft(S_sub, hop, window, len(mixture))

# Method 3: Wiener filter
snr_est = mag_mix ** 2 / (noise_est + 1e-8)
wiener_gain = snr_est / (1 + snr_est)
S_wiener = (wiener_gain * mag_mix) * jnp.exp(1j * phase_mix)
enhanced_wiener = istft(S_wiener, hop, window, len(mixture))

# Compute SI-SDR for each method
def si_sdr(estimate, reference):
    """Scale-invariant signal-to-distortion ratio."""
    ref = reference[:len(estimate)]
    est = estimate[:len(reference)]
    s_target = (jnp.dot(est, ref) / (jnp.dot(ref, ref) + 1e-8)) * ref
    e_noise = est - s_target
    return 10 * jnp.log10(jnp.dot(s_target, s_target) /
                           (jnp.dot(e_noise, e_noise) + 1e-8))

si_sdr_mix = si_sdr(mixture, speech)
si_sdr_irm_val = si_sdr(enhanced_irm, speech)
si_sdr_sub_val = si_sdr(enhanced_sub, speech)
si_sdr_wiener_val = si_sdr(enhanced_wiener, speech)

# Visualisation
fig, axes = plt.subplots(3, 2, figsize=(14, 12))

# Spectrograms
axes[0, 0].imshow(jnp.log1p(mag_speech.T), aspect='auto', origin='lower',
                   cmap='magma')
axes[0, 0].set_title('Clean Speech Spectrogram')
axes[0, 0].set_ylabel('Frequency bin')

axes[0, 1].imshow(jnp.log1p(mag_mix.T), aspect='auto', origin='lower',
                   cmap='magma')
axes[0, 1].set_title(f'Noisy Mixture ({snr_db:.0f} dB SNR)')

# Masks
axes[1, 0].imshow(irm.T, aspect='auto', origin='lower', cmap='RdYlGn')
axes[1, 0].set_title('Ideal Ratio Mask (Oracle)')
axes[1, 0].set_ylabel('Frequency bin')

axes[1, 1].imshow(wiener_gain.T, aspect='auto', origin='lower', cmap='RdYlGn',
                   vmin=0, vmax=1)
axes[1, 1].set_title('Estimated Wiener Gain')

# Enhanced waveforms comparison
n_show = 3000
axes[2, 0].plot(t[:n_show], speech[:n_show], color='#27ae60', linewidth=0.8,
                alpha=0.5, label='Clean')
axes[2, 0].plot(t[:n_show], mixture[:n_show], color='#e74c3c', linewidth=0.5,
                alpha=0.4, label='Noisy')
axes[2, 0].plot(t[:n_show], enhanced_irm[:n_show], color='#3498db',
                linewidth=0.8, label='IRM enhanced')
axes[2, 0].set_title('Waveform Comparison (IRM)')
axes[2, 0].set_xlabel('Time (s)')
axes[2, 0].set_ylabel('Amplitude')
axes[2, 0].legend(fontsize=8)

# SI-SDR bar chart
methods = ['Mixture', 'Spectral\nSubtraction', 'Wiener\nFilter', 'Ideal Ratio\nMask']
sdr_values = [float(si_sdr_mix), float(si_sdr_sub_val),
              float(si_sdr_wiener_val), float(si_sdr_irm_val)]
bar_colors = ['#e74c3c', '#f39c12', '#9b59b6', '#27ae60']
bars = axes[2, 1].bar(methods, sdr_values, color=bar_colors, alpha=0.8)
axes[2, 1].set_ylabel('SI-SDR (dB)')
axes[2, 1].set_title('Enhancement Quality Comparison')
for bar, val in zip(bars, sdr_values):
    axes[2, 1].text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.3,
                    f'{val:.1f}', ha='center', fontsize=10)
axes[2, 1].axhline(0, color='gray', linestyle='--', linewidth=0.8)

plt.tight_layout()
plt.show()

print(f"SI-SDR (noisy mixture):        {si_sdr_mix:.2f} dB")
print(f"SI-SDR (spectral subtraction): {si_sdr_sub_val:.2f} dB")
print(f"SI-SDR (Wiener filter):        {si_sdr_wiener_val:.2f} dB")
print(f"SI-SDR (ideal ratio mask):     {si_sdr_irm_val:.2f} dB (oracle upper bound)")
```
