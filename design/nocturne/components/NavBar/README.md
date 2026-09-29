# NavBar

The floating glass pill across the top of every page: brand, up to six links, and an actions slot.

**The consumer provides** `brand` (the RxDx mark from `assets/Logos` plus the name), `items` (`{label, href, active}`), and `actions` (a ghost language switch and one small primary Button).

**Rules**
- The active link is cyan with a glowing dot under it; the rest are `ink-muted`.
- The language switch names the other language in that language: "عربي" on English pages, "English" on Arabic ones.
- Under `dir="rtl"` the bar mirrors on its own: brand on the right, actions on the left. Arabic labels drop letter-spacing and uppercase automatically.
- Float it `space-6` to `space-8` from the top with the page gutter on each side. It never spans edge to edge.
