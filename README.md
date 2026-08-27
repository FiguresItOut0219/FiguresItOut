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
