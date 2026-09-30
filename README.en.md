
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

On-device inference uses `Xenova/all-MiniLM-L6-v2`. Place the model files in `data/models/`, with the following structure:

- `config.json`;
- `tokenizer.json`;
- `tokenizer_config.json`;
- `special_tokens_map.json`;
- `vocab.txt`;
- `onnx/model.onnx`;
- `onnx/model_fp16.onnx`;
- `onnx/model_quantized.onnx`.

The model can be obtained from [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) on HuggingFace.

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

### Usage

- Left pane: drop or select text documents; each document is split and embedded on-device before being written into the knowledge base;
- Right pane:
  - Key Retrieval: enter a query to search; results are presented as a collection of retrieval cards, switchable between **Hybrid Search** and **Vector Search**;
  - Source Reading: click a document card in the knowledge base to show its source text on the far right;

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>

## License

Copyright (c) 2026 BaseTUT.

Licensed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">⭱ Back to top</a></p>
