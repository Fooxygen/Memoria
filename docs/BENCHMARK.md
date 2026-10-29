# Memoria 评测报告

本报告对应 `bench/results/` 下的原始 JSON/Markdown。所有数字来自当前仓库实际运行，不使用预计算向量或回放结果。

## 固定条件

| 项目 | 值 |
| --- | --- |
| 模型 | Xenova/all-MiniLM-L6-v2 |
| Revision | 751bff37182d3f1213fa05d7196b954e230abad9 |
| 应用精度 | INT8（q8） |
| 对比基线 | FP32 |
| 浏览器性能环境 | Windows，Microsoft Edge 156（Playwright headless） |
| 质量环境 | Node.js CPU + Transformers.js 4.2.0 |
| 语料 | `example/` 2 篇文档，64 个 chunk |
| 查询集 | [`bench/queries.json`](../bench/queries.json)，12 条 |
| 文档导入规模 | 28 个 chunk |

## 模型体积

| 精度 | 文件 | 字节 | MB | MiB | 相对 FP32 |
| --- | --- | ---: | ---: | ---: | ---: |
| FP32 | `onnx/model.onnx` | 90,387,606 | 90.39 | 86.20 | 1.00x |
| FP16 | `onnx/model_fp16.onnx` | 45,297,825 | 45.30 | 43.20 | 2.00x |
| INT8 | `onnx/model_quantized.onnx` | 22,972,370 | 22.97 | 21.91 | 3.93x |

INT8 相对 FP16 为 1.97x。应用实际只加载 INT8 ONNX 与共享 tokenizer/config，不加载另外两份 ONNX。

## 检索质量

方法：对每篇文档使用与前端相同的 `text_chunk_document` 切分；对每个 chunk 和 query 使用同一精度的 embedding；按归一化向量的余弦相似度排序，取前 10；相关性由 query 中的唯一关键词标注，采用二值 nDCG。余弦排序与 seekdb 的 `inner_product` 在归一化 embedding 上等价。

| Run | Recall@5 | Recall@10 | nDCG@5 | nDCG@10 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: |
| FP32 | 0.875 | 0.9583 | 0.8229 | 0.8492 | 0.8438 |
| INT8 | 0.875 | 0.9583 | 0.7812 | 0.8109 | 0.7917 |
| FP16 | 未完成 | — | — | — | — |

INT8 相对 FP32：Recall@5 `0`，Recall@10 `0`，nDCG@5 `-0.0417`，nDCG@10 `-0.0383`，MRR `-0.0521`。FP16 在 Node CPU 的 ONNX Runtime 初始化阶段报图优化错误，因此不报告质量数值；应用使用 INT8，FP16 仅保留体积与后续 WebGPU 评估能力。

原始数据：

- [`bench/results/retrieval-quality.json`](../bench/results/retrieval-quality.json)
- [`bench/results/retrieval-quality.md`](../bench/results/retrieval-quality.md)

## 性能

方法：Playwright 驱动 Edge；先通过 UI 导入示例文档，记录导入各阶段；再分别用默认后端和强制无 WebGPU 的上下文执行 1 次首次查询与 3 次预热查询。首次值为单次，预热值为 3 次中位数。`search:api` 包含浏览器到本地 Vite、seekdb 查询与响应序列化。

### 查询

| 指标 | 默认 WebGPU | 强制 WASM |
| --- | ---: | ---: |
| 模型加载（首次查询） | 2008.2 ms | 1500.1 ms |
| 首次查询 encode | 3158.3 ms | 1592.3 ms |
| 首次查询端到端 | 3576.3 ms | 1959.4 ms |
| 预热查询 encode（中位数） | 156.2 ms | 8.5 ms |
| seekdb 检索 API（中位数） | 21.1 ms | 22.1 ms |
| 预热查询端到端（中位数） | 196.4 ms | 56.8 ms |

### 文档导入

| 阶段 | 耗时 |
| --- | ---: |
| 文件读取 | 1.5 ms |
| 模型加载 | 2313.9 ms |
| 文本 encode（28 chunk） | 8224.6 ms |
| 写入 seekdb | 589 ms |
| 索引刷新 | 307.9 ms |
| 总计 | 9333.6 ms |

### 结论与限制

- 本地 ORT 运行时消除了 jsDelivr 下载造成的分钟级阻塞；E2E 断言没有外部 CDN/HuggingFace 请求。
- headless Edge 上 INT8 + WebGPU 的预热 query encode 明显慢于 WASM（156.2 ms vs 8.5 ms），说明 q8 算子在该 WebGPU 环境存在回退/调度开销；应用仍按要求优先 WebGPU，真实 GPU 结果需单独复测。
- 首次查询包含模型加载；预热查询只包含 query encode、seekdb API 与渲染。
- 文档导入的 `encode` 包含首次模型加载；模型加载已单列。
- 首次查询与导入为单次采样，预热查询为中位数；建议在目标机器上重复运行 `npm run bench` 并保留新的原始 JSON。

原始数据：

- [`bench/results/performance.json`](../bench/results/performance.json)
- [`bench/results/performance.md`](../bench/results/performance.md)
- [`bench/results/model-size.json`](../bench/results/model-size.json)

## 复现

```bash
npm ci
npm run model:fetch
npm run model:check
npm run eval
npm run bench
```

`npm run eval` 生成体积与质量数据；`npm run bench` 启动独立测试服务和数据库，生成首次/预热/导入数据。
