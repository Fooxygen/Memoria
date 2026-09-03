
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { SourceDoc } from "./types";

export const SAMPLE_DOCS: SourceDoc[] = [
    {
        id: "doc-1",
        title: "公司数据安全与 AI 使用规范 2026.md",
        content: `# 公司数据安全与 AI 使用规范 2026
1. 目的与适用范围：本规范旨在保障公司内部核心数据的安全性，规范员工在日常研发与运营中使用 AI 辅助工具的行为。
2. 敏感数据定义：包括但不限于用户身份证件、支付密码、未公开的核心产品源代码、未发布的财务报表以及客户私人联系方式。
3. 严禁上传数据：所有员工在外部第三方公共 AI 接口（如公共 Chatbot）中，严禁输入任何包含"敏感数据"级别的代码片段或文档。
4. 本地化部署要求：任何包含商业机密的项目均必须使用本地化部署的 PrivaSearch 向量知识库进行检索与增强，确保数据不出内网。
5. 违规责任：违反本规范导致数据泄露者，公司将依法追究行政及法律责任。`,
    },
    {
        id: "doc-2",
        title: "私有化 RAG 架构设计与优化指南.txt",
        content: `私有化 RAG (检索增强生成) 架构设计指南
一、检索流程优化
1. 文档切片 (Chunking)：推荐将文档按照 300 - 500 字符的段落进行动态切片，重叠率 (Overlap) 保持在 10%-15%，以保留上下文连贯性。
2. 混合检索 (Hybrid Search)：结合 Dense Vector (语义向量，如 BGE/M3) 与 Sparse Keyword (如 BM25) 算法。混合检索能在保证语义理解的同时兼顾专有名词精确匹配。
3. 重排 (Reranking)：在初步检索出的 Top-20 结果中，引入 Cross-Encoder 模型进行精准打分重排，可大幅提升最终送入 LLM 上下文的准确率。
二、性能指标
本地向量数据库在高并发场景下，首字延迟 (TTFT) 应控制在 200ms 以内，向量匹配吞吐量应达到 1000 QPS 以上。`,
    },
    {
        id: "doc-3",
        title: "本地大语言模型部署手册.md",
        content: `本地大语言模型部署手册
一、硬件最低要求
- GPU: NVIDIA RTX 4090 (24GB 显存) 或 Apple M-series Max/Ultra 芯片 (统一内存 >= 32GB)
- 存储: NVMe SSD 剩余空间 >= 50GB
二、量化与部署框架
1. Ollama: 适合快速安装部署 7B/14B 量化模型 (如 Qwen2.5-7B-Instruct-GGUF)。
2. vLLM: 适合生产环境提供高吞吐的 API 接口，支持 PagedAttention 内存管理。
三、安全防御
部署本地模型时，必须关闭公网暴露端口，仅开放 127.0.0.1 本地回环接口，并通过 Nginx 反向代理进行鉴权认证。`,
    },
];
