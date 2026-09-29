# GlassPanel

The frosted surface everything in Nocturne sits on: a faint fill, a 24px backdrop blur, a top sheen and a rim light that runs cyan to emerald.

**Use** for cards, widgets and any grouped content over the ambient backdrop. VitalTile, the NavBar and the hologram caption are built from the same recipe.

**The consumer provides** children and optionally:
- `strength="strong"` for small panels and panels nested in another panel (glass on glass needs more fill to read).
- `glow="cyan"` or `"emerald"` for the single panel that matters most on screen: the next appointment, the live reading.
- `pad` (`none`, `sm` 16, `md` 24, `lg` 32) and `as` for the element.

**Rules**
- Glass needs something behind it. Put it over `.nc-ambient`, a glow or imagery; over flat `abyss` it reads as a dark card, which is fine.
- One glowing panel per view. If everything glows, nothing does.
- Where `backdrop-filter` is unsupported the panel falls back to an opaque `deep` fill automatically.
