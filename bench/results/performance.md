# Performance

Browser: Microsoft Edge (Playwright)
Corpus: example/Apple_推出全新智能框架与先进工具助力_App_开发.txt

| Stage | Default (WebGPU) | Forced WASM |
| --- | ---: | ---: |
| Model load (first query) | 2008.2 ms | 1500.1 ms |
| Query encode (first) | 3158.3 ms | 1592.3 ms |
| Query encode (warm median) | 156.2 ms | 8.5 ms |
| seekdb search API (warm median) | 21.1 ms | 22.1 ms |
| End-to-end query (first) | 3576.3 ms | 1959.4 ms |
| End-to-end query (warm median) | 196.4 ms | 56.8 ms |

Document import (first backend):

| Read | Model load | Encode | Write | Index flush | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.5 | 2313.9 | 8224.6 | 589 | 307.9 | 9333.6 |

All values in milliseconds. Query warm median uses three queries: Xcode, Swift, Vision Pro.
