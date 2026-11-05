---
title: "计算机视觉"
date: "2026-11-05"
order: 8
slug: "compendium/08-computer-vision"
description: "图像基础介绍了数字图像在进入任何模型处理之前是如何被表示、形成以及经过预处理的。本文件涵盖了像素、颜色空间（RGB、HSV、YCbCr、LAB）、针孔相机模型、卷积运算、边缘检测（Sobel、Canny算法）、直方图以及特征描述子（SIFT"
tags: []
---

## 图像基础

_图像基础介绍了数字图像在进入任何模型处理之前是如何被表示、形成以及经过预处理的。本文件涵盖了像素、颜色空间（RGB、HSV、YCbCr、LAB）、针孔相机模型、卷积运算、边缘检测（Sobel、Canny算法）、直方图以及特征描述子（SIFT、ORB），这些都是用于低级视觉处理的工具。_

- **数字图像**实际上是一个由数字构成的二维网格。网格中的每个单元格就是一个**像素**，其数值代表该位置的亮度或颜色。灰度图像则是一个二维矩阵，每个像素都对应一个亮度值，对于8位图像而言，该数值通常在0（黑色）到255（白色）之间。

- 彩色图像则在这一基础上增加了三个通道。在**RGB**颜色空间中，每个像素存储着红色、绿色和蓝色的亮度值。

- 彩色图像可以看作是一个形状为（高度，宽度，3）的三维张量。通过以不同的强度混合这三种颜色，就可以得到所有可见的颜色。

![彩色图像被分解为红色、绿色和蓝色通道，每种颜色都以灰度强度图的形式呈现](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/rgb_channels.svg)

- **位深**决定了每个通道能够表示多少种不同的亮度级别。

- 8位图像每个通道有$2^8 = 256$种亮度级别，因此总共可以产生$256^3 \approx 1670$万种颜色。而16位图像每个通道则有65,536种亮度级别，这类格式常用于医学成像和HDR摄影，因为这些应用需要精确的亮度差异表现。

- RGB颜色空间适合用于显示器显示，但对于其他任务来说，还有其他更合适的颜色空间。

- **HSV**（色调、饱和度、明度）将颜色信息与亮度分离。色调指的是纯粹的颜色（以颜色轮为基准，范围为0-360度），饱和度则表示颜色的鲜艳程度（0表示灰色，1表示纯色），而明度则代表亮度。由于可以根据色调来设定阈值，而不受光照条件的影响，因此HSV非常适合用于基于颜色的图像分割。在HSV颜色空间中识别“红色物体”要比在RGB空间中容易得多。

- **YCbCr**将亮度信息（Y，即感知到的亮度）与色度信息（Cb、Cr，即颜色差异信号）分开。这种颜色空间被广泛应用于JPEG压缩和视频编码中。人类的视觉系统对亮度的敏感度高于对颜色的敏感度，因此色度信息可以用较低的分辨率来存储，而不会造成明显的视觉差异。

- **LAB**（CIELAB）是一种这样的颜色空间：两种颜色之间的数值距离就对应着它们在人眼看来之间的差异。在LAB空间中，相同的数值变化在人眼中看起来也是相同的颜色变化。L通道代表亮度，A通道的值从绿色到红色变化，B通道的值则从蓝色到黄色变化。当需要进行基于感知均匀性的颜色比较时，就会使用LAB颜色空间。

- **图像形成**描述了如何将三维场景转换成二维图像。最简单的模型就是**针孔相机**：场景中的光线穿过一个小孔，然后投射到其后的传感器平面上。世界坐标系中的点$(X, Y, Z)$会对应到像素坐标$(u, v)$上：

$$
\begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = \frac{1}{Z} \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} X \\ Y \\ Z \end{bmatrix}

$$

- 3×3矩阵即为**内参矩阵**$K$。它包含了相机的内部参数：焦距$f_x、f_y$（决定镜头对光线的汇聚能力），以及主点$(c_x, c_y)$（光轴与传感器的交点，通常位于图像中心附近）。对于给定的相机和镜头组合，这些参数是固定的。

![针孔相机模型：3D点通过光心投影到图像平面上，图中标出了焦距和主点](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/pinhole_camera.svg)

- **外参参数**则用于描述相机在三维空间中的位置：旋转矩阵$R$（3×3矩阵，内容见第02章）以及平移向量$t$（3×1向量）。二者共同将世界坐标系中的坐标转换为相机坐标系中的坐标。完整的投影公式为：

$$\mathbf{p} = K [R \mid t] \mathbf{P}$$

- 其中$\mathbf{P} = [X, Y, Z, 1]^T$是以齐次坐标表示的3D点，而$\mathbf{p} = [u, v, 1]^T$则是经过投影后的像素坐标。$[R \mid t]$矩阵为3×4矩阵，将旋转变换和平移变换合并在一起。这些都是第02章中介绍的线性代数知识。

- 实际的镜头会产生**畸变**现象。
- **径向畸变**会使直线变成曲线（桶形畸变会导致图像向外凸起；枕形畸变则会使图像向内凹陷）。

  **切向畸变**则发生在镜头与传感器不完全平行时。

- 相机标定是通过已知图案（如棋盘格）的图像来估算内参参数和畸变系数，进而对图像进行校正（消除畸变）。

- **空间滤波**是传统图像处理的基础。**滤波器**（或核函数）是一个小型矩阵（通常为3×3或5×5），它在图像上滑动。在每个位置，滤波器的数值会与对应的图像区域元素相乘，再将所有结果求和，从而得到一个输出像素值。这就是**二维卷积**，与CNN中所使用的操作相同（见第02章），只不过这里的滤波器权重是人工设计的，而非通过学习得到的。

$$(\text{image} * K)[i,j] = \sum_{m} \sum_{n} \text{image}[i+m, j+n] \cdot K[m, n]$$

- 这是第06章中介绍的一维卷积的二维扩展形式。不同的滤波器能够检测出不同的特征。

- **模糊处理**是通过计算相邻像素的平均值来使图像变得平滑。**盒形滤波器**会给所有相邻像素赋予相同的权重。

- **高斯滤波器**则依据二维高斯函数来为相邻像素赋予权重（内容见第05章），即靠近的像素会被赋予更高的权重，而远离的像素则权重较低。高斯模糊是最常用的平滑处理方法，其效果由参数$\sigma$决定：$\sigma$值越大，平滑效果越明显。

- **中值滤波**则是用某区域像素的中值来替代加权平均值。该方法在去除“椒盐噪声”（即随机出现的黑白像素）的同时还能保留图像边缘，因为中值对异常值具有很强的抵抗力（详见第04章）。

- **边缘检测**则是用来识别像素强度发生剧烈变化的边界位置。图像中的大部分结构信息都集中在边缘上，因此仅通过识别边缘就能识别出物体。

- **Sobel算子**则利用两个3×3的滤波器来分别估计图像在水平方向和垂直方向的梯度：

$$
G_x = \begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix}, \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix}

$$

- 将图像与$G_x$进行卷积可得到水平梯度（在垂直边缘处有强烈响应），而与$G_y$卷积则可得到垂直梯度（在水平边缘处有强烈响应）。
- 梯度幅值$\sqrt{G_x^2 + G_y^2}$以及方向$\arctan(G_y / G_x)$共同决定了每个像素处的边缘强度和方向。这相当于第03章中提到的、在图像域中的梯度概念。

![原始图像、Sobel水平梯度、Sobel垂直梯度以及综合边缘幅值](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/sobel_edges.svg)

- **Canny边缘检测器**是边缘检测领域的黄金标准。它包含四个步骤：

1. 使用高斯滤波器对图像进行平滑处理，以减少噪声；
2. 计算梯度幅值和方向（使用Sobel算法）；
3. **非极大值抑制**：仅保留那些在梯度方向上为局部最大值的像素，从而简化边缘结构；
4. **滞后阈值处理**：设置高低两个阈值。高于高阈值的像素即为确定的边缘；处于两个阈值之间的像素只有在与确定边缘相连时才被视为边缘；低于低阈值的像素则被忽略。

- Canny算法中使用的两个阈值使其比单一阈值更可靠：强烈的边缘始终会被保留，而较弱的边缘则只有在属于连续的边缘结构时才会被保留。

- **频域**分析能够揭示在空间域中难以观察到的模式。**二维傅里叶变换**（基于第03章中介绍的一维傅里叶变换）可将图像分解为不同频率和方向上的二维正弦波组合：

$$F(u, v) = \sum_{x=0}^{M-1} \sum_{y=0}^{N-1} f(x, y) \cdot e^{-j2\pi(ux/M + vy/N)}$$

- 低频率对应于平滑、变化缓慢的区域（如天空、墙壁）。高频率则对应于尖锐的过渡区域（如边缘、纹理、噪声）。**幅度谱**显示了各频率下的能量分布情况，而**相位谱**则反映了这些频率成分的空间排列方式。

- **低通滤波**可以去除高频率成分，从而使图像变得平滑（相当于空间域中的高斯模糊处理）。**高通滤波**则用于去除低频率成分，从而突出边缘和细节。**带通滤波**则只保留特定范围的频率成分，适用于纹理分析。

- 在实际应用中，对于较大的滤波器来说，频域滤波往往比空间域卷积更快，因为空间域中的卷积实际上等同于频域中的逐元素乘法（即**卷积定理**）。这一原理与第03章中介绍的傅里叶变换性质密切相关。

- **直方图**用于总结像素亮度的分布情况。直方图会统计出具有每种亮度值的像素数量（对于8位图像，亮度值范围为0-255）。这实际上就是第04章中提到的频率分布概念，只不过应用在了像素值上。

![带有亮度直方图的图像：暗色图像的直方图偏向左侧，亮色图像的直方图偏向右侧](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/image_histogram.svg)

- 暗色图像的直方图集中在左侧（低亮度值区域），而亮色图像的直方图则集中在右侧。对比度较低的图像，其直方图较为狭窄；对比度较高的图像，则具有较宽且分布较广的直方图。

- **直方图均衡化**通过调整直方图，使其覆盖整个亮度范围，从而提升图像的对比度。其原理是找到一种映射方式，使得像素亮度的累积分布函数尽可能呈线性。这实际上是第04章中介绍的累积分布函数概念的应用。

- **大津法**能够自动找出最佳阈值，从而将图像分为前景和背景。该方法会尝试所有可能的阈值，最终选择那个能使类内方差最小化（或等价地，使类间方差最大化）的阈值。这同样是第04章中提到的方差概念，只不过应用在了像素亮度值上。

- **特征提取**旨在识别图像中那些具有独特性的点或区域，这些特征可用于匹配、识别以及3D重建。理想的特征应当具备重复性（在不同视角下也能被识别出来）、独特性（能够与其他特征区分开来），并且易于计算。

- **角点检测**用于找出图像中在多个方向上亮度发生显著变化的点。平滑区域的亮度在任何方向上都不会有太大变化；边缘则只在某个方向上存在亮度变化；而角点则至少在两个方向上都有亮度变化，因此具有独特的性质，可作为可靠的定位点。

- **Harris角点检测器**会分析每个像素处的**结构张量**（也称为二阶矩矩阵）：

$$
M = \sum_{(x,y) \in W} w(x,y) \begin{bmatrix} I_x^2 & I_x I_y \\ I_x I_y & I_y^2 \end{bmatrix}

$$

- 其中，$I_x$和$I_y$是图像梯度（通过Sobel算法计算得出），$W$是局部窗口，$w$则是高斯权重函数。矩阵$M$的特征值（见第02章）可以用来判断特征的类型：
- 两个特征值都较小：表示平坦区域（无特征）；
- 一个特征值较大，另一个较小：表示边缘；
- 两个特征值都较大：表示角点。

- 为了不必直接计算特征值，Harris算法使用了角点响应函数：$R = \det(M) - k \cdot (\text{trace}(M))^2$，其中$\det(M) = \lambda_1 \lambda_2$，$\text{trace}(M) = \lambda_1 + \lambda_2$（均来自第02章）。较大的正数$R$值表明存在角点。常数$k$通常取0.04-0.06。

- **Shi-Tomasi**检测器则将公式简化为$R = \min(\lambda_1, \lambda_2)$，只需判断较小的特征值是否足够大即可。这种方法在实际应用中更为稳定。

- **斑块检测**用于找出那些与周围区域有所不同的区域。与角点这种点状特征不同，斑块具有特定的大小特征。

- **SIFT**（尺度不变特征变换，Lowe，2004年提出）能够在多个尺度上检测斑块，并生成一种对旋转、尺度具有不变性，同时对光照变化也有一定程度不变性的描述符。其工作流程如下：

1. 通过逐步增加$\sigma$值，利用高斯模糊来构建**尺度空间**；
2. 在不同尺度下寻找高斯差分图中的极值点；
3. 精确确定关键点的位置，同时去除对比度较低的点以及边缘响应；
4. 根据局部梯度方向确定关键点的主导方向；
5. 基于关键点周围16×16区域内的梯度直方图，生成128维的描述符。

- **SURF**（快速鲁棒特征）则利用盒形滤波器和积分图像来近似SIFT算法，从而实现更快速的计算。**ORB**（定向FAST与旋转BRIEF）是一种快速的开源替代方案，它结合了FAST角点检测器与BRIEF二进制描述符，同时还具备旋转不变性。

- **HOG**（方向梯度直方图）描述符会将图像分割成多个小区域，计算每个区域内梯度方向的直方图，然后对各个区域的直方图进行归一化处理。HOG能够捕捉边缘方向的分布情况，这对理解物体形状非常有帮助。在深度学习出现之前，HOG结合SVM（见第06章）是行人检测和物体识别领域的主流方法。

- **图像金字塔**表示同一图像在不同分辨率下的版本。
- **高斯金字塔**是通过反复进行模糊处理和降采样（分辨率每次减半）来构建的。每一层都是原始图像的粗略版本。
- **拉普拉斯金字塔**则存储了相邻高斯层次之间的差异，从而保留了每次降采样过程中丢失的细节。拉普拉斯金字塔是可逆的：可以根据它重建出原始图像。

![高斯金字塔：最上面是全分辨率的原始图像，下面则是逐层分辨率减半的版本](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/image_pyramid.svg)

- **尺度空间**体现了物体存在于不同尺度上的这一概念。一棵树可以看作是一个大的斑块，而树上的叶子则属于较小的斑块。要同时检测这两种结构，就需要在多个尺度上进行搜索。一张图像的尺度空间，就是通过用不同$\sigma$值的高斯函数对该图像进行卷积后得到的所有图像的集合：

$$L(x, y, \sigma) = G(x, y, \sigma) * I(x, y)$$

- 其中，$G$是标准差为$\sigma$的二维高斯函数。那些在多个尺度上都存在的特征，更有可能是具有实际意义的结构，而非噪声。尺度空间是SIFT算法以及现代计算机视觉中使用的多尺度处理方法的理论基础，包括物体检测中的特征金字塔网络（见文件03）。

## 编程任务（可使用CoLab或笔记本完成）

1. 加载一张图像，将其转换为不同的颜色空间（RGB、HSV、LAB），并分别显示各个颜色通道的内容。观察颜色信息在不同颜色空间中的分布情况有何不同。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
from PIL import Image
import numpy as np

# Create a synthetic test image with distinct colours
H, W = 128, 256
img = np.zeros((H, W, 3), dtype=np.uint8)
img[:, :64] = [255, 50, 50]     # red
img[:, 64:128] = [50, 255, 50]  # green
img[:, 128:192] = [50, 50, 255] # blue
img[:, 192:] = [255, 255, 50]   # yellow

# Add a brightness gradient
for y in range(H):
    scale = 0.3 + 0.7 * y / H
    img[y] = (img[y] * scale).astype(np.uint8)

img_jnp = jnp.array(img, dtype=jnp.float32) / 255.0

# Manual RGB to HSV conversion
def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = jnp.max(rgb, axis=-1)
    minc = jnp.min(rgb, axis=-1)
    diff = maxc - minc + 1e-7

    # Hue
    h = jnp.where(maxc == minc, 0.0,
        jnp.where(maxc == r, 60 * ((g - b) / diff % 6),
        jnp.where(maxc == g, 60 * ((b - r) / diff + 2),
                              60 * ((r - g) / diff + 4))))
    s = jnp.where(maxc < 1e-7, 0.0, diff / maxc)
    v = maxc
    return jnp.stack([h / 360, s, v], axis=-1)

hsv = rgb_to_hsv(img_jnp)

fig, axes = plt.subplots(2, 3, figsize=(14, 8))
for i, (ch, name) in enumerate(zip([img_jnp[...,0], img_jnp[...,1], img_jnp[...,2]],
                                     ['Red', 'Green', 'Blue'])):
    axes[0, i].imshow(ch, cmap='gray', vmin=0, vmax=1)
    axes[0, i].set_title(f'RGB: {name}'); axes[0, i].axis('off')

for i, (ch, name) in enumerate(zip([hsv[...,0], hsv[...,1], hsv[...,2]],
                                     ['Hue', 'Saturation', 'Value'])):
    axes[1, i].imshow(ch, cmap='gray', vmin=0, vmax=1)
    axes[1, i].set_title(f'HSV: {name}'); axes[1, i].axis('off')

plt.suptitle('RGB vs HSV Channels')
plt.tight_layout(); plt.show()
```

1. 使用二维卷积从零实现Sobel边缘检测和高斯模糊算法。将这些算法应用到图像上，并比较其处理结果。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def conv2d(image, kernel):
    """2D convolution (valid mode) from scratch."""
    H, W = image.shape
    kH, kW = kernel.shape
    out_h, out_w = H - kH + 1, W - kW + 1
    output = jnp.zeros((out_h, out_w))
    for i in range(out_h):
        for j in range(out_w):
            patch = image[i:i+kH, j:j+kW]
            output = output.at[i, j].set(jnp.sum(patch * kernel))
    return output

# Create a test image: white rectangle on dark background
img = jnp.zeros((64, 64))
img = img.at[15:50, 20:45].set(1.0)
# Add some noise
key = jax.random.PRNGKey(42)
img = img + jax.random.normal(key, img.shape) * 0.05

# Sobel filters
sobel_x = jnp.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=jnp.float32)
sobel_y = jnp.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=jnp.float32)

# Gaussian blur kernel (5x5, sigma=1)
ax = jnp.arange(-2, 3, dtype=jnp.float32)
xx, yy = jnp.meshgrid(ax, ax)
gaussian = jnp.exp(-(xx**2 + yy**2) / (2 * 1.0**2))
gaussian = gaussian / gaussian.sum()

# Apply filters
gx = conv2d(img, sobel_x)
gy = conv2d(img, sobel_y)
edges = jnp.sqrt(gx**2 + gy**2)
blurred = conv2d(img, gaussian)

fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, data, title in zip(axes,
    [img, edges, blurred, gx],
    ['Original', 'Edge Magnitude', 'Gaussian Blur', 'Horizontal Gradient']):
    ax.imshow(data, cmap='gray')
    ax.set_title(title); ax.axis('off')
plt.tight_layout(); plt.show()
```

1. 从零实现直方图均衡化算法，并将其应用于对比度较低的灰度图像。比较处理前后的直方图。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Create a low-contrast image (values clustered in a narrow range)
key = __import__('jax').random.PRNGKey(42)
img = __import__('jax').random.uniform(key, (128, 128)) * 0.3 + 0.3  # values in [0.3, 0.6]

def histogram_equalise(img, n_bins=256):
    """Histogram equalisation for a grayscale image."""
    # Quantise to bins
    bins = jnp.linspace(0, 1, n_bins + 1)
    hist = jnp.histogram(img, bins=bins)[0]

    # Compute CDF
    cdf = jnp.cumsum(hist)
    cdf_normalised = (cdf - cdf.min()) / (cdf.max() - cdf.min())

    # Map each pixel through the CDF
    indices = jnp.clip((img * n_bins).astype(jnp.int32), 0, n_bins - 1)
    equalised = cdf_normalised[indices]
    return equalised

eq_img = histogram_equalise(img)

fig, axes = plt.subplots(2, 2, figsize=(12, 10))
axes[0, 0].imshow(img, cmap='gray', vmin=0, vmax=1)
axes[0, 0].set_title('Original (Low Contrast)'); axes[0, 0].axis('off')
axes[0, 1].imshow(eq_img, cmap='gray', vmin=0, vmax=1)
axes[0, 1].set_title('After Histogram Equalisation'); axes[0, 1].axis('off')

axes[1, 0].hist(img.ravel(), bins=64, color='#3498db', alpha=0.8)
axes[1, 0].set_title('Histogram Before'); axes[1, 0].set_xlim(0, 1)
axes[1, 1].hist(eq_img.ravel(), bins=64, color='#e74c3c', alpha=0.8)
axes[1, 1].set_title('Histogram After'); axes[1, 1].set_xlim(0, 1)

plt.tight_layout(); plt.show()
```

1. 从零开始实现哈里斯角点检测算法。在简单的图像中检测角点，并将它们可视化。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def harris_corners(img, k=0.05, threshold=0.01):
    """Harris corner detection from scratch."""
    # Compute gradients with Sobel
    sobel_x = jnp.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=jnp.float32)
    sobel_y = jnp.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=jnp.float32)

    # Pad image for valid convolution to preserve size
    img_pad = jnp.pad(img, 1, mode='edge')
    H, W = img.shape

    Ix = jnp.zeros_like(img)
    Iy = jnp.zeros_like(img)
    for i in range(H):
        for j in range(W):
            patch = img_pad[i:i+3, j:j+3]
            Ix = Ix.at[i, j].set(jnp.sum(patch * sobel_x))
            Iy = Iy.at[i, j].set(jnp.sum(patch * sobel_y))

    # Structure tensor components
    Ixx = Ix * Ix
    Iyy = Iy * Iy
    Ixy = Ix * Iy

    # Gaussian smoothing of structure tensor (approximate with window sum)
    w = 3  # window half-size
    R = jnp.zeros_like(img)
    pad_xx = jnp.pad(Ixx, w, mode='constant')
    pad_yy = jnp.pad(Iyy, w, mode='constant')
    pad_xy = jnp.pad(Ixy, w, mode='constant')

    for i in range(H):
        for j in range(W):
            sxx = jnp.sum(pad_xx[i:i+2*w+1, j:j+2*w+1])
            syy = jnp.sum(pad_yy[i:i+2*w+1, j:j+2*w+1])
            sxy = jnp.sum(pad_xy[i:i+2*w+1, j:j+2*w+1])
            det = sxx * syy - sxy * sxy
            trace = sxx + syy
            R = R.at[i, j].set(det - k * trace * trace)

    # Threshold
    corners = R > threshold * R.max()
    return R, corners

# Test image: checkerboard pattern (lots of corners)
block = 16
n = 4
checker = jnp.zeros((block * n, block * n))
for i in range(n):
    for j in range(n):
        if (i + j) % 2 == 0:
            checker = checker.at[i*block:(i+1)*block, j*block:(j+1)*block].set(1.0)

R, corners = harris_corners(checker)
cy, cx = jnp.where(corners)

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
axes[0].imshow(checker, cmap='gray')
axes[0].set_title('Checkerboard'); axes[0].axis('off')
axes[1].imshow(R, cmap='hot')
axes[1].set_title('Harris Response'); axes[1].axis('off')
axes[2].imshow(checker, cmap='gray')
axes[2].scatter(cx, cy, c='#e74c3c', s=15, marker='x')
axes[2].set_title(f'Detected Corners ({len(cx)})'); axes[2].axis('off')
plt.tight_layout(); plt.show()
```

## 卷积神经网络

卷积神经网络能够直接从像素数据中学习空间特征的层次结构，用通过梯度优化得到的滤波器取代手工设计的滤波器。本文件介绍了卷积机制、池化操作、步长、膨胀系数、感受野，以及那些在图像分类领域起到关键作用的架构（如LeNet、AlexNet、VGG、ResNet、Inception、EfficientNet）。

- 在文件01中，我们是手工设计用于边缘检测、模糊处理和角点检测的滤波器。那么，是否可以从数据中自动学习出最优的滤波器呢？这正是卷积神经网络所做的事情。
- 相比于手动设定滤波器权重，卷积神经网络是通过梯度下降算法来学习这些权重的（见第06章），从而找到对当前任务最有用的特征。
- 在第06章中，我们介绍了卷积运算、卷积神经网络的基本概念以及滤波器学习的原理。在这里，我们将更深入地探讨那些使得卷积神经网络在过去的十多年里成为计算机视觉领域主流技术的架构创新。
- 回顾一下核心的**卷积运算**：一个大小为$k \times k$的滤波器会在输入特征图上滑动，在每个位置上计算点积（见第06章）。输出尺寸由三个超参数决定：
- **步长**：滤波器在移动时每次跨越的像素数。步长为1意味着滤波器每次移动1个像素；步长为2则意味着它每次移动2个像素，从而使空间维度减半。步长式卷积是用于下采样的另一种方法，可替代池化操作。
- **填充**：在输入数据的边缘添加零值。“相同填充”（$p = \lfloor k/2 \rfloor$）可以保持空间维度不变；“有效填充”（$p = 0$）则会缩小空间维度。
- **膨胀**：在滤波器元素之间插入间隙。一个3×3的滤波器，若采用膨胀系数2，则只需9个参数就能覆盖5×5的感受野。膨胀式卷积可以在不增加计算量的情况下扩大感受野。
- 卷积后的输出空间尺寸为：

$$\text{out} = \left\lfloor \frac{\text{in} - k + 2p}{s} \right\rfloor + 1$$

其中，$\text{in}$是输入尺寸，$k$是核的大小，$p$是填充量，$s$是步长。该公式分别适用于高度和宽度。

- 神经元的**感受野**指的是原始输入中能够影响该神经元输出值的区域。
- 较浅层的神经元具有较小的感受野，它们只能感知局部特征，如边缘。
- 较深层的神经元具有较大的感受野，它们能够感知更大的结构，如物体的各个部分。
- 每经过一层，神经元的感受野就会增大：大致每层会增加$k - 1$个像素的感受野范围（如果使用步长或膨胀操作，增幅会更大）。

![感受野随层级加深而扩大：第1层的神经元能感知3×3的区域，第2层能感知5×5的区域，第3层则能感知7×7的区域](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/receptive_field.svg)

- **池化层**的作用是在保留最重要信息的同时减少空间维度。
- **最大池化**会选取每个窗口中的最大值，从而保留最强烈的激活信号（即最突出的特征）。
- **平均池化**则计算各位置的均值，从而使特征图更加平滑。使用2×2的池化核且步长为2时，空间维度会减半。
- **全局平均池化（GAP）**会将每个通道在整个空间范围内的数值取平均值，从而得到一个与通道数相等的向量。GAP常被用来替代许多现代架构末尾的全连接层，它能大幅减少参数数量，同时起到结构正则化的作用。
- **批量归一化（BatchNorm）**会将每个小批次内的激活值归一化为均值为0、方差为1的状态，然后再应用可学习的缩放因子和偏移量（见第06章）。在卷积神经网络中，批量归一化是针对每个通道单独进行的：首先计算每个通道在批次和空间维度上的统计值，然后进行归一化处理。它有助于稳定训练过程，允许使用更高的学习率，同时也能起到轻微的正则化作用。
- **丢弃机制**（见第06章）会在训练过程中随机将某些神经元的输出设为零。
- 在卷积神经网络中，**空间丢弃机制**（Dropout2D）会直接丢弃整个特征图中的某个通道，而非单个像素，因为特征图中的相邻像素之间存在很强的相关性，这种处理方式更为有效。
- **数据增强**则是通过在训练过程中对每张图像施加随机变换来人为扩大训练集的大小，这些变换包括水平翻转、随机裁剪、旋转、调整亮度、对比度、饱和度和色调，以及遮盖随机矩形区域等。这样，网络就能以多种不同的形式看到同一张图像，从而被迫学习那些不受图像变换影响的特征，而不是死记硬背特定的像素模式。
- 更高级的数据增强策略包括**混合样本法**（Mixup：将两张图像及其对应的标签混合在一起：$\tilde{x} = \lambda x_i + (1-\lambda) x_j$，$\tilde{y} = \lambda y_i + (1-\lambda) y_j$）、**切割混合法**（CutMix：将一张图像中的矩形区域粘贴到另一张图像上，并根据该区域的面积比例来分配标签）以及**随机增强法**（RandAugment：从预定义的增强操作集中随机选择一系列操作，每个操作都有一个强度参数）。
- 卷积神经网络架构的发展史，实际上就是不断设计出更深、更高效架构的历史，每一代新架构都解决了前一代架构存在的缺陷。
- **LeNet-5**（LeCun等人，1998年）是最早的卷积神经网络，专为手写数字识别而设计。它由两层卷积层和三层全连接层组成，还采用了平均池化操作以及tanh激活函数。这一架构证明了通过学习得到的滤波器比手工设计的滤波器效果更好，不过按照现代标准来看，它的参数量仍然相当少（只有6万个参数）。
- **AlexNet**（Krizhevsky等人，2012年）以巨大的优势赢得了ImageNet竞赛，由此引发了深度学习领域的革命。它的关键创新包括：使用ReLU激活函数代替容易出现梯度消失问题的tanh函数、采用丢弃机制进行正则化、运用数据增强技术，以及利用GPU进行训练。该网络包含五层卷积层和三层全连接层，共有6000万个参数。
- **VGG**（Simonyan和Zisserman，2014年）表明，使用多层堆叠的3x3滤波器比使用更大的滤波器效果更好。两个堆叠的3x3滤波器所具有的感受野与一个5x5滤波器相同，但参数更少（$2 \times 3^2 = 18$，而$5^2 = 25$），同时还能引入额外的非线性运算。VGG-16（16层）和VGG-19（19层）至今仍被广泛用作特征提取器。其架构极为简单：由通道数逐渐增加的卷积块组成（64、128、256、512），每个卷积块之后都紧跟最大池化操作。

![VGG架构：逐层增加通道数的3x3卷积块堆叠起来（64→128→256→512），各卷积块之间进行最大池化处理，最后是全连接层](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vgg_architecture.svg)

- **GoogLeNet/Inception**（Szegedy等人，2014年）提出了**Inception模块**：无需选择单一的滤波器尺寸，而是同时使用1x1、3x3和5x5的卷积操作，将它们的输出拼接在一起，让网络自行决定哪种尺度最有效。在较大的滤波器之前使用1x1卷积作为瓶颈层，以减少计算量。GoogLeNet的准确率高于VGG，且参数数量仅为其1/12（680万 vs 1.38亿）。

![Inception模块：四个并行分支（1×1、3×3、5×5以及池化操作），各分支之间通过1x1层相连，最终沿通道维度将结果拼接起来](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/inception_module.svg)

- Inception模块能够同时捕捉多个尺度上的特征。1x1滤波器用于捕捉点状模式，3x3滤波器用于捕捉局部纹理，而5x5滤波器则用于捕捉更大规模的结构。通过将这些特征拼接在一起，就可以得到更为丰富的特征表示。

- **ResNet**（He等人，2016年）解决了**性能下降问题**：深度越深的神经网络性能反而越差，这并非因为过拟合，而是因为这类网络更难以优化。解决方法是采用**跳跃连接**（残差连接）：

$$\text{输出} = F(x) + x$$

该层会学习残差值$F(x) = \text{输出} - x$。如果最优变换接近恒等变换（在深度神经网络中很常见），那么学习接近零的残差值要比学习完整的映射函数要容易得多。跳跃连接还提供了直接的梯度传递路径，从而避免了梯度消失的问题。ResNet训练出的网络深度可达152层，远超以往的任何模型。

![ResNet结构：输入$x$经过两个卷积层后得到$F(x)$，随后通过跳跃连接将$x$加回，最终得到输出$F(x) + x$](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/resnet_block.svg)

- 当输入和输出的维度不同时（由于步长或通道数的变化），可以使用**投影快捷方式**，即对$x$应用1x1卷积来匹配维度：$\text{输出} = F(x) + W_s x$。

- **瓶颈层**（用于ResNet-50及更深层的模型）包含三个卷积操作：1x1卷积用于减少通道数，3x3卷积用于空间处理，另一个1x1卷积则用于恢复通道数。这种方式比使用两个3x3卷积更高效，从而使网络能够具有更高的深度。

- **DenseNet**（Huang等人，2017年）进一步发展了跳跃连接的理念：在密集层中，每一层都与后续的所有层相连。第$l$层会接收来自所有前面层的特征图作为输入：$x_l = H_l([x_0, x_1, \ldots, x_{l-1}])$，其中$[\cdot]$表示沿通道维度进行拼接。这种设计有助于特征的重复利用，增强梯度流动，同时减少总参数数量。

![DenseNet的密集层结构：每一层都通过拼接方式接收来自所有前面层的特征图，从而实现高度密集的连接，最大限度地重复利用特征](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/densenet_block.svg)

- **高效架构**则是为在移动设备和边缘硬件上部署而设计的，因为在这些设备上，计算能力、内存和能耗都受到限制。

- **MobileNet**（Howard等人，2017年）用**深度可分离卷积**取代了传统的卷积操作，这种操作将卷积过程分解为两个步骤：

1. **深度卷积**：对每个输入通道应用一个$k \times k$的滤波器（不存在跨通道的交互）。
2. **点卷积**：应用1x1卷积来整合不同通道之间的信息。

- 传统的$k \times k$卷积，当有$C_{\text{in}}$个输入通道和$C_{\text{out}}$个输出通道时，每个空间位置需要执行$k^2 \cdot C_{\text{in}} \cdot C_{\text{out}}$次乘法运算。而深度可分离卷积的运算量为$k^2 \cdot C_{\text{in}} + C_{\text{in}} \cdot C_{\text{out}}$，运算量大约减少了$k^2$倍。对于3x3滤波器来说，运算量可减少约9倍。

![深度可分离卷积：首先对每个通道应用一个k×k滤波器，然后再通过1x1点卷积来整合各通道的信息——输出形状不变，运算量约为传统方法的1/9](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/depthwise_separable_conv.svg)

- **MobileNet-V2**引入了**反向残差块**：首先通过1x1卷积增加通道数，然后在扩展后的空间中应用深度卷积，最后再通过1x1卷积将通道数降回原来的水平。跳跃连接被置于通道数较少的层上，这与ResNet的架构相反。通常，通道数的扩展比例为6。

- **EfficientNet**（Tan和Le，2019年）采用了**复合缩放**策略：不再单独调整深度、宽度或分辨率，而是使用固定比例同时调整这三个维度。设缩放系数为$\phi$，则有：

$$\text{深度}: d = \alpha^\phi, \quad \text{宽度}: w = \beta^\phi, \quad \text{分辨率}: r = \gamma^\phi$$

同时需满足$\alpha \cdot \beta^2 \cdot \gamma^2 \approx 2$，这样随着$\phi$的增加，总计算量大致会翻倍。通过网格搜索，可以得到基准比例$\alpha = 1.2$、$\beta = 1.1$、$\gamma = 1.15$。EfficientNet-B0到B7的模型逐步提高性能，且在参数数量和浮点运算次数上都远远低于之前的模型，却能达到更高的准确率。

![EfficientNet的复合缩放策略：分别调整宽度、深度或分辨率，与使用单一系数φ同时调整三者相比的效果](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/efficientnet_scaling.svg)

- **ShuffleNet**通过采用**组卷积**后再进行**通道重排**的方式，降低了1x1卷积的计算成本——这类卷积在MobileNet架构中占主导地位。组卷积会将通道分成若干组，每组内独立进行卷积操作，但这样就能阻止组间信息的传递。而通道重排操作则可以重新分配各组之间的通道，以很小的代价恢复信息混合。

- **迁移学习**是指将某个任务上训练好的模型应用到另一个任务中的方法。在计算机视觉领域，这通常意味着从在ImageNet（包含140万张图片、1000个类别）上预训练好的模型开始，再将其适配到特定领域的数据集上（如医学图像、卫星图像或制造缺陷检测数据）。

- **特征提取**：冻结所有卷积层，去掉最终的分类层，仅对新添加的分类层进行训练。被冻结的层则充当通用的特征提取器。当目标领域与ImageNet相似且目标数据集规模较小时，这种方法效果很好。

- **微调**：解冻部分或全部卷积层，使用较小的学习率进行训练。预训练得到的权重可作为起点，而非固定不变的特征。微调通常是从解冻较后面的层开始（这些层负责提取与任务相关的高级特征），之后再选择性地解冻更前面的层。

- 迁移学习之所以有效，是因为CNN的早期层会学习到在各种任务中都通用的特征（如边缘、纹理、颜色），而后期层则负责学习特定任务的特征。一个用于动物分类的模型，其边缘检测功能仍然可用于建筑物分类。

- **可视化CNN**有助于了解网络学到了什么内容，同时也有助于排查异常行为。

- **激活图**（即特征图）能够显示给定输入图像下每个滤波器的输出结果。早期层的激活图看起来类似边缘图；而更深层的激活图则越来越抽象，空间分辨率也越低。

- **Grad-CAM**（梯度加权类激活映射，Selvaraju等人，2017年）能够突出显示输入图像中对模型预测最为重要的区域。其工作原理如下：

1. 利用第03章中的链式法则，计算最后一个卷积层特征图相对于目标类别得分的梯度；
2. 对这些梯度进行全局平均池化，从而得到每个通道的重要性权重；
3. 将特征图按重要性权重进行加权组合，再应用ReLU函数。

$$L_{\text{Grad-CAM}} = \text{ReLU}\!\left(\sum_k \alpha_k A^k\right), \quad \alpha_k = \frac{1}{Z} \sum_i \sum_j \frac{\partial y^c}{\partial A^k_{ij}}$$

其中，$A^k$是第$k$个特征图，$\alpha_k$是第$k$个通道的重要性权重，$y^c$则是类别$c$的得分。最终得到的热图可以显示出对分类起决定作用的区域。之所以使用ReLU函数，是因为我们只关注那些对类别有正向影响的特征。

![Grad-CAM：狗的输入图像、最后一个卷积层的特征图、经过梯度加权的组合结果，以及叠加在原始图像上的热图，该热图突出了狗的脸部](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/grad_cam.svg)

- **特征反演**是通过优化随机图像，使其特征与目标特征相匹配，从而从特征表示中重建输入图像（这是通过对像素值应用梯度下降来实现的）。这种方法可以揭示网络在每一层保留了哪些信息。早期层能够重建出几乎完美的图像；而更深层的图像虽然仍可识别，但已出现失真，这说明精细的空间细节已经丢失，不过语义内容仍然得以保留。

- **深度梦**和**神经风格迁移**都是特征可视化的创新应用。深度梦通过最大化选定层中神经元的激活程度，生成具有超现实感的、图案被放大的图像。神经风格迁移则旨在让目标图像的视觉内容（来自深层特征）与另一幅图像的风格特征（由滤波器激活值构成的格拉姆矩阵，用于描述纹理特征）相匹配。

## 编程任务（可使用CoLab或笔记本完成）（续1）

1. 使用JAX从零实现一个简单的CNN，该网络包含两个卷积层、最大池化层以及一个分类层。然后，在一个合成性的2D模式分类任务上对该网络进行训练。

```python
import jax
import jax.numpy as jnp
import jax.lax as lax
import matplotlib.pyplot as plt

def conv2d(x, kernel, stride=1):
    """Simple 2D convolution for single input, single filter."""
    return lax.conv(x[None, None], kernel[None, None], (stride, stride), 'SAME')[0, 0]

def max_pool(x, size=2):
    """2x2 max pooling."""
    H, W = x.shape
    x = x[:H//size*size, :W//size*size]
    return x.reshape(H//size, size, W//size, size).max(axis=(1, 3))

def init_cnn(key):
    k1, k2, k3 = jax.random.split(key, 3)
    return {
        'conv1': jax.random.normal(k1, (5, 5)) * 0.3,
        'conv2': jax.random.normal(k2, (3, 3)) * 0.3,
        'fc_w': jax.random.normal(k3, (64, 1)) * 0.1,
        'fc_b': jnp.zeros(1),
    }

def forward_cnn(params, img):
    # Conv1 -> ReLU -> Pool
    h = jnp.maximum(0, conv2d(img, params['conv1']))
    h = max_pool(h)
    # Conv2 -> ReLU -> Pool
    h = jnp.maximum(0, conv2d(h, params['conv2']))
    h = max_pool(h)
    # Flatten and classify
    flat = h.ravel()
    # Pad or truncate to fixed size
    flat = jnp.pad(flat, (0, max(0, 64 - len(flat))))[:64]
    logit = (flat @ params['fc_w'] + params['fc_b']).squeeze()
    return jax.nn.sigmoid(logit)

# Generate synthetic data: class 0 = low-freq pattern, class 1 = high-freq
def make_data(key, n=200):
    images, labels = [], []
    for i in range(n):
        k1, key = jax.random.split(key)
        x, y = jnp.meshgrid(jnp.linspace(0, 4*jnp.pi, 32), jnp.linspace(0, 4*jnp.pi, 32))
        if i < n // 2:
            img = jnp.sin(x) + jax.random.normal(k1, (32, 32)) * 0.1
            labels.append(0)
        else:
            img = jnp.sin(4 * x) * jnp.sin(4 * y) + jax.random.normal(k1, (32, 32)) * 0.1
            labels.append(1)
        images.append(img)
    return images, jnp.array(labels, dtype=jnp.float32)

key = jax.random.PRNGKey(42)
images, labels = make_data(key)
params = init_cnn(jax.random.PRNGKey(0))

def loss_fn(params, img, label):
    pred = forward_cnn(params, img)
    return -(label * jnp.log(pred + 1e-7) + (1 - label) * jnp.log(1 - pred + 1e-7))

grad_fn = jax.grad(loss_fn)
lr = 0.01

for epoch in range(5):
    total_loss = 0.0
    for img, label in zip(images, labels):
        grads = grad_fn(params, img, label)
        params = {k: params[k] - lr * grads[k] for k in params}
        total_loss += loss_fn(params, img, label)
    print(f"Epoch {epoch}: loss = {total_loss / len(images):.4f}")

# Test accuracy
preds = jnp.array([forward_cnn(params, img) > 0.5 for img in images])
acc = jnp.mean(preds == labels)
print(f"Accuracy: {acc:.2%}")
```

1. 可视化不同滤波器尺寸对感受域的影响。证明：两个堆叠的3×3滤波器所覆盖的感受域与一个5×5滤波器相同，但参数数量更少。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

def compute_receptive_field(layers):
    """Compute receptive field size from a list of (kernel_size, stride) tuples."""
    rf = 1  # start with 1 pixel
    stride_product = 1
    for k, s in layers:
        rf += (k - 1) * stride_product
        stride_product *= s
    return rf

# Compare architectures
configs = {
    'Single 5x5': [(5, 1)],
    'Two 3x3':    [(3, 1), (3, 1)],
    'Three 3x3':  [(3, 1), (3, 1), (3, 1)],
    'Single 7x7': [(7, 1)],
    '3x3 stride 2 + 3x3': [(3, 2), (3, 1)],
}

print(f"{'Config':<25} {'RF':>4} {'Params (per channel)':>20}")
print('-' * 55)
for name, layers in configs.items():
    rf = compute_receptive_field(layers)
    # Parameters: sum of k^2 for each layer (per input-output channel pair)
    params = sum(k * k for k, s in layers)
    print(f"{name:<25} {rf:>4} {params:>20}")

# Visualise receptive fields
fig, axes = plt.subplots(1, 3, figsize=(14, 4))
for ax, (name, rf_size) in zip(axes, [('5x5 filter', 5), ('Two 3x3 filters', 5), ('Three 3x3 filters', 7)]):
    grid = jnp.zeros((9, 9))
    c = 4  # centre
    half = rf_size // 2
    grid = grid.at[c-half:c+half+1, c-half:c+half+1].set(1.0)
    ax.imshow(grid, cmap='Blues', vmin=0, vmax=1)
    ax.set_title(f'{name}\nRF = {rf_size}x{rf_size}')
    ax.set_xticks(range(9)); ax.set_yticks(range(9))
    ax.grid(True, alpha=0.3)
plt.suptitle('Receptive Field Comparison')
plt.tight_layout(); plt.show()
```

1. 从零实现Grad-CAM算法。给定一个已构建的简单CNN模型，为某个特定类别计算梯度加权的激活图，并将其以热图形式展示出来。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def simple_cnn(params, img):
    """Simple CNN that returns both the prediction and last conv activations."""
    # Conv layer (our "last conv layer" for Grad-CAM)
    H, W = img.shape
    k = params['conv'].shape[0]
    pad = k // 2
    img_pad = jnp.pad(img, pad, mode='edge')
    activation_map = jnp.zeros((H, W))
    for i in range(H):
        for j in range(W):
            activation_map = activation_map.at[i, j].set(
                jnp.sum(img_pad[i:i+k, j:j+k] * params['conv'])
            )
    activation_map = jnp.maximum(0, activation_map)  # ReLU

    # Global average pool -> dense -> output
    pooled = activation_map.mean()
    logit = pooled * params['w'] + params['b']
    return jax.nn.sigmoid(logit), activation_map

# Create test image: bright region on the left (class indicator)
img = jnp.zeros((32, 32))
img = img.at[8:24, 4:16].set(1.0)
img = img.at[5:10, 20:28].set(0.3)

key = jax.random.PRNGKey(42)
params = {
    'conv': jax.random.normal(key, (5, 5)) * 0.3,
    'w': jnp.array(2.0),
    'b': jnp.array(-0.5),
}

# Compute Grad-CAM
def class_score(params, img):
    pred, _ = simple_cnn(params, img)
    return pred

# Get activation map and gradients
pred, act_map = simple_cnn(params, img)
grad_fn = jax.grad(lambda img: simple_cnn(params, img)[0])
img_grad = grad_fn(img)

# Weight = global average of gradients (simplified 1-channel Grad-CAM)
alpha = img_grad.mean()
grad_cam = jnp.maximum(0, alpha * act_map)  # ReLU
grad_cam = (grad_cam - grad_cam.min()) / (grad_cam.max() - grad_cam.min() + 1e-8)

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
axes[0].imshow(img, cmap='gray'); axes[0].set_title('Input Image'); axes[0].axis('off')
axes[1].imshow(act_map, cmap='viridis'); axes[1].set_title('Activation Map'); axes[1].axis('off')
axes[2].imshow(img, cmap='gray', alpha=0.6)
axes[2].imshow(grad_cam, cmap='jet', alpha=0.4)
axes[2].set_title(f'Grad-CAM (pred={pred:.2f})'); axes[2].axis('off')
plt.tight_layout(); plt.show()
```

1. 比较深度可分离卷积与传统卷积。分别统计两种方法的参数数量和浮点运算次数，证明它们能够产生相似的输出，且计算量要小得多。

```python
import jax
import jax.numpy as jnp

def standard_conv(x, kernel):
    """Standard convolution: (H, W, C_in) * (k, k, C_in, C_out) -> (H, W, C_out)."""
    H, W, C_in = x.shape
    k, _, _, C_out = kernel.shape
    pad = k // 2
    x_pad = jnp.pad(x, ((pad, pad), (pad, pad), (0, 0)), mode='constant')
    out = jnp.zeros((H, W, C_out))
    for i in range(H):
        for j in range(W):
            patch = x_pad[i:i+k, j:j+k, :]  # (k, k, C_in)
            for c in range(C_out):
                out = out.at[i, j, c].set(jnp.sum(patch * kernel[:, :, :, c]))
    return out

def depthwise_separable_conv(x, dw_kernel, pw_kernel):
    """Depthwise separable: depthwise (k,k,C_in) then pointwise (C_in, C_out)."""
    H, W, C_in = x.shape
    k = dw_kernel.shape[0]
    pad = k // 2
    x_pad = jnp.pad(x, ((pad, pad), (pad, pad), (0, 0)), mode='constant')

    # Depthwise: one filter per channel
    dw_out = jnp.zeros((H, W, C_in))
    for i in range(H):
        for j in range(W):
            for c in range(C_in):
                patch = x_pad[i:i+k, j:j+k, c]
                dw_out = dw_out.at[i, j, c].set(jnp.sum(patch * dw_kernel[:, :, c]))

    # Pointwise: 1x1 conv across channels
    out = dw_out @ pw_kernel
    return out

# Setup
H, W, C_in, C_out, k = 8, 8, 16, 32, 3
key = jax.random.PRNGKey(42)
k1, k2, k3, k4 = jax.random.split(key, 4)

x = jax.random.normal(k1, (H, W, C_in))
std_kernel = jax.random.normal(k2, (k, k, C_in, C_out)) * 0.1
dw_kernel = jax.random.normal(k3, (k, k, C_in)) * 0.1
pw_kernel = jax.random.normal(k4, (C_in, C_out)) * 0.1

# Compare
std_params = k * k * C_in * C_out
dw_params = k * k * C_in + C_in * C_out

std_flops = H * W * k * k * C_in * C_out
dw_flops = H * W * (k * k * C_in + C_in * C_out)

print(f"Standard conv:            {std_params:>8,} params,  {std_flops:>10,} FLOPs")
print(f"Depthwise separable conv: {dw_params:>8,} params,  {dw_flops:>10,} FLOPs")
print(f"Parameter reduction:      {std_params / dw_params:.1f}x")
print(f"FLOP reduction:           {std_flops / dw_flops:.1f}x")

std_out = standard_conv(x, std_kernel)
ds_out = depthwise_separable_conv(x, dw_kernel, pw_kernel)
print(f"\nStandard output shape:    {std_out.shape}")
print(f"Depthwise sep output shape: {ds_out.shape}")
```

## 目标检测与分割

_目标检测用于定位并识别图像中的每个对象；而分割则会给每个像素分配一个标签。本文件介绍了IoU、mAP、锚框、R-CNN系列算法、YOLO、SSD、特征金字塔网络，以及语义分割/实例分割/全景分割方法（如U-Net、Mask R-CNN、SAM），同时还介绍了用于评估这些方法的指标。_

- 图像分类（文件02）旨在回答“这张图片里有什么？”的问题；而目标检测则要解决更复杂的问题：“这张图片里有哪些对象，它们位于何处？”

- 分割则进一步追问：“哪些像素属于哪个对象或类别？”这些任务构成了逐步提升的空间理解层次结构。

- **目标检测模型**会输出一组**边界框**，每个边界框由四个坐标（左上角坐标$x, y$、宽度、高度）以及一个带有置信度分数的类别标签来定义。一张图片中可能没有对象，也可能有一个或数百个属于不同类别的对象。

![包含多个对象的输入图像，每个对象都被彩色边界框包围，边界框上还标注有类别标签和置信度分数](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/detection_boxes.svg)

- **交并比（IoU）**用于衡量预测出的边界框与真实边界框的匹配程度。其计算方式为重叠区域面积除以两者并集的面积：

$$\text{IoU} = \frac{\text{重叠区域面积}}{\text{并集面积}}$$

- 当IoU为1时表示完全重合；IoU为0则表示完全没有重叠。通常认为，当IoU≥0.5时即为“正确”的检测结果，不过也有采用更高阈值（如0.75、0.9）的情况。

- 如果某个检测结果的IoU高于设定阈值且类别判断正确，则该检测属于**真阳性（TP）**。

- **假阳性（FP）**是指那些与任何真实边界框都不匹配的预测边界框。

- **假阴性（FN）**则是指那些没有被任何预测结果识别的真实对象。这些概念与第06章中介绍的精确度/召回率概念相同。

- **平均精确度（AP）**用于总结某一类别的检测质量。对于每个类别，先根据置信度分数对所有检测结果进行排序，再计算每个排序等级下的精确度和召回率，最后求出精确度-召回率曲线下的面积：

$$\text{AP} = \int_0^1 p(r) \, dr$$

- 在实际应用中，这条曲线是通过插值方式得到的：在每个召回率水平上，精确度取所有召回率≥该值的最大精确度值。这样处理后，曲线会更平滑，且呈单调递减趋势。

- **平均平均精确度（mAP）**则是将所有类别的AP值取平均值。“mAP@0.5”使用的是0.5的IoU阈值；而“mAP@[.5:.95]”（即COCO标准）则是以0.5为起点，每隔0.05取一个值，直到0.95，从而综合评估检测效果和定位精度。

- **非极大值抑制（NMS）**用于消除重复的检测结果。当模型为同一个对象预测出多个重叠的边界框时，NMS会保留置信度最高的那个边界框，然后删除所有与它重叠且IoU超过设定阈值的边界框。这一操作是在模型生成原始预测结果后，针对每个类别分别进行的。

- **两阶段检测器**首先提出候选区域，然后再对每个候选区域进行分类和优化。

- **R-CNN**（Girshick等人，2014年）是首个成功的深度学习检测算法。它使用选择性搜索这种传统算法来提出约2,000个候选区域，然后将每个区域调整为固定大小，再分别用CNN对其进行处理，最后通过SVM进行分类（详见第06章）。虽然R-CNN的准确率很高，但速度极慢——它需要为每张图片运行2,000次CNN运算。

- **Fast R-CNN**（Girshick，2015年）通过一次性对整张图片运行CNN来生成共享特征图，从而避免了重复计算，之后再利用**感兴趣区域池化**技术从该共享特征图中提取每个候选区域的特征。

- 相关兴趣区域池化技术会选取特征图中大小不固定的区域，通过将该区域划分为网格并在每个网格单元内进行最大值池化，从而得到固定大小的输出结果。由于昂贵的CNN运算只需执行一次，因此这种方法的速度要快得多。

- **Faster R-CNN**（Ren等人，2015年）则通过引入**区域提议网络（RPN）**来取代原有的外部区域提议算法。RPN是一个小型CNN，它直接在共享特征图上运行，从而直接预测出候选区域。RPN会在特征图上滑动一个小窗口，在每个位置预测出$k$个候选区域（每个锚框对应一个候选区域）。

![Faster R-CNN的工作流程：输入图像 → 主干CNN → 共享特征图 → RPN生成候选区域 → 相关兴趣区域池化 → 分类与边界框回归模块](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/faster_rcnn.svg)

- **锚框**是预先定义在特征图每个空间位置上的边界框，它们具有不同的尺寸和长宽比（例如，三种尺寸×三种长宽比，即每个位置有9个锚框）。RPN会为每个锚框预测两个数值：一个是物体存在概率（判断该位置是物体还是背景），另一个则是用于调整锚框位置的偏移量，从而使锚框更精准地对应到实际对象。这种参数化处理使得回归问题变得更简单——网络不需要预测绝对坐标，只需预测对初始边界框的微小调整即可。

- 锚框的偏移量可以通过以下公式表示：

$$t_x = \frac{x - x_a}{w_a}, \quad t_y = \frac{y - y_a}{h_a}, \quad t_w = \log\frac{w}{w_a}, \quad t_h = \log\frac{h}{h_a}$$

- 其中，$(x, y, w, h)$是预测出的边界框的中心坐标和尺寸，而$(x_a, y_a, w_a, h_a)$则是锚框的坐标。对宽度和高度使用对数变换，可以确保预测出的边界框坐标始终为正数，同时还能让回归过程具备尺度不变性。

- Faster R-CNN采用多任务损失函数进行训练：除了用于类别标签分类的交叉熵损失（详见第05章）外，还有用于边界框回归的**平滑L1损失**。相比L2损失，平滑L1对异常值的不敏感性更强。

$$
\text{smooth}_{L1}(x) = \begin{cases} 0.5x^2 & \text{if } |x| < 1 \\ |x| - 0.5 & \text{otherwise} \end{cases}

$$

- **特征金字塔网络（FPN）**（Lin等人，2017年）通过构建自上而下的路径并加入横向连接，解决了多尺度问题，从而将高层语义信息与低层空间细节相结合。该网络的骨干网络能够生成多个尺度的特征图（每个池化层都会使分辨率减半）。FPN还增加了自上而下的路径，每一层都会接收来自上一层的上采样特征，并通过1x1卷积将这些特征与对应的自下而上的特征合并。最终得到的就是一系列特征图，这些特征图既具备较强的语义信息，又具有较高的空间分辨率。

- 小物体可以从金字塔中分辨率较高的层次被检测出来，而大物体则从分辨率较低的层次被检测出来。如今，FPN已成为大多数现代目标检测架构中的标准组件。

- **单阶段检测器**完全跳过了目标提议步骤，只需一次处理就能同时预测出类别标签和边界框。这种方式速度更快，但传统上其准确率低于双阶段检测器，直到“焦点损失”算法的出现才弥补了这一差距。

- **YOLO**（You Only Look Once，Redmon等人，2016年）将图像划分为$S \times S$大小的网格。每个网格单元会预测$B$个边界框以及$C$个类别的概率。如果某个物体的中心位于某个网格单元内，那么该单元就会负责检测这个物体。YOLO的速度极快，因为整个检测过程仅需一次前向传播，无需目标提议步骤。

- **YOLOv2**加入了锚点框、批量归一化以及多尺度训练机制。**YOLOv3**则采用了特征金字塔网络，并在三个不同尺度上进行预测。**YOLOv4至YOLOv8**则通过改进的骨干网络、路径聚合网络以及马赛克数据增强技术（在训练过程中将四张图像拼接在一起以增加场景多样性），进一步提升了性能。

- **SSD**（Single Shot MultiBox Detector，Liu等人，2016年）在骨干网络的多个特征图尺度上同时进行预测，每个尺度都使用锚点框。早期（高分辨率）的特征图用于检测小物体，而后期（低分辨率）的特征图则用于检测大物体。SSD的速度比Faster R-CNN更快，且准确率也相当。

- **RetinaNet**（Lin等人，2017年）指出了单阶段检测器的核心问题：类别不平衡。绝大多数锚点框实际上对应的是背景，这些容易识别的负样本会主导损失函数，从而掩盖那些罕见的正样本所带来的梯度信号。

- **焦点损失**通过降低这些容易识别的样本的权重来解决这个问题：

$$\text{FL}(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)$$

其中$p_t$是模型对正确类别的预测概率。当模型有很高的置信度且预测正确时（即$p_t$值较高），$(1 - p_t)^\gamma$的值会很小，从而减少这些容易识别的负样本对损失函数的贡献。超参数$\gamma$（通常为2）用于控制权重降低的程度。当$\gamma = 0$时，焦点损失就变成了普通的交叉熵损失函数。借助焦点损失，RetinaNet能够在单阶段检测的前提下实现与双阶段检测器相当的准确率。

- **无锚点检测**则完全摒弃了锚点框，从而减少了超参数调整的需求，同时也简化了检测流程。

- **FCOS**（Fully Convolutional One-Stage，Tian等人，2019年）会在特征图的每一个位置上，预测该位置到最近边界框的四个边（左、上、右、下）的距离，同时还会输出类别标签。通过“中心性”得分，该算法会降低那些远离物体中心的预测结果的权重，从而提升检测质量。FCOS利用特征金字塔网络来处理不同尺度的问题。

- **CenterNet**（Zhou等人，2019年）将物体视为点来进行检测：它首先生成一个热图，热图中的峰值对应着物体的中心位置，然后再分别预测每个峰值对应的物体宽度和高度。这样一来，检测过程就变成了关键点估计。这种方法无需使用锚点框，且设计十分巧妙，但需要对热图进行复杂的后处理。

- **CornerNet**则将物体视为一对角点（左上角和右下角）来进行检测。它会生成两个热图（分别对应两种类型的角点），然后通过“关联嵌入”技术将对应的角点组合成边界框。这种方法无需使用锚点框，且能够处理任意形状的物体。

- **语义分割**则是为图像中的每个像素分配一个类别标签。与仅输出边界框的目标检测不同，语义分割会生成一个密集的像素级映射图。例如，在街道场景中，每个像素都可以被标记为道路、人行道、汽车、行人、建筑物、天空等。

![语义分割：输入的街道场景及其像素级标签图，每种颜色代表不同的类别](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/semantic_segmentation.svg)

- **全卷积网络（FCN）**（Long等人，2015年）通过用卷积层替代全连接层，将分类用的CNN网络改造为可用于语义分割的网络，从而使网络能够输出空间映射图而非单一的类别标签。通过反卷积或双线性插值等手段，可以将输出结果恢复到与输入相同的分辨率。来自早期层的跳过连接则可以补充在降采样过程中丢失的空间细节。

- **反卷积**（有时也被称为“去卷积”）是卷积的逆操作。与缩小空间尺寸的卷积不同，反卷积的作用是增大空间尺寸。它会在输入元素之间插入零值，然后再应用常规的卷积操作，从而实现上采样功能。

- **U-Net**（Ronneberger等人，2015年）提出了一种对称的编码器-解码器架构，且在每一层都设置了跳过连接。编码器部分会降低空间分辨率，同时增加通道数，这一过程与分类用CNN类似。解码器部分则负责将图像分辨率恢复到原始水平。跳过连接则将编码器各层的特征图与解码器各层的特征图拼接在一起，从而为解码器提供精细的空间细节。这种结合了高层语义信息与低层空间细节的架构，能够生成清晰、精确的分割边界。

![U-Net架构：左侧为负责降采样的编码器路径，右侧为负责上采样的解码器路径，而跳过连接则将这两者连接起来](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/unet_architecture.svg)

- U-Net最初是为生物医学图像分割而设计的（这类任务的训练数据极为稀缺），其架构后来成为许多后续模型的基础，包括潜在扩散模型中的U-Net（文件04）。

- **DeepLab**（Chen等人，2014–2018年）为图像分割带来了两项重要创新：

- **空洞卷积**：在标准卷积中，在滤波器元素之间插入间隙，该间隙的大小由扩张率$r$控制。一个3×3的滤波器，当扩张率为$r$时，其感受野为$(2r + 1) \times (2r + 1)$，同时仅需要9个参数。这种方式无需下采样即可捕捉多尺度上的上下文信息，从而保持空间分辨率。

- **空洞空间金字塔池化（ASPP）**：并行应用多个具有不同扩张率的空洞卷积操作（例如扩张率分别为1、6、12、18），将各次操作的结果拼接起来，再通过1×1卷积进行融合。ASPP能够同时捕捉多尺度上的上下文信息，其原理与Inception模块类似（文件02），但采用的是扩张率而非不同的核尺寸。

- DeepLab还使用了**条件随机场（CRF）**（第05章）作为后处理步骤，通过让颜色相近的邻近像素共享相同的标签，从而优化分割边界。

- **实例分割**则结合了目标检测与分割功能：它能够识别出每一个独立的物体，并为每个物体生成像素级的掩码。场景中的两辆汽车会分别得到两个独立的掩码，而不会只用一个“汽车”的掩码来表示它们。

- **Mask R-CNN**（He等人，2017年）是在Faster R-CNN的基础上添加了一个小型分割模块，该模块可以为每个被检测到的物体预测出一个二值掩码。其架构由Faster R-CNN加上一个掩码分支组成：掩码分支接收经过ROI池化处理后的特征，然后为每个类别输出一个$m \times m$大小的二值掩码。该模型采用**RoIAlign**替代传统的ROI池化方法——在精确采样的点上进行双线性插值，而非使用量化后的网格单元，从而避免了量化带来的空间错位问题。这一小小的改动显著提升了掩码的质量。

- Mask R-CNN通过多任务损失函数进行训练：分类损失 + 盒子回归损失 + 掩码损失（基于像素的二值交叉熵损失）。掩码分支会为每个类别独立预测掩码；最终只使用与预测类别对应的掩码，这样就将掩码预测与分类任务分开处理，进而提升了两者的性能。

- **全景分割**则将语义分割与实例分割整合为单一任务。每个像素都会同时获得类别标签（语义信息）和实例ID（针对汽车、行人等“物体”类别而言）。而对于天空、道路、草地等无明确个体边界的“背景”类别，则只提供语义标签。

- 全景分割的质量可以通过**PQ指标**来评估，该指标将分割质量（匹配区域的平均IoU值）与识别质量（匹配区域的F1分数）相结合：

$$\text{PQ} = \underbrace{\frac{\sum_{(p,g) \in \text{TP}} \text{IoU}(p,g)}{|\text{TP}|}}_{\text{SQ}} \times \underbrace{\frac{|\text{TP}|}{|\text{TP}| + \frac{1}{2}|\text{FP}| + \frac{1}{2}|\text{FN}|}}_{\text{RQ}}$$

- 对于自动驾驶和增强现实等应用来说，**实时分割**至关重要，因为这些应用的延迟要求非常严格（通常每帧的延迟需低于30毫秒）。

- **BiSeNet**（双边分割网络，Yu等人，2018年）采用了两条并行路径：一条是**空间路径**，包含较多且较浅的层，用于保留空间细节；另一条是**上下文路径**，包含较少但较深的层，用于捕捉语义信息。这两条路径的输出会被融合在一起，从而在速度与精度之间取得平衡。

- **DDRNet**（深度双分辨率网络，Hong等人，2021年）在整个网络中维持着两个不同分辨率的分支，并让这两个分支之间不断交换信息。高分辨率分支负责保留空间细节，而低分辨率分支则用于捕捉全局上下文。多个双边融合模块则负责在两个方向上整合信息。

- 实时分割领域的一个总体趋势是避免使用复杂的编码器-解码器结构，而是在整个网络中始终保持足够的空间分辨率，以此来换取更低的延迟，尽管这可能会略微牺牲一些精度。

## 编程任务（可使用CoLab或笔记本完成）（续2）

1. 从零实现IoU计算函数以及非最大值抑制算法。对一组重叠的边界框应用NMS算法，并将处理结果可视化。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def compute_iou(box1, box2):
    """Compute IoU between two boxes [x1, y1, x2, y2]."""
    x1 = jnp.maximum(box1[0], box2[0])
    y1 = jnp.maximum(box1[1], box2[1])
    x2 = jnp.minimum(box1[2], box2[2])
    y2 = jnp.minimum(box1[3], box2[3])

    intersection = jnp.maximum(0, x2 - x1) * jnp.maximum(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    return intersection / (union + 1e-6)

def nms(boxes, scores, iou_threshold=0.5):
    """Non-Maximum Suppression."""
    order = jnp.argsort(-scores)  # sort by descending confidence
    keep = []

    remaining = list(range(len(scores)))
    order_list = order.tolist()

    while order_list:
        idx = order_list[0]
        keep.append(idx)
        order_list = order_list[1:]

        new_order = []
        for j in order_list:
            iou = compute_iou(boxes[idx], boxes[j])
            if iou < iou_threshold:
                new_order.append(j)
        order_list = new_order

    return keep

# Example: overlapping detections of the same object
boxes = jnp.array([
    [50, 60, 150, 160],   # high confidence
    [55, 65, 155, 165],   # overlapping duplicate
    [52, 58, 148, 158],   # overlapping duplicate
    [200, 100, 300, 200], # different object
    [205, 105, 305, 205], # overlapping duplicate
])
scores = jnp.array([0.95, 0.80, 0.70, 0.90, 0.60])

keep = nms(boxes, scores, iou_threshold=0.5)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
colors = ['#3498db', '#e74c3c', '#27ae60', '#9b59b6', '#f39c12']

for ax, title, indices in zip(axes, ['Before NMS', 'After NMS'],
                               [range(len(boxes)), keep]):
    ax.set_xlim(0, 400); ax.set_ylim(0, 300)
    ax.set_aspect('equal'); ax.invert_yaxis()
    ax.set_title(title)
    for i in indices:
        b = boxes[i]
        rect = patches.Rectangle((b[0], b[1]), b[2]-b[0], b[3]-b[1],
                                  linewidth=2, edgecolor=colors[i],
                                  facecolor='none')
        ax.add_patch(rect)
        ax.text(b[0], b[1]-5, f'{scores[i]:.2f}', color=colors[i], fontsize=10)

plt.tight_layout(); plt.show()
print(f"Kept {len(keep)} of {len(boxes)} boxes after NMS")
```

1. 实现简化的区域提议网络（RPN）。给定特征图后，生成多种尺度及宽高比下的锚框，并预测对象存在概率以及框的位置偏移量。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def generate_anchors(feature_h, feature_w, stride, scales, ratios):
    """Generate anchor boxes for each position on the feature map."""
    anchors = []
    for y in range(feature_h):
        for x in range(feature_w):
            cx = (x + 0.5) * stride
            cy = (y + 0.5) * stride
            for s in scales:
                for r in ratios:
                    w = s * jnp.sqrt(r)
                    h = s / jnp.sqrt(r)
                    anchors.append([cx - w/2, cy - h/2, cx + w/2, cy + h/2])
    return jnp.array(anchors)

def rpn_forward(feature_map, params):
    """Simplified RPN: predicts objectness and box offsets per anchor."""
    H, W, C = feature_map.shape
    n_anchors = params['cls_w'].shape[1]

    # Slide a 1x1 conv over the feature map (simplified)
    cls_scores = feature_map.reshape(-1, C) @ params['cls_w']  # (H*W, n_anchors)
    box_offsets = feature_map.reshape(-1, C) @ params['reg_w']  # (H*W, n_anchors*4)

    cls_scores = jax.nn.sigmoid(cls_scores)
    return cls_scores.ravel(), box_offsets.reshape(-1, 4)

# Setup
feature_h, feature_w, channels = 4, 4, 16
stride = 16  # each feature map cell covers 16x16 pixels
scales = [32, 64, 128]
ratios = [0.5, 1.0, 2.0]
n_anchors_per_pos = len(scales) * len(ratios)

key = jax.random.PRNGKey(42)
k1, k2, k3 = jax.random.split(key, 3)

feature_map = jax.random.normal(k1, (feature_h, feature_w, channels))
params = {
    'cls_w': jax.random.normal(k2, (channels, n_anchors_per_pos)) * 0.01,
    'reg_w': jax.random.normal(k3, (channels, n_anchors_per_pos * 4)) * 0.01,
}

anchors = generate_anchors(feature_h, feature_w, stride, scales, ratios)
scores, offsets = rpn_forward(feature_map, params)

print(f"Feature map: {feature_h}x{feature_w}, stride={stride}")
print(f"Anchors per position: {n_anchors_per_pos}")
print(f"Total anchors: {len(anchors)}")
print(f"Objectness scores shape: {scores.shape}")
print(f"Box offsets shape: {offsets.shape}")

# Visualise anchors for one position
fig, ax = plt.subplots(figsize=(6, 6))
img_size = feature_h * stride
ax.set_xlim(0, img_size); ax.set_ylim(0, img_size)
ax.invert_yaxis(); ax.set_aspect('equal')

pos_idx = feature_h // 2 * feature_w + feature_w // 2  # centre position
colors = ['#3498db', '#e74c3c', '#27ae60']
for i, s in enumerate(scales):
    for j, r in enumerate(ratios):
        idx = pos_idx * n_anchors_per_pos + i * len(ratios) + j
        a = anchors[idx]
        rect = patches.Rectangle((a[0], a[1]), a[2]-a[0], a[3]-a[1],
                                  linewidth=1.5, edgecolor=colors[i],
                                  facecolor='none', linestyle=['--', '-', ':'][j])
        ax.add_patch(rect)

ax.scatter([img_size/2], [img_size/2], c='red', s=50, zorder=5)
ax.set_title(f'Anchors at centre position\n3 scales × 3 ratios = {n_anchors_per_pos}')
ax.grid(True, alpha=0.3)
plt.tight_layout(); plt.show()
```

1. 实现一种带有跳接连接的简化版U-Net编码器-解码器，用于一维信号的分割（对一维信号进行二值标记）。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def conv1d_same(x, kernel):
    """1D convolution with same padding."""
    k = len(kernel)
    pad = k // 2
    x_pad = jnp.pad(x, pad, mode='edge')
    n = len(x)
    out = jnp.zeros(n)
    for i in range(n):
        out = out.at[i].set(jnp.sum(x_pad[i:i+k] * kernel))
    return out

def downsample(x):
    return x[::2]

def upsample(x, target_len):
    return jnp.interp(jnp.linspace(0, 1, target_len), jnp.linspace(0, 1, len(x)), x)

def unet_1d(x, params):
    """Simplified 1D U-Net with 2 encoder/decoder levels."""
    # Encoder
    e1 = jnp.maximum(0, conv1d_same(x, params['enc1']))
    e1_down = downsample(e1)

    e2 = jnp.maximum(0, conv1d_same(e1_down, params['enc2']))
    e2_down = downsample(e2)

    # Bottleneck
    bottleneck = jnp.maximum(0, conv1d_same(e2_down, params['bottleneck']))

    # Decoder with skip connections
    d2_up = upsample(bottleneck, len(e2))
    d2 = jnp.maximum(0, conv1d_same(d2_up + e2, params['dec2']))  # skip connection

    d1_up = upsample(d2, len(e1))
    d1 = conv1d_same(d1_up + e1, params['dec1'])  # skip connection

    return jax.nn.sigmoid(d1)

# Create signal with labelled regions
n = 128
t = jnp.linspace(0, 4 * jnp.pi, n)
signal = jnp.sin(t) + 0.5 * jnp.sin(3 * t)
labels = (signal > 0.5).astype(jnp.float32)  # binary segmentation target

key = jax.random.PRNGKey(42)
keys = jax.random.split(key, 5)
params = {
    'enc1': jax.random.normal(keys[0], (5,)) * 0.3,
    'enc2': jax.random.normal(keys[1], (5,)) * 0.3,
    'bottleneck': jax.random.normal(keys[2], (3,)) * 0.3,
    'dec2': jax.random.normal(keys[3], (5,)) * 0.3,
    'dec1': jax.random.normal(keys[4], (5,)) * 0.3,
}

def loss_fn(params, signal, labels):
    pred = unet_1d(signal, params)
    return -jnp.mean(labels * jnp.log(pred + 1e-7) + (1 - labels) * jnp.log(1 - pred + 1e-7))

grad_fn = jax.jit(jax.grad(loss_fn))
lr = 0.05

for step in range(500):
    grads = grad_fn(params, signal, labels)
    params = {k: params[k] - lr * grads[k] for k in params}

pred = unet_1d(signal, params)

fig, axes = plt.subplots(3, 1, figsize=(12, 7), sharex=True)
axes[0].plot(t, signal, color='#3498db', linewidth=1.5)
axes[0].set_title('Input Signal'); axes[0].set_ylabel('Value')

axes[1].fill_between(t, 0, labels, alpha=0.3, color='#27ae60')
axes[1].set_title('Ground Truth Labels'); axes[1].set_ylabel('Label')

axes[2].plot(t, pred, color='#e74c3c', linewidth=1.5)
axes[2].fill_between(t, 0, (pred > 0.5).astype(float), alpha=0.2, color='#e74c3c')
axes[2].set_title('U-Net Prediction'); axes[2].set_ylabel('Probability')
axes[2].set_xlabel('t')

plt.tight_layout(); plt.show()
print(f"Final loss: {loss_fn(params, signal, labels):.4f}")
print(f"Pixel accuracy: {jnp.mean((pred > 0.5) == labels):.2%}")
```

## 视觉变换器与图像生成

_视觉变换器将自注意力机制应用于图像块，通过数据驱动的空间学习方式挑战CNN的统治地位。本文件涵盖了ViT、DeiT、Swin Transformer，以及利用GAN（StyleGAN）、VAE和扩散模型（DDPM、Stable Diffusion）进行图像生成的技术，还包括超分辨率处理和神经风格迁移技术。_

- CNN（文件02）具有强大的空间归纳偏置：局部连接性、权重共享以及平移不变性。而视觉变换器则提出了一个富有挑战性的问题：如果我们完全摒弃这些偏置，仅依靠第06章中介绍的注意力机制，让模型从数据中学习空间结构，会怎么样呢？

- **视觉变换器（ViT）**（Dosovitskiy等人，2021年）是将标准的Transformer编码器直接应用于图像上。其核心思想是将图像视为一系列图像块，就如同自然语言处理中将文本视为一系列令牌一样。

- 具体处理流程如下：

1. 将图像（高度为$H$，宽度为$W$，通道数为$C$）分割成大小为$P \times P$且不重叠的图像块，这样就能得到$N = HW / P^2$个图像块。
2. 将每个图像块展平为长度为$P^2 \cdot C$的向量，然后通过一个学到的线性嵌入方式将其映射到模型维度$D$上（即进行一次矩阵乘法，详见第02章）。
3. 在向量开头添加一个可学习的**[CLS]令牌**嵌入（类似于BERT中的[CLS]令牌，详见第07章）。该令牌会关注所有图像块，其最终表示结果用于分类任务。
4. 由于注意力机制具有排列不变性，因此需要添加**位置嵌入**（每个位置对应一个可学习向量）以提供空间信息。
5. 将这$(N + 1)$个令牌嵌入序列输入标准的Transformer编码器中进行处理（包括多头自注意力机制和FFN结构，详见第06章）。
6. [CLS]令牌的最终表示结果会被送入分类头中处理（即一个小型多层感知机）。

![ViT处理流程：图像被分割成16×16大小的图像块，每个块被展平并经过线性投影处理，之后添加[CLS]令牌和位置嵌入，最后由Transformer编码器处理](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/vit_pipeline.svg)

- **图像块嵌入**实际上相当于使用核大小为$P$、步长也为$P$的卷积操作（且为非重叠卷积）。ViT实际上是将二维图像转换为了一维序列，然后再用处理语言的相同架构来处理这一序列。

- 相比于CNN，ViT的归纳偏置更少：它不强制要求局部连接性或平移不变性。这意味着ViT需要更多的训练数据才能从零开始学习空间结构。在数据量较小的情况下，CNN的性能优于ViT。但在处理非常大的数据集时（如JFT-300M，包含3亿张图像），ViT的性能可以媲美甚至超越最优秀的CNN模型，这说明CNN的归纳偏置虽然有助于提高数据利用效率，但并非决定性能的关键因素。

- ViT的自注意力机制的计算复杂度为$O(N^2)$，其中$N$是图像块的数量。对于224×224大小的图像，若采用16×16大小的图像块，则$N = 196$，这个数值还在可接受范围内。但对于更高分辨率的图像或更小的图像块，这种二次方的计算复杂度就会变得过高，难以处理。

- **DeiT**（高效图像变换器，Touvron等人，2021年）表明，通过强大的数据增强技术、正则化方法（如随机深度、标签平滑、dropout），以及**知识蒸馏**技术，即使没有庞大的JFT数据集，仅依靠ImageNet数据，也能有效训练ViT。在DeiT模型中，除了[CLS]令牌外，还添加了一个**蒸馏令牌**，该令牌被用来预测预训练的CNN模型的输出结果。

- **Swin Transformer**（Liu等人，2021年）解决了ViT的两个主要缺陷：其一是对图像尺寸的二次方级计算复杂度；其二是没有层次化的特征图，而检测和分割任务恰恰需要层次化特征图。

- Swin Transformer引入了**滑动窗口**机制：它不是对所有图像块进行全局自注意力计算，而是在局部窗口内进行注意力计算（例如7×7大小的窗口）。这样一来，计算复杂度就变成了与图像尺寸成线性关系，即$O(N)$而非$O(N^2)$。不过，仅靠局部窗口的话，不同区域之间的信息交流就会受到限制。

- **窗口滑动**机制解决了这个问题：在交替的层中，窗口的分割位置会向半窗大小的方向移动。这样一来，就可以在层与层之间建立跨窗口的连接，从而使图像各部分之间的信息能够相互传递，而无需付出全局注意力计算的代价。

![Swin Transformer：第l层在固定大小的窗口内进行注意力计算，第l+1层则将窗口分割位置向半窗大小方向移动，从而实现跨窗口连接](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/swin_shifted_windows.svg)

- Swin Transformer还通过在不同阶段合并图像块来构建**层次化特征表示**。在每个阶段之后，相邻的2×2图像块会被拼接在一起，随后经过投影处理，使得通道数翻倍，而空间分辨率则减半。这样就能生成类似CNN和FPN（文件03）中的多尺度特征图，因此Swin Transformer可以直接与Faster R-CNN之类的检测模块以及U-Net之类的分割模块相兼容。

- **PVT**（金字塔视觉变换器）也采用了类似的层次化处理方式，但它使用了空间降采样注意力机制：在每个阶段，计算注意力之前，先对键值数据进行空间降采样，这样就能降低二次方的计算复杂度，同时仍能保持全局感知能力。

- **自我监督视觉学习**则是通过无标签图像来训练模型特征。虽然获取标签的成本很高，但图像资源却非常丰富。其目标是在无需任何人工标注的情况下，学习出能够很好地应用于后续任务的特征。

- **对比学习**则是让模型学会识别：同一图像的两种经过增强处理的视图（即“正样本对”）应该具有相似的特征表示，而不同图像的视图（即“负样本对”）则应具有不同的特征表示。

- **SimCLR**（Chen等人，2020年）会对批次中的每张图像生成两种经过增强处理的视图，然后使用相同的骨干网络和投影头对这两种视图进行编码，最后应用**NT-Xent损失函数**（归一化温度缩放交叉熵损失）：

$$\ell_{i,j} = -\log \frac{\exp(\text{sim}(z_i, z_j) / \tau)}{\sum_{k \neq i} \exp(\text{sim}(z_i, z_k) / \tau)}$$

- 其中$\text{sim}$表示余弦相似度（见第01章），$\tau$为温度参数。分子的作用是将正相关的样本拉在一起，而分母则将负相关的样本分开。SimCLR需要较大的批量大小（4,096以上）才能获得足够的负样本。

- **MoCo**（动量对比法，He等人，2020年）通过维护一个经过动量更新的负嵌入队列来避免对大批量的需求。查询编码器通过梯度下降进行更新；键编码器则作为查询编码器的指数移动平均值来更新：$\theta_k \leftarrow m \theta_k + (1 - m) \theta_q$，其中$m = 0.999$。该队列存储了最近的键嵌入，从而无需巨大批量即可获得大量且一致的负样本。

- **BYOL**（自主构建潜在特征，Grill等人，2020年）则完全摒弃了负样本的使用。它使用两个网络：一个“在线”网络和一个“目标”网络（即在线网络的指数移动平均值）。在线网络会预测目标网络对不同增强视角下的图像的表示。由于没有负样本，BYOL通过预测器与目标网络的不对称性避免了模型输出相同向量的问题。

- **DINO**（无标签自蒸馏方法，Caron等人，2021年）将自蒸馏技术应用于ViT模型。学生网络会预测教师网络在不同增强视角下的输出结果（即学生网络的指数移动平均值）。教师网络使用较大的图像区域，而学生网络则使用较小的区域。DINO生成的特征包含了关于场景结构的明确信息：经过DINO训练的ViT模型的自注意力图能够无需任何分割监督即可自动对物体进行分割。

- **掩码图像建模**是BERT掩码语言建模方法的视觉领域对应形式（见第07章）。输入图像中的大部分像素会被屏蔽，模型则需要学习如何重建这些被屏蔽的像素。

- **MAE**（掩码自编码器，He等人，2022年）会屏蔽75%的像素，然后训练ViT编码器-解码器来重建缺失的像素值。只有未被屏蔽的像素才会被编码器处理（这可在预训练阶段节省4倍的计算量），而轻量级的解码器则利用已编码的可见像素以及可学习的掩码令牌来重建完整图像。

- **BEiT**（图像变换器的BERT预训练方法，Bao等人，2022年）会屏蔽图像中的某些像素，然后预测离散的视觉令牌（这些令牌来自预训练过的dVAE分词器），而非原始像素值。这一方法类似于BERT对离散单词令牌的预测，从而避免了直接处理像素细节的复杂性。

- **图像生成**的目标是创造训练集中不存在的、逼真的新图像。其核心挑战在于如何对自然图像的高维概率分布进行建模。

- **生成对抗网络（GANs）**（Goodfellow等人，2014年）由两个相互竞争的网络组成：一个**生成器**$G$，负责从随机噪声中生成虚假图像；另一个**判别器**$D$，则试图区分真实图像与虚假图像。这两个网络通过对抗式训练相互博弈：生成器试图欺骗判别器，而判别器则试图识破生成器的把戏。

$$\min_G \max_D \; \mathbb{E}_{x \sim p_{\text{data}}}[\log D(x)] + \mathbb{E}_{z \sim p(z)}[\log(1 - D(G(z)))]$$

- 生成器首先从高斯分布等简单分布中抽取一个随机潜向量$z$，然后通过一系列转置卷积操作将其转换为图像。判别器则是一个标准的CNN分类器。在平衡状态下，生成器生成的图像与真实数据难以区分，而判别器对所有输入的判断结果均为0.5。

- **模式崩溃**是GANs的主要缺陷：生成器只会学习生成少数几种能够欺骗判别器的图像，而忽视了训练数据的多样性。生成器只会寻找少量“安全”的输出结果，而无法覆盖整个概率分布。

- 为稳定GANs，人们采用了多种训练技巧，包括：谱归一化（限制判别器的Lipschitz常数）、逐步提升分辨率训练（先在低分辨率下训练，再逐渐提高分辨率）、特征匹配（比较判别器中间层的特征统计量而非最终输出结果），以及使用Wasserstein距离代替原有的JS散度作为优化目标。

- **StyleGAN**（Karras等人，2019年）是目前用于高质量图像合成的最具影响力的GAN架构。它的创新之处在于引入了**基于风格的生成器**：不再直接将潜向量$z$输入生成器，而是先通过一个8层MLP构成的映射网络将其转换为风格向量$w$。这个风格向量会通过**自适应实例归一化（AdaIN）**机制被注入生成器的每一层，从而调整该层的特征图统计特性：

$$\text{AdaIN}(x, y) = y_{s} \cdot \frac{x - \mu(x)}{\sigma(x)} + y_{b}$$

其中$y_s$和$y_b$分别是由$w$确定的缩放系数和偏置值。不同层次控制着不同的特征：早期层次控制粗略特征（如姿态、面部形状），中间层次控制中等特征（如发型、眼睛），而后期层次则控制细微特征（如雀斑、头发纹理）。StyleGAN能够以1024x1024的分辨率生成逼真的面部图像。

- **变分自编码器（VAEs）**（见第06章）提供了一种不同的生成方法。与GANs不同，VAEs拥有基于概率论的框架，并且有明确的训练目标——ELBO函数。虽然VAE生成的图像通常比GANs更模糊，但它们能产生更加平滑、结构化的潜空间。在潜在扩散模型中，VAE正是作为编码器-解码器对来实现图像在潜空间与实际图像之间的转换。

- **扩散模型**现已成为图像生成领域的主流方法，其在图像质量与多样性方面都优于GANs。其原理相当简单：首先逐步向数据中添加噪声，直到数据变为纯粹的高斯噪声（即**前向过程**），然后再逐步学习如何逆转这一过程（即**后向过程**）。

- 在**前向过程**中，会在$T$个时间步内逐步向数据中添加高斯噪声：

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t; \sqrt{1 - \beta_t} \, x_{t-1}, \beta_t I)$$

其中，$\beta_t$ 是一个随时间递增的噪声调度参数。经过足够多的步骤后，无论初始图像 $x_0$ 如何，$x_T$ 都会近似成为纯高斯噪声。通过重参数化技巧（见第06章），并令 $\alpha_t = 1 - \beta_t$、$\bar{\alpha}_t = \prod_{s=1}^{t} \alpha_s$，我们可以直接从 $x_0$ 中采样得到 $x_t$：

$$x_t = \sqrt{\bar{\alpha}_t} \, x_0 + \sqrt{1 - \bar{\alpha}_t} \, \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

**反向过程**则用于去噪：从纯噪声 $x_T$ 开始，模型预测每一步中添加的噪声 $\epsilon$，然后将其减去以恢复出 $x_{t-1}$。这一过程由神经网络 $\epsilon_\theta$（通常是U-Net，见文件03）来实现，该网络的训练采用简单的MSE损失函数：

$$\mathcal{L} = \mathbb{E}_{t, x_0, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t)\|^2\right]$$

![扩散模型的正向与反向过程：在T步内，清晰图像逐渐被噪声污染（正向过程）；神经网络则学习如何逆向操作，从纯噪声开始逐步恢复出清晰图像（反向过程）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/diffusion_process.svg)

**DDPM**（去噪扩散概率模型，Ho等人，2020年）建立了这一框架。其采样过程需要遍历全部T步（通常为1,000步），效率较低。**DDIM**（去噪扩散隐式模型，Song等人，2021年）则将采样过程重新定义为确定性映射，从而允许跳过大量步骤（例如直接跳过50步而非1,000步），同时还能保持较高的图像质量。

**基于得分的模型**（Song和Ermon，2019年）提供了另一种思路。这类模型不预测噪声 $\epsilon$，而是估计**得分函数** $\nabla_{x_t} \log p(x_t)$，即带噪声图像的对数概率梯度。该梯度指向数据分布中概率更高的（更清晰的）区域。采样过程则利用朗之万动力学沿着该梯度进行。基于得分的模型与DDPM可以被统一到**随机微分方程**的框架中：正向过程是添加噪声的随机微分方程，而反向过程则是该方程的时间反转形式。

**无分类器引导机制**（Ho和Salimans，2022年）用于控制样本质量与多样性之间的平衡。该模型既可以在有条件情况下训练（借助文本提示或类别标签），也可以在无条件情况下训练（随机去掉这些条件）。在采样时，预测结果为各种条件的加权组合：

$$\hat{\epsilon} = \epsilon_\theta(x_t, \varnothing) + s \cdot (\epsilon_\theta(x_t, c) - \epsilon_\theta(x_t, \varnothing))$$

其中，$c$ 表示条件，$\varnothing$ 表示无条件状态，$s > 1$ 是引导系数。较大的$s$值会使生成的图像更符合给定条件，但多样性降低；$s = 1$时对应无引导的模型；$s = 7.5$是常见的默认值。

**潜在空间扩散模型**（Rombach等人，2022年；Stable Diffusion）将扩散过程从像素空间转移到经过学习的潜在空间中。预训练好的VAE编码器会将图像压缩为低维度的潜在表示（通常进行4倍或8倍的空间下采样），扩散操作就在这个压缩后的空间中进行，随后VAE解码器再从去噪后的潜在表示中重建像素。这种方式效率极高：在像素空间中对512x512的图像进行扩散处理，需要处理$512 \times 512 \times 3$大小的张量；而在潜在空间中，只需处理$64 \times 64 \times 4$大小的张量即可。

在潜在空间扩散模型中，去噪用的U-Net会接收带噪声的潜在表示、时间步信息（以正弦函数形式编码，类似于变换器中的位置编码）以及条件信号（来自已冻结的CLIP或T5文本编码器的文本嵌入）。文本条件信息通过U-Net内的交叉注意力层传递进来：文本嵌入作为键和值，而图像特征则作为查询项。这样，模型就能在每个空间位置上关注文本提示中的相关部分。

**流匹配**是一种新兴的替代扩散方法的方案，它直接学习噪声与数据之间的传输路径，而非像DDPM那样通过迭代方式去噪。

**连续归一化流**定义了一个随时间变化的速度场 $v_\theta(x, t)$，该速度场能将样本从简单分布 $p_0$（即噪声）沿着平滑的轨迹引导至数据分布 $p_1$。这种转换遵循常微分方程：

$$\frac{dx}{dt} = v_\theta(x, t), \quad t \in [0, 1]$$

从 $x_0 \sim \mathcal{N}(0, I)$ 开始，将上述常微分方程从 $t=0$ 积分到 $t=1$，就可以得到数据分布下的样本。该速度场由神经网络参数化，并经过训练以匹配目标条件流。

**最优传输流匹配**方法（Lipman等人，2023年）以噪声与数据之间的直线路径作为目标流：从噪声样本 $x_0$ 到数据样本 $x_1$ 的路径为 $x_t = (1 - t) x_0 + t x_1$，而目标速度则为 $v = x_1 - x_0$。相应的训练损失函数为：

$$\mathcal{L} = \mathbb{E}_{t, x_0, x_1} \left[\|v_\theta(x_t, t) - (x_1 - x_0)\|^2\right]$$

**修正流**方法（Liu等人，2022年）通过迭代方式使学到的流路径更加平滑。在初始训练之后，模型可以通过模拟常微分方程来生成（噪声，数据）对。这些配对比随机配对更为匹配，因此可用来重新训练模型。重复这一过程后，流路径会变得越来越平滑，从而可以用更少的常微分方程步骤来完成转换（甚至只需一步），进而实现极快的图像生成速度。

相比扩散模型，流匹配方法具有多项优势：训练目标更简单（仅需直接进行速度回归，无需噪声调度），采样所需的常微分方程也更平滑（需要的积分步数更少），而且其与最优传输理论相衔接，具有坚实的理论基础。Stable Diffusion 3和Flux模型都采用了流匹配方法，而非传统的DDPM。

## 编程任务（可使用CoLab或笔记本完成）（续3）

1. 从零开始实现ViT的补丁嵌入机制。将图像分割成多个补丁，将其展平后映射到模型所需的维度上，再加入位置嵌入信息，并在开头添加[CLS]令牌。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def create_patch_embedding(image, patch_size, d_model, params):
    """Convert an image into a sequence of patch embeddings."""
    H, W, C = image.shape
    n_patches_h = H // patch_size
    n_patches_w = W // patch_size
    n_patches = n_patches_h * n_patches_w

    # Extract patches
    patches = []
    for i in range(n_patches_h):
        for j in range(n_patches_w):
            patch = image[i*patch_size:(i+1)*patch_size,
                          j*patch_size:(j+1)*patch_size, :]
            patches.append(patch.ravel())
    patches = jnp.stack(patches)  # (N, P*P*C)

    # Linear projection to d_model
    embeddings = patches @ params['proj_w'] + params['proj_b']  # (N, d_model)

    # Prepend CLS token
    cls_token = params['cls_token']  # (1, d_model)
    embeddings = jnp.concatenate([cls_token, embeddings], axis=0)  # (N+1, d_model)

    # Add position embeddings
    embeddings = embeddings + params['pos_embed']  # (N+1, d_model)

    return embeddings, patches

# Setup
H, W, C = 32, 32, 3
patch_size = 8
d_model = 64
n_patches = (H // patch_size) * (W // patch_size)  # 16

key = jax.random.PRNGKey(42)
keys = jax.random.split(key, 5)

# Create a synthetic image with distinct quadrants
image = jnp.zeros((H, W, C))
image = image.at[:16, :16, 0].set(1.0)   # red top-left
image = image.at[:16, 16:, 1].set(1.0)   # green top-right
image = image.at[16:, :16, 2].set(1.0)   # blue bottom-left
image = image.at[16:, 16:, :2].set(1.0)  # yellow bottom-right

params = {
    'proj_w': jax.random.normal(keys[0], (patch_size**2 * C, d_model)) * 0.02,
    'proj_b': jnp.zeros(d_model),
    'cls_token': jax.random.normal(keys[1], (1, d_model)) * 0.02,
    'pos_embed': jax.random.normal(keys[2], (n_patches + 1, d_model)) * 0.02,
}

embeddings, patches = create_patch_embedding(image, patch_size, d_model, params)

print(f"Image shape: {image.shape}")
print(f"Patch size: {patch_size}x{patch_size}")
print(f"Number of patches: {n_patches}")
print(f"Patch vector length: {patch_size**2 * C}")
print(f"Embedding shape: {embeddings.shape}  (CLS + {n_patches} patches)")

# Visualise patches
fig, axes = plt.subplots(2, 5, figsize=(14, 6))
axes[0, 0].imshow(image); axes[0, 0].set_title('Full Image'); axes[0, 0].axis('off')
for idx in range(min(9, n_patches)):
    ax = axes[(idx+1) // 5, (idx+1) % 5]
    patch_img = patches[idx].reshape(patch_size, patch_size, C)
    ax.imshow(patch_img); ax.set_title(f'Patch {idx}'); ax.axis('off')
plt.suptitle('ViT Patch Decomposition')
plt.tight_layout(); plt.show()
```

1. 实现一个简单的GAN训练循环。在二维数据上训练生成器和判别器，并观察生成的分布如何逐渐趋近于真实分布。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def generator(z, params):
    h = jnp.tanh(z @ params['g_w1'] + params['g_b1'])
    h = jnp.tanh(h @ params['g_w2'] + params['g_b2'])
    return h @ params['g_w3'] + params['g_b3']

def discriminator(x, params):
    h = jax.nn.leaky_relu(x @ params['d_w1'] + params['d_b1'], 0.2)
    h = jax.nn.leaky_relu(h @ params['d_w2'] + params['d_b2'], 0.2)
    return jax.nn.sigmoid(h @ params['d_w3'] + params['d_b3'])

def init_params(key):
    keys = jax.random.split(key, 6)
    z_dim, h_dim, data_dim = 2, 32, 2
    scale = 0.1
    return {
        'g_w1': jax.random.normal(keys[0], (z_dim, h_dim)) * scale,
        'g_b1': jnp.zeros(h_dim),
        'g_w2': jax.random.normal(keys[1], (h_dim, h_dim)) * scale,
        'g_b2': jnp.zeros(h_dim),
        'g_w3': jax.random.normal(keys[2], (h_dim, data_dim)) * scale,
        'g_b3': jnp.zeros(data_dim),
        'd_w1': jax.random.normal(keys[3], (data_dim, h_dim)) * scale,
        'd_b1': jnp.zeros(h_dim),
        'd_w2': jax.random.normal(keys[4], (h_dim, h_dim)) * scale,
        'd_b2': jnp.zeros(h_dim),
        'd_w3': jax.random.normal(keys[5], (h_dim, 1)) * scale,
        'd_b3': jnp.zeros(1),
    }

def d_loss(params, real_data, fake_data):
    real_score = discriminator(real_data, params)
    fake_score = discriminator(fake_data, params)
    return -jnp.mean(jnp.log(real_score + 1e-7) + jnp.log(1 - fake_score + 1e-7))

def g_loss(params, fake_data):
    fake_score = discriminator(fake_data, params)
    return -jnp.mean(jnp.log(fake_score + 1e-7))

# Real data: ring distribution
key = jax.random.PRNGKey(42)
theta = jax.random.uniform(key, (512,)) * 2 * jnp.pi
real_data = jnp.stack([jnp.cos(theta), jnp.sin(theta)], axis=1)
real_data = real_data + jax.random.normal(key, real_data.shape) * 0.05

params = init_params(jax.random.PRNGKey(0))
d_grad = jax.grad(d_loss)
g_grad = jax.grad(g_loss)
lr = 0.001

snapshots = []
for step in range(3000):
    key, k1 = jax.random.split(key)
    z = jax.random.normal(k1, (512, 2))
    fake_data = generator(z, params)

    # Update discriminator
    grads = d_grad(params, real_data, fake_data)
    for k in ['d_w1', 'd_b1', 'd_w2', 'd_b2', 'd_w3', 'd_b3']:
        params[k] = params[k] - lr * grads[k]

    # Update generator
    fake_data = generator(z, params)
    grads = g_grad(params, fake_data)
    for k in ['g_w1', 'g_b1', 'g_w2', 'g_b2', 'g_w3', 'g_b3']:
        params[k] = params[k] - lr * grads[k]

    if step in [0, 500, 1500, 2999]:
        snapshots.append((step, fake_data.copy()))

fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, (step, fake) in zip(axes, snapshots):
    ax.scatter(real_data[:, 0], real_data[:, 1], s=5, alpha=0.3, c='#3498db', label='Real')
    ax.scatter(fake[:, 0], fake[:, 1], s=5, alpha=0.3, c='#e74c3c', label='Generated')
    ax.set_title(f'Step {step}'); ax.set_xlim(-2, 2); ax.set_ylim(-2, 2)
    ax.set_aspect('equal'); ax.legend(markerscale=3)
plt.suptitle('GAN Training: Generator Learns the Ring Distribution')
plt.tight_layout(); plt.show()
```

1. 实现扩散过程的前向步骤：在逐渐增加的时间步长下为图像添加噪声，并观察图像逐渐被破坏的过程。随后实现一个去噪步骤。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def noise_schedule(T, beta_start=0.0001, beta_end=0.02):
    """Linear noise schedule."""
    betas = jnp.linspace(beta_start, beta_end, T)
    alphas = 1.0 - betas
    alpha_bars = jnp.cumprod(alphas)
    return betas, alphas, alpha_bars

def forward_diffusion(x0, t, alpha_bars, key):
    """Add noise to x0 at timestep t."""
    alpha_bar_t = alpha_bars[t]
    noise = jax.random.normal(key, x0.shape)
    xt = jnp.sqrt(alpha_bar_t) * x0 + jnp.sqrt(1 - alpha_bar_t) * noise
    return xt, noise

# Create a simple 2D "image" (checkerboard)
img = jnp.zeros((32, 32))
for i in range(4):
    for j in range(4):
        if (i + j) % 2 == 0:
            img = img.at[i*8:(i+1)*8, j*8:(j+1)*8].set(1.0)

T = 1000
betas, alphas, alpha_bars = noise_schedule(T)

# Visualise forward process
timesteps = [0, 50, 200, 500, 999]
key = jax.random.PRNGKey(42)

fig, axes = plt.subplots(1, len(timesteps), figsize=(16, 3.5))
for ax, t in zip(axes, timesteps):
    key, subkey = jax.random.split(key)
    xt, noise = forward_diffusion(img, t, alpha_bars, subkey)
    ax.imshow(xt, cmap='gray', vmin=-2, vmax=2)
    ax.set_title(f't={t}\n$\\bar{{\\alpha}}$={alpha_bars[t]:.3f}')
    ax.axis('off')
plt.suptitle('Diffusion Forward Process: Progressive Noise Addition')
plt.tight_layout(); plt.show()

# Simple denoising: train a tiny network to predict noise at t=200
t_denoise = 200
key, k1 = jax.random.split(key)
xt, true_noise = forward_diffusion(img, t_denoise, alpha_bars, k1)

# Tiny "denoiser": just learn a constant noise estimate (for illustration)
noise_estimate = jnp.zeros_like(img)
lr = 0.01
for step in range(100):
    residual = noise_estimate - true_noise
    noise_estimate = noise_estimate - lr * residual

# Reverse one step
alpha_bar_t = alpha_bars[t_denoise]
x_denoised = (xt - jnp.sqrt(1 - alpha_bar_t) * noise_estimate) / jnp.sqrt(alpha_bar_t)

fig, axes = plt.subplots(1, 3, figsize=(12, 4))
axes[0].imshow(img, cmap='gray'); axes[0].set_title('Original $x_0$'); axes[0].axis('off')
axes[1].imshow(xt, cmap='gray', vmin=-2, vmax=2)
axes[1].set_title(f'Noisy $x_{{200}}$'); axes[1].axis('off')
axes[2].imshow(x_denoised, cmap='gray')
axes[2].set_title('Denoised (one step)'); axes[2].axis('off')
plt.tight_layout(); plt.show()

mse = jnp.mean((x_denoised - img)**2)
print(f"Denoising MSE: {mse:.4f}")
```

## 视频与3D视觉

_视频与3D视觉将图像理解扩展到时间和空间领域。本文档涵盖了光流、视频分类（3D CNN、TimeSformer）、物体跟踪（SORT、DeepSORT）、动作识别、深度估计（单目与双目）、点云、NeRF以及3D高斯泼溅技术。_

- 文件01–04将图像视为独立的快照。但视觉世界是连续的：物体会移动，场景会变化，且存在深度信息。本文档将计算机视觉扩展到时间领域（视频）和空间领域（3D），介绍了模型如何理解运动、跟踪物体、估计深度以及重建场景。

- **视频**是一系列随时间捕捉的图像（帧）。以每秒30帧的速度计算，一段10秒的视频包含300帧。关键挑战在于建模**时间维度**：物体如何运动？场景如何演变？我们又如何关联各帧之间的信息？

- **光流**用于估算两连续帧之间像素的表观运动。对于第$t$帧中的每个像素，光流会生成一个二维位移向量$(u, v)$，指示该像素在第$t+1$帧中的位置。其结果是一个与图像尺寸相同的密集运动场。

![两张连续的视频帧及其间的光流场，以彩色箭头表示像素的运动方向与幅度](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/optical_flow.svg)

- 光流的计算基于**亮度恒定假设**：像素在移动过程中其强度保持不变。如果第$t$帧中位置$(x, y)$处的像素强度为$I(x, y, t)$，且在微小时间间隔$\delta t$内移动了$(u, v)$：

$$I(x + u\delta t, \, y + v\delta t, \, t + \delta t) = I(x, y, t)$$

- 进行一阶泰勒展开（见第03章）并除以$\delta t$：

$$I_x u + I_y v + I_t = 0$$

- 其中$I_x, I_y$为空间梯度（Sobel算子，见文件01），$I_t$为时间梯度（连续帧之间的差异）。这就是**光流约束方程**。一个方程，两个未知数（$u, v$）：我们需要额外的约束条件。

- **Lucas-Kanade算法**假设在小窗口内（例如5×5像素）光流是恒定的。这便构成了一个超定系统（25个方程，2个未知数），可通过最小二乘法求解（即第06章中的正规方程）：

$$
\begin{bmatrix} u \\ v \end{bmatrix} = \begin{bmatrix} \sum I_x^2 & \sum I_x I_y \\ \sum I_x I_y & \sum I_y^2 \end{bmatrix}^{-1} \begin{bmatrix} -\sum I_x I_t \\ -\sum I_y I_t \end{bmatrix}

$$

- 2×2矩阵是来自文件01的结构张量（与哈里斯角点检测中使用的矩阵相同）。Lucas-Kanade算法适用于小幅度运动，但当物体在两帧之间移动超过几个像素时便会失效。

- **Farneback方法**通过对每个像素的邻域进行多项式拟合，来估算最能解释帧间变化的位移场。它能生成稠密光流（每个像素对应一个向量），并能处理比Lucas-Kanade更大的运动。

- 现代**深度学习光流**方法（如FlowNet、RAFT）能够直接从成对的帧中端到端地预测光流。**RAFT**（Recurrent All-Pairs Field Transforms，Teed和Deng，2020）计算两帧中所有像素对之间的4D相关体积，并利用基于GRU的更新算子迭代优化光流估计。RAFT达到了最先进的精度，已成为光流任务的标准骨干网络。

- **双流网络**（Simonyan和Zisserman，2014）是早期用于视频理解的方法。其中一个流处理单个RGB帧（外观信息），另一个流处理一系列光流帧（运动信息）。最终通过平均或拼接方式融合这两个流的信息。这种架构明确区分了“物体的外观”与“它们的运动方式”。

- **3D卷积网络**将2D卷积扩展到时间维度。3D卷积使用大小为$k \times k \times k_t$的滤波器，同时覆盖空间和时间维度，从而直接学习时空特征。

- **C3D**（Tran等人，2015）采用堆叠的3D卷积结构，滤波器尺寸为3×3×3，证明了无需显式光流即可通过时间卷积学习运动特征。不过代价高昂：3D卷积的参数数量和计算量都是2D卷积的$k_t$倍。

- **I3D**（Inflated 3D，Carreira和Zisserman，2017）采用了更实用的方法：以预训练的2D CNN（如Inception或ResNet）为基础，通过将权重沿时间维度复制并除以$k_t$，将所有2D滤波器扩展为3D滤波器。这样便能将ImageNet预训练成果迁移到视频领域，同时加入时间建模能力。一个2D的$k \times k$滤波器会变为$k \times k \times k_t$的滤波器，其初始化方式为：对所有时间位置$j$，有$W_{\text{3D}}[:,:,j] = W_{\text{2D}} / k_t$。

- **SlowFast网络**（Feichtenhofer等人，2019）使用两条并行路径，以不同的时间分辨率处理视频：
- **Slow路径**以较低的帧率（例如每16帧）处理视频，具有较高的空间分辨率和较多的通道数，用于捕捉精细的空间细节。
- **Fast路径**以较高的帧率（每2帧）处理视频，空间分辨率较低且通道数较少（通常为Slow路径的1/8），用于捕捉快速的时间变化。
- 横向连接通过步长卷积将Fast路径的信息融合到Slow路径中。

- 其核心理念在于：空间信息和时间信息所需的带宽不同——物体外观变化缓慢，而运动却可能很快。SlowFast网络在设计上正好契合这种不对称性。

- **TimeSformer**（Bertasius等人，2021）将Vision Transformer应用于视频处理。它将完整的时空注意力计算（其计算复杂度高达$O((T \times N)^2)$，其中$T$为帧数，$N$为每帧的块数）分解为**分块注意力**：每个模块交替使用时间注意力（每个块在同一空间位置跨时间进行关注）和空间注意力（每个块在同一帧内跨空间进行关注）。这样便将计算复杂度从$O(T^2 N^2)$降低至$O(T^2 + N^2)$。

- **VideoMAE**（Tong等人，2022）将掩码自编码器思想（见文件04）扩展到视频领域。由于视频具有很高的时间冗余性——相邻帧几乎完全相同——因此可以采用极高的掩码比例（90–95%）：即使掩蔽大部分块，仍足以保留足够的信息用于重建。VideoMAE在无标签视频上预训练ViT骨干网络，随后将其迁移到下游任务中。

- **动作识别**是将视频片段归类到多个动作类别之一（如“跑步”、“烹饪”、“弹吉他”）。它相当于视频领域的图像分类。常用基准数据集包括Kinetics-400（400个动作类别，约30万段视频）、Something-Something（174个需要时序推理的细粒度动作）以及ActivityNet（200个类别，包含较长的未裁剪视频）。

- **时序动作检测**不仅涉及分类：给定一段较长的未裁剪视频，需找出每个动作的起始时间、结束时间及类别。这相当于视频领域的目标检测。像ActionFormer这样的方法利用Transformer处理时序特征并预测动作边界。

- **视频目标跟踪**是指在第一帧中识别出某个目标后，在后续帧中持续追踪该目标。

- **SORT**（Simple Online and Realtime Tracking，Bewley等人，2016）将检测模型（独立地在每一帧中检测物体）与用于运动预测的**卡尔曼滤波器**以及用于分配的**匈牙利算法**相结合。

- **卡尔曼滤波器**为每个被跟踪的物体维护一个状态估计值（位置、速度、尺寸），并利用线性运动模型预测其在下一帧中的位置。当新的检测结果到来时，卡尔曼滤波器通过结合预测值与观测值来更新估计值，更新权重取决于两者各自的不确定性。这正是贝叶斯更新（第五章）在跟踪中的应用。

- **匈牙利算法**用于解决二元匹配问题：给定$M$个已跟踪物体和$N$个新检测结果，找到使总成本最小的最优一一对应关系（成本基于文件03中的IoU距离计算）。未匹配的检测结果会启动新的跟踪；未匹配的跟踪则在宽限期过后被终止。
- **DeepSORT**在SORT的基础上增加了**深度外观特征**：每个检测到的物体都会经过一个小型CNN，生成外观嵌入向量（描述符）。匹配成本结合了IoU距离与嵌入空间中的余弦距离（见第01章）。这种方法能够应对遮挡和重新识别问题：即使某个物体在几帧内被其他物体遮挡，其外观嵌入向量也能帮助在它重新出现时重新匹配。

- **ByteTrack**（Zhang等人，2022年）通过利用所有检测结果来改进跟踪，包括置信度较低的结果。大多数跟踪器会丢弃低于置信度阈值的检测结果。ByteTrack首先将高置信度的检测结果与现有轨迹匹配，再将剩余的低置信度检测结果与未匹配的轨迹配对。这样就能恢复那些暂时被遮挡或模糊、因而检测置信度较低的物体。

- **3D视觉**能够恢复在2D图像投影中丢失的第三维空间信息（见文件01）。

- **深度估计**用于预测场景中各点到相机的距离。

- **立体深度**利用两个基线距离$b$已知的摄像头。同一个点在左右图像中会出现在不同的水平位置（这种偏移称为**视差**$d$）。深度与视差成反比：

$$Z = \frac{f \cdot b}{d}$$

其中$f$为焦距，$b$为基线距离。计算视差需要在两幅图像中找到对应点（即立体匹配），这相当于沿水平扫描线的1D搜索过程（由于摄像头水平排列，3D空间中同一高度的点会在两幅图像中投影到同一行）。

- **单目深度估计**从单张图像中预测深度，这在本质上是一个不适定问题（无数种3D场景都能产生相同的2D图像）。然而人类能凭借相对大小、纹理梯度、遮挡以及大气雾气等线索轻松完成这一任务。深度网络则从训练数据中学习这些线索。

- **MiDaS**和**Depth Anything**等模型能从单张图像中预测相对深度图（确定哪些物体更近）。它们在多样化的数据集上训练，采用尺度不变损失函数，尽管存在理论上的不确定性，却仍能产生非常精确的结果。

- **点云**是由3D点$(x, y, z)$组成的集合，可选包含颜色或其他属性，由激光雷达传感器或立体重建技术获取。与图像不同，点云是无序且间距不规律的。

- **PointNet**（Qi等人，2017年）直接处理点云：对每个点独立应用共享的MLP，再通过最大池化进行聚合（该操作具有排列不变性，解决了顺序问题）。**PointNet++**则增加了分层分组机制，以捕捉多尺度的局部结构。

- **神经辐射场（NeRFs）**（Mildenhall等人，2020年）将3D场景表示为一个连续函数，该函数将3D位置$(x, y, z)$和观测方向$(\theta, \phi)$映射为颜色$(r, g, b)$和密度$\sigma$。该函数由MLP参数化：

$$F_\theta: (x, y, z, \theta, \phi) \to (r, g, b, \sigma)$$

渲染像素时，会从相机出发沿该像素方向向场景发射一条光线。沿光线采样若干点，MLP会预测每点的颜色和密度。像素颜色通过**体积渲染**计算得出：沿光线对加权后的颜色进行积分：

$$C(\mathbf{r}) = \int_{t_n}^{t_f} T(t) \cdot \sigma(\mathbf{r}(t)) \cdot \mathbf{c}(\mathbf{r}(t), \mathbf{d}) \, dt$$

其中$T(t) = \exp(-\int_{t_n}^{t} \sigma(\mathbf{r}(s)) \, ds)$表示累积透射率（即迄今为止被吸收的光量）。实际应用中，该积分通过沿光线采样$N$个点并求和来近似：

$$\hat{C} = \sum_{i=1}^{N} T_i \cdot (1 - \exp(-\sigma_i \delta_i)) \cdot c_i$$

NeRF通过最小化渲染像素与一组已知姿态照片中的真实像素之间的均方误差来进行训练。训练完成后，NeRF能从任意相机位置渲染出逼真的全新视角。其局限性在于速度：渲染过程需要数百万次调用MLP（每个像素的每个采样点一次），因此难以实现实时渲染。

- **3D高斯泼溅**（Kerbl等人，2023年）通过将场景表示为一系列3D高斯图元而非连续的体积函数，解决了NeRF的速度瓶颈。每个高斯图元包含3D位置（均值）、3D协方差矩阵（控制形状和方向）、不透明度以及颜色（用球谐函数表示以体现视点相关效果）。

渲染时，将每个3D高斯投影到图像平面（形成2D高斯“泼溅”），按深度排序，再使用Alpha混合技术从前到后合成。这是一种可在GPU上实时运行的光栅化过程（帧率超过100 FPS），比NeRF的光线追踪快数个数量级。高斯泼溅在质量上可与NeRF媲美甚至超越，同时还能实现实时渲染。

- **SLAM**（同步定位与地图构建）是指在构建未知环境地图的同时，实时追踪相机在其中的位置。它在机器人、自动驾驶以及增强现实领域至关重要。

- **视觉里程计**通过追踪图像间的特征来估计相机的运动。特征点（如SIFT、ORB，见文件01）会在连续帧之间匹配，再利用这些对应关系通过**本质矩阵**估算相机的旋转和平移（本质矩阵编码了两视图间的几何关系，其参数源自文件01中的内参和外参）。
- **基于特征的SLAM**通过维护一个持久地图来扩展视觉里程计。**ORB-SLAM**（Mur-Artal等人，2015年）是最常用的基于特征的SLAM系统。它包含三个并行线程：

1. **跟踪**：将每一帧中的ORB特征与地图进行匹配，利用PnP（透视-点）和RANSAC算法估计相机姿态。
2. **局部建图**：从匹配的特征中三角测量出新的地图点，并通过束调整优化这些点的位置（最小化所有能看到该点的视图中的重投影误差）。
3. **闭环检测**：当相机重新访问已测绘区域时（利用词袋模型），通过全局优化地图来修正累积的漂移。

- **激光雷达SLAM**使用来自激光雷达传感器的3D点云，替代或补充相机图像。激光雷达能提供直接的深度测量数据，使几何估计更加可靠，但硬件成本也更高。像LOAM（激光雷达里程计与建图）这类方法，利用迭代最近点（ICP）对齐算法来配准连续扫描之间的点云。

- **视觉-惯性SLAM**将相机数据与惯性测量单元（IMU，包括加速度计和陀螺仪）的测量结果融合。IMU能提供高频率的旋转与加速度数据，从而填补相机帧之间的间隙，并应对快速运动或临时视觉特征丢失的情况。

- **虚拟现实/增强现实**应用对计算机视觉技术的要求最为苛刻。

- **姿态估计**是从图像中确定人体（或面部、手部）的位置与朝向。**人体姿态**通常表示为一组2D或3D关键点位置（关节：肩膀、肘部、手腕、髋部、膝盖、脚踝）。像**OpenPose**和**MediaPipe**这样的模型通过热图回归来预测这些关键点：对于每个关节，模型会输出一张热图，其中的峰值即代表该关节的位置。

- **自上而下的方法**先使用边界框检测器识别出人物（参见文件03），再在每个框内估计姿态。**自下而上的方法**则先检测图像中的所有关键点，再利用部件亲和场（用于描述相连关节之间关联的矢量场）将它们分组为个体。

- **场景重建**是根据传感器数据构建环境的3D模型。在增强现实中，这能够实现将虚拟物体放置在真实表面上、让虚拟物体被真实物体遮挡，以及投射虚拟阴影。实时场景重建方法（如ARKit和ARCore中基于深度传感器的系统）会构建一个稀疏网格模型，并随着用户的移动不断更新。

- 虚拟现实中的实时渲染要求极为严格：两只眼睛需要分别以90帧/秒以上的速率独立渲染（以避免晕动症），且从头部移动到画面更新的延迟需低于20毫秒。为了满足这些要求，**注视点渲染**（仅对用户注视的区域进行高分辨率渲染，借助眼动追踪技术）和**重投影**（根据新的头部姿态对前一帧进行扭曲以填补下一帧渲染期间的空白）等技术至关重要。

- 实时神经渲染（3D高斯泼溅）、稳健的跟踪技术（视觉-惯性SLAM）以及高效的姿态估计技术的融合，正使得逼真的交互式虚拟现实/增强现实体验越来越易于实现。

## 编程任务（请使用CoLab或笔记本）

1. 从零开始实现Lucas-Kanade光流算法。计算一个正方形向右移动时，两帧合成图像之间的光流。

```python
import jax.numpy as jnp
import matplotlib.pyplot as plt

def lucas_kanade(frame1, frame2, window_size=5):
    """Lucas-Kanade optical flow."""
    # Compute gradients
    Ix = jnp.zeros_like(frame1)
    Iy = jnp.zeros_like(frame1)
    It = frame2 - frame1

    # Sobel-like gradients
    Ix = Ix.at[1:-1, :].set((frame1[2:, :] - frame1[:-2, :]) / 2)
    Iy = Iy.at[:, 1:-1].set((frame1[:, 2:] - frame1[:, :-2]) / 2)

    H, W = frame1.shape
    half_w = window_size // 2
    u = jnp.zeros_like(frame1)
    v = jnp.zeros_like(frame1)

    for i in range(half_w, H - half_w):
        for j in range(half_w, W - half_w):
            Ix_win = Ix[i-half_w:i+half_w+1, j-half_w:j+half_w+1].ravel()
            Iy_win = Iy[i-half_w:i+half_w+1, j-half_w:j+half_w+1].ravel()
            It_win = It[i-half_w:i+half_w+1, j-half_w:j+half_w+1].ravel()

            A = jnp.stack([Ix_win, Iy_win], axis=1)
            ATA = A.T @ A
            ATb = -A.T @ It_win

            # Check if the system is well-conditioned
            det = ATA[0,0] * ATA[1,1] - ATA[0,1] * ATA[1,0]
            if jnp.abs(det) > 1e-6:
                flow = jnp.linalg.solve(ATA, ATb)
                u = u.at[i, j].set(flow[0])
                v = v.at[i, j].set(flow[1])

    return u, v

# Create two frames: a white square that moves right
frame1 = jnp.zeros((64, 64))
frame1 = frame1.at[20:40, 15:35].set(1.0)

frame2 = jnp.zeros((64, 64))
frame2 = frame2.at[20:40, 20:40].set(1.0)  # shifted 5 pixels right

u, v = lucas_kanade(frame1, frame2, window_size=7)

# Visualise
fig, axes = plt.subplots(1, 3, figsize=(14, 4))
axes[0].imshow(frame1, cmap='gray'); axes[0].set_title('Frame 1'); axes[0].axis('off')
axes[1].imshow(frame2, cmap='gray'); axes[1].set_title('Frame 2'); axes[1].axis('off')

# Quiver plot of flow (subsample for clarity)
step = 4
Y, X = jnp.mgrid[0:64:step, 0:64:step]
axes[2].imshow(frame1, cmap='gray', alpha=0.5)
axes[2].quiver(X, Y, u[::step, ::step], v[::step, ::step],
               color='#e74c3c', scale=50, width=0.005)
axes[2].set_title('Optical Flow'); axes[2].axis('off')

plt.tight_layout(); plt.show()

# Check average flow in the moving region
region_u = u[20:40, 15:35]
print(f"Average horizontal flow in object region: {region_u[region_u != 0].mean():.2f} pixels")
```

1. 实现一个用于2D物体跟踪的简单卡尔曼滤波器。模拟一条带噪声的轨迹，展示卡尔曼滤波器如何平滑估计结果。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def kalman_predict(x, P, F, Q):
    """Kalman filter prediction step."""
    x_pred = F @ x
    P_pred = F @ P @ F.T + Q
    return x_pred, P_pred

def kalman_update(x_pred, P_pred, z, H, R):
    """Kalman filter update step."""
    y = z - H @ x_pred                        # innovation
    S = H @ P_pred @ H.T + R                  # innovation covariance
    K = P_pred @ H.T @ jnp.linalg.inv(S)      # Kalman gain
    x_updated = x_pred + K @ y
    P_updated = (jnp.eye(len(x_pred)) - K @ H) @ P_pred
    return x_updated, P_updated

# State: [x, y, vx, vy]
dt = 1.0
F = jnp.array([[1, 0, dt, 0],    # state transition
                [0, 1, 0, dt],
                [0, 0, 1, 0],
                [0, 0, 0, 1]])
H = jnp.array([[1, 0, 0, 0],     # observation: we measure x, y
                [0, 1, 0, 0]])
Q = jnp.eye(4) * 0.01            # process noise
R = jnp.eye(2) * 4.0             # measurement noise (noisy detector)

# Simulate ground truth: circular motion
n_steps = 50
t = jnp.linspace(0, 2 * jnp.pi, n_steps)
true_x = 10 * jnp.cos(t) + 20
true_y = 10 * jnp.sin(t) + 20

# Noisy observations
key = jax.random.PRNGKey(42)
noise = jax.random.normal(key, (n_steps, 2)) * 2.0
obs_x = true_x + noise[:, 0]
obs_y = true_y + noise[:, 1]

# Run Kalman filter
x = jnp.array([obs_x[0], obs_y[0], 0.0, 0.0])  # initial state
P = jnp.eye(4) * 10.0                             # initial uncertainty

kalman_x, kalman_y = [], []
for i in range(n_steps):
    x, P = kalman_predict(x, P, F, Q)
    z = jnp.array([obs_x[i], obs_y[i]])
    x, P = kalman_update(x, P, z, H, R)
    kalman_x.append(x[0])
    kalman_y.append(x[1])

kalman_x = jnp.array(kalman_x)
kalman_y = jnp.array(kalman_y)

# Visualise
plt.figure(figsize=(8, 8))
plt.plot(true_x, true_y, 'k-', linewidth=2, label='Ground Truth')
plt.scatter(obs_x, obs_y, c='#e74c3c', s=20, alpha=0.5, label='Noisy Observations')
plt.plot(kalman_x, kalman_y, '#3498db', linewidth=2, label='Kalman Filter')
plt.legend(); plt.grid(alpha=0.3)
plt.title('Kalman Filter Tracking')
plt.xlabel('x'); plt.ylabel('y')
plt.axis('equal'); plt.show()

obs_error = jnp.mean(jnp.sqrt((obs_x - true_x)**2 + (obs_y - true_y)**2))
kalman_error = jnp.mean(jnp.sqrt((kalman_x - true_x)**2 + (kalman_y - true_y)**2))
print(f"Observation RMSE: {obs_error:.2f}")
print(f"Kalman filter RMSE: {kalman_error:.2f}")
print(f"Error reduction: {(1 - kalman_error/obs_error) * 100:.1f}%")
```

1. 实现一个简化的NeRF风格体渲染流程。通过简单的3D场景（已知颜色和密度的球体）发射光线，并沿每条光线进行积分以生成图像。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def render_ray(origin, direction, spheres, n_samples=64, t_near=1.0, t_far=6.0):
    """Volume render a single ray through a scene of spheres."""
    t_vals = jnp.linspace(t_near, t_far, n_samples)
    deltas = jnp.concatenate([jnp.diff(t_vals), jnp.array([1e-3])])

    colour = jnp.zeros(3)
    transmittance = 1.0

    for i in range(n_samples):
        point = origin + t_vals[i] * direction

        # Compute density and colour at this point
        density = 0.0
        point_colour = jnp.zeros(3)

        for center, radius, col, sigma in spheres:
            dist = jnp.linalg.norm(point - center)
            # Soft sphere: density falls off with distance from surface
            d = jnp.exp(-jnp.maximum(0, dist - radius) * sigma) * sigma
            density += d
            point_colour += d * jnp.array(col)

        # Normalise colour by total density
        point_colour = jnp.where(density > 1e-6, point_colour / density, point_colour)

        # Volume rendering equation
        alpha = 1.0 - jnp.exp(-density * deltas[i])
        colour += transmittance * alpha * point_colour
        transmittance *= (1.0 - alpha)

    return colour

# Scene: three coloured spheres
spheres = [
    (jnp.array([0.0, 0.0, 4.0]), 0.8, [1.0, 0.2, 0.2], 5.0),   # red
    (jnp.array([1.5, 0.5, 5.0]), 0.6, [0.2, 1.0, 0.2], 5.0),   # green
    (jnp.array([-1.0, -0.5, 3.5]), 0.5, [0.2, 0.2, 1.0], 5.0), # blue
]

# Camera setup
img_h, img_w = 64, 64
focal = 60.0
origin = jnp.array([0.0, 0.0, 0.0])

image = jnp.zeros((img_h, img_w, 3))
for i in range(img_h):
    for j in range(img_w):
        # Compute ray direction
        px = (j - img_w / 2) / focal
        py = -(i - img_h / 2) / focal
        direction = jnp.array([px, py, 1.0])
        direction = direction / jnp.linalg.norm(direction)

        colour = render_ray(origin, direction, spheres)
        image = image.at[i, j].set(jnp.clip(colour, 0, 1))

plt.figure(figsize=(6, 6))
plt.imshow(image)
plt.title('NeRF-style Volume Rendering\n(3 spheres)')
plt.axis('off')
plt.tight_layout(); plt.show()
print(f"Image shape: {image.shape}")
print(f"Rendered {img_h * img_w} rays with 64 samples each")
```
