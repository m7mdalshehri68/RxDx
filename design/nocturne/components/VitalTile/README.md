# VitalTile

A glass telemetry widget for one reading: an eyebrow label, a large mono value with its unit, and optionally a status, a trend line, a live Waveform or a footnote.

**The consumer provides** `label`, `value` and `unit`; optionally `icon`, `status` with `statusLabel`, `trend` (recent readings, oldest first), `accent`, `footnote`, `size="sm"` for long readings in narrow tiles, and children (usually a Waveform).

**Rules**
- One reading per tile. Blood pressure is one reading ("118/76"); heart rate and SpO₂ are two tiles.
- Always give the unit, with a space: "72 bpm", "37.9 °C". Digits are Latin in both languages.
- `accent` follows meaning: `emerald` for live signals (heart, breathing), `cyan` for spot measurements, `amber` for a reading on watch. It colours the icon well, the trend and `<b>` in the footnote, never the value.
- Pair a `watch` or `critical` status with a footnote that says what changed ("+0.3 °C in the last hour").

**Don't** stack more than four tiles around a hologram, or animate the value itself.
