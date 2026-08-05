# RxDx

Clinical documentation, coding and pre-authorisation support. One HTML file.
**Patient data never leaves the device** — there is no server, no upload, no account.

## Put it online

1. Create a repository and push everything in this folder to `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push. The workflow runs the clinical test suite first and **refuses to deploy if any test fails**.

Your site: `https://<user>.github.io/<repo>/`

Everything is relative-path, so a project site (`/rxdx/`) and a user site both work
without edits. `.nojekyll` stops Jekyll from touching the files.

## Measured accuracy

Thirty hand-labelled clinical notes, in `gold/corpus.json`. Run `node tests/accuracy.js`.

| | |
|---|---|
| Principal diagnosis — precision | 61.4% |
| Principal diagnosis — recall | 77.1% |
| **F1** | **68.4%** |
| A denied finding is never coded | 100% (62 traps) |
| Drug names found | 100% |

These are a floor, not a boast: the suite fails if a change pushes them down.
Thirty notes is a direction, not a certification — a larger corpus of real
de-identified notes is the next step, and the labels need a coder's review
(`RxDx_Accuracy_Review.xlsx`).

## The local clinical model — read this before enabling it

The checkbox "Use the local clinical model" loads an OpenMed DISEASE NER model
into the browser tab. It was measured on the same 30 notes:

| configuration | F1 | denied findings kept out |
|---|---|---|
| Word list only (default, ships enabled) | **68.4%** | 100% |
| Model only | 52.2% | **34.4%** |
| Model, passed through the negation layer | 66.7% | 100% |
| **Word list + model together (what the checkbox does)** | **69.0%** | 100% |

The model tags every disease *mention*, including the ones the doctor denied.
On its own it coded two thirds of the findings written as "no ...". It is
therefore never run on its own: every span it returns is passed through the same
negation layer as the word list, and merged with it.

**The gain is +0.6 F1 for a ~335 MB download.** Recall rises meaningfully
(77.1% → 85.7%, three fewer missed codes across 30 notes), precision falls
(61.4% → 57.7%). Decide with those numbers in front of you.

### Hosting the model

GitHub caps a single file at 100 MB and a Pages site at 1 GB. The model is about
335 MB, so it cannot live in this repository — that is the only thing GitHub
cannot host, and the app itself is fine at 17 MB.

Put the model on Hugging Face, which is free, CDN-backed, and what
Transformers.js loads from natively.

```bash
pip install numpy onnx onnxruntime
python3 openmed_tools/build_model.py <your-model-folder> ./hf-upload
```

That one command exports the ONNX, quantises it to int8, throws away the 1.3 GB
fp32 copy the browser does not need, and writes a model card. It needs about
8 GB of RAM and no PyTorch.

Then: huggingface.co → **New model** → upload everything in `hf-upload/` →
in RxDx open **Control Centre → clinical model**, set Serving to **Public hub**,
paste `<your-user>/<your-model>`, and press **Test it**. That button fetches the
three files a browser needs and tells you whether they are actually reachable —
it does not assume.

To keep the model inside the hospital instead, serve `hf-upload/` from the
hospital's own web server, set Serving to **Our server**, and give it the folder
URL. Nothing then leaves the network.

## What is in here

| | |
|---|---|
| `index.html` | the whole tool |
| `tests/` | 263 tests — run `node tests/<name>.js` |
| `gold/` | the labelled corpus and the accuracy harness |
| `preauth/` | the three payer protocols, parsed |
| `openmed_tools/` | ONNX export and offline analysis scripts |
| `backend/` | optional FastAPI service — not needed for the site |

## Contact

Mohammed Alshehri · m7md.alshehri68@gmail.com · https://www.linkedin.com/in/mh-sh68/
