
<a id="readme-top"></a>

English |
[简体中文](./README.md)

<div align="center">

  <img src="./public/memoria_brand.svg" width="480" style="margin=0">
  <h3 align="center">Memoria</h3>
  <p align="center">
    On-device semantic retrieval mini knowledge base built on the SeekDB vector database
    <br /><br />
    <a href="https://github.com/Fooxygen/Memoria/issues/new?labels=bug">
      <strong>» Report Bug</strong>
    </a>
    <a href="https://github.com/Fooxygen/Memoria/issues/new?labels=enhancement">
      <strong>» Request Feature</strong>
    </a>
  </p>

</div>

## About the Repository

Memoria is a mini knowledge base that runs in the browser.

Documents are split after import and embedded on-device, then written into SeekDB. Retrieval recalls passages with a hybrid of vector and full-text search.

The repository includes Memoria's frontend and backend code. You can:

- browse the sample documents in `example/`;
- prepare the on-device model in `data/models/`;

To run it, refer to **Build & Run** below.

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## Architecture

| Layer | Task |
| - | - |
| User | Document import, key retrieval, source reading |
| Inference | On-device model loading, text embedding |
| Data | Storage of vectors, source text and metadata, hybrid retrieval |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## Build

| Category | Technology | Version |
| - | - | - |
| Language | TypeScript | 6.0 |
| Build Tool | Vite | 8.2 |
| Runtime | Node.js | 20.19+ |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## Dependency

| Module | Task | Version |
| - | - | - |
| Transformers.js | On-device inference | 4.2.0 |
| all-MiniLM-L6-v2 | Text embedding, 384 dimensions | Xenova |
| seekdb | Embedded vector database | 1.4.0 |

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## Build & Run

### Setup

On-device inference uses `Xenova/all-MiniLM-L6-v2`. Model weights are not tracked by the repository. Fetch and verify them with:

```bash
npm run model:fetch
npm run model:check
```

By default only the INT8 runtime files are downloaded. For FP16 / FP32 evaluation weights:

```bash
npm run model:fetch -- --dtype all
```

The model is pinned to `Xenova/all-MiniLM-L6-v2@751bff3`, with file hashes in `scripts/model/models.lock.json`. The script writes to `data/models/` by default; override it with `MEMORIA_MODEL_ROOT`. SeekDB uses `data/db/` by default; override it with `MEMORIA_DB_PATH`.

Model source: [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2). If access is restricted, set `HF_ENDPOINT=https://hf-mirror.com` and retry.

### Build

Install dependencies and produce the build output.

```bash
npm install
npm run build
```

### Run

Start the development server, or preview the build output.

```bash
npm run dev
npm run preview
```

> [!NOTE]
> SeekDB runs in embedded mode, with data stored in `data/db/`.

### Test

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Integration tests use temporary directories and do not pollute `data/db/`; E2E uses system Edge by default, and can switch with `PLAYWRIGHT_CHANNEL=chrome`.

### Evaluation

```bash
npm run eval
npm run bench
```

`eval` writes model size and retrieval quality data; `bench` writes import and first/warm query timings. Results are saved in `bench/results/`.

### Usage

- Left pane: drop or select text documents; each document is split and embedded on-device before being written into the knowledge base;
- Right pane:
  - Key Retrieval: enter a query to search; results are presented as a collection of retrieval cards, switchable between **Hybrid Search** and **Vector Search**; click a result card to open the source reader and highlight the matched passage;
  - Source Reading: click a knowledge-base document card or a result card to show its source text on the far right, automatically scrolled to the hit;

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## Documentation

- [Technical Note](./docs/TECHNICAL.md)
- [Benchmark Report](./docs/BENCHMARK.md)
- [Testing and Reproduction](./docs/TESTING.md)
- [Raw model-size and quality data](./bench/results/)
- [Raw performance data](./bench/results/performance.json)

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## License

Copyright (c) 2026 BaseTUT. With BaseTUT. Licensed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>
