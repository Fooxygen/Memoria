# Retrieval Quality

Model: `Xenova/all-MiniLM-L6-v2`
Corpus: 2 documents, 12 labeled queries
Device: Node.js CPU
Ranking: cosine similarity over normalized embeddings (equivalent to seekdb inner_product).

| Run | Recall@5 | Recall@10 | nDCG@5 | nDCG@10 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: |
| FP32 | 0.875 | 0.9583 | 0.8229 | 0.8492 | 0.8438 |
| INT8 | 0.875 | 0.9583 | 0.7812 | 0.8109 | 0.7917 |
| FP16 | not supported by runner |

INT8 minus FP32:
Recall@5 0, Recall@10 0, nDCG@5 -0.0417, nDCG@10 -0.0383, MRR -0.0521.
