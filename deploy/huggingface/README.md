---
title: RxDx Coding API
emoji: 🩺
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: Clinical note to ICD-10-AM, the engine behind RxDx
---

# RxDx Coding API

Clinical free text in, ICD-10-AM out — the same engine as the RxDx tool.

```
POST /v1/code        {"text": "Known type 2 diabetes, presents with chest pain."}
POST /v1/encounter   {"complaint": "chest pain", "payer": "taw", "note": "..."}
GET  /v1/health
```

The service keeps no clinical text: each note is held in memory for one request
and never written to disk or logged. This is a public demonstration instance —
use invented text here. For real patients, run the same image inside the hospital.

Source: https://github.com/m7mdalshehri68/RxDx · Mohammed Alshehri ·
m7md.alshehri68@gmail.com · https://www.linkedin.com/in/mh-sh68/
