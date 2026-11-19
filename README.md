# RxDx

Clinical documentation, coding and pre-authorisation support for Saudi hospitals.
The tool runs in the browser, with no account. Coding with Claude reads a copy of the note after the
browser removes ID and Iqama numbers, file numbers, phone numbers, emails, dates, Arabic text and any
name written after a title or a name field; a patient's name typed into the note itself is not caught.
Switch Claude off and nothing leaves the device at all.

Live: <https://m7mdalshehri68.github.io/RxDx/> · <https://rxdx-5pn.pages.dev>
Landing page: <https://m7mdalshehri68.github.io/RxDx/landing/> · product UI prototype: <https://m7mdalshehri68.github.io/RxDx/design/rxdx-ui/app.html>

## What it does

**Before the patient leaves.** Inside the History Builder, as the doctor takes the history, RxDx
lists what the insurer will require that nothing written so far answers, and each item disappears
once it is written — in its own field or anywhere else in the encounter. Tapping an item opens
the field that answers it. Nothing on the list stops the doctor finalising.

**Two layouts of one note.** The doctor fills the builder once. Generate lays the note out as SOAP
and as SOCRATES, and the doctor copies whichever suits the patient. The SOAP layout only moves and
joins what was entered: the history becomes a paragraph, the examination is grouped by system, and
an empty field leaves no trace. Under the note, every medicine in the plan is checked against the CHI
formulary: listed or not, whether its listed indications match the diagnosis, and whether the
insurer requires a request for it.

**After the note is written.** Claude reads the note and RxDx checks every code it suggests
against the ICD-10-AM table before it is shown. Every code carries the phrase that earned it.
Diagnoses the note denies ("no myocardial infarction") are listed as refused, not coded. Without
a network, or with Claude switched off, the word-list engine codes the note in the browser.

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

## Coding with Claude

The word list knows 870 of the 16,953 codes, so a fractured radius or a colon cancer with liver
secondaries came back with nothing, and a diabetic with three complications came back with one.
Claude now reads the note; RxDx still decides what is shown:

1. Identifiers are removed in the browser before anything is sent.
2. The note goes to the RxDx AI gateway (`gateway/worker.js`, a Cloudflare Worker that holds the
   Anthropic key) and Claude Haiku 5.5 returns each condition with the words it was read from
   and an ICD-10-AM code.
3. Every code must exist in the ICD-10-AM table. An ICD-10-CM code or a bare category is moved to
   the ICD-10-AM code its title names, or sent to the coder with the closest candidates.
4. The quoted words must be in the note, and the negation layer runs on each quote.
5. The word list runs alongside; anything it finds that Claude did not address is shown.
6. If the gateway cannot be reached, the word list codes the note.

The doctor agrees once per device before the first note is sent. Cost at Claude Haiku 5.5 prices
(US$0.10 per million input tokens, US$0.50 per million output tokens) is roughly US$1 to US$3 per
1,000 notes. `node gold/measure_ai.js <gateway>` measures it on the labelled corpus and prints the
cost. Deployment: `gateway/README.md`.

## Tests

687 tests in `tests/`. Run `node tests/<name>.js`.
The API adds 80 more and a parity check: `cd api && npm test`.
The gateway adds 101: `node gateway/test.js`.
`design/check_language.js` drives both notes with the screen in Arabic and fails if one Arabic
character reaches a note, a field value or copied codes.
`design/check_soap.js` fills every field of all 98 complaints with a marker, generates, and fails
if either layout loses a marker, prints an empty label or invents a value.

## API

`api/` serves the same engine over HTTP for hospital information systems.
`POST /v1/encounter` returns what the payer still needs; `POST /v1/code` turns a note into
ICD-10-AM. The service loads this `index.html` and calls the same functions, so the tool and
the API cannot give different answers. It stores no clinical text. See `api/README.md`.

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
| `tests/` | 647 tests |
| `api/` | HTTP API, Docker image, OpenAPI specification |
| `gateway/` | the AI gateway: a Cloudflare Worker that holds the Anthropic key and asks Claude to read a de-identified note |
| `gold/` | the labelled corpus, the accuracy harness, and `measure_ai.js` for coding with Claude |
| `preauth/` | the three payer protocols, parsed; `PA.json` is what the tool loads, `bupa_prereq_build.py` rebuilds Bupa's Prerequisites sets |
| `openmed_tools/` | ONNX export and offline analysis scripts |
| `backend/` | optional FastAPI service, not needed for the site |
| `design/` | theme, fonts, the Arabic dictionary, and `apply_design.py`, which applies them to a build |
| `design/rxdx-ui/` | the redesigned product UI: a clickable prototype (`app.html`) and the design system (`system.html`) |
| `landing/` | the landing page, Arabic and English, with the animated demo |
| `deploy/` | the coding service as a Hugging Face Space, an alternative to `render.yaml` |

## Contact

Mohammed Alshehri · m7md.alshehri68@gmail.com · <https://www.linkedin.com/in/mh-sh68/>
