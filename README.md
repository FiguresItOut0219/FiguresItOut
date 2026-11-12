# Figures It Out

## Contact-form email delivery

The contact form posts to the Cloudflare Pages Function in `functions/api/contact.ts`.
It sends an email through Resend. Configure these production variables in Cloudflare
Pages before using it:

- `RESEND_API_KEY` — a Resend Sending Access API key (store as a secret)
- `CONTACT_TO_EMAIL` — the inbox that should receive project enquiries
- `CONTACT_FROM_EMAIL` — for example, `Figures It Out <hello@figuresitout.xyz>`

`figuresitout.xyz` must first be verified in Resend, using the DNS records Resend
provides. Never put the API key in a `VITE_` variable or commit it to Git.


## Print order demo

See [印作订单系统前端演示](docs/print-company-demo.md) for the demo flow, upstream attribution, storage limitations, and verification commands.


## Stock analysis workbench

`/tools/stock-workbench` — multi-market quotes, market review and a technical-indicator
dashboard. The page only calls same-origin `/api/em/*`, proxied by the Pages Function in
`functions/api/em/[[path]].ts`. Quotes and K-lines fall back across Tencent → Yahoo →
Eastmoney (shared/marketSources.ts); sectors and market breadth are Eastmoney-only. A
separate Worker (`worker/daily-analysis.ts`, deployed with `wrangler.cron.toml`) runs the
scheduled analysis and pushes it to IM webhooks, because Pages Functions do not support
Cron Triggers.

See [股票智能分析工作台](docs/stock-workbench.md) for the setup, the measured reliability
of each upstream, and four encoding/routing pitfalls worth knowing about.

The stock chat tab can also run on a real LLM. The key must live server-side —
anything with a `VITE_` prefix ends up in the browser bundle. Configure `LLM_API_KEY`
(plus optional `LLM_API_BASE` / `LLM_MODEL`) under **Workers & Pages → your project →
Settings → Environment variables**, redeploy, and the AI mode unlocks itself. The docs
cover which providers work and why the built-in rate limit is only a speed bump.

