# RxDx

Clinical documentation, coding and pre-authorisation support for Saudi hospitals.
**Patient data never leaves the device.** The tool runs in the browser, with no upload and no account.

Live: <https://m7mdalshehri68.github.io/RxDx/>

## What it does

**Before the patient leaves.** The doctor picks the presenting complaint and writes the note.
RxDx lists what the insurer will require that the note does not say yet, and each item
disappears once it is written.

**After the note is written.** The note is coded to ICD-10-AM. Every code carries the phrase
and the sentence that earned it. Diagnoses the note denies ("no myocardial infarction") are
listed as refused, not coded.

| | |
|---|---|
| ICD-10-AM codes | 16,953 |
| Presenting complaints | 98, drawn from 215 national clinical protocol documents |
| Pre-authorisation requirement sets | 71, with 189 payer questions |
| Payer protocols | Bupa Arabia, Tawuniya, Al Rajhi Takaful |
| Formulary drugs | 1,548 |
| Clinical calculators | 24 |

## Measured accuracy

60 hand-labelled clinical notes in `gold/corpus.json`. Run `node gold/measure.js`.

| | ICD category | Full code |
|---|---|---|
| Precision | 100.0% | 97.3% |
| Recall | 98.7% | 94.8% |
| F1 | 99.3% | 96.1% |

| | |
|---|---|
| Denied or excluded findings kept out | 123 of 123 |
| Drug names found | 44 of 47 |

`tests/accuracy.js` fails if a change pushes these below their floors. The labels were
written by the author of the vocabulary, so this is internal evidence. An independent audit
by a certified coder is the next step.

## Tests

534 tests in `tests/`. Run `node tests/<name>.js`.
The API adds 66 more and a parity check: `cd api && npm test`.

## API

`api/` serves the same engine over HTTP for hospital information systems.
`POST /v1/encounter` returns what the payer still needs; `POST /v1/code` turns a note into
ICD-10-AM. The service loads this `index.html` and calls the same functions, so the tool and
the API cannot give different answers. It stores no clinical text. See `api/README.md`.

## Put it online

Settings → Pages → Deploy from a branch → `main`, root folder.
Everything is relative-path, so a project site (`/rxdx/`) and a user site both work.

## The local clinical model

Optional and off by default. The checkbox "Use the local clinical model" loads an OpenMed
disease NER model into the browser tab. Every span it returns passes through the same negation
layer as the word list before it can be coded, because on its own it coded two thirds of the
findings written as "no ...".

It was last measured on the earlier 30-note corpus, where it added 0.6 F1 for a ~335 MB
download. It has not been measured against the current engine and the 60-note corpus.

GitHub caps a single file at 100 MB, so the model lives on Hugging Face or on the hospital's
own web server:

```bash
pip install numpy onnx onnxruntime
python3 openmed_tools/build_model.py <your-model-folder> ./hf-upload
```

Upload `hf-upload/` as a new Hugging Face model, then in RxDx open
**Control Centre → clinical model**, set Serving to **Public hub**, paste
`<your-user>/<your-model>` and press **Test it**. To keep it inside the hospital, serve
`hf-upload/` from the hospital's own web server and set Serving to **Our server**.

## What is in here

| | |
|---|---|
| `index.html` | the tool |
| `data/` | the ICD-10-AM and formulary tables, loaded by `index.html` |
| `tests/` | 534 tests |
| `api/` | HTTP API, Docker image, OpenAPI specification |
| `gold/` | the labelled corpus and the accuracy harness |
| `preauth/` | the three payer protocols, parsed |
| `openmed_tools/` | ONNX export and offline analysis scripts |
| `backend/` | optional FastAPI service, not needed for the site |

## Contact

Mohammed Alshehri · m7md.alshehri68@gmail.com · <https://www.linkedin.com/in/mh-sh68/>
