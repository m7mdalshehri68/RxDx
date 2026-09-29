# StatusPill

A word and a glyph that say what state something is in: live, stable, watch, critical, offline or info.

**Status never relies on hue.** Each status has its own glyph (pulsing dot, check, eye, exclamation, dash, i), and severity rises in weight: stable and watch are tinted outlines, critical is a solid `alert` fill with `on-accent` text and a glow.

| status | means | colour |
| --- | --- | --- |
| `live` | someone or something is connected right now | emerald, pulsing dot |
| `stable` | a reading is in range | emerald |
| `watch` | drifting out of range, or waiting on something | amber |
| `critical` | needs attention now | solid alert |
| `offline` | no data | ink-faint on glass |
| `info` | neutral news: results ready, a note | cyan |

**The consumer provides** `status` and, usually, a more specific word as children ("In range", "Rising", "On call"). Keep it to one or two words. Pass `role="status"` when the pill updates live, so assistive technology announces the change.

**Don't** colour a whole card by status, or show a critical pill without saying what to do next nearby.
