# AI & platform configuration

This app uses **server-side** environment variables for AI. Keys are never exposed to the browser.

## Required environment variables

| Variable | Where | Required for |
|----------|--------|----------------|
| `OPENAI_API_KEY` | Server only | AI strategy analysis, tailored CV generation, statistics chat |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Cloud database sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Cloud database sync |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model for text generation |
| `ANTHROPIC_API_KEY` | — | Fallback if `OPENAI_API_KEY` is unset |
| `AI_GATEWAY_API_KEY` | — | Vercel AI Gateway fallback |
| `NEXT_PUBLIC_SUPABASE_LOCAL_MODE` | `false` | Browser-only storage (no Supabase calls) |

### Not used

- `NEXT_PUBLIC_OPENAI_API_KEY` — **do not use** (would expose your key in the browser)
- `DATABASE_URL` — not read by this application

## Where the OpenAI key is read

1. **`lib/ai/provider.ts`** — `getAiProviderStatus()` checks `process.env.OPENAI_API_KEY`
2. **`lib/ai/run-text-generation.ts`** — `runTextGenerationWithRetry()` calls the provider before each request
3. **`app/actions/statistics-strategy.ts`** — AI strategy analysis server action
4. **`app/actions/generate-tailored-cv.ts`** — Tailored CV generation

All AI requests run in **Next.js server actions** on the server. The client never sees the API key.

## Example `.env.local` (local development)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI (server-side only)
OPENAI_API_KEY=sk-your-openai-api-key
# OPENAI_MODEL=gpt-4o
```

After editing `.env.local`:

```bash
npm run dev
```

Verify locally:

```bash
npm run verify:ai-env
```

## Vercel production configuration

1. Open **Vercel → your project → Settings → Environment Variables**
2. Add:
   - `OPENAI_API_KEY` = your secret key (Production, Preview, Development as needed)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Redeploy** — env changes do not apply to existing deployments until redeployed

Use **Encrypted** / secret storage for `OPENAI_API_KEY`. Do not prefix with `NEXT_PUBLIC_`.

## Production checklist

- [ ] `OPENAI_API_KEY` set in Vercel (not only in local `.env.local`)
- [ ] Supabase URL and anon key set
- [ ] Redeploy after adding variables
- [ ] Statistics page **Configuration status** shows ✓ OpenAI configured
- [ ] AI strategy analysis generates when applications have recorded outcomes

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| "AI analysis requires an OpenAI API key…" locally | Key missing or dev server not restarted | Add to `.env.local`, restart `npm run dev` |
| Same message on production | Key not in Vercel env | Add `OPENAI_API_KEY` in Vercel, redeploy |
| Key in `.env.local` but still fails on Vercel | Local file is not deployed | Configure Vercel env vars separately |
| Invalid API key error | Wrong or revoked key | Regenerate key in OpenAI dashboard |

## AI provider priority

1. `OPENAI_API_KEY` (recommended)
2. `ANTHROPIC_API_KEY`
3. `AI_GATEWAY_API_KEY`

Only one backend is active — OpenAI is preferred when its key is present.
