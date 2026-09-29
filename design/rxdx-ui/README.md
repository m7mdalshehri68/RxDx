# RxDx product UI

The redesigned RxDx interface: the product, its design system and the landing page. It keeps the tool's
structure, tokens and brand (warm paper, ink-navy sidebar, one teal for action, coral for the brand) and raises
the quality. Everything is static HTML, CSS and JavaScript with no build step and no network.

| | |
|---|---|
| `app.html` | the clickable prototype: workspace gate, sidebar, top bar, command palette (⌘K), shortcuts (?) and the screens below |
| `system.html` | the design system: tokens and every component, in light and dark, LTR and RTL (`?mode=quad` shows all four at once) |
| `../../landing/` | the landing page with the self-typing demo, in Arabic and English |
| `tokens.css` | colours, type, radii, shadows, spacing and motion, with the dark theme and larger text |
| `components.css`, `app.css` | components, then the shell and screens; logical properties throughout, so `dir="rtl"` mirrors everything |
| `data.js` | Arabic and English strings, the icon set and the example encounter |

## Screens in the prototype

- **Note → Codes**: the split workspace, the six real analysis steps (1.2 s, skippable with Esc), then the principal
  diagnosis with its evidence and "why principal", additional diagnoses, *Not coded* with reasons, documentation
  gaps with physician queries, validation that settles in sequence, what the selected insurer will ask, and a sticky
  actions bar. Selecting a code highlights its sentences and draws a connector to the card; selecting highlighted
  text selects its code; J / K move between codes and E toggles evidence. Finalising with open items asks for a
  one-line reason. The **Prototype** strip switches between the states: empty, analysing, result, no diagnosis,
  service unreachable, long note, and calibrated percentages.
- **History Builder**, with the *Before the patient leaves* card and its insurer switch.
- **Search**, **ICD-10 Diagnosis** and **Drug Formulary**.
- **Executive dashboard** (demo data, clearly labelled) and **Payer protocols** (the comparison matrix and the
  per-insurer counts come from `preauth/PA.json`).
- **Coder review**: sections, items, the note with its evidence highlighted, and accept, change or reject with a reason.

Open with `?lang=en` or `?lang=ar`, `?theme=dark`, `?role=doctor|mgmt|it`, and on Note → Codes `?state=result`.

The prototype codes the example note only; the live tool (`index.html`) codes any note. The insurer questions are
the real ones from the parsed protocols. The dashboard figures are demo data.
