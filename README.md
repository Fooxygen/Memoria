
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

端侧推理使用 `Xenova/all-MiniLM-L6-v2`，请将模型文件放入 `data/models/`，目录结构如下：

- `config.json`；
- `tokenizer.json`；
- `tokenizer_config.json`；
- `special_tokens_map.json`；
- `vocab.txt`；
- `onnx/model.onnx`；
- `onnx/model_fp16.onnx`；
- `onnx/model_quantized.onnx`。

模型可从 HuggingFace 的 [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) 获取。

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

### 使用

- 左栏：拖入或选择文本文档，文档会被切分并在端侧向量化后写入知识库；
- 右栏：
  - 关键检索：输入查询并检索，结果以检索卡片组呈现，可切换 **混合检索** 与 **向量检索**；
  - 原文阅览：点击知识库中的文档卡片，将在最右侧展示原文内容；

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## 许可证

Copyright (c) 2026 BaseTUT. Licensed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>
