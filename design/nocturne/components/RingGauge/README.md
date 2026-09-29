# RingGauge

A glowing ring for a bounded reading (oxygen saturation, sleep, hydration), with the value in mono at its centre.

**The consumer provides** `value`, and optionally `min`/`max` (default 0 to 100), `unit`, a short `label`, `tone`, `size` (px diameter, default 148) and `display` when the centre text should differ from the raw value.

**Rules**
- Only for readings with a real maximum. Heart rate and blood pressure have none; use a VitalTile.
- The `label` is also the meter's accessible name; keep it to one word ("SpO₂", "Sleep").
- Tone follows meaning, as in VitalTile: `cyan` measured, `emerald` healthy or live, `amber` on watch.
- The ring fills once on mount in `dur-slow`; it does not loop.
