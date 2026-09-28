# Running the RxDx coding service for real patients

The public instance on Render (`rxdx-coding-api.onrender.com`) and the Hugging Face Space are
demonstrations. **Send them invented text only.** A note sent there crosses the public internet
and is processed on infrastructure the hospital does not control, whatever this service promises
about storage.

For real patients, run the same image inside the hospital network. This page is the checklist.

---

## 1. Where it runs

- A Linux host or a Kubernetes namespace **inside the hospital network**, reachable only from the
  systems that call it (the HIS, the coder workstation, the RxDx page served by the hospital).
- No inbound access from the internet. No outbound access is needed at all, unless the optional
  adjudicator is configured (section 5).
- Resources: 1 vCPU and 512 MB of memory per instance is enough (it holds about 250 MB); it starts in
  about one second and answers a 2,000-character note in tens of milliseconds.
- Put it behind the hospital's TLS-terminating reverse proxy; the service itself speaks plain HTTP.

## 2. Build and run

Build from the repository root (the image carries the same `index.html` the tool serves):

```bash
docker build -f api/Dockerfile -t rxdx-api:$(git rev-parse --short HEAD) .
docker run -d --restart=always --name rxdx-api -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -e RXDX_PUBLIC_DEMO=0 \
  -e RXDX_API_KEY='<a long random key from your secrets store>' \
  -e RXDX_ALLOW_ORIGINS='https://rxdx.hospital.local' \
  -e RXDX_CONFIG=/config/rxdx-config.json \
  -e RXDX_AUDIT_FILE=/audit/code-note-audit.jsonl \
  -e RXDX_FEEDBACK_FILE=/audit/code-note-feedback.jsonl \
  -v /srv/rxdx/config:/config:ro \
  -v /srv/rxdx/audit:/audit \
  rxdx-api:<tag>
```

- `RXDX_PUBLIC_DEMO=0` makes the key mandatory: without `RXDX_API_KEY` the service refuses to start.
  Callers send it in the `X-API-Key` header. Rotate it like any other service credential.
- `RXDX_ALLOW_ORIGINS` lists only the hospital's own RxDx page. Server-to-server callers need no entry.
- Keep `RXDX_RATE_LIMIT` (default 120 per minute per caller) unless a batch job needs more.
- The container runs as the unprivileged `node` user and writes nothing except the two audit files.

## 3. The hospital's configuration

In RxDx, IT sets up **Control Centre → Clinical content**: the ICD-10-AM codes the hospital switches
off, its default codes for unqualified phrases (what a bare "diabetes" means here —
`openmed_tools/preferred_codes.csv` is a starting set for the coding team to review), and the payer
requirement sets it does not contract for. **Audit & versions → Export** writes the configuration file;
mount it and point `RXDX_CONFIG` at it. The tool and the service then answer the same way, and every
response names the configuration revision in `audit.content_version`. A named file that cannot be read
stops the service rather than running with a configuration nobody approved.

For admitted episodes, `RXDX_UNCERTAIN_POLICY` decides whether "probable" or "suspected" diagnoses are
coded as if established (`code_as_established`, ACS 0010, the default) or only their symptoms
(`code_symptoms`). Agree the choice with the coding manager and record it.

The service catalogue used for medical necessity (`api/codenote/services.json`) and the NPHIES claim
settings (`api/nphies.config.json`) are plain files the hospital owns. **Check `nphies.config.json`
against the NPHIES implementation guide your hospital is certified on before any claim is built from
it.**

## 4. What is stored, and where

| | stored | where |
|---|---|---|
| The note | never | memory, for one request |
| Access log | request id, character count, codes, timings | stdout → your log collector |
| Audit record | request id, codes, validation codes, content and engine versions, timings | `RXDX_AUDIT_FILE` |
| Coder feedback | request id, code, accept/reject, reason from a fixed list | `RXDX_FEEDBACK_FILE` |

None of these hold clinical text, a quote from a note, a name or an identifier. The audit files are
still part of the medical-records environment: back them up and apply the retention the hospital's
records policy sets. `GET /v1/feedback` exports feedback for the Coder Review queue and for the
vocabulary team.

Requests that carry an identifier — a name, a national ID or Iqama number, an MRN, a phone number, an
email address or a date of birth, as a field or inside the note — are refused with 422 before anything
is coded. Integrations must send the de-identified note, the age and the sex, and keep the link to the
patient on their side (the `request_id` in each response is the join key).

## 5. The optional adjudicator

Off by default. When a hospital wants it:

- **Preferred: a model inside the hospital network.** `RXDX_LLM_PROVIDER=hospital`,
  `RXDX_LLM_URL=http://<private address>/…`, `RXDX_LLM_AUTH` if the endpoint needs it. The contract the
  endpoint must meet is in `api/llm/hospital.js`. A public address is refused.
- **A hosted model only under a data processing agreement and on a compliant host.**
  `RXDX_LLM_PROVIDER=anthropic` with `RXDX_LLM_DPA=1` (which asserts that agreement exists) and
  `ANTHROPIC_API_KEY`; install the SDK in the image (`npm install @anthropic-ai/sdk` in `api/`). The
  hospital's data-protection officer decides whether this is allowed; the service cannot.

Either way only de-identified text leaves the server, `RXDX_LLM_TIMEOUT_MS` (default 6 s) is a hard
limit, and the validator decides: an answer that is late, refused, malformed or invalid leaves the
engine's result in place with a warning. Callers opt in per request with `"use_llm": true`.

## 6. Before go-live

1. `cd api && npm test` on the built image's content — all suites, including the privacy canary and the
   gold corpus through `/v1/code-note`.
2. A certified coder reviews the principal labels in `gold/corpus.json` (set `principal_status` to
   `reviewed`) and a random sample of the hospital's own notes coded by the service; record agreement.
   Until then, every figure in this repository is internal evidence.
3. Confirm the log collector, the audit files and the backups hold no clinical text (grep a test note's
   canary through them, as `test/privacy.js` does).
4. Decide who owns `services.json`, the hospital defaults and the switched-off codes, and how changes
   are approved; every change shows up in `audit.content_version`.

## 7. Updating

Each release is a new image built from a tagged commit. Deploy it beside the old one, run
`npm test` and a sample of real (de-identified) notes through both, compare the codes, then switch.
The `engine_version` in every response names the exact `index.html` that answered, so a disputed code
can always be traced to the build that produced it.
