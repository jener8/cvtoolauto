# Legacy static pages (cv-by-design.com)

Static HTML served at **cv-by-design.com** via the `cv-by-design` Vercel project.

The **primary marketing site and app** live at **[equitai.eu.com](https://equitai.eu.com)** (`source/src/`).

## Homepage

`index.html` is a **transition landing page** — it explains that CV by Design has evolved into EquitAI and links to https://equitai.eu.com. There is **no automatic redirect**.

If cv-by-design.com is ever pointed at the Next.js deployment instead, `source/src/middleware.ts` serves the same transition content via an internal rewrite.

## Other pages

- `coaches-landing.html` — organisations / coaches
- `ai-tools.html` — bespoke AI tools
- `imprint.html` — legal imprint

## Local preview

From the **repository root**:

```bash
npm run dev:website
```

Or from `source/src` (Next.js app folder):

```bash
npm run dev:website
```

Then open [http://localhost:8080](http://localhost:8080).

## Deploy

```bash
cd website && vercel deploy --prod --yes
```
