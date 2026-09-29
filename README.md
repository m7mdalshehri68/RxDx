# RxDx

Clinical documentation, coding and pre-authorisation support for Saudi hospitals.
**Patient data never leaves the device.** The tool runs in the browser, with no upload and no account.

Live: <https://m7mdalshehri68.github.io/RxDx/> · <https://rxdx-5pn.pages.dev>

## What it does

**Before the patient leaves.** Inside the History Builder, as the doctor takes the history, RxDx
lists what the insurer will require that nothing written so far answers, and each item disappears
once it is written — in its own field or anywhere else in the encounter. Tapping an item opens
the field that answers it. Nothing on the list stops the doctor finalising.

**After the note is written.** The note is coded to ICD-10-AM. Every code carries the phrase
and the sentence that earned it. Diagnoses the note denies ("no myocardial infarction") are
listed as refused, not coded.

**For management.** A Payer protocols screen puts the three insurers side by side: which services need a
request, the deadlines and rules that refuse requests for non-clinical reasons, the documentation each payer
expects, where the payers disagree, a playbook per department, and — from the de-identified encounter
ledger — which questions the hospital's notes most often leave unanswered. It also lists the codes in Bupa's
document that are ICD-10-CM rather than the ICD-10-AM Saudi claims use.

**Arabic or English.** The interface opens in Arabic, right to left, with a button to switch.
Codes, code descriptions, protocols, payer questions and the note itself stay in English, so
nothing Arabic can reach a claim.

| | |
|---|---|
| ICD-10-AM codes | 16,953 |
| Presenting complaints | 98, drawn from 215 national clinical protocol documents |
| Pre-authorisation requirement sets | 222, with 702 payer questions — 151 of them from Bupa's Prerequisites document |
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

642 tests in `tests/`. Run `node tests/<name>.js`.
The API adds 135 more, the labelled corpus through `/v1/code-note`, a privacy canary and a parity
check: `cd api && npm test`.
`design/check_language.js` drives both notes with the screen in Arabic and fails if one Arabic
character reaches a note, a field value or copied codes.

## API

`api/` serves the same engine over HTTP for hospital information systems.
`POST /v1/encounter` returns what the payer still needs; `POST /v1/code` turns a note into
ICD-10-AM. `POST /v1/code-note` is the coder's endpoint: principal and additional diagnoses
sequenced by the Australian Coding Standards, verbatim evidence at exact offsets, medical
necessity, documentation gaps with physician queries, and a validation layer — every code from
the ICD-10-AM table, never generated. The service loads this `index.html` and calls the same
functions, so the tool and the API cannot give different answers. It stores no clinical text.
See `api/README.md`; for real patients, `api/DEPLOY-ON-PREMISE.md`.

## Put it online

The tool is static and deploys itself from `main` to two places:
GitHub Pages (<https://m7mdalshehri68.github.io/RxDx/>) and Cloudflare Pages
(<https://rxdx-5pn.pages.dev>). Everything is relative-path, so any static host works.

The coding service is optional. `render.yaml` runs it on Render's free plan at
<https://rxdx-coding-api.onrender.com>, the address **Note → Codes → Code through the online
service instead** fills in when the box is ticked. A free Render service sleeps after fifteen
idle minutes and the first request afterwards can wait about a minute; whenever the service
cannot be reached, the tool codes the note in the browser instead. `deploy/huggingface/` holds
the same service as a Hugging Face Space, for a host that sleeps only after 48 hours.

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
| `tests/` | 642 tests |
| `api/` | HTTP API, Docker image, OpenAPI specification |
| `gold/` | the labelled corpus and the accuracy harness |
| `preauth/` | the three payer protocols, parsed; `PA.json` is what the tool loads, `bupa_prereq_build.py` rebuilds Bupa's Prerequisites sets |
| `openmed_tools/` | ONNX export and offline analysis scripts |
| `backend/` | optional FastAPI service, not needed for the site |
| `design/` | theme, fonts, the Arabic dictionary, and `apply_design.py`, which applies them to a build |
| `deploy/` | the coding service as a Hugging Face Space, an alternative to `render.yaml` |

## Contact

Mohammed Alshehri · m7md.alshehri68@gmail.com · <https://www.linkedin.com/in/mh-sh68/>
