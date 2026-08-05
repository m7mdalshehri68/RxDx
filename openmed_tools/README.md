# OpenMed in RxDx — what this folder does

Two things the hospital asked for, both running entirely on your own hardware.
No clinical text is sent anywhere. No account, no API key, no internet at run time.

---

## 1 · The model inside the doctor's browser

`export_onnx.py` converts an OpenMed checkpoint into the file layout a browser
can run through Transformers.js, then RxDx loads it from **your** web server.

```bash
python3 export_onnx.py  /path/to/OpenMed-NER-DiseaseDetect-BioMed  dist/openmed-disease
# add --quantize on a machine with ~6 GB RAM to also emit model_quantized.onnx
```

Copy `dist/openmed-disease` onto the hospital web server, then in RxDx:

> Control Centre → Integration → **Clinical language model**
> Model folder URL: `/models/openmed-disease` · Serving: **Our server** · Use the model: **On**

Doctors then get a tick box on the Note → Codes screen. With it off, RxDx behaves
exactly as before; with it on, the model reads the note and finds conditions the
word list cannot, and a line under the result says how many it added.

**Notes for whoever runs this**

- The exporter needs `numpy`, `onnx` and `safetensors` only — **no PyTorch**. It builds
  the graph from `model.safetensors` directly, and streams the weights to external data
  so it runs on a small machine.
- Verified against a reference implementation: identical label on every token,
  maximum probability difference `4.5e-05` (bfloat16 rounding), and ~21x faster.
- One aggressive onnxruntime fusion mis-rewrites this graph. Both the exporter's
  runner and the RxDx browser loader pin the optimisation level to **basic**. Do not
  raise it without re-checking the output.
- BioMed is BERT-large: ~1.3 GB as fp32 ONNX, roughly 340 MB quantised. That is a
  one-time download the browser caches. For a lighter footprint, export one of
  OpenMed's smaller checkpoints — the same script handles any BERT token classifier.
- The SuperClinical checkpoint is DeBERTa-v2. This exporter is BERT-only and will
  say so rather than emit a wrong graph; serve that one from the backend instead.

---

## 2 · Measuring the gap in notes you already have

`gap_analyzer.py` reads a de-identified export of past encounters, extracts the
conditions the clinician actually wrote, compares them with the codes that were
submitted, and reports the difference. **It does not need RxDx to be deployed** —
it measures the baseline you will be judged against.

```bash
python3 gap_analyzer.py notes.csv \
    --model /path/to/OpenMed-NER-DiseaseDetect-BioMed \
    --onnx  dist/openmed-disease/onnx/model.onnx \
    --rxdx  ../RxDx.html \
    --out   gap_out
```

Input columns (only `note` is required): `id, date, clinic, module, note, codes`.

Outputs:

| File | What it is |
|---|---|
| `gap_report.txt` | the written summary, ready to read aloud |
| `gap_findings.csv` | one row per encounter, for a coder to spot-check |
| `gap_summary.json` | the same numbers, machine-readable |

**Honesty about the matching.** Turning a phrase into an ICD-10-AM code is the hard
part, not the extraction. Lexical matching alone maps a bare "hypertension" to
maternal hypertension, so `preferred_codes.csv` sits in front of it — a plain,
editable table your coding team owns. It ships with 55 of the commonest terms.
Add to it; every line you add makes the report more defensible.

Before any figure reaches a board, have a coder review a random sample of
`gap_findings.csv`. The report says this too.

---

## Files

| File | Purpose |
|---|---|
| `openmed_ner.py` | disease NER with numpy only, plus a fast ONNX-backed variant |
| `export_onnx.py` | torch-free ONNX + Transformers.js export |
| `gap_analyzer.py` | the historical-notes gap report |
| `preferred_codes.csv` | phrase → preferred ICD-10-AM code, owned by coding |

Requires `numpy`, `safetensors`, `tokenizers`, `onnx`, `onnxruntime`.
OpenMed models are Apache-2.0.
