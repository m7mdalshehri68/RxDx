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

## Why there is only one engine

`engine.js` does not reimplement the coding logic. It reads `../index.html` — the
same file the doctor's browser loads — and calls the same functions. An API that
reimplements the engine drifts away from the tool within a month, and then two
answers exist for the same note and nobody can say which one is right.

`test/parity.js` runs the whole labelled corpus through both loaders and fails the
build the moment they disagree. It currently reports **60 / 60 identical**.

The drug formulary is not loaded — coding needs the ICD table and the vocabulary,
not 1,548 medicines — so the service starts in about 150 ms and holds ~130 MB.

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

Three tests hold this in place — one of them sends a rare phrase through the service
and fails if that phrase appears anywhere in the log.

**This does not make a public deployment safe for real patients.** The note still
crosses the internet to reach the server. For real patients, run this same image
inside the hospital network.

---

## Endpoints

| | | |
|---|---|---|
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
npm test                  # 66 HTTP tests + the parity check
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

---

## What this service does not do

It does not check drug interactions, renal or hepatic dose adjustment, pregnancy or
breastfeeding. It does not decide medical necessity, and it does not approve or
refuse a claim. It reads text and proposes codes with the evidence for each one.
A person signs the note.

---

Mohammed Alshehri · m7md.alshehri68@gmail.com · <https://www.linkedin.com/in/mh-sh68/>
