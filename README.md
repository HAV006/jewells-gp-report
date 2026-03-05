# Jewells GP Report (Cloudflare Pages)

Static Cloudflare Pages frontend that reads the latest GP report JSON from your Cloudflare Worker endpoint:

- GET /gp-report (public)
- Data backed by KV key: gp_report_latest

## Configure Worker URL
Edit `app.js` and set:

`const GP_REPORT_URL = "https://<your-worker>.workers.dev/gp-report";`

## Deploy
1) Push these files to GitHub
2) Create Cloudflare Pages project connected to the repo
3) Build settings:
   - Framework preset: None
   - Build command: (empty)
   - Output directory: `/` (root)
