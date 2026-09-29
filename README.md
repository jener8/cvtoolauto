# EquitAI

Single project for the **EquitAI marketing site** and **career tool**.

## Project layout

| Path | What it is | Live URL |
|------|------------|----------|
| `source/src/` | Marketing landing + career tool (Next.js) | [equitai.eu.com](https://equitai.eu.com) |
| `website/` | Legacy static pages (coaches, imprint, etc.) | [cv-by-design.com](https://cv-by-design.com) |

The **marketing site** is **equitai.eu.com** — homepage, nav, pricing, and sign-up all live in the Next.js app at `source/src/`.

Design tokens live in `source/src/design-system/`. Sync to the legacy static folder with:

```bash
npm run sync:design-system
```

## Local development

From the project root:

```bash
# Marketing + app → http://localhost:3000
npm run dev:tool

# Legacy static pages only → http://localhost:8080
npm run dev:website
```

Open the marketing homepage at [http://localhost:3000](http://localhost:3000).

## Deploy

- **Marketing + app:** deploy `source/src/` to Vercel → **equitai.eu.com**
- **Legacy static pages:** deploy `website/` to Vercel → cv-by-design.com (until migrated)

See `TODO.md` for domain migration tasks.
