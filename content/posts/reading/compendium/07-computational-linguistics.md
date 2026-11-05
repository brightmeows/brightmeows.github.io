---
title: "计算语言学"
date: "2026-11-05"
order: 7
slug: "compendium/07-computational-linguistics"
description: "语言学为NLP系统提供了其隐含学习并加以利用的结构性词汇。本文涵盖了形态学、句法、语义、语用学、音系学、成分分析与依存分析，以及分布假设——这些人类语言科学为人工智能中的分词、语法和意义奠定了理论基础。"
tags: []
---

## 语言学基础

_语言学为NLP系统提供了其隐含学习并加以利用的结构性词汇。本文涵盖了形态学、句法、语义、语用学、音系学、成分分析与依存分析，以及分布假设——这些人类语言科学为人工智能中的分词、语法和意义奠定了理论基础。_

- 在构建能够理解或生成语言的系统之前，我们必须先了解语言本身的工作原理。

- 语言学是对语言的科学研究，它为NLP提供了不断借鉴的概念性词汇。

- 即使是那些从原始数据中学习语言的现代神经模型，也会隐含地重新发现语言学家数十年来所记录下的许多结构。

- 语言在各个层面都具有结构性：构成单词的声音、构成单词的部分、将单词组合成句子的规则、这些句子所承载的意义，以及语境对解读方式的影响。我们将自下而上逐一探讨各个层面。

- **形态学**研究单词的内部结构。单词并非原子单位；它们是由称为**词素**的更小有意义单元构成的。

- 单词“unhappiness”包含三个词素：“un-”（表示“不”的前缀）、“happy”（词根）以及“-ness”（将形容词转化为名词的后缀）。每个词素都对词义有所贡献。

- **词根**（或称词干）是承载主要意义的核心词素。“Happy”、“run”、“compute”都是词根。

- **词缀**是附着在词根上以改变其形式的词素。

- 英语中有**前缀**（位于词根前：如un-、re-、pre-）和**后缀**（位于词根后：如-ing、-ed、-tion）。有些语言还有中缀（插入词根内部）和环缀（环绕词根）。

![词素树：“unhappiness”被拆分为前缀“un”、词根“happy”和后缀“ness”](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/morpheme_tree.svg)

- 形态学过程有两种类型。**屈折变化**会改变单词的语法属性，但不会改变其核心意义或词性：“run”变为“runs”（第三人称单数）、“running”（进行时）、“ran”（过去式）。该词仍然是表示相同意义的动词。

- **派生**则会产生新词，通常会改变词性：“happy”（形容词）变为“happiness”（名词），“compute”（动词）变为“computation”（名词），再变为“computational”（形容词）。每次派生都会改变词义和语法类别。

- 不同语言在形态复杂程度上差异巨大。英语相对属于**分析型语言**（每个单词的词素较少，依赖词序来表意）。

- 土耳其语和芬兰语属于**黏着型语言**（单词可包含多个串联在一起的词素）。阿拉伯语和希伯来语采用**模板式形态学**（词根是由辅音构成的骨架，如k-t-b表示“写”，通过插入不同的元音模式来创造不同单词：kitab意为“书”，kataba意为“他写了”，maktub意为“已写好的”）。

- 形态学对NLP至关重要，因为它会影响分词。基于单词级别的分词器会将“run”、“runs”、“running”和“ran”视为四个互不相关的符号。

- 具备形态学意识的系统能识别出它们共享同一个词根。子词分词法（BPE、WordPiece）——我们将在文档02中介绍——是对形态学分析的一种统计近似。

- **句法**研究单词如何组合成短语和句子。每种语言都有规范词序和结构的规则；违反这些规则就会产生无意义的内容。

- “The cat sat on the mat”是符合语法规则的英语句子；而“Mat the on sat cat the”则不符合语法。

- 描述句法结构主要有两种框架。

- **短语结构语法**（也称成分语法）认为句子是由短语嵌套而成的。一个句子（S）由名词短语（NP）和动词短语（VP）组成。

- 名词短语可能由限定词（Det）加上名词（N）构成。动词短语可能由动词（V）加上名词短语构成。这些规则可构建出如下树状结构：

![“the cat sat on the mat”的成分树：S分为NP和VP，NP分为Det“the”和N“cat”，VP分为V“sat”和PP，PP分为P“on”和NP](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/constituency_tree.svg)

- 这种树被称为**成分树**（或解析树）。每个内部节点代表一种短语类型，每个叶子节点代表一个单词。该树反映了层次化分组：“on the mat”是一个整体（介词短语），“sat on the mat”也是一个整体（动词短语），而整个结构则构成一个句子。

- **上下文无关文法（CFG）**将这些规则形式化。它由一组产生式规则组成，每条规则形式为$A \to \alpha$，其中$A$是非终结符（如NP或VP等短语类型），$\alpha$是由终结符（单词）和非终结符组成的序列。例如：

```text
S  → NP VP
NP → Det N
NP → Det N PP
VP → V NP
VP → V PP
PP → P NP
Det → "the" | "a"
N  → "cat" | "mat" | "dog"
V  → "sat" | "chased"
P  → "on" | "under"
```

- 从S出发并反复应用规则，就能生成该语法所允许的所有句子。句法分析则相反：给定一个句子，找出生成它的树结构（或多种树结构）。若一个句子存在多个有效的句法树，则称其为**句法歧义**。“我用望远镜看到了那个人”有两种解析方式：要么是我用望远镜去看那个人，要么是我看到的是一个拿着望远镜的人。

- **依存语法**采用了不同的视角。它不描述短语的嵌套关系，而是描述词语之间的直接关系。句子中每个词都依赖于另一个词（即其**中心词**），句子的根节点除外。由此形成一棵**依存树**，树中的边标有语法关系标签（如主语、宾语、修饰语等）。

![“猫坐在垫子上”的依存树：“sat”指向“cat”（nsubj）和“on”（prep）；“on”指向“mat”（pobj）；“cat”指向“the”（det）；“mat”也指向“the”（det）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/dependency_tree.svg)

- 在依存语法中，“sat”是根节点。“cat”作为主语依赖于“sat”（nsubj）。“on”作为介词修饰语依赖于“sat”。“mat”作为介词的宾语依赖于“on”。每个词都依附于唯一一个中心词，从而构成一棵树。

- 由于统计解析器更容易生成依存树，且这些关系能更直接地对应语义角色（谁对谁做了什么），因此依存语法已成为现代自然语言处理领域的主流框架。

- **配价**描述的是动词所需的论元数量。“sleep”是**不及物动词**（一个论元：睡觉的人）。“eat”是**及物动词**（两个论元：进食者和被吃的食物）。“give”是**双及物动词**（三个论元：给予者、所给予之物以及接收者）。了解动词的配价有助于确定哪些句法树是合法的。

- **语义学**研究的是意义。句法告诉你句子的结构；语义则告诉你它的含义。

- **词汇语义学**关注单个词的意义。词语之间以系统化的方式相互关联：

- **同义关系**：意义几乎相同的词。“big”和“large”是同义词。完全意义上的同义词很少见；它们在内涵或使用上总会有细微差别。
- **反义关系**：意义相反的词。“hot”与“cold”，“buy”与“sell”。
- **上下位关系**：“是一种”关系。“dog”是“animal”的下位词（狗是一种动物）。“animal”则是“dog”的上位词。它们构成了分类层级。
- **部分整体关系**：“属于…的一部分”关系。“wheel”是“car”的部分整体。
- **多义现象**：一个词具有多个相关意义。“bank”既可指金融机构，也可指河岸。具体含义需依赖上下文来判断。

- **词义消歧（WSD）**是指确定在多义词中哪个意义适用于特定语境的任务。在“我在银行存了钱”中，取“金融机构”之意；而在“我们坐在河岸边”中，则取“河岸”之意。WSD曾是早期自然语言处理中的核心难题；如今，基于上下文的词向量模型（如ELMo、BERT）通过为同一词的不同用法生成不同的向量表示，很大程度上解决了这一问题。

- **组合语义学**探讨单个词的意义如何组合成短语或句子的意义。**组合性原则**（由弗雷格提出）指出：复杂表达式的意义由其组成部分的意义以及组合规则决定。“猫追赶狗”与“狗追赶猫”的含义不同，因为句法结构（谁作主语、谁作宾语）与词义相互作用。

- 并非所有意义都是可组合的。像“kick the bucket”（意为“去世”）这样的习语，其意义无法从其组成部分推导出来。这对任何基于组合的方法来说都是挑战。

- **分布语义学**是现代自然语言处理中用于理解意义的计算方法。**分布假设**（Firth，1957年）认为：“词的意义由其上下文决定。”出现在相似语境中的词往往具有相似的意义。这是词向量（如Word2Vec、GloVe）的理论基础，我们将在第03个文件中进一步探讨。

- **语用学**研究语境如何影响意义。同一句话因说话人、时间、地点和目的的不同而意义迥异。

- “你能递一下盐吗？”在句法上是一个关于能力的是非问句；但在语用上，它其实是一种请求。你不会回答“是的，我能”，然后却坐着不动。理解这一点需要超出字面词句的常识，尤其是关于**言语行为**的惯例。

- **言语行为理论**（奥斯汀、塞尔）区分了以下几种行为：
- **言内行为**：字面内容（“你能递一下盐吗？”）
- **言外行为**：说话人的意图（一种请求）
- **言后行为**：对听者产生的影响（听者递盐）

- **言外之意**（格赖斯）指隐含但未明确表达的意义。如果有人问“约翰厨艺好吗？”，你回答“他是英国人”，你并未直接回答问题，但听者可以推断（无论这种推断是否合理）你的意思是“不好”。格赖斯的**合作原则**指出：说话人通常会力求提供信息丰富、真实、相关且清晰的内容，而听者也会基于这些准则来理解话语。

- **共指现象**是一种语用现象，指不同表达指代同一个实体。在“爱丽丝去了商店。她买了牛奶”中，“她”指的是爱丽丝。解决共指问题是理解多句文本的关键，也是自然语言处理中的重要任务。

- **语篇结构**描述了句子如何连接形成连贯的文本。叙事有开头、中间和结尾；论证则包含主张和证据。**修辞结构理论（RST）**将文本视为由段落间的语篇关系（如阐述、对比、因果等）构成的树状结构。
- 语用学是自然语言处理中最难的部分。现代语言模型通过训练数据隐式地处理大部分句法和语义问题，但语用推理、讽刺理解、言外之意以及依赖语境的意义理解，仍是一大挑战。

- **音系学**研究语言的发音系统。虽然本章侧重于文本，但简要概述可为后续音频与语音章节（第09章）做铺垫。

- **音素**是能够区分意义的最小声音单位。英语中约有44个音素。“bat”和“pat”这两个词仅相差一个音素（/b/与/p/），却导致意义完全不同。这类词被称为**最小对立体**。

- **音位变体**是指同一音素的不同物理表现形式，但不会改变意义。“pin”中的“p”（送气音）和“spin”中的“p”（不送气音）就是英语中/p/的音位变体；母语者会将它们视为同一个音。

- **国际音标（IPA）**为所有语言的音素提供了标准化的令牌方式。“cat”一词被转写为/kæt/。国际音标是书面文本与语音系统之间的桥梁。

- **韵律**涵盖了语音的节奏、重音和语调。“I didn’t say he stole the money”这句话的含义会根据重读的词不同而产生七种差异。韵律承载了纯文本无法表达的信息，因此文本转语音系统必须仔细建模。

- 在自然语言处理中，音系学知识应用于文本转语音（字形到音素的转换）、语音识别（将声学信号映射为音素），甚至拼写校正和音译等领域。

## 编程任务（请使用CoLab或笔记本）

1. 构建一个简单的形态分析器，利用常见前缀和后缀列表将英语单词拆分为可能的词素。

```python
prefixes = ['un', 're', 'pre', 'dis', 'mis', 'over', 'under', 'out', 'non']
suffixes = ['ing', 'ed', 'ly', 'ness', 'ment', 'tion', 'able', 'ible', 'er', 'est', 'ful', 'less', 'ous']

def analyse_morphemes(word):
    """Simple morpheme analysis using known affixes."""
    parts = []
    remaining = word.lower()

    # Check prefixes
    for p in sorted(prefixes, key=len, reverse=True):
        if remaining.startswith(p) and len(remaining) > len(p) + 2:
            parts.append(f"[prefix: {p}]")
            remaining = remaining[len(p):]
            break

    # Check suffixes
    for s in sorted(suffixes, key=len, reverse=True):
        if remaining.endswith(s) and len(remaining) > len(s) + 2:
            root = remaining[:-len(s)]
            parts.append(f"[root: {root}]")
            parts.append(f"[suffix: {s}]")
            remaining = None
            break

    if remaining is not None:
        parts.append(f"[root: {remaining}]")

    return parts

for word in ['unhappiness', 'reusable', 'disconnected', 'overreacting', 'kindness']:
    print(f"{word:20s} → {' + '.join(analyse_morphemes(word))}")
```

1. 使用递归下降法实现一个简单的上下文无关文法解析器。定义一个小型文法，并将句子解析为成分树。

```python
class CFGParser:
    """Recursive descent parser for a tiny English grammar."""
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def consume(self, expected=None):
        tok = self.peek()
        if expected and tok != expected:
            return None
        self.pos += 1
        return tok

    def parse_det(self):
        if self.peek() in ('the', 'a'):
            return ('Det', self.consume())
        return None

    def parse_noun(self):
        if self.peek() in ('cat', 'dog', 'mat', 'man'):
            return ('N', self.consume())
        return None

    def parse_verb(self):
        if self.peek() in ('sat', 'chased', 'saw'):
            return ('V', self.consume())
        return None

    def parse_prep(self):
        if self.peek() in ('on', 'under', 'with'):
            return ('P', self.consume())
        return None

    def parse_np(self):
        save = self.pos
        det = self.parse_det()
        noun = self.parse_noun()
        if det and noun:
            # Check for optional PP
            pp = self.parse_pp()
            if pp:
                return ('NP', det, noun, pp)
            return ('NP', det, noun)
        self.pos = save
        return None

    def parse_pp(self):
        save = self.pos
        prep = self.parse_prep()
        np = self.parse_np()
        if prep and np:
            return ('PP', prep, np)
        self.pos = save
        return None

    def parse_vp(self):
        save = self.pos
        verb = self.parse_verb()
        if verb:
            np = self.parse_np()
            if np:
                return ('VP', verb, np)
            pp = self.parse_pp()
            if pp:
                return ('VP', verb, pp)
        self.pos = save
        return None

    def parse_sentence(self):
        np = self.parse_np()
        vp = self.parse_vp()
        if np and vp and self.pos == len(self.tokens):
            return ('S', np, vp)
        return None

def print_tree(tree, indent=0):
    if isinstance(tree, str):
        print(' ' * indent + tree)
    elif isinstance(tree, tuple):
        print(' ' * indent + tree[0])
        for child in tree[1:]:
            print_tree(child, indent + 2)

sentences = [
    "the cat sat on the mat",
    "a dog chased the cat",
]

for sent in sentences:
    tokens = sent.split()
    parser = CFGParser(tokens)
    tree = parser.parse_sentence()
    print(f"\n'{sent}':")
    if tree:
        print_tree(tree)
    else:
        print("  (no parse found)")
```

1. 通过构建简单的词图来探索词汇关系。给定一个包含同义词、反义词和上位词关系的小型词汇表，找出词语之间的路径。

```python
relations = {
    ('big', 'large'): 'synonym',
    ('big', 'small'): 'antonym',
    ('small', 'tiny'): 'synonym',
    ('dog', 'animal'): 'hypernym',
    ('cat', 'animal'): 'hypernym',
    ('puppy', 'dog'): 'hypernym',
    ('happy', 'glad'): 'synonym',
    ('happy', 'sad'): 'antonym',
    ('hot', 'cold'): 'antonym',
    ('hot', 'warm'): 'synonym',
}

# Build adjacency list
from collections import defaultdict, deque

graph = defaultdict(list)
for (w1, w2), rel in relations.items():
    graph[w1].append((w2, rel))
    graph[w2].append((w1, rel))

def find_path(start, end):
    """BFS to find a path between two words through the relation graph."""
    queue = deque([(start, [(start, None)])])
    visited = {start}
    while queue:
        node, path = queue.popleft()
        if node == end:
            return path
        for neighbor, rel in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [(neighbor, rel)]))
    return None

pairs = [('big', 'tiny'), ('puppy', 'cat'), ('happy', 'sad')]
for w1, w2 in pairs:
    path = find_path(w1, w2)
    if path:
        steps = " → ".join(f"{w}({r})" if r else w for w, r in path)
        print(f"{w1} → {w2}: {steps}")
    else:
        print(f"{w1} → {w2}: no path found")
```

## 文本处理与经典自然语言处理

文本处理将原始字符转换为模型可使用的结构化表示。本文档涵盖了分词（单词、子词、BPE、WordPiece）、文本规范化、编辑距离、TF-IDF、n-gram语言模型、词性标注、命名实体识别和情感分析——这些仍是现代系统基础的经典自然语言处理流程。

- 原始文本往往杂乱无章。在任何自然语言处理模型能够处理语言之前，必须先对文本进行清洗、规范化并转换为结构化表示。本文档介绍了从原始字符到模型可用特征的整个流程，以及深度学习出现之前占主导地位的经典自然语言处理算法。

- **文本规范化**将原始文本转换为规范形式。其目的是消除无关的差异，从而让“Hello”、“hello”、“HELLO”和“héllo”被统一对待。

- **大小写转换**将文本转为小写形式。这样会把“The”和“the”合并为同一个令牌。它对大多数任务有帮助，但在某些情况下会丢失有用信息：例如“US”（国家）与“us”（代词），或“Apple”（公司）与“apple”（水果）。

- **Unicode规范化**用于处理同一字符可能有多种编码方式的情况。“é”这个字符既可以是单个码点（U+00E9），也可以是基础字符“e”加上组合重音符号（U+0065 + U+0301）。NFC规范化会将它们合并为一个码点；NFD则将其拆分。未经规范化处理，两个外观相同的字符串可能无法匹配。

- **编辑距离**用于衡量两个字符串之间的差异。**莱文斯坦距离**计算将一个字符串转换为另一个字符串所需的最少单字符插入、删除和替换次数。“kitten”变为“sitting”的编辑距离为3（k→s，e→i，插入g）。

- 编辑距离通过动态规划来计算（我们将在算法章节中详细介绍）。定义$D[i][j]$为字符串$s$的前$i$个字符与字符串$t$的前$j$个字符之间的距离：

$$
D[i][j] = \begin{cases} j & \text{if } i = 0 \\ i & \text{if } j = 0 \\ D[i{-}1][j{-}1] & \text{if } s[i] = t[j] \\ 1 + \min(D[i{-}1][j], \; D[i][j{-}1], \; D[i{-}1][j{-}1]) & \text{otherwise} \end{cases}

$$

- 编辑距离在拼写校正、模糊匹配以及DNA序列比对中发挥着重要作用。在自然语言处理中，它用于纠正错别字并查找相似的词。

- **分词**将文本拆分为模型可处理的离散单元（令牌）。这是第一步，也是 arguably 最重要的预处理步骤。分词策略的选择会深刻影响模型的行为。

- **空白分词**根据空格进行拆分。这种方法简单但不够精细：“New York”会被拆成两个令牌，“don’t”是一个令牌（或者根据分词器不同被拆成“don”和“‘t”），而中文、日语等语言中单词之间根本没有空格。

- **基于规则的分词**利用手工制定的模式（正则表达式）来处理缩写、标点符号及特殊情况。“I’m” → “I” + “’m”，“U.S.A.”则保持为一个令牌。每种语言都需要单独的规则，这十分耗时。

- **子词分词**是现代的解决方案。它并非在词边界处拆分，而是从数据中学习常见的子词单元词汇表。这种方式能巧妙地处理未知词：如果“unhappiness”不在词汇表中，它可能会被拆成“un” + “happi” + “ness”，从而保留其形态结构。

![“unhappiness”和“transformers”的词级、字符级及子词分词对比](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/tokenisation_comparison.svg)

- **字节对编码（BPE）**最初以单个字符作为词汇表。它反复找出出现频率最高的相邻字符对，并将它们合并成一个新令牌。经过多次合并后，常见词会成为单个令牌，而罕见词则被拆成常见的子词片段。

- BPE算法：

1. 用训练语料中的所有单个字符初始化词汇表；
2. 统计每一对相邻令牌的出现频率；
3. 将出现频率最高的令牌对合并成一个新令牌；
4. 重复步骤2–3，直至达到指定的合并次数或词汇表大小。

- 例如，初始数据为“l o w”（出现5次）、“l o w e r”（出现2次）、“n e w e s t”（出现6次）：出现频率最高的令牌对可能是“e s”，合并为“es”；接着“es t”合并为“est”；“n e w”合并为“new”。最终词汇表既包含完整单词，也包含子词片段。

- **WordPiece**（BERT所使用的分词方式）与BPE类似，但它是根据概率而非频率来选择合并对象。它合并能最大化训练数据语言模型概率的令牌对。非词首位置的子词令牌会以“##”为前缀（例如，“playing” → “play” + “##ing”）。

- **Unigram**（SentencePiece所使用的分词方式）采取相反的策略：从一个较大的词汇表开始，逐步移除那些对训练数据概率影响最小的令牌。最终的词汇表就是最能解释语料库的子词单元集合。

- **SentencePiece**是一种与语言无关的分词库，它将输入视为原始字节流（不会预先按空格分词）。因此它能适用于任何语言，包括没有空格的语言。它实现了BPE和Unigram两种算法。

- 词汇表大小是一个关键的超参数。通常的选择范围是30,000到100,000个令牌。更大的词汇表意味着每个序列中的令牌更少（更高效），但嵌入表也会更大；较小的词汇表则会导致更多的子词拆分，从而使序列更长。

- 这两种技术都能将单词还原为基本形式，但它们的方法有所不同。

- **词干提取**通过简单的规则去除后缀。Porter词干提取器将“running”还原为“run”，将“happiness”还原为“happi”，将“studies”还原为“studi”。它速度快但不够精确：“university”和“universe”都被还原为“univers”，尽管两者并无关联。

- **词形还原**利用词汇表和形态分析来找出真正的词典形式（令牌）。“Running” → “run”，“better” → “good”，“mice” → “mouse”。它需要知道词的词性：“saw”作动词时词形还原为“see”，作名词时则仍为“saw”。

- 在现代神经自然语言处理中，子词分词已基本取代了词干提取和词形还原，但在信息检索以及处理小型模型或有限数据时，它们仍具有实用价值。

- **词性标注**为每个词赋予语法类别：名词、动词、形容词、限定词等。这是最古老的自然语言处理任务之一，也是句法分析的基础。

- 英语中最常用的是Penn Treebank标注集，共包含36个标签（NN表示单数名词，NNS表示复数名词，VB表示动词原形，VBD表示过去式，JJ表示形容词等）。

- 词性标注颇具挑战性，因为许多词具有歧义。“Book”可以是名词（“the book”）也可以是动词（“book a flight”）。“Run”在不同词性下有数十种含义。上下文至关重要。

- 早期标注器使用了第05章介绍的**隐马尔可夫模型（HMM）**。隐藏状态即为词性标签，观测值则为词语。转移概率描述了标签序列的规律（限定词后面很可能是名词或形容词），发射概率则描述了哪些词与哪些标签搭配。Viterbi算法用于找出最可能的标签序列。

- 用于词性标注的HMM模型：

$$\hat{t}_{1:n} = \arg\max_{t_{1:n}} \prod_{i=1}^{n} P(w_i \mid t_i) \cdot P(t_i \mid t_{i-1})$$

- 现代词性标注器采用神经网络（双向LSTM或Transformer），在英语上的准确率超过97%，接近人类水平。

- **命名实体识别（NER）**用于识别并分类文本中的专有名词及其他特定实体：人名、组织机构、地点、日期、金额等。

- 在句子“Apple CEO Tim Cook announced the event in Cupertino on Monday”中，NER系统应识别出：Apple（ORG）、Tim Cook（PER）、Cupertino（LOC）、Monday（DATE）。

- NER通常被定义为使用**BIO标注**（也称IOB标注）的**序列标注任务**。每个令牌都会获得一个标签：
- **B-TYPE**：类型为TYPE的实体的起始部分；
- **I-TYPE**：类型为TYPE的实体内部（延续部分）；
- **O**：不属于任何实体。
- “Tim Cook visited New York”会被标记为：Tim/B-PER Cook/I-PER visited/O New/B-LOC York/I-LOC。B标签用于标记新实体的起始位置，当两个同类型实体相邻时这一点尤为重要。

![带有BIO标签且颜色编码的句子：B-PER（红色）、I-PER（红色）、O（灰色）、B-LOC（蓝色）、I-LOC（蓝色）](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bio_tagging.svg)

- 传统的命名实体识别使用第05章介绍的**条件随机场（CRF）**，它用于建模给定输入时整个标签序列的条件概率。与属于生成式模型的隐马尔可夫模型（$P(x, y)$）不同，CRF属于判别式模型，直接建模$P(y \mid x)$。线性链CRF的定义如下：

$$P(y_{1:n} \mid x_{1:n}) = \frac{1}{Z(x)} \exp\!\left(\sum_{i=1}^{n} \left[\sum_k \lambda_k f_k(y_i, x, i) + \sum_j \mu_j g_j(y_i, y_{i-1}, x, i)\right]\right)$$

- 其中，$f_k$是**发射特征**（给定位置$i$的输入时标签$y_i$出现的概率），而$g_j$是**转移特征**（给定前一个标签$y_{i-1}$时标签$y_i$出现的概率）。

- 配分函数$Z(x) = \sum_{y'} \exp(\ldots)$会对所有可能的标签序列求和，以实现分布归一化。训练过程旨在最大化条件对数似然，这需要使用前向算法（第05章）高效计算$Z(x)$。

- 与单独对每个词进行分类相比，CRF的主要优势在于其转移特征能够强制施加结构约束（例如，I-PER只能跟在B-PER或I-PER之后，绝不能出现在O之后）。

- 现代命名实体识别模型将CRF堆叠在神经编码器之上（如BiLSTM-CRF或BERT-CRF），其中神经网络负责产生发射分数，而CRF层则学习转移结构。

- **句法分析**将句子转换为其句法结构，可以是成分树或依存树（两者均来自文件01）。

- **CYK算法**（Cocke-Younger-Kasami算法）利用动态规划技术，基于上下文无关文法对句子进行解析。

- 该算法要求文法必须处于**乔姆斯基正规形式**（即每条规则右侧要么有两个非终结符，要么有一个终结符）。算法采用自底向上的方式填充一个三角形表格：表格中的单元格代表句子的不同片段，每个单元格存储能够生成该片段的非终结符。

- CYK算法的时间复杂度为$O(n^3 \cdot |G|)$，其中$n$为句子长度，$|G|$为文法规模。虽然该算法能给出精确结果，但对于大型文法而言速度较慢。

- **移进-归约分析**从左到右处理句子，并维护一个栈。每一步中，算法要么执行**移进**操作（将下一个词压入栈中），要么执行**归约**操作（从栈中弹出元素并将其替换为短语）。每一步的具体操作由训练好的分类器决定。该算法的时间复杂度为$O(n)$，因此比CYK快得多。

- 在实际应用中，依存分析如今比成分分析更为常用。基于转移的依存分析器（如移进-归约分析器）和基于图的分析器（对所有可能的边打分并找出最大生成树）是两种主要方法。采用BiLSTM或Transformer的神经依存分析器能够达到最先进的性能。

- 在词嵌入技术出现之前，自然语言处理领域采用简单的计数方法将文档表示为向量。

- **词袋（BoW）模型**将文档表示为词频向量，完全忽略词序信息。如果词汇表包含$V$个词，那么每篇文档就对应一个$\mathbb{R}^V$中的向量（这与第01章介绍的向量空间概念一致）。向量中词$w$对应的条目表示该词在文档中出现的次数。

![词袋模型：文档先被转换为词频表，再映射为$R^V$中的稀疏向量，每个词汇表词对应一个条目](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bag_of_words.svg)

- 词袋模型虽然简单，但在文档分类和垃圾邮件过滤等任务中却出奇地有效。其主要缺点是它将每个词视为同等重要：“the”和“revolutionary”的权重相同。

- **TF-IDF**（词频-逆文档频率）通过根据词语的信息量为其赋予不同权重来解决这一问题。那些在某篇文档中频繁出现但在整个语料库中很少出现的词，往往对该文档而言具有重要意义。

$$\text{TF-IDF}(t, d) = \text{TF}(t, d) \times \text{IDF}(t)$$

- **词频**$\text{TF}(t, d)$通常是词项$t$在文档$d$中的原始计数（或其对数形式：$1 + \log(\text{count})$）。

- **逆文档频率**$\text{IDF}(t) = \log\frac{N}{|\{d : t \in d\}|}$，其中$N$为文档总数。那些出现在每篇文档中的词（如“the”）的IDF值接近于0；罕见词的IDF值则较高。

- 可以使用余弦相似度（第01章介绍）比较TF-IDF向量，以此衡量文档间的相似性。这是传统信息检索和搜索引擎的基础。

- **语言模型**为词序列赋予一个概率，用于回答“这句话出现的可能性有多大？”这一问题。语言模型在机器翻译、语音识别、拼写纠正以及文本生成等领域发挥着核心作用。

- 根据概率的链式法则（第05章），句子$w_1, w_2, \ldots, w_n$的概率为：

$$P(w_1, w_2, \ldots, w_n) = \prod_{i=1}^{n} P(w_i \mid w_1, \ldots, w_{i-1})$$

- 这种表示方法虽很精确，但并不实用：因为需要存储所有可能历史序列对应的概率。**马尔可夫假设**（第05章）将历史截断为最后$k-1$个词，从而得出**n-gram模型**（其中$n = k$）。

- **二元模型**（$n = 2$）仅依赖前一个词来预测当前词：

$$P(w_i \mid w_1, \ldots, w_{i-1}) \approx P(w_i \mid w_{i-1})$$

- **三元模型**（$n = 3$）则依赖前两个词来预测当前词。n-gram概率是通过在语料库中计数来估计的：

$$P(w_i \mid w_{i-1}) = \frac{\text{count}(w_{i-1}, w_i)}{\text{count}(w_{i-1})}$$

- **困惑度**用于衡量语言模型对测试集的预测能力。它是测试集概率的倒数，并经过词数归一化处理：

$$\text{PPL} = P(w_1, \ldots, w_N)^{-1/N} = \exp\!\left(-\frac{1}{N} \sum_{i=1}^{N} \log P(w_i \mid w_{<i})\right)$$

- 较低的困惑度意味着模型对测试数据的预测更“符合预期”，因此性能更好。对于一个在包含10,000个词的词汇表上赋予均匀概率的模型，其困惑度为10,000；一个优秀的大词袋模型可能将困惑度控制在200左右；现代神经语言模型的困惑度甚至可低于20。

- 请注意，困惑度实际上是交叉熵的指数形式（参见第05章的信息论内容）。训练过程中最小化交叉熵损失，就能直接降低困惑度。

- **平滑处理**用于解决零概率问题：如果某个n-gram在训练数据中从未出现，模型会将其概率设为0，从而导致整个句子的概率为0。**拉普拉斯平滑**（加1平滑）会给每个n-gram增加一个很小的计数：

$$P_{\text{Laplace}}(w_i \mid w_{i-1}) = \frac{\text{count}(w_{i-1}, w_i) + 1}{\text{count}(w_{i-1}) + V}$$

- 但对于大型词汇表而言，这种方法过于激进（它会从已观测到的n-gram中“窃取”过多概率）。**Kneser-Ney平滑**是n-gram模型的黄金标准，它结合了两种思路：绝对折扣以及回退时的延续概率。

- 首先，**绝对折扣**会从每个已观测计数中减去一个固定的折扣值$d$（通常$d \approx 0.75$），而不是添加伪计数。被释放出的概率质量会被重新分配给未见过的n-gram。其插值形式为：

$$P_{\text{KN}}(w_i \mid w_{i-1}) = \frac{\max(\text{count}(w_{i-1}, w_i) - d, \; 0)}{\text{count}(w_{i-1})} + \lambda(w_{i-1}) \cdot P_{\text{cont}}(w_i)$$

- 其中$\lambda(w_{i-1})$是一个用于分配被折扣掉的概率的质量的归一化常数。关键创新在于**延续概率**$P_{\text{cont}}(w_i)$，它衡量的是词$w_i$出现在多少种不同的上下文中的次数，而非其总体出现的频率：

$$P_{\text{cont}}(w_i) = \frac{|\{w' : \text{count}(w', w_i) > 0\}|}{|\{(w', w'') : \text{count}(w', w'') > 0\}|}$$

- 分子统计的是语料中出现在$w_i$之前的不同的词的数量。像“Francisco”这样的词只出现在少数上下文中（几乎总是跟在“San”之后），因此即便“San Francisco”出现频率很高，“Francisco”的延续概率也会很低，从而不会在其他上下文中被错误地预测出来。

- 相反，像“the”这样的常用词可以出现在许多不同词之后，因此其延续概率较高。这反映了一种直觉：在回退估计中，词语的通用性比其原始频率更为重要。

- 几十年来，n-gram模型一直是最先进的技术。它们速度快、可解释性强，且无需训练（只需计数即可）。但它们在处理长距离依赖问题上存在局限（例如句子“The keys that I left on the table **are** missing”需要识别出主语“keys”为复数，而它与动词相距较远）。从RNN到Transformer，神经语言模型解决了这一难题。

## 编程任务（请使用CoLab或笔记本）（续1）

1. 使用动态规划实现莱文斯坦编辑距离。在单词对上进行测试，并将其用于简单的拼写纠正。

```python
import jax.numpy as jnp

def edit_distance(s, t):
    """Compute Levenshtein edit distance using DP."""
    m, n = len(s), len(t)
    D = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        D[i][0] = i
    for j in range(n + 1):
        D[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s[i-1] == t[j-1]:
                D[i][j] = D[i-1][j-1]
            else:
                D[i][j] = 1 + min(D[i-1][j], D[i][j-1], D[i-1][j-1])

    return D[m][n]

# Test
pairs = [("kitten", "sitting"), ("sunday", "saturday"), ("hello", "hallo")]
for s, t in pairs:
    print(f"d('{s}', '{t}') = {edit_distance(s, t)}")

# Simple spelling correction
dictionary = ["the", "their", "there", "then", "than", "this", "that", "these", "those"]
misspelled = "thier"
corrections = sorted(dictionary, key=lambda w: edit_distance(misspelled, w))
print(f"\nClosest to '{misspelled}': {corrections[:3]}")
```

1. 从零实现BPE分词算法。从字符级令牌开始，逐步合并出现频率最高的令牌对。

```python
from collections import Counter

def get_pairs(corpus):
    """Count adjacent token pairs across all words."""
    pairs = Counter()
    for word, freq in corpus.items():
        symbols = word.split()
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i+1])] += freq
    return pairs

def merge_pair(pair, corpus):
    """Merge all occurrences of a pair in the corpus."""
    new_corpus = {}
    bigram = ' '.join(pair)
    replacement = ''.join(pair)
    for word, freq in corpus.items():
        new_word = word.replace(bigram, replacement)
        new_corpus[new_word] = freq
    return new_corpus

# Training corpus with word frequencies
text = "low low low low low lower lower newest newest newest newest newest newest"
word_freqs = Counter(text.split())
# Initialise: split each word into characters with end-of-word marker
corpus = {' '.join(word) + ' _': freq for word, freq in word_freqs.items()}

print("Initial corpus:")
for word, freq in corpus.items():
    print(f"  {word}: {freq}")

# Run BPE for 10 merges
for i in range(10):
    pairs = get_pairs(corpus)
    if not pairs:
        break
    best_pair = max(pairs, key=pairs.get)
    corpus = merge_pair(best_pair, corpus)
    print(f"\nMerge {i+1}: {best_pair} (freq={pairs[best_pair]})")
    for word, freq in corpus.items():
        print(f"  {word}: {freq}")
```

1. 构建一个二元语言模型，并计算测试句子的困惑度。尝试使用拉普拉斯平滑技术。

```python
from collections import Counter, defaultdict
import math

# Training corpus
train = """the cat sat on the mat . the dog chased the cat .
the cat ran from the dog . a dog sat on a mat .""".split()

# Count bigrams and unigrams
bigrams = Counter(zip(train[:-1], train[1:]))
unigrams = Counter(train)
vocab_size = len(set(train))

def bigram_prob(w2, w1, alpha=0):
    """P(w2 | w1) with optional Laplace smoothing."""
    return (bigrams[(w1, w2)] + alpha) / (unigrams[w1] + alpha * vocab_size)

# Compute perplexity
test = "the cat sat on a mat .".split()

for alpha in [0, 1, 0.1]:
    log_prob = 0
    for w1, w2 in zip(test[:-1], test[1:]):
        p = bigram_prob(w2, w1, alpha=alpha)
        if p > 0:
            log_prob += math.log(p)
        else:
            log_prob += float('-inf')

    ppl = math.exp(-log_prob / (len(test) - 1)) if log_prob > float('-inf') else float('inf')
    print(f"Smoothing α={alpha}: perplexity = {ppl:.2f}")
```

1. 从零实现TF-IDF，并利用余弦相似度找出与查询最相似的文档。

```python
import jax.numpy as jnp
import math
from collections import Counter

documents = [
    "the cat sat on the mat",
    "the dog chased the cat around the park",
    "a mat was placed on the floor by the door",
    "the quick brown fox jumped over the lazy dog",
]

# Build vocabulary
vocab = sorted(set(word for doc in documents for word in doc.split()))
word_to_idx = {w: i for i, w in enumerate(vocab)}
V = len(vocab)
N = len(documents)

# Compute TF-IDF matrix
doc_freq = Counter()
for doc in documents:
    for word in set(doc.split()):
        doc_freq[word] += 1

tfidf_matrix = jnp.zeros((N, V))
for i, doc in enumerate(documents):
    word_counts = Counter(doc.split())
    for word, count in word_counts.items():
        tf = 1 + math.log(count)
        idf = math.log(N / doc_freq[word])
        j = word_to_idx[word]
        tfidf_matrix = tfidf_matrix.at[i, j].set(tf * idf)

# Query
query = "cat on the mat"
query_vec = jnp.zeros(V)
query_counts = Counter(query.split())
for word, count in query_counts.items():
    if word in word_to_idx:
        tf = 1 + math.log(count)
        idf = math.log(N / doc_freq.get(word, 1))
        query_vec = query_vec.at[word_to_idx[word]].set(tf * idf)

# Cosine similarity (from chapter 01)
def cosine_sim(a, b):
    return jnp.dot(a, b) / (jnp.linalg.norm(a) * jnp.linalg.norm(b) + 1e-8)

print(f"Query: '{query}'\n")
for i, doc in enumerate(documents):
    sim = cosine_sim(query_vec, tfidf_matrix[i])
    print(f"  Doc {i} (sim={sim:.3f}): '{doc}'")
```

## 嵌入模型与序列模型

_词嵌入将稀疏的、基于符号的文本压缩为密集的向量空间，在该空间中，语义相似性就表现为几何上的接近性。本文件介绍了Word2Vec（CBOW、Skip-gram）、GloVe、FastText、RNN、LSTM、GRU、带注意力机制的seq2seq模型，以及从“词袋模型”到上下文感知表示的演变过程。_

- 在文件01中，我们提出了分布假设：出现在相似上下文中的词往往具有相似的含义。在文件02中，我们使用TF-IDF向量这类稀疏的、手工构建的特征来表示文本。这些向量存在于极高维的空间中（每个词汇对应一个维度），且大部分元素为0。**词嵌入**则将这些信息压缩为密集的、低维的向量，从而捕捉语义关系，而这些向量是直接从数据中学习得到的。

- **Word2Vec**（Mikolov等人，2013年）通过在一个简单的预测任务上训练浅层神经网络来学习词嵌入。该模型有两种架构。

- **连续词袋模型（CBOW）**通过目标词周围的上下文词来预测该目标词。给定一组上下文词（例如“the cat ___ on the”），该模型会计算这些词的嵌入向量的平均值，再将结果通过线性层来预测缺失的词（即“sat”）。其训练目标是最大化以下概率：

$$P(w_t \mid w_{t-k}, \ldots, w_{t-1}, w_{t+1}, \ldots, w_{t+k})$$

- **Skip-gram**模型则采用相反的方式：给定一个目标词，预测其周围的上下文词。对于目标词“sat”，该模型会分别尝试预测“the”、“cat”、“on”等词。其训练目标是最大化以下概率：

$$P(w_{t+j} \mid w_t) \quad \text{对于所有 } j \in [-k, k], \; j \neq 0$$

![CBOW与Skip-gram模型的结构对比：CBOW通过平均上下文词的嵌入向量来预测中心词，而Skip-gram则利用中心词的嵌入向量来预测各个上下文词](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/word2vec_architectures.svg)

- Skip-gram模型在处理稀有词时表现更好，因为每个词可以生成多个训练样本（每个上下文位置一个样本）。而CBOW模型速度更快，且在处理常见词时略优，因为它能对多个上下文信号进行平均处理。

- 对整个词汇表进行训练的成本很高，因为softmax函数的分母需要遍历所有的$V$个词。**负采样**通过将问题转化为二分类任务来近似解决这一问题：区分真正的上下文词（正样本）和随机抽取的噪声词（负样本）。模型无需计算完整的softmax值，只需更新目标词、真实上下文词以及少量负样本的嵌入向量即可：

$$\mathcal{L} = \log \sigma(v_{w_O}^T v_{w_I}) + \sum_{i=1}^{k} \mathbb{E}_{w_i \sim P_n} [\log \sigma(-v_{w_i}^T v_{w_I})]$$

- 其中，$v_{w_I}$是输入词の嵌入向量，$v_{w_O}$是输出词（上下文词）的嵌入向量，$P_n$是噪声分布，通常为单词出现频率的3/4次方（这一处理方式会降低像“the”这样出现频率极高的词的权重）。

- 为什么这个简单的目标函数能够生成有意义的嵌入向量呢？Levy和Goldberg（2014年）指出，带有负采样的Skip-gram模型实际上是在对**偏移点积互信息（PMI）**矩阵进行分解。当模型收敛时，两个词向量的点积可近似为：

$$v_w^T v_c \approx \text{PMI}(w, c) - \log k$$

- 其中，$\text{PMI}(w, c) = \log \frac{P(w, c)}{P(w) P(c)}$用于衡量词$w$和$c$同时出现的概率比随机情况下的高出多少（详见第05章信息论内容），而$k$则是负样本的数量。那些同时出现概率远高于随机水平的词，其PMI值较高，因此点积也较大（嵌入向量较为相似）；而那些同时出现概率低于随机水平的词，其PMI值为负，嵌入向量则不相似。这表明Word2Vec所做的其实与传统的分布式语义方法（如基于共现矩阵的隐语义分析，即SVD）类似，只不过它的实现方式更具可扩展性，且属于在线学习方式。

- Word2Vec嵌入向量最令人惊讶的特性在于，它们可以通过向量运算来表达**类比关系**。向量$v_{\text{king}} - v_{\text{man}} + v_{\text{woman}}$的值最接近$v_{\text{queen}}$。这是因为嵌入空间将语义关系编码为近似线性的方向：表示“王室成员”关系的方向大致为$v_{\text{king}} - v_{\text{man}}$，将其加到$v_{\text{woman}}$上后，结果就会接近$v_{\text{queen}}$。这与第01章中介绍的线性代数概念相呼应：语义关系实际上就是向量间的平移。

- **GloVe**（Pennington等人，2014年）采用了不同的方法。它不是逐个从局部上下文窗口中学习，而是先构建一个全局词共现矩阵$X$，其中$X_{ij}$表示在整个语料库中，词$j$在词$i$的上下文中出现的频率。然后，模型会学习这样的嵌入向量，使得这些向量的点积近似等于词对的共现对数：

$$w_i^T \tilde{w}_j + b_i + \tilde{b}_j = \log X_{ij}$$

- 损失函数通过一个限制函数$f(X_{ij})$来对每对词进行加权，从而避免那些出现频率过高的词对占据主导地位：

$$\mathcal{L} = \sum_{i,j=1}^{V} f(X_{ij}) \left(w_i^T \tilde{w}_j + b_i + \tilde{b}_j - \log X_{ij}\right)^2$$

- GloVe结合了全局矩阵分解（如隐语义分析）的优点与Word2Vec的局部上下文学习优势。在实际应用中，GloVe和Word2Vec生成的嵌入向量质量相当。

- **FastText**（Bojanowski等人，2017年）在Skip-gram模型的基础上进行了改进，它将每个词表示为一系列字符n-gram的组合。例如，对于单词“where”，当$n=3$时，它会被表示为“<wh”、“whe”、“her”、“ere”、“re>”，再加上整个单词的令牌“<where>”。该词的嵌入向量则是所有这些n-gram嵌入向量的总和。
- 这一方法具有显著优势：FastText能够为训练过程中从未出现过的单词生成嵌入向量。由于“whereabouts”与“where”存在n-gram关联，因此即使该词从未出现在训练数据中，其嵌入向量也会是合理的。这对于那些词汇形态变化复杂的语言来说尤其有用（参见文件01）。

- **嵌入向量评估**通常采用两种基准测试方法。**类比任务**用于验证$v_a - v_b + v_c \approx v_d$这一关系是否成立（例如：“Paris”－“France”＋“Italy”≈“Rome”）。**相似性基准测试**则将词对之间的余弦相似度与人类判断结果进行比较。常用的数据集包括WordSim-353、SimLex-999以及Google类比测试集。需要注意的是：在类比任务中表现优异的嵌入向量，未必适用于情感分类等下游任务。最有效的评估方式往往是直接针对具体任务来进行测试。

- 在第06章中，我们介绍了作为序列数据处理架构的RNN、LSTM和GRU。在这里，我们将重点探讨它们在语言处理任务中的具体应用方式。

- **语言模型RNN**会逐个读取令牌，并在每一步预测下一个令牌。隐藏状态$h_t$会将整个历史序列$w_1, \ldots, w_t$压缩成一个固定大小的向量，随后通过线性层与softmax函数将这个向量映射到词汇表上的各个概率分布上。训练过程是通过交叉熵损失来实现的，其目标与最小化困惑度是相同的（参见文件02）。这种架构的一个关键限制在于：固定大小的隐藏状态必须包含关于整个历史序列的所有信息，而早期令牌的信息会逐渐被后续信息覆盖。

- **双向RNN**能够从两个方向处理序列：一个RNN从左到右读取序列，另一个则从右到左读取。在每个位置$t$，正向隐藏状态$\overrightarrow{h}_t$与反向隐藏状态$\overleftarrow{h}_t$会被合并在一起，形成一种能够感知上下文的表示形式$h_t = [\overrightarrow{h}_t ; \overleftarrow{h}_t]$。这样一来，模型就可以同时获取过去和未来的上下文信息，这对于词性标注和命名实体识别等任务非常有用（参见文件02），因为这些任务的输出结果取决于单词前后左右的单词。不过，双向RNN无法用于语言建模，因为在预测下一个单词时无法查看未来的内容。

![双向RNN：正向RNN从左到右读取序列并生成隐藏状态，反向RNN从右到左读取，两者的输出在每个位置都会被合并起来](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bidirectional_rnn.svg)

- **深度堆叠RNN**则是将多个RNN层堆叠在一起。第$l$层在所有时间步的隐藏状态会成为第$l + 1$层的输入序列。通常，堆叠2-4层就能提升性能，因为这样可以构建出层次化的表示结构，这与深度CNN构建特征层次结构的方式类似（参见第06章）。如果层数超过4层，就会出现梯度消失和过拟合的问题，除非在层与层之间加入残差连接。

- **序列到序列（seq2seq）**架构（Sutskever等人，2014年）可以将长度可变的输入序列转换为长度可变的输出序列。该架构由一个**编码器RNN**组成，它负责读取输入并将之压缩成一个上下文向量（即最终的隐藏状态）；另一个**解码器RNN**则根据这个上下文向量，逐个生成输出令牌。

![Seq2seq编码器-解码器结构：编码器RNN从左到右读取输入令牌，最终得到的隐藏状态会被作为初始状态传递给解码器RNN，解码器则通过自回归方式生成输出令牌](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/seq2seq_architecture.svg)

- Seq2seq架构是机器翻译领域的重大突破。编码器负责读取法语句子，解码器则负责生成对应的英语翻译。解码器从一个特殊的起始令牌开始，然后通过自回归方式逐步生成输出令牌，直到生成结束令牌为止。一个实用的技巧是反转输入序列的顺序（将“le chat”改为“chat le”），这样可以让第一个输入词在计算图中更靠近第一个输出词，从而缩短梯度传播路径，提升性能。

- 这种架构存在一个瓶颈问题：整个输入序列必须被压缩成一个固定大小的向量。对于较长的句子来说，这样的向量无法包含所有信息，从而导致性能下降。这便催生了**注意力机制**的出现。

- 第06章介绍了现代的Q、K、V形式的注意力机制。而早期的自然语言处理注意力机制则是以另一种方式设计的，即通过编码器与解码器状态之间的对齐来实现。

- **Bahdanau注意力机制**（加性注意力机制，Bahdanau等人，2015年）通过一个经过训练的前馈网络，来计算解码器隐藏状态$s_t$与每个编码器隐藏状态$h_i$之间的对齐分数：

$$e_{ti} = v^T \tanh(W_s s_{t-1} + W_h h_i)$$

- 这些分数会通过softmax函数被标准化为注意力权重，而上下文向量则是各编码器状态按权重求和得到的结果：

$$\alpha_{ti} = \frac{\exp(e_{ti})}{\sum_j \exp(e_{tj})}, \quad c_t = \sum_i \alpha_{ti} h_i$$

- 解码器随后会利用$s_{t-1}$和$c_t$来生成下一个输出令牌。其核心思想是：不是使用一个固定的上下文向量来表示整个句子，而是让解码器的每一步都获得不同的编码器状态组合，这样模型就可以“回溯”到输入序列中的相关部分。

- **Luong注意力机制**（乘性注意力机制，Luong等人，2015年）则简化了分数的计算过程。其中**点积型**公式为$e_{ti} = s_t^T h_i$；而**通用型**公式则为$e_{ti} = s_t^T W h_i$。这类机制比Bahdanau的加性机制更快，因为它们使用矩阵乘法而非前馈网络。此外，Luong注意力机制是从当前的解码器状态$s_t$来计算上下文向量的，而不是$s_{t-1}$，这使得模型能够获取更多信息，但计算方式略有不同。

![源句子与其译文之间的注意力对齐热图，显示每个目标词关注了哪些源词，颜色越亮表示注意力权重越高](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/attention_alignment.svg)

- 注意力权重通常以热图形式呈现，展示解码器在生成每个输出词时所关注的输入符号。在翻译任务中，这些热图大致反映了源语言与目标语言之间的词汇对应关系，不过由于语序的不同（例如法语和英语中形容词与名词的顺序不同），这种对应关系会被打乱。

- 在推理阶段，解码器需要在每一步选择一个符号。**贪婪解码**方法会在每一步选择概率最高的符号，但这可能导致次优的序列结果：某个局部上最优的选择可能会让模型生成整体上较差的句子。**束搜索**方法则会在每一步保留最多$k$个候选序列，通过为每个序列添加所有可能的后续符号来扩展它们，最终选出整体上最好的$k$个序列。

- 当束宽度$k = 1$时，束搜索就退化为贪婪解码。通常的束宽度范围是$k = 4$到$k = 10$。更大的束宽度虽然能找到更好的序列，但计算速度也会相应变慢。束搜索还需要进行**长度归一化**处理，以避免偏好较短的序列——因为较短序列的总体概率通常更高，其计算量也更少。归一化后的得分公式为：

$$\text{score}(y) = \frac{1}{|y|^\alpha} \sum_{t=1}^{|y|} \log P(y_t \mid y_{<t})$$

其中$|y|$表示序列长度，$\alpha$（通常取0.6-0.7）用于控制长度惩罚的强度。当$\alpha = 0$时，不进行长度归一化；当$\alpha = 1$时，得分即为每个符号的对数概率（即几何平均值）。适中的$\alpha$值可以在追求简洁的输出与避免过早截断之间取得平衡。

- 虽然RNN是按顺序处理文本的，但**1D卷积神经网络**则是通过让滤波器在符号序列上滑动来并行处理文本。每个滤波器能够检测出局部的模式（即n-gram特征）。

- **TextCNN**（Kim，2014年）将多个不同宽度的1D卷积滤波器（如3、4、5个符号宽度）应用于输入的嵌入矩阵。每个滤波器都会生成一个特征图，随后通过**时间最大值池化**从每个特征图中选取最大的值，从而确定该模式是否出现在文本的任意位置。所有滤波器生成的特征图会被拼接起来，再传递给分类器。

![TextCNN架构：输入嵌入向量依次经过宽度为3、4、5的并行卷积滤波器，每个滤波器之后都进行时间最大值池化处理，之后这些特征图会被拼接并送入全连接分类器](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/textcnn_architecture.svg)

- TextCNN在文本分类任务中表现迅速且效果出色，比如情感分析任务。它能够捕捉局部的n-gram模式，但却无法处理长距离依赖关系：宽度为5的滤波器只能看到连续的5个符号。**扩张因果卷积**通过在滤波器元素之间插入间隔来解决这个问题。通过堆叠具有逐层递增的扩张率的层（1、2、4、8……），模型的感受野可以呈指数级扩大，而参数数量却不会增加，这样模型就能捕捉到数百个符号之间的依赖关系。

- 到目前为止所讨论的所有嵌入模型（Word2Vec、GloVe、FastText）都是为每种词类型生成同一个向量，而不考虑上下文。无论是表示金融机构还是河岸，“bank”这个词得到的嵌入向量都是相同的。这是一个根本性的局限性，而**上下文嵌入模型**则解决了这一问题。

- **ELMo**（Peters等人，2018年）通过在对输入文本运行深度双向LSTM语言模型来生成具有上下文意义的词表示。正向LSTM负责预测每个位置的下一个词，而反向LSTM则负责预测前面的词。这两种LSTM模型都是在大规模语料库上作为语言模型进行训练的。

- 在第$k$个位置上，ELMo会利用特定于任务的权重，将所有$L$层的隐藏状态结合起来：

$$\text{ELMo}_k = \gamma \sum_{j=0}^{L} s_j \, h_{k,j}$$

其中$h_{k,j}$是第$k$个位置、第$j$层的隐藏状态（第0层为原始的符号嵌入），$s_j$是经过softmax归一化的标量权重，$\gamma$则是特定于任务的缩放因子。不同的层负责捕捉不同的信息：较低层负责捕捉句法信息（词性标注、词形结构），较高层则负责捕捉语义信息（词义、语义角色）。通过用学习到的权重将所有层的输出混合起来，ELMo嵌入模型能够适应各种不同的下游任务。

- ELMo标志着**先预训练再微调**这一处理范式的诞生：首先在大量无标签文本上训练大型语言模型，然后再利用该模型的表示结果来处理其他任务。ELMo具体是将预训练得到的表示结果作为固定或稍作调整的特征，再与特定于任务的输入数据拼接在一起。BERT和GPT（文件04）则进一步发展了这一理念，它们会对整个模型进行端到端的微调，其效果明显更好。

- 从Word2Vec到ELMo的发展历程体现了自然语言处理领域的一个常见趋势：从静态的表示向动态的表示发展，从局部上下文向全局上下文发展，从浅层模型向深层模型发展。每一步都在计算成本与更丰富的表示效果之间取得平衡。Transformer模型（文件04）则通过完全用注意力机制取代循环结构，实现了更深层次的上下文理解以及并行计算，从而完成了这一发展进程。

## 编程任务（可使用CoLab或笔记本完成）

1. 从零开始实现带有负采样功能的Word2Vec跳字模型。在一个小型语料库上进行训练，然后使用PCA技术可视化所学到的嵌入向量。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Small corpus
corpus = """the king ruled the kingdom . the queen ruled the kingdom .
the prince is the son of the king . the princess is the daughter of the queen .
a man worked in the castle . a woman worked in the castle .
the king and queen lived in the castle . the prince and princess played outside .""".lower().split()

vocab = sorted(set(corpus))
word2idx = {w: i for i, w in enumerate(vocab)}
idx2word = {i: w for w, i in word2idx.items()}
V = len(vocab)

# Generate skip-gram pairs with window size 2
window = 2
pairs = []
for i, word in enumerate(corpus):
    for j in range(max(0, i - window), min(len(corpus), i + window + 1)):
        if i != j:
            pairs.append((word2idx[word], word2idx[corpus[j]]))

pairs = jnp.array(pairs)
print(f"Vocabulary: {V} words, Training pairs: {len(pairs)}")

# Model parameters
embed_dim = 16
key = jax.random.PRNGKey(42)
k1, k2 = jax.random.split(key)
W_in = jax.random.normal(k1, (V, embed_dim)) * 0.1    # input embeddings
W_out = jax.random.normal(k2, (V, embed_dim)) * 0.1   # output embeddings

# Negative sampling loss for one pair
def neg_sampling_loss(W_in, W_out, target, context, neg_ids):
    v_in = W_in[target]      # (embed_dim,)
    v_out = W_out[context]   # (embed_dim,)
    v_neg = W_out[neg_ids]   # (k, embed_dim)

    pos_loss = -jax.nn.log_sigmoid(jnp.dot(v_in, v_out))
    neg_loss = -jnp.sum(jax.nn.log_sigmoid(-v_neg @ v_in))
    return pos_loss + neg_loss

# Training loop
num_neg = 5
lr = 0.05

@jax.jit
def train_step(W_in, W_out, target, context, neg_ids):
    loss, (g_in, g_out) = jax.value_and_grad(neg_sampling_loss, argnums=(0, 1))(
        W_in, W_out, target, context, neg_ids)
    return loss, W_in - lr * g_in, W_out - lr * g_out

key = jax.random.PRNGKey(0)
for epoch in range(50):
    total_loss = 0.0
    for i in range(len(pairs)):
        key, subkey = jax.random.split(key)
        neg_ids = jax.random.randint(subkey, (num_neg,), 0, V)
        loss, W_in, W_out = train_step(W_in, W_out, pairs[i, 0], pairs[i, 1], neg_ids)
        total_loss += loss
    if (epoch + 1) % 10 == 0:
        print(f"Epoch {epoch+1}: avg loss = {total_loss / len(pairs):.4f}")

# Visualise with PCA (chapter 01)
embeddings = W_in
mean = embeddings.mean(axis=0)
centered = embeddings - mean
U, S, Vt = jnp.linalg.svd(centered, full_matrices=False)
coords = centered @ Vt[:2].T  # project onto top 2 PCs

plt.figure(figsize=(10, 8))
for i, word in idx2word.items():
    plt.scatter(coords[i, 0], coords[i, 1], c='#3498db', s=40)
    plt.annotate(word, (coords[i, 0] + 0.02, coords[i, 1] + 0.02), fontsize=9)
plt.title("Word2Vec Skip-gram Embeddings (PCA projection)")
plt.grid(alpha=0.3); plt.show()
```

1. 构建一个基于字符级的RNN语言模型，使其能够从少量的训练文本生成新的文本。

```python
import jax
import jax.numpy as jnp

# Tiny training text
text = "to be or not to be that is the question "
chars = sorted(set(text))
char2idx = {c: i for i, c in enumerate(chars)}
idx2char = {i: c for c, i in char2idx.items()}
V = len(chars)
data = jnp.array([char2idx[c] for c in text])

# RNN parameters
hidden_dim = 64
key = jax.random.PRNGKey(0)
k1, k2, k3, k4, k5 = jax.random.split(key, 5)

params = {
    'Wx': jax.random.normal(k1, (V, hidden_dim)) * 0.1,
    'Wh': jax.random.normal(k2, (hidden_dim, hidden_dim)) * 0.05,
    'bh': jnp.zeros(hidden_dim),
    'Wy': jax.random.normal(k3, (hidden_dim, V)) * 0.1,
    'by': jnp.zeros(V),
}

def rnn_step(params, h, x_idx):
    x = jnp.eye(V)[x_idx]  # one-hot
    h = jnp.tanh(x @ params['Wx'] + h @ params['Wh'] + params['bh'])
    logits = h @ params['Wy'] + params['by']
    return h, logits

def loss_fn(params, inputs, targets):
    h = jnp.zeros(hidden_dim)
    total_loss = 0.0
    for t in range(len(inputs)):
        h, logits = rnn_step(params, h, inputs[t])
        log_probs = jax.nn.log_softmax(logits)
        total_loss -= log_probs[targets[t]]
    return total_loss / len(inputs)

grad_fn = jax.jit(jax.grad(loss_fn))

# Training
inputs = data[:-1]
targets = data[1:]
lr = 0.01

for step in range(500):
    grads = grad_fn(params, inputs, targets)
    params = {k: params[k] - lr * grads[k] for k in params}
    if (step + 1) % 100 == 0:
        l = loss_fn(params, inputs, targets)
        print(f"Step {step+1}: loss = {l:.4f}")

# Generate text
def generate(params, seed_char, length=60):
    h = jnp.zeros(hidden_dim)
    idx = char2idx[seed_char]
    result = [seed_char]
    key = jax.random.PRNGKey(42)
    for _ in range(length):
        h, logits = rnn_step(params, h, idx)
        key, subkey = jax.random.split(key)
        idx = jax.random.categorical(subkey, logits)
        result.append(idx2char[int(idx)])
    return ''.join(result)

print(f"\nGenerated: {generate(params, 't')}")
```

1. 实现一个基于Bahdanau注意力机制的简单seq2seq模型，用于实现序列的反转操作。并可视化该注意力对齐矩阵。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

# Task: reverse a sequence of digits (e.g., [3, 1, 4] -> [4, 1, 3])
vocab_size = 10  # digits 0-9
SOS, EOS = 10, 11  # special tokens
total_vocab = 12
embed_dim, hidden_dim = 16, 32
max_len = 5

key = jax.random.PRNGKey(42)
keys = jax.random.split(key, 8)

params = {
    'embed': jax.random.normal(keys[0], (total_vocab, embed_dim)) * 0.1,
    'enc_Wx': jax.random.normal(keys[1], (embed_dim, hidden_dim)) * 0.1,
    'enc_Wh': jax.random.normal(keys[2], (hidden_dim, hidden_dim)) * 0.05,
    'dec_Wx': jax.random.normal(keys[3], (embed_dim, hidden_dim)) * 0.1,
    'dec_Wh': jax.random.normal(keys[4], (hidden_dim, hidden_dim)) * 0.05,
    # Bahdanau attention
    'Ws': jax.random.normal(keys[5], (hidden_dim, hidden_dim)) * 0.1,
    'Wh_att': jax.random.normal(keys[6], (hidden_dim, hidden_dim)) * 0.1,
    'v_att': jax.random.normal(keys[7], (hidden_dim,)) * 0.1,
    # Output projection (from hidden + context to vocab)
    'Wo': jax.random.normal(keys[0], (hidden_dim * 2, total_vocab)) * 0.1,
}

def encode(params, seq):
    """Encode input sequence, return all hidden states."""
    h = jnp.zeros(hidden_dim)
    states = []
    for t in range(len(seq)):
        x = params['embed'][seq[t]]
        h = jnp.tanh(x @ params['enc_Wx'] + h @ params['enc_Wh'])
        states.append(h)
    return jnp.stack(states), h

def bahdanau_attention(params, dec_state, enc_states):
    """Compute Bahdanau attention weights and context vector."""
    scores = jnp.tanh(enc_states @ params['Wh_att'] + dec_state @ params['Ws'])
    e = scores @ params['v_att']  # (src_len,)
    alpha = jax.nn.softmax(e)
    context = alpha @ enc_states
    return context, alpha

def decode_step(params, dec_h, prev_token, enc_states):
    x = params['embed'][prev_token]
    dec_h = jnp.tanh(x @ params['dec_Wx'] + dec_h @ params['dec_Wh'])
    context, alpha = bahdanau_attention(params, dec_h, enc_states)
    combined = jnp.concatenate([dec_h, context])
    logits = combined @ params['Wo']
    return dec_h, logits, alpha

def seq2seq_loss(params, src, tgt):
    enc_states, enc_final = encode(params, src)
    dec_h = enc_final
    loss = 0.0
    prev_token = SOS
    for t in range(len(tgt)):
        dec_h, logits, _ = decode_step(params, dec_h, prev_token, enc_states)
        log_probs = jax.nn.log_softmax(logits)
        loss -= log_probs[tgt[t]]
        prev_token = tgt[t]
    return loss / len(tgt)

# Generate training data: reverse sequences
key = jax.random.PRNGKey(0)
train_srcs, train_tgts = [], []
for _ in range(200):
    key, subkey = jax.random.split(key)
    length = jax.random.randint(subkey, (), 3, max_len + 1)
    key, subkey = jax.random.split(key)
    seq = jax.random.randint(subkey, (int(length),), 0, vocab_size)
    train_srcs.append(seq)
    train_tgts.append(seq[::-1])  # reverse

# Training
grad_fn = jax.grad(seq2seq_loss)
lr = 0.01

for epoch in range(100):
    total_loss = 0.0
    for src, tgt in zip(train_srcs, train_tgts):
        grads = grad_fn(params, src, tgt)
        params = {k: params[k] - lr * grads[k] for k in params}
        total_loss += seq2seq_loss(params, src, tgt)
    if (epoch + 1) % 20 == 0:
        print(f"Epoch {epoch+1}: avg loss = {total_loss / len(train_srcs):.4f}")

# Visualise attention for one example
test_src = jnp.array([3, 1, 4, 1, 5])
test_tgt = test_src[::-1]

enc_states, enc_final = encode(params, test_src)
dec_h = enc_final
attentions = []
prev_token = SOS
for t in range(len(test_tgt)):
    dec_h, logits, alpha = decode_step(params, dec_h, prev_token, enc_states)
    attentions.append(alpha)
    prev_token = test_tgt[t]

att_matrix = jnp.stack(attentions)
fig, ax = plt.subplots(figsize=(6, 5))
im = ax.imshow(att_matrix, cmap='Blues')
ax.set_xlabel("Source position"); ax.set_ylabel("Target position")
src_labels = [str(int(x)) for x in test_src]
tgt_labels = [str(int(x)) for x in test_tgt]
ax.set_xticks(range(len(src_labels))); ax.set_xticklabels(src_labels)
ax.set_yticks(range(len(tgt_labels))); ax.set_yticklabels(tgt_labels)
for i in range(len(tgt_labels)):
    for j in range(len(src_labels)):
        ax.text(j, i, f"{att_matrix[i,j]:.2f}", ha='center', va='center', fontsize=9)
ax.set_title("Bahdanau Attention Alignment (sequence reversal)")
plt.colorbar(im); plt.tight_layout(); plt.show()
```

## 变换器与语言模型

_变换器用自注意力机制取代了循环结构，从而成为处理语言理解与生成任务的主流架构。本文件介绍了BERT、GPT、T5等模型，以及位置编码技术（正弦编码、RoPE）、预训练目标函数（MLM、CLM）、微调方法、提示工程技巧，还有决定现代大型语言模型性能的关键原理。_

- 在第06章中，我们介绍了变换器的基本架构：自注意力、多头注意力、位置编码以及编码器-解码器结构。在这里，我们将重点探讨如何将变换器应用于特定的自然语言处理任务，那些定义了现代自然语言处理领域的模型（BERT、GPT、T5），以及让这些模型能够在大规模应用中正常运行的技术。

- 先回顾一下核心操作：**缩放点积注意力**的计算公式为$\text{softmax}(QK^T / \sqrt{d_k}) V$，其中查询向量、键向量和值向量都是输入数据的线性变换结果。**多头注意力**则同时运行$h$个独立的注意力模块，每个模块都有不同的权重矩阵，最终将各模块的输出拼接在一起。变换器块还会通过残差连接、层归一化以及逐位置的前馈网络来完善这一结构（详见第06章）。

- 一个看似细微但至关重要的架构设计选择就是**层归一化的放置位置**。最初的变换器采用**后归一化**方式：即先进行子层运算，然后再进行归一化，公式为$\text{LayerNorm}(x + \text{Sublayer}(x))$。

- 而大多数现代模型则采用**前归一化**方式：即在子层运算之前先进行归一化，公式为$x + \text{Sublayer}(\text{LayerNorm}(x))$。前归一化在训练过程中更为稳定，因为残差连接会让梯度直接通过恒等路径传递，不会受到归一化操作的影响。这使得在训练非常深的模型时无需特别调整学习率。

- 每个变换器块中的**前馈子层**实际上是一个两层结构的多层感知机，该结构会独立地应用于每个令牌位置：

$$\text{FFN}(x) = W_2 \cdot \text{GELU}(W_1 x + b_1) + b_2$$

- 其内部维度通常是模型总维度的4倍（例如，当$d_{\text{model}} = 768$时，$d_{\text{ff}} = 3072$）。这个前馈层约占每个变换器块中参数总量的三分之二，它被认为起到了类似键值存储的作用，用于保存在训练过程中学到的事实性知识。

- **位置编码**的作用是为模型提供关于令牌顺序的信息，因为注意力机制本身是对排列顺序不敏感的。最初的**正弦编码**方式（见第06章）是使用不同频率的正弦和余弦函数来表示位置信息。而**学习得到的位置嵌入**则是为每个位置添加一个可训练的向量（BERT和GPT-2就采用了这种方式）。这两种编码都属于绝对编码：无论上下文如何，第5个位置的向量始终相同。

- **旋转位置嵌入（RoPE）**则是通过在二维子空间中旋转查询向量与键向量来实现位置编码。对于一对维度为$(q_{2i}, q_{2i+1})$的向量，会以角度$m\theta_i$对其进行旋转（其中$m$代表位置编号，$\theta_i = 10000^{-2i/d}$）。

$$
\begin{bmatrix} q'_{2i} \\ q'_{2i+1} \end{bmatrix} = \begin{bmatrix} \cos m\theta_i & -\sin m\theta_i \\ \sin m\theta_i & \cos m\theta_i \end{bmatrix} \begin{bmatrix} q_{2i} \\ q_{2i+1} \end{bmatrix}

$$

![RoPE：在二维子空间中，每个位置都会以不同的角度旋转查询向量与键向量，因此注意力分数仅取决于相对位置](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/rope_rotation.svg)

- RoPE的优点在于，经过旋转后的查询向量与键向量之间的点积$q'^T k'$仅取决于相对位置$m - n$，而与绝对位置无关。

- 要理解这一点，可以将旋转表示为$q' = R_m q$和$k' = R_n k$，其中$R_m$是一个块对角形式的旋转矩阵。此时注意力分数可表示为：

$$q'^T k' = (R_m q)^T (R_n k) = q^T R_m^T R_n \, k = q^T R_{n-m} \, k$$

- 最后一步的推导基于旋转群的性质：$R_m^T R_n = R_{n-m}$（先旋转$m$步再旋转$n$步，相当于直接旋转$n - m$步）。

- 这意味着注意力分数仅取决于相对距离$n - m$，而与单独的绝对位置$m$和$n$无关。

- 该模型无需任何学习得到的位置参数即可自然地理解距离概念，而且能够处理训练过程中未曾出现过的序列长度。

- **ALiBi**（带线性偏置的注意力机制）采用了更为简单的方法：它根据距离为注意力分数添加一个固定的线性惩罚项，即$\text{score}_{ij} = q_i^T k_j - m \cdot |i - j|$，其中$m$是特定于某个注意头的斜率值。不同的注意头使用不同的斜率，这样一些注意头可以专注于局部信息，而另一些则可以处理全局信息。ALiBi不需要任何位置相关的学习参数，且能够很好地处理比训练数据更长的序列。

- 基于变换器的语言模型的三种主要架构分别是**仅编码器型**、**仅解码器型**以及**编码器-解码器型**。它们之间的区别在于模型能够获取的信息范围（即注意力掩码），以及训练方式的不同。

![三种变换器架构：用于分类任务的仅编码器型模型BERT，采用双向注意力机制；用于生成任务的仅解码器型模型GPT，采用因果注意力机制；而编码器-解码器型模型T5则结合了这两种机制来处理序列到序列的任务](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/transformer_paradigms.svg)

- **BERT**（来自变换器的双向编码器表示，Devlin等人，2019年）是典型的仅编码器型模型。它通过完全的双向注意力机制来处理文本：每个令牌都可以与左右两侧的所有其他令牌建立关联。这使得BERT能够获得丰富的上下文信息，但同时也意味着它无法实现自回归式的文本生成。

- BERT通过两个目标进行预训练。**掩码语言建模（MLM）**会随机屏蔽输入文本中15%的令牌，然后训练模型来预测这些被屏蔽的令牌。在被选中的令牌中，80%会被替换为[MASK]令牌，10%会被替换为随机单词，还有10%保持不变（这样做是为了防止模型只学会在看到[MASK]时才进行预测）。其训练目标为：

$$\mathcal{L}_{\text{MLM}} = -\sum_{i \in \mathcal{M}} \log P(w_i \mid w_{\backslash \mathcal{M}})$$

- 其中$\mathcal{M}$表示被屏蔽的令牌集合，$w_{\backslash \mathcal{M}}$则表示那些令牌已被屏蔽后的句子。这是一个**去噪**目标：模型需要学会重构被破坏的输入内容。

![BERT的掩码语言建模：输入文本中15%的令牌被屏蔽，双向变换器会预测出这些被屏蔽位置上的原始令牌](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/bert_mlm.svg)

- **下一句预测（NSP）**则用于训练BERT，使其能够判断两句话在原文中是否是连续的。为此，会在输入文本的开头添加一个特殊的[CLS]令牌，用于进行二分类。虽然NSP有助于处理那些需要理解句子间关系的任务，如问答任务，但后续的研究（如RoBERTa）表明它的作用并不大，甚至可以省略。

- BERT的预训练结果可以通过在模型顶部添加一个特定于任务的模块（即一个简单的线性层），并对整个模型进行微调，从而应用于各种下游任务。对于分类任务，可以使用[CLS]令牌对应的表示；而对于令牌级任务（如命名实体识别、词性标注），则使用每个令牌对应的表示。这种**微调**方法能够将预训练阶段学到的语言知识应用到那些标注数据较少的新任务中。

- **GPT**（生成式预训练变换器，Radford等人，2018年）是典型的仅解码器型模型。它采用**因果（自回归）注意力机制**：每个令牌只能与之前出现的令牌（以及自身）建立关联。为了实现这一点，会在注意力矩阵中屏蔽未来的令牌位置，在应用softmax函数之前将这些位置的得分设为$-\infty$。其训练目标就是简单的**因果语言建模**：根据所有之前的令牌来预测下一个令牌。

$$\mathcal{L}_{\text{CLM}} = -\sum_{i=1}^{n} \log P(w_i \mid w_1, \ldots, w_{i-1})$$

- 这实际上与文件02中提到的n-gram语言模型目标相同，只不过这里的变换器模型能够利用整个前置上下文作为条件，而不仅仅是最近的$k-1$个令牌。

- **GPT-2**将模型的参数量提升到了15亿，而且表现出很强的零样本学习能力：无需任何微调，它就能根据自然语言提示（如“将英语翻译成法语：……”）来完成相关任务。

- **GPT-3**拥有1750亿个参数，它证明了仅仅通过增加参数规模，就能够实现**上下文内学习**：只要在提示中提供少量的输入-输出示例，模型就能在没有梯度更新的情况下完成新的任务。

- 像**T5**（文本到文本转换变换器，Raffel等人，2020年）这样的编码器-解码器模型，会将所有的自然语言处理任务视为文本到文本的任务：输入是一段文本（可能还带有类似“将英语翻译成德语：”这样的任务前缀），输出也是文本。编码器会通过双向注意力机制处理输入内容，而解码器则通过与编码器的交叉注意力机制，以自回归的方式生成输出文本。

- T5在预训练阶段会采用**片段破坏**技术：随机选择一些连续的令牌片段，并用特殊令牌替换它们，然后让模型重新生成原来的令牌。例如，“The cat sat on the mat”这个句子可能会被处理成“The [X] on [Y]”作为输入，而模型的目标则是生成“[X] cat sat [Y] the mat”。这实际上是BERT的MLM技术的一种扩展，只不过是从单个令牌扩展到了令牌片段层面。
- **BART**（Lewis等人，2020年）也是一种经过预训练的编解码器模型，其预训练目标为去噪处理，但它采用了更多种类的数据扰动策略：令牌遮蔽、令牌删除、片段遮蔽、句子重排以及文档旋转。这些多样的扰动方式迫使模型学习出更强大的表示能力。

- 随着语言模型规模的增大，**全量微调**（即更新所有参数）变得不切实际：一个拥有1750亿个参数的模型，仅存储优化器状态就需要数百GB的存储空间。**参数高效微调**方法则只调整其中一小部分参数。

- **适配器**会在现有的Transformer层之间插入一些小型瓶颈层（通常由两个线性层加上非线性函数构成：先将数据降维，然后再升维）。只有适配器的权重会被训练，而原始模型的权重则保持不变。这样虽然新增的参数不到5%，但在大多数任务上的性能却能与全量微调相媲美。

- **LoRA**（低秩适配）无需添加新层即可修改权重矩阵。它不是直接更新整个权重矩阵$W$，而是通过低秩分解的方式来实现更新：$W' = W + BA$，其中$B$是$d \times r$矩阵，$A$是$r \times d$矩阵，且$r \ll d$（通常$r = 4$到$r = 64$）。原始的$W$保持不变，只有$A$和$B$会被训练。在推理时，这些更新结果可以直接合并到原始权重中，不会带来额外的延迟：

$$W' = W + BA$$

![LoRA：通过小型矩阵A和B构成的低秩路径来绕过被冻结的权重矩阵W，从而使可训练参数的数量减少32倍，同时仍能达到全量微调的性能](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/lora_decomposition.svg)

- **前缀微调**是在每个注意力层的键值矩阵前添加一串可学习的“虚拟令牌”。模型会将这些前缀向量视为真实令牌来处理，因此只需训练这些前缀相关的参数。这种方法类似于提示词微调，只不过它在激活空间而非嵌入空间中进行操作。

- **提示工程**是一门设计输入文本的艺术，旨在无需更新任何参数就能让预训练模型表现出期望的行为。

- **零样本提示**是用自然语言描述任务，例如：“对以下评论进行情感分类：”。

- **少样本提示**是在实际查询之前提供一些输入输出示例。

- **思维链提示**则会在示例中加入“让我们一步步思考”之类的引导语，或包含推理过程，从而帮助模型分解问题，显著提升其在算术和逻辑推理任务上的表现。

- **上下文学习**是指大型语言模型能够仅通过提示中提供的示例来学习执行特定任务，而无需进行任何梯度更新。模型的权重不会发生变化，它会将这些示例视为一种隐式的指令。

- 上下文学习的具体机制仍是一个活跃的研究课题；有一种假设认为，注意力层在处理数据时会以某种形式实现梯度下降，从而在上下文示例的基础上“训练”模型。

- **规模定律**描述了模型大小、数据量、计算资源与性能（以损失值衡量）之间的规律性关系。Kaplan等人（2020年）发现，损失值与各个变量都遵循幂律关系：

$$L(N) \propto N^{-\alpha_N}, \quad L(D) \propto D^{-\alpha_D}, \quad L(C) \propto C^{-\alpha_C}$$

其中$N$是参数数量，$D$是数据集大小，$C$是计算资源。这些幂律关系在多个数量级上都成立，表明只要适当增加资源，性能就能得到可预测的提升。

![规模定律：在双对数坐标轴上，损失值呈幂律下降趋势，Kaplan和Chinchilla的研究表明，随着资源规模的增加，性能会呈现可预测的提升](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/scaling_laws.svg)

- **Chinchilla规模定律**（Hoffmann等人，2022年）对这一理论进行了修正，他们指出大多数大型模型都存在训练不足的问题。在固定的计算资源$C$下，最优的模型规模和训练数据量应该是相等的：

$$N_{\text{opt}} \propto C^{0.5}, \quad D_{\text{opt}} \propto C^{0.5}$$

这意味着，如果将计算资源增加一倍，那么模型规模和数据集大小都应该按$\sqrt{2}$的比例增加，而不仅仅是单纯扩大模型规模。

- Kaplan等人曾建议以比数据量更快的速度增加参数数量，但这会导致模型规模虽大但训练不足。Chinchilla模型拥有700亿个参数和1.4万亿个令牌，却在相同的计算资源下达到了与Gopher模型（2800亿参数、3000亿令牌）相当的性能，这充分说明了早期模型存在严重的数据不足问题。

- 一个实用的经验法则是：每个参数大约对应20个令牌的训练数据。

- **专家混合架构**是一种能够在不按相同比例增加计算成本的情况下提升模型处理能力的架构。该架构不再使用一个庞大的前馈层，而是采用多个“专家”前馈层，再加上一个**门控网络**来决定每个令牌应该由哪位“专家”来处理。

- 门控函数会为每位“专家”计算一个评分，然后选出排名靠前的$k$位专家（通常$k = 1$或$k = 2$）：

$$G(x) = \text{TopK}(\text{softmax}(W_g x))$$

只有被选中的专家才会处理该令牌，因此计算成本与$k$（即活跃的专家数量）成正比，而非与所有专家的总数$E$成正比。一个拥有8位专家且采用前两名专家处理的模型，其参数数量是密集型模型的4倍，但计算成本仅为后者的2倍。

![专家混合架构层：输入令牌首先经过门控网络，该网络为每位专家计算评分，选出排名靠前的2位专家，再根据评分权重对这两位专家的输出进行加权求和](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/moe_layer.svg)

- 在专家混合架构中，一个关键的挑战就是**负载均衡**：如果门控网络将大部分令牌都分配给少数几个常用的专家，那么其他专家就会被闲置。为了解决这个问题，训练过程中还会引入一个**负载均衡损失函数**，以促使所有专家都能得到均衡的使用：

$$\mathcal{L}_{\text{balance}} = E \cdot \sum_{i=1}^{E} f_i \cdot p_i$$

- 其中，$f_i$表示分配给专家$i$的令牌比例，$p_i$则是专家$i$的平均路由概率。当这些比例和概率都为均匀值时（即均为$1/E$），该乘积值达到最小。

- **专家并行架构**将不同的专家分配到不同的加速器上。在前向传播过程中，会通过全连接通信机制将令牌发送到对应专家所在的设备，然后再将处理结果传回。这种通信开销是大规模应用MoE架构时面临的主要工程挑战。Switch Transformer、Mixtral和GShard等模型正是利用MoE架构，在保持较高性能的同时还能控制推理成本。

- 构建模型只是工作的一半；判断模型是否有效则是另一半。自然语言处理任务的评估尤为困难，因为语言具有模糊性、主观性和开放性。

- 一种译文可以通过多种不同的方式做到正确；一篇摘要即便没有使用与原文完全相同的词汇，也仍可能是好的。

- 聊天机器人的回复可能既有用、无害且诚实，但合理的人士仍可能会对此提出异议。

- **精确匹配（EM）**是最简单的评估指标：模型的输出是否与标准答案完全一致？它被用于那些答案简短且无歧义的任务，比如抽取式问答（SQuAD）或封闭式数学问题。

- 精确匹配的标准较为严格；“New York City”和“new york city”除非经过规范化处理，否则不会被视为匹配——但其简单性使得评估结果十分明确。

- **令牌级指标**将自然语言处理视为令牌级别的分类问题，采用第06章中介绍的精确度、召回率和F1值来进行评估。

- **精确度**衡量的是模型预测的令牌中正确的比例：$P = \text{TP} / (\text{TP} + \text{FP})$。如果模型预测的实体数量很少，但全部正确，那么它的精确度就会很高。

- **召回率**则衡量的是模型找到的正确令牌占所有正确令牌的比例：$R = \text{TP} / (\text{TP} + \text{FN})$。如果模型将每个令牌都视为实体，那么它的召回率会是100%，但精确度却会很低。

- **F1值**则是精确度和召回率的调和平均值：

$$F_1 = \frac{2PR}{P + R}$$

- 调和平均值而非算术平均值能够更好地反映数据的不平衡情况：如果精确度或召回率较低，F1值也会相应降低。在命名实体识别任务中，F1值是针对每种实体类型分别计算的，然后再对所有类型进行宏观平均。而在词性标注任务中，由于每个令牌都会被赋予一个标签，因此更常用令牌级的准确率作为评估指标。

- **跨度级F1值**（用于SQuAD任务）是将预测结果中的令牌集合与标准答案中的令牌集合进行比较。相比精确匹配，这种方法更为宽容：如果标准答案是“埃菲尔铁塔”，而模型预测的结果也是“埃菲尔铁塔”，那么尽管精确匹配得分为0，但跨度级F1值仍然很高（5个令牌中有4个是相同的）。

- **BLEU值**（双语评估替代指标，Papineni等人，2002年提出）是机器翻译领域的经典评估指标。它通过计算候选译文与一个或多个参考译文之间的n元组重叠程度来给出评分。该评分既考虑了多个n元组级别上的精确度（从单元组到4元组），又加入了简洁性惩罚项：

$$\text{BLEU} = \text{BP} \cdot \exp\!\left(\sum_{n=1}^{N} w_n \log p_n\right)$$

- 其中，$p_n$是**修正后的n元组精确度**：候选译文中的每个n元组的出现次数会被限制在所有参考译文中出现的最大次数以内，从而避免像“the the the the”这样的无效候选译文获得过高分数。权重$w_n$通常为均匀分布（$w_n = 1/N$，其中$N=4$）。

- **简洁性惩罚项**$\text{BP} = \min(1, \exp(1 - r/c))$用于惩罚那些长度小于参考译文的候选译文（$c$为候选译文长度，$r$为参考译文长度）。如果没有这一惩罚，模型只需输出极少数的、非常安全的词汇，就能获得很高的精确度。

- 在整个语料库层面（对多句话进行平均），BLEU值与人类评判结果具有较好的相关性，但在单句话层面则关联度较低。

- BLEU值只奖励完全一致的n元组匹配，而无法识别有效的意译表达：例如“the cat is on the mat”和“a feline sits atop the rug”虽然意思相同，但二元组级别上没有任何重叠。

- BLEU值还完全忽略了召回率——那些只包含最常见词汇的候选译文，虽然精确度很高，但得分依然不错。

- **ROUGE值**（面向召回率的摘要评估指标，Lin，2004年提出）是摘要生成任务的标准评估指标。与注重精确度的BLEU不同，ROUGE更重视召回率：即参考译文中的n元组有多少出现在候选译文中？

- **ROUGE-N**用于计算n元组的召回率：$\text{ROUGE-N} = \frac{|\text{n-grams}_{\text{ref}} \cap \text{n-grams}_{\text{cand}}|}{|\text{n-grams}_{\text{ref}}|}$。其中，ROUGE-1（单元组）和ROUGE-2（二元组）最为常用。

- ROUGE-L则利用候选译文与参考译文之间的**最长公共子序列（LCS）**来评估，这种方法无需单词连续匹配，即可捕捉句子层面的词序信息。

- 通过将LCS的长度除以参考译文长度可以得到召回率，除以候选译文长度可以得到精确度，而F值则是两者的组合。

- LCS是通过动态规划算法在$O(mn)$时间内计算出来的（与文件02中介绍的编辑距离算法类似）：

$$R_{\text{LCS}} = \frac{\text{LCS}(X, Y)}{m}, \quad P_{\text{LCS}} = \frac{\text{LCS}(X, Y)}{n}, \quad F_{\text{LCS}} = \frac{(1 + \beta^2) R_{\text{LCS}} P_{\text{LCS}}}{R_{\text{LCS}} + \beta^2 P_{\text{LCS}}}$$

- 其中，$m$和$n$分别是参考译文和候选译文的长度，而$\beta$通常被设定为有利于提升召回率（当$\beta \to \infty$时，即为纯粹的召回率评估）。

- **METEOR值**（具有明确词序的翻译评估指标，Banerjee和Lavie，2005年提出）通过引入同义词、词干提取以及词序信息，弥补了BLEU的不足。

- 首先，该指标通过精确匹配、词干匹配（利用文件02中的Porter词干提取算法）以及同义词匹配（利用文件01中的WordNet数据库）来对候选译文与参考译文中的单词进行对齐。

- 接着，它计算以召回率为权重的单元组精确度和召回率的调和平均值，同时还会加入碎片化惩罚项，用来惩罚那些匹配单词的顺序与参考译文不同的候选译文。
- **ChrF**（字符n元组F分数）是基于字符n元组而非单词n元组来计算F分数的。这一特性使其能够有效应对形态变化问题（对于文件01中所涉及的黏着语来说尤为重要），同时还能在一定程度上解决分词方式不同带来的问题。ChrF++则在字符n元组的基础上加入了单词二元组。

- 它已成为机器翻译领域中与BLEU并列的推荐评估指标，尤其适用于那些形态变化复杂的语言。

- **困惑度**（文件02）用于衡量语言模型预测保留的测试集数据的准确程度。它是语言模型的标准内在评估指标：$\text{PPL} = \exp(-\frac{1}{N} \sum_{i} \log P(w_i \mid w_{<i}))$。数值越低越好。

- 只有使用相同分词方式的模型之间，其困惑度才有可比性；因为不同的分词器会对同一文本产生不同的序列长度$N$。

- 词汇量较大的模型，虽然每个令牌的困惑度较低，但每句话处理的令牌数量却较少。

- **每字节比特数**（BPB）是以文本中UTF-8字节的数量作为归一化依据，而非令牌数量，因此该指标与分词方式无关。

$$
\text{BPB} = \frac{-\sum_{i} \log_2 P(w_i \mid w_{<i})}{\text{number of UTF-8 bytes}}

$$

- **BERTScore**（张等人，2020年）通过计算嵌入空间中的相似度，超越了基于表面n-gram匹配的方法。候选文本中的每个令牌都会与其在参考文本中的最相似令牌进行匹配，这种匹配是依据上下文嵌入的余弦相似度来实现的（这些嵌入通常来自预训练的BERT模型）。这些分数会被汇总为精确度、召回率和F1值：

$$R_{\text{BERT}} = \frac{1}{|r|} \sum_{r_i \in r} \max_{c_j \in c} \cos(r_i, c_j), \quad P_{\text{BERT}} = \frac{1}{|c|} \sum_{c_j \in c} \max_{r_i \in r} \cos(c_j, r_i)$$

其中$r_i$和$c_j$分别是参考文本和候选文本令牌的上下文嵌入。这种方法能够捕捉到n-gram指标所无法体现的语义相似性：例如“automobile”和“car”的BERT嵌入值很相似，因此它们的得分很高，尽管这两个词没有任何字符上的共同点。

- **BLEURT**（Sellam等人，2020年）则进一步发展了这一技术，它直接根据人类对文本质量的评价来对BERT模型进行微调。对于给定的参考文本和候选文本对，该模型会输出一个数值型的质量评分。BLEURT首先在合成数据上接受训练——这些数据是对参考译文的随机扰动，随后会用BLEU、METEOR等指标对这些数据的质量进行评估，之后再根据人类的评价结果对模型进行微调。相比各种基于表面特征的指标，BLEURT与人类判断的结果更为吻合。

- **COMET**（Rei等人，2020年）是一种用于机器翻译评估的学习型指标，它在评估时不仅考虑参考文本和候选文本，还会考虑源文本。该模型使用多语言编码器（XLM-R）对这三者进行嵌入处理，进而预测出文本质量评分。由于能够看到源文本，COMET能够发现那些仅依靠参考文本无法检测到的语义错误——比如那些表达流畅但内容错误的译文。

- **以大型语言模型作为评估工具**是当前大规模评估任务所采用的一种现代方法。与其基于参考文本来计算各项指标，不如让强大的语言模型（如GPT-4、Claude）来评估模型输出的质量。评估者会收到输入内容、模型的响应，有时还会收到参考答案，然后给出评分（如1-5分）或判断哪个响应更好。

- **成对比较法**（用于Chatbot Arena）是“以大型语言模型作为评估工具”中最可靠的方法。评估者只需比较两个响应，选出更好的那个，而无需给出绝对分数。这样可以避免校准问题——不同的评估者对于“5分中的3分”这一标准可能会有不同的理解。最终的结果会被转化为类似国际象棋中的**埃洛评分**：每个模型都有一个初始评分，根据与其他模型的胜负情况来增减分数。模型A战胜模型B的概率为：

$$P(A \succ B) = \frac{1}{1 + 10^{(R_B - R_A) / 400}}$$

其中$R_A、R_B$分别是两个模型的埃洛评分。每次比较后，评分都会更新：$R_A' = R_A + K(S - P(A \succ B))$，这里$S \in \{0, 1\}$表示实际比较结果，$K$则决定了评分更新的幅度。那些总能击败强对手的模型，其评分会迅速上升；而那些总是输给弱对手的模型，评分则会下降。

- **顺序偏好偏差**是大型语言模型作为评估工具时存在的一个已知问题：它们往往更喜欢先出现的响应（在某些模型中，则是后出现的响应）。通过**交换顺序法**（即对每对响应都按两种顺序各评估一次，然后取平均值），可以缓解这一问题。

- **冗长性偏好偏差**也是另一个问题：即使简洁的回答更好，评估者也往往更喜欢长度更长、细节更多的响应。

- **自我一致性检查**用于判断评估者在多次评估同一输入时是否给出相同的评分。如果评分差异很大，就说明评估结果存在噪声。

- **评估者间一致性**（Cohen’s kappa或Krippendorff’s alpha）用于衡量多个评估者之间的意见一致性，从而为评估的可靠性提供上限。

- **数据污染**是一个亟需解决的问题：如果评估数据出现在模型的训练集中，那么基准测试的分数就会被高估，变得毫无意义。对于那些基于网络爬取的数据训练而成的大型语言模型来说，这个问题尤为严重，因为常见的基准测试数据很可能就存在于这些数据中。为了解决这个问题，可以采用以下策略：使用未公开发布的测试集、创建会定期生成新问题的动态基准测试、在基准数据中嵌入唯一标识符以检测数据泄露，以及分别对比受污染数据集和纯净数据集上的模型性能。

- **标准的自然语言理解基准测试**用于评估模型在各种任务中的语言理解能力。

- **GLUE**（通用语言理解评估）和**SuperGLUE**是多任务基准测试，涵盖情感分析（SST-2）、文本相似度检测（STS-B）、自然语言推理（MNLI、RTE）、共指识别（WSC）以及问答任务（BoolQ）。

- 模型会在每个任务上分别接受评估，最终通过综合指标来给出总分。目前GLUE的测试任务已经趋于饱和——大多数任务上模型的表现都已经超过人类水平；而SuperGLUE则仍然具有较高的挑战性。

- **MMLU**（大规模多任务语言理解）通过多项选择题来评估模型在57个学术领域（数学、历史、法律、医学、计算机科学等）中的知识储备和推理能力。

- 该测试旨在判断模型在预训练阶段是否掌握了广泛的知识。评分会按各个学科分别给出，同时也会给出整体平均分。

- **MMLU-Pro**则增加了更难的、需要多步推理的题目，每个题目有10个选项而非原来的4个。

- **HellaSwag**通过让模型选择某个场景中最合理的后续发展来测试其常识推理能力。错误的答案是通过特殊方法生成的，它们表面上看起来合理，但实际上在语义上是错误的。

- **WinoGrande**则通过使用仅有一个词不同的最小对来测试模型的常识共指识别能力。

- **ARC**（AI2推理挑战）使用小学阶段的科学问题，分为简单题和难题两组，用来测试模型的事实掌握能力和推理能力。

- **推理与数学基准测试**用于评估模型解决问题的能力，正是这种能力区分出了强大的大型语言模型和较弱的模型。
- **GSM8K**（小学数学8K）包含8,500道需要多步运算推理的小学数学应用题。它是衡量基本数学推理能力以及评估“链式思维”提示效果的标准基准（文件04）。

- **MATH**则是一组难度更高的竞赛级数学题，涵盖代数、数论、几何、计数和概率等内容。这些题目要求进行多步骤的符号推理，其中MATH-500是常用的500道题的子集。

- **AIME**（美国邀请数学竞赛）的题目也属于竞赛难度级别，要正确解答它们需要经过多步骤的深入数学推理。DeepSeek-R1在2024年的AIME考试中取得了79.8%的得分，这表明通过强化学习训练出的推理模型（文件05）已经能够接近人类优秀选手的水平。

- **HumanEval**和**MBPP**（主要是基础编程问题）则是通过检查模型生成的代码是否通过单元测试来评估其代码生成能力。HumanEval包含164道带有函数签名和文档字符串的Python题目，模型需要为这些函数编写具体的实现代码。

- 该领域的评估指标为**pass@k**：即$k$个生成解中至少有一个能通过所有测试的概率。对于单个样本而言：

$$\text{pass@}k = 1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}$$

其中$n$是生成的样本总数，$c$是通过测试的样本数。这个公式可以纠正仅选择$k$个样本中最优解所带来的偏差。

- **SWE-bench**则进一步考验模型是否能够通过修改现有代码库来解决真实的GitHub问题，这是对实际软件工程能力的更严格测试。

- **GPQA**（研究生级别的谷歌级问答测试）包含生物学、物理学和化学领域的专家级问题，就连相关领域的专家也很难回答。它旨在检验模型是否真正理解问题内容，而非只是进行模式匹配。“Diamond”子集则是其中最难的那一部分。

- **安全性与对齐性基准测试**则用于评估模型是否具备实用性、无害性以及诚实性。

- **TruthfulQA**用于检测模型是否会重复常见的错误观念。这些问题的设计使得互联网上最常见的答案都是错误的（例如“如果吞下口香糖会怎样？”——常见的错误说法是口香糖会在体内停留7年，而正确的答案是它会正常排出体外）。那些记住了这些错误信息的模型，其评分就会很低。

- **BBQ**（问答任务的偏见基准测试）用于检测模型在年龄、性别、种族和宗教等维度上的偏见。问题的设计方式使得有偏见的模型会系统地给出刻板印象式的答案。**Toxigen**则用于评估模型生成针对特定人群的恶意内容的倾向。

- **MT-Bench**通过80道精心设计的题目来评估模型的多轮对话能力，这些题目涉及写作、角色扮演、推理、数学、编程、信息提取、STEM领域以及人文科学等内容。由GPT-4担任评判模型，会对模型的回答给出1到10分的评分。这种多轮对话格式旨在测试模型是否能够跟进对话、保持上下文一致性，以及处理用户的澄清请求。

- **Chatbot Arena**（LMSYS开发）利用真实用户对匿名模型进行盲测对比。用户提交提问后，会在不知道答案来自哪个模型的情况下投票选出更好的回答。由此产生的Elo排名榜被认为是衡量通用大型语言模型质量的最具代表性的评估方式，因为它反映了用户在各种不同问题上的真实偏好。

- **AlpacaEval**通过将模型输出与参考模型（GPT-4）在固定指令集下的输出进行比较，来实现自动化的双向评估。由另一个评判模型来确定胜率。

- **AlpacaEval 2.0**则通过控制答案长度的方式来消除因答案过长而带来的偏差。

- 对于特定任务而言，需要采用专门的评估指标。

- 在语音识别领域，**词错误率（WER）**的计算公式为：$\text{WER} = (S + D + I) / N$，其中$S$、$D$、$I$分别代表替换错误、删除错误和插入错误，$N$则是参考词的数量。这一指标实际上是对编辑距离（文件02）按照参考词的长度进行标准化后的结果，是在单词层面进行的评估。

- 对于面向任务的对话系统而言，**Slot F1**指标用于衡量模型是否能从用户的话语中正确提取结构化信息（例如，从“帮我订明天去巴黎的航班”这句话中提取出“目的地：巴黎”和“日期：明天”等信息）。

- 对于RAG系统而言，**引用准确性**指标（文件05）用于检查模型生成的引用内容是否真的能够支持其所提出的观点。每个观点都会与检索到的相关文本进行比对，该指标会统计出那些完全得到支持、部分得到支持或根本得不到支持的观点所占的比例。

- 评估过程中存在一些常见的问题，这些问题可能会使整个基准测试的结果失去参考价值。

- **应试训练**：模型为了在基准测试中取得好成绩而进行优化，而非提升自身的真实能力。那些经过MMLU风格选择题训练的模型，在MMLU测试中表现优异，但在开放式问题测试中却可能表现不佳。

- **指标操纵**：模型可以被优化为能够产生在自动评估指标上得分较高的结果（如高BLEU值、低困惑度），但实际上其性能并不出色。那些经过BLEU指标优化的翻译结果往往只是安全的、泛化的改写版本，而非自然流畅的译文。

- **基准测试饱和现象**：当模型在某个基准测试中的表现接近或超过人类水平时，该基准测试就不再具有参考价值了。GLUE、SQuAD 1.1等基准测试都已经出现了饱和现象。

- 虽然该领域一直在不断创建更难的基准测试，但由于“创建—饱和—替代”的循环，很难进行长期性的对比分析。

- **人工评估**仍然是最权威的评估方式，但它成本高昂、耗时较长，且难以重复。不同的标注团队（如众包工作者与领域专家、不同文化背景的人、不同语言使用者）往往会给出不同的评估结果。因此，报告标注者之间的共识程度以及标注者的基本信息，对于确保评估结果的可靠性至关重要。

## 编程任务（可使用CoLab或笔记本完成）（续1）

1. 从零开始实现一个完整的Transformer编码器模块（多头注意力机制、前馈网络、残差连接以及层归一化）。将该模块应用于简单的序列分类任务中。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def layer_norm(x, gamma, beta, eps=1e-5):
    mean = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    return gamma * (x - mean) / jnp.sqrt(var + eps) + beta

def multi_head_attention(Q, K, V, W_q, W_k, W_v, W_o, n_heads):
    B, T, D = Q.shape
    head_dim = D // n_heads

    q = Q @ W_q  # (B, T, D)
    k = K @ W_k
    v = V @ W_v

    # Reshape to (B, n_heads, T, head_dim)
    q = q.reshape(B, T, n_heads, head_dim).transpose(0, 2, 1, 3)
    k = k.reshape(B, T, n_heads, head_dim).transpose(0, 2, 1, 3)
    v = v.reshape(B, T, n_heads, head_dim).transpose(0, 2, 1, 3)

    scores = q @ k.transpose(0, 1, 3, 2) / jnp.sqrt(head_dim)
    weights = jax.nn.softmax(scores, axis=-1)
    out = (weights @ v).transpose(0, 2, 1, 3).reshape(B, T, D)
    return out @ W_o, weights

def transformer_block(x, params):
    # Pre-norm multi-head self-attention
    normed = layer_norm(x, params['ln1_g'], params['ln1_b'])
    attn_out, weights = multi_head_attention(
        normed, normed, normed,
        params['W_q'], params['W_k'], params['W_v'], params['W_o'],
        n_heads=4
    )
    x = x + attn_out

    # Pre-norm feed-forward
    normed = layer_norm(x, params['ln2_g'], params['ln2_b'])
    ff = jax.nn.gelu(normed @ params['W1'] + params['b1'])
    ff = ff @ params['W2'] + params['b2']
    x = x + ff
    return x, weights

# Initialise parameters
d_model, d_ff, n_heads = 32, 128, 4
key = jax.random.PRNGKey(42)
keys = jax.random.split(key, 10)

params = {
    'W_q': jax.random.normal(keys[0], (d_model, d_model)) * 0.05,
    'W_k': jax.random.normal(keys[1], (d_model, d_model)) * 0.05,
    'W_v': jax.random.normal(keys[2], (d_model, d_model)) * 0.05,
    'W_o': jax.random.normal(keys[3], (d_model, d_model)) * 0.05,
    'ln1_g': jnp.ones(d_model), 'ln1_b': jnp.zeros(d_model),
    'ln2_g': jnp.ones(d_model), 'ln2_b': jnp.zeros(d_model),
    'W1': jax.random.normal(keys[4], (d_model, d_ff)) * 0.05,
    'b1': jnp.zeros(d_ff),
    'W2': jax.random.normal(keys[5], (d_ff, d_model)) * 0.05,
    'b2': jnp.zeros(d_model),
}

# Test with random input
x = jax.random.normal(keys[6], (2, 8, d_model))  # batch=2, seq_len=8
out, attn_weights = transformer_block(x, params)
print(f"Input shape:  {x.shape}")
print(f"Output shape: {out.shape}")
print(f"Attention weights shape: {attn_weights.shape}")  # (B, n_heads, T, T)

# Visualise attention patterns for each head
fig, axes = plt.subplots(1, 4, figsize=(16, 3.5))
for h in range(4):
    im = axes[h].imshow(attn_weights[0, h], cmap='Blues', vmin=0)
    axes[h].set_title(f"Head {h}")
    axes[h].set_xlabel("Key pos"); axes[h].set_ylabel("Query pos")
plt.suptitle("Multi-Head Attention Patterns")
plt.tight_layout(); plt.show()
```

1. 实现因果（自回归）注意力掩码，并将其与双向注意力进行比较。说明该掩码是如何阻止信息从未来的令牌传递到过去的令牌的。

```python
import jax
import jax.numpy as jnp
import matplotlib.pyplot as plt

def attention(Q, K, V, mask=None):
    d_k = Q.shape[-1]
    scores = Q @ K.T / jnp.sqrt(d_k)
    if mask is not None:
        scores = jnp.where(mask, scores, -1e9)
    weights = jax.nn.softmax(scores, axis=-1)
    return weights @ V, weights

seq_len, d_model = 6, 8
key = jax.random.PRNGKey(0)
k1, k2, k3 = jax.random.split(key, 3)
Q = jax.random.normal(k1, (seq_len, d_model))
K = jax.random.normal(k2, (seq_len, d_model))
V = jax.random.normal(k3, (seq_len, d_model))

# Bidirectional (encoder-style): all positions visible
bidir_mask = jnp.ones((seq_len, seq_len), dtype=bool)
bidir_out, bidir_weights = attention(Q, K, V, bidir_mask)

# Causal (decoder-style): only past and current positions visible
causal_mask = jnp.tril(jnp.ones((seq_len, seq_len), dtype=bool))
causal_out, causal_weights = attention(Q, K, V, causal_mask)

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
tokens = [f"t{i}" for i in range(seq_len)]

axes[0].imshow(bidir_weights, cmap='Blues', vmin=0, vmax=0.5)
axes[0].set_title("Bidirectional Attention\n(BERT-style)")
axes[0].set_xticks(range(seq_len)); axes[0].set_xticklabels(tokens)
axes[0].set_yticks(range(seq_len)); axes[0].set_yticklabels(tokens)

axes[1].imshow(causal_mask.astype(float), cmap='Greys', vmin=0, vmax=1)
axes[1].set_title("Causal Mask\n(1 = allowed, 0 = blocked)")
axes[1].set_xticks(range(seq_len)); axes[1].set_xticklabels(tokens)
axes[1].set_yticks(range(seq_len)); axes[1].set_yticklabels(tokens)

axes[2].imshow(causal_weights, cmap='Blues', vmin=0, vmax=0.5)
axes[2].set_title("Causal Attention\n(GPT-style)")
axes[2].set_xticks(range(seq_len)); axes[2].set_xticklabels(tokens)
axes[2].set_yticks(range(seq_len)); axes[2].set_yticklabels(tokens)

for ax in axes:
    ax.set_xlabel("Key"); ax.set_ylabel("Query")
plt.tight_layout(); plt.show()

# Verify: in causal attention, output at position i depends only on positions <= i
print("Causal attention weight at position 2 (should only attend to 0, 1, 2):")
print(f"  Weights: {causal_weights[2]}")
print(f"  Sum of future weights (should be ~0): {causal_weights[2, 3:].sum():.6f}")
```

1. 实现LoRA（低秩适配）技术，并展示该技术如何修改权重矩阵；与完全微调相比，这种方式所需的可训练参数要少得多。

```python
import jax
import jax.numpy as jnp

d_model = 256
rank = 4  # LoRA rank (much smaller than d_model)

key = jax.random.PRNGKey(42)
k1, k2, k3 = jax.random.split(key, 3)

# Original frozen weight matrix
W_frozen = jax.random.normal(k1, (d_model, d_model)) * 0.02

# LoRA matrices (only these are trainable)
B = jnp.zeros((d_model, rank))       # initialised to zero
A = jax.random.normal(k2, (rank, d_model)) * 0.01  # random init

# Forward pass: W_effective = W_frozen + B @ A
x = jax.random.normal(k3, (8, d_model))

# Without LoRA
y_original = x @ W_frozen.T

# With LoRA
W_effective = W_frozen + B @ A
y_lora = x @ W_effective.T

# Parameter counts
full_params = d_model * d_model
lora_params = d_model * rank + rank * d_model  # B + A

print(f"Model dimension: {d_model}")
print(f"LoRA rank: {rank}")
print(f"Full fine-tuning parameters: {full_params:,}")
print(f"LoRA parameters: {lora_params:,}")
print(f"Parameter reduction: {full_params / lora_params:.1f}x")
print(f"\nSince B is initialised to zeros, initial LoRA output matches original:")
print(f"  Max difference: {jnp.abs(y_original - y_lora).max():.2e}")

# Simulate training: only update A and B
def lora_forward(A, B, W_frozen, x):
    return x @ (W_frozen + B @ A).T

def dummy_loss(A, B, W_frozen, x, target):
    pred = lora_forward(A, B, W_frozen, x)
    return jnp.mean((pred - target) ** 2)

# Target: some transformation of x
target = x @ jax.random.normal(jax.random.PRNGKey(99), (d_model, d_model)).T * 0.02

grad_fn = jax.jit(jax.grad(dummy_loss, argnums=(0, 1)))
lr = 0.01

for step in range(200):
    gA, gB = grad_fn(A, B, W_frozen, x, target)
    A = A - lr * gA
    B = B - lr * gB

loss_before = dummy_loss(jnp.zeros_like(A), jnp.zeros_like(B), W_frozen, x, target)
loss_after = dummy_loss(A, B, W_frozen, x, target)
print(f"\nLoss before LoRA: {loss_before:.6f}")
print(f"Loss after LoRA:  {loss_after:.6f}")
print(f"Effective weight change rank: {jnp.linalg.matrix_rank(B @ A)}")
```

## 高级文本生成

_高级文本生成超越了传统的自回归解码方式，旨在提升文本质量、可控性和生成速度。本文档涵盖了文本扩散模型（D3PM、MDLM）、OCR技术、用于对齐的RLHF与DPO方法、长上下文处理技术（RoPE缩放、环形注意力机制）、检索增强生成，以及用于加速推理的推测性解码。_

- 标准的自回归生成（见文档04）采用从左到右、逐词生成的方式。这种方法简单且有效，但本质上是顺序处理的，无法进行全局规划，对输出结果的控制能力也有限。本文档介绍了超越传统自回归解码的方法：文本扩散模型、光学字符识别、基于人类反馈的可控生成、长上下文处理、检索增强生成，以及用于加速推理的推测性解码。

- **文本扩散模型**将扩散框架（第08章中针对图像介绍的框架）应用于离散文本。其核心挑战在于文本是离散的：无法像对像素那样向令牌中添加连续的高斯噪声。已有多种方法解决了这一问题。

- **D3PM**（离散去噪扩散概率模型，Austin等人，2021年）利用转移矩阵直接在离散令牌上定义前向腐蚀过程。在每一步中，某个令牌有一定概率被另一个令牌替换（均匀噪声）、被掩码化（吸收状态），或保持不变。逆向过程则学习去噪，从被腐蚀的令牌中预测出原始令牌。第$t$步的转移矩阵$Q_t$决定了腐蚀程度：

$$q(x_t \mid x_{t-1}) = \text{Cat}(x_t ; \, x_{t-1} Q_t)$$

其中$\text{Cat}$表示分类分布，$x$为独热向量。多步前向过程$q(x_t \mid x_0)$有封闭形式：$q(x_t \mid x_0) = \text{Cat}(x_t ; \, x_0 \bar{Q}_t)$，这里$\bar{Q}_t = Q_1 Q_2 \cdots Q_t$表示到第$t$步为止所有转移矩阵的乘积。训练时通过最小化变分下界（ELBO）来优化模型，该下界在时间步上分解，类似于连续情况（第08章）：

$$\mathcal{L}_{\text{D3PM}} = D_{\text{KL}}(q(x_T \mid x_0) \| p(x_T)) + \sum_{t=2}^{T} D_{\text{KL}}(q(x_{t-1} \mid x_t, x_0) \| p_\theta(x_{t-1} \mid x_t)) - \log p_\theta(x_0 \mid x_1)$$

第一项确保完全腐蚀后的分布与先验分布（均匀分布或全掩码状态）一致。多个KL项的总和用于训练模型以逆转每一步的腐蚀过程：真实的逆向后验分布$q(x_{t-1} \mid x_t, x_0)$可利用贝叶斯法则和已知的转移矩阵以封闭形式计算，而模型$p_\theta(x_{t-1} \mid x_t)$则被训练以匹配该分布。

由于两个分布均为分类分布，KL散度只需对词汇表中的每个词条求和即可得出。最后一项用于衡量从腐蚀程度最低的状态出发的重建质量。

- **MDLM**（掩码扩散语言模型，Sahoo等人，2024年）简化了D3PM，仅使用掩码操作作为腐蚀方式：前向过程逐步用[MASK]令牌替换原令牌，逆向过程则预测出原始令牌。这将文本扩散与掩码语言建模（BERT，见文档04）联系起来，其中扩散时间步决定了被掩码的令牌比例。当$t = 0$时文本完全干净；当$t = T$时文本完全被掩码。

- **连续文本扩散**通过在连续嵌入空间中操作来避开离散性问题。令牌首先被映射为其嵌入向量（见第06章），噪声在该连续空间中被加入，随后由去噪模型（通常是Transformer）学习逆转这一过程。生成时，模型产生连续向量，再通过寻找最近的嵌入向量将其映射回离散令牌。不过，连续空间中的微小误差可能导致完全不同的令牌被选中，因此需要进行仔细的四舍五入与截断处理。

![文本扩散过程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/text_diffusion.svg)

- 文本扩散模型的优势在于它能通过迭代精炼同时生成所有令牌，而非从左到右依次生成。这种方式有助于保证全局连贯性，并能轻松完成文本填充（即在段落中间生成缺失内容）。不过目前文本扩散模型在长文本生成质量上仍逊于自回归模型。

- **文本OCR**（光学字符识别）是指从图像中提取文本的任务。虽然传统上它并不被归入语言生成范畴，但现代OCR系统已与自然语言处理深度整合，并越来越多地采用语言模型组件。

- **场景文本检测**旨在定位自然图像中的文本区域（如路牌、产品标签、车牌等）。由于现实场景中的文本可能以任意角度、尺度、字体出现，且背景复杂，因此检测颇具挑战性。检测方法通常利用CNN或Transformer骨干网络来生成文本区域的边界框或分割掩码。

- **CRNN**（卷积循环神经网络，Shi等人，2017年）是一种经典的文本识别架构。CNN从文本图像中提取视觉特征，特征图被切分为一系列列（每个水平位置对应一列），双向LSTM则读取这一序列以建模上下文信息。输出结果通过**CTC**（连接时序分类）进行解码，该方法无需显式分割即可处理输入列与输出字符之间的对齐问题。

- CTC解决的核心问题是：模型会产生$T$个输出分布（每个输入列对应一个），而目标文本仅有$L \leq T$个字符。我们并不知道哪些列对应哪些字符。CTC引入了**空白令牌**$\epsilon$，并定义了多对一的映射$\mathcal{B}$，用于合并重复字符并去除空白：$\mathcal{B}(\text{"HH-ee-ll-ll-oo"}) = \text{"Hello"}$（其中“-”代表空白）。
- 目标序列$y$的概率等于所有能映射到$y$的输入对齐路径的概率之和：

$$P(y \mid x) = \sum_{\pi \in \mathcal{B}^{-1}(y)} \prod_{t=1}^{T} P(\pi_t \mid x)$$

- 其中$\pi$是一条长度为$T$的对齐路径（每列一个标签，包括空白符）。直接对所有路径求和是指数级的，但**前向算法**（第05章关于隐马尔可夫模型的内容）利用动态规划在$O(T \cdot L)$时间内高效计算出该总和。

- 空白符至关重要：没有它，“Hello”中的重复字符“ll”就无法与单个“l”区分开来。训练过程旨在最大化$\log P(y \mid x)$，而在推理阶段，则通过束搜索或贪心解码从CTC输出中找出最优路径。

- **文档OCR**用于处理结构化文档（发票、表格、学术论文），除了识别字符外还需理解文档布局。像LayoutLM这样的现代系统将文本识别与空间位置特征相结合：每个令牌既获得其文本嵌入，也获得编码其在页面上$(x, y)$坐标的位置嵌入。这使得模型能够识别出出现在“Total:”下方的数字即为总金额。

![CRNN OCR流程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/crnn_ocr_pipeline.svg)

- 像TrOCR这样的**视觉-语言OCR**模型将文本识别视为图像到文本的生成任务：由视觉Transformer编码器处理图像，再由语言模型解码器逐字符生成文本。这种方法充分利用了预训练视觉模型和语言模型的能力，无需手工设计特征即可处理各种文字、字体和布局。

- **可控生成**是指引导语言模型产生具有特定属性输出的挑战：特定的风格、主题、情感、安全级别或事实准确性。模型应在保持流畅性和连贯性的同时遵循指令。

- 用于文本生成的**无分类器引导（CFG）**借鉴了图像生成中的技术。训练时，条件信号（如提示词）会在一定比例的时间内被随机丢弃，从而在同一过程中同时训练条件模型和无条件模型。推理时，输出对数概率会进行插值计算：

$$\text{logits}_{\text{guided}} = (1 + w) \cdot \text{logits}_{\text{conditional}} - w \cdot \text{logits}_{\text{unconditional}}$$

- 其中$w > 0$用于放大条件的影响。较大的$w$会使输出更严格地遵循提示词，但会降低多样性。

- **RLHF**（基于人类反馈的强化学习，Ouyang等人，2022年）是使语言模型符合人类偏好的主流方法。其过程分为三个阶段：

- 首先，**监督微调（SFT）**：用高质量的人类撰写的提示词响应数据集对基础语言模型进行微调。

- 其次，**奖励模型训练**：收集人类比较数据（给定提示词$x$和两个响应$y_1, y_2$，哪个更好？），并训练奖励模型$r_\phi(x, y)$来预测人类偏好。奖励模型采用成对排序损失进行训练：

$$\mathcal{L}_{\text{RM}} = -\log \sigma(r_\phi(x, y_w) - r_\phi(x, y_l))$$

- 其中$y_w$为更受偏好的响应，$y_l$为不受偏好的响应。

- 第三，**强化学习微调**：优化语言模型以最大化奖励，同时尽量贴近SFT模型（防止模式崩溃）。这一过程使用PPO（近端策略优化，见第06章）并结合KL惩罚项：

$$\mathcal{L}_{\text{RL}} = -\mathbb{E}\left[r_\phi(x, y) - \beta \, D_{\text{KL}}(\pi_\theta \| \pi_{\text{SFT}})\right]$$

- KL项可防止模型偏离基础模型太远，从而避免利用奖励模型的漏洞进行“奖励作弊”。

![RLHF流程](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/rlhf_pipeline.svg)

- **DPO**（直接偏好优化，Rafailov等人，2023年）通过完全摒弃奖励模型简化了RLHF。其核心数学洞察是：上述受KL约束的强化学习目标存在闭式最优策略：

$$\pi^\ast(y \mid x) = \frac{1}{Z(x)} \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)$$

- 其中$Z(x)$为归一化配分函数。由此可推导出奖励函数：$r(x, y) = \beta \log \frac{\pi^\ast(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)$。将这一隐式奖励代入Bradley-Terry偏好模型$P(y_w \succ y_l) = \sigma(r(x, y_w) - r(x, y_l))$后，难以处理的$Z(x)$项会被抵消，从而直接得到DPO损失：

$$\mathcal{L}_{\text{DPO}} = -\log \sigma\!\left(\beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}\right)$$

- 这在数学上等价于RLHF，但却将奖励模型和强化学习训练合并为一步监督学习。

- sigmoid函数内的表达式可以理解为：“相对于参考模型，提高受偏好响应的相对概率，降低不受偏好响应的相对概率。”

- 参数$\beta$控制策略偏离参考模型的程度。实践中，DPO更易实现（只需计算当前模型和参考模型下两种完成结果的对数概率），且避免了PPO训练的不稳定性。

- **宪法AI**（Bai等人，2022年）实现了对齐过程的部分自动化。它不依赖人类比较数据，而是让语言模型根据一套原则（“宪法”）自行评判并修正其输出，例如“选择危害较小的响应”。随后，AI生成的比较数据被用于偏好训练（RLAIF：基于AI反馈的强化学习）。

- **长上下文方法**解决了标准自注意力机制带来的$O(n^2)$内存和计算成本问题，这些问题限制了序列长度。当$n$达到数万甚至数十万令牌时，标准注意力机制便不再可行。
- **稀疏注意力**用稀疏模式替代密集的$n \times n$注意力矩阵，使得每个令牌仅关注其他令牌的子集。常见的模式包括**局部注意力**（每个令牌关注固定大小的邻域窗口）、**步长注意力**（每隔$k$个令牌进行关注）以及**随机注意力**（关注随机子集）。这些模式的组合（如BigBird、Longformer中所用）能在保持捕捉局部与全局依赖能力的同时，将计算复杂度降至$O(n)$或$O(n \sqrt{n})$。

![稀疏注意力模式](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/sparse_attention_patterns.svg)

- **滑动窗口注意力**限制每个令牌只能关注前$w$个令牌（即其局部窗口）。这种方式的计算复杂度为$O(nw)$而非$O(n^2)$，但长距离信息必须通过各层间重叠的窗口来传递。若共有$L$层且窗口大小为$w$，则有效的感受野为$L \times w$个令牌。

- **环形注意力**通过将长序列排列成环形拓扑结构，将其分布到多个设备上处理。每台设备负责序列的一部分并计算该部分的注意力，同时把键-值块发送给环中的下一台设备。这种方式将计算与通信重叠进行，使得序列长度仅受限于所有设备的总内存容量，而非单台设备的内存限制。

- **记忆增强模型**通过为Transformer配备外部记忆库来扩展上下文。在每一层中，模型可利用注意力机制从记忆库中读取或写入数据。记忆型Transformer会缓存先前片段中的键-值对，并在后续片段中加以利用，从而有效延伸超出训练窗口的上下文。为了提升效率，检索过程采用近似方法（基于缓存键的$k$近邻搜索）。

- 上述方法属于针对长上下文的**架构层面**解决方案。同样重要的是模型如何被**训练**以有效利用长上下文。

- **渐进式上下文扩展**是标准做法。从一开始就训练极长序列的成本过高（$O(n^2)$的注意力计算开销），因此模型先在较短的上下文长度（通常为4K–8K令牌）下进行预训练，随后通过**继续预训练**分阶段扩展到目标长度。

- Llama 3.1在800B令牌的数据量上从8K逐步扩展到128K令牌；DeepSeek-V3则先在4K令牌上训练，再扩展到32K，最后达到128K令牌。

- 每个阶段使用的令牌数量相对较少（相对于整个预训练预算而言），因为模型只需学习如何使用更长的位置，而无需重新学习语言本身。

- 扩展过程中必须调整位置编码。**RoPE插值法**会缩小位置索引，使模型看到的旋转角度与训练时相同，只是分布在更长的序列上。如果模型在长度$L$下训练，而要扩展到$L' = 4L$，只需将所有位置索引除以4即可。

- 这意味着模型永远不会遇到未曾见过的旋转角度，但相邻位置间的有效分辨率会降低。

- **RoPE外推法**则保持原有的位置索引不变，直接对超过$L$的位置应用RoPE，依靠模型对未见角度的泛化能力。

- 插值法更为稳定；若不调整基频（ABF），外推法的性能会迅速下降。

- **YaRN**（另一种RoPE扩展方法）改进了简单的插值法，它认识到并非所有RoPE维度都应被同等对待。

- 高频维度（$\theta_i = \theta_{\text{base}}^{-2i/d}$中较小的$i$）在训练长度内会旋转多次，因此能较好地外推。

- 低频维度（较大的$i$）旋转缓慢，对长度扩展更为敏感。

- YaRN仅对低频维度进行插值，对高频维度则直接外推，并对注意力对数分值应用温度缩放参数$t$以补偿分布偏移：

$$\text{score}'_{ij} = \frac{q_i^T k_j}{t \sqrt{d_k}}$$

- 其中$t > 1$会使注意力分布趋于平坦，防止在位置信号被压缩时模型过度聚焦于邻近令牌。

- **长上下文数据筛选**是一项关键却常被忽视的挑战。大多数预训练语料由短文档组成（新闻文章、网页、社交媒体帖子）。

- 长上下文训练需要能够充分利用整个上下文窗口的数据类型：书籍、代码仓库、长篇科学论文、多轮对话记录，以及主题相关的文档拼接而成的内容。

- 如果模型仅在经过填充或打包以填满上下文窗口的短文档上训练，它会学会忽略远距离的令牌，因为这些令牌从未发挥过作用。

- **序列打包**是一种提升训练效率的技术：将多个文档拼接成一个训练序列以避免填充带来的浪费，同时通过注意力掩码防止跨文档的注意力干扰。

- 对于长上下文训练而言，打包策略至关重要：打包大量无关的短文档会让模型认为远距离令牌是噪声；而打包少量真正较长的文档则能促使模型充分利用整个上下文。

- 一种常见的失效现象是**“中间丢失”现象**（Liu等人，2023年）：语言模型能有效利用上下文窗口开头和结尾的信息，却难以处理位于中间的信息。

- 这种现象类似于人类记忆中的序列位置效应（首因效应与近因效应）。

- 其成因部分源于训练数据的分布特征（重要信息常出现在文档的开头或结尾），部分源于注意力模式倾向于集中于邻近及初始令牌。

- 通过让关键信息在上下文中多样化分布来进行长上下文训练，虽能缓解但无法完全解决这一问题。
- **“大海捞针”**评估用于测试模型能否从冗长的干扰文本（“草堆”）中检索出特定的事实（“针”）。

- 具备真正长上下文能力的模型，无论“针”位于何处，都应能实现近乎完美的检索。

- 该测试能清晰揭示“中间丢失效应”，并用于评估各种上下文扩展方法。

- 预训练后的**长上下文微调**采用有针对性的SFT数据：长篇多轮对话、证据分散在数千个令牌中的文档问答、长篇摘要生成以及代码库级理解。

- 在此阶段，Qwen3使用**双块注意力（DCA）**机制，将长序列处理为成对的块：块内注意力是全连接的，而块间注意力则高效处理，从而在微调过程中将有效序列容量提升4倍。

- **状态空间模型（SSM）**提供了一种截然不同的长序列建模方式。它们并非修改注意力机制，而是用受连续时间控制理论启发的线性动态系统来完全取代注意力机制。

- SSM通过以下方式将输入序列$u(t)$映射为输出$y(t)$：利用潜态$x(t) \in \mathbb{R}^N$进行转换：

$$x'(t) = Ax(t) + Bu(t), \quad y(t) = Cx(t) + Du(t)$$

- 其中，$A \in \mathbb{R}^{N \times N}$是状态转移矩阵，$B \in \mathbb{R}^{N \times 1}$是输入投影矩阵，$C \in \mathbb{R}^{1 \times N}$是输出投影矩阵，$D$为跳过连接。

- 为了将其应用于离散序列（令牌），需使用步长$\Delta$对连续系统进行**离散化**。零阶保持离散化公式为：

$$\bar{A} = \exp(\Delta A), \quad \bar{B} = (\Delta A)^{-1}(\exp(\Delta A) - I) \cdot \Delta B$$

- 离散递推关系变为$x_k = \bar{A} x_{k-1} + \bar{B} u_k$，$y_k = C x_k + D u_k$，其形式类似于RNN：每次处理一个令牌并更新隐藏状态。

- 与RNN不同，这种递推关系也可展开为**全局卷积**：由于系统是线性的，输出可表示为$y = \bar{K} \ast u$，其中卷积核$\bar{K} = (C\bar{B}, \, C\bar{A}\bar{B}, \, C\bar{A}^2\bar{B}, \ldots)$仅取决于固定参数。

- 这种**双重视角**——递归结构适用于高效的自回归推理（每步仅需$O(1)$计算量），卷积结构适用于高效的并行训练（通过FFT可实现$O(n \log n)$复杂度）——正是SSM的核心优势。

![SSM双重视角：推理时使用递归，训练时使用卷积，以及Mamba的选择性扩展功能](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/ssm_dual_view.svg)

- **S4**（结构化状态空间模型，Gu等人，2022年）解决了关键的数值难题，从而使SSM得以实际应用：状态矩阵$A$必须能够捕捉长距离依赖关系，但直接参数化会导致动态行为消失或爆炸（这与普通RNN面临的问题相同）。

- S4利用**HiPPO**（高阶多项式投影算子）矩阵来初始化$A$。该矩阵源自连续信号的最优多项式逼近理论。HiPPO矩阵具有特定结构，能够确保状态以紧凑的方式保存整个输入历史信息，并实现平滑衰减。

$$
A_{nk} = -\begin{cases} (2n+1)^{1/2}(2k+1)^{1/2} & \text{if } n > k \\ n+1 & \text{if } n = k \\ 0 & \text{if } n < k \end{cases}

$$

- 这种下三角结构确保了状态能够利用勒让德多项式对输入信号进行在线近似。计算长核的$\bar{A}^k$代价高昂，因此S4利用了HiPPO矩阵可分解为低秩项与对角项之和的特性，从而实现$O(n \log n)$复杂度的核计算。

- **Mamba**（Gu和Dao，2023）引入了关键创新——**选择性状态空间**：使SSM参数依赖于输入。在S4中，矩阵$A$、$B$、$C$以及步长$\Delta$是固定的——无论内容如何，所有令牌都遵循相同的动态规律。Mamba则将$B$、$C$和$\Delta$设为输入的函数：

$$B_k = \text{Linear}(u_k), \quad C_k = \text{Linear}(u_k), \quad \Delta_k = \text{softplus}(\text{Linear}(u_k))$$

- 这种选择性使得模型能够在每个位置决定哪些信息存入状态、哪些被忽略——类似于注意力机制筛选相关令牌的方式，但无需承担二次方复杂度开销。步长$\Delta_k$起到“门控”作用：较大的$\Delta$会使状态强烈整合当前输入（连续动态过程迈出较大步幅，实际上重置了状态），而较小的$\Delta$则会保留现有状态并忽略当前输入。

- 其代价是依赖输入的参数破坏了卷积视图（核不再固定），因此Mamba无法采用基于FFT的训练方式。取而代之的是，它使用了一种**硬件感知的并行扫描算法**，该算法利用了递归运算的结合律：状态更新$(x_k, u_k) \mapsto x_{k+1}$可表示为一系列可结合的操作，并能通过前缀和（扫描）实现并行化，这与硬件设计中的并行前缀加法类似。该算法在GPU上的运行时间为$O(n)$，深度为$O(\log n)$，其效率几乎可与卷积相媲美。

- Mamba实现了真正的每令牌$O(1)$推理速度（只需更新固定大小的状态，无需随上下文增长的关键值缓存），因此在长序列场景下比Transformer更具内存效率。状态大小$N$（通常为16）远小于Transformer的关键值缓存，后者需存储$O(n \cdot d)$个数值。实际中，在语言建模基准测试中，Mamba在参数数量相同的情况下能达到甚至超越Transformer的性能，且在长序列上的推理速度显著更快。

- **混合架构**将SSM层与注意力层相结合，用SSM处理大部分层（实现高效的长程传播），并穿插少量注意力层（用于精确的内容检索）。像Jamba和Zamba这样的模型交替使用Mamba块与Transformer块，既获得了优于纯SSM的质量，又保留了大部分推理效率优势。这表明注意力机制与SSM具备互补能力：SSM擅长平滑、长程的状态传播，而注意力机制则擅长精确、依赖内容的查找。

- **检索增强生成（RAG）**通过在推理阶段为语言模型提供外部知识库，解决了其知识局限问题。RAG并非仅依赖训练时编码进模型参数的知识，而是检索相关文档并以此为基础生成内容。

-经典的**检索器-阅读器架构**包含两个部分：**检索器**接收查询并从语料库中找出最相关的前$k$个段落；**阅读器**（即语言模型）则根据查询和检索到的段落生成答案。检索器可采用稀疏方法（如BM25，它是对文件02中TF-IDF的扩展）或稠密方法。

- **稠密段落检索（DPR）**采用双编码器架构：一个编码器将问题映射为向量，另一个将段落映射为向量。两者通常基于BERT。索引阶段会对所有段落进行编码并存储；查询阶段则对问题进行编码，并通过近似最近邻搜索（如FAISS）找到最相似的段落。相似度度量方式为问题与段落向量之间的点积。

- **分块策略**对检索质量影响显著。文档必须被切分为检索器可处理的较小段落，同时又要保证段落包含完整的语义单元。固定大小的分块（例如256个令牌，重叠50个令牌）虽然简单，但可能会割裂句子。语义分块则在段落或章节边界处进行切割。层次化分块则会创建不同粒度的摘要树。

![RAG架构](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/rag_architecture.svg)

- RAG具有多项优势：知识库可在不重新训练模型的情况下更新，模型能够引用来源，且由于模型可依据检索到的文本生成答案，幻觉现象也会减少。主要挑战在于检索质量（如果检索到错误的段落，模型可能会自信地给出错误答案）以及延迟问题（检索增加了推理步骤）。

- **投机解码**通过使用一个小型、快速的**草稿模型**并行预测多个令牌，再由大型**目标模型**在单次前向传播中验证这些令牌，从而加速自回归生成过程。

- 该算法的工作流程如下：草稿模型以自回归方式生成$k$个候选令牌（由于草稿模型较小，这一过程很快）。

- 随后，目标模型在单次前向传播中同时为所有$k$个令牌打分（由于采用了批量处理，效率很高）。

- 对于从草稿分布$p_d(t)$中采样出的每个候选令牌$t$，其被接受的概率为$\min(1, \, p_{\text{target}}(t) / p_d(t))$。若被拒绝，则从**调整后的分布**$p_{\text{adj}}(t) = \max(0, \, p_{\text{target}}(t) - p_d(t))$中重新采样令牌，并对该分布进行归一化处理。

- 这种接受-拒绝机制保证了输出分布与目标模型单独运行时的分布完全一致。
- 要理解其中的原因，可以看看生成令牌$t$的有效概率。该令牌可以直接被接受（概率为$p_d(t) \cdot \min(1, p_{\text{target}}(t)/p_d(t))$），也可以通过重采样产生。

- 对于满足$p_{\text{target}}(t) \leq p_d(t)$的令牌，直接接受的概率为$p_{\text{target}}(t)$。对于满足$p_{\text{target}}(t) > p_d(t)$的令牌，直接接受的概率为$p_d(t)$，而重采样贡献剩余的概率$p_{\text{target}}(t) - p_d(t)$（已考虑拒绝概率的影响）。

- 在这两种情况下，生成$t$的总概率都等于$p_{\text{target}}(t)$。草稿模型仅影响生成速度，而不影响生成质量。

![推测性解码](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/speculative_decoding.svg)

- 加速效果取决于接受率：如果草稿模型与目标模型高度一致，大多数令牌会被直接接受，此时实际耗时大致等同于使用草稿模型的时间。通常加速比可达2–3倍，且不会造成质量下降。

- **Medusa**（Cai等人，2024年）采用了不同的方法：它并未使用独立的草稿模型，而是在目标模型本身中添加多个轻量级的预测头。每个预测头同时预测不同的未来令牌位置（$k = 1, 2, 3, \ldots$步之后）。每一步中，Medusa利用树结构提出若干候选延续序列，再通过一次前向传播验证哪些候选序列是一致的。这样便完全无需单独的草稿模型。

- 广义上的**并行生成**方法旨在突破自回归解码的顺序瓶颈。雅可比解码法先对所有位置给出初始猜测，然后并行迭代优化直至收敛，将生成过程视为一种不动点迭代。非自回归模型（NAT）则通过单次前向传播同时生成所有令牌，但通常会出现质量下降问题，因此需要借助迭代优化、CTC损失函数或从自回归模型中蒸馏知识等技术来弥补差距。

- 上述技术——对齐、长上下文、检索、高效解码、状态空间模型——在现代生产级大语言模型中协同发挥作用。

- 本文余下部分将探讨前沿模型中的架构创新，展示如何将第01–04节中的理论思想以及上述方法在实践中结合起来。

- **分组查询注意力（GQA）**是最广泛采用的注意力效率优化技术。标准多头注意力（MHA）为每个注意力头单独维护键和值投影，导致每个令牌需要缓存$n_{\text{heads}} \times d_{\text{head}}$个数值。GQA则将多个查询头分组，共享同一个键-值头。

- 以64个查询头和8个键-值头为例（这是Llama 3、Qwen、Gemma中的常见配置），每个键-值头由8个查询头共享，从而使键-值缓存大小相比MHA减少8倍。

- 输出质量几乎与MHA相同，因为查询头仍能关注不同的模式，只是共享相同的键-值子空间。多查询注意力（MQA）是极端情况，即所有查询共享同一个键-值头，但GQA在质量与效率之间提供了更好的平衡。

- **多头潜注意力（MLA）**在DeepSeek-V2中被引入，实现了更激进的键-值缓存压缩。MLA并不缓存完整的键-值投影（即便使用了GQA），而是将隐藏状态降维为低秩的**潜向量**$c_t \in \mathbb{R}^{d_c}$，其中$d_c \ll n_{\text{heads}} \times d_{\text{head}}$：

$$c_t = W_{\text{down}} \, h_t$$

- 只有这个压缩后的向量会被缓存。在注意力计算时，再通过上投影重建完整的键和值表示：$k_t = W_{\text{up}}^K c_t$，$v_t = W_{\text{up}}^V c_t$。在DeepSeek-V3（总参数6710亿，活跃参数370亿）中，压缩维度$d_c = 512$，而完整MHA所需的维度为$128 \times 128 = 16{,}384$，键-值缓存因此减少了93%。

- 需要注意的是：标准的RoPE依赖于位置信息，无法与这种共享压缩机制兼容，因此MLA采用了**解耦式RoPE**：查询和键通过一条独立的通道（每个头64维）携带位置信息，而大部分表示则通过压缩后的潜向量路径传递。

![注意力键-值缓存策略对比：MHA、GQA与MLA](https://henryndubuaku.github.io/maths-cs-ai-compendium/images/mla_vs_gqa.svg)

- **大规模位置编码**已与最初的正弦编码方案大相径庭。所有前沿模型均采用**RoPE**（见第04节），但针对长上下文做了关键修改。原始RoPE公式$\theta_i = \theta_{\text{base}}^{-2i/d}$中的基础频率$\theta_{\text{base}}$通常为10,000，这限制了模型对训练长度之外的外推能力。

- **调整后的基础频率（ABF）** simply将$\theta_{\text{base}}$提高到500,000（Llama 3）或1,000,000（Qwen3、Gemma 3），从而延长旋转周期，使模型在训练期间经历的完整旋转次数更少，进而能够支持更远的外推。

- **YaRN**（另一种RoPE扩展方法）采用频率相关的插值策略：低频维度被插值缩小，高频维度被外推，同时利用温度因子调节注意力分布。DeepSeek-V3、Qwen和Kimi K2均基于YaRN扩展技术，将原本在4K–8K上下文中训练的模型扩展到128K上下文长度。

- **iRoPE**（交错式RoPE）在Llama 4中被引入，采取了更为激进的做法：每4个注意力层中就有1层**完全不使用位置编码**（NoPE），其余层则使用带有分块注意力的标准RoPE。

- NoPE层可以无位置偏差地关注所有位置，而RoPE层则提供局部顺序信息。结合推理时的温度缩放，这使得Llama 4 Scout能够支持高达1000万令牌的上下文窗口——这一数字远远超出了任何纯RoPE方案所能达到的水平。
- **大规模混合专家模型**已成为前沿模型的主流架构（文件04介绍了MoE的基本原理）。关键设计选择包括专家数量、路由稀疏度以及负载均衡。

- **路由稀疏度**差异显著：DeepSeek-V3使用256个专家，采用前8名路由方式（稀疏度为32倍）；Qwen3使用128个专家，同样采用前8名路由（稀疏度为16倍）；Mixtral使用8个专家，采用前2名路由（稀疏度为4倍）；Llama 4 Maverick则使用128个专家，采用前1名路由外加一个共享专家（稀疏度为128倍）。

- 更高的稀疏度意味着在相同的活跃计算量下拥有更多的总参数，但这需要更精细的负载均衡和通信基础设施支持。

- **无辅助损失的负载均衡**（DeepSeek-V3）取代了传统的负载均衡损失机制（文件04中有所介绍），因为后者会降低模型质量。具体而言，每个专家会维护一个随训练步骤动态调整的偏置项：过载的专家其偏置值会被降低（从而接收更少令牌），而未过载的专家其偏置值则会被提高。这种方式能在不引入任何辅助损失干扰主训练信号的前提下实现均衡路由。

- **共享专家**出现在大多数MoE设计中：一个或多个专家FFN负责处理所有令牌，无论路由结果如何。它们负责处理所有令牌都需要的常见模式（如基本语法、功能词），从而使被路由的专家能够专注于特定任务。Llama 4为每个令牌配备1个共享专家加1个路由专家（稀疏度极高）；DeepSeek-V3则使用1个共享专家加8个路由专家。

- **密集层与MoE层交替排列**提供了另一种设计思路。Gemma 2和3采用局部/全局注意力层交替的方式（Gemma 3中比例为5:1，其中局部层使用1,024令牌的滑动窗口，只有全局层才会缓存完整的128K上下文）。

- Llama 4 Maverick将密集FFN层与MoE层交错排列；Kimi K2则采用混合稀疏层设计（在专家层之间插入一个密集层）。这种异构设计使得不同层能够承担不同的功能。

- **多令牌预测（MTP）**技术在DeepSeek-V3中得到应用，它要求模型不仅预测下一个令牌，还要预测再下一个令牌。在每个位置，一个共享主模型嵌入向量的次级预测模块会预测一个额外的未来令牌。MTP损失相对于主模型的下一个令牌损失而言，权重设为0.1–0.3。除了能在训练期间提升表征质量外，MTP头还能在推理时作为投机解码的草稿头，从而实现免费的速度提升。

- **知识蒸馏**是一种训练策略，即利用大型“教师”模型的输出指导小型“学生”模型的训练。Gemma 2和3广泛采用了蒸馏技术：较小的模型（2B、4B）在教师模型给出的概率分布作为软目标的情况下，使用超出计算最优量50倍的数据进行训练。正因如此，Gemma 3-4B的质量可与Gemma 2-27B相媲美。

- 蒸馏损失会取代或补充标准的交叉熵损失：学生模型会最小化其输出分布与教师模型输出分布之间的KL散度：

$$\mathcal{L}_{\text{distill}} = D_{\text{KL}}(p_{\text{teacher}}(\cdot \mid x) \| p_{\text{student}}(\cdot \mid x))$$

- DeepSeek-R1利用80万条精心挑选的思维链样本，将其671B参数的推理模型蒸馏成小至1.5B的密集模型，从而创造出推理能力异常强大的小型模型。

- **基于强化学习的推理**代表了LLM能力方面最重要的近期进展。DeepSeek-R1证明，仅对基础模型进行强化学习训练（无需监督微调）就能激发思维链推理、自我验证以及错误纠正等能力；当模型因给出正确的最终答案而获得奖励时，这些行为便会自然出现。

- DeepSeek-R1采用了**GRPO**（组相对策略优化），该技术省去了PPO所需的价值网络。对于每个提示，GRPO会采样一组$G$个输出，计算它们的奖励值，并在组内对优势进行归一化处理：

$$A_i = \frac{r_i - \text{mean}(r_1, \ldots, r_G)}{\text{std}(r_1, \ldots, r_G)}$$

- 随后，策略梯度利用这些组相对优势以及截断后的目标函数（类似于PPO的截断机制）进行更新。

- 省去评论家网络后，强化学习训练所需的内存和计算量减半，从而使得用强化学习训练671B参数的模型成为可能。

- 一个关键的设计选择是：DeepSeek-R1采用**基于规则的奖励机制**（将数学答案与真实值比对、运行代码测试用例），而非神经奖励模型，因为在此规模下神经奖励模型容易被用于钻营奖励漏洞。

- **Qwen3的混合思考模式**将推理功能（通过`
- 与BF16/FP16训练相比，这能使吞吐量大致翻倍，而质量损失可忽略不计。DeepSeek-V3仅用280万H800 GPU小时就训练出了拥有6710亿参数的模型——这一时间仅为同类模型的一小部分——这主要得益于该技术及其他工程优化措施。

## 编码任务（使用CoLab或笔记本）

1. 从头开始实现一个简单的检索增强生成流程。利用TF-IDF对一组文档建立索引（文件02），根据查询检索出最相关的段落，并将其添加到提示词的开头。

```python
import jax.numpy as jnp
import math
from collections import Counter

# Knowledge base: a set of short passages
knowledge_base = [
    "The Eiffel Tower is a wrought-iron lattice tower in Paris, France. It was constructed from 1887 to 1889 as the centerpiece of the 1889 World's Fair.",
    "The Great Wall of China is a series of fortifications built along the northern borders of China. Construction began in the 7th century BC.",
    "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen using chlorophyll.",
    "The theory of general relativity, published by Albert Einstein in 1915, describes gravity as the curvature of spacetime caused by mass and energy.",
    "Python is a high-level programming language known for its simple syntax and readability. It was created by Guido van Rossum and released in 1991.",
    "The mitochondria are organelles found in eukaryotic cells. They generate most of the cell's supply of ATP, used as a source of chemical energy.",
]

# Build TF-IDF index (reusing concepts from file 02)
def tokenise(text):
    return text.lower().split()

vocab = sorted(set(w for doc in knowledge_base for w in tokenise(doc)))
word2idx = {w: i for i, w in enumerate(vocab)}
V = len(vocab)
N = len(knowledge_base)

# Document frequencies
doc_freq = Counter()
for doc in knowledge_base:
    for w in set(tokenise(doc)):
        doc_freq[w] += 1

def tfidf_vector(text):
    words = tokenise(text)
    counts = Counter(words)
    vec = jnp.zeros(V)
    for w, c in counts.items():
        if w in word2idx:
            tf = 1 + math.log(c)
            idf = math.log(N / (doc_freq.get(w, 0) + 1))
            vec = vec.at[word2idx[w]].set(tf * idf)
    return vec

# Index all documents
doc_vectors = jnp.stack([tfidf_vector(doc) for doc in knowledge_base])

def cosine_sim(a, b):
    return jnp.dot(a, b) / (jnp.linalg.norm(a) * jnp.linalg.norm(b) + 1e-8)

def retrieve(query, top_k=2):
    """Retrieve top-k most relevant passages for a query."""
    q_vec = tfidf_vector(query)
    sims = jnp.array([cosine_sim(q_vec, doc_vectors[i]) for i in range(N)])
    top_indices = jnp.argsort(-sims)[:top_k]
    return [(int(i), float(sims[i]), knowledge_base[int(i)]) for i in top_indices]

# Test retrieval
queries = [
    "Who built the Eiffel Tower?",
    "How do plants make food?",
    "What did Einstein discover?",
]

for query in queries:
    results = retrieve(query, top_k=1)
    print(f"\nQuery: '{query}'")
    for idx, sim, passage in results:
        print(f"  Retrieved (sim={sim:.3f}): '{passage[:80]}...'")

    # RAG-style prompt construction
    context = results[0][2]
    rag_prompt = f"Context: {context}\n\nQuestion: {query}\nAnswer:"
    print(f"  RAG prompt:\n    {rag_prompt[:120]}...")
```

1. 使用简易的草稿模型和目标模型实现投机解码。证明被接受的输出与目标模型的分布一致。

```python
import jax
import jax.numpy as jnp

# Simulate a draft model (fast, less accurate) and target model (slow, accurate)
vocab_size = 8
seq_len = 5

key = jax.random.PRNGKey(42)

# Target model: returns logits given a sequence
def target_model(seq, key):
    """Simulated target model: produces token logits (expensive)."""
    # In practice this would be a large Transformer forward pass
    k1, k2 = jax.random.split(key)
    logits = jax.random.normal(k1, (len(seq), vocab_size)) * 2
    # Make it somewhat predictable: bias toward token (seq[-1] + 1) % vocab_size
    for i in range(len(seq)):
        logits = logits.at[i, (seq[i] + 1) % vocab_size].add(3.0)
    return logits

def draft_model(seq, key):
    """Simulated draft model: similar but noisier (cheap)."""
    k1, k2 = jax.random.split(key)
    logits = jax.random.normal(k1, (len(seq), vocab_size))
    for i in range(len(seq)):
        logits = logits.at[i, (seq[i] + 1) % vocab_size].add(2.0)
    return logits

def sample_token(logits, key):
    return jax.random.categorical(key, logits)

def speculative_decode(prefix, draft_steps=3, key=jax.random.PRNGKey(0)):
    """Speculative decoding: draft proposes, target verifies."""
    seq = list(prefix)
    total_accepted = 0
    total_proposed = 0

    for _ in range(4):  # generate 4 rounds
        key, *subkeys = jax.random.split(key, draft_steps + 3)

        # Draft model proposes draft_steps tokens
        draft_tokens = []
        draft_probs = []
        draft_seq = list(seq)
        for i in range(draft_steps):
            d_logits = draft_model(jnp.array(draft_seq), subkeys[i])
            d_probs = jax.nn.softmax(d_logits[-1])
            tok = sample_token(d_logits[-1], subkeys[i])
            draft_tokens.append(int(tok))
            draft_probs.append(d_probs)
            draft_seq.append(int(tok))

        # Target model scores all draft tokens in one pass
        target_logits = target_model(jnp.array(draft_seq), subkeys[draft_steps])
        target_start = len(seq) - 1  # position of last prefix token

        # Accept/reject each draft token
        accepted = 0
        for i in range(draft_steps):
            t_probs = jax.nn.softmax(target_logits[target_start + i])
            d_prob = draft_probs[i][draft_tokens[i]]
            t_prob = t_probs[draft_tokens[i]]

            # Accept with probability min(1, target_prob / draft_prob)
            accept_prob = jnp.minimum(1.0, t_prob / (d_prob + 1e-10))
            key, accept_key = jax.random.split(key)
            if jax.random.uniform(accept_key) < accept_prob:
                seq.append(draft_tokens[i])
                accepted += 1
            else:
                # Reject: sample from adjusted distribution
                key, resample_key = jax.random.split(key)
                adjusted = jnp.maximum(0, t_probs - draft_probs[i])
                adjusted = adjusted / (adjusted.sum() + 1e-10)
                new_tok = jax.random.categorical(resample_key, jnp.log(adjusted + 1e-10))
                seq.append(int(new_tok))
                break

        total_accepted += accepted
        total_proposed += draft_steps

    return seq, total_accepted, total_proposed

# Run speculative decoding
prefix = [0, 1]
result_seq, accepted, proposed = speculative_decode(prefix)
acceptance_rate = accepted / proposed if proposed > 0 else 0

print(f"Prefix: {prefix}")
print(f"Generated sequence: {result_seq}")
print(f"Draft proposals: {proposed}")
print(f"Accepted: {accepted}")
print(f"Acceptance rate: {acceptance_rate:.1%}")
print(f"Speedup potential: {(accepted + proposed) / proposed:.2f}x")
```

1. 构建一个简单的DPO训练循环。给定偏好补全与非偏好补全的配对数据，利用DPO损失来更新一个小模型。

```python
import jax
import jax.numpy as jnp

# Tiny language model: linear projection from one-hot to logits
vocab_size = 10
seq_len = 4

key = jax.random.PRNGKey(42)
k1, k2 = jax.random.split(key)

# Current policy parameters (trainable)
theta = jax.random.normal(k1, (vocab_size, vocab_size)) * 0.1
# Reference policy parameters (frozen copy of initial theta)
theta_ref = theta.copy()

def log_prob_sequence(params, sequence):
    """Compute log P(sequence) under a simple autoregressive model."""
    total = 0.0
    for t in range(1, len(sequence)):
        # Simple: logits at position t depend on token at t-1
        logits = params[sequence[t-1]]
        log_probs = jax.nn.log_softmax(logits)
        total += log_probs[sequence[t]]
    return total

def dpo_loss(theta, theta_ref, preferred, dispreferred, beta=0.1):
    """Direct Preference Optimisation loss for one pair."""
    log_pi_w = log_prob_sequence(theta, preferred)
    log_pi_l = log_prob_sequence(theta, dispreferred)
    log_ref_w = log_prob_sequence(theta_ref, preferred)
    log_ref_l = log_prob_sequence(theta_ref, dispreferred)

    # DPO objective
    return -jax.nn.log_sigmoid(
        beta * ((log_pi_w - log_ref_w) - (log_pi_l - log_ref_l))
    )

# Preference dataset: (prompt_prefix, preferred_completion, dispreferred_completion)
preferences = [
    (jnp.array([1, 3, 5, 7]), jnp.array([1, 3, 5, 2])),  # prefer 7 over 2 at end
    (jnp.array([0, 2, 4, 6]), jnp.array([0, 2, 4, 9])),  # prefer 6 over 9
    (jnp.array([3, 3, 3, 3]), jnp.array([3, 3, 3, 0])),  # prefer repeating over 0
    (jnp.array([5, 6, 7, 8]), jnp.array([5, 6, 7, 1])),  # prefer 8 over 1
]

grad_fn = jax.jit(jax.grad(dpo_loss))
lr = 0.05

print("Training DPO...")
for epoch in range(100):
    total_loss = 0.0
    for preferred, dispreferred in preferences:
        loss = dpo_loss(theta, theta_ref, preferred, dispreferred)
        grads = grad_fn(theta, theta_ref, preferred, dispreferred)
        theta = theta - lr * grads
        total_loss += loss
    if (epoch + 1) % 20 == 0:
        avg_loss = total_loss / len(preferences)
        print(f"  Epoch {epoch+1}: avg DPO loss = {avg_loss:.4f}")

# Check: the model should now prefer the preferred completions
print("\nPreference check after DPO training:")
for preferred, dispreferred in preferences:
    lp_w = log_prob_sequence(theta, preferred)
    lp_l = log_prob_sequence(theta, dispreferred)
    print(f"  Preferred {list(preferred.astype(int))}: logP={lp_w:.3f}  "
          f"Dispreferred {list(dispreferred.astype(int))}: logP={lp_l:.3f}  "
          f"{'correct' if lp_w > lp_l else 'WRONG'}")
```
