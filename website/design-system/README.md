# CV by Design — shared design system

Single source of truth for **tool** (`source/src/`) and **website** (`website/`).

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
3. Copy `design-system/` to the marketing site repo and redeploy both properties.

## Token naming

- `--ds-*` — canonical names (use in new CSS)
- `--brand-teal`, `--page-bg`, etc. — legacy aliases for existing tool CSS

## Primary button colour

Teal primary: `--ds-brand-strong` (`#0f7b6c`) — matches formatter score badge and export toggles.
