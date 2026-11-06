---
title: "生产软件工程"
date: "2026-11-05"
order: 15
slug: "compendium/15-production-software-engineering"
description: "命令行是机器学习工程中的主要交互界面：模型训练、服务器管理、数据管道构建以及集群运维等工作均通过终端来完成。本文件将介绍Shell、文件系统、权限设置、进程管理、软件包管理工具、环境变量、SSH以及每位机器学习工程师日常都会用到的基本命令。"
tags: []
---

## Linux与命令行

_命令行是机器学习工程中的主要交互界面：模型训练、服务器管理、数据管道构建以及集群运维等工作均通过终端来完成。本文件将介绍Shell、文件系统、权限设置、进程管理、软件包管理工具、环境变量、SSH以及每位机器学习工程师日常都会用到的基本命令。_

- 图形用户界面便于浏览网页，但并不适合在凌晨2点时在远程GPU集群上运行训练任务。**命令行**（或终端、Shell）才是真正具备扩展性的工具：它可以在任何机器上运行，能够被编写成脚本，具有可组合性，无论是在笔记本电脑、云虚拟机还是高性能计算集群上，其使用方式都是一样的。

- 如果你只使用Jupyter笔记本和VS Code的界面功能，那你就浪费了大量的工作效率。实际上，所有的生产级机器学习系统都是通过命令行来部署、监控和调试的。

## Shell

- **Shell**是一种能够读取用户输入的命令并执行这些命令的程序。它是用户与操作系统之间的中介（详见第13章）。最常见的Shell有**bash**（大多数Linux系统的默认Shell）和**zsh**（macOS的默认Shell）。

- 一个命令的结构为：`命令 [选项] [参数]`

```bash
ls -la /home/user    # command=ls, options=-la, argument=/home/user
```

- 选项用于修改程序的行为（通常以“-”作为前缀表示简写形式，以“--”作为前缀表示完整形式）。`ls -l`会以完整格式列出文件信息，`ls --all`则可以显示隐藏文件。多个选项可以组合使用：`ls -la`即表示同时应用“-l”和“-a”这两个选项。

### 基本导航操作

```bash
pwd                 # print working directory (where am I?)
ls                  # list files in current directory
ls -la              # list all files (including hidden) with details
cd /path/to/dir     # change directory
cd ..               # go up one level
cd ~                # go to home directory
cd -                # go back to previous directory
```

### 文件操作

```bash
cp source dest      # copy file
cp -r dir1 dir2     # copy directory recursively
mv old new          # move/rename file
rm file             # delete file (no recycle bin — gone forever)
rm -rf dir          # delete directory recursively (DANGEROUS — no confirmation)
mkdir -p a/b/c      # create nested directories
touch file.txt      # create empty file (or update timestamp)
cat file.txt        # print file contents
head -n 20 file     # first 20 lines
tail -f logfile     # follow a log file in real-time (invaluable for monitoring training)
```

- **常见陷阱**：`rm -rf`是计算机中最危险的命令，且无法撤销操作。在按下回车键之前，请务必仔细核对路径。绝不要执行`rm -rf /`或`rm -rf ~`这样的命令。

### 管道与重定向

- shell最强大的功能就是**组合性**：通过将多个简单命令组合在一起，就能完成复杂的任务。

- **管道**（`|`）：将一个命令的输出作为另一个命令的输入。

```bash
cat training.log | grep "loss" | tail -5    # last 5 lines containing "loss"
ps aux | grep python                        # find running Python processes
history | grep "docker"                     # find previous docker commands
```

- **重定向**：将输出内容发送到文件中，而非显示在屏幕上。

```bash
python train.py > output.log 2>&1    # stdout AND stderr to file
python train.py >> output.log        # append (don't overwrite)
echo "data" > file.txt               # overwrite file
echo "more" >> file.txt              # append to file
```

- `2>&1`的作用是将标准错误输出（文件描述符2）重定向到标准输出（文件描述符1）。如果不使用这条命令，错误信息仍会显示在屏幕上，而只有正常输出会被写入文件中。

### 文本处理

```bash
grep "error" logfile.txt             # find lines containing "error"
grep -r "import torch" src/          # search recursively in directory
grep -i "warning" log.txt            # case-insensitive search
grep -c "epoch" train.log            # count matching lines

wc -l file.txt                       # count lines
wc -w file.txt                       # count words

sort data.txt                        # sort lines alphabetically
sort -n numbers.txt                  # sort numerically
sort -u data.txt                     # sort and remove duplicates
uniq -c sorted.txt                   # count consecutive duplicates

cut -d',' -f2,3 data.csv            # extract columns 2 and 3 from CSV
awk '{print $1, $3}' data.txt       # print 1st and 3rd whitespace-separated fields
sed 's/old/new/g' file.txt          # replace all occurrences of "old" with "new"
```

- 它们组合起来非常美观：

```bash
# Find the 10 most common error types in a log file
grep "ERROR" app.log | awk -F': ' '{print $2}' | sort | uniq -c | sort -rn | head -10
```

### 查找文件

```bash
find . -name "*.py"                  # find all Python files
find . -name "*.pyc" -delete         # find and delete compiled Python files
find /data -size +100M               # files larger than 100 MB
find . -mtime -1                     # files modified in the last 24 hours

which python                        # where is the python executable?
locate filename                      # fast file search (uses pre-built index)
```

## 文件系统结构

- Linux将所有内容组织在以“/”为根节点的树形结构中：

| 目录 | 用途 |
| --- | --- |
| `/` | 整个文件系统的根目录 |
| `/home/user` | 个人文件、配置文件、项目文件 |
| `/etc` | 系统级配置文件 |
| `/usr` | 用户程序、库文件、文档 |
| `/usr/local` | 本地安装的软件（非通过包管理器安装） |
| `/var` | 动态数据：日志文件（/var/log）、数据库、缓存 |
| `/tmp` | 临时文件（重启后会清除） |
| `/opt` | 可选的第三方软件 |
| `/proc` | 虚拟文件系统，用于显示内核及进程信息 |
| `/dev` | 设备文件（磁盘、GPU等设备都在此处显示） |

- 对于机器学习而言，训练数据通常存储在 `/data` 或 `/home/user/data` 中，模型则存放在 `/home/user/models` 中，而CUDA相关文件位于 `/usr/local/cuda`。GPU设备则表现为 `/dev/nvidia0`、/dev/nvidia1` 等形式。

## 文件权限

- 每个文件和目录针对三类用户都有三种权限设置：

| 权限 | 文件 | 目录 |
| --- | --- | --- |
| **r**（读取） | 查看文件内容 | 列出目录中的文件 |
| **w**（写入） | 修改文件内容 | 在目录中创建或删除文件 |
| **x**（执行） | 将文件作为程序运行 | 进入该目录 |

- 三类用户分别为：**所有者**（u）、**所属组**（g）、**其他用户**（o）。

```bash
ls -l script.py
# -rwxr-xr-- 1 henry ml_team 2048 Mar 28 script.py
#  ^^^         owner permissions: rwx (read, write, execute)
#     ^^^      group permissions: r-x (read, execute, no write)
#        ^^^   others permissions: r-- (read only)
```

```bash
chmod 755 script.py       # owner=rwx, group=rx, others=rx
chmod +x script.py        # add execute permission for everyone
chmod u+w,g-w file.txt    # add write for owner, remove write for group
chown henry:ml_team file  # change owner and group
```

- **常见陷阱**：如果Python脚本的开头有`#!/usr/bin/env python3`这样的行，那么要通过`./script.py`的方式运行该脚本，就需要赋予其执行权限（使用`chmod +x`命令）。如果没有这个权限，就必须使用`python3 script.py`来运行脚本。

## 进程管理

- **进程**指的是正在运行的程序（详见第13章）。Shell提供了多种工具用于管理这些进程：

```bash
ps aux                    # list all running processes
ps aux | grep python      # find Python processes
top                       # real-time process monitor (CPU, memory)
htop                      # better version of top (install separately)
nvidia-smi                # GPU usage (essential for ML)
watch -n 1 nvidia-smi     # refresh nvidia-smi every second

kill PID                  # gracefully terminate process
kill -9 PID               # force kill (use when graceful fails)
killall python            # kill all Python processes

# Run in background
python train.py &                    # run in background
nohup python train.py > log.txt &    # run in background, survive logout
```

- **`nohup`** 对机器学习训练而言非常重要：如果没有它，一旦关闭SSH连接，训练任务就会中断。`nohup` 可以让进程与终端分离。

- **`screen`** 和 **`tmux`** 是终端多路复用工具，能够创建持久的会话。可以在tmux会话中启动训练任务，之后断开SSH连接，稍后再重新连接，此时该会话以及训练任务仍会继续运行。

```bash
tmux new -s training          # create named session
# ... start training ...
# Ctrl+B, then D              # detach from session
tmux attach -t training       # reattach later (even after SSH reconnect)
tmux ls                       # list sessions
```

## 软件包管理器

- **系统软件包**（操作系统级的软件）：

```bash
# Debian/Ubuntu
sudo apt update               # refresh package list
sudo apt install htop         # install a package
sudo apt upgrade              # upgrade all packages

# macOS
brew install wget             # install via Homebrew
```

- **Python包**：

```bash
pip install torch             # install from PyPI
pip install -e .              # install current project in editable mode
pip install -r requirements.txt  # install from requirements file
pip freeze > requirements.txt    # export installed packages

# Conda (for complex dependencies like CUDA)
conda create -n myenv python=3.11
conda activate myenv
conda install pytorch torchvision cudatoolkit=12.1 -c pytorch
```

- **常见误区**：切勿直接使用`pip install`命令在系统Python环境中安装包。应始终使用虚拟环境（如`python -m venv env`、`conda create`或`uv venv`）。系统Python被操作系统中的各种工具所共享，若对其造成破坏，将会导致整个系统出故障。

## 环境变量

- **环境变量**是键值对形式的数据，所有程序都可以访问这些变量。通过环境变量可以配置程序的行为，而无需修改代码本身。

```bash
export CUDA_VISIBLE_DEVICES=0,1    # use only GPUs 0 and 1
export PYTHONPATH=/home/user/src   # add to Python's import path
export WANDB_API_KEY=abc123        # API key for Weights & Biases

echo $PATH                         # see current PATH
export PATH=$PATH:/usr/local/cuda/bin  # add CUDA to PATH
```

- **`.bashrc`**（或`.zshrc`）：每次打开shell时都会执行的命令。请将那些需要持续有效的`export`语句放入此处。

- **`.env`文件**：由`python-dotenv`等工具用来加载与项目相关的变量。应将敏感信息（如API密钥、数据库密码）存储在`.env`文件中，并将该文件加入`.gitignore`列表中。绝不要将敏感信息提交到git中。

## SSH（安全壳层协议）

- **SSH**能够通过加密通道让你连接到远程机器。通过它，你可以访问云虚拟机、GPU服务器以及高性能计算集群。

```bash
ssh user@hostname              # connect to remote machine
ssh -i ~/.ssh/key.pem user@ip  # connect with specific key
ssh -L 8888:localhost:8888 user@server  # port forwarding (Jupyter on remote)
```

- **SSH密钥**（公钥/私钥对）可替代密码使用：

```bash
ssh-keygen -t ed25519          # generate key pair
ssh-copy-id user@server        # copy public key to server
# now you can SSH without typing a password
```

- **SSH配置文件**（`~/.ssh/config`）用于保存连接相关设置：

```text
Host gpu-server
    HostName 10.0.1.42
    User henry
    IdentityFile ~/.ssh/gpu_key
    LocalForward 8888 localhost:8888
```

- 现在，使用`ssh gpu-server`命令时，所有相关设置都会自动被应用。

- **`scp`**和**`rsync`**用于在不同机器之间传输文件：

```bash
scp model.pt user@server:/data/models/     # copy file to remote
scp -r user@server:/data/results/ ./       # copy directory from remote
rsync -avz --progress data/ user@server:/data/  # sync with progress (smarter than scp)
```

## 核心机器学习命令速查表

```bash
# GPU monitoring
nvidia-smi                                   # GPU usage snapshot
watch -n 1 nvidia-smi                        # live monitoring
gpustat                                      # cleaner GPU overview (pip install gpustat)

# Training management
nohup python train.py > train.log 2>&1 &     # background training that survives logout
tail -f train.log                            # monitor training output
kill %1                                      # kill last background job

# Disk usage (datasets are huge)
df -h                                        # disk space on all mounts
du -sh /data/*                               # size of each item in /data
du -sh --max-depth=1 .                       # size of subdirectories

# Memory
free -h                                      # RAM usage
cat /proc/meminfo                            # detailed memory info

# Network
curl -O https://example.com/dataset.tar.gz   # download file
wget https://example.com/model.bin           # alternative downloader
curl -X POST http://localhost:8080/predict \
    -H "Content-Type: application/json" \
    -d '{"text": "hello"}'                   # test a model serving endpoint

# Archives
tar -czf archive.tar.gz directory/           # compress
tar -xzf archive.tar.gz                      # extract
zip -r archive.zip directory/                # zip
unzip archive.zip                            # unzip

# Quick data inspection
head -5 data.csv                             # first 5 lines of CSV
wc -l data.csv                               # count rows
cut -d',' -f1 data.csv | sort -u | wc -l    # count unique values in column 1
```

## Git与版本控制

_Git是软件团队在不覆盖彼此工作的情况下进行协作的工具。本文涵盖了Git的思维方式、分支策略、合并与变基、冲突解决、拉取请求，以及处理大型文件和实验跟踪等机器学习领域的特定挑战。_

- 每个严肃的软件项目都会使用版本控制。**Git**是主流的版本控制系统，几乎所有开源项目和公司都在使用它。没有Git的话，团队协作就只能靠发送压缩包文件，并祈祷没人会覆盖你的修改；而有了Git，每一次修改都会被记录、可撤销且可追溯。

- 对于机器学习工程师而言：Git可以追踪代码、配置文件以及实验脚本。结合实验跟踪工具后，它能确保结果的可复现性：“究竟是什么代码和配置生成了这个模型？”

## 思维方式

- Git追踪的是项目的**快照**。每次提交都是当时所有被追踪文件的完整快照，而非差异数据（虽然Git内部为了效率会存储差异数据，但从概念上讲，每次提交都代表一个完整的状态）。

- 文件存在于四个“位置”：

1. **工作目录**：磁盘上的实际文件。你可以在这里编辑它们。
2. **暂存区**（索引）：你标记为下次提交的文件。`git add`命令会将更改移入此处。
3. **本地仓库**：你的提交历史，存储在`.git/`目录下。`git commit`会将暂存区的内容保存为新的快照。
4. **远程仓库**（如GitHub）：共享的副本。`git push`用于上传你的提交，`git pull`用于下载他人的提交。

```text
Working Dir  →  git add  →  Staging  →  git commit  →  Local Repo  →  git push  →  Remote
                                                        ←  git pull  ←
```

- 暂存区正是Git的强大之处。你可以编辑10个文件，但只提交其中的3个，把其他更改留待另一次提交。这样就能实现清晰、有针对性的提交。

### 常用命令

```bash
git init                          # create a new repository
git clone url                     # download a remote repository
git status                        # what has changed? (most-used command)
git add file.py                   # stage a specific file
git add .                         # stage all changes (use with caution)
git commit -m "descriptive msg"   # commit staged changes
git push                          # upload commits to remote
git pull                          # download + merge remote changes
git log --oneline                 # compact commit history
git diff                          # show unstaged changes
git diff --staged                 # show staged changes
```

## 分支

- **分支**是指向某个提交的指针。默认分支为 `main`（或 `master`）。创建分支后，就能获得一条独立的发展线：你可以进行更改而不影响 `main`。

```bash
git branch feature-x              # create a branch
git checkout feature-x            # switch to it
git checkout -b feature-x         # create and switch in one step
git branch -d feature-x           # delete branch (after merging)
git branch -a                     # list all branches (local + remote)
```

- **何时创建分支**：随时。切勿直接向`main`分支提交代码。每个功能、漏洞修复或实验都应使用独立的分支。这样能确保`main`分支的稳定性和可部署性。

### 分支策略

- **功能分支**（最常见）：每个功能/修复都从`main`分支派生出一个分支。完成后，发起拉取请求（PR）以合并回`main`分支。这种方式简单，适用于大多数团队。

- **基于主干的开发**：开发者频繁向`main`分支提交代码（每天多次），利用功能开关来隐藏未完成的工作。这种模式受到持续部署团队的青睐（如Google、Facebook）。它要求具备出色的CI/CD流程。

- **GitFlow**：为功能、发布和热修复分别设立独立分支。该模式较为复杂，更适合有版本发布需求的软件（如移动应用、打包软件）。对于大多数机器学习项目而言则有些过度设计。

- 对于机器学习团队而言：**功能分支**加上生命周期较短的分支（1-3天内合并）是最佳选择。生命周期较长的分支容易与`main`分支产生偏差，从而引发棘手的合并冲突。

## 合并与变基

- **合并**会创建一个新的“合并提交”来整合两个分支：

```bash
git checkout main
git merge feature-x
```

- 这样可以保留完整的历史记录：你可以看到某个分支上的工作内容以及它何时被合并。合并提交有两个父提交。

- **Rebase**会将你分支上的提交重新应用到目标分支之上：

```bash
git checkout feature-x
git rebase main
```

- 这会重写历史：你的分支中的提交会获得新的哈希值，就好像你是从`main`分支的最新版本开始工作的一样。结果是形成线性历史记录（没有合并提交），这样更易于阅读。

- **何时使用哪种方式**：
- 使用**Rebase**来用最新的`main`分支更改更新你的功能分支（保持分支的整洁与最新状态）。
- 使用**Merge**将功能分支合并到`main`分支中（保留分支的历史记录）。
- **切勿对已经推送并共享给他人的提交进行Rebase操作**。Rebase会重写历史；如果其他人基于这些原始提交进行了后续工作，Rebase会导致混乱。

## 解决冲突

- 当两个分支修改了同一个文件的同一行时，就会发生**冲突**。Git无法自动决定保留哪种更改，因此需要你手动解决。

```python
<<<<<<< HEAD
learning_rate = 0.001
=======
learning_rate = 0.0005
>>>>>>> feature-x
```

- 在 `<<<<<<< HEAD` 和 `=======` 之间的是当前分支的版本；在 `=======` 和 `>>>>>>> feature-x` 之间的是传入分支的版本。你需要决定保留哪个版本（或合并两者），删除标记后保存，再通过 `git add` 提交已解决的文件。

- **注意事项**：切勿将冲突标记留在已提交的文件中。它们属于字面文本，会破坏代码。解决冲突后务必搜索是否存在 `<<<<<<<`。

- **减少冲突的方法**：保持分支生命周期短暂，经常将 `main` 分支合并到你的分支中，并避免多人同时编辑同一个文件。

## 撰写优秀的提交信息

- 提交信息是为未来的自己和团队成员准备的。“修复漏洞”这类描述毫无意义；“修复批量大小计算中的偏移错误，该错误导致在8张GPU上训练时出现内存溢出”则能说明一切。

- **格式**：

```text
Short summary (50 chars or less, imperative mood)

Longer description if needed. Explain WHY, not WHAT
(the diff shows what changed). Wrap at 72 characters.

Fixes #123
```

- **祈使语气**：应使用“添加功能”而非“已添加功能”或“将添加功能”。可理解为补全句子：“如果应用此提交，它将**添加功能**。”

- **原子性提交**：每次提交应只完成一件事。“添加数据加载器”算一次提交；“添加数据加载器、修复无关错误以及更新README”则应分为三次提交。这样才能实现`git bisect`（查找引入错误的提交）。

## 拉取请求与代码审查

- **拉取请求（Pull Request, PR）**用于提议将某个分支合并到`main`分支。它是代码审查的入口：团队成员会阅读你的修改内容、提出改进建议，并在合并前予以批准。

- **良好的PR实践**：
- 保持PR规模较小（修改行数少于400行）。过大的PR往往会被直接通过，因为没人愿意审查2000行代码。
- 撰写清晰的描述：说明做了哪些更改、原因是什么以及如何测试。
- 链接到触发此次更改的相关issue或工单。
- 及时回应审查意见。
- 合并前合并琐碎的提交（以确保`main`分支的历史记录整洁）。

- **代码审查的目的并非寻找错误**（测试会负责这一点）。其目的在于：知识共享（审查者借此了解代码库）、设计反馈（这种实现方式是否恰当？）以及维护规范（命名、风格、架构等方面）。

## .gitignore

- `.gitignore`文件用于告诉Git哪些文件无需被追踪。对于机器学习项目而言：

```gitignore
# Python
__pycache__/
*.pyc
*.egg-info/
.venv/
env/

# Data and models (too large for git)
data/
*.csv
*.parquet
models/
*.pt
*.onnx
*.bin
checkpoints/

# Secrets
.env
*.pem
credentials.json

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Jupyter
.ipynb_checkpoints/

# Experiment outputs
wandb/
mlruns/
outputs/
logs/
```

- **陷阱**：在文件已被提交后将其添加到`.gitignore`中，并不会从仓库中删除该文件。还必须执行`git rm --cached 文件名`来取消对该文件的跟踪。除非重写历史记录（这很麻烦），否则该文件会永远留在历史记录中。

## 机器学习中的Git应用

- 机器学习带来了传统软件所没有的挑战：

- **大文件问题**：数据集和模型权重往往达到千兆字节甚至更大。Git是为文本文件（源代码）设计的，并不适合处理二进制文件。解决方案如下：
- **Git LFS**（大文件存储）：在Git中仅保存指针，实际文件则存储在单独的服务器上。虽然简单，但在GitHub上存在存储和带宽限制。
- **DVC**（数据版本控制）：将数据和模型文件与Git分开管理，使用远程存储（如S3、GCS）。其用法类似于Git：`dvc add data.csv`、`dvc push`、`dvc pull`。

- **实验追踪**：哪个提交版本、哪些超参数以及哪些数据产生了特定的指标？Git只能追踪代码，却无法记录完整的实验上下文。
- **Weights & Biases (W&B)**：可记录指标、超参数、系统信息，并与Git提交关联。提供用于比较实验结果的仪表板。
- **MLflow**：开源的实验追踪工具，具备模型注册功能。能够记录参数、指标及相关产物。
- **简单方法**：在训练脚本中记录Git哈希值：`git_hash = subprocess.check_output(['git', 'rev-parse', 'HEAD']).strip()`。将其与实验结果一同存储。

- **可复现性检查清单**（每次实验需记录的内容）：
- Git提交哈希（确切的代码版本）
- 配置文件/超参数
- 随机种子
- Python及库版本（`pip freeze`输出）
- 数据版本（DVC哈希或数据集版本标签）
- 硬件信息（GPU类型、GPU数量）

```bash
# Quick reproducibility snapshot
echo "Commit: $(git rev-parse HEAD)" > experiment_info.txt
echo "Branch: $(git branch --show-current)" >> experiment_info.txt
echo "Dirty: $(git status --porcelain | wc -l) files" >> experiment_info.txt
pip freeze >> experiment_info.txt
nvidia-smi >> experiment_info.txt
```

## 代码库设计与模式

_优秀的代码库设计是区分研究原型与生产软件的关键。本文档涵盖了项目结构、整洁代码原则、与机器学习相关的设计模式、配置管理、日志记录、API设计以及打包等内容。_

- 大多数机器学习代码最初都源自Jupyter笔记本。随着笔记本内容的不断增加、复制、修改和共享，最终会变成一团难以维护的代码，充斥着全局变量、无用代码和魔术数字。**代码库设计**就是确保代码在项目规模扩大时仍能保持可读性和可修改性的一种规范。

- 这并非为了遵循规则而遵循规则，而是为了缩短“我想修改X”到“X被修改并正常运行”之间的时间。在设计良好的代码库中，这一过程只需几分钟；而在设计糟糕的代码库中，则可能要花费数天时间去梳理那些没有文档说明的混乱代码。

## 项目结构

- 一致的项目布局能让任何人（包括未来的你）迅速理解代码库的结构。

```text
my_project/
├── src/my_project/       # source code (importable package)
│   ├── __init__.py
│   ├── data/             # data loading and preprocessing
│   │   ├── __init__.py
│   │   ├── dataset.py
│   │   └── transforms.py
│   ├── models/           # model architectures
│   │   ├── __init__.py
│   │   ├── transformer.py
│   │   └── layers.py
│   ├── training/         # training loops, optimisers
│   │   ├── __init__.py
│   │   ├── trainer.py
│   │   └── losses.py
│   └── utils/            # shared utilities
│       ├── __init__.py
│       └── logging.py
├── configs/              # configuration files
│   ├── base.yaml
│   └── experiment_1.yaml
├── scripts/              # entry points (train, evaluate, serve)
│   ├── train.py
│   ├── evaluate.py
│   └── serve.py
├── tests/                # test files (mirrors src/ structure)
│   ├── test_dataset.py
│   ├── test_model.py
│   └── test_trainer.py
├── notebooks/            # exploration only (not production code)
├── pyproject.toml        # project metadata and dependencies
├── README.md
├── .gitignore
└── Dockerfile
```

- **`src/`目录结构**：将源代码放在`src/my_project/`下，可以防止从当前目录意外导入模块（从而避免掩盖那些在生产环境中才会显现的导入错误）。开发时可通过`pip install -e .`进行安装。

- **单仓库与多仓库**：**单仓库**将所有相关项目存放在同一个仓库中（便于跨项目修改，共享持续集成流程）；**多仓库**则为每个项目单独设立仓库（边界更清晰，版本管理相互独立）。大多数机器学习团队最初采用单仓库，必要时再拆分为多仓库。

- **脚本与库的区别**：入口文件（`train.py`、`evaluate.py`）应放在`scripts/`目录下；可复用的逻辑则放在`src/`中。一个训练脚本的长度应控制在约50行以内：解析配置、构建数据集、构建模型、创建训练器并开始训练。所有的复杂逻辑都应封装在库中。

## 整洁代码原则

- **命名**：这是最能影响代码可读性的因素。名为`x`的变量需要你阅读其周围的代码才能理解其含义；而名为`learning_rate`的变量则无需额外说明就能明白其用途。

```python
# BAD
def proc(d, n, lr):
    for i in range(n):
        for k, v in d.items():
            v -= lr * g[k]

# GOOD
def update_parameters(parameters, num_steps, learning_rate):
    for step in range(num_steps):
        for name, param in parameters.items():
            param -= learning_rate * gradients[name]
```

- **单一职责原则**：每个函数/类只做一件事。名为 `load_data_and_train_model` 的函数做了两件事，应当将其拆分。这样能使每个部分具备独立的可测试性、可复用性和可理解性。

- **DRY原则（不要重复自己）**——但切勿过早应用。如果某段代码被复制粘贴了三次，就将其提取为一个函数。但不要为仅使用过一次的代码创建抽象。过早的抽象比代码重复更糟糕：它会增加复杂性却并无实际益处。

```python
# Premature abstraction (one use case, over-engineered)
class AbstractDataTransformPipelineFactory:
    ...

# Just right (direct, clear, used in three places)
def normalise_image(image, mean, std):
    return (image - mean) / std
```

- **魔法数字**：切勿使用未经说明的字面量。

```python
# BAD
if len(batch) > 32:
    split_batch(batch, 32)

# GOOD
MAX_BATCH_SIZE = 32
if len(batch) > MAX_BATCH_SIZE:
    split_batch(batch, MAX_BATCH_SIZE)
```

- **函数应当简短**：如果一个函数无法在一屏内显示（约30行），那它很可能承担了过多职责。应将逻辑块提取为命名清晰的辅助函数，这样函数体就能像高层摘要一样清晰易读。

## 机器学习的设计模式

- 设计模式是针对常见问题的可复用解决方案。以下是对机器学习代码库最相关的几种模式：

- **工厂模式**：无需指定具体类即可创建对象。当配置文件中有`model: "transformer"`这样的设定，而你需要实例化相应的类时，该模式就非常有用：

```python
MODEL_REGISTRY = {
    "transformer": TransformerModel,
    "cnn": CNNModel,
    "mlp": MLPModel,
}

def build_model(config):
    model_cls = MODEL_REGISTRY[config["model"]]
    return model_cls(**config["model_params"])
```

- 这样可以将训练脚本与具体的模型实现解耦。添加新模型只需在注册表中增加一行代码，无需修改训练循环。

- **策略模式**：在运行时切换算法。适用于损失函数、优化器和调度器：

```python
LOSS_FUNCTIONS = {
    "mse": nn.MSELoss,
    "cross_entropy": nn.CrossEntropyLoss,
    "focal": FocalLoss,
}

loss_fn = LOSS_FUNCTIONS[config["loss"]]()
```

- **观察者模式**（回调/钩子）：让模块能够响应事件，而无需紧密耦合。训练框架（PyTorch Lightning、Keras）广泛使用了回调机制：

```python
class EarlyStopping:
    def __init__(self, patience=5):
        self.patience = patience
        self.best_loss = float('inf')
        self.counter = 0

    def on_epoch_end(self, epoch, val_loss):
        if val_loss < self.best_loss:
            self.best_loss = val_loss
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                return "stop"
```

- **依赖注入**：将依赖项传递给函数/类，而不是在内部创建它们。这样便于测试（注入模拟对象），同时使配置更加灵活：

```python
# BAD: hard-coded dependency
class Trainer:
    def __init__(self):
        self.logger = WandbLogger()  # cannot test without W&B

# GOOD: injected dependency
class Trainer:
    def __init__(self, logger):
        self.logger = logger  # can inject any logger, including a mock
```

## 配置管理

- 硬编码超参数、文件路径和模型设置会导致实验无法复现，且修改起来十分麻烦。**应将配置外部化**到文件中。

- **YAML**是机器学习配置中最常用的格式：

```yaml
# configs/experiment_1.yaml
model:
  name: transformer
  d_model: 512
  n_heads: 8
  n_layers: 6

training:
  batch_size: 64
  learning_rate: 3e-4
  max_epochs: 100
  early_stopping_patience: 10

data:
  train_path: /data/train.parquet
  val_path: /data/val.parquet
  max_seq_length: 512
```

- **Hydra**（Facebook开发）是一个配置框架，支持配置组合（将基础配置与实验特定的覆盖项合并）、命令行覆盖（`python train.py training.lr=1e-3`）以及多轮运行（对超参数进行遍历）。

- 对于参数较少的脚本，**argparse**更为简单：

```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--lr", type=float, default=3e-4)
parser.add_argument("--batch-size", type=int, default=64)
parser.add_argument("--config", type=str, default="configs/base.yaml")
args = parser.parse_args()
```

- **最佳实践**：设置一个包含所有默认值的基准配置，每个实验的配置仅覆盖那些发生变化的项。将每个实验的配置与其结果一同记录。

## 日志记录与可观测性

- `print`语句用于调试。**日志记录**则用于生产环境：

```python
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

logger.debug("Batch loaded: %d samples", len(batch))     # noisy, for debugging
logger.info("Epoch %d: loss=%.4f, lr=%.6f", epoch, loss, lr)  # normal operation
logger.warning("GPU memory >90%%, consider reducing batch size")
logger.error("Failed to load checkpoint: %s", path)       # recoverable error
logger.critical("CUDA out of memory, aborting")            # fatal
```

- **为何不直接打印**：日志记录支持日志级别设置（在生产环境中过滤掉调试信息）、格式化功能（时间戳、模块名称）以及处理器配置（写入文件或发送到监控系统），且无需更改日志记录调用方式。

- **结构化日志**会同时输出机器可解析的格式（JSON）和人类可读的信息。这使得能够针对特定字段进行搜索和告警：

```python
logger.info("training_step", extra={
    "epoch": 5, "step": 1200, "loss": 0.0342, "lr": 2.1e-4
})
```

## API设计

- 如果你的模型会被其他服务使用（如Web应用、移动应用或另一个机器学习流程），它就需要一个**API**（应用程序编程接口）。

- **REST API**使用HTTP方法：`GET`用于读取，`POST`用于创建/预测，`PUT`用于更新，`DELETE`用于删除。端点采用基于资源的命名方式：

```text
POST /api/v1/predict          # send input, get prediction
GET  /api/v1/models           # list available models
GET  /api/v1/models/{id}      # get model details
POST /api/v1/models/{id}/predict  # predict with a specific model
```

- **FastAPI**是机器学习服务领域首选的Python框架：

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    label: str
    confidence: float

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    result = model.predict(request.text)
    return PredictResponse(label=result.label, confidence=result.score)
```

- FastAPI会自动生成API文档（在`/docs`处提供Swagger UI），利用Pydantic模型验证输入/输出数据，并支持异步处理以实现高吞吐量。

- **gRPC**在内部服务间通信方面比REST更快。它采用Protocol Buffers（二进制序列化格式，比JSON更小且更快），并支持流式传输。TensorFlow Serving、Triton Inference Server以及许多微服务架构都采用了gRPC。

## 打包与分发

- 将代码打包成可安装的包后，其他人（以及你自己的脚本）就能方便地导入使用：

```toml
# pyproject.toml
[project]
name = "my-ml-project"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["torch>=2.0", "jax>=0.4", "pydantic>=2.0"]

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]

[build-system]
requires = ["setuptools>=64"]
build-backend = "setuptools.backends._legacy:_Backend"
```

```bash
pip install -e ".[dev]"    # install in editable mode with dev dependencies
```

- **可编辑安装**（`-e`）：对源代码的更改会立即生效，无需重新安装。开发过程中必不可少。

- **锁定依赖项**：使用包含精确版本的 `requirements.txt`（如 `torch==2.2.1`，而非 `torch>=2.0`）以确保可复现性。使用 `pip freeze > requirements.txt` 来记录当前环境。对于更复杂的依赖管理，可使用 `uv`、`poetry` 或 `pip-tools`。

## 与 AI 编程助手协作

- AI 编程助手（Claude Code、GitHub Copilot、Cursor 等）如今已成为专业工程流程的一部分。善用它们能显著加快开发速度；滥用则会导致隐蔽的漏洞，削弱你对代码库的理解，并制造出虚假的生产力假象。

- 正确的思维模型：**助手就像一位速度快但经验不足的程序员搭档**。它能快速编写代码，熟悉语法和标准模式，阅读的文档也比你多得多。但它并不了解你的具体系统、业务约束、边缘情况，以及设计决策背后的原因。你是资深工程师，助手则是初级程序员。你负责指导、审查并承担责任。

### 助手发挥优势的场景

- **样板代码和框架搭建**：生成 Dockerfile、CI 配置、测试夹具、数据类定义、argparse 设置等。这些遵循既定模式，手动编写十分繁琐。让助手生成后，再检查其正确性。

- **编写测试**：描述函数的行为，助手便会生成测试用例。它常常能发现你忽略的边缘情况（空输入、负值、Unicode 字符）。务必阅读生成的测试——它们验证的是你的假设，而不仅仅是代码本身。

- **重构**：如“将此代码块提取为函数”、“将该类改为使用 dataclass”、“为该模块添加类型提示”。这类机械性转换意图明确，产生隐蔽错误的风险较低。

- **探索与原型开发**：如“写一个快速脚本来衡量推理延迟”或“告诉我如何使用 HuggingFace 分词器 API”。助手能比阅读文档更快地为你提供可用的起点。

- **文档与注释生成**：助手可根据代码结构生成文档。虽需核对准确性，但繁琐的工作已被自动化处理。

- **调试辅助**：粘贴错误回溯信息并请求诊断。助手通常能识别根本原因并提出修复建议，尤其针对常见问题（形状不匹配、导入错误、CUDA 内存不足）。

### 不应依赖助手的场景

- **全新的架构决策**：若你在设计新的训练流程，助手只会给出通用性答案。它不了解你的数据约束、延迟要求或团队专长。应利用助手来实现你已深思熟虑的设计。

- **涉及安全的代码**：如身份验证、加密、输入清理。助手可能生成看似正确却存在隐蔽漏洞的代码（SQL 注入、不安全的默认值、时序攻击）。安全代码应由了解威胁模型的人编写，并由他人审查。

- **性能关键的内部循环**：助手会写出正确但较为简单的代码。对于 GPU 内核、内存敏感的数据结构或延迟敏感的推理路径，你必须理解硬件约束（参见第 13 章、第 16 章）并进行针对性优化。

- **你不理解的代码**：如果助手生成了 200 行代码而你无法解释每行的作用，切勿提交。你将在维护自己无法理解的代码，一旦出错（必然会发生），便无法调试。这是最常见且最危险的失误模式。

### 审查纪律

- **提交前务必逐行阅读生成的代码**。这并非可选操作。助手的代码只是草稿，并非成品。应将其视为同事提交的拉取请求：严格审查。

- **需检查的内容**：
- **正确性**：它是否真的实现了你的需求？助手常会解决一个与你初衷略有差异的问题。
- **边缘情况**：它是否处理了空输入、None 值、负数、超大输入？助手经常忽略边缘情况的处理。
- **虚构的 API**：助手可能会调用不存在的函数或使用无效的参数，尤其是针对较新或不常用的库。务必确认每个 API 调用都是真实存在的。
- **过度设计**：助手往往会产生多余代码。用 50 行代码解决本只需 10 行的问题，只会增加复杂性而无实际益处。务必果断简化。
- **安全性**：硬编码的密钥、未经过滤的用户输入、不安全的默认值。助手不会从对抗角度思考。
- **风格一致性**：生成的代码是否符合项目规范（命名、模式、错误处理）？

### 如何编写优质的提示词

- 助手的输出质量与你的指令质量直接相关。模糊的提示词会得到模糊的代码。

- **糟糕的示例**：“写一个数据加载器”
- **优秀的示例**：“为包含 ‘text’ 和 ‘label’ 列的 CSV 文件编写一个 PyTorch DataLoader。使用 HuggingFace 分词器 ‘bert-base-uncased’ 对文本进行分词，最大长度为 512。返回 input_ids、attention_mask 和 label 作为张量。若 CSV 中 label 列存在缺失值，则跳过这些行。”

- **提供上下文**：告知助手你的项目结构、现有代码、约束条件和规范。上下文越丰富，输出越理想。

- **指定约束条件**：如“仅使用标准库”、“必须兼容 Python 3.10”、“不使用全局变量”、“遵循 `src/models/transformer.py` 中的现有模式”。

- **要求解释说明**：“实现 X 并解释关键设计决策。”这能迫使助手阐明其思路，便于你发现其中的错误假设。

### 利用质量门控捕捉助手的失误

- 你现有的质量基础设施（文件04）能同样有效地捕捉到智能体错误和人为错误：

- **类型检查（mypy）**：能发现虚构的API签名以及类型不匹配问题。
- **代码检查（ruff）**：能发现未使用的导入、未定义的变量以及风格违规问题。
- **测试（pytest）**：如果智能体生成的代码能通过你的测试套件，那么它更可能是正确的。如果你还没有编写测试，请在要求智能体实现功能之前先写好测试（测试驱动开发在智能体场景下尤为有效）。
- **CI流水线**：会在每次提交时自动运行上述所有检查。

- “智能体写代码”加上“质量门限进行验证”的组合，比单独使用其中任何一种方式更具生产力。智能体虽然速度快但容易出错；质量门限虽能全面把关却无法写代码。二者结合，便能兼顾速度与正确性。

### 生产力陷阱

- 编码智能体最大的风险在于**生产力的错觉**。你可以在10分钟内生成500行代码。但如果你因为不理解这些代码而花费2小时来调试，那么你的效率反而低于自己花30分钟编写200行代码的情况。

- 利用智能体实现真正生产力的方法包括：

1. **保持掌控权**：由你决定架构，让智能体负责具体实现。
2. **理解所生成的代码**：如果你无法解释其原理，就重新编写或要求智能体简化。
3. **投资于质量门限**：测试、类型检查和代码检查的成本会在每次与智能体的交互中逐步摊薄。
4. **利用智能体弥补自身短板**：如果你擅长算法但写测试较慢，就让智能体来写测试；如果你擅长UI代码但对数据库查询不熟悉，就让智能体起草SQL语句。发挥自己的优势，把短板交给智能体处理。

- 最能充分利用编码智能体的工程师，恰恰是那些已经具备良好编程能力的人。智能体只是放大你现有的技能，而非取代它。只有掌握了数据结构、算法、系统设计以及软件工程知识（本章内容），才能有效地指导智能体并批判性地评估其输出结果。

## 测试与质量保障

_测试的作用在于确保代码能够正常运行，不仅是在初始状态下，而且在每次代码修改之后也是如此。本文档涵盖了测试金字塔模型、使用pytest进行单元测试、模拟技术、针对机器学习专用代码的测试方法、CI/CD流水线、代码格式检查与代码审查等机制——这些措施有助于在错误流入生产环境之前就将其发现。_

- 机器学习代码往往缺乏足够的测试。“既然已经训练完成了，那它就应该能正常工作”，这是人们普遍持有的观念。这种态度会导致一些隐蔽的错误：数据加载器可能以错误的方式对数据进行排序，损失函数可能存在符号错误，预处理步骤可能会丢失5%的数据。这类错误虽然不会导致程序崩溃，但会逐渐降低模型的性能，而开发者则要花费数周时间去调试那些“本应更高”的指标。

- 测试并非额外的负担，反而是实现高效开发且避免出现问题的最快途径。

## 测试金字塔模型

- 测试被分为不同的层次，从快速且范围有限的测试到缓慢但覆盖范围更广的测试：

- **单元测试**（基础层）：单独测试各个函数和类。执行速度很快（毫秒级），数量众多（数百到数千个）。例如：“`normalise_image`函数是否能够生成[0, 1]范围内的数值？”

- **集成测试**（中间层）：测试各个组件能否协同工作。执行速度较慢（秒级）。例如：“数据加载器生成的数据是否符合模型所需的格式？”

- **端到端测试**（顶层）：测试从输入到输出的整个流程。执行速度很慢（分钟级）。例如：“运行`python train.py --config test.yaml`命令时，是否能无错误地完成，并生成有效的检查点文件？”

- 采用金字塔结构意味着：应编写大量的单元测试，相对较少的集成测试，以及少量的端到端测试。单元测试可以捕获大多数错误，且执行速度很快；而端到端测试虽然能发现集成层面的问题，但速度较慢且容易出错。

## 使用pytest进行单元测试

- **pytest**是Python领域的标准测试框架。一个测试用例是一个以`test_`开头的函数，该函数位于一个同样以`test_`开头的文件中：

```python
# tests/test_utils.py

def test_normalise_image():
    import numpy as np
    image = np.array([0, 128, 255], dtype=np.uint8)
    result = normalise_image(image, mean=128, std=128)
    assert result.min() >= -1.0
    assert result.max() <= 1.0
    assert abs(result[1]) < 1e-6  # 128 normalised by mean=128 should be ~0

def test_normalise_empty():
    import numpy as np
    image = np.array([], dtype=np.uint8)
    result = normalise_image(image, mean=128, std=128)
    assert len(result) == 0
```

```bash
pytest tests/                     # run all tests
pytest tests/test_utils.py        # run one file
pytest -v                         # verbose output
pytest -x                         # stop on first failure
pytest -k "normalise"             # run tests matching name pattern
pytest --tb=short                 # shorter tracebacks
```

### 固定装置

- **固定装置**可用于为测试提供可重复使用的配置。无需在每个测试中都重复编写配置代码，只需将其定义一次即可：

```python
import pytest

@pytest.fixture
def sample_dataset():
    """Create a small dataset for testing."""
    return {
        "inputs": torch.randn(10, 3, 32, 32),
        "labels": torch.randint(0, 10, (10,))
    }

@pytest.fixture
def trained_model():
    """Load a small pretrained model."""
    model = SmallModel()
    model.load_state_dict(torch.load("tests/fixtures/small_model.pt"))
    return model

def test_model_output_shape(trained_model, sample_dataset):
    output = trained_model(sample_dataset["inputs"])
    assert output.shape == (10, 10)  # batch_size x num_classes
```

- 固定装置可以具有**作用范围**：`scope="function"`（默认值，每次测试都会重新创建），`scope="module"`（每个文件中只使用一次），`scope="session"`（每次测试运行时只使用一次）。对于那些需要复杂初始化的操作，比如加载模型，应使用`scope="session"`。

### 参数化测试

- 可以使用不同的输入值来测试同一个函数，从而避免重复编写代码：

```python
@pytest.mark.parametrize("input,expected", [
    ([1, 2, 3], 6),
    ([], 0),
    ([-1, 1], 0),
    ([1000000, 1000000], 2000000),
])
def test_sum(input, expected):
    assert sum(input) == expected
```

## 模拟与补丁应用

- **模拟**是指在测试过程中用虚拟的依赖项替代真实的依赖项。这样一来，就可以在无需数据库、API或GPU的情况下单独测试某个函数。

```python
from unittest.mock import patch, MagicMock

def test_training_logs_metrics():
    mock_logger = MagicMock()

    with patch("my_project.training.trainer.wandb") as mock_wandb:
        trainer = Trainer(logger=mock_logger)
        trainer.train_one_epoch()

        # verify that the trainer logged metrics
        mock_logger.log.assert_called()
        # verify it logged a loss value
        call_args = mock_logger.log.call_args
        assert "loss" in call_args[1]
```

- **何时需要使用模拟对象**：外部服务（API、数据库、云存储）、成本较高的操作（GPU计算、大文件读写操作），以及行为不可预测的部分（随机数生成器、时间戳）。

- **何时不应使用模拟对象**：自己的代码。如果对所有内容都使用模拟对象，那么测试就只能验证模拟对象的运行是否正常，而无法确认实际代码是否能正常工作。应在系统边界处使用模拟对象，直接测试代码逻辑。

## 对机器学习代码进行测试

- 机器学习代码在测试方面存在独特挑战：输出结果具有概率性，训练过程耗时较长，而且“正确”的标准也不明确。

### 使用确定的随机种子

- 在所有地方设置相同的随机种子，以便让测试结果可重复。

```python
import random
import numpy as np
import torch

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
```

### 数值容差

- 浮点数比较需要一定的容差（参见IEEE 754标准第13章）：

```python
# BAD: exact comparison fails due to floating point
assert model_output == 0.5

# GOOD: approximate comparison
import numpy as np
assert np.isclose(model_output, 0.5, atol=1e-5)

# For tensors
assert torch.allclose(output, expected, atol=1e-4)
```

### 机器学习中需要测试的内容

- **形状测试**：确认输出结果具有预期的尺寸。

```python
def test_model_output_shape():
    model = MyModel(d_model=256, n_classes=10)
    x = torch.randn(8, 32, 256)  # batch=8, seq=32, dim=256
    output = model(x)
    assert output.shape == (8, 10)
```

- **梯度流**：确认可训练参数的梯度不为零。

```python
def test_gradients_flow():
    model = MyModel()
    x = torch.randn(4, 3, 32, 32)
    y = torch.randint(0, 10, (4,))

    output = model(x)
    loss = F.cross_entropy(output, y)
    loss.backward()

    for name, param in model.named_parameters():
        assert param.grad is not None, f"No gradient for {name}"
        assert param.grad.abs().sum() > 0, f"Zero gradient for {name}"
```

- **对单个数据集过拟合**：模型应当能够记住某个单一数据集的内容。如果无法做到这一点，那就说明存在根本性的问题。

```python
def test_overfit_one_batch():
    model = MyModel()
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    x, y = get_single_batch()

    for _ in range(100):
        loss = F.cross_entropy(model(x), y)
        loss.backward()
        optimiser.step()
        optimiser.zero_grad()

    assert loss.item() < 0.01, f"Cannot overfit one batch: loss={loss.item()}"
```

- **数据验证**：确认数据加载后能生成有效的结果。

```python
def test_dataset_basics():
    dataset = MyDataset("tests/fixtures/small_data.csv")
    assert len(dataset) > 0
    x, y = dataset[0]
    assert x.shape == (3, 224, 224)
    assert 0 <= y < 10
    assert not torch.isnan(x).any()
    assert not torch.isinf(x).any()
```

- **确定性**：相同的输入 + 相同的种子 → 相同的输出。

```python
def test_determinism():
    set_seed(42)
    output1 = model(input_data)
    set_seed(42)
    output2 = model(input_data)
    assert torch.allclose(output1, output2)
```

## CI/CD流水线

- **持续集成（CI）**：在每次代码提交或Pull Request时自动运行测试。如果测试失败，该Pull Request将无法被合并，从而避免有缺陷的代码进入`main`分支。

- **GitHub Actions**示例（`.github/workflows/ci.yml`）：

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -e ".[dev]"
      - run: ruff check src/
      - run: mypy src/
      - run: pytest tests/ -v --tb=short
```

- **提交前钩子**：在每次提交之前进行检查（在本地执行），从而在问题传送到CI系统之前就将其发现：

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

```bash
pip install pre-commit
pre-commit install    # now hooks run on every git commit
```

## 代码检查与格式化

- **代码检查**无需运行代码即可发现错误及样式问题。**格式化**功能则能自动确保代码风格的一致性。

- **Ruff**：一款高效的Python代码检查工具和格式化工具（可替代flake8、isort和black，集多种功能于一体）：

```bash
ruff check src/          # lint
ruff check --fix src/    # lint and auto-fix
ruff format src/         # format
```

- **mypy**：用于Python的静态类型检查工具，能够在程序运行之前检测出类型错误：

```bash
mypy src/
# src/model.py:42: error: Argument 1 to "forward" has incompatible type "int"; expected "Tensor"
```

- 类型提示能让代码具有自文档化功能，并有助于发现错误：

```python
def train(
    model: nn.Module,
    dataloader: DataLoader,
    optimiser: torch.optim.Optimizer,
    num_epochs: int = 10,
) -> float:
    """Train model and return final loss."""
    ...
```

## 代码审查最佳实践

- **对于代码提交者**：
- 在请求他人审查之前，先自行检查代码中的差异。这样就能发现那些显而易见的问题。
- 将每个PR的内容控制在较小范围内，每个PR只针对一个问题。
- 写出清晰的描述，说明要做什么、为什么这么做以及如何进行测试。
- 对每一条评论都要予以回复，哪怕只是回复“已处理”。

- **对于代码审查者**：
- 保持友善的态度，批评的是代码本身，而非提交代码的人。“这部分可以写得更清晰一些”比“这段代码很让人困惑”要好。
- 区分那些会阻碍程序运行的问题（如漏洞、安全问题）与建议类问题（如风格、命名问题）。可以使用相应的标签来标记：“nit:”、“suggestion:”、“blocking:”。
- 提出问题而非直接下命令。问“如果这个列表是空的，会发生什么？”比直接要求“处理空列表的情况”更有帮助。
- 及时批准代码审查。如果一个PR需要数天才能得到审核，就会耽误提交者的进度，还会导致人们提交大量代码一起审查，而那样做反而更难以处理。

## 部署与DevOps

_部署是模型从研究产物转变为产品的过程。本文档涵盖了用于机器学习的Docker、模型服务、实验追踪、可复现性、生产环境监控、特征存储以及流水线编排等内容——这些基础设施将训练好的模型从笔记本中交付给数百万用户。_

- 只能在你的笔记本电脑上运行的模型只是原型；而能够大规模稳定运行、在毫秒级内返回预测结果、具备故障恢复能力且无需停机即可更新的模型才是产品。两者之间的差距就是**部署与DevOps**。

- 大多数机器学习工程师花费在部署、监控以及调试生产环境问题上的时间，比训练模型的时间还要多。对于构建真正机器学习系统的人员而言，理解这一基础设施并非可有可无。

## 用于机器学习的Docker

- 我们在第13章（操作系统）中已对容器进行了概念性介绍。此处我们重点讨论实际应用：为机器学习工作负载编写Dockerfile。

- **Dockerfile**是用于构建容器镜像的配方：

```dockerfile
# Start from an official CUDA base image
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

# System dependencies
RUN apt-get update && apt-get install -y \
    python3.11 python3-pip git \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies (install separately for caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (changes frequently, so this layer is last)
COPY src/ /app/src/
COPY configs/ /app/configs/
WORKDIR /app

# Entry point
CMD ["python3", "src/scripts/serve.py", "--config", "configs/serve.yaml"]
```

- **层缓存**：Docker会缓存每一层。如果`requirements.txt`没有发生变化，重新构建时就会跳过`pip install`步骤。将很少变化的层（系统包、pip安装内容）放在经常变化的层（源代码）之前。这样就能把原本需要10分钟的构建过程缩短为10秒的重建。

- **GPU访问**：使用`nvidia/cuda`基础镜像，并通过`docker run --gpus all`来运行。NVIDIA容器工具包可实现从主机到容器的GPU直通功能。

- **多阶段构建**通过分离构建环境与运行时环境来减小镜像体积：

```dockerfile
# Build stage: install build tools, compile dependencies
FROM python:3.11 AS builder
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Runtime stage: only runtime dependencies
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04
COPY --from=builder /root/.local /root/.local
COPY src/ /app/src/
ENV PATH=/root/.local/bin:$PATH
```

- 最终镜像仅包含运行时库，不包含编译器、头文件或构建工具。一个5GB的构建镜像可缩减为2GB的运行时镜像。

- **Docker Compose**用于运行多容器环境（模型服务器 + 负载均衡器 + 监控）：

```yaml
# docker-compose.yml
services:
  model:
    build: .
    ports:
      - "8080:8080"
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
```

## 模型服务

- **模型服务**是指将推理功能作为服务来运行：接收请求、运行模型并返回预测结果。

- **FastAPI**（在文件03中介绍）是适用于低至中等吞吐量的最简单方案。对于高吞吐量和基于GPU的优化服务，应使用专用工具：

- **Triton Inference Server**（NVIDIA）：可服务于TensorRT、ONNX、PyTorch和TensorFlow格式的模型。其功能包括：
- **动态批处理**：将单个请求收集起来并打包以提高GPU效率。例如，将一系列单个请求合并为每组32个，从而显著提升吞吐量。
- **模型集成**：在一个请求中串联多个模型（预处理器 → 模型 → 后处理器）。
- **多模型服务**：在同一GPU上同时提供多个模型服务，共享资源。
- **并发模型执行**：在同一GPU上并行处理多个推理请求。

- **TorchServe**（PyTorch）：通过REST/gRPC API来提供PyTorch模型的服務。支持模型版本管理、A/B测试和自定义处理器。

- **vLLM**：专为大型语言模型服务而设计。它实现了PagedAttention（高效的KV缓存管理机制）、连续批处理以及跨GPU的张量并行化。相较于普通的服务模式，其针对大型语言模型的吞吐量可提高10到20倍。

- **Cactus** ([github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus))：一款用于移动端和边缘设备上的低延迟AI引擎。Cactus提供**兼容OpenAI的API**（涵盖聊天补全、流式传输、工具调用、转录、嵌入、RAG及视觉功能），这些功能完全在设备上运行；当本地模型无法处理请求时，它会自动切换到云端。这种混合架构意味着无论推理是在本地还是云端进行，应用程序代码使用的都是同一套API——引擎会根据模型置信度和设备能力来决定执行方式。该引擎为Python、Swift、Kotlin、Flutter、React Native和Rust提供了SDK，HuggingFace上也有预先转换好的模型权重。它支持多模态推理（大型语言模型、视觉、语音），并针对ARM CPU优化了自定义SIMD内核以实现最快推理速度；同时采用零拷贝内存映射技术，使RAM占用量减少10倍（详见第16章、第17章）。

- **模型格式优化**：
- **ONNX**：一种开放格式，便于模型互操作。可从PyTorch/TensorFlow导出，并在任何地方运行。
- **TensorRT**：NVIDIA的优化工具。它能融合图层、选择最优内核并对权重进行量化。在NVIDIA GPU上，其运行速度通常比PyTorch快2到5倍。
- **GGUF/GGML**：专为CPU高效推理设计的格式，常用于在消费级硬件上运行大型语言模型。

## 实验跟踪

- 如果没有实验跟踪机制，机器学习研究就会变成：“我觉得上周二用某种配置训练的模型效果最好，但我记不清具体改了什么。”

- **Weights & Biases (W&B)**：最受欢迎的实验跟踪工具。可以记录训练脚本中的任何数据：

```python
import wandb

wandb.init(project="my-project", config={
    "model": "transformer",
    "lr": 3e-4,
    "batch_size": 64,
})

for epoch in range(num_epochs):
    train_loss = train_one_epoch()
    val_loss = validate()

    wandb.log({
        "train/loss": train_loss,
        "val/loss": val_loss,
        "epoch": epoch,
    })

    # Log model as artifact
    if val_loss < best_loss:
        wandb.save("best_model.pt")

wandb.finish()
```

- W&B提供：用于比较实验的仪表板、超参数搜索工具、模型注册表、数据集版本管理以及团队协作功能。

- **MLflow**：开源替代品。可在本地或服务器上运行：

```python
import mlflow

mlflow.set_experiment("my-experiment")

with mlflow.start_run():
    mlflow.log_params({"lr": 3e-4, "batch_size": 64})
    mlflow.log_metric("val_loss", 0.042, step=epoch)
    mlflow.pytorch.log_model(model, "model")
```

- **模型注册表**：一个用于存储已训练模型的中央仓库，支持版本管理、环境切换（开发 → 预发布 → 生产）以及元数据记录。W&B和MLflow都提供此类注册表。注册表可以回答以下问题：“当前生产中运行的是哪个模型？谁训练的它？其验证准确率是多少？又是用哪些代码和数据生成的？”

## 可复现性

- 可复现性意味着：在相同的代码、数据和配置条件下，能够生成相同的模型。由于GPU操作的非确定性、数据洗牌以及浮点数累加等因素，在机器学习领域实现可复现性其实相当困难。

- **可复现性检查清单**：

| 项目 | 实现方式 |
| --- | --- |
| 代码版本 | Git提交哈希值 |
| 配置/超参数 | 配置文件（在Git中版本控制或记录到W&B） |
| 随机种子 | 设置并记录所有种子（Python、NumPy、PyTorch、CUDA） |
| 数据版本 | DVC哈希值、数据集版本标签或S3对象版本 |
| 依赖项 | `pip freeze`输出、Docker镜像哈希值或锁文件 |
| 硬件 | GPU类型、GPU数量、CUDA版本 |
| 非确定性问题 | 设置 `torch.backends.cudnn.deterministic = True`（速度较慢但可复现） |

- **固定所有版本**：使用 `pip install torch==2.2.1` 而非 `torch>=2.0`。即使是次要版本更新也可能改变数值行为、优化器实现或默认超参数。

- **利用Docker保证可复现性**：Docker镜像会固定操作系统、系统库、Python版本以及pip包版本。镜像哈希值代表了完整的环境指纹。只要能复现该Docker镜像，就能复现训练过程。

## 生产环境监控

- 部署模型并非终点，而是新问题的起点。随着现实世界的变化（**概念漂移**）以及输入数据分布的改变（**数据漂移**），模型性能会逐渐下降。

- **需要监控的内容**：

- **延迟**：推理需要多长时间？需跟踪p50（中位数）、p95和p99。如果p99达到500毫秒，意味着每100个用户中就有1个需要等待半秒，这可能无法被接受。

- **吞吐量**：每秒能处理多少请求？系统能否满足需求？

- **错误率**：有多少请求会失败（异常、超时、输入无效）？

- **模型指标**：在保留数据集上的准确率、精确度和召回率。如果生产环境中能获得带标签的数据（如用户修正结果），则可跟踪在线指标。

- **数据漂移**：传入数据的分布是否发生变化？例如，在白天照片上训练的模型可能在夜间照片上表现不佳。统计测试（如KS检验、PSI）可用于比较训练数据与实时数据分布。

- **特征漂移**：单个特征的分布是否发生变化？若某个在训练时呈正态分布的特征现在变为双峰分布，则表明数据管道存在问题。

- **工具**：
- **Prometheus** + **Grafana**：基础设施监控的标准方案。Prometheus负责收集指标，Grafana则在仪表板上可视化这些指标并设置警报。
- **Evidently AI**：开源的机器学习监控工具。可生成关于数据漂移、模型性能和数据质量的报告。

- **警报机制**：不能仅依靠仪表板查看——应设置自动警报。“如果p99延迟连续5分钟超过200毫秒，则发送Slack通知。”“如果数据漂移评分超过阈值，则通知值班工程师。”

## 特征存储

- **特征存储**是一个集中式仓库，用于存放预先计算好的特征，供训练和推理阶段共享使用。它解决了两个问题：

- **训练与推理不一致**：训练时使用的特征必须与推理时完全一致。如果训练时使用某种方式计算的 `user_age_at_signup`，而推理时计算方法不同，模型的预测结果就会出错。

- **特征复用**：多个模型常常使用相同的特征（如用户人口统计数据、物品嵌入向量、聚合统计信息）。只需计算一次并共享，即可避免重复计算和一致性问题。

- **Feast**是最受欢迎的开源特征存储工具。它负责管理在线特征（低延迟，存储在Redis或DynamoDB中）和离线特征（批量数据，存储在数据仓库中用于训练）。

- 对于推荐系统、欺诈检测以及任何需要从原始数据管道中计算特征的应用而言，特征存储至关重要。

## 流水线编排

- 生产环境中的机器学习系统不仅仅是一个模型，它实际上是一条**流水线**：数据摄取 → 预处理 → 特征计算 → 训练 → 评估 → 部署 → 监控。每一步都依赖于前一步，可能独立出错，且往往需要按不同时间表运行。

- **编排工具**用于管理这些流水线：

- **Apache Airflow**：数据流水线编排的标准工具。DAG（有向无环图）用于定义任务间的依赖关系。每个任务可独立运行，失败时可重试，并通过Web界面进行监控。

```python
# airflow DAG example (simplified)
from airflow import DAG
from airflow.operators.python import PythonOperator

dag = DAG("training_pipeline", schedule="@daily")

preprocess = PythonOperator(task_id="preprocess", python_callable=preprocess_data, dag=dag)
train = PythonOperator(task_id="train", python_callable=train_model, dag=dag)
evaluate = PythonOperator(task_id="evaluate", python_callable=evaluate_model, dag=dag)
deploy = PythonOperator(task_id="deploy", python_callable=deploy_model, dag=dag)

preprocess >> train >> evaluate >> deploy
```

- **Kubeflow Pipelines**：基于Kubernetes的机器学习专用编排工具。每个步骤都在容器中运行，GPU资源按需分配，实验过程可自动追踪。

- **Prefect**和**Dagster**：Airflow的现代替代品，具备更佳的开发体验、原生的Python API以及内置的数据血缘功能。

- **何时需要编排**：当你的流水线包含2-3个以上步骤、按预定时间运行、涉及多个团队或服务，或需要自动从故障中恢复时，就需要使用编排工具。单脚本训练任务无需编排器；而每天从5个数据源获取数据、训练3个模型、评估后部署最佳模型的流水线则绝对需要编排工具。

---

> 本文是 Henry Ndubuaku 所著 [_Maths, CS & AI Compendium_](https://henryndubuaku.github.io/maths-cs-ai-compendium/) 对应章节的中文翻译，依据 [Apache License 2.0](/compendium/LICENSE) 发布，原文版权归作者所有。译文包含中文翻译与站点排版适配，如与[英文原文](https://github.com/HenryNdubuaku/maths-cs-ai-compendium)有出入，以原文为准。
