# Showcase

The clinic landing hero at 1440 × 810 (16:9), built only from Nocturne components and tokens, as the reference for how the system composes.

**How it is built**
- Ground: `.nc-ambient` (midnight-to-abyss gradient, cyan and emerald glows, the 48px monitor grid, matte grain).
- The NavBar floats `space-6` from the top with a `space-16` gutter.
- Left column, 600px: a live StatusPill with an eyebrow, the `display-xl` headline with its second line in the cyan-to-emerald text gradient, a `body-lg` lead in `ink-muted`, a primary and a glass `lg` Button, and three reassurance lines with emerald icons at the bottom.
- Right: one HoloPortrait (size 430) over a slow radar ring, with four widgets around it (a heart-rate VitalTile with a Waveform, an SpO₂ RingGauge in a cyan-glow GlassPanel, a pressure VitalTile with a trend, and a next-appointment GlassPanel). Dashed callout leaders tie each widget to the figure, and a FloatButton dock sits in the bottom-end corner.

**Keep** the headline's second line as the only gradient text on the page, one glowing panel, one pulsing FloatButton, and every widget clear of the hologram's head.
