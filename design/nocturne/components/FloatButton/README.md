# FloatButton

A round glass button that floats above the page for always-available actions: message, video, share vitals, emergency.

**Use** in a dock of two to four, at the bottom-end corner or beside the hologram. Each opens something immediate.

**The consumer provides** `icon`, a required `label` (the accessible name and the tooltip), and optionally `tone`, `pulse`, `badge` and `tip`.

- `tone="cyan"` for ordinary actions, `emerald` for live health actions, `alert` only for an emergency line.
- `pulse` adds a breathing ring. Use it on at most one button, for something live.
- `badge` shows a count in the corner, in emerald with `on-accent` digits.
- The tooltip sits on the inline-start side by default (left in English, right in Arabic); set `tip="end"` when the dock is on the start edge.

**Don't** use a FloatButton for navigation, or put a text label inside it.
