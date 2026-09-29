# EquitAI — shared design system

Single source of truth for **equitai.eu.com** (marketing + app) and legacy static pages in `website/`.

## Files

| File | Purpose |
|------|---------|
| `tokens.css` | Colours, typography, spacing, radius, shadows |
| `components.css` | Buttons, cards, marketing layout primitives (`.ds-*`) |
| `../lib/design-tokens.ts` | JS mirror for charts / rare inline use |

## How the tool uses it

`app/globals.css` imports both CSS files at the top. Tailwind/shadcn variables (`--primary`, `--page-bg`, etc.) alias to `--ds-*` tokens in `tokens.css`.

Update tokens once → tool UI, formatter, workspace, and landing page update together.

## How the marketing site uses it

On deploy, copy this folder to the cv-by-design static site:

```bash
cp -R design-system "/path/to/cv-by-design/design-system"
```

In each HTML page:

```html
<link rel="stylesheet" href="./design-system/tokens.css" />
<link rel="stylesheet" href="./design-system/components.css" />
<link rel="stylesheet" href="./styles/marketing-site.css" />
```

## Keeping both sites aligned

1. Edit **`design-system/tokens.css`** for colours, type scale, spacing, radius, shadows.
2. Edit **`design-system/components.css`** for button/card/nav patterns.
3. From the tool project root, run **`npm run sync:design-system`** (copies into the static marketing site).
4. Redeploy **tool.cv-by-design.com** and **cv-by-design.com**.

## Marketing site navigation

Shared header lives in:

- `scripts/site-nav.js` — one nav for all pages; homepage anchors vs `index.html#section` on subpages
- `styles/site-nav.css` — header layout and CTA
- `styles/site-shell.css` — smooth scroll + `scroll-margin-top`

Homepage section ids: `who-its-for`, `process`, `pricing`, `contact`.


## Token naming

- `--ds-*` — canonical names (use in new CSS)
- `--brand-teal`, `--page-bg`, etc. — legacy aliases for existing tool CSS

## Primary button colour

Teal primary: `--ds-brand-strong` (`#0f7b6c`) — matches formatter score badge and export toggles.
