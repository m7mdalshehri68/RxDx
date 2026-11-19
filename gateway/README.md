# RxDx AI gateway

A Cloudflare Worker that holds the Anthropic key. RxDx sends it a note with the
identifiers already removed; it asks Claude Haiku 5.5 to read the note and returns
each condition with the words it came from and an ICD-10-AM code. RxDx checks every
code against its own ICD-10-AM table before showing it. The gateway stores nothing
and logs only counts and timings.

## 1. Anthropic key, with a spending cap

1. In the Claude Console, create a workspace called `RxDx`.
2. Under **Settings → Spend limits** (<https://platform.claude.com/settings/spend-limits>),
   choose the `RxDx` workspace under **Workspace limits** and set a monthly limit, for
   example US$10.
3. Create an API key inside the `RxDx` workspace. Copy it once; it is shown once.

## 2. The Worker, from the Cloudflare dashboard

1. **Workers & Pages → Create → Worker**, name it `rxdx-ai`, deploy the starter.
2. **Edit code**, delete everything, paste the whole of `worker.js`, **Deploy**.
3. **Settings → Variables and Secrets → Add**: type **Secret**, name `ANTHROPIC_API_KEY`,
   value the key from step 1.
4. Optional, only if the coding API on Render will use Claude: add a second secret,
   `SERVER_KEY`, with any long random string.
5. Open `https://rxdx-ai.<your-account>.workers.dev/health`. It should answer
   `"ok":true` and `"keyConfigured":true`.

From a terminal instead: `npx wrangler deploy` in this folder, then
`npx wrangler secret put ANTHROPIC_API_KEY`. That route also creates the shared
rate limiter in `wrangler.toml`; a dashboard deploy uses a per-instance limit of
`RATE_PER_MIN` notes a minute per address.

## 3. Point RxDx at it

For every user of the build: in `index.html`, set
`var AIC_URL='https://rxdx-ai.<your-account>.workers.dev';` and push. **Code with Claude**
is then on by default; each doctor agrees once per device before the first note is sent.

For one device only: **Note → Codes → Code with Claude (AI)**, paste the address.

The coding API on Render: set `RXDX_AI_GATEWAY` to the address and `RXDX_AI_KEY` to the
`SERVER_KEY` value.

## 4. Measure it

```bash
RXDX_AI_KEY=<SERVER_KEY> node gold/measure_ai.js https://rxdx-ai.<your-account>.workers.dev
```

Runs the 60 labelled notes through the gateway with the same checks the tool applies,
prints precision and recall beside the word-list engine, and the cost per 1,000 notes.

## Settings

| Variable | Default | |
|---|---|---|
| `ALLOW_ORIGINS` | GitHub Pages, Cloudflare Pages, `null` (a copy opened from disk) | Browser origins allowed to call |
| `MODEL` | `claude-haiku-5-5` | `claude-sonnet-5-5` reads harder notes at about 20 times the price |
| `EFFORT` | `low` | `medium` thinks more, costs more |
| `MAX_CHARS` | `8000` | Longest note accepted |
| `MAX_TOKENS` | `4000` | Longest answer |
| `RATE_PER_MIN` | `20` | Notes per minute per address, when no rate-limit binding is set |

## Tests

`node test.js` — 101 checks, offline, with the Anthropic API stubbed.
