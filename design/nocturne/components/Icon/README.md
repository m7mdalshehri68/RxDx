# Icon

The Nocturne stroke icon set: 20 medical and interface glyphs on a 24px grid, 1.6 stroke, round caps and joins, drawn in `currentColor`.

**The consumer provides** `name` (see `Icon.names`), and optionally `size` (default 20), `title` (gives it an accessible name; otherwise it is decorative) and `className`.

**Rules**
- Colour comes from the parent's `color`: `cyan` for actions, `emerald` for vitals and reassurance, `ink-muted` beside text.
- Sizes: 18 in buttons and fields, 20 in panels, 22 in FloatButtons, 24 standalone. Don't scale them past 32; draw a new glyph instead.
- `arrow-right` is directional and mirrors in RTL buttons; the others do not.
- The same glyphs are in `assets/Icons` as SVG files for places that can't run React.
