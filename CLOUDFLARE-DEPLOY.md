# Cloudflare Deployment Guide

## Build the project

Run:

```bash
npm run build
```

This generates the Cloudflare worker bundle under `dist/server` and the client asset bundle under `dist/client`.

## Deploy to Cloudflare

Use the generated worker config from `dist/server/wrangler.json` and the actual entry file:

```bash
npm run deploy:cloudflare
```

This executes:

```bash
npm run build && npx wrangler deploy --config dist/server/wrangler.json dist/server/index.js
```

## Notes

- The worker entry is `dist/server/index.js`.
- Static assets are served from `dist/client` via the generated Cloudflare config.
- If you want to test first, run:

```bash
npx wrangler deploy --config dist/server/wrangler.json dist/server/index.js --dry-run
```

## Environment variables

Set these in Cloudflare or through Wrangler secrets / environment config:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` (optional, used for AI question generation)

If you are using Cloudflare Workers secrets, add them with:

```bash
npx wrangler secret put LOVABLE_API_KEY
```

## Useful commands

- Local development: `npm run dev`
- Local Cloudflare dev preview: `npx wrangler dev --config dist/server/wrangler.json dist/server/index.js`
- Build only: `npm run build`
