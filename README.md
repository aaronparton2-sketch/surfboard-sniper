# 🏄 Surfboard Sniper

A little bot that watches Facebook Marketplace for the exact surfboards you want
and pings your phone the second one gets listed, before everyone else scrolls
past it. Set your "buy box" (brands, sizes, price, area), let it run, and good
boards come to you.

This is the repo from the video. It is a personal project, shared so you can
build your own. Point it at whatever you collect: surfboards, bikes, cameras,
guitars. The plumbing is the same.

```
🏄 NEW JS Industries — A$650
JS Industries Monsta 6'2 33L great condition
📏 6'2" · 33L · 📍 8km away

💬 "Hey mate, is this still available? Keen to come have a look 👀"

Open listing ↗
```

## Try it in 30 seconds (no keys, no setup)

```bash
git clone https://github.com/aaronparton2-sketch/surfboard-sniper.git
cd surfboard-sniper
node src/demo.js
```

That runs the matcher against the included sample listings and prints what it
would alert on. No API keys, no network. Edit the `CONFIG` block in
[`src/matcher.js`](src/matcher.js) and run it again to see your buy box in action.

## How it works (the short version)

A timer fires every 30 minutes → a scraper pulls the newest Marketplace listings
→ a matcher keeps only the ones inside your buy box → new ones get saved (so you
are never alerted twice) → you get a Telegram message with the photo, the price
and a tap-through link.

Full walkthrough with a diagram: [`docs/how-it-works.md`](docs/how-it-works.md).

## What's in here

| File | What it is |
|---|---|
| [`src/matcher.js`](src/matcher.js) | The brain. Your buy box config + all the matching logic. The one file you'll actually edit. |
| [`src/caption.js`](src/caption.js) | Formats the alert message. |
| [`src/demo.js`](src/demo.js) | Offline demo runner. |
| [`samples/listings.sample.json`](samples/listings.sample.json) | Example Marketplace listings to test against. |
| [`workflow/surfboard-sniper.template.json`](workflow/surfboard-sniper.template.json) | The n8n workflow, ready to import (placeholders for your keys). |
| [`supabase/schema.sql`](supabase/schema.sql) | The one table it stores listings in. |

## Run it for real

You need three free-tier accounts: [Apify](https://apify.com),
[Supabase](https://supabase.com) and an [n8n](https://n8n.io) instance (self-host
or cloud). Plus a [Telegram bot](https://core.telegram.org/bots#botfather).

1. **Database.** In Supabase, open the SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql).
2. **Import the workflow.** In n8n, import
   [`workflow/surfboard-sniper.template.json`](workflow/surfboard-sniper.template.json).
3. **Add your credentials** in n8n (nothing is hardcoded in the file):
   - Apify: a Header Auth credential, `Authorization = Bearer <your Apify token>`.
   - Supabase: the Supabase credential with your project URL + service role key.
   - Telegram: your bot token.
4. **Fill the placeholders** in the workflow: `YOUR_CITY` in the Apify search
   URL, `YOUR_PROJECT` in the two Supabase URLs, and `YOUR_TELEGRAM_CHAT_ID` in
   the Telegram node.
5. **Set your buy box** by editing the `BRANDS` and `CONFIG` at the top of the
   "Match buy box" code node (it mirrors `src/matcher.js`).
6. **Activate** the workflow. Run it once manually first to check the wiring.

See [`.env.example`](.env.example) for where each value comes from.

## Roughly what it costs

The only thing that costs money is the Apify scraper, billed per run. Scanning a
single city's newest listings every 30 minutes during waking hours is cents a
day on Apify's free monthly credit for most people. Set a monthly spend limit in
your Apify account so it can never run away. n8n (self-hosted), Supabase free
tier and Telegram are all free.

## Make it yours

- **Different gear:** rewrite `BRANDS`, the size/price logic and `EXCLUDE_TITLE`.
  The structure carries over to anything with a brand and a few specs.
- **Different alert channel:** swap the Telegram node for Discord, email, Slack
  or SMS. The caption is plain text + one link.
- **A dashboard:** everything lands in Supabase, so a simple web frontend on top
  is an easy next step.

## Please be sensible

This is for personal use, finding gear you'd genuinely buy. Respect Facebook's
terms, do not hammer the scraper, keep your volumes low, and do not resell or
redistribute scraped data. You are responsible for how you run it.

## License

MIT. Do what you like with it. See [`LICENSE`](LICENSE).

---

**Built by [Mycelium AI](https://www.myceliumai.com.au)**, a Perth agency that builds websites, runs Google and Meta ads, and automates the admin for small businesses. Follow the builds on Instagram at [@aaronautomates](https://www.instagram.com/aaronautomates/).
