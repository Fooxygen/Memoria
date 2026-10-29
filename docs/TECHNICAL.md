# Memoria 技术说明

Memoria 是一个端侧语义检索知识库：文档在浏览器中切分并完成 embedding，向量、原文与元数据写入 seekdb，查询通过 seekdb 的向量 + 全文混合检索返回。

## 模型与量化

| 项目 | 值 |
| --- | --- |
| 模型 | `Xenova/all-MiniLM-L6-v2` |
| Revision | `751bff37182d3f1213fa05d7196b954e230abad9` |
| License | Apache-2.0 |
| 维度 | 384 |
| 运行时 | Transformers.js 4.2.0 + ONNX Runtime Web |
| 应用精度 | INT8（`dtype: "q8"`） |

应用使用官方提供的 `model_quantized.onnx`（INT8），不依赖云端推理。仓库同时保留 FP16/FP32 权重用于体积与质量对比；运行时只加载选中的 ONNX 文件和约 0.9 MiB 的 tokenizer/config。

| 精度 | 文件 | 体积 | 压缩比 |
| --- | --- | ---: | ---: |
| FP32 | `model.onnx` | 90.39 MB | 1.00x |
| FP16 | `model_fp16.onnx` | 45.30 MB | 2.00x |
| INT8 | `model_quantized.onnx` | 22.97 MB | 3.93x（相对 FP16 1.97x） |

检索质量使用 2 篇示例文档、64 个 chunk、12 条标注 query，按归一化 embedding 的余弦相似度（等价于 seekdb `inner_product`）排序：

| Run | Recall@5 | Recall@10 | nDCG@5 | nDCG@10 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: |
| FP32 | 0.875 | 0.9583 | 0.8229 | 0.8492 | 0.8438 |
| INT8 | 0.875 | 0.9583 | 0.7812 | 0.8109 | 0.7917 |

INT8 的 Recall@5/10 与 FP32 持平，nDCG@5 下降 0.0417，MRR 下降 0.0521。FP16 质量未在 Node CPU runner 上完成初始化，因此不报告其质量结论；应用实际使用 INT8。原始数据见 [`bench/results/retrieval-quality.json`](../bench/results/retrieval-quality.json)。

## 端侧运行与降级

- 模型与 ONNX Runtime Web 的 `.mjs`/`.wasm` 均由本地提供：模型来自 `/models/`，ORT 来自 `/onnx_runtime/`，并设置 `allowRemoteModels = false`。
- 优先尝试 WebGPU；浏览器无 `navigator.gpu` 或 WebGPU 初始化失败时自动切换 WASM。
- 界面初始显示“待加载”，加载中显示“加载中”，完成后显示 WebGPU/WASM；降级会写入日志并保留明确的推理后端徽章。
- 模型加载失败会清除加载 promise，允许下一次操作重试。
- Playwright 用例通过移除 `navigator.gpu` 验证 WASM 路径，同时断言没有 jsDelivr/HuggingFace 请求；真实 WebGPU 环境完成过 28 个 chunk 的导入验证。

## seekdb 数据层

- 嵌入式 seekdb 1.4.0，数据默认在 `data/db/`（可用 `MEMORIA_DB_PATH` 覆盖）。
- collection `chunks`：HNSW 384 维、`inner_product`、全文索引使用 `ik` 分词。
- 关系表：`documents` 保存标题/预览/切片数/内容哈希；`document_contents` 保存完整原文。
- 每个 chunk 的 metadata 保存 `id_document`、`idx_chunk`、`offset_start`、`offset_end`，用于从检索结果精确定位原文。
- 混合检索调用 seekdb `hybridSearch`，由数据库完成全文与向量的 RRF 融合；客户端不分别取两路结果再拼合。
- 写入后合并触发 `refresh_index`；检索前会检查 dirty 状态，服务启动时也会强制刷新一次，避免重启后旧写入无法检索。
- 导入先校验 384 维 embedding；写入失败回滚文档、原文与 chunk；删除文档时同步清理三类数据。单知识库/单集合是当前范围，检索历史保存在客户端会话中。

## 性能与优化

基准环境为 Windows 上的 headless Microsoft Edge 156，使用本地模型和本地 ORT，28 个 chunk 的示例文档：

| 指标 | 默认 WebGPU | 强制 WASM |
| --- | ---: | ---: |
| 模型加载（首次查询） | 2008 ms | 1500 ms |
| 首次查询端到端 | 3576 ms | 1959 ms |
| 预热查询端到端（3 次中位数） | 196 ms | 57 ms |
| 预热查询 encode（3 次中位数） | 156 ms | 8.5 ms |
| seekdb 检索 API（3 次中位数） | 21 ms | 22 ms |

文档导入：读取 1.5 ms、模型加载 2314 ms、encode 8225 ms、写入 589 ms、索引刷新 308 ms，总计 9334 ms。

已采用的优化包括本地 ORT 资源、懒加载模型、按文档批量 encode、索引刷新合并、增量 DOM 渲染、重复内容哈希跳过，以及导入队列串行化。headless Edge 上 INT8 + WebGPU 的预热查询慢于 WASM，原因可能是 q8 算子与 WebGPU 后端适配开销；应用仍按要求优先 WebGPU，后续可在真实 GPU 上评估 FP16 WebGPU。原始数据见 [`bench/results/performance.json`](../bench/results/performance.json)。

## 复现

```bash
npm ci
npm run model:fetch
npm run model:check
npm run dev          # 或 npm run build && npm run preview
npm test
npm run test:e2e
npm run eval
npm run bench
```

详细评测方法见 [`docs/BENCHMARK.md`](./BENCHMARK.md)，测试与隔离说明见 [`docs/TESTING.md`](./TESTING.md)。
