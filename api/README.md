# RxDx API

Two halves.

**Before the patient leaves** — given the presenting complaint, what the payer is going
to want that is not in the note yet:

```
POST /v1/encounter   {"complaint": "chest pain", "payer": "taw", "note": "..."}
```

```json
{
  "presentation": "Chest pain",
  "stillMissing": [
    { "source": "payer", "requirement": "Acute chest pain",
      "ask": "What is the HEART score? A risk stratification tool must be included." },
    { "source": "red flag", "requirement": "Chest pain",
      "ask": "Unequal blood pressure in both arms" }
  ],
  "otherConditionsOnFile": [{ "title": "Diabetes — general" }]
}
```

Write the HEART score into the note, ask again, and that line disappears. That is the
product in one interaction.

The 98 complaints come from 215 national clinical protocol documents; the requirements
come from the published pre-authorisation protocols of Bupa Arabia, Tawuniya and Al Rajhi
Takaful. Each payer question carries the pattern that verifies it, so `satisfied` is a real
check rather than a guess. Nothing is generated.

**Rules triggered by the complaint are this visit. Rules triggered only by a condition
mentioned in the background come back separately.** A chest pain note that says "known type
2 diabetes" was demanding Mounjaro and retinal-injection paperwork — twenty-four items for
a chest pain visit. A doctor shown that list closes the window, so the split is not cosmetic.

---

**After it is written** — clinical free text in, ICD-10-AM out, with the phrase that earned
each code, the sentence it came from, a confidence figure with its reasons, and the diagnoses
the note mentions that the engine **deliberately refused** to code.

```
POST /v1/code   {"text": "Community acquired pneumonia. No myocardial infarction."}
```

```json
{
  "principal": [
    { "code": "J18.9", "description": "Pneumonia, unspecified", "confidence": 0.58,
      "confidenceReasons": [{ "direction": "up", "reason": "matched a long, specific phrase" },
                            { "direction": "down", "reason": "4 more specific codes exist in this family" }],
      "evidence": { "term": "community acquired pneumonia", "offset": 0,
                    "sentence": "Community acquired pneumonia." },
      "moreSpecificAvailable": 4 }
  ],
  "supporting": [],
  "mentionedButNotCoded": [
    { "code": "I21.9", "description": "Acute myocardial infarction, unspecified",
      "term": "myocardial infarction", "reason": "the note denies or excludes this",
      "evidence": "No myocardial infarction." }
  ],
  "contentVersion": "icd:as supplied by the hospital | vocab:v2 — 2026-08-04"
}
```

---

**For the coder** — a physician's note in, a sequenced and validated set of ICD-10-AM codes out:

```
POST /v1/code-note
{
  "clinical_note": "55 y male with central chest pain … Impression: inferior STEMI. Aspirin and clopidogrel given, referred for primary PCI.",
  "encounter_type": "emergency",
  "patient": { "age_years": 55, "sex": "male" },
  "payer": "bupa",
  "options": { "use_llm": false, "max_candidates": 5, "include_not_coded": true, "nphies": false }
}
```

```json
{
  "request_id": "6f5dc6bc-1e3c-48dc-a041-8cc9cf4016e9",
  "encounter_summary": "Emergency encounter, 55-year-old male: principal diagnosis Acute transmural myocardial infarction of inferior wall (I21.1), 1 additional diagnosis, 5 linked services, 0 documentation gaps.",
  "primary_diagnosis": {
    "icd_code": "I21.1", "description": "Acute transmural myocardial infarction of inferior wall",
    "coding_system": "ICD-10-AM", "status": "confirmed",
    "evidence": [{ "quote": "inferior STEMI", "start": 105, "end": 119, "section": "assessment" }],
    "reason": "ACS 0001 (non-admitted encounter): the assessment names … so it is taken as chiefly responsible for this encounter. It outranks I10 (a pre-existing condition documented in the history).",
    "source": "engine", "confidence": 0.97
  },
  "secondary_diagnoses": [{ "icd_code": "I10", "…": "…", "affects": ["risk"], "supports": [] }],
  "not_coded": [{ "mention": "chest pain", "reason": "integral_symptom", "icd_codes": ["R07.4"], "evidence": [ … ] }],
  "medical_necessity": [{ "service": "Coronary angiography or PCI", "kind": "procedure", "supported_by": ["I21.1"], "status": "supported" }],
  "payer_requirements": [{ "requirement": "PCI", "ask": "Angiography report?", "satisfied": false }],
  "documentation_gaps": [],
  "clarification_required": false, "clarifications": [],
  "coding_validation": { "valid": true, "errors": [], "warnings": [] },
  "nphies": null,
  "audit": { "content_version": "icd:… | vocab:v2 — 2026-08-04 | table:16953/86f2f3be4072 | services:2026-09-28 | config:none",
             "engine_version": "rxdx-engine/… pipeline/1.1.0", "llm": null, "received_chars": 177, "ms": 12.4 }
}
```

What it guarantees, and how each guarantee is enforced:

| | |
|---|---|
| **Closed code set** | Every code is looked up in the ICD-10-AM table at request time; descriptions are the table's. A code outside the table, or switched off in the hospital's configuration, is a `CODE_NOT_IN_TABLE` error. ICD-10-CM codes written into a note are never returned (tested). |
| **One engine** | The RxDx engine is the first and authoritative pass. On the 60 labelled notes `/v1/code-note` returns exactly the engine's codes; parity with the browser stays 60 / 60. |
| **Documented facts only** | Every code carries verbatim quotes, checked character by character at their offsets. Negated, ruled-out, family, hypothetical and uncertain mentions go to `not_coded` with the reason; the validator re-reads every quote with the engine's own negation rules (`NEGATED_OR_FAMILY_CODED`). A "Family history:" section and "history of …" are read as such. |
| **Specificity only when documented** | An unspecified code stands when the note says nothing more, and the missing element is a `documentation_gap` with a non-leading physician query (table descriptions in code order, then "Other" and "Cannot be determined"). A more specific member whose distinguishing words *are* written is a `UNSPECIFIED_WHEN_SPECIFIC_DOCUMENTED` warning; a code asserting what the note does not say (bare "diabetes" as type 2, "peptic ulcer" as acute) is `SPECIFICITY_NOT_SUPPORTED`. The deterministic path never swaps a code on its own. |
| **No guessing** | Two conditions named as equals in the assessment ("pneumonia and urinary tract infection") return `clarification_required: true` with the question; a note too thin to code asks for the reason for the encounter. |
| **Sequencing** | ACS 0001 for the principal (definitive over symptom, assessment over history, never UnacceptPDx, asterisk or external cause; sepsis before its localised infection, ACS 0110); ACS 0002 for additional diagnoses, each with what it `affects` and the services it `supports`. |
| **Clinical edits** | Sex (with the table's exception values as warnings), age bands (AGE and the formulary's), UnacceptPDx as principal, duplicate conditions, asterisk without dagger, morphology required, external cause expected for admitted injuries. |
| **Medical necessity** | Medicines through the hospital formulary's own indications; investigations, procedures and referrals through `codenote/services.json`, a table the hospital owns. A service no coded diagnosis explains is flagged. With a payer, that payer's unanswered requirements come from the tool's rule matcher, minus the sets the hospital switched off. |
| **Confidence** | Computed from signals anyone can check, weighted by a fit on the labelled corpus (`gold/calibrate.js`, `codenote/calibration.json`). Never a model's opinion of itself. |

Every stage — normalize, extract, candidates, adjudicate, sequence, necessity, validate, assemble — is a
function in `codenote/index.js` and can be replaced alone. The response schema is published in
`openapi.json` (`CodeNoteResponse`) and every response in the test suite is validated against it.

### Feedback and the audit trail

```
POST /v1/feedback   {"request_id": "…", "code": "E11.9", "decision": "reject", "reason": "more_specific_available", "replacement_code": "E11.40"}
GET  /v1/feedback   per-code acceptance, and each rejection in the Coder Review queue's buckets
GET  /v1/audit/{request_id}
```

Feedback is codes only: `reason` comes from a fixed list and there is no free-text field, so there is nothing a
coder could paste a note into. The audit record of a request holds its id, the codes it returned, its validation
codes, the content and engine versions and its timings. Set `RXDX_AUDIT_FILE` and `RXDX_FEEDBACK_FILE` to keep
them on disk (one JSON line each).

### The optional adjudicator

Off unless the service is configured **and** the request sends `"use_llm": true`. It may only choose the
principal among the engine's codes, replace an engine code with a candidate from the table when its quote states
the distinguishing detail, or add a code for a mention the engine missed from that mention's candidates. Its
answer is a proposal: the validator runs on the merged result, and if it fails — or the model is late, refuses or
answers off-schema — the engine's result is returned with a warning. Its instructions are in `llm/prompt.js`,
verbatim, and versioned in the audit record.

Only de-identified text leaves the server, and only to:

- **a model inside the hospital network** — `RXDX_LLM_PROVIDER=hospital`, `RXDX_LLM_URL=http://<private address>/…`
  (a public address is refused unless `RXDX_LLM_DPA=1`); the endpoint contract is in `llm/hospital.js`; or
- **Claude through the Anthropic API**, only where a data processing agreement covers it —
  `RXDX_LLM_PROVIDER=anthropic`, `RXDX_LLM_DPA=1`, `ANTHROPIC_API_KEY`, and `npm install @anthropic-ai/sdk` in `api/`
  (the core stays dependency-free; the SDK is loaded only by this adapter). Default model `claude-opus-5-5`, with the
  API's server-side refusal fallback on (`RXDX_LLM_FALLBACKS=off` to disable).

`use_llm` is not available in batch.

---

## Why there is only one engine

`engine.js` does not reimplement the coding logic. It reads `../index.html` — the
same file the doctor's browser loads — and calls the same functions. An API that
reimplements the engine drifts away from the tool within a month, and then two
answers exist for the same note and nobody can say which one is right.

`test/parity.js` runs the whole labelled corpus through both loaders and fails the
build the moment they disagree. It currently reports **60 / 60 identical**.

The coding engine never loads the drug formulary — coding needs the ICD table and
the vocabulary, not 1,548 medicines. `/v1/code-note` reads it separately, reduced
to each drug's indicated codes, to link planned medicines to diagnoses; with it the
service starts in under a second and holds about 250 MB (`RXDX_FORMULARY=0` to skip).

---

## What it stores

**Nothing.** Clinical text lives in memory for the life of one request. It is never
written to disk, never logged, never forwarded. The access log line is:

```json
{"t":"2026-08-27T00:14:02.881Z","id":"9f2c…","route":"/v1/code","status":200,
 "who":"a41c9e77b0d2","chars":214,"principal":3,"supporting":0,"refused":2,"ms":4}
```

`who` is a salted hash of the caller address, generated fresh at every boot, so the
log cannot be turned back into a list of who used the service from where.

For `/v1/code-note` the line is the request id, the character count, the codes and the timings:

```json
{"t":"2026-09-28T21:47:17.234Z","id":"6f5dc6bc-…","route":"/v1/code-note","status":200,
 "chars":177,"codes":["I21.1","I10"],"valid":true,"errors":[],"llm":null,"ms":14}
```

Every log line passes through an allowlist of keys; errors are logged by their name, never their
message; an uncaught exception prints no stack. `test/privacy.js` sends a random canary through
every route and error path and fails if it appears in the log, the audit or feedback file, any
file written during the run, or any error response.

Three tests hold this in place — one of them sends a rare phrase through the service
and fails if that phrase appears anywhere in the log.

**This does not make a public deployment safe for real patients.** The note still
crosses the internet to reach the server. For real patients, run this same image
inside the hospital network.

---

## Endpoints

| | | |
|---|---|---|
| `POST` | `/v1/code-note` | a note to sequenced, evidenced, validated ICD-10-AM, with medical necessity |
| `POST` | `/v1/code-note/batch` | up to 200 notes |
| `POST` | `/v1/feedback` | a coder accepts or rejects a code (codes only); `GET` exports it |
| `GET` | `/v1/audit/{request_id}` | the codes, versions and timings of one request |
| `POST` | `/v1/encounter` | what the payer will want that is not written yet |
| `GET` | `/v1/presentations` | the 98 complaints, and the spellings each answers to |
| `POST` | `/v1/code` | one note |
| `POST` | `/v1/code/batch` | up to 200 notes — a coder queue, or a monthly gap report |
| `GET` | `/v1/health` | liveness, and which content is loaded |
| `GET` | `/v1/version` | where every reference table came from and when it was reviewed |
| `GET` | `/openapi.json` | the full specification |
| `GET` | `/docs` | interactive page — pick a complaint, paste a note, watch the list shrink |

---

## Run it

**Locally**

```bash
cd rxdx-site/api
node server.js            # http://localhost:8080/docs
npm test                  # 135 HTTP tests, the gold corpus through /v1/code-note, the privacy canary, parity
```

**Docker** (build from the repository root, not from `api/`)

```bash
cd rxdx-site
docker build -f api/Dockerfile -t rxdx-api .
docker run -p 8080:8080 rxdx-api
```

**Render** — New → Blueprint → point at this repository. `render.yaml` at the root
does the rest.

**Inside the hospital** — the same image, plus:

```bash
docker run -d --restart=always -p 8080:8080 \
  -e RXDX_API_KEY='<a key your IT team generates>' \
  -e RXDX_ALLOW_ORIGINS='https://rxdx.yourhospital.local' \
  -e RXDX_PUBLIC_DEMO=0 \
  rxdx-api
```

With `RXDX_PUBLIC_DEMO=0` the service refuses to start without `RXDX_API_KEY`. The full checklist for real
patients — network, configuration, audit files, the adjudicator, updates — is in
[`DEPLOY-ON-PREMISE.md`](DEPLOY-ON-PREMISE.md). **The public Render instance is for invented text only.**

---

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | |
| `RXDX_API_KEY` | *(unset)* | When set, every coding call needs `X-API-Key`. |
| `RXDX_ALLOW_ORIGINS` | `*` | Comma-separated origins allowed to call from a browser. |
| `RXDX_RATE_LIMIT` | `120` | Requests per caller per window. |
| `RXDX_RATE_WINDOW` | `60` | Window, in seconds. |
| `RXDX_MAX_BODY` | `262144` | Largest note accepted, in bytes. |
| `RXDX_MAX_BATCH` | `200` | Most notes in one batch call. |
| `RXDX_PUBLIC_DEMO` | `1` | `1` makes `/docs` warn against real patient text. |
| `RXDX_HTML` | `../index.html` | Which build the engine loads. |
| `RXDX_CONFIG` | *(unset)* | The Control Centre export (Audit & versions → export). Its switched-off codes, hospital default codes and switched-off payer requirement sets apply to every endpoint, exactly as in the tool. A file that is set but unreadable stops the service. |
| `RXDX_UNCERTAIN_POLICY` | `code_as_established` | Admitted episodes only: `code_as_established` (ACS 0010) or `code_symptoms`. Non-admitted encounters always code the symptoms. |
| `RXDX_AUDIT_FILE` | *(unset)* | Append each request's audit record (codes, versions, timings — never text) to this file. |
| `RXDX_FEEDBACK_FILE` | *(unset)* | Append coder feedback (codes only) to this file. |
| `RXDX_SERVICES` | `codenote/services.json` | The service catalogue used for medical necessity. |
| `RXDX_NPHIES_CONFIG` | `nphies.config.json` | Claim.diagnosis system, code format, type codes and sequence start. |
| `RXDX_FORMULARY` | `1` | `0` skips the formulary index (~80 MB less memory; medicines are then not linked to diagnoses). |
| `RXDX_LLM_PROVIDER` | *(unset)* | `hospital` or `anthropic`; see *The optional adjudicator*. With `RXDX_LLM_URL`, `RXDX_LLM_AUTH`, `RXDX_LLM_MODEL`, `RXDX_LLM_TIMEOUT_MS` (default 6000), `RXDX_LLM_EFFORT`, `RXDX_LLM_FALLBACKS`, `RXDX_LLM_DPA`. |

---

## Accuracy

Measured on a 60-note hand-labelled corpus (`../gold/corpus.json`):

| | ICD category | full code |
|---|---|---|
| precision | **100.0 %** | 97.3 % |
| recall | **98.7 %** | 94.8 % |
| F1 | **99.3 %** | 96.1 % |

Negation traps held: **123 / 123**.

Rerun it yourself: `node ../gold/measure.js`. The labels were written by the author of the
vocabulary, so this is internal evidence, not independent validation.

Through `POST /v1/code-note` over HTTP (`node test/codenote-gold.js`, deterministic path):
the same figures, 123 / 123 negation traps, 419 / 419 returned codes in the table, 212 / 212 quotes
verified at their offsets, every response valid against the published schema, p95 ~35 ms for a
2,000-character note. Principal diagnosis agrees with the corpus's principal labels on 56 / 60 notes
by exact code and 59 / 60 by condition — but those labels are **unreviewed** until a certified coder
confirms them, so the figure is reported, not claimed.

---

## What this service does not do

It does not check drug interactions, renal or hepatic dose adjustment, pregnancy or
breastfeeding. It links planned services to the diagnoses that justify them, but it
does not approve or refuse a claim. It reads text and proposes codes with the
evidence for each one. A person signs the note, and a coder signs the codes.

---

Mohammed Alshehri · m7md.alshehri68@gmail.com · <https://www.linkedin.com/in/mh-sh68/>
