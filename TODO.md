# EquitAI — Remaining Tasks

## Project structure
- [x] Marketing site consolidated into `website/` (legacy static pages)
- [x] Primary marketing landing on **equitai.eu.com** (`source/src/`)
- [x] Tool app in `source/src/`
- [x] Local dev scripts at project root (`npm run dev:website`, `npm run dev:tool`)

## Domain
- [x] Primary site: equitai.eu.com (marketing + app)
- [ ] Redirect cv-by-design.com homepage → equitai.eu.com
- [ ] Migrate coaches / ai-tools / imprint pages into Next.js or equitai.eu.com
- [ ] Retire cv-by-design.com when all pages are migrated

## Visual assets to recreate
- [ ] New favicon (EquitAI mark)
- [ ] New og-image (1200×630) with EquitAI branding
- [ ] Nav logo SVG or wordmark graphic (optional — CSS wordmark is fine for now)

## Tool UI
- [ ] Confirm all "CV by Design" references removed from login and admin emails
- [ ] Update any email notifications sent from the tool

## Copy
- [ ] Once Notion EquitAI brief is finalised, review homepage hero and About section copy for alignment
- [ ] Consider adding an "About EquitAI" page or section that explains the name and mission

## Deploy
- [x] Deploy `source/src/` to equitai.eu.com (Vercel)
- [x] Deploy `website/` to cv-by-design.com (legacy static pages)
