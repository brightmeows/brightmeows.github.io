---
title: "SIMD 与 GPU 编程"
date: "2026-11-05"
order: 16
slug: "compendium/16-simd-and-gpu-programming"
description: "本书中出现的每一个`jnp.matmul`、每一个`torch.nn.Linear`、每一个`np.dot`调用，其实都是在执行底层的C++和CUDA代码。本文件将揭示其中的奥秘：为何机器学习框架要如此设计、Python工程师需要掌握哪些C"
tags: []
---

## 为何选择C++以及机器学习框架的运作原理

_本书中出现的每一个`jnp.matmul`、每一个`torch.nn.Linear`、每一个`np.dot`调用，其实都是在执行底层的C++和CUDA代码。本文件将揭示其中的奥秘：为何机器学习框架要如此设计、Python工程师需要掌握哪些C++基础知识、何时需要编写自定义的C++内核，以及如何将这些内核与Python结合起来——它们就是你编写的代码与运行它的硬件之间的桥梁。_

- 你已经花了15章的时间来学习Python：导入JAX库、使用`jax.grad`函数、运行训练循环、构建模型。这一切看起来都像是用Python完成的。但事实是：**实际上几乎没有计算是在Python中完成的。**

- 当你在PyTorch中使用`output = model(input)`，或在JAX中使用`output = jnp.matmul(W, x)`时，Python几乎不做什么工作。它只是生成一个计算描述（即操作图），然后将其交给C++/CUDA后端来执行实际的计算任务。Python相当于方向盘，而C++则是引擎。

## 为何采用Python作为前端，C++作为后端

- 采用这种双语言架构，是因为Python和C++在处理不同类型的任务时各有优势：

|              | Python                                                             | C++                                                          |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 开发速度     | 快（动态类型、REPL界面、无需编译）                                 | 慢（静态类型、需要处理头文件、有编译时间）                   |
| 执行速度     | 约为C语言的100倍慢（解释型语言，存在GIL限制）                      | 接近硬件运行速度（编译型语言，无额外开销）                   |
| 内存管理     | 自动处理（由垃圾回收机制负责），无法精确控制内存布局               | 需要手动管理，可对每一字节进行精确控制                       |
| 硬件访问能力 | 无（不支持SIMD指令、GPU或自定义内存）                              | 完全支持（可通过内置函数、CUDA及内联汇编来操作硬件）         |
| 生态系统     | 在机器学习领域非常完善（提供笔记本工具、可视化功能及数据处理工具） | 在系统级开发领域十分强大（涉及操作系统、驱动程序及各种引擎） |

- 关键在于：**让每种语言发挥其优势**。Python负责那些需要提高人类工作效率的部分（如实验设计、超参数调整、数据探索等）；而C++则负责那些对性能要求较高的部分（如矩阵乘法、卷积运算、注意力机制等）。

- 对于一个$4096 \times 4096$大小的矩阵乘法操作`jnp.matmul(A, B)`，需要执行约1370亿次浮点运算。在纯Python环境中（使用嵌套循环实现），完成该操作大约需要30分钟；而在使用了AVX-512 SIMD指令及多线程技术的优化版C++中，所需时间仅为约10毫秒。这相当于**180,000倍**的速度差异。再怎么巧妙的Python编程技巧也无法缩小这一差距。

## 机器学习框架的结构

- 所有的主流机器学习框架都遵循相同的架构：

```text
User code (Python)
    ↓
Python API layer (torch.nn, jax.numpy, numpy)
    ↓
Dispatch / JIT compiler (torch.compile, XLA, NumPy dispatch)
    ↓
C++ kernel library (ATen/PyTorch, XLA, BLAS/LAPACK)
    ↓
Hardware-specific backends (CUDA, cuDNN, MKL, oneDNN, Metal)
    ↓
Hardware (CPU SIMD units, GPU cores, TPU MXUs)
```

### NumPy

- NumPy的核心部分是用C语言编写的。当调用`np.dot(A, B)`时，Python会调用一个C语言函数，该函数又会调用BLAS（基本线性代数子程序库），通常是Intel MKL或OpenBLAS。BLAS是由C和Fortran语言编写的、经过精心优化的代码，它利用了SIMD指令、基于缓存的内存访问方式以及多线程技术。经过数十年的优化，BLAS使得矩阵乘法运算速度大幅提升。

- NumPy仅能在CPU上运行，不支持GPU。不过在CPU上它的运行速度极快，因为它能够利用最优的BLAS实现方案。

### PyTorch

- PyTorch的计算引擎是**ATen**（张量库），它也是用C++编写的。ATen实现了大约2000种张量操作（如加法、矩阵乘法、卷积、softmax等），每种操作都有针对CPU和CUDA的实现版本。

- 当调用`torch.matmul(A, B)`时：

1. Python会将任务交给ATen的C++函数来处理。
2. ATen会判断运算是在CPU上还是CUDA上执行，以及数据的类型。
3. 在CPU上，它会调用MKL/OpenBLAS；在GPU上，则会调用cuBLAS（NVIDIA为GPU优化的BLAS库）。
4. 最终的结果会被封装成一个Python张量对象并返回。

- **torch.compile**（PyTorch 2.0及以上版本提供）进一步提升了性能：它会分析你的Python代码，构建计算图，然后使用**Triton**（用于GPU）或**C++/OpenMP**（用于CPU）来编译这段代码。经过编译后的代码可以合并各种运算操作，消除Python层面的开销，其运行速度可比普通模式快2到5倍。

### JAX

- JAX会将Python函数编译成**XLA**（加速型线性代数库），这是谷歌专为机器学习任务设计的编译器。当你使用`jax.jit`对某个函数进行编译时：

1. JAX会分析该函数，将其操作以XLA计算图的形式记录下来（即HLO——高级操作）。
2. XLA会对这个计算图进行优化：合并操作、消除冗余计算、优化内存布局。
3. 接着，XLA会将优化后的代码编译成适合目标平台的格式：在CPU上通过LLVM编译，在GPU上通过CUDA/PTX编译，在TPU上则通过TPU专用指令编译。
4. 编译后的代码可以直接在硬件上运行，无需任何Python代码的参与。

- 这也就是为什么`jax.jit`如此重要的原因：没有它的话，每个操作都需要经历一次Python到C++的转换过程；而有了它之后，整个函数就可以被编译成一个独立的代码内核。

## 面向Python工程师的C++基础知识

- 你不必成为C++专家，只需具备足够的知识来阅读内核代码、编写简单的扩展程序，以及理解与性能相关的问题即可。以下是所需掌握的基本内容。

### 类型与变量

```cpp
// C++ requires explicit types (unlike Python)
int count = 0;           // 32-bit integer
float loss = 0.5f;       // 32-bit float
double lr = 3e-4;        // 64-bit float
bool training = true;    // boolean

// Arrays (fixed size, stack-allocated)
float weights[1024];     // 1024 floats, contiguous in memory

// Pointers: a variable that holds a memory address
float* ptr = weights;    // ptr points to the first element of weights
float val = ptr[42];     // access element 42 via pointer arithmetic
// ptr[42] is equivalent to *(ptr + 42)
```

- **指针**是C++与Python在概念上的最大差异。在Python中，一切都是引用形式，无需考虑内存地址；而在C++中，指针可以让程序直接访问内存——这虽然功能强大，但也存在风险（如悬空指针、缓冲区溢出等问题）。

### 函数

```cpp
// Function declaration: return_type name(param_type param_name)
float relu(float x) {
    return x > 0.0f ? x : 0.0f;
}

// Passing by reference (avoids copying large objects)
void scale_vector(std::vector<float>& vec, float factor) {
    for (size_t i = 0; i < vec.size(); i++) {
        vec[i] *= factor;
    }
}

// const reference: read-only, no copy
float sum(const std::vector<float>& vec) {
    float total = 0.0f;
    for (float x : vec) {  // range-based for loop (like Python's for x in vec)
        total += x;
    }
    return total;
}
```

### 内存：栈与堆

```cpp
// Stack allocation: fast, automatic lifetime (freed when function returns)
float buffer[256];   // 256 floats on the stack

// Heap allocation: manual, survives beyond the function
float* data = new float[n];   // allocate n floats on the heap
// ... use data ...
delete[] data;                 // YOU must free it (no garbage collector)

// Modern C++: smart pointers (automatic cleanup, like Python references)
#include <memory>
auto data = std::make_unique<float[]>(n);  // freed automatically when out of scope
```

- **核心规则**：栈操作速度很快，但容量有限（通常为1-8 MB）。大型数组（张量、特征图）必须存储在堆上。在Python中，所有数据都存储在堆上，由垃圾回收机制负责清理。而在C++中，则需要手动管理内存（或使用智能指针）。

### 模板（泛型）

```cpp
// A function that works with any numeric type
template <typename T>
T add(T a, T b) {
    return a + b;
}

add<float>(1.5f, 2.5f);   // returns 4.0f
add<int>(3, 4);             // returns 7
```

- 模板是C++库（如ATen）用来编写能够处理float16、float32、float64等数据类型的代码的工具，这样就不必重复实现相同的逻辑了。

### 标准库的基础知识

```cpp
#include <vector>      // dynamic array (like Python list)
#include <string>      // string type
#include <unordered_map>  // hash map (like Python dict)
#include <algorithm>   // sort, find, transform, etc.
#include <cmath>       // math functions

std::vector<float> vec = {1.0f, 2.0f, 3.0f};
vec.push_back(4.0f);            // append
float first = vec[0];           // index
size_t len = vec.size();        // length

std::unordered_map<std::string, int> counts;
counts["hello"] = 5;            // insert
if (counts.count("hello")) { }  // check existence
```

## 何时需要编写自定义C++内核

- 大多数机器学习工程师其实无需编写C++代码。框架内置的操作已经能够满足99%的使用场景。只有在以下情况下才考虑使用自定义C++代码：

1. **框架中不存在相应的操作**：比如某种新的激活函数、自定义的注意力机制，或是无法通过现有操作组合来实现的特殊损失函数。

1. **为提升性能而合并操作**：如果模型的计算流程为`relu(layernorm(matmul(x, W) + b))`，那么每个操作都会启动一个独立的内核，涉及内存的读写和同步操作。而使用自定义内核则可以在一次运算中完成所有步骤，从而避免内存往返操作，这样处理速度可以提高2到5倍。

1. **降低内存占用**：自定义内核可以在不存储所有中间结果的情况下计算梯度（即在内核层面实现梯度检查点技术）。

1. **针对新型硬件进行开发**：某些新的加速器（如Cerebras、Groq）可能还不支持相关框架，此时就需要直接编写内核代码。

- 对于情况1和2，使用**Triton**（第16章，文件05）通常就足够了，而且比直接编写CUDA C代码要简单得多。只有当Triton无法实现所需功能时，才需要转而使用CUDA C代码。

## 如何将C++与Python结合使用

- 编写C++代码只是其中一半的工作，还需要知道如何从Python中调用这些C++函数。

### pybind11（通用解决方案）

- pybind11可以以最简化的方式为C++函数创建Python接口：

```cpp
// my_ops.cpp
#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
namespace py = pybind11;

// A simple custom operation
py::array_t<float> custom_relu(py::array_t<float> input) {
    auto buf = input.request();
    float* ptr = static_cast<float*>(buf.ptr);
    size_t n = buf.size;

    auto result = py::array_t<float>(n);
    float* out = static_cast<float*>(result.request().ptr);

    for (size_t i = 0; i < n; i++) {
        out[i] = ptr[i] > 0 ? ptr[i] : 0;
    }
    return result;
}

PYBIND11_MODULE(my_ops, m) {
    m.def("custom_relu", &custom_relu, "Custom ReLU operation");
}
```

```bash
# Compile
pip install pybind11
c++ -O3 -shared -std=c++17 -fPIC $(python3 -m pybind11 --includes) my_ops.cpp -o my_ops$(python3-config --extension-suffix)
```

```python
# Use from Python
import my_ops
import numpy as np

x = np.array([-1.0, 2.0, -3.0, 4.0], dtype=np.float32)
y = my_ops.custom_relu(x)
print(y)  # [0. 2. 0. 4.]
```

### PyTorch的C++扩展功能

- PyTorch提供了一种简便的方式，用于添加自定义操作：

```cpp
// custom_op.cpp
#include <torch/extension.h>

torch::Tensor custom_gelu(torch::Tensor x) {
    return x * 0.5 * (1.0 + torch::erf(x / std::sqrt(2.0)));
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("custom_gelu", &custom_gelu, "Custom GELU activation");
}
```

```python
# Load and compile on-the-fly
from torch.utils.cpp_extension import load

custom_ops = load(
    name="custom_ops",
    sources=["custom_op.cpp"],
    extra_cflags=["-O3"],
)

x = torch.randn(1000)
y = custom_ops.custom_gelu(x)
```

- `torch.utils.cpp_extension.load` 可以一次性完成C++代码的编译、共享库的生成，以及将其作为Python模块加载的工作。这是在PyTorch中测试自定义C++运算符的最简单方法。

### JAX中的自定义函数调用

- JAX使用XLA来实现自定义函数调用。虽然实现过程更为复杂（需要将C函数注册到XLA中），但原理是一样的：先编写C/C++代码，再将其与Python绑定，最后从Python中调用该函数。

- 对于大多数JAX用户来说，**Pallas**（详见文件05）是更好的选择：它允许人们用类似Python的语法来编写GPU内核，随后由XLA进行编译，而且无需离开JAX生态系统。

## 整体概览

- 本文件介绍了Python与硬件之间的接口。本章其余文件则会更深入地探讨相关内容：
- **文件01**：硬件本身（CPU架构、GPU架构、内存系统）
- **文件02-03**：CPU上的SIMD编程（ARM NEON、x86 AVX）——即编写利用CPU向量处理单元的C++代码
- **文件04**：使用CUDA进行GPU编程——即编写能在数千个GPU核心上运行的C++代码
- **文件05**：Triton、Pallas以及更高层次的GPU编程——即编写可被编译为GPU内核的Python代码

- 这种发展路径反映了抽象程度的递增：C++内置函数（最低层次，最具控制力）→ CUDA（针对GPU的编程方式）→ Triton/Pallas（基于Python语法且经过编译的编程方式）→ JAX/PyTorch（最高层次，自动处理一切）。每上升一个层次，就需要牺牲一定的控制力以换取便利性。了解较低层次的编程方式，有助于更好地使用更高层次的编程工具。

## 编程任务（使用g++或clang++进行编译）

1. 编写你的第一个C++程序。首先分配一个数组，为其填充数据，计算其总和，同时记录执行时间。通过这个练习，可以了解编译过程、数组、指针以及时间测量等相关概念。

```cpp
// task1_basics.cpp
// Compile: g++ -O3 -o task1 task1_basics.cpp
// Run: ./task1

#include <iostream>
#include <chrono>
#include <vector>

int main() {
    const int N = 10'000'000;  // C++ allows ' as digit separator
    std::vector<float> data(N);

    // Fill the array
    for (int i = 0; i < N; i++) {
        data[i] = static_cast<float>(i) * 0.001f;
    }

    // Compute sum
    auto start = std::chrono::high_resolution_clock::now();
    float sum = 0.0f;
    for (int i = 0; i < N; i++) {
        sum += data[i];
    }
    auto end = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "Sum: " << sum << std::endl;
    std::cout << "Time: " << elapsed << " ms" << std::endl;
    std::cout << "Elements: " << N << std::endl;
    std::cout << "Throughput: " << (N * sizeof(float)) / elapsed / 1e6 << " GB/s" << std::endl;

    return 0;
}
```

1. 编写一个C++函数，用于对数组应用ReLU运算；然后使用pybind11创建相应的Python绑定接口。从Python中调用该函数，并与NumPy的实现进行速度对比。

```cpp
// task2_relu.cpp
// Compile: c++ -O3 -shared -std=c++17 -fPIC $(python3 -m pybind11 --includes) \
//          task2_relu.cpp -o my_relu$(python3-config --extension-suffix)

#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
namespace py = pybind11;

py::array_t<float> cpp_relu(py::array_t<float> input) {
    auto buf = input.request();
    float* ptr = static_cast<float*>(buf.ptr);
    int n = buf.size;

    auto result = py::array_t<float>(n);
    float* out = static_cast<float*>(result.request().ptr);

    for (int i = 0; i < n; i++) {
        out[i] = ptr[i] > 0.0f ? ptr[i] : 0.0f;
    }
    return result;
}

PYBIND11_MODULE(my_relu, m) {
    m.def("relu", &cpp_relu, "C++ ReLU");
}
```

```python
# test_relu.py — run after compiling the C++ module above
import numpy as np
import time
import my_relu  # the compiled C++ module

x = np.random.randn(10_000_000).astype(np.float32)

# C++ ReLU
start = time.time()
for _ in range(100):
    y_cpp = my_relu.relu(x)
cpp_time = (time.time() - start) / 100

# NumPy ReLU
start = time.time()
for _ in range(100):
    y_np = np.maximum(x, 0)
np_time = (time.time() - start) / 100

print(f"C++ ReLU:   {cpp_time*1000:.2f} ms")
print(f"NumPy ReLU: {np_time*1000:.2f} ms")
print(f"Match: {np.allclose(y_cpp, y_np)}")
```

1. 编写一个C++程序，用以说明内存布局为何重要。比较行优先与列优先的访问方式，并测量两者之间的性能差异。

```cpp
// task3_layout.cpp
// Compile: g++ -O3 -o task3 task3_layout.cpp

#include <iostream>
#include <chrono>
#include <vector>

int main() {
    const int N = 4096;
    std::vector<float> matrix(N * N, 1.0f);

    // Row-major access: sequential memory addresses (cache-friendly)
    auto start = std::chrono::high_resolution_clock::now();
    float sum_row = 0.0f;
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            sum_row += matrix[i * N + j];  // stride-1 access
        }
    }
    auto end = std::chrono::high_resolution_clock::now();
    double row_ms = std::chrono::duration<double, std::milli>(end - start).count();

    // Column-major access: stride-N access (cache-unfriendly)
    start = std::chrono::high_resolution_clock::now();
    float sum_col = 0.0f;
    for (int j = 0; j < N; j++) {
        for (int i = 0; i < N; i++) {
            sum_col += matrix[i * N + j];  // stride-N access (cache misses!)
        }
    }
    end = std::chrono::high_resolution_clock::now();
    double col_ms = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "Row-major (cache-friendly): " << row_ms << " ms" << std::endl;
    std::cout << "Col-major (cache-hostile):  " << col_ms << " ms" << std::endl;
    std::cout << "Slowdown: " << col_ms / row_ms << "x" << std::endl;
    std::cout << "(Both sums: " << sum_row << ", " << sum_col << ")" << std::endl;

    return 0;
}
```

## 硬件基础

_在编写SIMD或GPU代码之前，你需要先了解所编程的硬件。本文件将阐述为何并行性取代了时钟频率、现代CPU是如何执行指令的、什么是SIMD、用于分析性能的Roofline模型，以及芯片架构的现状_ <!-- markdownlint-disable-line MD036 -->

- 数十年来，软件的性能提升无需付出任何成本：只需购买一款时钟频率更高的新CPU，程序的速度就会提升，而无需修改任何代码。但这一时代在2005年左右结束了。对于那些希望编写高效代码的人来说，理解这一变化的原因以及其替代方案至关重要。

## 免费提升性能时代的终结

- **摩尔定律**（1965年）指出，芯片上的晶体管数量大约每两年翻一番。这一规律持续了60年。更多的晶体管意味着更小的晶体管尺寸，进而带来更高的时钟频率，从而使程序运行得更快。

- 但到了2005年左右，时钟频率已经达到了约4 GHz的极限。问题出在**功耗**上。芯片的功耗大致遵循以下公式：

$$P \propto C \cdot V^2 \cdot f$$

- 其中，$C$为电容值（与晶体管数量成正比），$V$为电压，$f$为时钟频率。若要提高频率，就必须提高电压（以便更快地切换晶体管）。但由于功耗与$V^2 \cdot f$成正比，因此频率的轻微提升就会导致功耗和热量大幅上升。在4 GHz时，芯片的功耗已经超过100瓦特；若要达到8 GHz，则需要极为复杂的冷却系统。

- 解决方案是：不再追求单个核心的更高速度，而是在同一芯片上配备**多个核心**。一个4核、3 GHz的芯片，其功耗与一个4.5 GHz的单核芯片相当，但却能完成4倍量的并行任务。这就是为什么所有现代CPU都拥有多个核心，也是为什么并行处理技术（如SIMD、多线程、GPU计算）才是提升性能的唯一途径。

- **对机器学习的影响**：如果在单个核心上执行某项操作需要10分钟，那么仅通过购买更快的CPU是无法加快其速度的。只有通过使用更多核心（数据并行处理，见第6章）、更宽的SIMD单元（见本章）或GPU（拥有数千个核心），才能提升速度。

## 现代CPU如何执行指令

- 现代CPU核心的复杂度远远高于第13章中介绍的简单取指-解码-执行模型。它通过多种技巧来实现在每个周期内执行更多指令：

- **超标量执行**：CPU拥有多个执行单元（算术逻辑单元、浮点运算单元、加载/存储单元），因此可以同时执行多个独立的指令。如果这些指令之间不存在依赖关系，那么一个现代CPU核心每个周期可执行4到6条指令。

- **乱序执行**：CPU不会按照程序的顺序来执行指令。它会提前查看指令流，找出那些输入条件已经满足的指令，并立即执行它们，而不管它们在指令流中的位置如何。这样就能隐藏延迟：当一条指令正在等待来自内存的数据时（可能需要100多个周期），CPU可以继续执行其他已经准备就绪的指令。

- **分支预测**：条件分支（如`if`语句、循环条件）会带来不确定性——在条件得到评估之前，CPU并不知道应该选择哪条路径。为了避免停滞，CPU会**预测**结果并尝试沿着预测的路径执行指令。如果预测正确（现代预测器的准确率超过95%），则不会浪费时间；如果预测错误，那么那些尝试性的执行结果会被丢弃，然后再执行正确的路径（这会导致大约15个周期的延迟）。

- **推测性执行**：这是分支预测的一种扩展。CPU会执行那些可能并不需要的指令，期望它们最终会被用到。这样做可以填满执行管线，让各个执行单元始终处于忙碌状态。

- 所有这些操作都是自动完成的——CPU会在没有程序员干预的情况下执行它们。不过，它们只能帮助实现**指令级并行性**，即单个指令流中各独立指令之间的并行处理。而对于**数据级并行性**（即对多个数据元素进行相同操作），则需要使用SIMD技术。

## SIMD：单指令，多数据

- **SIMD**的核心思想就是让一条指令同时作用于多个数据元素。与其分别对两个数字进行加法运算，不如用一条指令同时对4个（或8个、16个）数字组成的向量进行加法运算。

- 在没有SIMD技术的情况下（即标量处理方式）：

```cpp
// Add two arrays element by element: 4 add instructions
for (int i = 0; i < 4; i++) {
    c[i] = a[i] + b[i];  // one add per iteration
}
```

- 使用SIMD（向量化处理）：

```cpp
// Add two arrays: 1 SIMD instruction does all 4 adds
#include <immintrin.h>  // x86 SIMD intrinsics

__m128 va = _mm_load_ps(a);    // load 4 floats into a 128-bit register
__m128 vb = _mm_load_ps(b);    // load 4 floats into another register
__m128 vc = _mm_add_ps(va, vb); // add all 4 pairs simultaneously
_mm_store_ps(c, vc);            // store 4 results
```

- SIMD版本仅需1/4的指令即可完成相同的工作。从理论上讲，其处理速度可提升4倍，因为每条指令可以处理4个浮点数，而非1个。

### 向量寄存器

- SIMD指令在**向量寄存器**上运行：这类寄存器容量较大，能够存储多个数据元素。

| 寄存器宽度 | 32位浮点数 | 64位双精度数 | 名称 |
| ------------ || ------------ || -------------- || ------ ||
| 128位 | 4个 | 2个 | SSE（x86）、NEON（ARM） |
| 256位 | 8个 | 4个 | AVX/AVX2（x86） |
| 512位 | 16个 | 8个 | AVX-512（x86） |
| 可变（128–2048位） | 不固定 | 不固定 | SVE/SVE2（ARM） |

- 寄存器宽度越大，并行处理能力越强。512位的AVX-512指令可同时处理16个浮点数，因此其理论处理速度是标量代码的16倍。但实际上，由于内存带宽的限制，实际加速效果会更低（因为数据传输速度可能跟不上计算速度）。

- 对于机器学习而言，对float32类型数据进行矩阵乘法运算时，SIMD技术能带来巨大优势。其中的循环操作（两个向量的点积运算）可以直接通过SIMD的乘累加指令来完成。这也是为什么NumPy和PyTorch所依赖的BLAS库会被大量优化以利用SIMD技术。

## 屋顶线模型

- 如何判断自己的代码是否足够快？**屋顶线模型**通过两种硬件限制来描述性能表现：

1. **峰值计算能力**（FLOPS）：即每秒可执行的最大浮点运算次数。例如，一款4 GHz频率、采用256位AVX指令集（每条指令可处理8个浮点数）、拥有2个FMA单元的CPU，其FLOPS值为：$4 \times 10^9 \times 8 \times 2 = 64$ GFLOPS。

1. **峰值内存带宽**（字节/秒）：指数据从内存传输到CPU的速度。现代CPU的内存带宽可能在50 GB/s左右。

- 代码的**算术强度**是指计算操作与内存访问操作之间的比例：

$$\text{算术强度} = \frac{\text{FLOPS}}{\text{传输的字节数}}$$

- 如果算术强度较低（每加载一个字节就需要执行很少的操作），则说明代码存在**内存瓶颈**：它大部分时间都在等待数据。此时，提高计算速度（如使用更宽的SIMD指令集或更高的时钟频率）并无帮助。

- 如果算术强度较高（每加载一个字节就需要执行很多操作），则说明代码存在**计算瓶颈**：它大部分时间都在进行计算。此时，更快的内存也无法带来提升。

- 根据屋顶线模型，可实现的FLOPS值为：

$$\text{可实现FLOPS} = \min\left(\text{峰值FLOPS}, \; \text{内存带宽} \times \text{算术强度}\right)$$

- **矩阵乘法**的算术强度很高：在$O(n^2)$规模的数据上需要执行$O(n^3)$次运算，因此其算术强度约为$O(n)$。对于大型矩阵来说，计算瓶颈更为突出。这也是为什么在那些需要大量矩阵运算的机器学习任务中，GPU（具有强大的计算能力）更适用。

- **逐元素运算**（如ReLU、加法、乘法）的算术强度较低：每个加载的元素只需执行1次运算。这类运算存在内存瓶颈。单纯提高GPU的速度并无帮助，需要的是更快的内存，或者将这些运算与计算密集型运算结合在一起，从而避免多次进行内存读写操作。

- 屋顶线模型也解释了为何**内核融合**如此重要：将矩阵乘法、偏置加法和ReLU运算合并为一个内核，就可以避免将中间结果写入内存后再读取回来，这样就能把三个存在内存瓶颈的运算转化为一个计算瓶颈的运算。

## 延迟与吞吐量

- **延迟**是指完成一次运算所需的时间。**吞吐量**则是指单位时间内能够完成的运算次数。

- 举个类比：公交车虽然每次停靠时都需要等待，但它的吞吐量很高——可以一次性运送50人。而出租车虽然不需要等待，但每次只能运送1到4人，因此吞吐量较低。

- GPU就像公交车：每次运算的延迟较高（每条指令需要多个时钟周期才能完成），但吞吐量极大（数千个核心可以同时工作）。而CPU则像出租车：延迟较低（通过乱序执行、分支预测以及高效的缓存机制来减少延迟），但吞吐量有限（通常只有4到64个核心）。

- 正因如此，GPU更适合用于机器学习训练（因为吞吐量很重要，需要处理数百万个样本），而CPU则更适合处理操作系统相关的任务（因为延迟很重要，需要立即响应按键操作）。

- **流水线技术**可以将延迟转化为吞吐量。如果一条指令需要5个时钟周期才能完成，但流水线每周期就会开始处理一条新指令，那么实际上每周期仍可完成1条指令的运算（尽管每条指令本身需要5个周期）。这一原理与第13章中介绍的CPU流水线类似，只不过它适用于各个层面：SIMD单元、内存控制器以及GPU核心都采用了流水线设计。

## 芯片架构概览

- 你编写的代码所针对的硬件决定了可用哪些SIMD指令：

### x86（英特尔、AMD）

- 在台式机、笔记本电脑以及数据中心CPU领域占据主导地位。常用的SIMD指令集包括SSE（128位）、AVX/AVX2（256位）以及AVX-512（512位）。英特尔的AMX指令集则为人工智能应用提供了专用的矩阵乘法单元。

- **优点**：单核性能最高，SIMD指令集最为丰富，软件生态系统也很成熟（如MKL、oneDNN）。
- **缺点**：功耗较高，指令集较为复杂，成本也较高。

### ARM

- 在移动设备领域占据主导地位（所有智能手机都采用ARM架构），同时在服务器领域（如AWS的Graviton处理器、Ampere的Altra处理器）以及笔记本电脑领域（苹果的M系列芯片）也越来越受欢迎。ARM的SIMD指令集包括NEON（128位）以及SVE/SVE2（可扩展，宽度为128至2048位）。

- **优点**：能效极高（单位功率下的性能表现优异），并且拥有定制化的核心架构（苹果的M4芯片在单核性能方面可与英特尔芯片相媲美，但功耗却低得多）。
- **缺点**：SIMD指令集的宽度相对较窄（NEON仅为128位，不过SVE指令集的宽度可以更高），而且用于高性能计算的软件生态系统还不够完善。

### 苹果芯片（M1/M2/M3/M4）

- 基于ARM架构，但还包含一些自定义功能。其中就包括**AMX**（苹果矩阵扩展指令集）——这是一种未被正式文档记录的矩阵乘法单元，Accelerate框架在处理BLAS运算时会使用它。此外，苹果芯片还采用了统一内存架构：CPU和GPU共享同一块物理内存，从而消除了CPU与GPU之间数据传输的瓶颈。

- **对于机器学习而言**：苹果的神经引擎（拥有16个核心，是专用的机器学习加速器）以及统一内存架构，使得M系列芯片在本地机器学习推理以及小规模训练任务中表现出色。不过，这些芯片不支持CUDA，用户必须使用Metal（苹果的GPU接口）或MLX（苹果的机器学习框架）。

### RISC-V

- 开源的指令集架构。无需支付许可费用（与ARM不同）。在嵌入式系统、物联网以及研究领域中得到越来越广泛的应用。SIMD：其“V”（向量）扩展功能能够实现类似ARM SVE的可扩展向量处理能力。

- **在机器学习领域的应用**：目前还无法与x86/ARM在机器学习任务上相媲美，但这一领域仍有发展潜力。一些人工智能加速器初创公司正在使用RISC-V核心。

### GPU（NVIDIA、AMD、Intel）

- 相关内容在文件04-05中有详细阐述。这些GPU拥有数千个专为提高处理效率而设计的简单核心。NVIDIA凭借CUDA技术在机器学习领域占据主导地位；AMD则通过ROCm与其竞争；Intel则推出Arc GPU和Gaudi加速器参与竞争。

### TPU（谷歌）

- 这是一种专为机器学习而设计的定制型ASIC。其结构中的阵列设计旨在提升矩阵运算的性能。相关内容在文件05中有介绍。

## 热量与功耗限制

- 终究，性能会受到功耗和散热条件的限制：

- **TDP**（热设计功率）：芯片能够持续消耗的最大功率。笔记本电脑的CPU其TDP可能为15瓦特，服务器CPU则为250瓦特；数据中心的GPU则可达700瓦特（如NVIDIA B200）。

- **“暗硅”现象**：为了控制在规定的温度范围内，必须随时关闭部分晶体管。理论上，芯片可以同时启用所有晶体管，但实际上那样做会导致芯片过热损坏。

- **能效**（每瓦特浮点运算次数）正逐渐成为衡量性能的关键指标，而非单纯的浮点运算次数。正因如此：
- ARM能在数据中心占据优势（其每瓦特浮点运算次数优于x86）。
- 尽管TPU的峰值浮点运算次数较低，但由于其能效更高，因此仍能在机器学习任务中与GPU竞争。
- 量化技术（如INT8、FP8）不仅能减少内存需求，还能降低每次运算的功耗。

- 对于大规模机器学习应用而言，训练先进的大型语言模型需要数以兆瓦计的电力，且这种耗电状态会持续数月之久。电力成本甚至可能超过硬件成本本身。因此，能效直接影响到人工智能研究的成本效益。

## 实践：用C++测量性能

- 要了解系统的性能表现，就需要对其进行测量。以下是一个最简单的C++性能测试框架：

```cpp
#include <iostream>
#include <chrono>
#include <vector>

// Scalar addition
void add_scalar(const float* a, const float* b, float* c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

int main() {
    const int N = 1 << 24;  // ~16 million elements
    std::vector<float> a(N, 1.0f), b(N, 2.0f), c(N);

    // Warm up (fill caches, trigger frequency scaling)
    add_scalar(a.data(), b.data(), c.data(), N);

    // Benchmark
    auto start = std::chrono::high_resolution_clock::now();

    for (int trial = 0; trial < 100; trial++) {
        add_scalar(a.data(), b.data(), c.data(), N);
    }

    auto end = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double>(end - start).count();

    double total_bytes = 3.0 * N * sizeof(float) * 100;  // read a, read b, write c
    double bandwidth = total_bytes / elapsed / 1e9;        // GB/s

    std::cout << "Time: " << elapsed << " s\n";
    std::cout << "Bandwidth: " << bandwidth << " GB/s\n";

    return 0;
}
```

```bash
# Compile with optimisations
g++ -O3 -march=native -o bench bench.cpp
./bench
```

- **该代码中的关键C++概念**：
- `#include <vector>`：动态数组（`std::vector<float>`）——类似于Python中的`list`，但具有数据类型限制且内存中是连续存储的。
- `a.data()`：返回指向底层数组的原始指针（`float*`）——用于使用SIMD指令集功能。
- `std::chrono`：用于性能测量的高精度计时器。
- `-O3`：编译器的最高优化级别。编译器会自动将循环转换为向量形式（即自动使用SIMD指令）。`-march=native`则能启用CPU所支持的所有SIMD指令。

- **为何需要预热**：首次运行时，缓存会被填满，这可能会触发CPU频率的提升（涡轮增压效果）。之后的运行结果才更具参考价值。

- **为何要测量带宽**：对于那些受内存限制的操作（如逐元素相加），有意义的指标是带宽（GB/s），而非FLOPS。如果测得的带宽接近硬件的极限值（DDR5的极限约为50 GB/s），那就说明操作受到内存限制，此时SIMD指令的作用并不大（瓶颈在于内存，而非计算能力）。

## 编程任务（可使用CoLab或笔记本完成）

1. 计算常见机器学习操作的算术强度，并将其分为受内存限制或受计算能力限制的类型。

```python
import jax.numpy as jnp

def arithmetic_intensity(flops, bytes_transferred):
    return flops / bytes_transferred

# Element-wise ReLU: 1 comparison per element, read + write
n = 1024
relu_flops = n  # 1 op per element
relu_bytes = 2 * n * 4  # read input + write output (float32)
print(f"ReLU: {arithmetic_intensity(relu_flops, relu_bytes):.2f} FLOPS/byte → memory-bound")

# Matrix multiply: 2*n^3 ops, read 2*n^2 + write n^2 floats
matmul_flops = 2 * n**3
matmul_bytes = 3 * n**2 * 4  # read A + read B + write C
print(f"Matmul ({n}×{n}): {arithmetic_intensity(matmul_flops, matmul_bytes):.0f} FLOPS/byte → compute-bound")

# Layer norm: ~5n ops (mean, var, normalise), read + write
ln_flops = 5 * n
ln_bytes = 2 * n * 4
print(f"LayerNorm: {arithmetic_intensity(ln_flops, ln_bytes):.2f} FLOPS/byte → memory-bound")

# Convolution 3x3: 2*9*C_in*C_out*H*W, read kernel + feature map + write output
C_in, C_out, H, W = 64, 128, 32, 32
conv_flops = 2 * 9 * C_in * C_out * H * W
conv_bytes = (9 * C_in * C_out + C_in * H * W + C_out * H * W) * 4
print(f"Conv3x3: {arithmetic_intensity(conv_flops, conv_bytes):.0f} FLOPS/byte → compute-bound")
```

1. 说明并行性为何重要。随着数据量的增加，比较顺序执行与并行执行（使用NumPy）的效果。

```python
import numpy as np
import time

for n in [1000, 10000, 100000, 1000000, 10000000]:
    a = np.random.randn(n).astype(np.float32)
    b = np.random.randn(n).astype(np.float32)

    # "Sequential" (Python loop)
    start = time.time()
    c = [a[i] * b[i] for i in range(min(n, 100000))]  # cap at 100K for sanity
    seq_time = time.time() - start
    if n > 100000:
        seq_time *= n / 100000  # extrapolate

    # "Parallel" (NumPy, uses SIMD + multithreading internally)
    start = time.time()
    c = a * b
    par_time = time.time() - start

    print(f"n={n:>10,}  sequential={seq_time:.4f}s  parallel={par_time:.6f}s  "
          f"speedup={seq_time/par_time:.0f}x")
```

## ARM与NEON

_所有智能手机、大多数平板电脑、苹果公司的笔记本电脑，以及越来越多的数据中心服务器都采用ARM处理器。本文档介绍了ARM架构、使用C++内置函数进行NEON SIMD编程、用于可扩展向量处理的SVE/SVE2技术、苹果芯片的特定特性，以及实用的向量化内核示例。_

- 如果你使用的是iPhone或MacBook，或者运行AWS Graviton服务器，那么你正在使用ARM架构。ARM出色的能效优势使其在移动设备和嵌入式系统中占据主导地位，同时在服务器及机器学习推理领域也展现出越来越强的竞争力。了解ARM SIMD技术后，你就能编写出在大多数人实际使用的硬件上高效运行的代码。

- 若想了解实际应用中的ARM SIMD内核示例，可以参考**Cactus**——这款专为移动设备和可穿戴设备设计的低延迟AI引擎：[github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus)。Cactus实现了基于ARM NEON及NPU加速的定制化内核，可用于注意力计算、KV缓存量化以及分块预填充操作，能在ARM CPU上实现最快的推理速度，且其内存占用仅为其他引擎的1/10。该引擎的三层架构（引擎→图结构→内核）正是本文档中所介绍的SIMD概念如何被应用于构建实际机器学习基础设施的典型例子。

## ARM架构基础

- ARM属于**RISC**（精简指令集计算机）架构（详见第13章）。其主要特点如下：

- **加载-存储架构**：算术指令只能作用于寄存器，无法直接操作内存。若要将内存中的两个数相加，必须先将其加载到寄存器中，再对寄存器内的数值进行相加，最后将结果写回内存。这比x86架构更简单（x86可在一条指令中同时对寄存器和内存地址进行操作），同时也便于实现更高效的流水线处理。

- **固定宽度指令**：所有ARMv8（AArch64）指令的长度均为32位。这样的设计使得指令解码速度更快且更具可预测性（而x86的指令长度则介于1到15字节之间）。

- **32个通用寄存器**（x0-x30，每个寄存器为64位），此外还有堆栈指针（sp）和零寄存器（xzr）。相比之下，x86只有16个通用寄存器。更多的寄存器意味着更少的内存访问次数，从而提升代码的执行速度。

- **32个SIMD/浮点运算寄存器**（v0-v31，每个寄存器为128位），用于支持NEON及浮点运算。

```cpp
// ARM assembly (just to see the flavour -- you will use intrinsics, not assembly)
// Add two registers
add x0, x1, x2    // x0 = x1 + x2

// Load from memory
ldr x0, [x1]      // x0 = *x1 (load 64 bits from address in x1)

// NEON: add four floats
fadd v0.4s, v1.4s, v2.4s  // v0 = v1 + v2 (four 32-bit floats)
```

- 无需编写汇编代码。应使用**内联函数**：这类C/C++函数能够与特定的指令一一对应。编译器会负责处理寄存器的分配、调度以及其他底层细节。

## NEON：128位SIMD技术

- **NEON**是ARM的SIMD扩展技术。每个NEON寄存器的宽度为128位，可存储以下类型的数据：

| 数据类型 | 每个寄存器可存储的元素数 | 表示方式 |
| ----------- || ----------------------- || ---------- ||
| float32 | 4 | `float32x4_t` |
| float16 | 8 | `float16x8_t` |
| int32 | 4 | `int32x4_t` |
| int16 | 8 | `int16x8_t` |
| int8 | 16 | `int8x16_t` |

- 128位的宽度虽然小于x86架构中的AVX（256位）和AVX-512（512位），但ARM凭借出色的能效以及广泛的普及度来弥补这一劣势。

### NEON内联函数：基本概念

- NEON内联函数的命名规则为：`v[操作类型][修饰符]_[数据类型]`

```cpp
#include <arm_neon.h>

// Load 4 floats from memory into a NEON register
float32x4_t a = vld1q_f32(ptr);        // vld1q = vector load 1, q = 128-bit (quad)

// Store 4 floats from a NEON register to memory
vst1q_f32(out_ptr, a);                   // vst1q = vector store 1, q = 128-bit

// Arithmetic
float32x4_t c = vaddq_f32(a, b);        // c = a + b (4 floats)
float32x4_t d = vmulq_f32(a, b);        // d = a * b (4 floats)
float32x4_t e = vfmaq_f32(c, a, b);     // e = c + a * b (fused multiply-add, 4 floats)

// Comparison (returns a mask: all 1s if true, all 0s if false)
uint32x4_t mask = vcgtq_f32(a, b);      // mask[i] = (a[i] > b[i]) ? 0xFFFFFFFF : 0

// Select elements based on mask (like numpy.where)
float32x4_t result = vbslq_f32(mask, a, b);  // result[i] = mask[i] ? a[i] : b[i]

// Reduce: sum all 4 elements to a scalar
float total = vaddvq_f32(a);             // total = a[0] + a[1] + a[2] + a[3]
```

- **`vfmaq_f32`**（融合乘加指令）是用于机器学习领域最重要的SIMD指令。它可以通过一条指令完成$c = c + a \times b$的计算，且只需一次舍入操作（相比先进行乘法再执行加法的方式更为精确）。点积、矩阵乘法以及卷积运算都是基于FMA指令实现的。

### 实际示例：向量化点积运算

- 点积运算是矩阵乘法中的内层循环。我们先用标量C++语言实现该运算，然后再利用NEON指令将其向量化。

```cpp
#include <arm_neon.h>

// Scalar dot product
float dot_scalar(const float* a, const float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

// NEON-vectorised dot product
float dot_neon(const float* a, const float* b, int n) {
    float32x4_t sum_vec = vdupq_n_f32(0.0f);  // initialise 4 accumulators to 0

    int i = 0;
    for (; i + 4 <= n; i += 4) {
        float32x4_t va = vld1q_f32(a + i);     // load 4 elements from a
        float32x4_t vb = vld1q_f32(b + i);     // load 4 elements from b
        sum_vec = vfmaq_f32(sum_vec, va, vb);   // sum_vec += va * vb
    }

    // Reduce the 4 accumulators to a single scalar
    float sum = vaddvq_f32(sum_vec);

    // Handle remaining elements (if n is not a multiple of 4)
    for (; i < n; i++) {
        sum += a[i] * b[i];
    }

    return sum;
}
```

- **关键的C++概念**：
- `const float*`：指向只读浮点数据的指针。`const`表示我们不会通过该指针修改数据。
- `a + i`：指针运算。`a + i`表示数组中的第$i$个元素（与`&a[i]`效果相同）。
- 代码末尾的“清理循环”用于处理$n$不是4的倍数的情况。这是SIMD代码中的常见处理方式：先以向量化的方式处理大部分数据，再用标量代码处理剩余数据。

- **为何在`sum_vec`中使用4个累加器**：与其使用一个标量累加器，我们选择使用4个独立的累加器（每个SIMD执行单元一个）。这样可以避免数据依赖问题：每次迭代中的FMA操作都需要用到`sum_vec`，但有了4个独立的执行单元后，CPU就可以并行执行这些FMA操作。最后，再将这4个部分和相加，得到最终结果。

### 实际示例：向量化ReLU运算

```cpp
#include <arm_neon.h>

void relu_neon(const float* input, float* output, int n) {
    float32x4_t zero = vdupq_n_f32(0.0f);

    int i = 0;
    for (; i + 4 <= n; i += 4) {
        float32x4_t x = vld1q_f32(input + i);
        float32x4_t result = vmaxq_f32(x, zero);  // max(x, 0) = ReLU
        vst1q_f32(output + i, result);
    }

    // Scalar cleanup
    for (; i < n; i++) {
        output[i] = input[i] > 0 ? input[i] : 0;
    }
}
```

- `vmaxq_f32`用于计算两个向量的逐元素最大值。由于其中一个向量全是零，因此该操作实际上就相当于ReLU运算。无需任何分支判断或比较操作——仅需一条指令即可完成。

## I8MM：整数矩阵乘法

- **I8MM**（Int8矩阵乘法）是ARMv8.6架构的一项扩展功能，它提供了专门用于INT8矩阵乘法并以INT32形式进行结果累加的指令——这正是量化后的机器学习推理所需要的。

- 关键指令为**`SMMLA`**（带符号矩阵乘法并累加）：该指令可处理两个8×2大小的INT8数值块，并将计算结果累加到2×2大小的INT32数值块中。

```cpp
#include <arm_neon.h>

// I8MM: multiply two 8-element INT8 vectors, accumulate into 4 INT32 results
// This computes a 2x2 tile of the output matrix from 2x8 x 8x2 input tiles
void matmul_i8mm_tile(const int8_t* A, const int8_t* B, int32_t* C) {
    // Load 8 bytes from A (2 rows of 4 elements, packed)
    int8x16_t va = vld1q_s8(A);   // 16 bytes = 2 rows × 8 elements
    int8x16_t vb = vld1q_s8(B);   // 16 bytes = 2 rows × 8 elements

    // Load existing accumulator (2x2 = 4 int32 values)
    int32x4_t acc = vld1q_s32(C);

    // I8MM instruction: acc += A_tile × B_tile^T
    // Computes 2×2 output from 2×8 × 8×2 inputs
    acc = vmmlaq_s32(acc, va, vb);  // THE I8MM instruction

    vst1q_s32(C, acc);
}
```

- **为何I8MM如此重要**：在没有I8MM的情况下，使用NEON进行INT8矩阵乘法运算时，需要先通过`vmull`指令进行宽位乘法运算，然后再进行逐元素相加操作——每个输出元素都需要多条指令来完成。而有了I8MM之后，硬件只需一条指令就能完成8个元素的点积运算（2×8 × 8×2 = 2×2）。对于INT8类型的推理任务而言，这种处理方式的速度比单纯使用NEON快4到8倍。

- **支持情况**：Apple M1+系列芯片（所有Apple Silicon芯片）、ARM Cortex-A510/A710/X2+系列芯片（ARMv9架构）、AWS Graviton3+系列芯片均支持该功能。可通过`#ifdef __ARM_FEATURE_MATMUL_INT8`来确认是否支持。

- 对于机器学习推理来说，在基于ARM架构的服务器（如Graviton芯片）或Apple Silicon芯片上运行经过INT8量化的模型时，I8MM能带来极大的性能提升。ONNX Runtime和llama.cpp等框架能够在运行时检测到I8MM的存在，并自动使用优化后的内核。

## SME与SME2：可扩展矩阵扩展功能

- **SME**（可扩展矩阵扩展功能）是ARM针对Intel的AMX以及NVIDIA的Tensor Cores所推出的解决方案，即专门用于矩阵运算的硬件模块。SME2（ARMv9.2架构）则进一步提升了这一功能。

- SME引入了**ZA瓦片寄存器**：这些寄存器用于存储二维矩阵数据，其存储容量可达SVL×SVL字节大小（其中SVL为流式向量长度，通常为每维度128到512比特）。与NEON（一维向量）甚至SVE（一维可扩展向量）不同，SME能够直接对二维矩阵数据进行运算。

- 其编程模型有两种模式：
- **普通模式**：采用标准的ARM执行方式，NEON和SVE指令仍可正常使用。
- **流式SVE模式**：通过`smstart`指令进入该模式，此时SME指令方可被使用。在該模式下，SVE指令也能正常工作，但可能会使用不同宽度的寄存器。

```cpp
#include <arm_sme.h>

// SME2: outer product accumulation for matrix multiply
// Accumulates A_col × B_row into the ZA tile register
void sme2_matmul_outer(const float* A_col, const float* B_row, int K) {
    // Enter streaming mode
    // smstart;  // (done via compiler intrinsic or inline asm)

    // Zero the ZA tile accumulator
    svzero_za();

    for (int k = 0; k < K; k++) {
        // Load a column of A and a row of B into SVE registers
        svfloat32_t a = svld1_f32(svptrue_b32(), &A_col[k * SVL]);
        svfloat32_t b = svld1_f32(svptrue_b32(), &B_row[k * SVL]);

        // Outer product: ZA += a × b^T
        // This accumulates an SVL×SVL tile in one instruction
        svmopa_za32_f32_m(0, svptrue_b32(), svptrue_b32(), a, b);
    }

    // Store the ZA tile to memory
    // svst1_za(...);

    // Exit streaming mode
    // smstop;
}
```

- **核心概念**：
- **`svmopa`**（外积累加操作）：这是SME指令的核心功能。它能够计算两个向量的完整外积结果，并将结果累加到ZA单元中。当SVL为512位（即16个浮点数）时，该指令会执行16×16的外积运算——相当于在一条指令中完成256次FMA运算。
- **ZA单元**：在流式处理模式下，该单元的内容会在多条指令之间保持不变。可以通过该单元累加多个外积结果（每次K次迭代生成一个结果），从而逐步构建出完整的矩阵乘法结果。
- **流式处理模式**：SME指令仅能在流式处理模式下使用。由于需要额外的开销来切换这种模式，因此SME更适合用于连续性的矩阵计算，而不适合短时间的批量计算。

- **SME2的新增功能**：支持多向量运算（可同时处理2个或4个SVE向量）、更多的单元操作，以及与普通处理模式的更好集成。

- **可用性**：ARM Neoverse V2（AWS Graviton4）以及部分即将推出的移动芯片已支持该技术。截至2026年，Apple Silicon尚未支持SME。目前SME仍处于发展初期，大多数机器学习框架还不存在针对该指令优化的算法内核。

- **技术发展历程**：从NEON（128位向量，逐元素运算）→ I8MM（INT8格式的矩阵单元）→ SVE（可扩展向量）→ SME（可扩展的2D矩阵单元）。每一代技术都更接近于硬件层面的原生矩阵运算。

## SVE与SVE2：可扩展向量扩展技术

- NEON的向量宽度是固定的128位。而**SVE**（可扩展向量扩展技术）则实现了与向量宽度无关的编程方式：只需编写一次代码，它就能在向量宽度为128到2048位的各种硬件上运行。具体的向量宽度由硬件在运行时决定。

```cpp
#include <arm_sve.h>

void add_sve(const float* a, const float* b, float* c, int n) {
    int i = 0;
    svbool_t pred = svwhilelt_b32(i, n);  // predicate: which lanes are active

    while (svptest_any(svptrue_b32(), pred)) {
        svfloat32_t va = svld1(pred, a + i);
        svfloat32_t vb = svld1(pred, b + i);
        svst1(pred, c + i, svadd_x(pred, va, vb));

        i += svcntw();  // advance by the hardware vector width (in 32-bit elements)
        pred = svwhilelt_b32(i, n);
    }
}
```

- **条件寄存器**（`svbool_t`）可替代传统的标量处理循环。每个处理单元都有一个条件位：处于活动状态的单元会参与运算，而处于非活动状态的单元则会被屏蔽掉。`svwhilelt_b32(i, n)`指令可用于创建这样的条件——使得`i、i+1、...、n-1`对应的处理单元处于活动状态，从而自动处理剩余的数据。

- **`svcntw()`**函数可在运行时返回每个向量寄存器中32位元素的个数。在拥有256位SVE架构的CPU上，该函数的返回值为8；而在512位SVE架构的CPU上，则为16。代码会自动适应这些差异。

- SVE架构适用于ARM Neoverse V1/V2系列芯片（如AWS Graviton3/4以及某些服务器芯片），但目前还不支持Apple Silicon芯片。

## Apple Silicon芯片的特定特性

- Apple的M系列芯片（M1、M2、M3、M4）基于ARM架构，但具有自定义的微架构：

- **性能核心与效率核心**：P核心（如Firestorm/Avalanche等）用于执行复杂的计算任务，E核心（如Icestorm/Blizzard等）则用于处理后台任务。调度器会根据任务类型将线程分配到相应的核心上。

- **AMX**（Apple矩阵扩展功能）：这是一种专用的矩阵乘法单元，与NEON功能相互独立。由于Apple并未公开其指令集规范，因此AMX的相关信息并不公开，不过Accelerate框架会在内部使用它来执行BLAS运算。在Mac上调用`np.dot`函数时，数据会通过Accelerate框架处理，而该框架又会利用AMX功能。除非通过逆向工程，否则无法直接对AMX进行编程。

- **统一内存架构**：CPU和GPU共享同一块物理RAM内存。在其他系统中，数据需要从CPU内存复制到GPU内存中（通过PCIe接口传输，传输速度约为32 GB/s）。而在Apple Silicon芯片上则无需复制——GPU可以直接读取CPU写入的同一块内存，这大大减少了机器学习任务中的瓶颈。

- **神经网络引擎**：这是一种拥有16个核心的专用机器学习加速器，能够以每秒约30万亿次操作的速度处理INT8格式的数据。Core ML框架就会利用这一引擎来实现设备端的机器学习推理功能。

- **在Apple Silicon芯片上进行机器学习开发时**，可以使用MLX框架，该框架是为统一内存架构设计的。PyTorch也支持MPS（Metal性能着色器）作为后端处理工具，不过其成熟度还不及CUDA。

## 自动向量化处理

- 编写SIMD相关代码相当繁琐。那么，**编译器**能否自动实现代码的向量化处理呢？

- 可以，但有一些限制。现代编译器（如GCC、Clang）能够自动对简单的循环结构进行向量化处理：

```cpp
// The compiler CAN auto-vectorise this (with -O3 -march=native)
void add_auto(const float* a, const float* b, float* c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}
```

- **有助于自动向量化处理的模式**：
- 循环次数已知的简单循环。
- 各次迭代之间不存在数据依赖关系（`c[i]`不依赖于`c[i-1]`）。
- 内存访问是连续的（没有分散式/聚集式访问）。
- 使用`const`和`restrict`修饰的指针（告知编译器数组之间不会重叠）。

```cpp
// restrict tells the compiler: a, b, c point to non-overlapping memory
void add_restrict(const float* __restrict__ a,
                  const float* __restrict__ b,
                  float* __restrict__ c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}
```

- 如果没有使用`restrict`关键字，编译器会认为变量`c`可能与`a`或`b`存在数据重叠的情况（对`c[i]`的写入操作可能会改变`a[i+1]`的值），因此无法实现向量化处理。

- **会导致自动向量化失败的情况**：
- 数据依赖关系：如`a[i] = a[i-1] + b[i]`，因为每次迭代都依赖于前一次的计算结果。
- 复杂的控制流：循环内部包含`if`语句（除非编译器能够将其转换为条件判断形式）。
- 循环内部有函数调用（除非该函数被内联处理）。
- 指针别名现象：在没有使用`restrict`关键字的情况下，数组之间可能存在数据重叠。

- **检查是否实现了自动向量化**：可以通过编译器标志来了解哪些操作已经被向量化处理了。

```bash
# GCC: show vectorisation decisions
g++ -O3 -march=native -fopt-info-vec-optimized code.cpp

# Clang: show vectorisation report
clang++ -O3 -march=native -Rpass=loop-vectorize code.cpp
```

- **何时使用内置函数而非自动向量化处理**：首先应使用规范的C++代码，并充分利用编译器的优化功能。如果编译器能够对循环进行向量化处理，那当然很好；但如果性能仍然不达标，就需要查看编译器的向量化处理报告，了解原因，之后再为那些关键的内部循环编写内置函数。过早地使用内置函数只会让代码变得难以理解，而且也无法确保能带来实际的好处。

## 编程任务（在ARM平台上的g++或clang++编译器上执行——适用于Mac M系列或Linux aarch64系统）

1. 编写一个标量点积计算函数，以及一个利用NEON技术实现向量化点积的计算函数。对这两种实现方式分别进行性能测试，比较它们的速度差异。

```cpp
// task1_neon_dot.cpp
// Compile (Mac/ARM Linux): clang++ -O3 -o task1 task1_neon_dot.cpp
// Note: NEON is enabled by default on AArch64, no special flags needed

#include <iostream>
#include <chrono>
#include <vector>
#include <arm_neon.h>

float dot_scalar(const float* a, const float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

float dot_neon(const float* a, const float* b, int n) {
    float32x4_t sum_vec = vdupq_n_f32(0.0f);
    int i = 0;
    for (; i + 4 <= n; i += 4) {
        float32x4_t va = vld1q_f32(a + i);
        float32x4_t vb = vld1q_f32(b + i);
        sum_vec = vfmaq_f32(sum_vec, va, vb);
    }
    float sum = vaddvq_f32(sum_vec);
    for (; i < n; i++) sum += a[i] * b[i];
    return sum;
}

int main() {
    const int N = 10'000'000;
    std::vector<float> a(N, 1.0f), b(N, 2.0f);

    // Warm up
    volatile float s1 = dot_scalar(a.data(), b.data(), N);
    volatile float s2 = dot_neon(a.data(), b.data(), N);

    // Benchmark scalar
    auto start = std::chrono::high_resolution_clock::now();
    for (int t = 0; t < 100; t++) {
        s1 = dot_scalar(a.data(), b.data(), N);
    }
    auto end = std::chrono::high_resolution_clock::now();
    double scalar_ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;

    // Benchmark NEON
    start = std::chrono::high_resolution_clock::now();
    for (int t = 0; t < 100; t++) {
        s2 = dot_neon(a.data(), b.data(), N);
    }
    end = std::chrono::high_resolution_clock::now();
    double neon_ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;

    std::cout << "Scalar: " << scalar_ms << " ms (result: " << s1 << ")\n";
    std::cout << "NEON:   " << neon_ms << " ms (result: " << s2 << ")\n";
    std::cout << "Speedup: " << scalar_ms / neon_ms << "x\n";
    return 0;
}
```

1. 实现NEON版本的ReLU函数以及softmax-max计算功能。通过不同的运算方式，练习“加载数据→进行计算→存储结果”的处理流程。

```cpp
// task2_neon_ops.cpp
// Compile: clang++ -O3 -o task2 task2_neon_ops.cpp

#include <iostream>
#include <vector>
#include <cmath>
#include <arm_neon.h>

void relu_neon(const float* in, float* out, int n) {
    float32x4_t zero = vdupq_n_f32(0.0f);
    int i = 0;
    for (; i + 4 <= n; i += 4) {
        float32x4_t x = vld1q_f32(in + i);
        vst1q_f32(out + i, vmaxq_f32(x, zero));
    }
    for (; i < n; i++) out[i] = in[i] > 0 ? in[i] : 0;
}

float max_neon(const float* data, int n) {
    float32x4_t max_vec = vdupq_n_f32(-INFINITY);
    int i = 0;
    for (; i + 4 <= n; i += 4) {
        max_vec = vmaxq_f32(max_vec, vld1q_f32(data + i));
    }
    float result = vmaxvq_f32(max_vec);
    for (; i < n; i++) result = result > data[i] ? result : data[i];
    return result;
}

int main() {
    std::vector<float> data = {-3, 1, -1, 4, 2, -5, 0, 7, -2, 3};
    std::vector<float> out(data.size());

    relu_neon(data.data(), out.data(), data.size());
    std::cout << "ReLU: ";
    for (float x : out) std::cout << x << " ";
    std::cout << "\n";

    float mx = max_neon(data.data(), data.size());
    std::cout << "Max: " << mx << " (expected: 7)\n";
    return 0;
}
```

1. 比较自动向量化生成的代码与手动编写的NEON内联函数。使用`-fopt-info-vec`（GCC）或`-Rpass=loop-vectorize`（Clang）进行编译，以便了解编译器的处理方式。

```cpp
// task3_auto_vs_manual.cpp
// Compile: clang++ -O3 -Rpass=loop-vectorize -o task3 task3_auto_vs_manual.cpp
//    (or): g++ -O3 -fopt-info-vec-optimized -o task3 task3_auto_vs_manual.cpp

#include <iostream>
#include <chrono>
#include <vector>
#include <arm_neon.h>

// Let the compiler auto-vectorise
void add_auto(const float* __restrict__ a, const float* __restrict__ b,
              float* __restrict__ c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

// Hand-written NEON
void add_neon(const float* a, const float* b, float* c, int n) {
    int i = 0;
    for (; i + 4 <= n; i += 4) {
        vst1q_f32(c + i, vaddq_f32(vld1q_f32(a + i), vld1q_f32(b + i)));
    }
    for (; i < n; i++) c[i] = a[i] + b[i];
}

int main() {
    const int N = 10'000'000;
    std::vector<float> a(N, 1.0f), b(N, 2.0f), c(N);

    auto bench = [&](auto fn, const char* name) {
        fn(a.data(), b.data(), c.data(), N);  // warm up
        auto start = std::chrono::high_resolution_clock::now();
        for (int t = 0; t < 100; t++) fn(a.data(), b.data(), c.data(), N);
        auto end = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;
        std::cout << name << ": " << ms << " ms\n";
    };

    bench(add_auto, "Auto-vectorised");
    bench(add_neon, "Hand-written NEON");
    // They should be very close — the compiler auto-vectorises this simple loop well
    return 0;
}
```

## x86与AVX

在大多数机器学习训练任务中，英特尔和AMD生产的x86处理器被广泛用于数据中心服务器。本文档介绍了x86 SIMD技术的发展历程、AVX/AVX2指令集的运用方式、AVX-512技术、用于矩阵运算的Intel AMX技术、内存对齐问题、性能优化技巧以及性能分析方法——这些都是帮助人们最大限度地发挥最常见服务器CPU性能的工具。

- 如果您的训练是在云虚拟机上进行的（如AWS、GCP、Azure），那么几乎可以肯定的是它使用的是x86架构的处理器。即便是在需要大量GPU算力的训练场景中，CPU仍然起着关键作用：数据加载、预处理、梯度聚合以及检查点保存等操作都需要由CPU来完成。通过利用x86 SIMD技术来优化这些操作，可以显著缩短整个训练过程的时间。

## x86 SIMD技术的发展历程

- x86 SIMD技术的不断发展体现在向量寄存器的宽度逐渐增加：

| 代数 | 年份 | 寄存器宽度 | 寄存器数量 | 主要特性 |
| ------ || ------ || ------------- || ----------- || ---------- ||
| MMX | 1997年 | 64位 | 8个（mm0-7） | 仅支持整数运算，与FPU共享寄存器 |
| SSE | 1999年 | 128位 | 8个（xmm0-7） | 支持4个浮点数运算，拥有专用寄存器 |
| SSE2 | 2001年 | 128位 | 8/16个 | 支持2个双精度浮点数运算，同时具备整数运算功能 |
| AVX | 2011年 | 256位 | 16个（ymm0-15） | 支持8个浮点数运算，具备3操作数指令功能 |
| AVX2 | 2013年 | 256位 | 16个 | 支持256位整数运算、FMA运算以及数据收集功能 |
| AVX-512 | 2017年 | 512位 | 32个（zmm0-31） | 支持16个浮点数运算，具备掩码寄存器及数据分散功能 |
| AMX | 2023年 | 瓦片式寄存器 | 8个瓦片 | 用于矩阵乘法运算，支持BF16和INT8格式数据 |

- 每一代技术都使得向量化代码的处理效率翻倍。使用SSE指令集编写的代码可以在2001年以后生产的所有x86 CPU上运行。而AVX2则要求CPU为2013年及之后的型号；AVX-512则适用于英特尔Xeon系列以及部分消费级芯片。AMX则是最新技术，应用于Sapphire Rapids及更新一代的处理器上。

- **向后兼容性**：x86 SSE寄存器（xmm）相当于AVX寄存器（ymm）的低128位，而AVX寄存器又相当于AVX-512寄存器（zmm）的低256位。因此，旧的SSE代码无需修改即可在新的CPU上运行。

## AVX2编程

- AVX2基于256位的寄存器（YMM）进行操作，能够同时处理8个浮点数或4个双精度浮点数。它非常适合用于编写高效且具有良好兼容性的代码——几乎所有的现代x86 CPU（2013年及之后生产的）都支持该技术。

### 指令集函数命名规则

- 所有x86指令集函数都遵循以下命名格式：`_mm[宽度]_[操作类型]_[数据类型]`

- `_mm` = MMX/SSE技术对应的128位寄存器，`_mm256` = AVX技术对应的256位寄存器，`_mm512` = AVX-512技术对应的512位寄存器
- 操作类型：`add`、`mul`、`fmadd`、`load`、`store`、`set`等
- 数据类型：`ps` = 排列单精度浮点数（float32），`pd` = 排列双精度浮点数（float64），`epi32` = 排列32位整数，`si256` = 256位整数

```cpp
#include <immintrin.h>  // all x86 SIMD intrinsics

// Data types
__m256  a;   // 256-bit register holding 8 float32s
__m256d b;   // 256-bit register holding 4 float64s
__m256i c;   // 256-bit register holding integers (8x32, 16x16, or 32x8)
```

### 数据的加载与存储

```cpp
// Load 8 floats from memory
__m256 v = _mm256_loadu_ps(ptr);      // unaligned load (works with any address)
__m256 v = _mm256_load_ps(ptr);       // aligned load (ptr must be 32-byte aligned, faster)

// Store 8 floats to memory
_mm256_storeu_ps(out_ptr, v);          // unaligned store
_mm256_store_ps(out_ptr, v);           // aligned store

// Broadcast a single value to all 8 lanes
__m256 ones = _mm256_set1_ps(1.0f);    // [1, 1, 1, 1, 1, 1, 1, 1]

// Set individual values (rarely needed)
__m256 v = _mm256_set_ps(7,6,5,4,3,2,1,0);  // note: reverse order!

// Zero register
__m256 z = _mm256_setzero_ps();
```

### 算术运算

```cpp
__m256 c = _mm256_add_ps(a, b);        // c[i] = a[i] + b[i]
__m256 d = _mm256_mul_ps(a, b);        // d[i] = a[i] * b[i]
__m256 e = _mm256_sub_ps(a, b);        // e[i] = a[i] - b[i]
__m256 f = _mm256_div_ps(a, b);        // f[i] = a[i] / b[i] (slower than mul)

// Fused Multiply-Add: r = a * b + c (one instruction, one rounding)
__m256 r = _mm256_fmadd_ps(a, b, c);   // THE most important instruction for ML

// Min and max
__m256 mn = _mm256_min_ps(a, b);       // min(a[i], b[i]) — useful for clipping
__m256 mx = _mm256_max_ps(a, b);       // max(a[i], b[i]) — useful for ReLU
```

### 实际示例：AVX2点积运算

```cpp
#include <immintrin.h>

float dot_avx2(const float* a, const float* b, int n) {
    __m256 sum = _mm256_setzero_ps();  // 8 accumulators initialised to 0

    int i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        sum = _mm256_fmadd_ps(va, vb, sum);  // sum += va * vb
    }

    // Horizontal reduction: sum the 8 elements of sum
    // Step 1: add upper 128 bits to lower 128 bits
    __m128 hi = _mm256_extractf128_ps(sum, 1);
    __m128 lo = _mm256_castps256_ps128(sum);
    __m128 sum128 = _mm_add_ps(hi, lo);        // 4 partial sums

    // Step 2: horizontal add within 128-bit register
    sum128 = _mm_hadd_ps(sum128, sum128);       // [a+b, c+d, a+b, c+d]
    sum128 = _mm_hadd_ps(sum128, sum128);       // [a+b+c+d, ...]

    float result = _mm_cvtss_f32(sum128);       // extract scalar

    // Scalar cleanup
    for (; i < n; i++) {
        result += a[i] * b[i];
    }

    return result;
}
```

- **为何横向求和操作如此复杂**：SIMD架构是为纵向操作而设计的（第0个元素与第0个元素相操作，第1个元素与第1个元素相操作）。而横向操作（即对多个元素进行求和）则与硬件设计理念相悖。正因如此，点积运算在最后才需要复杂的求和代码。向量化循环部分相对简单，而求和操作则属于重复性的基础代码。

- **性能表现**：与NEON版本（文件02）相比，AVX2每次迭代可以处理8个浮点数，而NEON只能处理4个。对于较长的向量来说，AVX2的处理速度是NEON的两倍（不考虑内存带宽的限制）。

### 实际示例：AVX2实现的简化版Softmax算法

- Softmax算法需要执行以下操作：找出最大值、用该最大值减去各元素的值、对结果取指数、再将所有结果相加、最后进行除法运算。以下是找出最大值的步骤：

```cpp
float vector_max_avx2(const float* data, int n) {
    __m256 max_vec = _mm256_set1_ps(-INFINITY);

    int i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 v = _mm256_loadu_ps(data + i);
        max_vec = _mm256_max_ps(max_vec, v);
    }

    // Reduce 8 maxes to 1
    __m128 hi = _mm256_extractf128_ps(max_vec, 1);
    __m128 lo = _mm256_castps256_ps128(max_vec);
    __m128 max128 = _mm_max_ps(hi, lo);

    // Shuffle and max to find the single maximum
    max128 = _mm_max_ps(max128, _mm_shuffle_ps(max128, max128, 0b01001110));
    max128 = _mm_max_ps(max128, _mm_shuffle_ps(max128, max128, 0b10110001));

    float result = _mm_cvtss_f32(max128);

    for (; i < n; i++) {
        result = result > data[i] ? result : data[i];
    }

    return result;
}
```

- `_mm_shuffle_ps`指令用于重新排列寄存器中的元素。二进制常量`0b01001110`决定了哪些元素会被放到哪个位置。这种操作被称为**排列**，它与排列矩阵的概念密切相关（见第2章）：对SIMD数据通道进行重新排列，实际上就相当于用排列矩阵来进行乘法运算。

## AVX-512

- AVX-512进一步将数据宽度提升了一倍：采用了512位的寄存器（ZMM），能够同时处理16个浮点数。

```cpp
__m512 a = _mm512_loadu_ps(ptr);                // load 16 floats
__m512 c = _mm512_fmadd_ps(a, b, c);            // 16 FMAs at once
float sum = _mm512_reduce_add_ps(a);             // built-in horizontal sum (no manual reduction!)

// Mask operations: operate on a subset of lanes
__mmask16 mask = _mm512_cmpgt_ps_mask(a, zero);  // which lanes are > 0?
__m512 relu = _mm512_maskz_mov_ps(mask, a);       // zero out negative lanes = ReLU
```

- **掩码寄存器**（`__mmask16`）是AVX-512最强大的功能。每个位都用于控制某个数据通道是否参与运算。这一机制取代了传统的标量处理循环：在最后一次迭代中，会使用相应的掩码来确保只有有效的数据通道被启用，从而无需额外的标量循环即可处理任意长度的向量数据。

- **AVX-512的频率限制**：在许多英特尔CPU上，使用AVX-512指令会导致CPU暂时降低其时钟频率（以避免超过散热限制）。这意味着在短时间内的运算中，AVX-512并不一定比AVX2更快——频率下降带来的性能损失可能会抵消向量处理能力提升的优势。而对于需要持续运行的任务（如矩阵乘法），AVX-512则更具优势。在包含混合指令集的代码中（既有SIMD指令也有标量指令），频率的频繁变化可能会影响性能。

## 英特尔AMX：矩阵乘法硬件

- **AMX**（高级矩阵扩展技术）为矩阵乘法提供了专用硬件单元。与SIMD向量不同，AMX是对**数据块**进行操作的：这些数据块为二维结构，每块的行数最多为16行，每行的字节数为64字节。

```cpp
#include <immintrin.h>

// AMX tile multiply: C += A * B (in BF16)
// A is 16x32 BF16, B is 32x16 BF16, C is 16x16 FP32
_tile_loadd(0, a_ptr, stride_a);   // load tile 0 from A
_tile_loadd(1, b_ptr, stride_b);   // load tile 1 from B
_tile_dpbf16ps(2, 0, 1);           // tile 2 += tile 0 * tile 1 (BF16 matmul, FP32 accumulation)
_tile_stored(2, c_ptr, stride_c);  // store tile 2 to C
```

- AMX能够在单条指令中完成16×32×32×16规模的矩阵乘法运算。这相当于同时执行数百次FMA操作，专为处理在Transformer模型推理中常见的小型矩阵乘法任务而设计，比如注意力分数计算以及MLP层中的运算。

- AMX支持BF16（bfloat16）和INT8这两种数据精度，与机器学习推理中所使用的精度标准一致。结合AVX-512用于其他类型的运算，配备AMX技术的CPU（如Intel Sapphire Rapids和Emerald Rapids）能够以与入门级GPU相当的性能来执行Transformer模型的推理任务。

## 内存对齐

- **内存对齐访问**指的是数据地址是向量寄存器宽度的整数倍——SSE的向量寄存器宽度为16字节，AVX为32字节，AVX-512则为64字节。在某些CPU上，进行对齐访问能提升运算速度，而且 `_mm256_load_ps` 函数要求必须进行对齐访问（而 `_mm256_loadu_ps`则没有此要求）。

```cpp
// Allocate aligned memory
float* data = (float*)aligned_alloc(32, n * sizeof(float));  // 32-byte aligned for AVX

// C++ aligned allocation
#include <new>
float* data = new (std::align_val_t(32)) float[n];

// Alternatively, use the compiler attribute
alignas(32) float data[1024];
```

- **实际应用中的表现**：在现代CPU（Haswell及更高版本）上，当数据没有跨越缓存行边界时，非对齐加载操作(`loadu`)的速度几乎与对齐加载操作相当。非对齐访问带来的性能损失已经基本消失，但当数据跨越两个64字节的缓存行时，仍会导致该加载操作的速度下降约2倍。而通过对数据进行对齐处理，则可以完全避免这一问题。

## 性能隐患

- **AVX与SSE之间的切换开销**：在较旧的Intel CPU（Skylake之前）上，要在AVX（256位）指令和SSE（128位）指令之间切换时，会存在一定的性能损失（约70个时钟周期）。因此，在使用AVX的函数返回之前，应使用 `_mm256_zeroupper()`（或`vzeroupper`指令）来清空YMM寄存器中的高128位数据。现代CPU（Skylake及以上版本）则不存在这种问题。

- **寄存器压力**：AVX2拥有16个YMM寄存器。如果内核中使用的变量过多，编译器就会将这些寄存器的内容转存到栈内存中，从而影响性能。因此，应尽量让内部循环保持简单，减少同时存在的变量数量。

- **数据依赖关系**：在`sum = _mm256_fmadd_ps(a, b, sum)`这条指令中，`sum`变量存在数据依赖关系——每次迭代都必须等待之前的FMA操作完成（大约需要4-5个时钟周期）。解决方法是使用多个独立的累加器，最后再对结果进行汇总。

```cpp
// Single accumulator: limited by FMA latency (4-5 cycles)
__m256 sum = _mm256_setzero_ps();
for (...) {
    sum = _mm256_fmadd_ps(a, b, sum);  // each depends on previous
}

// Four accumulators: 4x throughput (hide latency)
__m256 sum0 = _mm256_setzero_ps();
__m256 sum1 = _mm256_setzero_ps();
__m256 sum2 = _mm256_setzero_ps();
__m256 sum3 = _mm256_setzero_ps();
for (...) {
    sum0 = _mm256_fmadd_ps(a0, b0, sum0);  // independent
    sum1 = _mm256_fmadd_ps(a1, b1, sum1);  // independent
    sum2 = _mm256_fmadd_ps(a2, b2, sum2);  // independent
    sum3 = _mm256_fmadd_ps(a3, b3, sum3);  // independent
}
sum0 = _mm256_add_ps(sum0, sum1);
sum2 = _mm256_add_ps(sum2, sum3);
sum0 = _mm256_add_ps(sum0, sum2);
```

- 这是一种用于隐藏延迟的**循环展开**技术。由于这些FM操作会写入不同的寄存器，因此CPU可以连续地执行它们。这是数值计算代码中效果最为显著的微优化手段之一。

## 性能分析

- **性能计数器**能够提供硬件层面的性能数据：

```bash
# Linux perf (requires kernel support)
perf stat ./my_program                    # basic counters: cycles, instructions, IPC
perf stat -e cache-misses,cache-references ./my_program  # cache behaviour
perf record -g ./my_program && perf report              # call graph profiling

# Intel VTune (detailed x86 profiling)
vtune -collect hotspots -- ./my_program
vtune -collect memory-access -- ./my_program   # memory bandwidth analysis
```

- **需要关注的指标**：
- **IPC**（每周期指令数）：反映CPU的利用效率。IPC值大于2为良好状态；若小于1，则说明存在内存访问延迟或分支预测错误。
- **缓存未命中率**：较高的L1/L2缓存未命中率意味着数据局部性较差，需优化数据访问方式。
- **分支预测错误率**：若该比率超过5%，则说明分支指令的预测效果不佳。尽可能将代码转换为无分支结构（使用SIMD比较和混合运算）。
- **实际计算性能与理论上限的对比**：将实测的FLOPS值与理论模型（文件01）中的数值进行比较。如果实际性能低于理论上限，说明还有提升空间。

## 编码任务（在x86架构上使用g++或clang++进行编译——Intel/AMD处理器）

1. 编写标量点积运算函数以及AVX2点积运算函数。对这两种实现方式进行性能测试，测量使用8位宽SIMD指令后带来的性能提升幅度。

```cpp
// task1_avx_dot.cpp
// Compile: g++ -O3 -mavx2 -mfma -o task1 task1_avx_dot.cpp

#include <iostream>
#include <chrono>
#include <vector>
#include <immintrin.h>

float dot_scalar(const float* a, const float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) sum += a[i] * b[i];
    return sum;
}

float dot_avx2(const float* a, const float* b, int n) {
    __m256 sum = _mm256_setzero_ps();
    int i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        sum = _mm256_fmadd_ps(va, vb, sum);
    }
    // Reduce: add upper 128 to lower 128, then horizontal add
    __m128 hi = _mm256_extractf128_ps(sum, 1);
    __m128 lo = _mm256_castps256_ps128(sum);
    __m128 r = _mm_add_ps(hi, lo);
    r = _mm_hadd_ps(r, r);
    r = _mm_hadd_ps(r, r);
    float result = _mm_cvtss_f32(r);
    for (; i < n; i++) result += a[i] * b[i];
    return result;
}

int main() {
    const int N = 10'000'000;
    std::vector<float> a(N, 1.0f), b(N, 2.0f);

    volatile float s1 = dot_scalar(a.data(), b.data(), N);
    volatile float s2 = dot_avx2(a.data(), b.data(), N);

    auto bench = [&](auto fn, const char* name) {
        auto start = std::chrono::high_resolution_clock::now();
        volatile float s;
        for (int t = 0; t < 100; t++) s = fn(a.data(), b.data(), N);
        auto end = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;
        std::cout << name << ": " << ms << " ms (result: " << s << ")\n";
        return ms;
    };

    double t1 = bench(dot_scalar, "Scalar");
    double t2 = bench(dot_avx2,   "AVX2  ");
    std::cout << "Speedup: " << t1 / t2 << "x\n";
    return 0;
}
```

1. 使用 `_mm256_max_ps` 实现AVX2版本的ReLU函数，并将其与基于标量循环的实现方式进行比较。随后尝试使用多个累加器（通过展开循环）来减少FMA运算带来的延迟。

```cpp
// task2_avx_relu.cpp
// Compile: g++ -O3 -mavx2 -o task2 task2_avx_relu.cpp

#include <iostream>
#include <chrono>
#include <vector>
#include <immintrin.h>

void relu_scalar(const float* in, float* out, int n) {
    for (int i = 0; i < n; i++) {
        out[i] = in[i] > 0.0f ? in[i] : 0.0f;
    }
}

void relu_avx2(const float* in, float* out, int n) {
    __m256 zero = _mm256_setzero_ps();
    int i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 x = _mm256_loadu_ps(in + i);
        _mm256_storeu_ps(out + i, _mm256_max_ps(x, zero));
    }
    for (; i < n; i++) out[i] = in[i] > 0.0f ? in[i] : 0.0f;
}

// Unrolled: process 32 floats per iteration (4 x 8)
void relu_avx2_unrolled(const float* in, float* out, int n) {
    __m256 zero = _mm256_setzero_ps();
    int i = 0;
    for (; i + 32 <= n; i += 32) {
        __m256 x0 = _mm256_loadu_ps(in + i);
        __m256 x1 = _mm256_loadu_ps(in + i + 8);
        __m256 x2 = _mm256_loadu_ps(in + i + 16);
        __m256 x3 = _mm256_loadu_ps(in + i + 24);
        _mm256_storeu_ps(out + i,      _mm256_max_ps(x0, zero));
        _mm256_storeu_ps(out + i + 8,  _mm256_max_ps(x1, zero));
        _mm256_storeu_ps(out + i + 16, _mm256_max_ps(x2, zero));
        _mm256_storeu_ps(out + i + 24, _mm256_max_ps(x3, zero));
    }
    for (; i + 8 <= n; i += 8) {
        _mm256_storeu_ps(out + i, _mm256_max_ps(_mm256_loadu_ps(in + i), zero));
    }
    for (; i < n; i++) out[i] = in[i] > 0.0f ? in[i] : 0.0f;
}

int main() {
    const int N = 16'000'000;
    std::vector<float> in(N), out(N);
    for (int i = 0; i < N; i++) in[i] = (float)(i % 200) - 100.0f;

    auto bench = [&](auto fn, const char* name) {
        fn(in.data(), out.data(), N);  // warm up
        auto start = std::chrono::high_resolution_clock::now();
        for (int t = 0; t < 100; t++) fn(in.data(), out.data(), N);
        auto end = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;
        double bw = 2.0 * N * sizeof(float) / ms / 1e6;  // read + write
        std::cout << name << ": " << ms << " ms (" << bw << " GB/s)\n";
    };

    bench(relu_scalar,        "Scalar        ");
    bench(relu_avx2,          "AVX2          ");
    bench(relu_avx2_unrolled, "AVX2 unrolled ");
    return 0;
}
```

1. 测量内存对齐带来的影响。比较对齐存储与未对齐存储情况下对大型数组的读取性能。

```cpp
// task3_alignment.cpp
// Compile: g++ -O3 -mavx2 -o task3 task3_alignment.cpp

#include <iostream>
#include <chrono>
#include <cstdlib>
#include <immintrin.h>

int main() {
    const int N = 16'000'000;

    // Aligned allocation (32-byte for AVX2)
    float* aligned = (float*)aligned_alloc(32, N * sizeof(float));

    // Unaligned: offset by 4 bytes (1 float) from aligned boundary
    float* raw = (float*)malloc((N + 1) * sizeof(float));
    float* unaligned = raw + 1;  // guaranteed misaligned

    for (int i = 0; i < N; i++) {
        aligned[i] = 1.0f;
        unaligned[i] = 1.0f;
    }

    auto bench = [&](float* ptr, bool use_aligned, const char* name) {
        __m256 sum = _mm256_setzero_ps();
        // Warm up
        for (int i = 0; i + 8 <= N; i += 8) {
            __m256 v = use_aligned ? _mm256_load_ps(ptr + i) : _mm256_loadu_ps(ptr + i);
            sum = _mm256_add_ps(sum, v);
        }

        auto start = std::chrono::high_resolution_clock::now();
        for (int t = 0; t < 100; t++) {
            sum = _mm256_setzero_ps();
            for (int i = 0; i + 8 <= N; i += 8) {
                __m256 v = use_aligned ? _mm256_load_ps(ptr + i) : _mm256_loadu_ps(ptr + i);
                sum = _mm256_add_ps(sum, v);
            }
        }
        auto end = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;
        double bw = (double)N * sizeof(float) / ms / 1e6;
        std::cout << name << ": " << ms << " ms (" << bw << " GB/s)\n";
    };

    bench(aligned,   true,  "Aligned load  ");
    bench(unaligned, false, "Unaligned load");

    free(aligned);
    free(raw);
    return 0;
}
```

## GPU架构与CUDA

_GPU通过提供数千个核心来实现大规模并行处理，从而彻底改变了人工智能领域的发展。本文档涵盖了GPU与CPU的设计理念、GPU内存层次结构、C++中的CUDA编程、SIMT执行模型、内存访问模式、同步机制、流处理技术、性能分析方法，以及NVIDIA各代GPU的相关知识——这些都是编写和理解GPU内核所必需的技能。_

- 如需包含完整示例的CUDA实践教程，请访问相关代码库：[github.com/HenryNdubuaku/cuda-tutorials](https://github.com/HenryNdubuaku/cuda-tutorials)。

- 现代NVIDIA GPU拥有超过10,000个CUDA核心，而CPU的核心数则在4到128之间。这种100到1000倍的性能差异正是GPU在机器学习领域占据主导地位的原因：训练Transformer模型需要执行数万亿次乘加运算，而GPU能够以CPU无法企及的速度并行处理这些运算。

- 即使您从不亲自编写CUDA内核，了解GPU架构也能帮助您明白：为何批量处理的大小很重要（需要足够多的任务来让GPU满负荷运转）、为何内存通常是性能瓶颈（而非计算能力），以及为何某些操作（如散列操作、条件分支）在GPU上执行速度较慢。

## GPU与CPU：截然不同的设计理念

- CPU的设计目标是**降低延迟**，即尽量缩短完成一项任务的时间。它将大部分晶体管用于缓存、分支预测以及乱序执行等机制，这些手段都是为了提升单个线程的处理速度。

- GPU的设计目标则是**提高吞吐量**，即尽可能多地完成每秒的任务。它将大部分晶体管用于执行单元。虽然单个线程的处理速度较慢，但GPU拥有数千个这样的线程。

|                      | CPU                              | GPU                                      |
| -------------------- | -------------------------------- | ---------------------------------------- |
| 核心数               | 4-128个（结构复杂，处理速度快）  | 1,000-20,000个（结构简单，处理速度较慢） |
| 频率                 | 3-5 GHz                          | 1-2.5 GHz                                |
| 缓存                 | 容量较大（L3缓存可达32 MB以上）  | 容量较小（每个SM单元有共享内存）         |
| 分支预测             | 非常复杂                         | 无（所有线程都遵循相同的执行路径）       |
| 最适合的应用场景     | 对延迟要求高、控制流程复杂的任务 | 需要高吞吐量、数据并行处理的任务         |
| 典型FP32浮点运算性能 | 1-5 TFLOPS                       | 30-80 TFLOPS                             |
| 内存带宽             | 50-100 GB/s                      | 1-3 TB/s                                 |

- GPU在内存带宽方面的优势（是CPU的10到30倍）往往比其计算能力上的优势更为重要。许多机器学习操作都受内存限制（如元素级运算、归一化操作、注意力机制等），而GPU的高带宽使其能够快速将数据传输到各个处理核心。

## GPU内存层次结构

- 理解GPU内存非常重要，因为**内存访问才是主要的性能瓶颈**，而非计算本身。

| 内存类型 | 容量 | 延迟 | 带宽 | 作用范围 |
| ---------- || ------ || ------ || ------ || ---------- ||
| 寄存器 | 每个SM单元约256 KB | 0周期 | 最高 | 每个线程 |
| 共享内存 | 每个SM单元48-228 KB | 约5周期 | 约20 TB/s | 每个线程块 |
| L1缓存 | 每个SM单元128-256 KB | 约30周期 | 无具体数值 | 每个SM单元 |
| L2缓存 | 4-96 MB | 约200周期 | 约6 TB/s | 全局范围 |
| 全局内存（HBM） | 24-192 GB | 约400周期 | 1-3.3 TB/s | 全局范围 |

- **寄存器**是最快的内存类型，但容量也最为有限。每个线程都有自己独立的寄存器集合（通常最多255个）。如果每个线程使用的寄存器过多，就会降低系统的**占用率**（能够同时运行的线程数量会减少）。

- **共享内存**是由程序员管理的缓存，可供一个线程块中的所有线程共享。它是编写高效CUDA内核的关键：首先将来自速度较慢的全局内存的数据加载到速度更快的共享内存中，然后再对这些数据进行计算。这种“分块处理”的方式在GPU编程中极为常见。

- **全局内存（HBM）**：即GPU的主要内存（显存）。其容量很大，但访问速度较慢（延迟约为400周期）。所有数据的读取和写入都在此进行。优化内核的目标就是尽量减少对全局内存的访问次数。

## CUDA编程模型

- CUDA（计算统一设备架构）是NVIDIA为GPU设计的编程模型。用户需要编写**内核**——即在GPU上运行的函数，这些函数会由数千个线程同时执行。

### 层次结构：网格、线程块、线程

```text
Grid (the entire launch)
├── Block (0,0)
│   ├── Thread (0,0)
│   ├── Thread (1,0)
│   ├── Thread (2,0)
│   └── ... (up to 1024 threads per block)
├── Block (1,0)
│   ├── Thread (0,0)
│   └── ...
└── ... (millions of blocks possible)
```

- **线程**：最小的计算单元。每个线程在其所属的块中都有一个唯一的编号（`threadIdx.x`）。
- **块**：由多个线程组成的群体，这些线程可以共享内存并实现同步。块的编号为`blockIdx.x`，块的大小则为`blockDim.x`（最多可包含1024个线程）。
- **网格**：由单个内核所启动的所有块构成的整体。网格可以是1维、2维或3维结构。

- 每个线程都会计算出自己的全局索引：`int idx = blockIdx.x * blockDim.x + threadIdx.x;`

### 你的第一个CUDA内核

```cpp
// vector_add.cu — CUDA source file (.cu extension)

#include <stdio.h>

// __global__ marks this as a GPU kernel (called from CPU, runs on GPU)
__global__ void vector_add(const float* a, const float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {           // bounds check (grid may be larger than data)
        c[idx] = a[idx] + b[idx];
    }
}

int main() {
    int n = 1 << 20;  // ~1 million elements
    size_t bytes = n * sizeof(float);

    // Allocate host (CPU) memory
    float *h_a = new float[n];
    float *h_b = new float[n];
    float *h_c = new float[n];

    // Initialise
    for (int i = 0; i < n; i++) {
        h_a[i] = 1.0f;
        h_b[i] = 2.0f;
    }

    // Allocate device (GPU) memory
    float *d_a, *d_b, *d_c;
    cudaMalloc(&d_a, bytes);
    cudaMalloc(&d_b, bytes);
    cudaMalloc(&d_c, bytes);

    // Copy data from CPU to GPU
    cudaMemcpy(d_a, h_a, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_b, h_b, bytes, cudaMemcpyHostToDevice);

    // Launch kernel: 256 threads per block, enough blocks to cover n elements
    int block_size = 256;
    int grid_size = (n + block_size - 1) / block_size;  // ceiling division
    vector_add<<<grid_size, block_size>>>(d_a, d_b, d_c, n);

    // Copy result from GPU to CPU
    cudaMemcpy(h_c, d_a, bytes, cudaMemcpyDeviceToHost);

    // Verify
    printf("c[0] = %f (expected 3.0)\n", h_c[0]);

    // Free memory
    cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
    delete[] h_a; delete[] h_b; delete[] h_c;

    return 0;
}
```

```bash
# Compile with NVIDIA's compiler
nvcc -O3 -o vector_add vector_add.cu
./vector_add
```

- **CUDA中的关键C++概念**：
- `__global__`：一个CUDA关键字，用于标记内核函数。该函数由CPU端调用，在GPU端执行。
- `<<<grid_size, block_size>>>`：内核启动语法，用于指定要使用的块数和线程数。
- `cudaMalloc` / `cudaFree`：用于分配/释放GPU内存，功能类似于C语言中的`new`/`delete`，但针对的是GPU内存。
- `cudaMemcpy`：用于在CPU与GPU之间复制数据。这通常是性能的瓶颈所在（PCIe带宽约为32 GB/s，而GPU内存带宽则可达约3 TB/s）。

### 线程组与SIMT

- GPU以32个线程为一组来执行任务，这样的组被称为**线程组**。同一个线程组中的所有32个线程会同时执行**相同的指令**（即单指令多线程——SIMT）。这相当于GPU层面的SIMD技术，只不过是在线程级别上实现。

- 当同一个线程组中的线程选择`if`语句的不同分支时，就会发生**线程分支差异**。GPU无法在一个线程组中同时执行两条不同的指令，因此它只能依次执行这些分支，同时忽略那些不需要参与的线程。这样一来，性能就会下降一半甚至更严重。

```cpp
// BAD: warp divergence (threads in same warp take different paths)
if (threadIdx.x % 2 == 0) {
    c[idx] = a[idx] + b[idx];    // even threads do this
} else {
    c[idx] = a[idx] - b[idx];    // odd threads do this (same warp, serialised)
}

// BETTER: branchless (no divergence)
float sign = (threadIdx.x % 2 == 0) ? 1.0f : -1.0f;
c[idx] = a[idx] + sign * b[idx];  // all threads execute the same instruction
```

### 内存合并

- **合并访问**：当连续的线程访问连续的内存地址时，GPU会将这些访问操作合并为一次内存操作。这对于提升性能至关重要。

```cpp
// GOOD: coalesced — thread 0 reads a[0], thread 1 reads a[1], ...
c[idx] = a[idx] + b[idx];

// BAD: strided — thread 0 reads a[0], thread 1 reads a[stride], ...
c[idx] = a[idx * stride] + b[idx * stride];  // stride > 1 wastes bandwidth
```

- 对于由32个线程组成的一个线程组，合并访问方式可以在一次操作中读取128字节的数据（32×4字节，针对float32类型）。而分步访问则需要多次操作，每次操作虽然也读取128字节，但实际上只有部分数据会被使用。当步长为32时情况最为糟糕：每次操作仍会读取128字节，但只有一个线程能使用到4字节的数据，利用率仅为3%。

### 共享内存与分块处理

- **分块处理模式**是GPU中最重要的优化技术。其原理是：将来自速度较慢的全局内存中的数据块加载到速度更快的共享内存中，在那里进行计算，最后再将结果写回原处。

```cpp
// Matrix multiply with shared memory tiling (simplified)
__global__ void matmul_tiled(const float* A, const float* B, float* C,
                              int M, int N, int K) {
    // Shared memory for one tile of A and one tile of B
    __shared__ float tile_A[TILE_SIZE][TILE_SIZE];
    __shared__ float tile_B[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float sum = 0.0f;

    // Loop over tiles
    for (int t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        // Load one tile of A and B into shared memory
        if (row < M && t * TILE_SIZE + threadIdx.x < K)
            tile_A[threadIdx.y][threadIdx.x] = A[row * K + t * TILE_SIZE + threadIdx.x];
        else
            tile_A[threadIdx.y][threadIdx.x] = 0.0f;

        if (col < N && t * TILE_SIZE + threadIdx.y < K)
            tile_B[threadIdx.y][threadIdx.x] = B[(t * TILE_SIZE + threadIdx.y) * N + col];
        else
            tile_B[threadIdx.y][threadIdx.x] = 0.0f;

        __syncthreads();  // wait for all threads to finish loading

        // Compute partial dot product from this tile
        for (int k = 0; k < TILE_SIZE; k++) {
            sum += tile_A[threadIdx.y][k] * tile_B[k][threadIdx.x];
        }

        __syncthreads();  // wait before loading the next tile
    }

    if (row < M && col < N)
        C[row * N + col] = sum;
}
```

- **`__shared__`**：用于声明块中所有线程共享的内存（访问速度很快，位于芯片内部）。
- **`__syncthreads()`**：这是一种同步机制，会等待块中的所有线程都执行到该指令为止。在向共享内存写入数据之后、从其中读取数据之前，必须使用此指令；否则某些线程可能会读取到过时的数据。
- **为何采用分块处理方式有效**：如果不采用这种方式，每个线程在每次执行乘法运算时都需要从全局内存中读取数据。而通过分块处理，一个大小为TILE_SIZE×TILE_SIZE的数据块会被一次性加载到共享内存中，然后被块中的所有线程重复使用。这样，数据重用率为TILE_SIZE，从而减少了全局内存的访问量。

## 流与并发性

- 默认情况下，CUDA操作是顺序执行的：CPU会启动一个内核，等待其完成后再启动下一个内核。**流**则可以实现操作之间的重叠执行：

```cpp
cudaStream_t stream1, stream2;
cudaStreamCreate(&stream1);
cudaStreamCreate(&stream2);

// These operations can overlap: different streams execute concurrently
cudaMemcpyAsync(d_a, h_a, bytes, cudaMemcpyHostToDevice, stream1);
cudaMemcpyAsync(d_b, h_b, bytes, cudaMemcpyHostToDevice, stream2);

kernel1<<<grid, block, 0, stream1>>>(d_a, d_c);
kernel2<<<grid, block, 0, stream2>>>(d_b, d_d);
```

- 流式处理将数据传输与计算操作同时进行：当一个流中的内核正在运行时，另一个流则负责数据复制。这样一来，PCIe传输带来的延迟就会被掩盖，同时也能让GPU持续处于忙碌状态。

## CUDA代码的性能分析

```bash
# NVIDIA Nsight Compute: kernel-level profiling
ncu --set full ./my_program

# NVIDIA Nsight Systems: system-level timeline
nsys profile ./my_program

# Quick metrics
ncu --metrics sm__throughput,dram__throughput ./my_program
```

- **需要关注的指标**：
- **占用率**：SM容量中被占用的比例。如果占用率较低（低于50%），则线程数量不足，无法有效弥补内存访问的延迟。造成这一情况的原因包括：每个线程拥有的寄存器过多，或每个块所使用的共享内存过多。
- **内存吞吐量**：需与峰值带宽进行比较。如果实际吞吐量低于峰值的50%，则说明内存访问方式效率低下（存在非连续访问、银行冲突等问题）。
- **计算吞吐量**：需与峰值FLOPS值进行比较。如果内存和计算方面的吞吐量都很低，那么说明内核的运行受到延迟限制（并行度不足）。

## 高级优化技术

- 除了基本的连续访问和共享内存优化之外，高性能GPU（以及CPU）代码还会运用多种高级优化技术：

### 数据布局：结构体数组与数组结构体

- **结构体数组（AoS）**：每个元素会将其所有字段存储在一起。例如：`[{x,y,z}, {x,y,z}, {x,y,z}]`。
- **数组结构体（SoA）**：每个字段都会存储在独立的连续数组中。例如：`{[x,x,x], [y,y,y], [z,z,z]}`。

```cpp
// AoS: BAD for SIMD/GPU (accessing all x values touches non-contiguous memory)
struct Particle { float x, y, z, mass; };
Particle particles[N];
// particles[0].x, particles[1].x are 16 bytes apart

// SoA: GOOD for SIMD/GPU (all x values are contiguous)
struct Particles {
    float x[N], y[N], z[N], mass[N];
};
// x[0], x[1] are 4 bytes apart — perfect for coalesced access and SIMD
```

- 对于数据并行型任务（如SIMD运算、GPU计算），SoA架构的效率几乎总是更高。而当需要同时访问某个元素的所有字段时，AoA架构则更为合适——不过在数值计算代码中这种情况很少出现。PyTorch张量本质上属于SoA架构：每个特征都对应一个连续的维度。

### 软件预取技术

- 可以让CPU在数据被实际使用之前就开始加载它，从而避免内存延迟的问题。

```cpp
#include <xmmintrin.h>  // for _mm_prefetch

for (int i = 0; i < n; i += 4) {
    _mm_prefetch((char*)(a + i + 64), _MM_HINT_T0);  // prefetch 64 elements ahead
    // process a[i:i+4] with SIMD
    __m128 va = _mm_load_ps(a + i);
    // ...
}
```

- 预取指令其实只是一种提示：如果数据已经存在于缓存中，那么该指令就不会执行任何操作；否则，CPU会在执行其他指令的同时在后台开始获取这些数据。预取的距离（本例中为64个元素）需要根据内存延迟以及循环迭代时间来调整。

### 内核融合

- **内核融合**是将多个操作合并为一个内核，从而避免将中间结果写入内存。这是对机器学习领域而言最有效的GPU优化手段。

```python
// UNFUSED: 3 kernel launches, 3 global memory round-trips
y = matmul(x, W)     // write y to global memory
z = y + bias          // read y, write z
out = relu(z)         // read z, write out

// FUSED: 1 kernel launch, 1 global memory write
out = fused_matmul_bias_relu(x, W, bias)  // y and z never leave SRAM
```

- 对于那些受内存限制的操作（如偏置相加、ReLU运算、层归一化操作），内存访问量是决定执行时间的关键因素。通过融合这些操作，可以完全消除内存访问带来的开销。PyTorch的`torch.compile`功能以及Triton框架能够自动或以很少的努力实现这种融合。

### 混合精度内核

- 使用较低精度的格式（FP16、BF16、INT8）进行计算，同时使用较高精度的格式（FP32）来进行结果累加，这样就能兼顾两者的优点。

```cpp
// Tensor Core: multiply FP16 matrices, accumulate in FP32
// Each Tensor Core instruction: D (FP32) = A (FP16) × B (FP16) + C (FP32)
nvcuda::wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);
```

- FP16的数据量是FP32的1/2，因此内存带宽（通常也是性能瓶颈）会提升一倍，同时缓存中可以存储的数据量也会增加一倍。Tensor Core处理FP16数据的速度是FP32的8到16倍，而CUDA核心的处理速度则更高。正因如此，混合精度训练（第6章）能够在几乎不损失精度的情况下，将训练速度提升2到3倍。

### 内存池分配器

- `cudaMalloc`的调用速度较慢（每次调用约1毫秒），因为它需要与GPU进行同步操作。在那些每轮迭代都会分配临时缓冲区的训练过程中，这种延迟会不断累积。

- **内存池**（PyTorch的缓存分配器、CUDA内存池）会预先分配一大块GPU内存，之后再从这块内存中分配所需空间，从而无需进行系统调用。

```python
# PyTorch does this automatically — but understanding why matters
# Each torch.empty() reuses memory from the pool, no cudaMalloc
temp = torch.empty(1024, 1024, device='cuda')  # microseconds, not milliseconds
```

- 这就是为什么PyTorch中的`torch.cuda.memory_allocated()`和`torch.cuda.max_memory_allocated()`数值不同的原因：前者表示当前实际使用的内存量，后者则表示内存使用的最大值（内存池中可能存储着比当前使用量更多的数据）。

### 基于性能分析的优化策略

- 不要盲目进行优化。首先进行性能分析，找出瓶颈所在，针对该瓶颈进行优化，然后再再次进行性能分析。Roofline模型（文件01）可以帮助判断瓶颈是出在内存方面还是计算能力方面：

- **内存受限**（运算强度较低）：优化数据布局、合并内核操作、使用更低精度的数据类型、提前加载数据。
- **计算能力受限**（运算强度较高）：使用Tensor Cores、提高并行度、采用更高效的指令集（如FMA）。
- **延迟受限**（并行度不足）：提高硬件占用率、减少寄存器使用量、启动更多线程。

- 大多数机器学习任务都存在**内存限制**的问题。有趣的是，更快的GPU（更高的FLOPS性能）往往并不能带来显著提升；相反，更快的内存（如HBM3相比HBM2e）则更有帮助。这就是为什么从A100升级到H100时，不仅仅是因为FLOPS性能的提升——H100的内存带宽也是A100的两倍。

## NVIDIA GPU系列

| 代号 | 发布年份 | 主要创新点 | 在人工智能领域的应用 |
| ------ || ---------- || ------------ || ---------------------- ||
| Pascal (P100) | 2016年 | HBM2内存、NVLink接口 | 第一款用于深度学习的GPU |
| Volta (V100) | 2017年 | **Tensor Cores**（支持混合精度的矩阵乘法运算） | 可实现FP16精度下的训练，TF32精度下性能可达125 TFLOPS |
| Ampere (A100) | 2020年 | TF32精度格式、稀疏性处理技术、第三代Tensor Cores | TF32精度下性能可达312 TFLOPS，结构稀疏比为2:4 |
| Hopper (H100) | 2022年 | **Transformer Engine**（支持FP8精度）、HBM3内存 | FP8精度下性能可达989 TFLOPS，具备动态精度切换功能 |
| Blackwell (B200) | 2024年 | 第二代Transformer Engine、NVLink 5接口 | FP4精度下性能可达2.5 PFLOPS，采用多芯片设计 |

- **Tensor Cores**是专门用于矩阵乘法运算的单元。单个Tensor Core指令即可在一个周期内完成4×4矩阵的乘法运算（D = A×B + C）。而普通的CUDA核心则需要64次FMA运算才能完成同样的任务。正是由于有了Tensor Cores，才使得混合精度训练（用float16进行运算，用float32进行结果累加）成为可能，从而提升了训练速度。

- **Transformer Engine**（Hopper+版本）能够在单个层内动态地在FP8和FP16精度之间切换，只有在必要时才会使用更高精度。这样既提升了处理效率，又不会影响模型质量。该技术专为现代人工智能中常用的Transformer架构（包含注意力机制和MLP结构）而设计。

## 编程任务（使用nvcc编译）

1. 编写一个CUDA内核，用于对数组应用ReLU函数。同时测量包括内存传输在内的整个处理过程所需的时间。通过这个练习，可以了解如何编写CUDA内核、使用cudaMalloc/cudaMemcpy函数，以及理解主机与设备之间的数据传输瓶颈问题。

```cpp
// task1_relu.cu
// Compile: nvcc -O3 -o task1_relu task1_relu.cu

#include <stdio.h>
#include <stdlib.h>
#include <cuda_runtime.h>

__global__ void relu_kernel(const float* input, float* output, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        output[idx] = input[idx] > 0.0f ? input[idx] : 0.0f;
    }
}

int main() {
    const int N = 1 << 24;  // ~16M elements
    size_t bytes = N * sizeof(float);

    // Allocate host memory
    float* h_input  = (float*)malloc(bytes);
    float* h_output = (float*)malloc(bytes);
    for (int i = 0; i < N; i++) {
        h_input[i] = (float)(i % 100) - 50.0f;  // mix of positive and negative
    }

    // Allocate device memory
    float *d_input, *d_output;
    cudaMalloc(&d_input, bytes);
    cudaMalloc(&d_output, bytes);

    // Time the full pipeline: copy to GPU, compute, copy back
    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);

    cudaEventRecord(start);
    cudaMemcpy(d_input, h_input, bytes, cudaMemcpyHostToDevice);

    int block_size = 256;
    int grid_size = (N + block_size - 1) / block_size;
    relu_kernel<<<grid_size, block_size>>>(d_input, d_output, N);

    cudaMemcpy(h_output, d_output, bytes, cudaMemcpyDeviceToHost);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);

    float ms = 0;
    cudaEventElapsedTime(&ms, start, stop);

    // Verify
    int errors = 0;
    for (int i = 0; i < N; i++) {
        float expected = h_input[i] > 0.0f ? h_input[i] : 0.0f;
        if (h_output[i] != expected) errors++;
    }

    printf("Time (including transfers): %.2f ms\n", ms);
    printf("Bandwidth: %.1f GB/s\n", 2.0 * bytes / ms / 1e6);  // read + write
    printf("Errors: %d / %d\n", errors, N);

    cudaFree(d_input); cudaFree(d_output);
    free(h_input); free(h_output);
    return 0;
}
```

1. 使用共享内存在CUDA中实现分块矩阵乘法，并将其性能与传统的非分块实现方式进行比较。通过此练习可以了解共享内存、`__syncthreads`指令的作用，以及为何需要采用分块处理方式。

```cpp
// task2_matmul.cu
// Compile: nvcc -O3 -o task2_matmul task2_matmul.cu

#include <stdio.h>
#include <cuda_runtime.h>

#define TILE 16

// Naive matmul: each thread computes one element of C
__global__ void matmul_naive(const float* A, const float* B, float* C, int N) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    if (row < N && col < N) {
        float sum = 0.0f;
        for (int k = 0; k < N; k++) {
            sum += A[row * N + k] * B[k * N + col];
        }
        C[row * N + col] = sum;
    }
}

// Tiled matmul: use shared memory to reduce global memory accesses
__global__ void matmul_tiled(const float* A, const float* B, float* C, int N) {
    __shared__ float sA[TILE][TILE];
    __shared__ float sB[TILE][TILE];

    int row = blockIdx.y * TILE + threadIdx.y;
    int col = blockIdx.x * TILE + threadIdx.x;
    float sum = 0.0f;

    for (int t = 0; t < (N + TILE - 1) / TILE; t++) {
        sA[threadIdx.y][threadIdx.x] = (row < N && t*TILE+threadIdx.x < N)
            ? A[row * N + t*TILE + threadIdx.x] : 0.0f;
        sB[threadIdx.y][threadIdx.x] = (t*TILE+threadIdx.y < N && col < N)
            ? B[(t*TILE + threadIdx.y) * N + col] : 0.0f;

        __syncthreads();
        for (int k = 0; k < TILE; k++)
            sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];
        __syncthreads();
    }

    if (row < N && col < N)
        C[row * N + col] = sum;
}

int main() {
    const int N = 1024;
    size_t bytes = N * N * sizeof(float);

    float *d_A, *d_B, *d_C;
    cudaMalloc(&d_A, bytes); cudaMalloc(&d_B, bytes); cudaMalloc(&d_C, bytes);

    // Initialise with ones (easy to verify: C should be all N)
    float* h_A = new float[N*N];
    for (int i = 0; i < N*N; i++) h_A[i] = 1.0f;
    cudaMemcpy(d_A, h_A, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_B, h_A, bytes, cudaMemcpyHostToDevice);

    dim3 block(TILE, TILE);
    dim3 grid((N+TILE-1)/TILE, (N+TILE-1)/TILE);

    // Benchmark naive
    cudaEvent_t start, stop;
    cudaEventCreate(&start); cudaEventCreate(&stop);

    cudaEventRecord(start);
    for (int i = 0; i < 10; i++)
        matmul_naive<<<grid, block>>>(d_A, d_B, d_C, N);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float naive_ms; cudaEventElapsedTime(&naive_ms, start, stop);

    // Benchmark tiled
    cudaEventRecord(start);
    for (int i = 0; i < 10; i++)
        matmul_tiled<<<grid, block>>>(d_A, d_B, d_C, N);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float tiled_ms; cudaEventElapsedTime(&tiled_ms, start, stop);

    double gflops_naive = 2.0 * N * N * N * 10 / naive_ms / 1e6;
    double gflops_tiled = 2.0 * N * N * N * 10 / tiled_ms / 1e6;

    printf("Naive:  %.2f ms, %.1f GFLOPS\n", naive_ms/10, gflops_naive);
    printf("Tiled:  %.2f ms, %.1f GFLOPS\n", tiled_ms/10, gflops_tiled);
    printf("Speedup: %.1fx\n", naive_ms / tiled_ms);

    cudaFree(d_A); cudaFree(d_B); cudaFree(d_C);
    delete[] h_A;
    return 0;
}
```

1. 演示warp分支现象。编写一个内核，使得同一warp中的线程走不同的分支路径，然后将其与没有分支结构的版本进行比较。

```cpp
// task3_divergence.cu
// Compile: nvcc -O3 -o task3_diverge task3_divergence.cu

#include <stdio.h>
#include <cuda_runtime.h>

// BAD: warp divergence — even/odd threads take different paths
__global__ void divergent_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        if (idx % 2 == 0) {
            data[idx] = data[idx] * 2.0f + 1.0f;
        } else {
            data[idx] = data[idx] * 0.5f - 1.0f;
        }
    }
}

// GOOD: branchless — all threads execute the same instruction
__global__ void branchless_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        float scale = (idx % 2 == 0) ? 2.0f : 0.5f;
        float offset = (idx % 2 == 0) ? 1.0f : -1.0f;
        data[idx] = data[idx] * scale + offset;
    }
}

int main() {
    const int N = 1 << 24;
    float* d_data;
    cudaMalloc(&d_data, N * sizeof(float));
    cudaMemset(d_data, 0, N * sizeof(float));

    int block = 256, grid = (N + block - 1) / block;

    cudaEvent_t start, stop;
    cudaEventCreate(&start); cudaEventCreate(&stop);

    // Divergent
    cudaEventRecord(start);
    for (int i = 0; i < 100; i++)
        divergent_kernel<<<grid, block>>>(d_data, N);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float div_ms; cudaEventElapsedTime(&div_ms, start, stop);

    // Branchless
    cudaEventRecord(start);
    for (int i = 0; i < 100; i++)
        branchless_kernel<<<grid, block>>>(d_data, N);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float nodiv_ms; cudaEventElapsedTime(&nodiv_ms, start, stop);

    printf("Divergent:  %.2f ms\n", div_ms / 100);
    printf("Branchless: %.2f ms\n", nodiv_ms / 100);
    printf("Speedup:    %.2fx\n", div_ms / nodiv_ms);

    cudaFree(d_data);
    return 0;
}
```

## Triton与TPU

_CUDA C功能强大，但代码较为繁琐。Triton允许人们用Python来编写GPU内核。TPU则提供了另一种替代方案，不过其性能与成本特点有所不同。本文件介绍了Triton内核编程、以Flash Attention为案例的研究、TPU架构以及JAX/Pallas相关内容，还讲述了如何选择合适的工具。关于Vulkan及跨平台GPU计算的相关内容，请参阅文件07。_

- 上一份文件介绍了使用CUDA C进行GPU编程的方法。而本文件则进一步提升了抽象层次：通过Triton，人们可以用Python实现相当于CUDA80%的性能，同时仅需付出20%的精力。对于特定的应用场景，TPU和Vulkan则提供了其他可选的硬件方案。

## Triton：用Python编写GPU内核

- **Triton**（由OpenAI开发）是一种基于Python的语言，可用于编写GPU内核。与CUDA需要针对单个线程进行操作不同，Triton允许人们以数据块为单位来处理任务。Triton的编译器会自动处理线程映射、内存整合、共享内存管理以及各种优化工作。

- **为何Triton如此重要**：使用CUDA C时，开发者需要深入理解线程调度、共享内存冲突、寄存器占用情况以及内存整合模式等问题。而Tron则将这些问题抽象掉了，使得那些熟悉Python但不懂系统编程的机器学习研究人员也能轻松开发GPU内核。

### 你的第一个Triton内核

```python
import triton
import triton.language as tl
import torch

@triton.jit
def add_kernel(
    x_ptr, y_ptr, output_ptr,
    n_elements,
    BLOCK_SIZE: tl.constexpr,  # compile-time constant
):
    # Each program instance processes one block of BLOCK_SIZE elements
    pid = tl.program_id(axis=0)  # which block am I?
    block_start = pid * BLOCK_SIZE

    # Offsets for this block
    offsets = block_start + tl.arange(0, BLOCK_SIZE)

    # Mask to handle the case where n_elements is not a multiple of BLOCK_SIZE
    mask = offsets < n_elements

    # Load data (masked: out-of-bounds reads return 0)
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)

    # Compute
    output = x + y

    # Store result
    tl.store(output_ptr + offsets, output, mask=mask)

def add(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    output = torch.empty_like(x)
    n_elements = output.numel()

    # Launch: one program per block
    grid = lambda meta: (triton.cdiv(n_elements, meta['BLOCK_SIZE']),)
    add_kernel[grid](x, y, output, n_elements, BLOCK_SIZE=1024)

    return output

# Usage
x = torch.randn(1000000, device='cuda')
y = torch.randn(1000000, device='cuda')
z = add(x, y)
```

- **与CUDA的主要区别**：
- 无需手动进行线程管理。编程时是以**块**（即程序单元）为单位来思考的，而非单个线程。
- `tl.arange(0, BLOCK_SIZE)`会为整个块生成一个偏移量向量；对该向量的所有操作都会被自动转换为向量化操作。
- `mask`用于处理边界条件（类似于AVX-512中的掩码寄存器，参见文件03）；无需额外的标量处理循环。
- `tl.load`和`tl.store`会自动处理连续内存访问的需求。
- `@triton.jit`会在首次调用时将函数编译为PTX格式（GPU汇编语言），之后会将编译好的内核缓存起来。

### Triton的Softmax内核

- Softmax是Triton的一个典型应用案例，因为它需要对数据进行多次处理（求最大值、减法运算、指数运算、求和、除法运算），而且将数据存储在SRAM中（共享内存）能够在各次处理之间提高效率。

```python
@triton.jit
def softmax_kernel(
    output_ptr, input_ptr, input_row_stride, output_row_stride, n_cols,
    BLOCK_SIZE: tl.constexpr,
):
    # Each program handles one row
    row_idx = tl.program_id(0)
    row_start = input_ptr + row_idx * input_row_stride

    # Load the row
    col_offsets = tl.arange(0, BLOCK_SIZE)
    mask = col_offsets < n_cols
    row = tl.load(row_start + col_offsets, mask=mask, other=-float('inf'))

    # Softmax: max for numerical stability, then exp, then normalise
    row_max = tl.max(row, axis=0)
    numerator = tl.exp(row - row_max)
    denominator = tl.sum(numerator, axis=0)
    softmax_output = numerator / denominator

    # Store result
    output_start = output_ptr + row_idx * output_row_stride
    tl.store(output_start + col_offsets, softmax_output, mask=mask)
```

- 在PyTorch中，`F.softmax(x, dim=-1)`会启动3个独立的核函数（最大值计算、指数运算与求和、除法运算），这些核函数都需要从全局内存中读取数据并往其中写入数据。而Triton版本则能在同一个核函数中完成所有操作，从而将数据保留在寄存器/SRAM中。正是这种**核函数融合技术**，使得自定义的Triton核函数的运行速度比PyTorch的内置操作快2到4倍。

### Triton自动调优功能

- Triton支持**自动调优**功能：可以尝试多种配置，进而选出速度最快的那一种。

```python
@triton.autotune(
    configs=[
        triton.Config({'BLOCK_SIZE_M': 128, 'BLOCK_SIZE_N': 128, 'BLOCK_SIZE_K': 32}),
        triton.Config({'BLOCK_SIZE_M': 64, 'BLOCK_SIZE_N': 256, 'BLOCK_SIZE_K': 32}),
        triton.Config({'BLOCK_SIZE_M': 256, 'BLOCK_SIZE_N': 64, 'BLOCK_SIZE_K': 64}),
    ],
    key=['M', 'N', 'K'],  # re-tune when these change
)
@triton.jit
def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K, ...):
    ...
```

- Triton会在实际硬件上对每种配置进行测试，并选出性能最佳的方案。最优的块大小取决于GPU架构、矩阵维度以及内存布局——通过自动调优即可确定这些参数，无需手动试验。

### Triton与CUDA：何时选择哪种技术

|                | Triton                                | CUDA C                             |
| -------------- | ------------------------------------- | ---------------------------------- |
| 语言           | Python                                | C/C++                              |
| 抽象层次       | 块级                                  | 线程级                             |
| 开发速度       | 快（每个核函数仅需10-50行代码）       | 慢（需要100-500行代码）            |
| 性能上限       | 达到手动调优后的CUDA性能的80-95%      | 可达到100%的硬件性能               |
| 共享内存管理   | 自动处理                              | 需手动设置                         |
| 数据合并功能   | 自动完成                              | 需手动操作                         |
| 线程级操作指令 | 有限                                  | 全面支持（如数据重排、投票等操作） |
| 硬件支持       | 仅NVIDIA芯片（AMD芯片尚处于实验阶段） | 仅NVIDIA芯片                       |

- **选择Triton的情况**：适用于融合核函数、自定义注意力机制、激活函数，以及大多数机器学习研究中的核函数需求。
- **选择CUDA C的情况**：需要在追求最高性能时使用（即提升最后5-20%的性能）、使用线程级操作指令、处理复杂的依赖数据的并行计算任务，或者当Triton无法实现某种特定算法结构时。

## 案例研究：Flash Attention

- **Flash Attention**（Dao等人，2022年提出）是近年来最具影响力的自定义核函数。它采用$O(n)$的内存复杂度来计算注意力值，而非传统的$O(n^2)$复杂度，因此能够处理更长的序列。

- **存在的问题**：传统的注意力计算方法需要先计算$\text{softmax}(QK^T / \sqrt{d}) \cdot V$。其中$QK^T$矩阵的尺寸为$n \times n$，$n$为序列长度。当$n = 128K$时，该矩阵的体积为$128K \times 128K \times 4$字节，相当于64GB，远远超过GPU内存的容量。

- **解决方案**：无需完整生成整个$n \times n$矩阵。可以通过分块的方式来计算注意力值：每次加载一部分$Q$矩阵和一部分$K$矩阵，计算它们之间的部分注意力得分，再将这些得分累加起来，之后再处理下一块数据。这样，$n \times n$矩阵就永远不会被完全加载到内存中——SRAM中同时存在的只有一块数据。

- **在线软阈值函数**：最棘手的部分就是软阈值函数的计算，因为为了保证数值稳定性，需要知道整行的最大值。Flash Attention采用了“在线软阈值函数”技术：通过维护一个当前最大值，在出现新的最大值时重新调整之前计算出的数值。这样一来，软阈值函数就可以逐块地逐步计算出来。

- 算法流程：

```text
For each block of Q rows:
    For each block of K columns:
        1. Load Q_block from HBM to SRAM
        2. Load K_block from HBM to SRAM
        3. Compute S_block = Q_block @ K_block.T (in SRAM)
        4. Update running max, rescale previous results
        5. Compute exp(S_block - running_max)
        6. Update running sum and output accumulator
    Load V_block and compute final output
    Write output block back to HBM
```

- **为何速度如此之快**：内部循环完全在SRAM（共享内存）中执行。全局内存（HBM）仅用于加载Q、K、V这些数据块以及存储最终输出结果。数据重用率与SRAM的容量成正比，而SRAM的访问速度大约是HBM的100倍。

- Flash Attention机制在Triton和CUDA C中都有实现。CUDA版本的效率更高（快约10%），但Triton版本的代码更易于理解和修改，这对于研究新的注意力机制非常重要。

## TPU架构

- **TPU**（张量处理单元）是谷歌开发的专用机器学习加速器。它的设计理念与GPU截然不同：

- **脉动阵列结构**：TPU的核心计算单元是**矩阵乘法单元（MXU）**，这是一种128×128或256×256结构的脉动阵列，通过让数据在一系列乘法-累加单元之间流动来实现矩阵乘法运算。数据从阵列的边缘进入，然后逐个单元进行一次乘法-加法运算，再将结果传递给下一个单元。

- 与需要调度数千个独立线程的GPU不同，脉动阵列采用单一的、确定性的数据流处理方式。不存在线程调度、指令分支等问题。正是这种简单性使得MXU在矩阵乘法运算中具有极高的能效。

- **HBM**：TPU也使用与GPU相同的高带宽内存。TPU v5e每颗芯片拥有16GB的HBM2e内存；而TPU v5p则拥有95GB的HBM2e内存。

- **芯片间互连技术**：TPU集群通过定制的高速网络将数百个TPU连接在一起。JAX框架能够原生支持在TPU集群之间实现数据并行和模型并行处理。

- **BFloat16格式**：TPU是最早采用bfloat16格式的硬件（详见第13章，文件02）。BFloat16的指数范围与float32相同，因此可以避免训练过程中的数值溢出问题，不过其小数部分的精度较低。这种权衡非常适合机器学习应用，因为梯度值虽然范围很广，但并不需要23位的精度。

### TPU的编程方式：JAX与Pallas

- TPU的编程是通过**JAX**和**XLA**来实现的。用户先编写Python/JAX代码，再通过`jax.jit`将其编译为XLA HLO格式，最后由XLA将其转换为针对TPU的特定指令。无需使用CUDA或C++语言。

```python
import jax
import jax.numpy as jnp

@jax.jit
def matmul(a, b):
    return jnp.dot(a, b)

# This runs on CPU, GPU, or TPU depending on the device
a = jnp.ones((1024, 1024))
b = jnp.ones((1024, 1024))
c = matmul(a, b)
```

- **Pallas**是JAX用于编写内核的API——相当于Triton在JAX中的对应工具。它允许用户编写低级内核，这些内核随后会由XLA编译为可在GPU或TPU上运行的代码：

```python
from jax.experimental import pallas as pl
import jax.numpy as jnp

def add_kernel(x_ref, y_ref, o_ref):
    o_ref[...] = x_ref[...] + y_ref[...]

def add_pallas(x, y):
    return pl.pallas_call(
        add_kernel,
        out_shape=jax.ShapeDtypeStruct(x.shape, x.dtype),
        grid=(x.shape[0] // 128,),
        in_specs=[pl.BlockSpec((128,), lambda i: (i,)),
                  pl.BlockSpec((128,), lambda i: (i,))],
        out_specs=pl.BlockSpec((128,), lambda i: (i,)),
    )(x, y)
```

- Pallas相比Triton更为新，成熟度也较低，但它是为TPU编写自定义内核的唯一途径（因为TPU不支持CUDA）。

### GPU与TPU的对比

|                  | GPU（NVIDIA）                                      | TPU（Google）                       |
| ---------------- | -------------------------------------------------- | ----------------------------------- |
| 可用性           | 任何云平台或本地环境                               | 仅限Google Cloud                    |
| 编程语言         | CUDA C、Triton、PyTorch                            | JAX/XLA、Pallas                     |
| 灵活性           | 通用计算功能                                       | 针对大量矩阵运算的机器学习任务优化  |
| 矩阵乘法运算速度 | 非常高（得益于Tensor Cores架构）                   | 非常高（得益于MXU架构）             |
| 非矩阵运算速度   | 较好                                               | 较慢（需通过向量单元处理，而非MXU） |
| 多芯片扩展能力   | NVLink技术可连接8块GPU，InfiniBand技术也可实现扩展 | ICI技术可实现数千块TPU的紧密集成    |
| 成本效益         | 具有竞争力                                         | 在大规模训练场景下通常更便宜        |
| 生态系统         | 最为完善（包括PyTorch、TensorFlow、JAX等框架）     | 以JAX为主                           |

- **适合使用GPU的场景**：大多数机器学习任务、基于PyTorch的研究工作、推理服务，以及那些包含大量非矩阵运算的任务。
- **适合使用TPU的场景**：大规模的JAX训练任务（需要数千块TPU）、在Google Cloud上开展成本敏感型的训练任务，以及以矩阵乘法为主的计算任务。

## 如何选择合适的工具

| 任务类型 | 最佳工具 | 原因 |
| ---------- || ----------- || ----- ||
| 机器学习训练（使用PyTorch） | NVIDIA GPU + CUDA/Triton | 生态系统最为完善，工具链最强大 |
| 机器学习训练（使用JAX且规模较大） | TPU或NVIDIA GPU | 在Google Cloud环境下，TPU能降低成本；GPU则具备更高的灵活性 |
| 自定义融合内核开发 | Triton（Python）或CUDA C | Triton有助于加快开发速度，CUDA则能实现更高的性能 |
| JAX自定义内核开发 | Pallas | 这是唯一适用于TPU的工具，同时也能在GPU上运行 |
| 跨平台推理 | Vulkan（文件07）或ONNX Runtime | 可在任何GPU厂商的设备上运行 |
| 移动端/边缘设备推理 | Apple的Metal技术、Android的Vulkan技术、NNAPI | 各平台都有专门的加速器 |
| 浏览器中的推理 | WebGPU（文件07） | 这是浏览器中唯一的可行方案 |
| 仅使用CPU的推理 | ONNX Runtime + AVX/NEON指令集 | 不需要GPU，可利用SIMD指令集（相关内容见文件02-03） |
| 新型硬件上的推理 | 各厂商提供的专用SDK | 不同的加速器都有其对应的工具链 |

## 编码任务（建议使用带有GPU运行环境的CoLab）

1. 编写并运行一个用于向量加法的Triton内核，然后将其性能与PyTorch内置的加法功能进行比较。

```python
import triton
import triton.language as tl
import torch
import time

@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    x = tl.load(x_ptr + offs, mask=mask)
    y = tl.load(y_ptr + offs, mask=mask)
    tl.store(out_ptr + offs, x + y, mask=mask)

n = 10_000_000
x = torch.randn(n, device='cuda')
y = torch.randn(n, device='cuda')

# Triton
out_triton = torch.empty_like(x)
grid = lambda meta: (triton.cdiv(n, meta['BLOCK']),)
add_kernel[grid](x, y, out_triton, n, BLOCK=1024)

# PyTorch
out_torch = x + y

# Verify correctness
assert torch.allclose(out_triton, out_torch, atol=1e-5)

# Benchmark
torch.cuda.synchronize()
start = time.time()
for _ in range(1000):
    add_kernel[grid](x, y, out_triton, n, BLOCK=1024)
torch.cuda.synchronize()
triton_time = (time.time() - start) / 1000

start = time.time()
for _ in range(1000):
    out_torch = x + y
torch.cuda.synchronize()
torch_time = (time.time() - start) / 1000

print(f"Triton:  {triton_time*1000:.3f} ms")
print(f"PyTorch: {torch_time*1000:.3f} ms")
print(f"Ratio:   {torch_time/triton_time:.2f}x")
```

1. 编写一个基于Triton的融合内核，使其能够在单次运算中完成乘法、加法以及ReLU操作。并将该内核的性能与三种独立的PyTorch操作进行比较。

```python
import triton
import triton.language as tl
import torch
import time

@triton.jit
def fused_mul_add_relu_kernel(x_ptr, w_ptr, b_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    x = tl.load(x_ptr + offs, mask=mask)
    w = tl.load(w_ptr + offs, mask=mask)
    b = tl.load(b_ptr + offs, mask=mask)
    result = tl.maximum(x * w + b, 0.0)  # fused: mul + add + relu
    tl.store(out_ptr + offs, result, mask=mask)

n = 10_000_000
x = torch.randn(n, device='cuda')
w = torch.randn(n, device='cuda')
b = torch.randn(n, device='cuda')

# Fused (Triton)
out_fused = torch.empty_like(x)
grid = lambda meta: (triton.cdiv(n, meta['BLOCK']),)
fused_mul_add_relu_kernel[grid](x, w, b, out_fused, n, BLOCK=1024)

# Unfused (PyTorch)
out_unfused = torch.relu(x * w + b)

assert torch.allclose(out_fused, out_unfused, atol=1e-5)

# Benchmark
torch.cuda.synchronize()
start = time.time()
for _ in range(1000):
    fused_mul_add_relu_kernel[grid](x, w, b, out_fused, n, BLOCK=1024)
torch.cuda.synchronize()
fused_time = (time.time() - start) / 1000

start = time.time()
for _ in range(1000):
    out_unfused = torch.relu(x * w + b)
torch.cuda.synchronize()
unfused_time = (time.time() - start) / 1000

print(f"Fused (Triton):    {fused_time*1000:.3f} ms")
print(f"Unfused (PyTorch): {unfused_time*1000:.3f} ms")
print(f"Speedup:           {unfused_time/fused_time:.2f}x")
```

1. 测量JAX的XLA编译器是如何自动合并各种运算的。比较有即时编译功能与没有该功能时的运算流程。

```python
import jax
import jax.numpy as jnp
import time

def chain_ops(x):
    x = x * 2.0
    x = x + 1.0
    x = jnp.maximum(x, 0.0)  # ReLU
    x = x / jnp.sum(x)
    return x

chain_jit = jax.jit(chain_ops)
x = jax.random.normal(jax.random.PRNGKey(0), (10000, 1000))

# Warm up
_ = chain_jit(x)
jax.block_until_ready(_)

# Eager (each op is a separate kernel launch)
start = time.time()
for _ in range(100):
    y = chain_ops(x)
jax.block_until_ready(y)
eager_time = (time.time() - start) / 100

# JIT (XLA fuses operations)
start = time.time()
for _ in range(100):
    y = chain_jit(x)
jax.block_until_ready(y)
jit_time = (time.time() - start) / 100

print(f"Eager: {eager_time*1000:.2f} ms")
print(f"JIT:   {jit_time*1000:.2f} ms")
print(f"Speedup: {eager_time/jit_time:.1f}x (XLA fuses the 4 operations into 1 kernel)")
```

## RISC-V与嵌入式系统

_RISC-V是一种开源的指令集架构，正在重塑芯片行业。本文档涵盖了RISC-V的设计理念、V向量扩展功能、嵌入式机器学习推理技术、微控制器上的TinyML应用、RISC-V在AI加速器中的运用，以及边缘设备部署时需要考虑的限制条件。_

- 我们之前介绍过的所有芯片架构（x86、ARM）都需要支付许可费。英特尔和AMD为x86架构支付许可费，而苹果、高通以及各类智能手机制造商则每年要向ARM支付数十亿美元。**RISC-V则不同**：它属于开放标准，任何人都可以设计、制造并销售基于RISC-V的芯片，无需向任何方支付专利使用费。这一特点正在改变芯片设计的商业模式，尤其是在AI领域。

## RISC-V的设计理念

- RISC-V于2010年在加州大学伯克利分校诞生，旨在打造一种简洁、现代化的RISC指令集。其核心原则如下：

- **开放标准**：该指令集的规范是公开可用的。人们无需支付许可费、签署保密协议或遵守任何法律条款，就可以开发RISC-V CPU。这就像Linux操作系统一样——任何人都可以使用、修改它，甚至在此基础上进行开发。

- **模块化设计**：基础的指令集（RV32I或RV64I）非常简单，仅有47条指令。其余的功能都是可选的**扩展模块**，包括用于乘除运算的M模块、用于原子操作的A模块、用于浮点运算的F/D模块、用于压缩指令的C模块，以及用于向量处理的V模块。用户可以根据需求选择所需的模块，从而让芯片更加小巧且高效。

- **没有过时的遗留问题**：x86架构需要支持45年的向后兼容性，ARM则需支持35年。而RISC-V从一开始就采用简洁的设计，同时借鉴了这两种架构的优点。它没有那些仅为兼容1980年代的软件而存在的复杂指令。

- **哪些公司在使用RISC-V**：SiFive公司使用RISC-V来设计通用处理器核心；阿里巴巴则将其用于Xuantie服务器芯片中；西部数据公司则利用RISC-V来制造存储控制器，这类产品已大量投放市场；Espressif公司则在其ESP32-C3这款流行的物联网芯片中采用了RISC-V架构。此外，还有许多AI加速器初创企业也使用RISC-V作为其自定义计算单元的控制处理器。

## RISC-V的基础架构

- 基础的整数指令集（64位版本为RV64I）具有以下特点：
- **32个通用寄存器**（x0至x31，每个寄存器的宽度为64位）。x0寄存器的值始终为0，这一设计有助于在没有特殊指令的情况下实现各种常见操作。
- **固定的32位指令宽度**（通过C扩展模块，还可以添加16位的压缩指令，以提高代码的密度）。
- **加载/存储架构**：与ARM类似，算术运算只能在寄存器之间进行，内存访问则需通过专门的加载/存储指令来实现。

```text
# RISC-V assembly (for flavour — you will use C/C++)
add  x3, x1, x2      # x3 = x1 + x2
lw   x4, 0(x5)       # load word from address in x5
sw   x4, 8(x5)       # store word to address x5 + 8
beq  x1, x2, label   # branch if x1 == x2
```

- 由于其指令集的简单性，RISC-V核心体积小且能耗低。一个最简单的RV32I核心仅需约10,000个逻辑门即可实现（而ARM Cortex-M0则需要约12,000个逻辑门）。对于那些每一毫瓦的能耗、每一平方毫米的芯片面积都至关重要的嵌入式系统而言，这一点非常重要。

## V扩展：RISC-V向量处理功能

- **V扩展**为RISC-V增加了可扩展的向量处理功能，其原理类似于ARM的SVE。向量寄存器的长度是可配置的，具体数值由硬件决定，范围在128位到65,536位之间。所编写的代码无需重新编译即可适用于任何长度的向量寄存器。

```c
#include <riscv_vector.h>

// Vector addition using RVV intrinsics
void vadd_rvv(const float* a, const float* b, float* c, int n) {
    while (n > 0) {
        // vsetvl: set vector length — processes min(n, hardware_max) elements
        size_t vl = __riscv_vsetvl_e32m1(n);

        // Load vl elements
        vfloat32m1_t va = __riscv_vle32_v_f32m1(a, vl);
        vfloat32m1_t vb = __riscv_vle32_v_f32m1(b, vl);

        // Add
        vfloat32m1_t vc = __riscv_vfadd_vv_f32m1(va, vb, vl);

        // Store
        __riscv_vse32_v_f32m1(c, vc, vl);

        // Advance pointers
        a += vl; b += vl; c += vl; n -= vl;
    }
}
```

- **`vsetvl`**是关键指令。它告诉硬件“我需要处理这么多个元素”，硬件则会回应“我可以处理这么多个元素”（处理数量受VLEN限制）。该循环能够自动适应不同的向量宽度，无需进行任何标量处理操作（最后一次迭代时只需处理较少的元素即可）。

- **LMUL**（长度乘法器）：RVV架构允许将多个向量寄存器组合在一起（如m1、m2、m4、m8），从而在每条指令中处理更多元素，但相应地可用的寄存器数量会减少。`m1`每个向量操作数需要一个寄存器；而`m8`则需要八个寄存器，这样虽然能处理8倍多的元素，但可用的寄存器组却只有4组。

- 与x86的AVX架构（固定为256/512位）以及ARM的NEON架构（固定为128位）相比，RVV架构的可扩展性是其优势所在——同样的代码既可以在小型嵌入式处理器上运行（VLEN=128），也可以在高性能服务器处理器上运行（VLEN=1024+）。

## 嵌入式机器学习：TinyML

- **TinyML**指的是在微控制器上实现的机器学习技术。这类设备的RAM容量仅为几KB，CPU性能为兆赫级，功耗则仅为毫瓦级。例如，那些能够识别特定关键词的传感器、“嘿Siri”功能、用于识别手势的加速度计，或是用于统计人数的摄像头，所有这些功能都可以通过成本仅为0.50美元且无需网络连接的芯片来实现。

- 这些设备的资源限制极为严格：

| 资源类型 | 服务器GPU | 智能手机 | 微控制器 |
| ---------- || ----------- || ------------ || ----------------- ||
| RAM容量 | 80 GB | 6 GB | 256 KB |
| 存储容量 | TB级 | 128 GB | 1 MB |
| 计算能力 | 1000 TFLOPS | 10 TFLOPS | 0.001 TFLOPS |
| 功耗 | 700 W | 5 W | 0.001 W |
| 成本 | 30,000美元 | 500美元 | 1美元 |

- 那种适合在服务器GPU上运行的模型（参数量约为$O(10^{10})$），是无法在微控制器上运行的。TinyML模型的参数量则在$O(10^4)$到$O(10^6)$之间，而且这些模型通常采用INT8甚至INT4格式进行量化处理。

### TensorFlow Lite Micro (TFLM)

- **TFLM**是谷歌专为微控制器设计的推理框架。它能够运行经过量化的TensorFlow Lite模型，无需动态内存分配，也不需要操作系统，其二进制文件大小约为20 KB。

```cpp
// TinyML inference on a microcontroller (simplified)
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"

// Model is compiled into a C array (const unsigned char model_data[])
const tflite::Model* model = tflite::GetModel(model_data);

// Allocate a fixed memory arena (no malloc!)
constexpr int kArenaSize = 10 * 1024;  // 10 KB
uint8_t tensor_arena[kArenaSize];

// Set up interpreter
tflite::MicroInterpreter interpreter(model, resolver, tensor_arena, kArenaSize);
interpreter.AllocateTensors();

// Set input
float* input = interpreter.input(0)->data.f;
input[0] = sensor_reading;

// Run inference
interpreter.Invoke();

// Read output
float* output = interpreter.output(0)->data.f;
if (output[0] > 0.8f) {
    trigger_alert();
}
```

- **该代码中的关键限制**：
- `tensor_arena`是静态分配的——没有使用`malloc`，也没有堆内存。嵌入式系统通常不具备动态内存分配功能。
- 模型为`const`字节数组，存储在闪存（ROM）中，而非从文件系统中加载。
- 整个框架、模型以及运行时代码的总大小仅为几十KB。

### 面向边缘设备的模型优化

要让模型在微控制器上运行，就需要进行大量的优化：

- **量化处理**（第18章）：将float32格式的权重转换为INT8格式（体积缩小4倍，且在仅支持整数运算的硬件上运算速度可提高2-4倍）。训练后的量化处理较为简单；而基于量化意识的训练则能更好地保留模型的精度。

- **剪枝**：删除接近零的权重值。结构化剪枝（删除整个通道或神经网络节点）比非结构化剪枝（随机设置权重为零）更有利于硬件运行，因为它能减少实际的计算量，而不仅仅是存储需求。

- **知识蒸馏**（第6章）：训练一个较小的“学生模型”，使其能够模仿较大的“教师模型”。由于学生模型可以学习到教师模型的预测结果，因此其精度会比从头开始训练的模型更高。

- **神经架构搜索（NAS）**：自动寻找符合硬件约束条件（延迟、内存、功耗等）的高效架构。**MicroNets**和**MCUNet**这类技术可用于找到针对特定微控制器优化的架构。

- **操作符融合**：将卷积操作、批量归一化操作以及ReLU操作合并为一个整体操作，从而避免不必要的中间数据存储（这一原理与GPU内核融合类似，但在只有256KB内存的情况下尤为重要）。

## RISC-V在AI加速器中的应用

许多AI加速器初创企业并未将RISC-V用于直接运行机器学习模型，而是将其作为**控制处理器**，用来管理各种自定义的计算单元。

```text
┌─────────────────────────────────────────┐
│              AI Accelerator             │
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │  RISC-V  │───→│  Custom Matrix   │   │
│  │  Control │    │  Multiply Unit   │   │
│  │  Core    │    │  (systolic array,│   │
│  │          │    │  custom dataflow)│   │
│  └──────────┘    └──────────────────┘   │
│       │                    │            │
│       ▼                    ▼            │
│  ┌──────────┐    ┌──────────────────┐   │
│  │  Memory  │    │  On-chip SRAM    │   │
│  │  Control │    │  (activation     │   │
│  │          │    │   buffer)        │   │
│  └──────────┘    └──────────────────┘   │
└─────────────────────────────────────────┘
```

- RISC-V核心负责：从外部内存加载模型权重、调度各计算单元的执行顺序、管理各计算单元之间的数据流，以及通过PCIe、USB或SPI与主机进行通信。而那些复杂的计算任务（如矩阵乘法、卷积运算）则由专用硬件来完成，而非RISC-V核心。

- **为何选择RISC-V作为控制核心**：无需支付许可费用（这对初创企业来说非常重要）；可定制性强（可添加针对特定应用领域的指令）；体积小（控制核心无需具备x86那样的复杂结构）；此外，其开放的生态系统还有助于快速进行原型开发。

- **实例**：Esperanto Technologies公司使用1000多个RISC-V核心来实现机器学习功能；Tenstorrent公司则采用RISC-V控制核心以及自研的tensix核心；SiFive公司则推出带有向量扩展功能的RISC-V核心，用于边缘机器学习应用。

## 边缘部署的约束条件

在边缘设备上部署机器学习模型时，会面临一些云部署所没有的约束：

- **功耗**：电池供电的设备其总功耗通常只有100毫瓦左右。如果某个模型需要50毫瓦的功耗，那么剩下的50毫瓦就只能用于其他系统组件（如传感器、无线模块、显示屏等）。因此，必须合理规划计算任务，以避免设备过热而影响性能，同时延长电池续航时间。

- **延迟**：边缘设备上的推理操作往往需要实时完成。例如，语音指令识别系统需要在大约200毫秒内做出响应；自动驾驶系统的感知模块则需要在30毫秒内处理完图像数据。而与云端进行数据传输所需的50-200毫秒时间显然无法满足这些应用的需求。

- **隐私性**：在设备本地处理数据意味着敏感信息（如医疗影像、语音记录、个人照片等）不会离开设备。这在某些地区是法律上的强制要求（如GDPR），同时也是用户所期望的。

- **连接性**：边缘设备可能处于断网状态或网络连接不稳定。因此，那些部署在火星探测器、潜艇或农村农场传感器上的模型必须能够完全离线运行。

- **大规模部署的成本**：如果要在10亿部智能手机上部署机器学习模型，每部设备的成本为0美元（因为相关的硬件已经存在）。而对于10亿个物联网传感器而言，每个传感器所需的机器学习硬件成本则仅为几美分。在这种情况下，RISC-V无需支付许可费用这一优势就显得尤为重要。

## 编程任务（使用g++或riscv64-gcc交叉编译器进行编译）

1. 编写一个C程序，模拟TinyML推理流程：为模型分配固定大小的内存空间，执行模拟的前向传播操作，并统计相关资源的消耗情况。这有助于了解嵌入式系统中的限制条件（如不能使用malloc函数，内存大小必须是固定的）。

```cpp
// task1_tinyml_sim.cpp
// Compile: g++ -O2 -o task1 task1_tinyml_sim.cpp

#include <iostream>
#include <chrono>
#include <cmath>
#include <cstring>

// Simulate a microcontroller: fixed memory arena, no dynamic allocation
static constexpr int ARENA_SIZE = 32 * 1024;  // 32 KB total RAM budget
static uint8_t arena[ARENA_SIZE];

// Simple 2-layer MLP: 784 -> 64 -> 10 (MNIST-like, INT8 weights)
struct TinyModel {
    int8_t w1[784 * 64];      // layer 1 weights: 50,176 bytes
    int8_t b1[64];             // layer 1 biases
    int8_t w2[64 * 10];       // layer 2 weights: 640 bytes
    int8_t b2[10];             // layer 2 biases
    // Total: ~51 KB → must go in flash (ROM), not RAM
};

// Check if model fits in flash
void check_model_fit(int flash_kb) {
    int model_bytes = sizeof(TinyModel);
    std::cout << "Model size: " << model_bytes << " bytes ("
              << model_bytes / 1024 << " KB)\n";
    std::cout << "Flash: " << flash_kb << " KB → "
              << (model_bytes <= flash_kb * 1024 ? "FITS" : "TOO LARGE") << "\n";
}

// Mock inference using the fixed arena for activations
void mock_inference(const int8_t* input, int8_t* output) {
    // Activations go in the arena (RAM), not allocated dynamically
    int8_t* act1 = (int8_t*)arena;            // 64 bytes for layer 1 output
    int8_t* act2 = (int8_t*)(arena + 64);     // 10 bytes for layer 2 output

    // Layer 1: simplified matmul (not real quantised matmul, just structure demo)
    for (int j = 0; j < 64; j++) {
        int32_t sum = 0;  // accumulate in int32 to avoid overflow
        for (int i = 0; i < 784; i++) {
            sum += (int32_t)input[i] * 1;  // mock: weight = 1
        }
        act1[j] = (int8_t)std::max(-128, std::min(127, sum / 784));  // quantise back
        act1[j] = act1[j] > 0 ? act1[j] : 0;  // ReLU
    }

    // Layer 2
    for (int j = 0; j < 10; j++) {
        int32_t sum = 0;
        for (int i = 0; i < 64; i++) {
            sum += (int32_t)act1[i] * 1;
        }
        act2[j] = (int8_t)std::max(-128, std::min(127, sum / 64));
    }

    std::memcpy(output, act2, 10);
}

int main() {
    std::cout << "=== TinyML Resource Budget ===\n";
    std::cout << "Arena (RAM): " << ARENA_SIZE << " bytes ("
              << ARENA_SIZE / 1024 << " KB)\n";
    check_model_fit(256);  // typical MCU flash

    // Activation memory used
    int activation_bytes = 64 + 10;  // layer 1 + layer 2 outputs
    std::cout << "Activation memory: " << activation_bytes
              << " bytes / " << ARENA_SIZE << " available\n\n";

    // Benchmark inference
    int8_t input[784];
    int8_t output[10];
    std::memset(input, 1, 784);

    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < 10000; i++) {
        mock_inference(input, output);
    }
    auto end = std::chrono::high_resolution_clock::now();
    double us = std::chrono::duration<double, std::micro>(end - start).count() / 10000;

    std::cout << "Inference latency: " << us << " us\n";
    std::cout << "At 160 MHz MCU (~6.25 ns/cycle): ~"
              << (int)(us * 160) << " cycles\n";

    std::cout << "Output logits: ";
    for (int i = 0; i < 10; i++) std::cout << (int)output[i] << " ";
    std::cout << "\n";

    return 0;
}
```

1. 编写一个C++程序，将float32类型的权重量化为INT8类型，并计算压缩比与量化误差。

```cpp
// task2_quantise.cpp
// Compile: g++ -O3 -o task2 task2_quantise.cpp

#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
#include <numeric>

// Symmetric quantisation: map float range [-max, +max] to [-127, +127]
void quantise_symmetric(const float* input, int8_t* output, int n, float& scale) {
    float max_val = 0.0f;
    for (int i = 0; i < n; i++) {
        max_val = std::max(max_val, std::abs(input[i]));
    }
    scale = max_val / 127.0f;
    for (int i = 0; i < n; i++) {
        float scaled = input[i] / scale;
        output[i] = (int8_t)std::max(-127.0f, std::min(127.0f, std::round(scaled)));
    }
}

// Dequantise: INT8 back to float
void dequantise(const int8_t* input, float* output, int n, float scale) {
    for (int i = 0; i < n; i++) {
        output[i] = (float)input[i] * scale;
    }
}

int main() {
    const int N = 100000;

    // Simulate random weights (roughly normal distribution)
    std::vector<float> weights(N);
    for (int i = 0; i < N; i++) {
        // Simple pseudo-random normal-ish values
        float u1 = (float)(i * 7 % 997 + 1) / 998.0f;
        float u2 = (float)(i * 13 % 991 + 1) / 992.0f;
        weights[i] = std::sqrt(-2.0f * std::log(u1)) * std::cos(6.2832f * u2) * 0.1f;
    }

    // Quantise
    std::vector<int8_t> quantised(N);
    float scale;
    quantise_symmetric(weights.data(), quantised.data(), N, scale);

    // Dequantise and measure error
    std::vector<float> reconstructed(N);
    dequantise(quantised.data(), reconstructed.data(), N, scale);

    float max_error = 0.0f, total_error = 0.0f;
    for (int i = 0; i < N; i++) {
        float err = std::abs(weights[i] - reconstructed[i]);
        max_error = std::max(max_error, err);
        total_error += err;
    }

    std::cout << "=== Quantisation Results ===\n";
    std::cout << "Original:    " << N * 4 << " bytes (float32)\n";
    std::cout << "Quantised:   " << N * 1 << " bytes (int8) + 4 bytes (scale)\n";
    std::cout << "Compression: " << 4.0f << "x\n";
    std::cout << "Scale factor: " << scale << "\n";
    std::cout << "Mean abs error: " << total_error / N << "\n";
    std::cout << "Max abs error:  " << max_error << "\n";
    std::cout << "Max abs error / scale: " << max_error / scale
              << " (should be <= 0.5 quantisation levels)\n";

    return 0;
}
```

1. 编写一个C++程序，实现使用INT32进行累加的INT8矩阵乘法运算——这正是嵌入式机器学习加速器中所执行的计算方式。

```cpp
// task3_int8_matmul.cpp
// Compile: g++ -O3 -o task3 task3_int8_matmul.cpp

#include <iostream>
#include <chrono>
#include <vector>
#include <cstdint>

// INT8 matmul with INT32 accumulation (what Tensor Cores and MCU accelerators do)
void matmul_int8(const int8_t* A, const int8_t* B, int32_t* C,
                 int M, int N, int K) {
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < N; j++) {
            int32_t sum = 0;
            for (int k = 0; k < K; k++) {
                sum += (int32_t)A[i * K + k] * (int32_t)B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

// Float32 matmul for comparison
void matmul_f32(const float* A, const float* B, float* C,
                int M, int N, int K) {
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < K; k++) {
                sum += A[i * K + k] * B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

int main() {
    const int M = 128, N = 128, K = 128;

    std::vector<int8_t> A_i8(M * K, 1), B_i8(K * N, 1);
    std::vector<int32_t> C_i32(M * N);

    std::vector<float> A_f32(M * K, 1.0f), B_f32(K * N, 1.0f);
    std::vector<float> C_f32(M * N);

    // Benchmark INT8
    auto start = std::chrono::high_resolution_clock::now();
    for (int t = 0; t < 100; t++) {
        matmul_int8(A_i8.data(), B_i8.data(), C_i32.data(), M, N, K);
    }
    auto end = std::chrono::high_resolution_clock::now();
    double i8_ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;

    // Benchmark FP32
    start = std::chrono::high_resolution_clock::now();
    for (int t = 0; t < 100; t++) {
        matmul_f32(A_f32.data(), B_f32.data(), C_f32.data(), M, N, K);
    }
    end = std::chrono::high_resolution_clock::now();
    double f32_ms = std::chrono::duration<double, std::milli>(end - start).count() / 100;

    double gflops_i8 = 2.0 * M * N * K / i8_ms / 1e6;
    double gflops_f32 = 2.0 * M * N * K / f32_ms / 1e6;

    std::cout << "INT8 matmul:  " << i8_ms << " ms (" << gflops_i8 << " GOPS)\n";
    std::cout << "FP32 matmul:  " << f32_ms << " ms (" << gflops_f32 << " GFLOPS)\n";
    std::cout << "INT8 speedup: " << f32_ms / i8_ms << "x\n";
    std::cout << "Memory: INT8 = " << M*K + K*N << " bytes vs FP32 = "
              << (M*K + K*N) * 4 << " bytes (4x less)\n";

    return 0;
}
```

## Vulkan计算与跨平台GPU

Vulkan是唯一能在所有主流平台上运行的GPU计算API：NVIDIA、AMD、Intel、苹果（通过MoltenVK）、Android，甚至浏览器（通过WebGPU）。本文档涵盖了Vulkan架构、计算管线、用GLSL编写计算着色器、GPU计算程序的完整C++设置、共享内存与同步机制、用于浏览器的WebGPU，以及实际的机器学习推理示例。

- CUDA在NVIDIA硬件上主导着机器学习训练。但并非所有部署目标都配备NVIDIA GPU。移动应用运行在Qualcomm Adreno或ARM Mali GPU上；网页应用则在浏览器中运行；游戏引擎需要同时支持AMD、Intel和NVIDIA。对于这些情况，**Vulkan**正是解决方案。

- Vulkan的语法较为繁琐——一个“Hello World”级别的计算程序就需要约300行C++代码。但这种繁琐正是**显式控制**的代价：你需要自行管理所有的GPU资源（内存、管线、命令缓冲区）。这种控制能够带来最高的性能和可移植性，不过是以开发速度为代价。

## Vulkan架构概述

Vulkan是由Khronos集团（OpenGL的创建者）开发的底层GPU API。与隐藏GPU资源管理细节的CUDA不同，Vulkan要求你显式地管理以下内容：

- **实例与设备**：创建Vulkan实例，枚举可用的GPU并选择其一。
- **内存**：显式分配GPU内存，并指定内存类型（为追求速度选用设备本地内存，为便于CPU访问选用主机可见内存）。
- **缓冲区**：创建引用已分配内存的缓冲区对象。
- **描述符集**：将缓冲区绑定到着色器输入（类似于计算着色器的函数参数）。
- **计算管线**：编译着色器并创建管线对象。
- **命令缓冲区**：记录一系列GPU命令（绑定管线、绑定描述符、调度计算）。
- **队列提交**：将命令缓冲区提交给GPU执行。
- **同步机制**：利用栅栏和屏障来确保正确的执行顺序。

这与CUDA的`cudaMalloc`+内核启动模式截然不同。在CUDA中，驱动程序会在后台处理大部分工作；而在Vulkan中，这一切都由开发者亲自完成。

### 为何如此繁琐？

Vulkan的显式设计基于两个原因：

1. **简化驱动程序**：OpenGL驱动程序极其复杂（它们必须猜测应用程序的意图并进行相应优化）。Vulkan将这一责任转移给应用程序，从而使驱动程序更简洁、更可预测，也更容易在不同厂商的产品中正确实现。

1. **提升性能**：对内存布局、同步机制和命令批处理的显式控制，使应用程序能够做出最优决策。在CUDA中，驱动程序可能会插入不必要的同步操作；而在Vulkan中，只有在必要时才会进行同步。

## 用GLSL编写计算着色器

**计算着色器**是一种在GPU上运行的程序，类似于CUDA内核。它使用**GLSL**（OpenGL着色语言）编写，并编译成**SPIR-V**字节码（一种可移植的二进制格式）。

### 向量加法

```glsl
// add.comp — compile with: glslangValidator -V add.comp -o add.spv
#version 450

// Workgroup size: 256 invocations per workgroup (= threads per block in CUDA)
layout(local_size_x = 256) in;

// Buffer bindings (like kernel arguments)
layout(set = 0, binding = 0) buffer InputA { float a[]; };
layout(set = 0, binding = 1) buffer InputB { float b[]; };
layout(set = 0, binding = 2) buffer Output { float c[]; };

// Push constant: small uniform data (like a kernel parameter)
layout(push_constant) uniform PushConstants {
    uint n;  // number of elements
};

void main() {
    uint idx = gl_GlobalInvocationID.x;  // global thread index
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}
```

- **映射到CUDA概念**：

| Vulkan | CUDA | 含义 |
| -------- || ------ || --------- ||
| 工作组 | 线程块 | 可共享内存的线程组 |
| 调用 | 线程 | 单个执行单元 |
| `gl_GlobalInvocationID` | `blockIdx * blockDim + threadIdx` | 全局线程索引 |
| `gl_LocalInvocationID` | `threadIdx` | 工作组内的线程索引 |
| `gl_WorkGroupID` | `blockIdx` | 工作组索引 |
| `local_size_x` | `blockDim.x` | 每个工作组中的线程数 |
| 存储缓冲区 | 全局内存 | 可读写的GPU内存 |
| 共享内存（`shared`） | `__shared__` | 每个工作组内的快速内存 |
| 推送常量 | 内核参数 | 小型统一数据 |

### 使用共享内存的ReLU操作

```glsl
// relu_shared.comp
#version 450

layout(local_size_x = 256) in;

layout(set = 0, binding = 0) buffer Input  { float input_data[]; };
layout(set = 0, binding = 1) buffer Output { float output_data[]; };

layout(push_constant) uniform PushConstants { uint n; };

// Shared memory (equivalent to CUDA __shared__)
shared float tile[256];

void main() {
    uint gid = gl_GlobalInvocationID.x;
    uint lid = gl_LocalInvocationID.x;

    // Load into shared memory
    if (gid < n) {
        tile[lid] = input_data[gid];
    }

    // Barrier: wait for all invocations in workgroup to finish loading
    barrier();  // equivalent to CUDA __syncthreads()

    // Compute ReLU
    if (gid < n) {
        output_data[gid] = max(tile[lid], 0.0);
    }
}
```

- 对于ReLU操作而言，共享内存并非绝对必需（该操作为逐元素运算）。但这展示了典型模式：加载到共享内存 → 屏障同步 → 计算 → 存储。对于需要来自相邻线程数据的操作（如卷积、归约、Softmax），共享内存则必不可少。

### 并行归约（求和）

```glsl
// reduce_sum.comp
#version 450

layout(local_size_x = 256) in;

layout(set = 0, binding = 0) buffer Input  { float input_data[]; };
layout(set = 0, binding = 1) buffer Output { float partial_sums[]; };

layout(push_constant) uniform PushConstants { uint n; };

shared float sdata[256];

void main() {
    uint gid = gl_GlobalInvocationID.x;
    uint lid = gl_LocalInvocationID.x;
    uint wgid = gl_WorkGroupID.x;

    // Load into shared memory
    sdata[lid] = (gid < n) ? input_data[gid] : 0.0;
    barrier();

    // Tree reduction within the workgroup
    for (uint stride = 128; stride > 0; stride >>= 1) {
        if (lid < stride) {
            sdata[lid] += sdata[lid + stride];
        }
        barrier();
    }

    // Thread 0 writes the workgroup's partial sum
    if (lid == 0) {
        partial_sums[wgid] = sdata[0];
    }
}
```

- 这是经典的并行归约模式（与CUDA相同）。每个工作组生成一个部分和。第二次调度将这些部分和归约为最终结果。树形归约在每一步都会将活跃线程数减半：256 → 128 → 64 → … → 1。

### 分块矩阵乘法

```glsl
// matmul_tiled.comp
#version 450

#define TILE_SIZE 16

layout(local_size_x = TILE_SIZE, local_size_y = TILE_SIZE) in;

layout(set = 0, binding = 0) buffer MatA { float A[]; };
layout(set = 0, binding = 1) buffer MatB { float B[]; };
layout(set = 0, binding = 2) buffer MatC { float C[]; };

layout(push_constant) uniform PushConstants {
    uint M, N, K;
};

shared float tileA[TILE_SIZE][TILE_SIZE];
shared float tileB[TILE_SIZE][TILE_SIZE];

void main() {
    uint row = gl_GlobalInvocationID.y;
    uint col = gl_GlobalInvocationID.x;
    uint lr = gl_LocalInvocationID.y;
    uint lc = gl_LocalInvocationID.x;

    float sum = 0.0;

    for (uint t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        // Load tile of A and B into shared memory
        uint aCol = t * TILE_SIZE + lc;
        uint bRow = t * TILE_SIZE + lr;

        tileA[lr][lc] = (row < M && aCol < K) ? A[row * K + aCol] : 0.0;
        tileB[lr][lc] = (bRow < K && col < N) ? B[bRow * N + col] : 0.0;

        barrier();

        // Compute partial dot product
        for (uint k = 0; k < TILE_SIZE; k++) {
            sum += tileA[lr][k] * tileB[k][lc];
        }

        barrier();
    }

    if (row < M && col < N) {
        C[row * N + col] = sum;
    }
}
```

- 这与CUDA版本（文件04）中的平铺算法相同，只是采用了GLSL语法。其概念完全一致：将图块加载到共享内存中，设置屏障，进行计算，再设置屏障，然后重复此过程。

## C++ Vulkan设置

- 计算着色器部分相对简单。难点在于用于创建Vulkan实例、分配内存、绑定缓冲区以及提交命令的C++样板代码。以下是完整流程的精简版：

```cpp
// vulkan_compute.cpp — a minimal but complete Vulkan compute example
// Compile: g++ -O3 -o vulkan_compute vulkan_compute.cpp -lvulkan
// Requires: Vulkan SDK installed, add.spv compiled from add.comp

#include <vulkan/vulkan.h>
#include <iostream>
#include <vector>
#include <fstream>
#include <cassert>

// Helper: read SPIR-V file
std::vector<uint32_t> readSPIRV(const std::string& filename) {
    std::ifstream file(filename, std::ios::ate | std::ios::binary);
    size_t fileSize = file.tellg();
    std::vector<uint32_t> buffer(fileSize / sizeof(uint32_t));
    file.seekg(0);
    file.read(reinterpret_cast<char*>(buffer.data()), fileSize);
    return buffer;
}

int main() {
    const uint32_t N = 1024;
    const size_t bufferSize = N * sizeof(float);

    // ========== 1. Create Vulkan Instance ==========
    VkApplicationInfo appInfo{};
    appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
    appInfo.apiVersion = VK_API_VERSION_1_2;

    VkInstanceCreateInfo instanceInfo{};
    instanceInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
    instanceInfo.pApplicationInfo = &appInfo;

    VkInstance instance;
    vkCreateInstance(&instanceInfo, nullptr, &instance);

    // ========== 2. Select Physical Device (GPU) ==========
    uint32_t deviceCount = 0;
    vkEnumeratePhysicalDevices(instance, &deviceCount, nullptr);
    std::vector<VkPhysicalDevice> devices(deviceCount);
    vkEnumeratePhysicalDevices(instance, &deviceCount, devices.data());
    VkPhysicalDevice physicalDevice = devices[0];  // use first GPU

    // Print GPU name
    VkPhysicalDeviceProperties props;
    vkGetPhysicalDeviceProperties(physicalDevice, &props);
    std::cout << "Using GPU: " << props.deviceName << "\n";

    // ========== 3. Find Compute Queue Family ==========
    uint32_t queueFamilyCount = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(physicalDevice, &queueFamilyCount, nullptr);
    std::vector<VkQueueFamilyProperties> queueFamilies(queueFamilyCount);
    vkGetPhysicalDeviceQueueFamilyProperties(physicalDevice, &queueFamilyCount, queueFamilies.data());

    uint32_t computeFamily = 0;
    for (uint32_t i = 0; i < queueFamilyCount; i++) {
        if (queueFamilies[i].queueFlags & VK_QUEUE_COMPUTE_BIT) {
            computeFamily = i;
            break;
        }
    }

    // ========== 4. Create Logical Device and Queue ==========
    float queuePriority = 1.0f;
    VkDeviceQueueCreateInfo queueInfo{};
    queueInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
    queueInfo.queueFamilyIndex = computeFamily;
    queueInfo.queueCount = 1;
    queueInfo.pQueuePriorities = &queuePriority;

    VkDeviceCreateInfo deviceInfo{};
    deviceInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;
    deviceInfo.queueCreateInfoCount = 1;
    deviceInfo.pQueueCreateInfos = &queueInfo;

    VkDevice device;
    vkCreateDevice(physicalDevice, &deviceInfo, nullptr, &device);

    VkQueue computeQueue;
    vkGetDeviceQueue(device, computeFamily, 0, &computeQueue);

    // ========== 5. Allocate Buffers (A, B, C) ==========
    // For brevity, this uses host-visible memory (slower but simpler)
    auto createBuffer = [&](VkBuffer& buffer, VkDeviceMemory& memory) {
        VkBufferCreateInfo bufInfo{};
        bufInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
        bufInfo.size = bufferSize;
        bufInfo.usage = VK_BUFFER_USAGE_STORAGE_BUFFER_BIT;
        vkCreateBuffer(device, &bufInfo, nullptr, &buffer);

        VkMemoryRequirements memReqs;
        vkGetBufferMemoryRequirements(device, buffer, &memReqs);

        // Find host-visible memory type
        VkPhysicalDeviceMemoryProperties memProps;
        vkGetPhysicalDeviceMemoryProperties(physicalDevice, &memProps);
        uint32_t memType = 0;
        for (uint32_t i = 0; i < memProps.memoryTypeCount; i++) {
            if ((memReqs.memoryTypeBits & (1 << i)) &&
                (memProps.memoryTypes[i].propertyFlags &
                 (VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT))) {
                memType = i;
                break;
            }
        }

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memReqs.size;
        allocInfo.memoryTypeIndex = memType;
        vkAllocateMemory(device, &allocInfo, nullptr, &memory);
        vkBindBufferMemory(device, buffer, memory, 0);
    };

    VkBuffer bufA, bufB, bufC;
    VkDeviceMemory memA, memB, memC;
    createBuffer(bufA, memA);
    createBuffer(bufB, memB);
    createBuffer(bufC, memC);

    // ========== 6. Fill Input Buffers ==========
    float* ptrA;
    vkMapMemory(device, memA, 0, bufferSize, 0, (void**)&ptrA);
    for (uint32_t i = 0; i < N; i++) ptrA[i] = 1.0f;
    vkUnmapMemory(device, memA);

    float* ptrB;
    vkMapMemory(device, memB, 0, bufferSize, 0, (void**)&ptrB);
    for (uint32_t i = 0; i < N; i++) ptrB[i] = 2.0f;
    vkUnmapMemory(device, memB);

    // ========== 7. Create Compute Pipeline ==========
    auto spirvCode = readSPIRV("add.spv");
    VkShaderModuleCreateInfo shaderInfo{};
    shaderInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    shaderInfo.codeSize = spirvCode.size() * sizeof(uint32_t);
    shaderInfo.pCode = spirvCode.data();
    VkShaderModule shaderModule;
    vkCreateShaderModule(device, &shaderInfo, nullptr, &shaderModule);

    // Descriptor set layout (tells Vulkan about the buffer bindings)
    VkDescriptorSetLayoutBinding bindings[3] = {};
    for (int i = 0; i < 3; i++) {
        bindings[i].binding = i;
        bindings[i].descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
        bindings[i].descriptorCount = 1;
        bindings[i].stageFlags = VK_SHADER_STAGE_COMPUTE_BIT;
    }

    VkDescriptorSetLayoutCreateInfo layoutInfo{};
    layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
    layoutInfo.bindingCount = 3;
    layoutInfo.pBindings = bindings;
    VkDescriptorSetLayout descLayout;
    vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &descLayout);

    // Push constant range
    VkPushConstantRange pushRange{};
    pushRange.stageFlags = VK_SHADER_STAGE_COMPUTE_BIT;
    pushRange.offset = 0;
    pushRange.size = sizeof(uint32_t);

    // Pipeline layout
    VkPipelineLayoutCreateInfo pipeLayoutInfo{};
    pipeLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
    pipeLayoutInfo.setLayoutCount = 1;
    pipeLayoutInfo.pSetLayouts = &descLayout;
    pipeLayoutInfo.pushConstantRangeCount = 1;
    pipeLayoutInfo.pPushConstantRanges = &pushRange;
    VkPipelineLayout pipelineLayout;
    vkCreatePipelineLayout(device, &pipeLayoutInfo, nullptr, &pipelineLayout);

    // Compute pipeline
    VkComputePipelineCreateInfo pipeInfo{};
    pipeInfo.sType = VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO;
    pipeInfo.stage.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    pipeInfo.stage.stage = VK_SHADER_STAGE_COMPUTE_BIT;
    pipeInfo.stage.module = shaderModule;
    pipeInfo.stage.pName = "main";
    pipeInfo.layout = pipelineLayout;
    VkPipeline pipeline;
    vkCreateComputePipelines(device, VK_NULL_HANDLE, 1, &pipeInfo, nullptr, &pipeline);

    // ========== 8. Descriptor Set (bind buffers to shader) ==========
    VkDescriptorPoolSize poolSize{};
    poolSize.type = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
    poolSize.descriptorCount = 3;

    VkDescriptorPoolCreateInfo poolInfo{};
    poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
    poolInfo.maxSets = 1;
    poolInfo.poolSizeCount = 1;
    poolInfo.pPoolSizes = &poolSize;
    VkDescriptorPool descPool;
    vkCreateDescriptorPool(device, &poolInfo, nullptr, &descPool);

    VkDescriptorSetAllocateInfo descAllocInfo{};
    descAllocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
    descAllocInfo.descriptorPool = descPool;
    descAllocInfo.descriptorSetCount = 1;
    descAllocInfo.pSetLayouts = &descLayout;
    VkDescriptorSet descSet;
    vkAllocateDescriptorSets(device, &descAllocInfo, &descSet);

    // Write buffer references into the descriptor set
    VkDescriptorBufferInfo bufInfos[3] = {
        {bufA, 0, bufferSize}, {bufB, 0, bufferSize}, {bufC, 0, bufferSize}
    };
    VkWriteDescriptorSet writes[3] = {};
    for (int i = 0; i < 3; i++) {
        writes[i].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        writes[i].dstSet = descSet;
        writes[i].dstBinding = i;
        writes[i].descriptorCount = 1;
        writes[i].descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
        writes[i].pBufferInfo = &bufInfos[i];
    }
    vkUpdateDescriptorSets(device, 3, writes, 0, nullptr);

    // ========== 9. Record and Submit Command Buffer ==========
    VkCommandPoolCreateInfo cmdPoolInfo{};
    cmdPoolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
    cmdPoolInfo.queueFamilyIndex = computeFamily;
    VkCommandPool cmdPool;
    vkCreateCommandPool(device, &cmdPoolInfo, nullptr, &cmdPool);

    VkCommandBufferAllocateInfo cmdAllocInfo{};
    cmdAllocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
    cmdAllocInfo.commandPool = cmdPool;
    cmdAllocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
    cmdAllocInfo.commandBufferCount = 1;
    VkCommandBuffer cmdBuf;
    vkAllocateCommandBuffers(device, &cmdAllocInfo, &cmdBuf);

    VkCommandBufferBeginInfo beginInfo{};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
    vkBeginCommandBuffer(cmdBuf, &beginInfo);

    vkCmdBindPipeline(cmdBuf, VK_PIPELINE_BIND_POINT_COMPUTE, pipeline);
    vkCmdBindDescriptorSets(cmdBuf, VK_PIPELINE_BIND_POINT_COMPUTE,
                            pipelineLayout, 0, 1, &descSet, 0, nullptr);
    vkCmdPushConstants(cmdBuf, pipelineLayout, VK_SHADER_STAGE_COMPUTE_BIT,
                       0, sizeof(uint32_t), &N);
    vkCmdDispatch(cmdBuf, (N + 255) / 256, 1, 1);  // launch workgroups

    vkEndCommandBuffer(cmdBuf);

    // Submit
    VkFenceCreateInfo fenceInfo{};
    fenceInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    VkFence fence;
    vkCreateFence(device, &fenceInfo, nullptr, &fence);

    VkSubmitInfo submitInfo{};
    submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
    submitInfo.commandBufferCount = 1;
    submitInfo.pCommandBuffers = &cmdBuf;
    vkQueueSubmit(computeQueue, 1, &submitInfo, fence);
    vkWaitForFences(device, 1, &fence, VK_TRUE, UINT64_MAX);

    // ========== 10. Read Results ==========
    float* ptrC;
    vkMapMemory(device, memC, 0, bufferSize, 0, (void**)&ptrC);
    std::cout << "Results: c[0]=" << ptrC[0] << " c[1]=" << ptrC[1]
              << " (expected 3.0)\n";
    bool correct = true;
    for (uint32_t i = 0; i < N; i++) {
        if (ptrC[i] != 3.0f) { correct = false; break; }
    }
    std::cout << (correct ? "ALL CORRECT" : "ERRORS FOUND") << "\n";
    vkUnmapMemory(device, memC);

    // ========== Cleanup (abbreviated) ==========
    vkDestroyFence(device, fence, nullptr);
    vkDestroyCommandPool(device, cmdPool, nullptr);
    vkDestroyPipeline(device, pipeline, nullptr);
    vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
    vkDestroyDescriptorPool(device, descPool, nullptr);
    vkDestroyDescriptorSetLayout(device, descLayout, nullptr);
    vkDestroyShaderModule(device, shaderModule, nullptr);
    vkDestroyBuffer(device, bufA, nullptr); vkFreeMemory(device, memA, nullptr);
    vkDestroyBuffer(device, bufB, nullptr); vkFreeMemory(device, memB, nullptr);
    vkDestroyBuffer(device, bufC, nullptr); vkFreeMemory(device, memC, nullptr);
    vkDestroyDevice(device, nullptr);
    vkDestroyInstance(instance, nullptr);

    return 0;
}
```

- **没错，向量加法代码约有200行。相比之下，CUDA代码仅需约30行。** 这就是显式编程的代价。但请注意：每一行代码都有其明确用途。没有隐藏的驱动程序决策，没有隐式同步，也没有意外的内存分配。你可以完全掌控一切。

- 实际上，你会将这些样板代码封装在辅助库中（或使用现有的库，如用于内存分配的**vk-bootstrap**、**VMA**，或面向机器学习领域的**kompute**）。

## Kompute：简化版Vulkan，专为机器学习设计

- **Kompute**是一款开源C++库，它封装了Vulkan用于GPU计算的样板代码。同样的向量加法代码会变成：

```cpp
#include <kompute/Kompute.hpp>

int main() {
    kp::Manager mgr;

    auto tensorA = mgr.tensor({1, 1, 1, 1, 1});
    auto tensorB = mgr.tensor({2, 2, 2, 2, 2});
    auto tensorC = mgr.tensor({0, 0, 0, 0, 0});

    std::string shader = R"(
        #version 450
        layout(local_size_x = 1) in;
        layout(set=0, binding=0) buffer A { float a[]; };
        layout(set=0, binding=1) buffer B { float b[]; };
        layout(set=0, binding=2) buffer C { float c[]; };
        void main() {
            uint i = gl_GlobalInvocationID.x;
            c[i] = a[i] + b[i];
        }
    )";

    auto algorithm = mgr.algorithm({tensorA, tensorB, tensorC},
                                     kompute::Shader::compile_source(shader));

    mgr.sequence()
        ->record<kp::OpTensorSyncDevice>({tensorA, tensorB, tensorC})
        ->record<kp::OpAlgoDispatch>(algorithm)
        ->record<kp::OpTensorSyncLocal>({tensorC})
        ->eval();

    // tensorC now contains [3, 3, 3, 3, 3]
}
```

- 可读性更强。Kompute负责实例创建、设备选择、内存分配、描述符集以及命令缓冲区管理。你只需专注于着色器和数据。

## WebGPU：浏览器中的GPU计算

- **WebGPU**是WebGL的继任者，它允许从JavaScript直接访问现代GPU。它基于Vulkan（Linux/Android）、Metal（macOS/iOS）和DirectX 12（Windows）构建，从而屏蔽了平台差异。

- WebGPU使用**WGSL**（WebGPU着色语言）而非GLSL：

```wgsl
// add.wgsl — WebGPU compute shader
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    c[i] = a[i] + b[i];
}
```

- **JavaScript设置**（精简版）：

```javascript
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// Create buffers
const bufferA = device.createBuffer({
  size: N * 4,
  usage: GPUBufferUsage.STORAGE,
  mappedAtCreation: true,
});
new Float32Array(bufferA.getMappedRange()).fill(1.0);
bufferA.unmap();

// ... (similar for B and C)

// Create pipeline from WGSL shader
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module: device.createShaderModule({ code: wgslSource }), entryPoint: "main" },
});

// Dispatch
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(Math.ceil(N / 256));
pass.end();
device.queue.submit([encoder.finish()]);
```

- **为什么WebGPU对机器学习至关重要**：在浏览器中运行推理意味着无需服务器成本、无延迟，且用户数据永远不会离开设备。像**ONNX Runtime Web**和**Transformers.js**这样的库利用WebGPU在客户端直接运行模型（包括小型大语言模型）。

## 何时使用Vulkan

| 场景 | 是否使用Vulkan？ | 原因/替代方案 |
| ------ || ------------------ || -------------- ||
| 机器学习训练 | 否 | 在NVIDIA平台上，CUDA/Triton更简单且更快 |
| 在NVIDIA GPU上进行推理 | 否 | TensorRT或CUDA更为合适 |
| 在AMD/Intel GPU上进行推理 | **是** | 唯一的跨厂商GPU计算选项 |
| 移动端推理（Android） | **是** | Vulkan是Android上的标准GPU API |
| 移动端推理（iOS） | 否 | 直接使用Metal（MoltenVK会增加额外开销） |
| 浏览器推理 | **WebGPU** | 基于Vulkan/Metal/DX12构建 |
| 游戏引擎 + 机器学习 | **是** | 游戏引擎已使用Vulkan进行渲染 |
| 跨平台库开发 | **是** | 一套代码即可适配所有GPU厂商 |
| 学习GPU编程 | 视情况而定 | CUDA更容易上手；Vulkan能提供更深入的知识 |

## 编码任务（使用g++ -lvulkan编译，需安装Vulkan SDK）

1. 编译并运行上述的向量加法示例。修改着色器以计算`c[i] = a[i] * b[i] + a[i]`（融合乘加运算），并验证结果是否正确。

1. 编写一个计算着色器，利用共享内存对一行数据执行softmax运算（包括求最大值和求和步骤）。用已知数值进行测试。

```glsl
// softmax.comp — compile with: glslangValidator -V softmax.comp -o softmax.spv
#version 450

#define WG_SIZE 256

layout(local_size_x = WG_SIZE) in;

layout(set = 0, binding = 0) buffer Input  { float input_data[]; };
layout(set = 0, binding = 1) buffer Output { float output_data[]; };

layout(push_constant) uniform PC { uint n; };

shared float sdata[WG_SIZE];

void main() {
    uint gid = gl_GlobalInvocationID.x;
    uint lid = gl_LocalInvocationID.x;

    // Step 1: find max (for numerical stability)
    sdata[lid] = (gid < n) ? input_data[gid] : -1e30;
    barrier();
    for (uint s = WG_SIZE / 2; s > 0; s >>= 1) {
        if (lid < s) sdata[lid] = max(sdata[lid], sdata[lid + s]);
        barrier();
    }
    float maxVal = sdata[0];
    barrier();

    // Step 2: compute exp(x - max)
    float expVal = (gid < n) ? exp(input_data[gid] - maxVal) : 0.0;
    sdata[lid] = expVal;
    barrier();

    // Step 3: sum of exp values
    for (uint s = WG_SIZE / 2; s > 0; s >>= 1) {
        if (lid < s) sdata[lid] += sdata[lid + s];
        barrier();
    }
    float sumExp = sdata[0];

    // Step 4: normalise
    if (gid < n) {
        output_data[gid] = expVal / sumExp;
    }
}
```

1. 修改C++主机代码以对计算着色器进行基准测试：使用Vulkan时间戳查询或CPU端的栅栏来计时调度过程（不包括初始化阶段），并计算所达到的带宽（单位：GB/秒）。
