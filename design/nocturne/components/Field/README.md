# Field

A glass text input with a label, a leading icon, an optional trailing node and a hint that becomes the error message.

**The consumer provides** `label`, the usual input props (`value`, `onChange`, `placeholder`, `type`, `inputMode`), and optionally `icon`, `trailing` (a small Button or a keyboard hint), `hint`, `invalid` and `shape="pill"` for search.

**Rules**
- The border is `control-edge`, which holds 3:1 on every ground, so the field stays findable on glass. Focus turns it cyan with a soft glow.
- Placeholders show an example, never the label ("As on your national ID").
- An error goes in `hint` with `invalid`: say what to do ("Enter the full 10-digit number"), not what went wrong.
- Numbers, dates and codes stay left to right inside Arabic forms; set `dir="ltr"` on those inputs.
