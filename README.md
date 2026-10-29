
<a id="readme-top"></a>

简体中文 |
[English](./README.en.md)

<div align="center">

  <img src="./public/memoria_brand.svg" width="480" style="margin=0">
  <h3 align="center">Memoria</h3>
  <p align="center">
    基于 SeekDB 向量数据库的端侧语义检索迷你知识库
    <br /><br />
    <a href="https://github.com/Fooxygen/Memoria/issues/new?labels=bug">
      <strong>» 报告问题</strong>
    </a>
    <a href="https://github.com/Fooxygen/Memoria/issues/new?labels=enhancement">
      <strong>» 请求特性</strong>
    </a>
  </p>

</div>

## 关于仓库

Memoria 是一个运行在浏览器中的迷你知识库。

文档在导入后被切分，并在端侧完成向量化，随后写入 SeekDB。检索时采用向量与全文混合的方式召回片段。

仓库包含 Memoria 的前端与后端代码，你可以：

- 在 `example/` 中浏览示例文档；
- 在 `data/models/` 中准备端侧推理模型；

要运行，请参阅下文的 **构建与运行**。

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 架构

| 层次 | 任务 |
| - | - |
| 用户层 | 文档导入、关键检索、原文阅览 |
| 推理层 | 端侧模型加载，文本 Embedding |
| 数据层 | 向量、原文与元数据存，混合检索 |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 构建

| 类别 | 技术 | 版本 |
| - | - | - |
| 开发语言 | TypeScript | 6.0 |
| 构建工具 | Vite | 8.2 |
| 运行时 | Node.js | 20.19+ |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 依赖

| 模块 | 任务 | 版本 |
| - | - | - |
| Transformers.js | 端侧推理 | 4.2.0 |
| all-MiniLM-L6-v2 | 文本向量化，384 维 | Xenova |
| seekdb | 嵌入式向量数据库 | 1.4.0 |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 构建与运行

### 准备

端侧推理使用 `Xenova/all-MiniLM-L6-v2`。模型权重不纳入仓库，运行以下命令拉取并校验：

```bash
npm run model:fetch
npm run model:check
```

默认只拉取 INT8 运行时所需的文件；如需 FP16 / FP32 评测权重：

```bash
npm run model:fetch -- --dtype all
```

模型固定到 `Xenova/all-MiniLM-L6-v2@751bff3`，文件哈希记录在 `scripts/model/models.lock.json`。脚本默认写入 `data/models/`，可通过 `MEMORIA_MODEL_ROOT` 覆盖；SeekDB 默认位于 `data/db/`，可通过 `MEMORIA_DB_PATH` 覆盖。

模型来源：[Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)。如访问受限，可设置 `HF_ENDPOINT=https://hf-mirror.com` 后重试。

### 构建

安装依赖并产出构建产物。

```bash
npm install
npm run build
```

### 运行

启动开发服务器，或预览构建产物。

```bash
npm run dev
npm run preview
```

> [!NOTE]
> SeekDB 以嵌入式方式运行，数据落在 `data/db/`。

### 测试

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

集成测试使用临时目录，不会污染 `data/db/`；E2E 默认使用系统 Edge，可通过 `PLAYWRIGHT_CHANNEL=chrome` 切换。

### 使用

- 左栏：拖入或选择文本文档，文档会被切分并在端侧向量化后写入知识库；
- 右栏：
  - 关键检索：输入查询并检索，结果以检索卡片组呈现，可切换 **混合检索** 与 **向量检索**；
  - 原文阅览：点击知识库中的文档卡片，将在最右侧展示原文内容；

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 许可证

Copyright (c) 2026 BaseTUT. Licensed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>
