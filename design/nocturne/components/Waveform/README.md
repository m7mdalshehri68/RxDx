# Waveform

A scrolling ECG trace on a faint monitor grid, paced by `bpm`.

**The consumer provides** `bpm`, and optionally `tone`, `height` (px; width fills the container), `live={false}` to pause it, `grid={false}`, and a `label` for screen readers.

**Use** inside a VitalTile under a heart-rate reading, or alone as a divider in live-monitoring views.

**Rules**
- It is an illustration of rhythm, not diagnostic data. Never present it as a patient's real ECG.
- `emerald` while in range; switch the tone to `amber` or `alert` together with the tile's status, never on its own.
- It stops under `prefers-reduced-motion`.
