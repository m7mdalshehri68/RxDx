Nocturne is the night interface for RxDx's patient-facing surfaces: the clinic's landing page, booking, telehealth and live monitoring. Everything sits on a deep midnight ground under frosted glass. Neon cyan marks what you can do, and electric emerald marks what is alive. It is Arabic-first like the rest of RxDx, so every component mirrors under `dir="rtl"`.

## Principles

- **Night is the ground.** Every screen starts on `abyss` with the `.nc-ambient` backdrop. There is no light theme; don't invert it.
- **Cyan acts, emerald lives.** `cyan` is for buttons, links, focus, the hologram and the active nav. `emerald` is for heartbeats, readings in range, live presence and health-data actions. Never swap them.
- **Glass carries, it doesn't decorate.** A GlassPanel holds real content. Empty glass shapes and glass on glass on glass are out.
- **Light means interactive or alive.** Glows (`glow-cyan`, `glow-emerald`, `glow-alert`) go on things you can press or that are live. One glowing panel per view.
- **Numbers are set in mono.** Anything a clinician might compare (vitals, times, codes) is set in JetBrains Mono so the digits line up.
- **Nothing clinical is colour-only.** Status always has a word and a glyph, and critical is set apart by fill weight, not hue.

## Voice

Calm, clinical and brief. We speak to the patient as "you" and about the clinic as "we". Sentence case everywhere, with no exclamation marks and no emoji.

- Headlines make one promise: "The clinic that never sleeps."
- Leads say what is included, plainly: "Specialists, diagnostics and your records in one continuous space."
- Buttons are verb and object: "Book a consultation", "Start a video visit", "Share vitals", "Reserve".
- Reassurance is a fact, not a slogan. The product's own line is "Your records never leave your device"; use it as written.
- Status words are one or two words: "On call", "In range", "Rising", "Critical".
- Readings always carry a unit after a space ("72 bpm", "118/76 mmHg", "37.9 °C"), in Latin digits in both languages. Codes stay in English ("I21.4").
- Doctors are "Dr." plus their full name, then their specialty: "Dr. Noor Rahman · Consultant cardiologist".

## Colour

- Ground: `abyss` for the page, `midnight` for bands and the top of the ambient gradient, `deep` where something must be opaque.
- Text: `ink` for headlines and primary text, `ink-muted` for leads and body, `ink-faint` for units, captions and eyebrows. All three hold at least 4.5:1 on `abyss`, `midnight`, `deep` and every glass fill.
- Actions: `cyan` fills with `on-accent` labels; `cyan-bright` on hover; `cyan-soft` behind cyan icons and ghost-button hovers.
- Life: `emerald` for live and in-range, `emerald-soft` behind it. The vital Button is `emerald` with `on-accent`.
- Watch and critical: `amber` on `amber-soft` for watch. Critical is a solid `alert` fill with `on-accent`, plus `glow-alert`. Use `alert` as text only for errors under a Field.
- Borders: `glass-edge` is decoration; any control boundary uses `control-edge` (at least 3:1).
- Never put white text on `cyan` or `emerald`. Never make a large area cyan or emerald; they are light, not paint.

| text | on | contrast |
| --- | --- | --- |
| `ink` | `abyss` / glass over a glow | 18.3 / 10.4 |
| `ink-muted` | `abyss` / glass over a glow | 11.9 / 6.8 |
| `ink-faint` | `abyss` / glass over a glow | 8.4 / 4.8 |
| `cyan` | `abyss` / glass over a glow | 12.9 / 7.4 |
| `emerald` | `abyss` / glass over a glow | 14.0 / 8.0 |
| `on-accent` | `cyan` / `emerald` / `alert` | 12.3 / 13.3 / 7.8 |

## Glass

The recipe every glass surface uses (GlassPanel, VitalTile, NavBar, FloatButton, the glass Button):

1. Fill `glass` (or `glass-strong` for small and nested things), with a `sheen` gradient over the top 38%.
2. Backdrop `glass-blur` (`glass-blur-sm` for small controls).
3. A 1px `glass-edge` border, plus the rim light: a 1px gradient ring from `cyan-bright` at the top-left to `emerald` at the bottom-right.
4. Shadow `elev-glass` at rest and `elev-float` for floating controls.

Glass only reads over something: the ambient glows, the grid, a hologram, imagery. Where backdrop blur is missing, glass falls back to `deep`.

## Typography

- One sans family for both scripts: Plex Latin and Plex Arabic are the Latin and Arabic subsets of IBM Plex Sans Arabic, stacked so mixed lines set as one. JetBrains Mono carries numbers and eyebrows.
- `display-xl` (76/78, 700, −0.035em) is for the hero headline only. `display` is for section openers, `headline` for page titles, `title` for panel titles.
- `body-lg` in `ink-muted` for leads, `body` for prose, `body-ar` for Arabic prose (taller line height), `label` for controls.
- `metric-xl` for the one reading a tile is about, `metric` for secondary readings, `eyebrow` for uppercase labels (0.16em tracking), `code` for identifiers.
- The only gradient text allowed is the headline's key phrase, `cyan` to `emerald`, once per page.
- Arabic never takes letter-spacing or uppercase, and never the mono face. The bundle resets these under `:lang(ar)`.

## Layout and spacing

- 4px base (`space-1` … `space-24`). Desktop gutters are `space-16` at 1280–1440px, phone gutters `space-6`.
- Heroes are 16:9. Copy goes on the start half (600px column) and the hologram stage on the end half, with telemetry arranged around it and never over the head.
- The NavBar floats `space-6` to `space-8` from the top. The FloatButton dock sits in the bottom-end corner, aligned to the gutter.
- Background grid pitch is `space-12` (48px), in `grid-line`.

## Shape, depth and light

- Controls are pills (`radius-full`): Buttons, the NavBar, pills, search. Containers step up with size: `radius-md` fields, `radius-lg` panels, `radius-xl` hero stages.
- Depth is darkness below and light around: `elev-glass` under panels, a glow only on the one thing that matters.
- Keyboard focus is `focus-ring` everywhere: a 2px `abyss` gap then 2px solid `cyan`, at least 7:1 on every ground.

## Motion

Motion breathes, then stops. Hover lifts are 2–3px over `dur-fast` with `ease-out`, and colour and glow changes take `dur-base`. Gauges fill once in `dur-slow`. The only loops are the ECG trace, pulsing live dots, the hologram's sweep and flicker, and the orbit rings (`dur-ambient`). Under `prefers-reduced-motion` every loop stops and transitions become instant; the bundle handles this.

## Iconography

The Nocturne set: 20 original stroke glyphs on a 24px grid, 1.6 stroke, round caps and joins, no fills. In React use `Nocturne.Icon`, which inherits `color`. The same glyphs are in `assets/Icons` with cyan ink baked in, for places that can't run React. Sizes are 18 in controls, 20 in panels, 22 in FloatButtons and 24 standalone. Only `arrow-right` mirrors in RTL. There are no emoji.

The RxDx mark (`assets/Logos/rxdx-mark.svg`) is used as it is, at 32px in the NavBar, never recoloured or glowed.

## Imagery and the hologram

- Clinicians appear through `HoloPortrait`: the built-in faceless light-form, or a transparent cut-out portrait passed as `src`, tinted and scanned. Show only clinicians who consent, and never a patient.
- One hologram per screen, as the focal point.
- No stock photography of "futuristic" hospitals, no 3D-rendered organs, no faces on decorative elements.

## Bilingual

Pages open in Arabic, right to left, with a switch to English. Components use logical properties, so `dir="rtl"` mirrors them: the NavBar brand moves to the right, tooltips flip side, and directional icons mirror. Readings, times, codes and phone inputs stay left to right inside Arabic screens. The language switch names the other language in that language ("عربي" / "English").

## Using the components

Load `tokens.css`, `components/bundle.css`, React 18, then `components/bundle.js`; components are on `window.Nocturne`. Wrap a page in `.nc-ambient` for the backdrop. `components/Showcase` is the clinic hero composed from these parts.
