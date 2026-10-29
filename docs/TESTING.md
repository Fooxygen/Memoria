# Memoria 测试与复现

## 环境

- Node.js 20.19+
- `npm ci`
- 模型准备：`npm run model:fetch`，校验：`npm run model:check`
- E2E 默认使用系统 Edge；没有 Edge 时可用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | TypeScript 全量检查（src/server/scripts/tests） |
| `npm run test:unit` | 文本切分、HTML 转义、结果渲染、设置、队列状态 |
| `npm run test:integration` | 临时 seekdb 上的 DB/API 集成测试 |
| `npm test` | 先 unit，再 integration |
| `npm run test:e2e` | Edge 端到端：检索、降级、原文高亮、健康检查 |
| `npm run eval` | 模型体积 + 检索质量 |
| `npm run bench` | 浏览器首次/预热查询与文档导入基准 |

## 隔离策略

- 集成测试通过 `MEMORIA_DB_PATH` 指向系统临时目录，不读写 `data/db/`。
- 每个测试文件使用独立临时目录；`db_close()` 在 `afterAll` 调用。
- Playwright 使用 `data/e2e-test`，webServer 启动前执行 `tests/e2e/reset-db.ts` 清理。
- E2E 的模型来自 `data/models`，ORT 来自 `node_modules/onnxruntime-web/dist`。
- Windows 上 seekdb 关闭后可能短暂持有 log/sstable 句柄；测试对临时目录采用 best-effort 清理并提示，不影响断言。

## 覆盖点

### 单元

- 空文本、空白文本、段落切分、CRLF、长中文硬切。
- chunk 的 UTF-16 偏移可由原文 `slice` 还原。
- HTML/XSS 转义、结果卡片顺序与 metadata、reader 段落偏移。
- 搜索默认值、模型维度、队列 fail 状态。

### 集成

- 临时 seekdb 初始化、collection/table 创建。
- 写入、语义检索、混合检索、索引刷新、删除。
- 文档内容、内容哈希去重、启动索引刷新。
- API：health、documents、content、ingest、search、flush、delete。
- 无向量/错误向量、未知路由、模型静态文件 HEAD。
- 无效 embedding 不产生部分写入；失败导入回滚。

### 端到端

- 强制移除 `navigator.gpu`，验证自动降级到 WASM。
- 断言推理后端徽章、降级日志、无 jsDelivr/HuggingFace 请求。
- 检索结果点击打开 reader，自动滚动并高亮 chunk。
- 页面加载和 `/api/health`。

### 评测

- 模型体积与压缩比。
- 12 条标注 query 的 Recall@5/10、nDCG@5/10、MRR。
- 默认后端与强制 WASM 的首次/预热查询、seekdb API、导入分阶段耗时。

详细数字见 [`docs/BENCHMARK.md`](./BENCHMARK.md)。

## 已知限制

- FP16 质量评测未在 Node CPU runner 上完成（ONNX Runtime 初始化错误）；应用使用 INT8。
- headless Edge 的 WebGPU/INT8 性能与真实 GPU/Chrome 可能存在差异，建议在目标机器重复 `npm run bench`。
- 首次查询与文档导入为单次采样，预热查询取 3 次中位数。
- 当前范围为单知识库/单集合，不包含多知识库切换。
