# Button

A pill-shaped action in four weights: cyan primary, emerald vital, glass and ghost.

**Use**
- `primary` for the one action a view exists for ("Book a consultation"). One per view.
- `vital` for actions that send or share health data ("Share vitals"). Never for booking or navigation.
- `glass` for the second action beside a primary ("Start a video visit").
- `ghost` for tertiary actions and toolbars (language switch, "Not now").

**The consumer provides** the label as children, an optional `icon` (leading) or `iconEnd` (trailing, directional: it mirrors under `dir="rtl"`), and the usual button props. Pass `href` to render a link.

**Do**
- Write labels as verb + object in sentence case: "Book a consultation", "Share vitals".
- Put the primary first in reading order, the glass one after it.

**Don't**
- Don't put two primary buttons side by side, and don't place white text on cyan or emerald: labels on fills use `on-accent`.
- Don't use a Button for status; that is a StatusPill.
